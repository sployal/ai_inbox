// lib/gmail.ts
import { createClient } from "@supabase/supabase-js";

// ─── Scopes ───────────────────────────────────────────────────────────────────
// Matches connected_accounts.scopes default in schema
export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.metadata",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
].join(" ");

const GOOGLE_TOKEN_URL    = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

// ─── AES-256-GCM Token Encryption ────────────────────────────────────────────
// Schema note: "Tokens are AES-256 encrypted before insert. NEVER store plaintext tokens."
// TOKEN_ENCRYPTION_KEY is a SERVER-ONLY env var (no NEXT_PUBLIC_ prefix)
function getRawKey(): string {
  const k = process.env.TOKEN_ENCRYPTION_KEY;
  if (!k) throw new Error("TOKEN_ENCRYPTION_KEY is not set in environment");
  return k.slice(0, 32).padEnd(32, "0");
}

async function importCryptoKey(raw: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(raw),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptToken(token: string): Promise<string> {
  const key = await importCryptoKey(getRawKey());
  const iv  = crypto.getRandomValues(new Uint8Array(12));
  const ct  = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(token)
  );
  const combined = new Uint8Array(12 + ct.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ct), 12);
  return Buffer.from(combined).toString("base64");
}

export async function decryptToken(encrypted: string): Promise<string> {
  const key = await importCryptoKey(getRawKey());
  const buf = Buffer.from(encrypted, "base64");
  const iv  = buf.slice(0, 12);
  const ct  = buf.slice(12);
  const pt  = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(pt);
}

// ─── Build Google OAuth consent URL ──────────────────────────────────────────
export function buildGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_CLIENT_ID!,
    redirect_uri:  `${process.env.NEXT_PUBLIC_APP_URL}/api/gmail/callback`,
    response_type: "code",
    scope:         GMAIL_SCOPES,
    access_type:   "offline",  // required to receive refresh_token
    prompt:        "consent",  // forces refresh_token even if user previously authorized
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

// ─── Exchange auth code for tokens ───────────────────────────────────────────
export interface TokenResponse {
  access_token:   string;
  refresh_token?: string;
  expires_in:     number;
  scope:          string;
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri:  `${process.env.NEXT_PUBLIC_APP_URL}/api/gmail/callback`,
      grant_type:    "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`);
  return res.json();
}

// ─── Refresh an expired access token ─────────────────────────────────────────
export async function refreshAccessToken(encryptedRefreshToken: string): Promise<{
  access_token: string;
  expires_at:   Date;
}> {
  const refreshToken = await decryptToken(encryptedRefreshToken);
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type:    "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);
  const data: TokenResponse = await res.json();
  return {
    access_token: data.access_token,
    expires_at:   new Date(Date.now() + data.expires_in * 1000),
  };
}

// ─── Fetch Google account profile ────────────────────────────────────────────
export interface GoogleUserInfo {
  id:             string;  // maps to connected_accounts.google_account_id
  email:          string;  // maps to connected_accounts.gmail_address
  name:           string;  // used to derive connected_accounts.display_name
  picture:        string;
  verified_email: boolean;
}

export async function getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Failed to fetch Google user info");
  return res.json();
}

// ─── Get a valid (auto-refreshed) access token for a connected account ────────
// Uses the service role client to read encrypted tokens (bypasses RLS).
// Updates connected_accounts.access_token + token_expires_at if refreshed.
export async function getValidAccessToken(accountId: string): Promise<string> {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Schema: connected_accounts columns access_token, refresh_token, token_expires_at
  const { data: acct, error } = await admin
    .from("connected_accounts")
    .select("access_token, refresh_token, token_expires_at")
    .eq("id", accountId)
    .single();

  if (error || !acct) throw new Error(`connected_account ${accountId} not found`);

  const expiresAt  = new Date(acct.token_expires_at);
  const bufferTime = new Date(Date.now() + 5 * 60 * 1000); // 5 min safety buffer

  // Still valid
  if (expiresAt > bufferTime) return decryptToken(acct.access_token);

  // Expired — refresh
  const { access_token, expires_at } = await refreshAccessToken(acct.refresh_token);
  const encryptedNew = await encryptToken(access_token);

  // Schema: update connected_accounts.access_token, token_expires_at, last_sync_status
  await admin
    .from("connected_accounts")
    .update({
      access_token:     encryptedNew,
      token_expires_at: expires_at.toISOString(),
      last_sync_status: "success",
    })
    .eq("id", accountId);

  return access_token;
}

// ─── Derive connected_accounts.avatar_initials from email ────────────────────
export function emailToInitials(email: string): string {
  const local = email.split("@")[0];
  const parts = local.split(/[._\-+]/);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : local.slice(0, 2).toUpperCase();
}

// ─── Derive connected_accounts.color from email ──────────────────────────────
const PALETTE = [
  "#059669", "#0284c7", "#7c3aed", "#db2777",
  "#d97706", "#dc2626", "#0891b2", "#65a30d",
];

export function emailToColor(email: string): string {
  let h = 0;
  for (const ch of email) h = (h * 31 + ch.charCodeAt(0)) % PALETTE.length;
  return PALETTE[Math.abs(h)];
}