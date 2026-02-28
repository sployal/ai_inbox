# InboxAI — Deployment & Setup Guide

## Quick Start

This guide covers setting up InboxAI locally and deploying to Vercel.

### Prerequisites

- Node.js 18+ and pnpm
- Google Cloud Project with OAuth credentials
- Supabase project with PostgreSQL database
- Groq API key
- Vercel account (for production deployment)

---

## Part 1: Local Development Setup

### 1.1 Clone & Install

```bash
cd mail_manage
pnpm install
```

### 1.2 Set Up Supabase

1. **Create a Supabase project**:
   - Go to https://supabase.com
   - Create a new project (free tier is fine for testing)
   - Save your URL and `anon` key

2. **Create required tables**:
   - Go to **Supabase Dashboard → SQL Editor**
   - Run the schema from [Full Supabase Schema](#full-schema) (see user request above)
   - **Importantly**: Also run [migrations/001-oauth-states.sql](migrations/001-oauth-states.sql) to create the `oauth_states` table

3. **Enable Auth**:
   - In Supabase Dashboard → **Authentication → Settings**
   - Enable Google OAuth provider
   - Add your Google OAuth credentials (get these next)

### 1.3 Set Up Google OAuth

1. **Create OAuth credentials**:
   - Go to https://console.cloud.google.com
   - Create a new project (or use existing)
   - Go to **APIs & Services → Credentials**
   - Click **+ Create Credentials → OAuth client ID**
   - Choose **Web application**
   - Add these **Authorized redirect URIs**:
     - `http://localhost:3000/api/gmail/callback` (dev)
     - `https://yourdomain.com/api/gmail/callback` (production domain)
     - `https://your-project.vercel.app/api/gmail/callback` (Vercel staging)

2. **Enable Gmail API**:
   - In **APIs & Services → Library**
   - Search for "Gmail API"
   - Click **Enable**

3. **Save credentials**:
   - Download or copy your `Client ID` and `Client Secret`

### 1.4 Get Groq API Key

1. Go to https://console.groq.com
2. Create an account
3. Generate an API key from the dashboard

### 1.5 Create `.env.local`

Copy `.env.local.example` to `.env.local` and fill in values:

```bash
cp .env.local.example .env.local
```

Then edit `.env.local` with:

```env
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Google OAuth
GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...

# Groq
GROQ_API_KEY=gsk_...

# Token Encryption (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
TOKEN_ENCRYPTION_KEY=abc123def456...

# Cron (for Vercel)
CRON_SECRET=abc123def456...
```

### 1.6 Run Locally

```bash
pnpm dev
```

Open http://localhost:3000 and sign in!

---

## Part 2: Vercel Deployment

### 2.1 Push to GitHub

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### 2.2 Deploy to Vercel

1. Go to https://vercel.com
2. Click **Add New → Project**
3. Select your GitHub repository
4. Keep default settings, click **Deploy**

### 2.3 Add Environment Variables to Vercel

After deployment, add all env vars in **Vercel Dashboard → Settings → Environment Variables**:

```
NEXT_PUBLIC_APP_URL = https://your-project.vercel.app
NEXT_PUBLIC_SUPABASE_URL = https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY = eyJhbGc...
GOOGLE_CLIENT_ID = 123456...
GOOGLE_CLIENT_SECRET = GOCSPX-...
GROQ_API_KEY = gsk_...
TOKEN_ENCRYPTION_KEY = abc123...
CRON_SECRET = abc123...
```

Then **Redeploy** from the Deployments tab.

### 2.4 Update Google OAuth Redirect URIs

Update your Google OAuth credentials to include Vercel URL:

```
https://your-project.vercel.app/api/gmail/callback
```

Also update Supabase authentication settings to use your Vercel URL.

### 2.5 Set Up Vercel Cron (Automatic Email Sync)

1. In **Vercel Dashboard → Settings → Cron Jobs**
2. Add this cron job:

```
Path: /api/cron/sync-emails
Schedule: 0 */2 * * *  (every 2 hours)
```

Or edit `vercel.json` directly:

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-emails",
      "schedule": "0 */2 * * *"
    }
  ]
}
```

Redeploy after updating.

---

## Part 3: Using the App

### 3.1 Sign In

1. Go to your deployed app URL
2. Click sign-in → Google OAuth
3. Verify your email in Supabase (if email verification is enabled)

### 3.2 Connect Gmail Accounts

1. Click **Accounts** in sidebar
2. Click **Connect a Gmail Account**
3. Grant OAuth permissions (read-only Gmail access)
4. Email account is now connected!

### 3.3 Sync Emails

**Manual sync**: Click the **↻ Sync** button next to any account

**Automatic sync**: Vercel Cron runs every 2 hours (configurable)

Emails appear in **Dashboard** with:
- AI priority classification (high/medium/low)
- Sentiment analysis
- Meeting detection
- Actionable summaries

### 3.4 Generate AI Summaries

1. Go to **Dashboard**
2. Click **Refresh** in the "AI Daily Summary" card
3. Or go to **Summaries** → Select account → **Generate Daily/Weekly**

---

## Part 4: Troubleshooting

### "Token refresh failed"

- Ensure `TOKEN_ENCRYPTION_KEY` is set and consistent
- Check Google OAuth credentials are correct
- Verify Gmail API is enabled in Google Cloud Console

### "No emails showing up"

1. Check **Accounts** page → Last sync status
2. Manual sync: Click **↻ Sync** button
3. Check Vercel logs: `vercel logs`
4. Check Supabase logs: Dashboard → Logs

### "Groq API errors"

- Verify `GROQ_API_KEY` is valid in Vercel
- Check Groq API usage at https://console.groq.com
- Model `llama-3.1-70b-versatile` must be available in your region

### "OAuth redirect URI mismatch"

- Update **both** Google CloudPlease and Supabase with correct redirect URIs
- Format: `https://yourdomain.com/api/gmail/callback`
- No trailing slash!

