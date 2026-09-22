// users + user_apps upserts. Per-app membership is its own record, never a column on the user —
// one person plays more than one title and a single `app` field cannot represent that.
import { getJson, putJson, listPrefix, fetchJson } from './store.js';
import { paths } from './schema.js';
import { isApp } from './apps.js';
import { userId } from './ids.js';

// Create the user if new, and stamp their membership in `app`. Idempotent.
export async function touchUser(email, app) {
  const uid = userId(email);
  const now = new Date().toISOString();

  const prior = await getJson(paths.user(uid));
  // The Blob store is public, so the raw email is deliberately NOT persisted here. It lives only
  // in the signed session cookie; this record is keyed by the opaque HMAC id. See SCHEMA.md.
  await putJson(paths.user(uid), {
    id: uid,
    created_at: prior?.created_at || now,
    last_app: isApp(app) ? app : prior?.last_app || null,
    last_seen_at: now,
    username: prior?.username || null,
  });

  if (isApp(app)) {
    const priorApp = await getJson(paths.userApp(uid, app));
    await putJson(paths.userApp(uid, app), {
      user_id: uid,
      app,
      first_seen_at: priorApp?.first_seen_at || now,
      last_seen_at: now,
    });
  }

  return uid;
}

export async function getUser(uid) {
  return getJson(paths.user(uid));
}

// Which titles this user has touched. Drives "you also play…" without a second auth anywhere.
export async function listUserApps(uid) {
  const blobs = await listPrefix(paths.userAppPrefix(uid)).catch(() => []);
  const rows = await Promise.all(blobs.map((b) => fetchJson(b.url)));
  return rows.filter(Boolean).map((r) => r.app).filter(isApp).sort();
}
