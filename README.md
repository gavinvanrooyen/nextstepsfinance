# nsf-posting-service

Semi-automatic multi-platform posting for nextsteps.finance UGC content.
Reads approved + due content from Sanity, uploads it to each platform,
and writes the result back to Sanity so the approval dashboard reflects reality.

Currently wired for **YouTube**. Instagram and TikTok are stubbed in
`netlify/functions/scheduled-post.js` and will be filled in once their
API access is ready.

## How it fits together

1. You (or the AI content pipeline) mark a `video`/`shortClip` record's
   `platformPosts[]` entry as `approvalStatus: "approved"` in the dashboard.
2. A Netlify scheduled function runs once a day, finds every approved +
   due post, downloads the source file from Google Drive, uploads it to
   the target platform, and writes the resulting post URL/status back
   into Sanity.
3. Videos upload as **private** on YouTube by default — a deliberate
   safety net so you can do a final look in YouTube Studio before making
   them public. We can change this once you're confident in the pipeline.

## One-time setup (do this before first deploy)

### 1. Google Cloud / YouTube

You've already created the Web application OAuth client. Now:

1. In that OAuth client's settings, add this **exact** Authorized redirect URI:
   `http://localhost:3000/oauth2callback`
2. Copy `.env.example` to `.env` (this file is git-ignored, it stays on your machine only).
3. Fill in `YOUTUBE_CLIENT_ID` and `YOUTUBE_CLIENT_SECRET` from Google Cloud Console.
4. Run:
   ```
   npm install
   npm run authorize:youtube
   ```
5. A browser tab opens — log in with the Google account that owns
   youtube.com/@GavinvanRooyen and click Allow.
6. Your terminal prints a refresh token. Copy it — you'll paste it into
   Netlify's environment variables, not back into this file.

### 2. Google Drive (service account, for unattended file access)

1. In the same Google Cloud project, go to IAM & Admin > Service Accounts
   > Create Service Account (no roles needed).
2. Create a JSON key for it.
3. Share your Drive content folder with the service account's email
   (looks like `xxx@xxx.iam.gserviceaccount.com`) as a Viewer.
4. The entire JSON key file content becomes the `GOOGLE_SERVICE_ACCOUNT_JSON`
   env var (as a single-line string) — this goes into Netlify, not into `.env`
   long-term unless you're just testing locally.

### 3. Sanity API token

In sanity.io/manage, under this project, create a new API token with
Editor (read+write) access. This becomes `SANITY_API_TOKEN`.

## Deploying to Netlify

This project has no separate "build" step — it's just Netlify Functions.

**Option A — Git (recommended):**
1. Push this folder to a new GitHub repo.
2. In Netlify: Add new site > Import an existing project > pick the repo.
3. Leave build command blank, publish directory blank (nothing to serve yet
   besides functions — the dashboard will get added here next).
4. Under Site settings > Environment variables, add every variable from
   `.env.example` with its real value.
5. Deploy. The scheduled function will start running on the cron in `netlify.toml`.

**Option B — Netlify CLI:**
```
npm install -g netlify-cli
netlify login
netlify init
netlify env:set SANITY_PROJECT_ID udes06w8
# ...repeat env:set for each variable, or add them in the Netlify UI instead
netlify deploy --prod
```

## Testing before relying on the schedule

You can invoke the scheduled function manually from the Netlify dashboard
(Functions tab > scheduled-post > "Trigger function") once it's deployed,
rather than waiting for the daily cron — useful for your first real test run.

## Scheduling behaviour

- The dashboard suggests posting times from a fixed set of daily slots
  (09:00, 13:00, 17:00 local time) and automatically skips any slot within
  90 minutes of another already-scheduled post on the same platform — so
  approving several items back-to-back spaces them out instead of stacking
  them at the same moment.
- The scheduled function runs **hourly**, not daily, so posts actually go
  out close to their assigned slot rather than getting batched together
  whenever the job next happens to run.
- You can still override the suggested time manually; a warning appears if
  your chosen time lands within 90 minutes of another scheduled post on the
  same platform, but it won't block you from approving anyway.

## What's not built yet

- The approval dashboard itself (separate piece — next up).
- Instagram and TikTok upload modules (stubbed, throw a clear error if hit).
- Any handling for files bigger than fits comfortably in function memory —
  fine for now, revisit if exports get large.
