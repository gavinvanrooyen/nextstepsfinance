import { google } from 'googleapis';
import { Readable } from 'node:stream';

function getAuthedClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    process.env.YOUTUBE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.YOUTUBE_REFRESH_TOKEN,
  });

  return google.youtube({ version: 'v3', auth: oauth2Client });
}

/**
 * Uploads a video buffer to YouTube.
 *
 * @param {Object} opts
 * @param {Buffer} opts.fileBuffer - the raw video file bytes
 * @param {string} opts.title
 * @param {string} opts.description - caption/description text
 * @param {string[]} [opts.tags] - hashtags without the # symbol
 * @param {boolean} [opts.isShort] - true for YouTube Shorts (vertical, <60s)
 * @param {'private'|'unlisted'|'public'} [opts.privacyStatus] - defaults to 'private'
 *   so a human can do a final sanity check in YouTube Studio before it goes fully public,
 *   unless you decide you're comfortable posting straight to public.
 * @returns {Promise<{videoId: string, url: string}>}
 */
export async function uploadVideo({
  fileBuffer,
  title,
  description,
  tags = [],
  isShort = false,
  privacyStatus = 'private',
}) {
  const youtube = getAuthedClient();

  // #Shorts in the title/description is how YouTube classifies short-form,
  // in addition to the video actually being vertical and under 60s.
  const finalTitle = isShort && !title.includes('#Shorts') ? `${title} #Shorts` : title;

  const res = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title: finalTitle,
        description,
        tags,
        categoryId: '22', // "People & Blogs" - reasonable default for finance education content
      },
      status: {
        privacyStatus,
        selfDeclaredMadeForKids: false,
      },
    },
    media: {
      body: Readable.from(fileBuffer),
    },
  });

  const videoId = res.data.id;
  return {
    videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
  };
}
