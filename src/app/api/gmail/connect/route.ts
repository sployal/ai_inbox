// app/api/gmail/connect/route.ts
//
// Step 1 of the Gmail OAuth flow.
// Called when user clicks "Connect Gmail Account" in AccountsSection.
//
// Flow:
//   1. Verify the user is signed in (Supabase auth session from cookie)
//   2. Ensure the user exists in public.users (call upsert_user RPC from schema)
//   3. Build a CSRF state token containing their public.users.id
//   4. Store the nonce in oauth_states table
//   5. Redirect to Google's OAuth consent screen
//
// Schema refs:
//   public.users          — id, email, name, avatar_url, google_id
//   public.oauth_states   — user_id (→ public.users.id), nonce, expires_at
//   upsert_user()         — RPC defined in schema, creates/updates public.users row

import { NextRequest, NextResponse }          from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient }                        from "@supabase/supabase-js";
import { buildGoogleAuthUrl }                  from "@/lib/gmail";

export async function GET(req: NextRequest) {
  try {
    // ── 1. Read the Supabase session from cookies ─────────────────────────────
    // We use @supabase/ssr to correctly parse Next.js cookies server-side.
    const response = NextResponse.next();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return req.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            response.cookies.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            response.cookies.set({ name, value: "", ...options });
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.redirect(new URL("/?error=not_authenticated", req.url));
    }

    // ── 2. Upsert into public.users using the schema's upsert_user() RPC ──────
    // Schema: upsert_user(p_email, p_name, p_avatar_url, p_google_id) → users
    // This ensures public.users has a row for this auth user before we store
    // a connected_account (which has user_id → public.users.id).
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: publicUser, error: upsertError } = await admin.rpc("upsert_user", {
      p_email:      user.email ?? "",
      p_name:       user.user_metadata?.full_name ?? user.user_metadata?.name ?? "",
      p_avatar_url: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? "",
      p_google_id:  user.user_metadata?.provider_id ?? user.user_metadata?.sub ?? user.id,
    });

    if (upsertError || !publicUser) {
      console.error("[gmail/connect] upsert_user failed:", upsertError);
      return NextResponse.redirect(new URL("/home?error=user_sync_failed", req.url));
    }

    // publicUser is the public.users row — use its id for oauth_states
    const publicUserId: string = publicUser.id;

    // ── 3. Generate CSRF nonce ────────────────────────────────────────────────
    const nonce = crypto.randomUUID();

    // State encodes public.users.id so the callback knows which user to associate
    const state = Buffer.from(
      JSON.stringify({ userId: publicUserId, nonce })
    ).toString("base64url");

    // ── 4. Store nonce in oauth_states ────────────────────────────────────────
    // Schema: oauth_states(user_id → public.users.id, nonce, expires_at)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

    const { error: stateError } = await admin
      .from("oauth_states")
      .insert({ user_id: publicUserId, nonce, expires_at: expiresAt });

    if (stateError) {
      console.error("[gmail/connect] oauth_states insert failed:", stateError);
      return NextResponse.redirect(new URL("/home?error=state_error", req.url));
    }

    // ── 5. Redirect to Google ─────────────────────────────────────────────────
    return NextResponse.redirect(buildGoogleAuthUrl(state));

  } catch (err) {
    console.error("[gmail/connect] unexpected error:", err);
    return NextResponse.redirect(new URL("/home?error=oauth_init_failed", req.url));
  }
}