// app/api/gmail/sync/route.ts
//
// Syncs emails from a Gmail account using the Gmail API.
// Called either:
//   - Manually from the UI (user clicks "Sync Now")
//   - By a scheduled job (Vercel Cron or external service)
//
// Flow:
//   1. Get valid access token for the connected account (auto-refresh if needed)
//   2. Fetch message metadata from Gmail API (headers, labels)
//   3. For each new message, create a row in public.emails
//   4. Send new emails for AI processing (via Groq)
//   5. Return sync stats
//
// Schema refs:
//   public.connected_accounts   — access_token (encrypted), refresh_token, last_synced_at
//   public.emails               — all fields
//   public.sync_logs            — audit trail

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getValidAccessToken, decryptToken } from "@/lib/gmail";

// Gmail API constants
const GMAIL_API = "https://www.googleapis.com/gmail/v1";

interface GmailMessage {
  id: string;
  threadId: string;
}

interface GmailMessageDetail {
  id: string;
  threadId: string;
  labelIds: string[];
  internalDate: string;
  payload: {
    headers: Array<{
      name: string;
      value: string;
    }>;
    mimeType: string;
    parts?: Array<any>;
  };
}

export async function POST(req: NextRequest) {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const body = await req.json();
    const { connectedAccountId, userId } = body;

    if (!connectedAccountId || !userId) {
      return NextResponse.json(
        { error: "connectedAccountId and userId required" },
        { status: 400 }
      );
    }

    // ── 1. Get the connected account ──────────────────────────────────────────
    const { data: account, error: accountError } = await admin
      .from("connected_accounts")
      .select("*")
      .eq("id", connectedAccountId)
      .eq("user_id", userId)
      .single();

    if (accountError || !account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // ── 2. Get a valid access token (auto-refresh if expired) ──────────────────
    let accessToken: string;
    try {
      accessToken = await getValidAccessToken(connectedAccountId);
    } catch (err) {
      console.error("[gmail/sync] Token refresh failed:", err);
      await admin
        .from("connected_accounts")
        .update({ last_sync_status: "error", last_sync_error: String(err) })
        .eq("id", connectedAccountId);
      return NextResponse.json({ error: "Token refresh failed" }, { status: 401 });
    }

    // ── 3. Fetch message list from Gmail ──────────────────────────────────────
    // Query: only unread or starred, or from last 7 days (customize as needed)
    const query = `newer_than:7d`;
    const gmailListUrl = new URL(`${GMAIL_API}/users/me/messages`);
    gmailListUrl.searchParams.append("q", query);
    gmailListUrl.searchParams.append("maxResults", "100");

    const listRes = await fetch(gmailListUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!listRes.ok) {
      const err = await listRes.text();
      console.error("[gmail/sync] List messages failed:", err);
      await admin
        .from("connected_accounts")
        .update({ last_sync_status: "error", last_sync_error: `List failed: ${err}` })
        .eq("id", connectedAccountId);
      return NextResponse.json({ error: "Failed to list messages" }, { status: 502 });
    }

    const listData = (await listRes.json()) as { messages?: GmailMessage[] };
    const messageIds = listData.messages?.map((m) => m.id) ?? [];

    if (messageIds.length === 0) {
      // No new messages
      await admin
        .from("connected_accounts")
        .update({ last_synced_at: new Date().toISOString(), last_sync_status: "success" })
        .eq("id", connectedAccountId);
      return NextResponse.json({ synced: 0, new: 0, processed: 0 });
    }

    // ── 4. Fetch full details for each message (batch: max 50 per iteration) ──
    const newEmails = [];
    const processedCount = 0;

    for (const msgId of messageIds) {
      try {
        const detailRes = await fetch(`${GMAIL_API}/users/me/messages/${msgId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!detailRes.ok) {
          console.warn(`[gmail/sync] Failed to fetch message ${msgId}`);
          continue;
        }

        const msg = (await detailRes.json()) as GmailMessageDetail;

        // Extract email headers
        const headers = msg.payload.headers ?? [];
        const getHeader = (name: string) =>
          headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? null;

        const subject = getHeader("subject");
        const from = getHeader("from");
        const to = getHeader("to");
        const receivedDate = new Date(parseInt(msg.internalDate)).toISOString();
        const snippet = await fetchEmailSnippet(accessToken, msgId);

        // Parse sender name and email
        let senderEmail = from;
        let senderName = null;
        if (from?.includes("<")) {
          const match = from.match(/^([^<]+)<([^>]+)>$/);
          if (match) {
            senderName = match[1].trim();
            senderEmail = match[2];
          }
        }

        // Parse recipient emails
        const recipientEmails = to
          ? to.split(",").map((e) => e.trim().split("<")[1]?.slice(0, -1) || e.trim())
          : [];

        // Check if already imported (via unique constraint)
        const { data: exists } = await admin
          .from("emails")
          .select("id")
          .eq("connected_account_id", connectedAccountId)
          .eq("gmail_message_id", msgId)
          .single();

        if (exists) {
          continue; // Already imported
        }

        // Create email row
        const { data: newEmail, error: insertError } = await admin
          .from("emails")
          .insert({
            connected_account_id: connectedAccountId,
            gmail_message_id: msgId,
            gmail_thread_id: msg.threadId,
            subject,
            sender_email: senderEmail,
            sender_name: senderName,
            recipient_emails: recipientEmails,
            received_at: receivedDate,
            snippet,
            gmail_labels: msg.labelIds ?? [],
            is_unread: msg.labelIds?.includes("UNREAD") ?? false,
            is_starred: msg.labelIds?.includes("STARRED") ?? false,
            has_attachment: msg.payload.mimeType?.includes("multipart"),
            is_processed: false,
          })
          .select()
          .single();

        if (!insertError && newEmail) {
          newEmails.push(newEmail);
        }
      } catch (err) {
        console.error(`[gmail/sync] Error processing message ${msgId}:`, err);
      }
    }

    // ── 5. Update connected account stats ─────────────────────────────────────
    await admin
      .from("connected_accounts")
      .update({
        last_synced_at: new Date().toISOString(),
        last_sync_status: "success",
        total_emails_seen: (account.total_emails_seen ?? 0) + newEmails.length,
      })
      .eq("id", connectedAccountId);

    // ── 6. Log the sync ──────────────────────────────────────────────────────
    await admin.from("sync_logs").insert({
      connected_account_id: connectedAccountId,
      sync_type: "manual",
      status: "success",
      emails_fetched: messageIds.length,
      emails_new: newEmails.length,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });

    // ── 7. Queue emails for AI processing (fire and forget) ────────────────────
    // In production, you'd use a job queue (Bull, Inngest, etc.)
    // For now, we'll process in background (no await)
    if (newEmails.length > 0) {
      processEmailsWithGroq(connectedAccountId, newEmails, accessToken).catch(console.error);
    }

    return NextResponse.json({
      synced: messageIds.length,
      new: newEmails.length,
      processed: processedCount,
    });
  } catch (err) {
    console.error("[gmail/sync] Unexpected error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ─── Helper: Fetch email snippet/preview ──────────────────────────────────────
async function fetchEmailSnippet(
  accessToken: string,
  messageId: string
): Promise<string | null> {
  try {
    const res = await fetch(
      `${GMAIL_API}/users/me/messages/${messageId}?format=metadata&metadataHeaders=subject,from`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as any;
    return data.snippet ?? null;
  } catch {
    return null;
  }
}

// ─── Helper: Process emails with Groq for AI classification ────────────────────
async function processEmailsWithGroq(
  connectedAccountId: string,
  emails: any[],
  accessToken: string
) {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    console.warn("[processEmailsWithGroq] GROQ_API_KEY not set");
    return;
  }

  for (const email of emails) {
    try {
      // Fetch full email body
      const bodyRes = await fetch(
        `${GMAIL_API}/users/me/messages/${email.gmail_message_id}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!bodyRes.ok) continue;

      const fullMsg = (await bodyRes.json()) as any;
      const body = extractEmailBody(fullMsg.payload);

      // Call Groq to classify
      const prompt = `Analyze this email and provide JSON response with:
- priority: "high" | "medium" | "low" | "none"
- category: "billing" | "meeting" | "personal" | "work" | "other"
- sentiment: "positive" | "neutral" | "negative" | "urgent"
- requiresAction: boolean
- meetingDetected: boolean (true if Zoom/Meet/Teams link found)

Email:
Subject: ${email.subject}
From: ${email.sender_email}
Body: ${body?.slice(0, 1000)}

Return ONLY valid JSON.`;

      const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.1-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.4,
          max_tokens: 300,
          response_format: { type: "json_object" },
        }),
      });

      if (!groqRes.ok) {
        console.warn("[processEmailsWithGroq] Groq failed:", await groqRes.text());
        continue;
      }

      const groqData = (await groqRes.json()) as any;
      const analyzed = JSON.parse(groqData.choices[0].message.content);

      // Update email with AI results
      await admin
        .from("emails")
        .update({
          ai_priority: analyzed.priority,
          ai_category: analyzed.category,
          ai_sentiment: analyzed.sentiment,
          ai_requires_action: analyzed.requiresAction,
          ai_meeting_detected: analyzed.meetingDetected,
          is_processed: true,
          processed_at: new Date().toISOString(),
        })
        .eq("id", email.id);

      // If meeting detected, create calendar event
      if (analyzed.meetingDetected) {
        await createCalendarEventFromEmail(
          connectedAccountId,
          email,
          body,
          accessToken
        ).catch(console.error);
      }
    } catch (err) {
      console.error(`[processEmailsWithGroq] Error for ${email.id}:`, err);
    }
  }
}

