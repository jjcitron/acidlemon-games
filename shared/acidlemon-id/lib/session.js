// Stateless session tokens: HMAC-signed JSON in an httpOnly cookie. No storage, no deps.
// Lifted from Sumi's api/_lib/session.js. Two deliberate changes:
//   1. Domain=.acidlemon.com, so one sign-in covers all four title hosts.
//   2. Cookie renamed to `acidlemon_session`. Sumi's host-only `sumi_session` cookie is left
//      alone — the live Sumi deploy keeps reading it until Sumi is cut over in its own packet.
import crypto from 'node:crypto';
import { userId } from './ids.js';

const COOKIE = 'acidlemon_session';
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || '.acidlemon.com';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET is not set');
  return s;
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

// token = base64url(payloadJson).base64url(hmac)
export function signSession(payload) {
  const body = b64url(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000) }));
  const sig = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  // constant-time compare
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  // Reject anything older than the cookie's own lifetime. The cookie Max-Age already handles the
  // honest case; this stops a copied token from outliving it.
  if (!payload?.iat || Math.floor(Date.now() / 1000) - payload.iat > MAX_AGE) return null;
  return payload;
}

// Read the session payload from a request's Cookie header, or null.
export function readSession(req) {
  const raw = req.headers?.cookie || '';
  const match = raw.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE}=`));
  if (!match) return null;
  const sess = verifyToken(decodeURIComponent(match.slice(COOKIE.length + 1)));
  if (!sess?.email) return null;
  // uid is derived, never trusted from the payload, so an old cookie can't claim another user.
  return { email: sess.email, uid: userId(sess.email), iat: sess.iat };
}

export function sessionCookie(email) {
  const token = signSession({ email: String(email).trim().toLowerCase() });
  return [
    `${COOKIE}=${encodeURIComponent(token)}`,
    `Domain=${COOKIE_DOMAIN}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${MAX_AGE}`,
  ].join('; ');
}

export function clearCookie() {
  return `${COOKIE}=; Domain=${COOKIE_DOMAIN}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
