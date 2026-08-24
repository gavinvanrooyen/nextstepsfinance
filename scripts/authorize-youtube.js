/**
 * ONE-TIME SETUP SCRIPT — run this once on your own machine, not on Netlify.
 *
 * It opens a browser, asks you to log into the Google account that owns the
 * "GavinvanRooyen" YouTube channel, and asks you to grant upload permission.
 * Google then redirects back to a tiny local server this script starts,
 * which exchanges the authorization code for a long-lived refresh token.
 *
 * That refresh token is what the real posting service uses forever after -
 * you should only need to run this script again if you ever revoke access.
 *
 * USAGE:
 *   1. In Google Cloud Console, under your OAuth Client (Web application),
 *      add this exact Authorized redirect URI:
 *        http://localhost:3000/oauth2callback
 *   2. Create a real .env file (copy .env.example) and fill in
 *      YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET from that same OAuth client.
 *   3. Run: npm install && npm run authorize:youtube
 *   4. A browser tab opens - log in with the Google account for
 *      youtube.com/@GavinvanRooyen and click Allow.
 *   5. The refresh token prints in your terminal. Copy it into Netlify's
 *      environment variables as YOUTUBE_REFRESH_TOKEN. Do NOT commit it,
 *      do NOT paste it into a chat with anyone, including Claude.
 */

import 'dotenv/config';
import http from 'node:http';
import { URL } from 'node:url';
import { google } from 'googleapis';
import open from 'open';

const PORT = 3000;
const REDIRECT_URI = process.env.YOUTUBE_REDIRECT_URI || `http://localhost:${PORT}/oauth2callback`;

const requiredEnv = ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`Missing ${key} in your .env file. Copy .env.example to .env and fill it in first.`);
    process.exit(1);
  }
}

const oauth2Client = new google.auth.OAuth2(
  process.env.YOUTUBE_CLIENT_ID,
  process.env.YOUTUBE_CLIENT_SECRET,
  REDIRECT_URI
);

// youtube.upload lets us insert videos. youtube.readonly lets the dashboard
// later show channel/video status without needing a second scope grant.
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline', // required to get a refresh_token back
  prompt: 'consent',      // forces Google to always issue a refresh_token, even on re-runs
  scope: SCOPES,
});

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://localhost:${PORT}`);

  if (reqUrl.pathname !== '/oauth2callback') {
    res.writeHead(404);
    res.end();
    return;
  }

  const code = reqUrl.searchParams.get('code');
  const error = reqUrl.searchParams.get('error');

  if (error) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end(`Authorization was denied: ${error}. You can close this tab.`);
    console.error(`\nAuthorization denied: ${error}`);
    server.close();
    process.exit(1);
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);

    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Success! You can close this tab and go back to your terminal.');

    console.log('\n=================================================================');
    console.log('SUCCESS. Copy the refresh token below into Netlify as');
    console.log('YOUTUBE_REFRESH_TOKEN (Site settings > Environment variables).');
    console.log('Do not paste this anywhere else, including into a chat.');
    console.log('=================================================================\n');
    console.log(tokens.refresh_token);
    console.log('\n=================================================================\n');

    if (!tokens.refresh_token) {
      console.warn(
        'No refresh token was returned. This usually means this Google account ' +
        'already granted access before. Go to https://myaccount.google.com/permissions, ' +
        'remove access for this app, and run this script again.'
      );
    }
  } catch (err) {
    console.error('Failed to exchange authorization code for tokens:', err.message);
  } finally {
    server.close();
    setTimeout(() => process.exit(0), 500);
  }
});

server.listen(PORT, async () => {
  console.log(`Local server listening on http://localhost:${PORT}`);
  console.log('Opening your browser to log in with Google...\n');
  await open(authUrl);
});
