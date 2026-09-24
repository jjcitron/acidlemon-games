// Tiny request/response helpers for the Vercel Node functions. Lifted from Sumi's api/_lib/http.js
// and extended with the credentialed-CORS handling this service needs: the four titles call it
// cross-origin, so every response must name the caller's exact origin (never `*`, which browsers
// reject alongside credentials).
import { allowedOrigins } from './apps.js';

export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body) {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  // Fallback: read the raw stream (e.g. under `vercel dev` without auto-parse).
  const chunks = [];
  for await (const c of req) chunks.push(c);
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return {}; }
}

export function send(res, status, data) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

export function methodGuard(req, res, allowed) {
  if (allowed.includes(req.method)) return false;
  res.setHeader('Allow', allowed.join(', '));
  send(res, 405, { error: 'Method not allowed' });
  return true;
}

// Echo the caller's origin when it's a registered title. Returns true if the request was an
// OPTIONS preflight and has already been answered — callers should return immediately.
export function cors(req, res, methods) {
  const origin = req.headers?.origin;
  if (origin && allowedOrigins().includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', [...methods, 'OPTIONS'].join(', '));
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}
