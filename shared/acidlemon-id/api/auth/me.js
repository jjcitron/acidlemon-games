// GET /api/auth/me -> the current player from the shared cookie, or 401. The 401 is what drives
// the whole hook: a guest can build, and only Save calls this and gets told to sign in.
import { send, cors } from '../../lib/http.js';
import { readSession } from '../../lib/session.js';
import { getUser, listUserApps } from '../../lib/users.js';

export default async function handler(req, res) {
  if (cors(req, res, ['GET'])) return;

  const sess = readSession(req);
  if (!sess) return send(res, 401, { error: 'Not signed in' });

  const [user, apps] = await Promise.all([getUser(sess.uid), listUserApps(sess.uid)]);
  return send(res, 200, {
    id: sess.uid,
    email: sess.email,
    username: user?.username || null,
    apps,
    last_app: user?.last_app || null,
  });
}
