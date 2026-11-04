// The descriptions of the rebuilt pages, for the star map's zone cards: a static file (/star-map.json) that the map
// fetches when it is first opened, so no page carries them.
import { getCollection } from 'astro:content';

export async function GET() {
  const docs = await getCollection('docs');
  const descs: Record<string, string> = {};
  for (const d of docs) descs[d.id === 'index' ? '' : d.id] = d.data.description ?? '';
  return new Response(JSON.stringify({ descs }), { headers: { 'Content-Type': 'application/json' } });
}
