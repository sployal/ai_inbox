// app/api/gmail/callback/route.ts
//
// Step 2 of the Gmail OAuth flow.
// Google redirects here after the user grants (or denies) permission.
//
// Flow:
//   1. Validate the state param (CSRF check via oauth_states table)
//   2. Exchange the authorization code for access + refresh tokens
//   3. Fetch the Gmail account's email and Google ID via userinfo API
//   4. Encrypt both tokens with AES-256-GCM
//   5. Upsert into public.connected_accounts (exact schema columns)
//   6. Fire-and-forget background sync
//   7. Redirect to /home with success toast param
//
// Schema refs:
//   public.oauth_states         — user_id, nonce, expires_at, id
//   public.connected_accounts   — all columns inserted below
//   public.users                — id referenced by connected_accounts.user_id

import { NextRequest, NextResponse }            from "next/server";
import { createClient }                          from "@supabase/supabase-js";
import {
  exchangeCodeForTokens,
  getGoogleUserInfo,
  encryptToken,
  emailToInitials,
  emailToColor,
  GMAIL_SCOPES,
} from "@/lib/gmail";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code       = searchParams.get("code");
  const state      = searchParams.get("state");
  const oauthError = searchParams.get("error");

  // ── User denied permission ────────────────────────────────────────────────
  if (oauthError) {
    return NextResponse.redirect(new URL("/home?error=oauth_denied", req.url));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL("/home?error=oauth_invalid", req.url));
  }

  // We use service role for all ops here — this is a server-only route
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // ── 1. Decode and verify the CSRF state ───────────────────────────────────
    let stateData: { userId: string; nonce: string };
    try {
      stateData = JSON.parse(Buffer.from(state, "base64url").toString());
    } catch {
      return NextResponse.redirect(new URL("/home?error=invalid_state", req.url));
    }

    // Look up the nonce in oauth_states — must exist and not be expired
    // Schema: oauth_states.user_id references public.users.id
    const { data: oauthState, error: stateError } = await admin
      .from("oauth_states")
      .select("id")
      .eq("user_id", stateData.userId)
      .eq("nonce", stateData.nonce)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (stateError || !oauthState) {
      return NextResponse.redirect(new URL("/home?error=state_expired", req.url));
    }

    // Delete the used nonce immediately (one-time use)
    await admin.from("oauth_states").delete().eq("id", oauthState.id);

    // ── 2. Exchange code for tokens ───────────────────────────────────────────
    const tokens = await exchangeCodeForTokens(code);

    if (!tokens.refresh_token) {
      // Should not happen because we force prompt=consent in buildGoogleAuthUrl.
      // If it does, the user needs to revoke InboxAI access in their Google account
      // settings and reconnect.
      return NextResponse.redirect(new URL("/home?error=no_refresh_token", req.url));
    }

    // ── 3. Get the Gmail account's email and Google ID ────────────────────────
    const gmailUser = await getGoogleUserInfo(tokens.access_token);

    // ── 4. Encrypt both tokens ────────────────────────────────────────────────
    // Schema: connected_accounts.access_token and .refresh_token are encrypted text
    const [encryptedAccess, encryptedRefresh] = await Promise.all([
      encryptToken(tokens.access_token),
      encryptToken(tokens.refresh_token),
    ]);

    // ── 5. Upsert into connected_accounts ─────────────────────────────────────
    // All column names match public.connected_accounts in the schema exactly.
    // ON CONFLICT (user_id, gmail_address) → update tokens + sync status.
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    const { data: upsertedAccount, error: upsertError } = await admin
      .from("connected_accounts")
      .upsert(
        {
          // ── Identity ──────────────────────────────────────────────────────
          user_id:           stateData.userId,    // → public.users.id
          gmail_address:     gmailUser.email,      // the inbox being connected
          google_account_id: gmailUser.id,         // Google's sub for this Gmail account

          // ── Display ───────────────────────────────────────────────────────
          display_name:    gmailUser.name.split(" ")[0] ?? gmailUser.email.split("@")[0],
          avatar_initials: emailToInitials(gmailUser.email),
          color:           emailToColor(gmailUser.email),

          // ── Encrypted tokens ─────────────────────────────────────────────
          access_token:    encryptedAccess,
          refresh_token:   encryptedRefresh,
          token_expires_at: tokenExpiresAt,

          // ── Scopes granted ────────────────────────────────────────────────
          // Schema: scopes text[] — store as array
          scopes: GMAIL_SCOPES.split(" "),

          // ── Tracking + sync state ─────────────────────────────────────────
          is_tracking:      true,
          last_sync_status: "pending",  // schema check: 'pending'|'success'|'error'

          // ── AI settings (schema default is fine, but explicit here) ───────
          ai_settings: {
            summaryEnabled:       true,
            weeklyDigestEnabled:  true,
            autoScheduleEnabled:  true,
            priorityAlertsEnabled: true,
            summaryTime:          null,
            minEmailsForSummary:  1,
          },
        },
        {
          onConflict:        "user_id,gmail_address",
          ignoreDuplicates:  false,  // we want to UPDATE tokens on reconnect
        }
      )
      .select("id, gmail_address")
      .single();

    if (upsertError || !upsertedAccount) {
      console.error("[gmail/callback] upsert connected_accounts failed:", upsertError);
      return NextResponse.redirect(new URL("/home?error=db_error", req.url));
    }

    // ── 6. Fire-and-forget initial sync ──────────────────────────────────────
    // Starts pulling email metadata from Gmail API in the background.
    // The user is redirected immediately — emails appear via realtime subscription.
    fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/gmail/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId: upsertedAccount.id,
        syncType:  "startup",  // schema: sync_logs.sync_type check
      }),
    }).catch((e) => console.error("[gmail/callback] background sync failed:", e));

    // ── 7. Redirect with success ──────────────────────────────────────────────
    const successUrl = new URL("/home", req.url);
    successUrl.searchParams.set("connected", gmailUser.email);
    return NextResponse.redirect(successUrl);

  } catch (err) {
    console.error("[gmail/callback] unexpected error:", err);
    return NextResponse.redirect(new URL("/home?error=oauth_failed", req.url));
  }
}