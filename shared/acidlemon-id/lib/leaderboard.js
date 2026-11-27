// Score rules are independent of Blob so ranking and best-of updates can be tested offline.
import { MAX_GELT, paths } from './schema.js';

const MAX_WINS = 100_000;
const inRange = (value, max) => Number.isInteger(value) && value >= 0 && value <= max;

export function validateScore({ gelt, wins }) {
  if (!inRange(gelt, MAX_GELT)) return `gelt must be an integer from 0 to ${MAX_GELT}.`;
  if (!inRange(wins, MAX_WINS)) return `wins must be an integer from 0 to ${MAX_WINS}.`;
  return null;
}

function displayName(username, uid) {
  const clean = typeof username === 'string' ? username.replace(/[\p{Cc}\p{Cf}]/gu, '').trim() : '';
  if (clean && !clean.normalize('NFKC').includes('@')) return Array.from(clean).slice(0, 24).join('');
  return `Spinner ${uid.slice(0, 4).toUpperCase()}`;
}

function publicEntry(row) {
  return { name: displayName(row.name, row.user_id), gelt: row.gelt, wins: row.wins };
}

export function rankEntries(rows, limit) {
  const number = typeof limit === 'number' || (typeof limit === 'string' && limit.trim())
    ? Number(limit)
    : NaN;
  const size = Number.isNaN(number) ? 10 : Math.min(50, Math.max(1, Math.trunc(number)));
  return rows
    .filter((row) => row && !validateScore(row) && typeof row.user_id === 'string'
      && /^[a-f0-9]{32}$/.test(row.user_id) && typeof row.updated_at === 'string')
    .sort((a, b) => b.gelt - a.gelt || b.wins - a.wins || a.updated_at.localeCompare(b.updated_at))
    .slice(0, size)
    .map(publicEntry);
}

export async function listEntries(store, app, limit) {
  const blobs = await store.listPrefix(paths.leaderboardPrefix(app));
  const rows = await Promise.all(blobs.map((blob) => store.fetchJson(blob.url)));
  return rankEntries(rows, limit);
}

export async function recordScore(store, app, uid, { gelt, wins = 0 }) {
  const pathname = paths.leaderboardEntry(app, uid);
  const user = await store.getJson(paths.user(uid));
  const name = displayName(user?.username, uid);

  // If another instance updated the same player, merge against its new version and retry.
  for (let attempt = 0; attempt < 4; attempt++) {
    const current = await store.getJsonVersioned(pathname);
    const prior = current?.value;
    if (current && (!prior || validateScore(prior))) throw new Error('Could not read leaderboard score.');
    const bestGelt = Math.max(prior?.gelt ?? 0, gelt);
    const bestWins = Math.max(prior?.wins ?? 0, wins);
    const improved = !prior || bestGelt > prior.gelt || bestWins > prior.wins;
    const row = {
      user_id: uid,
      app,
      name,
      gelt: bestGelt,
      wins: bestWins,
      updated_at: improved ? new Date().toISOString() : prior.updated_at,
    };
    if (!improved && name === prior.name) return publicEntry(row);
    if (await store.putJsonIfCurrent(pathname, row, current?.etag ?? null)) return publicEntry(row);
  }
  throw new Error('Leaderboard score changed during the update.');
}
