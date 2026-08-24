import { sanity } from '../../src/lib/sanity.js';

const EDITABLE_FIELDS = ['productionStatus', 'driveFileId', 'caption', 'hashtags', 'youtubeUrl', 'cta'];

/**
 * POST /api/update-content
 * Body: { docId, patch: { <any subset of EDITABLE_FIELDS> } }
 *
 * cta, when present, must already be shaped as a Sanity reference:
 *   { _type: "reference", _ref: "<ctaTemplate docId>" }
 */
export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }

  const { docId, patch } = body;
  if (!docId || !patch || typeof patch !== 'object') {
    return new Response(JSON.stringify({ error: 'docId and patch are required' }), { status: 400 });
  }

  const safePatch = {};
  for (const key of Object.keys(patch)) {
    if (EDITABLE_FIELDS.includes(key)) safePatch[key] = patch[key];
  }

  if (Object.keys(safePatch).length === 0) {
    return new Response(JSON.stringify({ error: 'No editable fields in patch' }), { status: 400 });
  }

  try {
    await sanity.patch(docId).set(safePatch).commit();
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