// ─── Helper: Extract email body from payload ─────────────────────────────────
function extractEmailBody(payload: any): string {
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain") {
        const data = part.body.data || "";
        return Buffer.from(data, "base64").toString("utf-8");
      }
    }
  }
  const data = payload.body?.data || "";
  return Buffer.from(data, "base64").toString("utf-8");
}

// ─── Helper: Create calendar event from meeting email ──────────────────────────
async function createCalendarEventFromEmail(
  connectedAccountId: string,
  email: any,
  body: string | null,
  _accessToken: string
) {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get user_id for this account
  const { data: account } = await admin
    .from("connected_accounts")
    .select("user_id")
    .eq("id", connectedAccountId)
    .single();

  if (!account) return;

  // Extract meeting link and details
  const meetingLink = extractMeetingLink(body || "");
  if (!meetingLink) return;

  const { platform, id } = parseMeetingLink(meetingLink);

  // Try to extract date/time from subject or body
  // For now, use a simple heuristic
  const eventDate = extractEventDate(email.subject, body) || new Date().toISOString().split("T")[0];

  await admin.from("calendar_events").insert({
    user_id: account.user_id,
    connected_account_id: connectedAccountId,
    email_id: email.id,
    gmail_message_id: email.gmail_message_id,
    title: email.subject || "Meeting",
    description: body?.slice(0, 500),
    event_type: "meeting",
    event_date: eventDate,
    meeting_link: meetingLink,
    meeting_platform: platform,
    meeting_id: id,
    organizer_email: email.sender_email,
    participant_emails: email.recipient_emails,
    status: "scheduled",
    ai_confidence: 0.85,
  });
}