### "Supabase connection refused"

- Verify `NEXT_PUBLIC_SUPABASE_URL` is correct
- Ensure Supabase project isn't paused (billing status)
- Check Row-Level Security (RLS) policies are enabled

---

## Part 5: Architecture Overview

### Email Sync Flow

```
User clicks "Sync" or Cron triggers
    ↓
/api/gmail/sync fetches message list from Gmail API
    ↓
For each new email:
  - Extract headers (subject, from, to, date)
  - Create row in public.emails table
    ↓
For each new email:
  - Fetch full body from Gmail API
  - Send to Groq for AI classification
    ↓
Groq returns:
  - Priority (high/medium/low)
  - Category (billing/meeting/personal/work)
  - Sentiment (positive/neutral/negative/urgent)
  - Meeting detected? (boolean)
    ↓
Update public.emails with AI results
    ↓
If meeting detected:
  - Create row in public.calendar_events
  - Extract meeting link (Zoom/Meet/Teams)
    ↓
Update connected_accounts:
  - last_synced_at
  - total_unread count
  - last_sync_status
```

### Database Schema Highlights

- **users**: Your identity (from Google OAuth)
- **connected_accounts**: Each Gmail inbox you connect (tokens encrypted)
- **emails**: Email metadata (NOT full body—privacy first!)
- **calendar_events**: Extracted meetings & deadlines
- **summaries**: AI-generated daily/weekly summaries
- **sync_logs**: Audit trail of all syncs
- **oauth_states**: Temporary CSRF tokens during OAuth flow

---

## Part 6: Security Best Practices

✅ **What we do right**:
- Tokens encrypted with AES-256 before storage
- OAuth 2.0 read-only scopes (no send/delete permissions)
- Email bodies never persisted (fetched fresh, discarded immediately)
- Row-Level Security on all tables
- Environment variables never exposed to frontend

⚠️ **What you should do**:
- Rotate `TOKEN_ENCRYPTION_KEY` periodically (breaks existing tokens—do during low traffic)
- Use HTTPS in production (Vercel does this automatically)
- Never commit `.env.local` to git (it's in `.gitignore`)
- Monitor Groq API usage (rate limits exist)
- Enable email verification in Supabase Auth

---

## Part 7: Customization

### Change Email Sync Frequency

Edit `src/app/api/cron/sync-emails/route.ts`:

```typescript
// In query string:
const query = `newer_than:7d`;  // Sync last 7 days; change to 1d, 30d, etc.
```

And in `vercel.json`:

```json
"schedule": "0 */4 * * *"  // Change to every 4 hours, daily, etc.
```

### Add More AI Classifications

In `src/app/api/gmail/sync/route.ts`, the `processEmailsWithGroq` function calls Groq. Customize the prompt:

```typescript
const prompt = `
  Analyze this email and return JSON with:
  - priority, category, sentiment (as before)
  - YOUR_NEW_FIELD: "value"  // Add custom fields here
`;
```

### Exclude Certain Emails

Modify the Gmail query in `sync/route.ts`:

```typescript
// Example: Skip promotional emails
const query = `newer_than:7d -from:promo@*`;
```

---

## Part 8: Next Steps

Potential features to add:

- [ ] Weekly email digest via email (using SendGrid/Resend)
- [ ] Smart snooze (remind me in 3 days)
- [ ] Email threading UI (group related emails)
- [ ] Custom label sync (import Gmail labels)
- [ ] Search & filtering (Elasticsearch/Meilisearch)
- [ ] Community templates for summaries
- [ ] Webhook integrations (Slack, Teams notifications)
- [ ] Mobile app (React Native / Expo)

---

## Support & Questions

For issues:
1. Check the troubleshooting section above
2. Check Vercel logs: `vercel logs -f`
3. Check Supabase logs: Dashboard → Logs
4. Verify all environment variables are set
5. Restart the dev server (`pnpm dev`)

---

**Deployed and running?** Great! Now connect Gmail accounts and watch your emails get organized with AI! 🚀
