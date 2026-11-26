// Success-path sign-in event. Store and session are stubbed: no Blob, no network.
// Run: node --experimental-test-module-mocks --test test/signin-event.test.js
// (or `npm test` from shared/acidlemon-id).
import { mock, describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

if (typeof mock.module !== 'function') {
  throw new Error(
    'module mocks required: node --experimental-test-module-mocks --test test/signin-event.test.js',
  );
}

delete process.env.CYBERKART_ORIGIN;
process.env.ID_SECRET = 'signin-event-test-id-secret';
process.env.SESSION_SECRET = 'signin-event-test-session-secret';

const { paths } = await import('../lib/schema.js');
const { userId } = await import('../lib/ids.js');

const COOKIE = [
  'acidlemon_session=stub-token-value',
  'Domain=.acidlemon.com',
  'Path=/',
  'HttpOnly',
  'Secure',
  'SameSite=Lax',
  'Max-Age=2592000',
].join('; ');

const state = {
  blobs: new Map(),
  reads: [],
  removed: [],
  writes: [],
  cookieCalls: [],
  failGet: false,
};

mock.module('../lib/store.js', {
  cache: true,
  exports: {
    async getJson(pathname) {
      if (state.failGet) throw new Error('blob down');
      state.reads.push(pathname);
      if (!state.blobs.has(pathname)) return null;
      return structuredClone(state.blobs.get(pathname));
    },
    async putJson(pathname, data) {
      state.writes.push(pathname);
      state.blobs.set(pathname, structuredClone(data));
    },
    async removeByPath(pathname) {
      state.removed.push(pathname);
      state.blobs.delete(pathname);
    },
    async listPrefix() { return []; },
    async fetchJson() { return null; },
    async urlFor() { return null; },
    async removePrefix() { return 0; },
    async removeExact() { return 0; },
  },
});

mock.module('../lib/session.js', {
  cache: true,
  exports: {
    sessionCookie(email) {
      state.cookieCalls.push(email);
      return COOKIE;
    },
  },
});

const { default: handler } = await import('../api/auth/verify.js');

const EMAIL = 'player-secret@example.com';
const TOKEN = 'token-SECRET-DO-NOT-LOG-9f3a';
const UID = userId(EMAIL);
const IP = '203.0.113.50';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36';
const LEAKED_COOKIE = 'leaked-session-cookie-value';
const SHA = 'abcdef1234567890';

const RECORD_KEYS = [
  'game', 'name', 'type', 'ts', 'client_id', 'session_id', 'props',
  'internal', 'internal_reasons', 'host', 'env', 'build', 'schema_v',
];

function fakeRes() {
  return {
    statusCode: 0,
    headers: {},
    ended: false,
    writeHeadCalls: 0,
    setHeader(name, value) {
      this.headers[name] = value;
      this.headers[String(name).toLowerCase()] = value;
    },
    writeHead(status, hdrs = {}) {
      this.writeHeadCalls += 1;
      this.statusCode = status;
      for (const [key, value] of Object.entries(hdrs)) this.setHeader(key, value);
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    end() {
      this.ended = true;
    },
  };
}

function seedToken(rec) {
  state.blobs.set(paths.loginToken(TOKEN), rec);
}

async function call({ method = 'GET', query = {}, headers = {}, env = {}, url } = {}) {
  const applied = {
    VERCEL_ENV: 'production',
    VERCEL_GIT_COMMIT_SHA: SHA,
    ...env,
  };
  const prev = {};
  for (const [key, value] of Object.entries(applied)) {
    prev[key] = process.env[key];
    if (value == null) delete process.env[key];
    else process.env[key] = value;
  }
  const logged = [];
  const original = console.log;
  console.log = (...args) => {
    logged.push(args.map((part) => (typeof part === 'string' ? part : JSON.stringify(part))).join(' '));
  };
  const res = fakeRes();
  const req = {
    method,
    query,
    headers,
    url: url ?? `/api/auth/verify?token=${query.token || ''}`,
    socket: { remoteAddress: IP },
  };
  let thrown = null;
  try {
    await handler(req, res);
  } catch (err) {
    thrown = err;
  } finally {
    console.log = original;
    for (const [key, value] of Object.entries(prev)) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  }
  const events = [];
  for (const line of logged) {
    try { events.push(JSON.parse(line)); } catch { /* not a record */ }
  }
  return { res, logged, events, thrown };
}

function assertNoSecrets(text, extra = []) {
  const secrets = [EMAIL, TOKEN, UID, IP, LEAKED_COOKIE, COOKIE, 'stub-token-value', ...extra];
  for (const secret of secrets) {
    assert.equal(text.includes(secret), false, `log leaked ${secret}`);
  }
}

function assertRecordShape(event, app) {
  assert.deepEqual(Object.keys(event), RECORD_KEYS);
  assert.equal(event.game, 'acidlemon-id');
  assert.equal(event.name, 'signin_success');
  assert.equal(event.type, 'signin');
  assert.equal(typeof event.ts, 'number');
  assert.ok(Math.abs(event.ts - Date.now()) < 5000);
  assert.equal(event.client_id, '');
  assert.equal(event.session_id, '');
  assert.deepEqual(event.props, { app });
  assert.equal(typeof event.internal, 'boolean');
  assert.ok(Array.isArray(event.internal_reasons));
  assert.equal(typeof event.host, 'string');
  assert.equal(typeof event.env, 'string');
  assert.equal(event.build, 'abcdef1');
  assert.equal(event.schema_v, 1);
}

beforeEach(() => {
  state.blobs.clear();
  state.reads.length = 0;
  state.removed.length = 0;
  state.writes.length = 0;
  state.cookieCalls.length = 0;
  state.failGet = false;
});

describe('verify sign-in event', { concurrency: false }, () => {
  test('B1: a successful verify emits one anonymous signin_success line', async () => {
    seedToken({ email: EMAIL, app: 'sumi', next: '/ink', exp: Date.now() + 60_000 });
    const { res, logged, events } = await call({
      query: { token: TOKEN },
      headers: {
        host: 'id.acidlemon.com',
        'x-forwarded-host': 'id.acidlemon.com',
        'user-agent': UA,
        'x-forwarded-for': IP,
        cookie: `acidlemon_session=${LEAKED_COOKIE}`,
      },
    });

    assert.equal(logged.length, 1);
    assert.equal(events.length, 1);
    assertRecordShape(events[0], 'sumi');
    assert.equal(events[0].internal, false);
    assert.deepEqual(events[0].internal_reasons, []);
    assert.equal(events[0].host, 'id.acidlemon.com');
    assert.equal(events[0].env, 'production');
    assertNoSecrets(logged[0]);
    assert.equal(res.statusCode, 302);
    assert.equal(res.ended, true);
    assert.equal(res.writeHeadCalls, 1);
  });

  test('B1: props.app is the registry id for every title, and nothing else', async () => {
    const cases = [
      ['sumi', '/ink', 'https://sumi-game.acidlemon.com/ink?auth=ok'],
      ['space-runner-3d', '/run', 'https://spacerunner3d.acidlemon.com/run?auth=ok'],
      ['clash-of-steel-blades', '/fight?x=1', 'https://clashofsteelblades.acidlemon.com/fight?x=1&auth=ok'],
      ['cyberhell', '/', 'https://cyberhell.acidlemon.com/?auth=ok'],
      ['cyberkart', '/garage', 'https://cyberkart.acidlemon.com/garage?auth=ok'],
    ];
    for (const [app, next, location] of cases) {
      state.blobs.clear();
      state.cookieCalls.length = 0;
      seedToken({ email: EMAIL, app, next, exp: Date.now() + 60_000 });
      const { res, logged, events } = await call({
        query: { token: TOKEN },
        headers: { host: 'id.acidlemon.com' },
      });
      assert.equal(events.length, 1, app);
      assert.deepEqual(events[0].props, { app }, app);
      assert.equal(res.headers.location, location, app);
      assert.equal(res.headers['set-cookie'], COOKIE, app);
      assert.deepEqual(state.cookieCalls, [EMAIL], app);
      assertNoSecrets(logged.join('\n'));
    }
  });

  test('B1: unknown app is not copied into props; preview and QA are internal', async () => {
    seedToken({ email: EMAIL, app: EMAIL, next: '/phish', exp: Date.now() + 60_000 });
    const markerUa = 'Playwright-SecretMarker';
    const { res, logged, events } = await call({
      query: { token: TOKEN, qa: EMAIL },
      headers: {
        host: 'acidlemon-id-git-foo.vercel.app',
        'x-forwarded-for': IP,
        'user-agent': markerUa,
        cookie: `acidlemon_internal=1; acidlemon_session=${LEAKED_COOKIE}`,
      },
      env: { VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_SHA: SHA },
    });

    assert.equal(events.length, 1);
    assert.equal(events[0].name, 'signin_success');
    assert.deepEqual(events[0].props, { app: null });
    assert.equal(events[0].internal, true);
    assert.deepEqual(events[0].internal_reasons, [
      'vercel_app',
      'preview_host',
      'test_param',
      'automation_ua',
      'opt_out',
      'non_prod_env',
    ]);
    assert.equal(events[0].host, 'acidlemon-id-git-foo.vercel.app');
    assert.equal(events[0].env, 'preview');
    assertNoSecrets(logged[0], [markerUa, 'Playwright']);
    // Unknown app falls back to the sumi origin. The stored next path is unchanged.
    assert.equal(res.headers.location, 'https://sumi-game.acidlemon.com/phish?auth=ok');
    assert.equal(res.headers.location.includes(EMAIL), false);
    assert.equal(res.headers['set-cookie'], COOKIE);
  });

  test('B1: a non-hostname forwarded host is not logged', async () => {
    seedToken({ email: EMAIL, app: 'sumi', next: '/', exp: Date.now() + 60_000 });
    const { events, logged } = await call({
      query: { token: TOKEN },
      headers: {
        'x-forwarded-host': EMAIL,
        referer: `https://id.acidlemon.com/api/auth/verify?token=${TOKEN}`,
      },
    });
    assert.equal(events.length, 1);
    assert.equal(events[0].host, '');
    assert.equal(events[0].internal, true);
    assert.deepEqual(events[0].internal_reasons, ['preview_host']);
    assertNoSecrets(logged[0]);
  });

  test('B1: canonical host keeps its port and a proxy chain off the record', async () => {
    seedToken({ email: EMAIL, app: 'sumi', next: '/', exp: Date.now() + 60_000 });
    const { events, logged } = await call({
      query: { token: TOKEN },
      headers: { 'x-forwarded-host': 'id.acidlemon.com:443, evil.example' },
    });
    assert.equal(events.length, 1);
    assert.equal(events[0].host, 'id.acidlemon.com');
    assert.equal(events[0].internal, false);
    assert.equal(logged[0].includes('evil.example'), false);
  });

  test('B3: Location and Set-Cookie match the pre-log redirect for the same inputs', async () => {
    seedToken({
      email: EMAIL,
      app: 'sumi',
      next: '//evil.example/phish',
      exp: Date.now() + 60_000,
    });
    const { res } = await call({
      query: { token: TOKEN },
      headers: { host: 'evil.example', 'x-forwarded-host': 'evil.example' },
    });
    assert.equal(res.statusCode, 302);
    assert.equal(res.writeHeadCalls, 1);
    assert.equal(res.headers.location, 'https://sumi-game.acidlemon.com/?auth=ok');
    assert.equal(res.headers['set-cookie'], COOKIE);
    assert.deepEqual(state.cookieCalls, [EMAIL]);
    assert.deepEqual(state.removed, [
      paths.loginToken(TOKEN),
      paths.loginCooldown(UID),
    ]);
    assert.deepEqual(state.reads, [
      paths.loginToken(TOKEN),
      paths.user(UID),
      paths.userApp(UID, 'sumi'),
    ]);
    assert.deepEqual(state.writes, [
      paths.user(UID),
      paths.userApp(UID, 'sumi'),
    ]);
  });

  test('B2: missing token keeps the invalid redirect and emits nothing', async () => {
    const { res, logged, events } = await call({
      query: {},
      headers: { host: 'id.acidlemon.com' },
    });
    assert.equal(res.statusCode, 302);
    assert.equal(res.headers.location, 'https://sumi-game.acidlemon.com/?auth=invalid');
    assert.equal(res.headers['set-cookie'], undefined);
    assert.equal(res.writeHeadCalls, 1);
    assert.deepEqual(logged, []);
    assert.deepEqual(events, []);
    assert.deepEqual(state.cookieCalls, []);
    assert.deepEqual(state.reads, []);
    assert.deepEqual(state.removed, []);
  });

  test('B2: unknown token keeps the invalid redirect and emits nothing', async () => {
    const { res, logged } = await call({
      query: { token: TOKEN },
      headers: { host: 'id.acidlemon.com' },
    });
    assert.equal(res.statusCode, 302);
    assert.equal(res.headers.location, 'https://sumi-game.acidlemon.com/?auth=invalid');
    assert.equal(res.headers['set-cookie'], undefined);
    assert.deepEqual(logged, []);
    assert.deepEqual(state.cookieCalls, []);
    assert.deepEqual(state.removed, []);
    assert.deepEqual(state.reads, [paths.loginToken(TOKEN)]);
  });

  test('B2: expired token keeps the app redirect and never emits signin_success', async () => {
    seedToken({ email: EMAIL, app: 'cyberkart', next: '/garage', exp: Date.now() - 1000 });
    const { res, logged, events } = await call({
      query: { token: TOKEN },
      headers: { host: 'id.acidlemon.com' },
    });
    assert.equal(res.statusCode, 302);
    assert.equal(res.headers.location, 'https://cyberkart.acidlemon.com/?auth=expired');
    assert.equal(res.headers['set-cookie'], undefined);
    assert.deepEqual(state.cookieCalls, []);
    assert.deepEqual(state.removed, [paths.loginToken(TOKEN)]);
    assert.deepEqual(logged, []);
    assert.deepEqual(events, []);
    assert.equal(logged.join('\n').includes('signin_success'), false);
  });

  test('B2: expired unknown app still falls back to the sumi origin', async () => {
    seedToken({ email: EMAIL, app: 'not-a-game', next: '/x', exp: Date.now() - 5 });
    const { res, logged } = await call({
      query: { token: TOKEN },
      headers: { host: 'id.acidlemon.com' },
    });
    assert.equal(res.headers.location, 'https://sumi-game.acidlemon.com/?auth=expired');
    assert.equal(res.headers['set-cookie'], undefined);
    assert.deepEqual(logged, []);
  });

  test('B2: non-GET does not emit signin_success', async () => {
    seedToken({ email: EMAIL, app: 'sumi', next: '/', exp: Date.now() + 60_000 });
    const { res, logged } = await call({
      method: 'POST',
      query: { token: TOKEN },
      headers: { host: 'id.acidlemon.com' },
    });
    assert.equal(res.statusCode, 405);
    assert.equal(res.headers.location, undefined);
    assert.equal(res.headers['set-cookie'], undefined);
    assert.deepEqual(logged, []);
    assert.deepEqual(state.reads, []);
  });

  test('a logging throw still leaves Location and Set-Cookie in place', async () => {
    seedToken({ email: EMAIL, app: 'sumi', next: '/ink', exp: Date.now() + 60_000 });
    const original = console.log;
    console.log = () => { throw new Error('stdout failed'); };
    const res = fakeRes();
    let thrown = null;
    try {
      await handler({
        method: 'GET',
        query: { token: TOKEN },
        headers: { host: 'id.acidlemon.com' },
        url: `/api/auth/verify?token=${TOKEN}`,
      }, res);
    } catch (err) {
      thrown = err;
    } finally {
      console.log = original;
    }
    assert.equal(thrown, null);
    assert.equal(res.statusCode, 302);
    assert.equal(res.headers.location, 'https://sumi-game.acidlemon.com/ink?auth=ok');
    assert.equal(res.headers['set-cookie'], COOKIE);
  });

  test('a store failure still throws and does not emit signin_success', async () => {
    state.failGet = true;
    const { res, logged, thrown } = await call({
      query: { token: TOKEN },
      headers: { host: 'id.acidlemon.com' },
    });
    assert.ok(thrown);
    assert.equal(res.ended, false);
    assert.equal(res.headers.location, undefined);
    assert.equal(res.headers['set-cookie'], undefined);
    assert.deepEqual(logged, []);
  });
});
