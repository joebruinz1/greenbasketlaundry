// scripts/fetch_hubspot.mjs
// Fetch latest HubSpot blog posts and write a trimmed JSON the site can read.

import fs from 'node:fs/promises';

// ── Config (env) ───────────────────────────────────────────────────────────────
const TOKEN = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
if (!TOKEN) throw new Error("Missing HUBSPOT_PRIVATE_APP_TOKEN");

const BLOG_BASE = (process.env.BLOG_BASE || 'https://hubspot.greenbasketlaundry.com').replace(/\/$/, '');
const LIMIT = process.env.HS_LIMIT || '6';

// ── Call HubSpot API ───────────────────────────────────────────────────────────
const apiUrl = new URL('https://api.hubapi.com/cms/v3/blogs/posts');
apiUrl.searchParams.set('limit', LIMIT);
apiUrl.searchParams.set('state', 'PUBLISHED');
apiUrl.searchParams.set('archived', 'false');

const resp = await fetch(apiUrl.toString(), {
  headers: { Authorization: `Bearer ${TOKEN}` }
});
if (!resp.ok) {
  const detail = await resp.text();
  throw new Error(`HubSpot error ${resp.status}: ${detail}`);
}
const raw = await resp.json();

// ── Helpers ───────────────────────────────────────────────────────────────────
const toIso = (v) => {
  if (!v) return null;
  const n = typeof v === 'number' ? v : (/^\d+$/.test(String(v)) ? Number(v) : NaN);
  const d = isNaN(n) ? new Date(v) : new Date(n);
  return isNaN(d.getTime()) ? null : d.toISOString();
};

const normalize = (p) => {
  const title = p.title || p.htmlTitle || p.pageTitle || p.name || p.slug || 'Untitled';

  // Prefer absolute URL coming from HubSpot. Fallback to BLOG_BASE + blogSlug + slug.
  const absoluteFromApi = p.url || p.absoluteUrl || p.postUrl || null;
  const blogPrefix = p.blogSlug ? `/${String(p.blogSlug).replace(/^\/|\/$/g,'')}` : '';
  const slugPath   = p.slug ? `${blogPrefix}/${p.slug}` : '';
  const fallbackUrl = slugPath ? `${BLOG_BASE}${slugPath}` : null;

  const featuredImage =
    (typeof p.featuredImage === 'string' && p.featuredImage) ||
    (p.featuredImage && p.featuredImage.url) || null;

  const authorsArr  = Array.isArray(p.authors) ? p.authors : (p.author ? [p.author] : []);
  const authorNames = authorsArr.map(a => a?.name || a?.fullName || a?.displayName || a).filter(Boolean);

  return {
    id: p.id,
    title,
    slug: p.slug || '',
    url: absoluteFromApi || fallbackUrl,   // e.g. https://hubspot.greenbasketlaundry.com/green-basket-blog/<slug>
    featuredImage,
    tagIds: p.tagIds || p.tagList || [],
    publishedAt: toIso(p.publishedAt) || toIso(p.publishDate) || toIso(p.updatedAt) || toIso(p.createdAt),
    authorNames
  };
};

// ── Map, sort newest→oldest, write files ──────────────────────────────────────
const posts = (raw.results || []).map(normalize).sort(
  (a,b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0)
);

await fs.mkdir('public', { recursive: true });
const payload = JSON.stringify({ count: posts.length, posts }, null, 2);

// Write to BOTH locations so the page can load either path.
await fs.writeFile('public/posts.json', payload);
await fs.writeFile('posts.json', payload);

console.log(`Wrote posts.json (x2) with ${posts.length} posts`);
