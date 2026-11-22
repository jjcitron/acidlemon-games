// Tiny request/response helpers for the Vercel Node functions. Lifted from Sumi's api/_lib/http.js
// and extended with the credentialed-CORS handling this service needs: registered apps call it
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

// Read JSON while enforcing a byte limit whether Vercel has already parsed the body or left it as
// a request stream. Returns a tagged result so routes can distinguish malformed JSON from 413.
export async function readJsonLimited(req, maxBytes) {
  const declaredLength = req.headers?.['content-length'];
  if (declaredLength !== undefined) {
    const length = Number(declaredLength);
    if (!Number.isSafeInteger(length) || length < 0) {
      return { ok: false, status: 400, error: 'Invalid content length.' };
    }
    if (length > maxBytes) return { ok: false, status: 413, error: 'Request body is too large.' };
  }

  let raw;
  if (req.body !== undefined) {
    if (typeof req.body === 'string') {
      raw = req.body;
    } else {
      try { raw = JSON.stringify(req.body); } catch {
        return { ok: false, status: 400, error: 'Invalid JSON body.' };
      }
      if (typeof raw !== 'string') return { ok: false, status: 400, error: 'Invalid JSON body.' };
    }
  } else {
    const chunks = [];
    let bytes = 0;
    try {
      for await (const chunk of req) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        bytes += buffer.byteLength;
        if (bytes > maxBytes) return { ok: false, status: 413, error: 'Request body is too large.' };
        chunks.push(buffer);
      }
    } catch {
      return { ok: false, status: 400, error: 'Invalid JSON body.' };
    }
    raw = Buffer.concat(chunks).toString('utf8');
  }

  if (Buffer.byteLength(raw, 'utf8') > maxBytes) {
    return { ok: false, status: 413, error: 'Request body is too large.' };
  }
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false, status: 400, error: 'Invalid JSON body.' };
  }
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
