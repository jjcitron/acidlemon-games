// GET  /api/saves?app=&kind=   -> this player's saves for a title
// PUT  /api/saves { app, kind, id?, payload } -> upsert one save
//
// Both require a session. The 401 on PUT is the "Save prompts sign-in" contract: the client keeps
// the work in local storage and shows the magic-link form instead of losing it.
import { readJson, send, methodGuard, cors } from '../../lib/http.js';
import { readSession } from '../../lib/session.js';
import { isApp } from '../../lib/apps.js';
import { isKind } from '../../lib/schema.js';
import { putSave, listSaves } from '../../lib/saves.js';
import { touchUser } from '../../lib/users.js';

export default async function handler(req, res) {
  if (cors(req, res, ['GET', 'PUT'])) return;
  if (methodGuard(req, res, ['GET', 'PUT'])) return;

  const sess = readSession(req);
  if (!sess) return send(res, 401, { error: 'Sign in to save.' });

  if (req.method === 'GET') {
    const app = String(req.query?.app || '');
    const kind = req.query?.kind ? String(req.query.kind) : null;
    if (!isApp(app)) return send(res, 400, { error: 'Unknown app.' });
    if (kind && !isKind(kind)) return send(res, 400, { error: 'Unknown kind.' });
    return send(res, 200, { saves: await listSaves(sess.uid, app, kind) });
  }

  const body = await readJson(req);
  if (!isApp(body?.app)) return send(res, 400, { error: 'Unknown app.' });

  const { save, error } = await putSave(sess.uid, body);
  if (error) return send(res, 400, { error });

  // Saving into a title is the strongest signal of membership, so stamp user_apps here too.
  await touchUser(sess.email, body.app);
  return send(res, 200, { save });
}
