import { sanity } from '../../src/lib/sanity.js';

/**
 * POST /api/update-post
 * Body: { docId, platformPostKey, action, scheduledAt? }
 *   action: "approve" | "reject" | "reset"
 *   scheduledAt: required for "approve" - ISO datetime string of when it should go out
 */
export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }

  const { docId, platformPostKey, action, scheduledAt } = body;

  if (!docId || !platformPostKey || !action) {
    return new Response(
      JSON.stringify({ error: 'docId, platformPostKey, and action are required' }),
      { status: 400 }
    );
  }

  if (action === 'approve' && !scheduledAt) {
    return new Response(
      JSON.stringify({ error: 'scheduledAt is required when approving a post' }),
      { status: 400 }
    );
  }

  const path = `platformPosts[_key=="${platformPostKey}"]`;
  let setPatch;

  if (action === 'approve') {
    setPatch = {
      [`${path}.approvalStatus`]: 'approved',
      [`${path}.status`]: 'scheduled',
      [`${path}.scheduledAt`]: scheduledAt,
    };
  } else if (action === 'reject') {
    setPatch = {
      [`${path}.approvalStatus`]: 'rejected',
      [`${path}.status`]: 'not_scheduled',
    };
  } else if (action === 'reset') {
    setPatch = {
      [`${path}.approvalStatus`]: 'pending',
      [`${path}.status`]: 'not_scheduled',
    };
  } else {
    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400 });
  }

  try {
    await sanity.patch(docId).set(setPatch).commit();
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
