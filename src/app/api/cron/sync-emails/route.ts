// app/api/cron/sync-emails/route.ts
//
// Vercel Cron handler - syncs emails for all tracked accounts
// Add to vercel.json:
// {
//   "crons": [{
//     "path": "/api/cron/sync-emails",
//     "schedule": "0 */2 * * *"  # every 2 hours
//   }]
// }

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Verify the request is from Vercel Cron
function verifyVercelCron(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  return !!cronSecret && authHeader === `Bearer ${cronSecret}`;
}

export async function GET(req: NextRequest) {
  // Verify this is a legitimate Vercel Cron request
  if (!verifyVercelCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Get all tracked connected accounts
    const { data: accounts, error: fetchError } = await admin
      .from("connected_accounts")
      .select("id, user_id, gmail_address, token_expires_at")
      .eq("is_tracking", true);

    if (fetchError || !accounts) {
      return NextResponse.json({ error: "Failed to fetch accounts" }, { status: 500 });
    }

    const results = [];

    // Sync each account
    for (const account of accounts) {
      try {
        const syncRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/gmail/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            connectedAccountId: account.id,
            userId: account.user_id,
          }),
        });

        const syncData = (await syncRes.json()) as any;
        results.push({
          account: account.gmail_address,
          status: syncRes.ok ? "success" : "error",
          data: syncData,
        });
      } catch (err) {
        results.push({
          account: account.gmail_address,
          status: "error",
          error: String(err),
        });
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      accountsSynced: accounts.length,
      results,
    });
  } catch (err) {
    console.error("[cron/sync-emails]", err);
    return NextResponse.json(
      { error: "Internal server error", detail: String(err) },
      { status: 500 }
    );
  }
}
