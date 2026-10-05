// Blob store helpers. Lifted from Sumi's api/_lib/store.js, minus the level-specific pieces.
// Each record is its own object at a deterministic path, so concurrent writers never collide.
// The store is public; sensitive records are keyed by unguessable HMAC hashes / random tokens so
// their URLs aren't enumerable. We read them back by exact pathname.
import { put, list, del } from '@vercel/blob';

// The public Blob store's read-write token. Vercel named it PUBLIC_READ_WRITE_TOKEN (the BLOB_
// prefix was taken by the old private store); prefer it, fall back to the conventional name.
const token = () => process.env.PUBLIC_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN;

// Write a JSON record at an exact path (overwrite-in-place, no random suffix).
export async function putJson(pathname, data) {
  return put(pathname, JSON.stringify(data), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
    token: token(),
  });
}

// Resolve an exact pathname to its blob URL (del/fetch need the URL, not the pathname).
export async function urlFor(pathname) {
  const page = await list({ prefix: pathname, limit: 1000, token: token() }).catch(() => null);
  if (!page) return null;
  return page.blobs.find((b) => b.pathname === pathname)?.url || null;
}

// Read a JSON record by exact pathname. Returns null if missing. Records are written with
// cacheControlMaxAge:0, so the CDN won't serve a stale body after an overwrite.
export async function getJson(pathname) {
  const url = await urlFor(pathname);
  if (!url) return null;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

// Fetch+parse JSON from a known blob URL — avoids a second list() round-trip.
export async function fetchJson(url) {
  if (!url) return null;
  const res = await fetch(url, { cache: 'no-store' }).catch(() => null);
  if (!res || !res.ok) return null;
  return res.json().catch(() => null);
}

// List blobs under a prefix (paginated; returns all pages flattened).
export async function listPrefix(prefix) {
  const out = [];
  let cursor;
  do {
    const page = await list({ prefix, cursor, limit: 1000, token: token() });
    out.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return out;
}

export async function removeByPath(pathname) {
  const url = await urlFor(pathname);
  if (url) await del(url, { token: token() }).catch(() => {});
}

// Strict deletes for account removal. Unlike removeByPath these throw on failure, so a half-failed
// delete surfaces to the caller instead of being reported as done. Return how many blobs went.
export async function removePrefix(prefix) {
  const urls = (await listPrefix(prefix)).map((b) => b.url);
  for (let i = 0; i < urls.length; i += 100) {
    await del(urls.slice(i, i + 100), { token: token() });
  }
  return urls.length;
}

export async function removeExact(pathname) {
  const hit = (await listPrefix(pathname)).find((b) => b.pathname === pathname);
  if (!hit) return 0;
  await del(hit.url, { token: token() });
  return 1;
}
