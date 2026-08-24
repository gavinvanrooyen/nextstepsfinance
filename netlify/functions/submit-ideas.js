import { sanity } from '../../src/lib/sanity.js';
import { randomUUID } from 'node:crypto';

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 96);
}

/**
 * POST /api/submit-ideas
 * Body: { ideas: [ { type: "video"|"shortClip", title, longFormSlot?, topicId, notes? } ] }
 *
 * Creates one document per idea, all in a single transaction, at
 * productionStatus "idea". Videos need `title`; shorts store the same
 * text in `hook` (matching how the rest of the schema uses hook for shorts).
 */
export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }

  const { ideas } = body;
  if (!Array.isArray(ideas) || ideas.length === 0) {
    return new Response(JSON.stringify({ error: 'ideas must be a non-empty array' }), { status: 400 });
  }

  for (const [i, idea] of ideas.entries()) {
    if (!idea.type || !['video', 'shortClip'].includes(idea.type)) {
      return new Response(JSON.stringify({ error: `Idea ${i + 1}: type must be "video" or "shortClip"` }), { status: 400 });
    }
    if (!idea.title || !idea.title.trim()) {
      return new Response(JSON.stringify({ error: `Idea ${i + 1}: title/hook is required` }), { status: 400 });
    }
    if (!idea.topicId) {
      return new Response(JSON.stringify({ error: `Idea ${i + 1}: topicId is required` }), { status: 400 });
    }
  }

  try {
    const tx = sanity.transaction();
    const createdIds = [];

    for (const idea of ideas) {
      const id = `${idea.type === 'video' ? 'video' : 'short'}-idea-${randomUUID()}`;
      createdIds.push(id);

      const base = {
        _id: id,
        _type: idea.type,
        title: idea.title.trim(),
        topic: { _type: 'reference', _ref: idea.topicId },
        productionStatus: 'idea',
        notes: idea.notes?.trim() || undefined,
      };

      if (idea.type === 'video') {
        tx.create({
          ...base,
          slug: { _type: 'slug', current: slugify(idea.title) },
          longFormSlot: idea.longFormSlot || 'lf1',
        });
      } else {
        tx.create({
          ...base,
          hook: idea.title.trim(),
          hasCta: false,
        });
      }
    }

    await tx.commit();

    return new Response(JSON.stringify({ ok: true, created: createdIds.length }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
