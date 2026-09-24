// Stable, opaque user ids. Lifted from Sumi's emailHash so existing Sumi records keep resolving.
//
// The Blob store is public, so raw emails must never appear in an object path. A user's id is an
// HMAC of their normalised email. That makes the id stable and unguessable but also means it is
// only stable while the HMAC key is stable — rotating the key renames every user.
//
// Sumi keyed this off SESSION_SECRET. Now that four titles share one identity, SESSION_SECRET is
// something we may want to rotate (it signs cookies) without orphaning every save. So the key is
// read from ID_SECRET, falling back to SESSION_SECRET to stay byte-compatible with the ids Sumi
// has already written. Set ID_SECRET = the current SESSION_SECRET value once, then SESSION_SECRET
// becomes free to rotate.
import crypto from 'node:crypto';

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function userId(email) {
  const key = process.env.ID_SECRET || process.env.SESSION_SECRET || 'dev';
  return crypto.createHmac('sha256', key).update(normalizeEmail(email)).digest('hex').slice(0, 32);
}

export function randomToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function randomId() {
  return crypto.randomBytes(8).toString('hex');
}
