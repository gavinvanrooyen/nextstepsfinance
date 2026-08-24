import { sanity } from '../../src/lib/sanity.js';

export default async function handler() {
  try {
    const ctas = await sanity.fetch(`*[_type == "ctaTemplate"] | order(name asc) { _id, name, ctaType }`);
    return new Response(JSON.stringify(ctas), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
