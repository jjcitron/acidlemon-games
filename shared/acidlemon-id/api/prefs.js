// GET /api/prefs -> the signed-in player's saved preferences (defaults when none exist).
// PUT /api/prefs { audio, emailOptIn, releaseNotify, reducedMotion, updatedAt? } -> validate and save.
import { readSession } from '../lib/session.js';
import { getJson, putJson } from '../lib/store.js';
import { createPrefsHandler } from '../lib/prefs.js';

export default createPrefsHandler({ readSession, getJson, putJson });
