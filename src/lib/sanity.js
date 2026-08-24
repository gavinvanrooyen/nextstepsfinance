import { createClient } from '@sanity/client';

export const sanity = createClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET,
  token: process.env.SANITY_API_TOKEN,
  apiVersion: '2026-08-01',
  useCdn: false, // we need fresh reads + write access
});

/**
 * Finds video/shortClip records that have at least one platformPost entry
 * which is approved, not yet posted, and scheduled for now-or-earlier.
 *
 * Returns a flat list of { docId, docType, platform, platformPostKey, ...content }
 * so the caller can process one platform-post at a time.
 */
export async function getDuePosts() {
  const now = new Date().toISOString();

  const query = `
    *[
      _type in ["video", "shortClip"]
      && count(platformPosts[
        approvalStatus == "approved"
        && status == "scheduled"
        && scheduledAt <= $now
      ]) > 0
    ]{
      _id,
      _type,
      title,
      caption,
      hashtags,
      driveFileId,
      "duePlatformPosts": platformPosts[
        approvalStatus == "approved"
        && status == "scheduled"
        && scheduledAt <= $now
      ]
    }
  `;

  const results = await sanity.fetch(query, { now });

  // Flatten: one item per due platform-post, not per document.
  const flat = [];
  for (const doc of results) {
    for (const post of doc.duePlatformPosts) {
      flat.push({
        docId: doc._id,
        docType: doc._type,
        title: doc.title,
        caption: doc.caption,
        hashtags: doc.hashtags || [],
        driveFileId: doc.driveFileId,
        platform: post.platform,
        platformPostKey: post._key,
      });
    }
  }
  return flat;
}

/**
 * Writes the result of a publish attempt back onto the specific
 * platformPosts[] entry (matched by its _key) for a document.
 */
export async function recordPostResult({ docId, platformPostKey, success, postUrl, errorMessage }) {
  const patch = sanity.transaction();

  const path = `platformPosts[_key=="${platformPostKey}"]`;

  if (success) {
    patch.patch(docId, (p) =>
      p.set({
        [`${path}.status`]: 'posted',
        [`${path}.postedAt`]: new Date().toISOString(),
        [`${path}.postUrl`]: postUrl,
      })
    );
  } else {
    patch.patch(docId, (p) =>
      p.set({
        [`${path}.status`]: 'failed',
        [`${path}.errorMessage`]: errorMessage,
      })
    );
  }

  await patch.commit();
}