// ─── Helper: Extract meeting link from text ──────────────────────────────────
function extractMeetingLink(text: string): string | null {
  const patterns = [
    /https:\/\/meet\.google\.com\/[\w-]+/i,
    /https:\/\/zoom\.us\/j\/\d+/i,
    /https:\/\/teams\.microsoft\.com\/l\/meetup-join\/[\w%=&?+\-/]+/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[0];
  }

  return null;
}

// ─── Helper: Parse meeting link to extract platform and ID ────────────────────
function parseMeetingLink(link: string): { platform: string; id: string } {
  if (link.includes("meet.google.com")) {
    const id = link.split("/").pop() || "";
    return { platform: "google_meet", id };
  }
  if (link.includes("zoom.us")) {
    const id = link.match(/\/j\/(\d+)/)?.[1] || "";
    return { platform: "zoom", id };
  }
  if (link.includes("teams.microsoft.com")) {
    return { platform: "teams", id: link };
  }
  return { platform: "other", id: link };
}

// ─── Helper: Extract event date from email ────────────────────────────────────
function extractEventDate(subject: string | null, body: string | null): string | null {
  const text = `${subject} ${body}`.toLowerCase();
  const today = new Date();

  // Simple patterns: "tomorrow", "next Monday", specific dates
  if (text.includes("tomorrow")) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  }

  // Try to find date patterns: MM/DD, MM-DD, Month DD
  const dateMatch = text.match(/(\d{1,2})[/-](\d{1,2})/);
  if (dateMatch) {
    const [_, month, day] = dateMatch;
    const year = today.getFullYear();
    const date = new Date(year, parseInt(month) - 1, parseInt(day));
    return date.toISOString().split("T")[0];
  }

  return null;
}
