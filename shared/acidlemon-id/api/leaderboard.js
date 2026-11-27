// Public rankings and authenticated best-of scores for apps with a leaderboard.
import { appOrNull } from '../lib/apps.js';
import { cors, methodGuard, readJson, send } from '../lib/http.js';
import { listEntries, recordScore, validateScore } from '../lib/leaderboard.js';
import { readSession } from '../lib/session.js';
import * as store from '../lib/store.js';

export default async function handler(req, res) {
  const methods = ['GET', 'POST'];
  if (cors(req, res, methods)) return;
  if (methodGuard(req, res, methods)) return;

  const posting = req.method === 'POST';
  const session = posting ? readSession(req) : null;
  if (posting && !session) return send(res, 401, { error: 'Sign in to post scores.' });

  const input = posting ? await readJson(req).catch(() => null) : req.query;
  const app = input?.app;
  const meta = typeof app === 'string' ? appOrNull(app) : null;
  if (!meta) return send(res, 400, { error: 'Unknown app.' });
  if (!meta.leaderboard) return send(res, 400, { error: 'This app has no leaderboard.' });

  if (!posting) {
    try {
      return send(res, 200, { entries: await listEntries(store, app, input.limit) });
    } catch {
      return send(res, 500, { error: 'Could not load leaderboard.' });
    }
  }

  const error = validateScore(input);
  if (error) return send(res, 400, { error });
  try {
    return send(res, 200, { entry: await recordScore(store, app, session.uid, input) });
  } catch {
    return send(res, 500, { error: 'Could not post score.' });
  }
}
