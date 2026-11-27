// Dreidel save, leaderboard, CORS, and account-cleanup contracts. Blob/session/mail are in memory.
import { mock, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

if (typeof mock.module !== 'function') {
  throw new Error('module mocks required: run with --experimental-test-module-mocks');
}

delete process.env.DREIDEL_ORIGIN;
const state = {
  blobs: new Map(), versions: new Map(), revision: 0,
  failLeaderboardWrites: false, conflictNextLeaderboardPut: false,
};
const clone = (value) => value == null ? null : structuredClone(value);
function write(path, value) {
  state.blobs.set(path, clone(value));
  state.versions.set(path, String(++state.revision));
}
function remove(path) {
  state.versions.delete(path);
  return state.blobs.delete(path);
}

mock.module('../lib/store.js', {
  cache: true,
  exports: {
    async getJson(path) { return clone(state.blobs.get(path)); },
    async getJsonVersioned(path) {
      return state.blobs.has(path) ? { value: clone(state.blobs.get(path)), etag: state.versions.get(path) } : null;
    },
    async putJsonIfCurrent(path, value, etag) {
      if (state.failLeaderboardWrites) throw new Error('store down');
      const current = state.versions.get(path) ?? null;
      if (current !== etag) return false;
      if (state.conflictNextLeaderboardPut) {
        state.conflictNextLeaderboardPut = false;
        write(path, {
          user_id: UID, app: 'dreidel', name: 'Other writer',
          gelt: 250, wins: 1, updated_at: '2026-01-01T00:00:00.000Z',
        });
        return false;
      }
      write(path, value);
      return true;
    },
    async putJson(path, value) { write(path, value); },
    async listPrefix(prefix) {
      return [...state.blobs.keys()].filter((path) => path.startsWith(prefix)).map((pathname) => ({ pathname, url: pathname }));
    },
    async fetchJson(url) { return clone(state.blobs.get(url)); },
    async removePrefix(prefix) {
      let count = 0;
      for (const path of state.blobs.keys()) {
        if (path.startsWith(prefix) && remove(path)) count += 1;
      }
      return count;
    },
    async removeExact(path) { return remove(path) ? 1 : 0; },
  },
});
mock.module('../lib/session.js', {
  cache: true,
  exports: {
    readSession(req) { return req.headers?.cookie === 'signed' ? { uid: UID, email: EMAIL } : null; },
    clearCookie() { return 'session=; Max-Age=0'; },
  },
});
mock.module('../lib/users.js', {
  cache: true,
  exports: {
    async touchUser() {},
    async getUser(uid) { return clone(state.blobs.get(paths.user(uid))); },
    async listUserApps() { return []; },
  },
});
mock.module('../lib/mailgun.js', {
  cache: true,
  exports: { async sendMagicLink() {}, async sendAccountDeletedReceipt() {} },
});

const { APPS, APP_IDS } = await import('../lib/apps.js');
const { paths } = await import('../lib/schema.js');
const { recordScore } = await import('../lib/leaderboard.js');
const { default: saves } = await import('../api/saves/index.js');
const { default: attach } = await import('../api/saves/attach.js');
const { default: leaderboard } = await import('../api/leaderboard.js');
const { default: me } = await import('../api/auth/me.js');
const { default: requestLink } = await import('../api/auth/request.js');
const { default: logout } = await import('../api/auth/logout.js');
const { default: deleteAccount } = await import('../api/auth/delete-account.js');
const { default: prefs } = await import('../api/prefs.js');

const EMAIL = 'player@example.test';
const UID = '11111111111111111111111111111111';
const OTHER_UID = '22222222222222222222222222222222';
const ORIGIN = 'https://spin.acidlemon.com';
const PRODUCTION_ORIGINS = [ORIGIN, 'https://dreidel.acidlemon.com'];
const COOKIE = 'signed';
const COLLECTION = { purse: 0, equipped: 'walnut', owned: ['walnut'], israel: false };
const endpoints = [
  [me, ['GET']], [requestLink, ['POST']], [logout, ['POST']], [deleteAccount, ['POST']],
  [prefs, ['GET', 'PUT']], [saves, ['GET', 'PUT']], [attach, ['POST']], [leaderboard, ['GET', 'POST']],
];

function response() {
  return {
    statusCode: 0, headers: {}, body: null,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    end(body) { this.body = body ?? null; return this; },
  };
}

async function call(handler, { method = 'GET', url = '/', body, cookie = '', origin = ORIGIN, headers = {} } = {}) {
  const parsed = new URL(url, 'https://id.test');
  const req = {
    method, url: parsed.pathname + parsed.search,
    query: Object.fromEntries(parsed.searchParams), body,
    headers: { host: 'id.acidlemon.com', origin, cookie, ...headers },
  };
  const res = response();
  await handler(req, res);
  return { res, data: res.body ? JSON.parse(res.body) : null };
}

function collection(purse = 0) { return { ...COLLECTION, purse }; }

beforeEach(() => {
  state.blobs.clear();
  state.versions.clear();
  state.revision = 0;
  state.failLeaderboardWrites = false;
  state.conflictNextLeaderboardPut = false;
});

describe('Dreidel identity contracts', { concurrency: false }, () => {
  test('registers the production app and honors a fresh-process staging override', () => {
    assert.ok(APP_IDS.includes('dreidel'));
    assert.equal(APPS.dreidel.origin, ORIGIN);
    assert.equal(APPS.dreidel.label, 'Chanukah Spin');
    assert.deepEqual(APPS.dreidel.kinds, ['collection']);
    assert.equal(APPS.dreidel.leaderboard, true);
    const cwd = fileURLToPath(new URL('..', import.meta.url));
    const source = "import { APPS, allowedOrigins } from './lib/apps.js'; process.stdout.write(JSON.stringify({ origin: APPS.dreidel.origin, allowedOrigins: allowedOrigins() }))";
    const run = (origin) => JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', source], {
      cwd, encoding: 'utf8', env: { ...process.env, DREIDEL_ORIGIN: origin, ACIDLEMON_EXTRA_ORIGINS: '' },
    }));
    for (const [configuredOrigin, expectedOrigin] of [
      ['', ORIGIN], ['https://dreidel-stage.acidlemon.com', 'https://dreidel-stage.acidlemon.com'],
    ]) {
      const result = run(configuredOrigin);
      assert.equal(result.origin, expectedOrigin);
      for (const productionOrigin of PRODUCTION_ORIGINS) assert.ok(result.allowedOrigins.includes(productionOrigin));
    }
  });

  test('echoes exact credentialed CORS origins and answers JSON preflight on every client endpoint', async () => {
    const previous = process.env.ACIDLEMON_EXTRA_ORIGINS;
    const preview = 'https://dreidel-git-feature-team.vercel.app';
    process.env.ACIDLEMON_EXTRA_ORIGINS = `${preview}, https://another-preview.example`;
    try {
      for (const [handler, methods] of endpoints) {
        for (const origin of [...PRODUCTION_ORIGINS, preview]) {
          for (const requested of methods) {
            const { res } = await call(handler, {
              method: 'OPTIONS', origin,
              headers: { 'access-control-request-method': requested, 'access-control-request-headers': 'content-type' },
            });
            assert.equal(res.statusCode, 204);
            assert.equal(res.headers['access-control-allow-origin'], origin);
            assert.equal(res.headers['access-control-allow-credentials'], 'true');
            assert.ok(res.headers['access-control-allow-methods'].split(', ').includes(requested));
            assert.ok(res.headers['access-control-allow-headers'].toLowerCase().includes('content-type'));
          }
        }
      }
      const { res } = await call(leaderboard, { method: 'OPTIONS', origin: 'https://dreidel.acidlemon.com.attacker.test' });
      assert.equal(res.statusCode, 204);
      assert.equal(res.headers['access-control-allow-origin'], undefined);
    } finally {
      if (previous === undefined) delete process.env.ACIDLEMON_EXTRA_ORIGINS;
      else process.env.ACIDLEMON_EXTRA_ORIGINS = previous;
    }
  });

  test('serves the client’s auth requests with credentialed CORS', async () => {
    for (const [index, origin] of PRODUCTION_ORIGINS.entries()) {
      const cases = [
        [me, { url: '/api/auth/me', origin }, 401],
        [me, { url: '/api/auth/me', cookie: COOKIE, origin }, 200],
        [requestLink, {
          method: 'POST', url: '/api/auth/request', origin,
          body: { email: index ? 'other@example.test' : EMAIL, app: 'dreidel', next: '/?auth=ok' },
        }, 200],
        [logout, { method: 'POST', url: '/api/auth/logout', cookie: COOKIE, origin }, 200],
      ];
      for (const [handler, options, status] of cases) {
        const { res } = await call(handler, options);
        assert.equal(res.statusCode, status);
        assert.equal(res.headers['access-control-allow-origin'], origin);
        assert.equal(res.headers['access-control-allow-credentials'], 'true');
      }
    }
    const token = [...state.blobs.values()].find((value) => value.next);
    assert.equal(token.next, '/?auth=ok');
  });

  test('requires sign-in for PUT, stores the exact collection, lists and updates saves, and validates attach items', async () => {
    const body = { app: 'dreidel', kind: 'collection', id: 'main', payload: collection() };
    let result = await call(saves, { method: 'PUT', url: '/api/saves', body });
    assert.equal(result.res.statusCode, 401);

    result = await call(saves, { method: 'PUT', url: '/api/saves', body, cookie: COOKIE });
    assert.equal(result.res.statusCode, 200);
    assert.equal(result.res.headers['access-control-allow-origin'], ORIGIN);
    assert.equal(result.res.headers['access-control-allow-credentials'], 'true');
    assert.deepEqual(Object.keys(result.data), ['save']);
    assert.deepEqual(result.data.save.payload, body.payload);
    const created = result.data.save.created_at;

    result = await call(saves, { url: '/api/saves?app=dreidel&kind=collection', cookie: COOKIE });
    assert.equal(result.res.statusCode, 200);
    assert.equal(result.data.saves.length, 1);
    assert.equal(result.data.saves[0].id, 'main');

    const items = [
      { kind: 'collection', id: 'main', payload: collection(25) },
      { kind: 'collection', id: 'backup', payload: collection(50) },
      { kind: 'collection', id: 'main', payload: { ...collection(), israel: 'yes' } },
    ];
    result = await call(attach, { method: 'POST', url: '/api/saves/attach', body: { app: 'dreidel', items }, cookie: COOKIE });
    assert.equal(result.res.statusCode, 200);
    assert.equal(result.data.attached, 1);
    assert.deepEqual(result.data.results.map((row) => row.ok), [true, false, false]);
    result = await call(saves, { url: '/api/saves?app=dreidel&kind=collection', cookie: COOKIE });
    assert.equal(result.data.saves.length, 1);
    assert.equal(result.data.saves[0].payload.purse, 25);
    assert.equal(result.data.saves[0].created_at, created);
    assert.ok(result.data.saves[0].updated_at >= created);
    assert.equal(state.blobs.get(paths.leaderboardEntry('dreidel', UID)).gelt, 25);
  });

  test('enforces closed collection shape, purse bounds, skin id and ownership rules, and app isolation', async () => {
    const longId = 'a'.repeat(40);
    const owned = [longId, ...Array.from({ length: 63 }, (_, i) => `skin-${i}`)];
    const valid = { purse: 1_000_000, equipped: longId, owned, israel: true };
    let result = await call(saves, {
      method: 'PUT', url: '/api/saves', cookie: COOKIE,
      body: { app: 'dreidel', kind: 'collection', id: 'main', payload: valid },
    });
    assert.equal(result.res.statusCode, 200);

    const invalid = [
      { ...collection(), extra: true }, { ...collection(), updatedAt: null },
      { ...collection(), purse: '12' }, { ...collection(), purse: -1 },
      { ...collection(), purse: 1_000_001 }, { ...collection(), purse: 1.5 },
      { ...collection(), equipped: 'a'.repeat(41), owned: ['a'.repeat(41)] },
      { ...collection(), owned: ['walnut', '../gold', 'Uppercase'] },
      { ...collection(), owned: ['walnut', 'walnut'] },
      { ...collection(), owned: Array.from({ length: 65 }, (_, i) => `skin-${i}`) },
      { ...collection(), equipped: 'not-owned' }, { ...collection(), israel: 1 },
    ];
    for (const payload of invalid) {
      result = await call(saves, {
        method: 'PUT', url: '/api/saves', cookie: COOKIE,
        body: { app: 'dreidel', kind: 'collection', id: 'main', payload },
      });
      assert.equal(result.res.statusCode, 400, JSON.stringify(payload));
    }
    for (const app of APP_IDS.filter((id) => id !== 'dreidel')) {
      result = await call(saves, {
        method: 'PUT', url: '/api/saves', cookie: COOKIE,
        body: { app, kind: 'collection', id: 'main', payload: collection() },
      });
      assert.equal(result.res.statusCode, 400, app);
    }
  });

  test('publishes ordered public pseudonyms with default and clamped limits, and rejects unsupported apps', async () => {
    const rows = [
      { name: EMAIL, gelt: 900, wins: 3, updated_at: '2026-01-02T00:00:00.000Z' },
      { name: 'Early', gelt: 900, wins: 3, updated_at: '2026-01-01T00:00:00.000Z' },
      { name: 'More Wins', gelt: 900, wins: 4, updated_at: '2026-01-03T00:00:00.000Z' },
      ...Array.from({ length: 57 }, (_, i) => ({
        name: 'Player', gelt: 890 - i, wins: i % 4, updated_at: '2026-01-01T00:00:00.000Z',
      })),
    ];
    rows.forEach((row, i) => {
      const uid = String(i + 1).padStart(32, '0');
      write(paths.leaderboardEntry('dreidel', uid), { ...row, user_id: uid, app: 'dreidel' });
    });
    const result = await call(leaderboard, { url: '/api/leaderboard?app=dreidel' });
    assert.equal(result.res.statusCode, 200);
    assert.equal(result.res.headers['access-control-allow-origin'], ORIGIN);
    assert.equal(result.res.headers['access-control-allow-credentials'], 'true');
    assert.equal(result.data.entries.length, 10);
    assert.deepEqual(result.data.entries.slice(0, 3).map((entry) => [entry.gelt, entry.wins]), [[900, 4], [900, 3], [900, 3]]);
    assert.deepEqual(Object.keys(result.data.entries[0]), ['name', 'gelt', 'wins']);
    assert.deepEqual(result.data.entries.slice(0, 2).map((entry) => entry.name), ['More Wins', 'Early']);
    assert.match(result.data.entries[2].name, /^Spinner /);
    assert.equal(JSON.stringify(result.data).includes(EMAIL), false);
    assert.equal((await call(leaderboard, { url: '/api/leaderboard?app=dreidel&limit=0' })).data.entries.length, 1);
    assert.equal((await call(leaderboard, { url: '/api/leaderboard?app=dreidel&limit=999' })).data.entries.length, 50);
    const unknown = await call(leaderboard, { url: '/api/leaderboard?app=missing' });
    assert.equal(unknown.res.statusCode, 400);
    assert.deepEqual(unknown.data, { error: 'Unknown app.' });
    const unsupported = await call(leaderboard, { url: '/api/leaderboard?app=cyberkart' });
    assert.equal(unsupported.res.statusCode, 400);
    assert.ok(unsupported.data.error);
  });

  test('serves credentialed leaderboard GET and POST responses from both production origins', async () => {
    write(paths.user(UID), { username: EMAIL });
    for (const origin of PRODUCTION_ORIGINS) {
      const getResult = await call(leaderboard, { url: '/api/leaderboard?app=dreidel', origin });
      assert.equal(getResult.res.statusCode, 200);
      assert.equal(getResult.res.headers['access-control-allow-origin'], origin);
      assert.equal(getResult.res.headers['access-control-allow-credentials'], 'true');

      const postResult = await call(leaderboard, {
        method: 'POST', url: '/api/leaderboard', cookie: COOKIE, origin,
        body: { app: 'dreidel', gelt: 100, wins: 1 },
      });
      assert.equal(postResult.res.statusCode, 200);
      assert.equal(postResult.res.headers['access-control-allow-origin'], origin);
      assert.equal(postResult.res.headers['access-control-allow-credentials'], 'true');
    }
  });

  test('keeps best-of collection and POST scores, rejects guest/invalid posts, and saves through leaderboard failure', async () => {
    write(paths.user(UID), { username: EMAIL });
    let result = await call(saves, {
      method: 'PUT', url: '/api/saves', cookie: COOKIE,
      body: { app: 'dreidel', kind: 'collection', id: 'main', payload: collection(500) },
    });
    assert.equal(result.res.statusCode, 200);
    assert.deepEqual(Object.keys(result.data), ['save']);
    const scorePath = paths.leaderboardEntry('dreidel', UID);
    assert.equal(state.blobs.get(scorePath).gelt, 500);

    result = await call(leaderboard, { method: 'POST', url: '/api/leaderboard', body: { app: 'dreidel', gelt: 700, wins: 2 } });
    assert.equal(result.res.statusCode, 401);
    assert.deepEqual(result.data, { error: 'Sign in to post scores.' });
    for (const [gelt, wins] of [[-1, 2], [1_000_001, 2], ['1', 2], [1.5, 2], [1, -1], [1, 100_001], [1, 0.5], [1, '2']]) {
      result = await call(leaderboard, {
        method: 'POST', url: '/api/leaderboard', cookie: COOKIE, body: { app: 'dreidel', gelt, wins },
      });
      assert.equal(result.res.statusCode, 400);
    }
    result = await call(leaderboard, { method: 'POST', url: '/api/leaderboard', cookie: COOKIE, body: { app: 'dreidel', gelt: 700, wins: 2 } });
    assert.equal(result.res.statusCode, 200);
    result = await call(leaderboard, { method: 'POST', url: '/api/leaderboard', cookie: COOKIE, body: { app: 'dreidel', gelt: 600, wins: 5 } });
    assert.deepEqual(result.data.entry, { name: `Spinner ${UID.slice(0, 4).toUpperCase()}`, gelt: 700, wins: 5 });
    const tiedAt = state.blobs.get(scorePath).updated_at;
    result = await call(leaderboard, { method: 'POST', url: '/api/leaderboard', cookie: COOKIE, body: { app: 'dreidel', gelt: 650, wins: 4 } });
    assert.deepEqual(result.data.entry, { name: `Spinner ${UID.slice(0, 4).toUpperCase()}`, gelt: 700, wins: 5 });
    assert.equal(state.blobs.get(scorePath).updated_at, tiedAt);

    write(paths.user(UID), { username: '\u0000Golden\u202e Spinner of Acidlemon' });
    result = await call(saves, {
      method: 'PUT', url: '/api/saves', cookie: COOKIE,
      body: { app: 'dreidel', kind: 'collection', id: 'main', payload: collection(600) },
    });
    assert.equal(result.res.statusCode, 200);
    const row = state.blobs.get(scorePath);
    assert.deepEqual([row.name, row.gelt, row.wins], ['Golden Spinner of Acidle', 700, 5]);

    state.failLeaderboardWrites = true;
    const logged = mock.method(console, 'error', () => {});
    try {
      result = await call(saves, {
        method: 'PUT', url: '/api/saves', cookie: COOKIE,
        body: { app: 'dreidel', kind: 'collection', id: 'main', payload: collection(800) },
      });
    } finally { logged.mock.restore(); }
    assert.equal(logged.mock.callCount(), 1);
    assert.equal(result.res.statusCode, 200);
    assert.equal(result.data.save.payload.purse, 800);
    assert.equal(state.blobs.get(scorePath).gelt, 700);
    assert.ok(state.blobs.has(paths.save('dreidel', UID, 'collection', 'main')));
  });

  test('merges overlapping writes and retries a compare-and-swap conflict', async () => {
    write(paths.user(UID), { username: EMAIL });
    const store = await import('../lib/store.js');
    await Promise.all([
      recordScore(store, 'dreidel', UID, { gelt: 100, wins: 2 }),
      recordScore(store, 'dreidel', UID, { gelt: 200, wins: 1 }),
    ]);
    let row = state.blobs.get(paths.leaderboardEntry('dreidel', UID));
    assert.deepEqual([row.gelt, row.wins], [200, 2]);

    remove(paths.leaderboardEntry('dreidel', UID));
    state.conflictNextLeaderboardPut = true;
    await recordScore(store, 'dreidel', UID, { gelt: 175, wins: 3 });
    row = state.blobs.get(paths.leaderboardEntry('dreidel', UID));
    assert.deepEqual([row.gelt, row.wins], [250, 3]);
    assert.equal(row.name, `Spinner ${UID.slice(0, 4).toUpperCase()}`);
  });

  test('account deletion removes this player’s leaderboard rows and leaves other players intact', async () => {
    const mine = paths.leaderboardEntry('dreidel', UID);
    const theirs = paths.leaderboardEntry('dreidel', OTHER_UID);
    const mySave = paths.save('dreidel', UID, 'collection', 'main');
    const otherSave = paths.save('dreidel', OTHER_UID, 'collection', 'main');
    const otherApp = paths.leaderboardEntry('sumi', UID);
    write(mine, { user_id: UID });
    write(theirs, { user_id: OTHER_UID });
    write(mySave, { user_id: UID });
    write(otherSave, { user_id: OTHER_UID });
    write(otherApp, { user_id: UID });
    const result = await call(deleteAccount, {
      method: 'POST', url: '/api/auth/delete-account', cookie: COOKIE,
      body: { confirm: true, app: 'dreidel' },
    });
    assert.equal(result.res.statusCode, 200);
    assert.equal(state.blobs.has(mine), false);
    assert.equal(state.blobs.has(mySave), false);
    assert.equal(state.blobs.has(otherApp), false);
    assert.equal(state.blobs.has(theirs), true);
    assert.equal(state.blobs.has(otherSave), true);
  });
});
