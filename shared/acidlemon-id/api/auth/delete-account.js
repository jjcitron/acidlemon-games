// POST /api/auth/delete-account { confirm: true, app? } -> permanently delete the signed-in
// player's Acidlemon account: users row, every user_apps row, and their saves in every title.
// Clears the shared session cookie and emails a receipt. Apple 5.1.1(v).
import { readJson, send, methodGuard, cors } from '../../lib/http.js';
import { readSession, clearCookie } from '../../lib/session.js';
import { removePrefix, removeExact } from '../../lib/store.js';
import { deleteAccountData } from '../../lib/account.js';
import { sendAccountDeletedReceipt } from '../../lib/mailgun.js';
import { isApp } from '../../lib/apps.js';

export default async function handler(req, res) {
  if (cors(req, res, ['POST'])) return;
  if (methodGuard(req, res, ['POST'])) return;

  const sess = readSession(req);
  if (!sess) return send(res, 401, { error: 'Not signed in' });

  // Explicit confirm in the body: a stray or replayed request without it deletes nothing, and
  // requiring a JSON body means cross-origin callers must pass the CORS preflight first.
  const body = await readJson(req);
  if (body?.confirm !== true) return send(res, 400, { error: 'Confirmation required.' });
  const app = isApp(body?.app) ? body.app : null;

  try {
    await deleteAccountData(sess.uid, { removePrefix, removeExact });
  } catch {
    // Session is still valid and the users row is deleted last, so the client can just retry.
    return send(res, 500, { error: 'Could not delete the account. Please try again.' });
  }

  res.setHeader('Set-Cookie', clearCookie());

  // The data is already gone, so a Mailgun failure must not turn this into an error response.
  let receipt = false;
  try {
    await sendAccountDeletedReceipt(sess.email, app);
    receipt = true;
  } catch {}
  return send(res, 200, { ok: true, receipt });
}
