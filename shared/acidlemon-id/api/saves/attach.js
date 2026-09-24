// POST /api/saves/attach { app, items:[{kind,id,payload}] }
// Fold guest work into the account right after the magic link is clicked. Per-item results, so a
// single malformed row doesn't discard the rest of what the player built.
import { readJson, send, methodGuard, cors } from '../../lib/http.js';
import { readSession } from '../../lib/session.js';
import { isApp } from '../../lib/apps.js';
import { attachSaves } from '../../lib/saves.js';
import { touchUser } from '../../lib/users.js';

export default async function handler(req, res) {
  if (cors(req, res, ['POST'])) return;
  if (methodGuard(req, res, ['POST'])) return;

  const sess = readSession(req);
  if (!sess) return send(res, 401, { error: 'Sign in to save.' });

  const { app, items } = await readJson(req);
  if (!isApp(app)) return send(res, 400, { error: 'Unknown app.' });
  if (!Array.isArray(items) || !items.length) return send(res, 400, { error: 'Nothing to attach.' });

  const results = await attachSaves(sess.uid, app, items);
  await touchUser(sess.email, app);
  return send(res, 200, { results, attached: results.filter((r) => r.ok).length });
}
