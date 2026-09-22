// GET /api/auth/verify?token=... -> validate token, upsert users + user_apps, mint the shared
// .acidlemon.com session cookie, redirect back into whichever title asked for the link.
import { send } from '../../lib/http.js';
import { getJson, removeByPath } from '../../lib/store.js';
import { sessionCookie } from '../../lib/session.js';
import { paths } from '../../lib/schema.js';
import { APPS, isApp } from '../../lib/apps.js';
import { touchUser } from '../../lib/users.js';
import { userId } from '../../lib/ids.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return send(res, 405, { error: 'Method not allowed' });
  }

  const token = String(req.query?.token || '');
  // Fallback landing spot if we can't even read the token record to learn the app.
  const fallback = APPS.sumi.origin;
  const fail = (origin, reason) =>
    res.writeHead(302, { Location: `${origin}/?auth=${reason}` }).end();

  if (!token) return fail(fallback, 'invalid');
  const rec = await getJson(paths.loginToken(token));
  if (!rec) return fail(fallback, 'invalid');

  const origin = isApp(rec.app) ? APPS[rec.app].origin : fallback;

  if (Date.now() > rec.exp) {
    await removeByPath(paths.loginToken(token));
    return fail(origin, 'expired');
  }

  // One-time use.
  await removeByPath(paths.loginToken(token));
  await removeByPath(paths.loginCooldown(userId(rec.email)));

  await touchUser(rec.email, rec.app);

  const path = String(rec.next || '/');
  const safeNext = path.startsWith('/') && !path.startsWith('//') ? path : '/';
  const sep = safeNext.includes('?') ? '&' : '?';

  res
    .writeHead(302, {
      'Set-Cookie': sessionCookie(rec.email),
      Location: `${origin}${safeNext}${sep}auth=ok`,
    })
    .end();
}
