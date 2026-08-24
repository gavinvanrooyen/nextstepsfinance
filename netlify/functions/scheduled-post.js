import { getDuePosts, recordPostResult } from '../../src/lib/sanity.js';
import { getDriveFileBuffer } from '../../src/lib/drive.js';
import { uploadVideo } from '../../src/lib/youtube.js';
// import { uploadReel } from '../../src/lib/instagram.js';   // added once IG setup is done
// import { uploadTikTok } from '../../src/lib/tiktok.js';    // added once TikTok is approved

/**
 * Runs once a day (see netlify.toml). Finds every platformPost entry that:
 *   - is on a video or shortClip document
 *   - has approvalStatus === "approved"  (set by you, in the dashboard)
 *   - has status === "scheduled" && scheduledAt <= now
 * ...and actually publishes it to the target platform, then writes the
 * result back to Sanity so the dashboard reflects reality.
 *
 * Currently wired for YouTube only. Instagram and TikTok branches are
 * stubbed until those platforms' API access is ready - see the two
 * commented imports above.
 */
export default async function handler() {
  const duePosts = await getDuePosts();

  if (duePosts.length === 0) {
    console.log('No approved + due posts found. Nothing to do.');
    return new Response('No due posts.', { status: 200 });
  }

  console.log(`Found ${duePosts.length} due post(s). Processing...`);

  const results = [];

  for (const post of duePosts) {
    try {
      if (!post.driveFileId) {
        throw new Error('No driveFileId set on this record - nothing to upload.');
      }

      const fileBuffer = await getDriveFileBuffer(post.driveFileId);
      const description = buildDescription(post.caption, post.hashtags);

      let result;
      switch (post.platform) {
        case 'youtube':
          result = await uploadVideo({
            fileBuffer,
            title: post.title,
            description,
            tags: post.hashtags,
            isShort: post.docType === 'shortClip',
            privacyStatus: 'private', // safety net: review in YouTube Studio, then flip to public
          });
          break;

        case 'youtube_shorts':
          result = await uploadVideo({
            fileBuffer,
            title: post.title,
            description,
            tags: post.hashtags,
            isShort: true,
            privacyStatus: 'private',
          });
          break;

        case 'instagram':
          throw new Error('Instagram posting not yet wired up - pending API setup.');

        case 'tiktok':
          throw new Error('TikTok posting not yet wired up - pending app review.');

        default:
          throw new Error(`Unknown platform: ${post.platform}`);
      }

      await recordPostResult({
        docId: post.docId,
        platformPostKey: post.platformPostKey,
        success: true,
        postUrl: result.url,
      });

      results.push({ docId: post.docId, platform: post.platform, status: 'posted', url: result.url });
      console.log(`Posted "${post.title}" to ${post.platform}: ${result.url}`);
    } catch (err) {
      await recordPostResult({
        docId: post.docId,
        platformPostKey: post.platformPostKey,
        success: false,
        errorMessage: err.message,
      });

      results.push({ docId: post.docId, platform: post.platform, status: 'failed', error: err.message });
      console.error(`Failed to post "${post.title}" to ${post.platform}:`, err.message);
    }
  }

  return new Response(JSON.stringify(results, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function buildDescription(caption, hashtags) {
  const tagLine = (hashtags || []).map((t) => (t.startsWith('#') ? t : `#${t}`)).join(' ');
  return [caption, tagLine].filter(Boolean).join('\n\n');
}
