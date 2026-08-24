import { sanity } from '../../src/lib/sanity.js';

/**
 * GET /api/list-plan
 *
 * Returns everything needed to mirror the CMS as a plan: every topic
 * (week-ordered, with its start date) plus every video and shortClip,
 * regardless of production status or whether they have platformPosts yet.
 * This is deliberately a full dump, not a filtered query - the plan view
 * is meant to show the whole pipeline, including work not yet started.
 */
export default async function handler() {
  const query = `{
    "topics": *[_type == "topic"] | order(plannedWeek asc) {
      _id, title, pillar, plannedWeek, plannedWeekStart, calendarTieIn
    },
    "content": *[_type in ["video", "shortClip"]] | order(weekNumber asc) {
      _id,
      _type,
      title,
      weekNumber,
      productionStatus,
      "topicTitle": topic->title,
      "pillar": topic->pillar,
      longFormSlot,
      hook,
      hasCta,
      driveFileId,
      caption,
      hashtags,
      youtubeUrl,
      "cta": cta->{_id, name}
    }
  }`;

  try {
    const result = await sanity.fetch(query);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
