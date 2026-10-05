// Account deletion. Pure planning plus an injected store, so the selftest can run it against an
// in-memory fake and this file never imports the Blob SDK.
//
// Policy: hard-delete. Saves are private per user and there is no shared/public content table, so
// there is nothing to anonymize. If a title ever publishes user content under an attribution,
// that content gets its user_id/username stripped here instead of deleted — see README.
import { APP_IDS } from './apps.js';
import { paths } from './schema.js';

const UID_RE = /^[a-f0-9]{32}$/;

// Everything that belongs to one user. Saves are swept for every registered app, kind-agnostic,
// so a kind that was later retired still gets cleaned. The users row goes last so a failure part
// way through leaves the account intact and the delete can simply be retried.
export function accountTargets(uid) {
  return {
    prefixes: [
      ...APP_IDS.map((app) => paths.savePrefix(app, uid, null)),
      paths.userAppPrefix(uid),
    ],
    exact: [paths.loginCooldown(uid), paths.user(uid)],
  };
}

// store = { removePrefix(prefix) -> count, removeExact(pathname) -> count }, both throwing on error.
export async function deleteAccountData(uid, store) {
  // An empty or malformed uid would turn "id/user-apps/<uid>/" into a prefix that matches
  // everyone, so refuse anything that is not a derived user id.
  if (!UID_RE.test(String(uid || ''))) throw new Error('Invalid user id.');
  const { prefixes, exact } = accountTargets(uid);
  let removed = 0;
  for (const prefix of prefixes) removed += await store.removePrefix(prefix);
  for (const pathname of exact) removed += await store.removeExact(pathname);
  return removed;
}
