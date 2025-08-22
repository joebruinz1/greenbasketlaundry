// scripts/fetch_hubspot.mjs
// Fetch latest HubSpot blog posts and write a trimmed JSON for the site.

import fs from 'node:fs/promises';

// --- Config (from env) ---
const TOKEN = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
if (!TOKEN) throw new Error("Missing HUBSPOT_PRIVATE_APP_TOKEN");

const BLOG_BASE = (process.env.BLOG_BASE || 'https://hubspot.greenbasketlaundry.com').replace(/\/$/, '');
const LIMIT = process.env.HS_LIMIT || '6';

// --- Call HubSpot API ---
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

// --- Helpers ---
const toIso = (v) => {
  if (!v) return null;
  const n = typeof v === 'number' ? v : (/^\d+$/.test(String(v)) ? Number(v) : NaN);
  const d = isNaN(n) ? new Date(v) : new Date(n);
  return isNaN(d.getTime()) ? null : d.toISOString();
};

const normalize = (p) => {
  const title = p.title || p.htmlTitle || p.pageTitle || p.name || p.slug || 'Untitled';

  // Prefer absolute URL from API (already correct if a custom domain is connected)
  const absoluteFromApi = p.url || p.absoluteUrl || p.postUrl || null;

  // Fallback to your domain + blog slug + post slug
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
    url: absoluteFromApi || fallbackUrl,   // → e.g., https://hubspot.greenbasketlaundry.com/green-basket-blog/<slug>
    featuredImage,
    tagIds: p.tagIds || p.tagList || [],
    publishedAt: toIso(p.publishedAt) || toIso(p.publishDate) || toIso(p.updatedAt) || toIso(p.createdAt),
    authorNames
  };
};

// --- Map + write file ---
const posts = (raw.results || []).map(normalize);

await fs.mkdir('public', { recursive: true });
await fs.writeFile('public/posts.json', JSON.stringify({ count: posts.length, posts }, null, 2));

console.log(`Wrote public/posts.json with ${posts.length} posts`);
