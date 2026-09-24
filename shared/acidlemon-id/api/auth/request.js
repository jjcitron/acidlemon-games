// POST /api/auth/request { email, app, next? } -> create a magic-link token and email it.
// Same flow as Sumi's api/auth/request.js; the token record now also carries which title asked,
// so verify() knows where to send the player back to.
import { readJson, send, methodGuard, cors } from '../../lib/http.js';
import { putJson, getJson } from '../../lib/store.js';
import { sendMagicLink } from '../../lib/mailgun.js';
import { paths } from '../../lib/schema.js';
import { isApp } from '../../lib/apps.js';
import { userId, randomToken } from '../../lib/ids.js';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const TOKEN_TTL_MS = 15 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

export default async function handler(req, res) {
  if (cors(req, res, ['POST'])) return;
  if (methodGuard(req, res, ['POST'])) return;

  const { email, app, next } = await readJson(req);
  const clean = String(email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(clean)) return send(res, 400, { error: 'Enter a valid email address.' });
  if (!isApp(app)) return send(res, 400, { error: 'Unknown app.' });

  // Only a same-site path is carried through, never a full URL — the origin is resolved from the
  // app registry at verify time so a crafted link can't redirect off our hosts.
  const path = String(next || '/');
  const safeNext = path.startsWith('/') && !path.startsWith('//') ? path : '/';

  // Light rate-limit: one outstanding link per email per cooldown window.
  const uid = userId(clean);
  const recent = await getJson(paths.loginCooldown(uid));
  if (recent?.issuedAt && Date.now() - recent.issuedAt < RESEND_COOLDOWN_MS) {
    return send(res, 429, { error: 'A link was just sent. Check your inbox or try again shortly.' });
  }

  const token = randomToken();
  const now = Date.now();
  await putJson(paths.loginToken(token), {
    email: clean,
    app,
    next: safeNext,
    exp: now + TOKEN_TTL_MS,
  });
  await putJson(paths.loginCooldown(uid), { issuedAt: now });

  const base = process.env.ID_URL || `https://${req.headers.host}`;
  const link = `${base}/api/auth/verify?token=${token}`;

  try {
    await sendMagicLink(clean, link, app);
  } catch (err) {
    return send(res, 502, { error: 'Could not send the email. ' + err.message });
  }
  return send(res, 200, { ok: true });
}
