// POST /api/auth/logout -> clear the shared session cookie (all four hosts at once).
import { send, methodGuard, cors } from '../../lib/http.js';
import { clearCookie } from '../../lib/session.js';

export default async function handler(req, res) {
  if (cors(req, res, ['POST'])) return;
  if (methodGuard(req, res, ['POST'])) return;
  res.setHeader('Set-Cookie', clearCookie());
  return send(res, 200, { ok: true });
}
