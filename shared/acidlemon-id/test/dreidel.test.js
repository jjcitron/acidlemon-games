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
const ORIGIN = 'https://dreidel.acidlemon.com';
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
    assert.equal(APPS.dreidel.origin, 'https://dreidel.acidlemon.com');
    assert.equal(APPS.dreidel.label, 'Chanukah Spin');
    assert.deepEqual(APPS.dreidel.kinds, ['collection']);
    assert.equal(APPS.dreidel.leaderboard, true);
    const cwd = fileURLToPath(new URL('..', import.meta.url));
    const source = "import { APPS } from './lib/apps.js'; process.stdout.write(APPS.dreidel.origin)";
    const run = (origin) => execFileSync(process.execPath, ['--input-type=module', '-e', source], {
      cwd, encoding: 'utf8', env: { ...process.env, DREIDEL_ORIGIN: origin },
    });
    assert.equal(run(''), 'https://dreidel.acidlemon.com');
    assert.equal(run('https://dreidel-stage.acidlemon.com'), 'https://dreidel-stage.acidlemon.com');
  });

  test('echoes exact credentialed CORS origins and answers JSON preflight on every client endpoint', async () => {
    const previous = process.env.ACIDLEMON_EXTRA_ORIGINS;
    const preview = 'https://dreidel-git-feature-team.vercel.app';
    process.env.ACIDLEMON_EXTRA_ORIGINS = `${preview}, https://another-preview.example`;
    try {
      for (const [handler, methods] of endpoints) {
        for (const origin of [ORIGIN, preview]) {
          const requested = methods.includes('PUT') ? 'PUT' : methods[0];
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
      const { res } = await call(leaderboard, { method: 'OPTIONS', origin: 'https://dreidel.acidlemon.com.attacker.test' });
      assert.equal(res.statusCode, 204);
      assert.equal(res.headers['access-control-allow-origin'], undefined);
    } finally {
      if (previous === undefined) delete process.env.ACIDLEMON_EXTRA_ORIGINS;
      else process.env.ACIDLEMON_EXTRA_ORIGINS = previous;
    }
  });

  test('serves the client’s auth requests with credentialed CORS', async () => {
    const cases = [
      [me, { url: '/api/auth/me' }, 401],
      [me, { url: '/api/auth/me', cookie: COOKIE }, 200],
      [requestLink, {
        method: 'POST', url: '/api/auth/request', body: { email: EMAIL, app: 'dreidel', next: '/?auth=ok' },
      }, 200],
      [logout, { method: 'POST', url: '/api/auth/logout', cookie: COOKIE }, 200],
    ];
    for (const [handler, options, status] of cases) {
      const { res } = await call(handler, options);
      assert.equal(res.statusCode, status);
      assert.equal(res.headers['access-control-allow-origin'], ORIGIN);
      assert.equal(res.headers['access-control-allow-credentials'], 'true');
    }
    const token = [...state.blobs.values()].find((value) => value.next);
    assert.equal(token.next, '/?auth=ok');
  });
});
