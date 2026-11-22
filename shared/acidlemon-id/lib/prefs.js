// Handler factory keeps the route testable without loading Vercel Blob or making network calls.
import { readJsonLimited, send, methodGuard, cors } from './http.js';
import { defaultPreferences, MAX_PREFS_BODY_BYTES, paths, validatePreferences } from './schema.js';

export function createPrefsHandler({ readSession, getJson, putJson }) {
  return async function prefsHandler(req, res) {
    if (cors(req, res, ['GET', 'PUT'])) return;
    if (methodGuard(req, res, ['GET', 'PUT'])) return;

    const session = readSession(req);
    if (!session) return send(res, 401, { error: 'Not signed in' });

    if (req.method === 'GET') {
      try {
        const stored = await getJson(paths.prefs(session.uid));
        const prefs = stored && !validatePreferences(stored) ? stored : defaultPreferences();
        return send(res, 200, { prefs });
      } catch {
        return send(res, 500, { error: 'Could not load preferences.' });
      }
    }

    const parsed = await readJsonLimited(req, MAX_PREFS_BODY_BYTES);
    if (!parsed.ok) return send(res, parsed.status, { error: parsed.error });
    const error = validatePreferences(parsed.value);
    if (error) return send(res, 400, { error });

    const prefs = {
      audio: { ...parsed.value.audio },
      emailOptIn: parsed.value.emailOptIn,
      releaseNotify: parsed.value.releaseNotify,
      reducedMotion: parsed.value.reducedMotion,
      updatedAt: new Date().toISOString(),
    };
    try {
      await putJson(paths.prefs(session.uid), prefs);
    } catch {
      return send(res, 500, { error: 'Could not save preferences.' });
    }
    return send(res, 200, { prefs });
  };
}
