// scripts/fetch_hubspot.mjs
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

const toIso = (v) => {
  if (!v) return null;
  const n = typeof v === 'number' ? v : (/^\d+$/.test(String(v)) ? Number(v) : NaN);
  const d = isNaN(n) ? new Date(v) : new Date(n);
  return isNaN(d.getTime()) ? null : d.toISOString();
};

const normalize = (p) => {
  const title = p.title || p.htmlTitle || p.pageTitle || p.name || p.slug || 'Untitled';
  const slug  = p.slug || (p.url ? new URL(p.url).pathname.replace(/^\/|\/$/g, '') : '');
  const featuredImage =
    (typeof p.featuredImage === 'string' && p.featuredImage) ||
    (p.featuredImage && p.featuredImage.url) || null;
  const tagIds = p.tagIds || p.tagList || [];
  const publishedAt = toIso(p.publishedAt) || toIso(p.publishDate) || toIso(p.updatedAt) || toIso(p.createdAt);
  const authorsArr = Array.isArray(p.authors) ? p.authors : (p.author ? [p.author] : []);
  const authorNames = authorsArr.map(a => a?.name || a?.fullName || a?.displayName || a).filter(Boolean);
  const url = slug ? `https://blog.gblaundry.com/${slug}` : (p.url || null);

  return { id: p.id, title, slug, url, featuredImage, tagIds, publishedAt, authorNames };
};

const posts = (raw.results || []).map(normalize);

// ✅ ensure folder exists, then write
await fs.mkdir('public', { recursive: true });
await fs.writeFile('public/posts.json', JSON.stringify({ count: posts.length, posts }, null, 2));
console.log(`Wrote public/posts.json with ${posts.length} posts`);
