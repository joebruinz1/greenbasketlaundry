import fs from 'node:fs/promises';

const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
if (!token) throw new Error("Missing HUBSPOT_PRIVATE_APP_TOKEN");

const limit = process.env.HS_LIMIT || '6';
const url = new URL('https://api.hubapi.com/cms/v3/blogs/posts');
url.searchParams.set('limit', limit);
url.searchParams.set('state', 'PUBLISHED');
url.searchParams.set('archived', 'false');

const res = await fetch(url.toString(), {
  headers: { Authorization: `Bearer ${token}` }
});
if (!res.ok) {
  const detail = await res.text();
  throw new Error(`HubSpot error ${res.status}: ${detail}`);
}
const raw = await res.json();

const posts = (raw.results || []).map(p => ({
  id: p.id,
  title: p.title,
  slug: p.slug,
  url: `https://blog.gblaundry.com/${p.slug}`, // change if your blog domain/path differs
  featuredImage: p.featuredImage?.url ?? null,
  tagIds: p.tagIds ?? [],
  publishedAt: p.publishedAt ?? p.createdAt,
  authorNames: (p.authors || []).map(a => a.name).filter(Boolean),
}));

await fs.mkdir('public', { recursive: true });
await fs.writeFile('public/posts.json', JSON.stringify({ count: posts.length, posts }, null, 2));
console.log(`Wrote public/posts.json with ${posts.length} posts`);
