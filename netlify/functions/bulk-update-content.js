import { sanity } from '../../src/lib/sanity.js';

const EDITABLE_FIELDS = ['productionStatus', 'driveFileId', 'caption', 'hashtags', 'youtubeUrl', 'cta'];

/**
 * POST /api/bulk-update-content
 * Body: { docIds: [...], patch: { <any subset of EDITABLE_FIELDS> } }
 *
 * Applied as a single Sanity transaction — either all docs update or none do,
 * so a bulk status change can't leave you with a half-applied selection.
 */
export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }

  const { docIds, patch } = body;
  if (!Array.isArray(docIds) || docIds.length === 0 || !patch || typeof patch !== 'object') {
    return new Response(JSON.stringify({ error: 'docIds (non-empty array) and patch are required' }), { status: 400 });
  }

  const safePatch = {};
  for (const key of Object.keys(patch)) {
    if (EDITABLE_FIELDS.includes(key)) safePatch[key] = patch[key];
  }

  if (Object.keys(safePatch).length === 0) {
    return new Response(JSON.stringify({ error: 'No editable fields in patch' }), { status: 400 });
  }

  try {
    const tx = sanity.transaction();
    for (const docId of docIds) {
      tx.patch(docId, (p) => p.set(safePatch));
    }
    await tx.commit();

    return new Response(JSON.stringify({ ok: true, updated: docIds.length }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
