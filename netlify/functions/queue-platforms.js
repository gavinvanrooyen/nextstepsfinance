import { sanity } from '../../src/lib/sanity.js';
import { randomUUID } from 'node:crypto';

const VALID_PLATFORMS = ['youtube', 'youtube_shorts', 'instagram', 'facebook', 'tiktok', 'linkedin'];

/**
 * POST /api/queue-platforms
 * Body: { docId, platforms: ["youtube", "instagram", ...] }
 *
 * Appends a new platformPosts[] entry (approvalStatus: pending,
 * status: not_scheduled) for each requested platform that isn't already
 * queued on this document. Platforms already present are skipped rather
 * than duplicated.
 */
export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }

  const { docId, platforms } = body;
  if (!docId || !Array.isArray(platforms) || platforms.length === 0) {
    return new Response(JSON.stringify({ error: 'docId and a non-empty platforms array are required' }), { status: 400 });
  }

  const invalid = platforms.filter((p) => !VALID_PLATFORMS.includes(p));
  if (invalid.length > 0) {
    return new Response(JSON.stringify({ error: `Unknown platform(s): ${invalid.join(', ')}` }), { status: 400 });
  }

  try {
    const doc = await sanity.fetch(`*[_id == $id][0]{ "existing": platformPosts[].platform }`, { id: docId });
    const already = new Set(doc?.existing || []);
    const toAdd = platforms.filter((p) => !already.has(p));

    if (toAdd.length === 0) {
      return new Response(JSON.stringify({ ok: true, added: 0, message: 'Those platforms are already queued.' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const newEntries = toAdd.map((platform) => ({
      _type: 'platformPost',
      _key: randomUUID().slice(0, 12),
      platform,
      approvalStatus: 'pending',
      status: 'not_scheduled',
    }));

    await sanity
      .patch(docId)
      .setIfMissing({ platformPosts: [] })
      .insert('after', 'platformPosts[-1]', newEntries)
      .commit();

    return new Response(JSON.stringify({ ok: true, added: toAdd.length }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
