import { sanity } from '../../src/lib/sanity.js';

/**
 * GET /api/list-content
 *
 * Returns every video/shortClip that has at least one platformPost entry,
 * newest-first, with topic titles resolved for display. The dashboard
 * filters client-side between "Needs review" (pending) and "Reviewed"
 * (approved/rejected) so this stays a single simple query.
 */
export default async function handler() {
  const query = `
    *[_type in ["video", "shortClip"] && count(platformPosts) > 0] | order(_createdAt desc) {
      _id,
      _type,
      title,
      caption,
      hashtags,
      driveFileId,
      weekNumber,
      "topicTitle": topic->title,
      platformPosts[]{
        _key,
        platform,
        approvalStatus,
        status,
        scheduledAt,
        postedAt,
        postUrl,
        errorMessage
      }
    }
  `;

  try {
    const results = await sanity.fetch(query);
    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
