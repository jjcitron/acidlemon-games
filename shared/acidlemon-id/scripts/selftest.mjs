// Offline self-test for the pure parts of the shared identity service: schema rules, fighter-kit
// slots, blob paths, cookie attributes, and session signing. No network, no Blob store, no
// Mailgun — so it runs anywhere, including a box copy with no deps installed.
process.env.SESSION_SECRET = 'selftest-session-secret';
process.env.ID_SECRET = 'selftest-id-secret';

const { APPS, APP_IDS, isApp, allowedOrigins } = await import('../lib/apps.js');
const {
  paths, validateSave, validateFighterKit, emptyFighterKit, defaultPreferences,
  validatePreferences, MAX_PREFS_BODY_BYTES, FIGHTER_KIT_SLOTS, SAVE_KINDS, kindAllowed, isSaveId,
} = await import('../lib/schema.js');
const { readJsonLimited } = await import('../lib/http.js');
const { createPrefsHandler } = await import('../lib/prefs.js');
const { sessionCookie, clearCookie, signSession, verifyToken, readSession } =
  await import('../lib/session.js');
const { userId } = await import('../lib/ids.js');
const { accountTargets, deleteAccountData } = await import('../lib/account.js');
const { fromFor, accountDeletedMessage } = await import('../lib/mailgun.js');

let pass = 0;
const fails = [];
const ok = (name, cond) => { if (cond) pass++; else fails.push(name); };
const eq = (name, a, b) => ok(`${name} (got ${JSON.stringify(a)})`, a === b);

// ---- app registry ----------------------------------------------------------
eq('five titles and the website registered', APP_IDS.length, 6);
for (const id of ['sumi', 'space-runner-3d', 'clash-of-steel-blades', 'cyberhell', 'cyberkart', 'acidlemon-com']) {
  ok(`app ${id} exists`, isApp(id));
  if (id !== 'acidlemon-com') ok(`app ${id} has acidlemon origin`, APPS[id].origin.endsWith('.acidlemon.com'));
}
eq('acidlemon-com label', APPS['acidlemon-com'].label, 'Acidlemon');
eq('acidlemon-com origin', APPS['acidlemon-com'].origin, 'https://acidlemon.com');
eq('acidlemon-com declares no save kinds', APPS['acidlemon-com'].kinds.length, 0);
ok('www.acidlemon.com is CORS-allowed', allowedOrigins().includes('https://www.acidlemon.com'));
ok('unknown app rejected', !isApp('not-a-game'));
ok('every origin is https', allowedOrigins().every((o) => o.startsWith('https://')));

// ---- schema ----------------------------------------------------------------
eq('save kinds', SAVE_KINDS.join(','), 'level,fighter,pack');
ok('clash declares fighter kind', kindAllowed('clash-of-steel-blades', 'fighter'));
ok('cyberhell declares pack kind', kindAllowed('cyberhell', 'pack'));
ok('sumi does not store fighters', !kindAllowed('sumi', 'fighter'));
ok('cross-app kind rejected', !kindAllowed('cyberhell', 'fighter'));

ok('unknown app save rejected', !!validateSave({ app: 'nope', kind: 'level', payload: {} }));
ok('unknown kind rejected', !!validateSave({ app: 'sumi', kind: 'sticker', payload: {} }));
ok('non-object payload rejected', !!validateSave({ app: 'sumi', kind: 'level', payload: 'x' }));
ok('null payload rejected', !!validateSave({ app: 'sumi', kind: 'level', payload: null }));
eq('valid level save accepted', validateSave({ app: 'sumi', kind: 'level', payload: { a: 1 } }), null);
ok('oversized payload rejected',
  !!validateSave({ app: 'sumi', kind: 'level', payload: { blob: 'x'.repeat(600 * 1024) } }));

// ---- Clash fighter kit (schema groundwork) ---------------------------------
eq('six fighter slots', FIGHTER_KIT_SLOTS.join(','), 'head,torso,arms,legs,weapon,style');
eq('empty kit has every slot', Object.keys(emptyFighterKit().slots).length, 6);
eq('partial kit allowed', validateFighterKit({ slots: { head: 'h1' } }), null);
eq('kit with no slots allowed', validateFighterKit({}), null);
ok('unknown slot rejected', !!validateFighterKit({ slots: { cape: 'c1' } }));
ok('non-string slot rejected', !!validateFighterKit({ slots: { head: 7 } }));
eq('null slot allowed', validateFighterKit({ slots: { head: null } }), null);
eq('full kit via validateSave',
  validateSave({
    app: 'clash-of-steel-blades',
    kind: 'fighter',
    payload: { slots: Object.fromEntries(FIGHTER_KIT_SLOTS.map((s) => [s, `${s}-01`])) },
  }), null);

// ---- paths -----------------------------------------------------------------
eq('user path', paths.user('abc'), 'id/users/abc.json');
eq('user_apps path', paths.userApp('abc', 'sumi'), 'id/user-apps/abc/sumi.json');
eq('save path', paths.save('cyberhell', 'abc', 'pack', 'p1'),
  'id/saves/cyberhell/abc/pack/p1.json');
eq('kindless save prefix', paths.savePrefix('sumi', 'abc', null), 'id/saves/sumi/abc/');
ok('save prefix is scoped to the user', paths.savePrefix('sumi', 'abc', 'level').includes('/abc/'));

// ---- player preferences ----------------------------------------------------
eq('prefs blob path', paths.prefs('abc'), 'id/prefs/abc.json');
eq('preference body cap is bounded', MAX_PREFS_BODY_BYTES, 4096);
const defaults = defaultPreferences();
eq('default master volume', defaults.audio.master, 1);
eq('default preferences have all flags off',
  [defaults.emailOptIn, defaults.releaseNotify, defaults.reducedMotion].join(','), 'false,false,false');
eq('default preferences have no server timestamp', defaults.updatedAt, null);
eq('valid preferences accepted', validatePreferences(defaults), null);
eq('zero volumes are accepted', validatePreferences({
  ...defaults, audio: { master: 0, music: 0, sfx: 0 }, updatedAt: '2026-11-22T12:00:00.000Z',
}), null);
ok('preference array rejected', !!validatePreferences([]));
ok('missing preference field rejected', !!validatePreferences({ ...defaults, releaseNotify: undefined }));
ok('volume above one rejected', !!validatePreferences({ ...defaults, audio: { ...defaults.audio, sfx: 1.01 } }));
ok('non-finite volume rejected', !!validatePreferences({ ...defaults, audio: { ...defaults.audio, music: NaN } }));
ok('string volume rejected', !!validatePreferences({ ...defaults, audio: { ...defaults.audio, master: '1' } }));
ok('non-boolean email choice rejected', !!validatePreferences({ ...defaults, emailOptIn: 'yes' }));
ok('unknown preference field rejected', !!validatePreferences({ ...defaults, theme: 'dark' }));
ok('unknown audio field rejected', !!validatePreferences({ ...defaults, audio: { ...defaults.audio, voice: 0.5 } }));
ok('invalid preference timestamp rejected', !!validatePreferences({ ...defaults, updatedAt: 'yesterday' }));

const preferenceJson = JSON.stringify(defaults);
const parsedPrefs = await readJsonLimited({ body: preferenceJson }, MAX_PREFS_BODY_BYTES);
ok('capped JSON reader parses a small preference body', parsedPrefs.ok && parsedPrefs.value.audio.master === 1);
eq('capped JSON reader rejects malformed JSON',
  (await readJsonLimited({ body: '{' }, MAX_PREFS_BODY_BYTES)).status, 400);
eq('capped JSON reader rejects an oversized parsed body',
  (await readJsonLimited({ body: { value: 'x'.repeat(32) } }, 16)).status, 413);
eq('capped JSON reader rejects oversized declared bytes before parsing',
  (await readJsonLimited({ headers: { 'content-length': String(MAX_PREFS_BODY_BYTES + 1) }, body: defaults }, MAX_PREFS_BODY_BYTES)).status, 413);
const streamed = await readJsonLimited({
  async *[Symbol.asyncIterator]() { yield Buffer.from('1234'); yield Buffer.from('5678'); },
}, 6);
eq('capped JSON reader rejects an oversized stream', streamed.status, 413);
const unicodeLimit = await readJsonLimited({ body: '{"x":"é"}' }, Buffer.byteLength('{"x":"é"}', 'utf8'));
ok('capped JSON reader measures UTF-8 bytes', unicodeLimit.ok);
eq('capped JSON reader rejects UTF-8 bytes over the limit',
  (await readJsonLimited({ body: '{"x":"é"}' }, Buffer.byteLength('{"x":"é"}', 'utf8') - 1)).status, 413);

// Exercise the actual route logic with injected offline storage and session lookup.
function response() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; return this; },
    end(body = '') { this.body = body; return this; },
  };
}
const fakeStore = { value: null, getError: false, putError: false, path: null, saved: null };
const prefsHandler = createPrefsHandler({
  readSession: (req) => req.testSession || null,
  async getJson(path) {
    fakeStore.path = path;
    if (fakeStore.getError) throw new Error('offline get failure');
    return fakeStore.value;
  },
  async putJson(path, value) {
    fakeStore.path = path;
    fakeStore.saved = value;
    if (fakeStore.putError) throw new Error('offline put failure');
    fakeStore.value = value;
  },
});
const testSession = { uid: 'a'.repeat(32) };
const routeReq = (method, fields = {}) => ({ method, headers: {}, testSession, ...fields });
const unauthGet = response();
await prefsHandler({ method: 'GET', headers: { origin: 'https://www.acidlemon.com' } }, unauthGet);
eq('GET without a session is unauthorized', unauthGet.statusCode, 401);
eq('www origin receives credentialed CORS response', unauthGet.headers['access-control-allow-origin'], 'https://www.acidlemon.com');
eq('CORS enables credentials', unauthGet.headers['access-control-allow-credentials'], 'true');
const unauthPut = response();
await prefsHandler({ method: 'PUT', headers: {}, body: '{', testSession: null }, unauthPut);
eq('PUT without a session is unauthorized before body parsing', unauthPut.statusCode, 401);

const preflight = response();
await prefsHandler({ method: 'OPTIONS', headers: { origin: 'https://www.acidlemon.com' } }, preflight);
eq('www preference preflight status', preflight.statusCode, 204);
ok('www preflight allows GET and PUT', preflight.headers['access-control-allow-methods'].includes('GET, PUT, OPTIONS'));
const deniedOrigin = response();
await prefsHandler({ method: 'OPTIONS', headers: { origin: 'https://untrusted.example' } }, deniedOrigin);
ok('unregistered origin is not echoed', !Object.hasOwn(deniedOrigin.headers, 'access-control-allow-origin'));

const defaultGet = response();
await prefsHandler(routeReq('GET'), defaultGet);
eq('GET succeeds without a stored record', defaultGet.statusCode, 200);
eq('GET wraps defaults in prefs', JSON.stringify(JSON.parse(defaultGet.body).prefs), JSON.stringify(defaults));
eq('GET uses only the session uid path', fakeStore.path, paths.prefs(testSession.uid));

const changedPrefs = {
  ...defaults,
  audio: { master: 0.75, music: 0, sfx: 1 },
  emailOptIn: true,
  releaseNotify: true,
  updatedAt: '2026-11-22T12:00:00.000Z',
};
const putResponse = response();
await prefsHandler(routeReq('PUT', { body: JSON.stringify(changedPrefs) }), putResponse);
const savedPrefs = JSON.parse(putResponse.body).prefs;
eq('PUT succeeds with valid preferences', putResponse.statusCode, 200);
eq('PUT stores in the session uid path', fakeStore.path, paths.prefs(testSession.uid));
eq('PUT returns the stored preference object', JSON.stringify(savedPrefs), JSON.stringify(fakeStore.saved));
ok('PUT sets its own updatedAt timestamp', savedPrefs.updatedAt !== changedPrefs.updatedAt && Number.isFinite(Date.parse(savedPrefs.updatedAt)));
const savedGet = response();
await prefsHandler(routeReq('GET'), savedGet);
eq('GET returns saved preferences in prefs wrapper', JSON.stringify(JSON.parse(savedGet.body).prefs), JSON.stringify(fakeStore.value));

const malformedRoute = response();
await prefsHandler(routeReq('PUT', { body: '{' }), malformedRoute);
eq('PUT malformed JSON returns 400', malformedRoute.statusCode, 400);
const oversizeRoute = response();
await prefsHandler(routeReq('PUT', { body: { audio: { master: 1, music: 1, sfx: 1 }, padding: 'x'.repeat(MAX_PREFS_BODY_BYTES) } }), oversizeRoute);
eq('PUT oversized body returns 413', oversizeRoute.statusCode, 413);
const invalidRoute = response();
await prefsHandler(routeReq('PUT', { body: { ...defaults, audio: { ...defaults.audio, master: 2 } } }), invalidRoute);
eq('PUT invalid preference values return 400', invalidRoute.statusCode, 400);
const wrongMethod = response();
await prefsHandler(routeReq('POST'), wrongMethod);
eq('unsupported preference method returns 405', wrongMethod.statusCode, 405);

fakeStore.getError = true;
const getFailure = response();
await prefsHandler(routeReq('GET'), getFailure);
eq('GET storage failure returns 500', getFailure.statusCode, 500);
fakeStore.getError = false;
fakeStore.putError = true;
const putFailure = response();
await prefsHandler(routeReq('PUT', { body: defaults }), putFailure);
eq('PUT storage failure returns 500', putFailure.statusCode, 500);
fakeStore.putError = false;

// A save id must not be able to climb out of its own prefix.
ok('traversal id rejected', !isSaveId('../../other'));
ok('slash id rejected', !isSaveId('a/b'));
ok('empty id rejected', !isSaveId(''));
ok('long id rejected', !isSaveId('x'.repeat(49)));
ok('normal id accepted', isSaveId('stage-3_v2'));

// ---- cookie ----------------------------------------------------------------
const cookie = sessionCookie('Player@Example.com ');
ok('cookie is shared across acidlemon hosts', cookie.includes('Domain=.acidlemon.com'));
ok('cookie name is not sumi_session', cookie.startsWith('acidlemon_session='));
ok('cookie httpOnly', cookie.includes('HttpOnly'));
ok('cookie secure', cookie.includes('Secure'));
ok('cookie samesite lax (survives magic-link redirect)', cookie.includes('SameSite=Lax'));
ok('clear cookie targets same domain', clearCookie().includes('Domain=.acidlemon.com'));
ok('clear cookie expires immediately', clearCookie().includes('Max-Age=0'));

// ---- session integrity -----------------------------------------------------
const token = signSession({ email: 'player@example.com' });
eq('round-trips email', verifyToken(token).email, 'player@example.com');
ok('garbage rejected', verifyToken('garbage') === null);
ok('empty rejected', verifyToken('') === null);
const [body, sig] = token.split('.');
ok('tampered payload rejected', verifyToken(`${body}x.${sig}`) === null);
ok('tampered signature rejected', verifyToken(`${body}.${sig.slice(0, -1)}a`) === null);
ok('unsigned payload rejected', verifyToken(`${body}.`) === null);

// readSession must derive uid itself, never take one the cookie claims.
const forged = signSession({ email: 'player@example.com', uid: 'someone-elses-id' });
const sess = readSession({ headers: { cookie: `acidlemon_session=${encodeURIComponent(forged)}` } });
eq('uid is derived, not trusted', sess.uid, userId('player@example.com'));
const mixed = sessionCookie('  MiXeD@Example.COM  ');
const mixedToken = decodeURIComponent(mixed.split(';')[0].slice('acidlemon_session='.length));
eq('email normalised on sign-in', verifyToken(mixedToken).email, 'mixed@example.com');
eq('normalised email yields same uid as clean input',
  userId(verifyToken(mixedToken).email), userId('mixed@example.com'));
ok('no cookie -> no session', readSession({ headers: {} }) === null);
ok('sumi_session cookie alone is not accepted',
  readSession({ headers: { cookie: `sumi_session=${encodeURIComponent(token)}` } }) === null);

// ---- user ids --------------------------------------------------------------
eq('uid stable', userId('a@b.com'), userId('a@b.com'));
eq('uid case/space insensitive', userId(' A@B.com '), userId('a@b.com'));
ok('uid differs per email', userId('a@b.com') !== userId('c@d.com'));
eq('uid is 32 hex chars', /^[0-9a-f]{32}$/.test(userId('a@b.com')), true);
ok('uid contains no raw email', !userId('a@b.com').includes('a@b.com'));

// ---- app registration ------------------------------------------------------
eq('cyberkart origin', APPS.cyberkart.origin, 'https://cyberkart.acidlemon.com');
eq('cyberkart declares no save kinds yet', APPS.cyberkart.kinds.length, 0);
ok('cyberkart saves rejected until a kind is declared',
  !!validateSave({ app: 'cyberkart', kind: 'level', payload: {} }));
ok('website saves rejected until a kind is declared',
  !!validateSave({ app: 'acidlemon-com', kind: 'level', payload: {} }));

// ---- mailgun sender + receipt copy -----------------------------------------
eq('cyberkart sends from its own address', fromFor('cyberkart', {}),
  'CyberKart <cyberkart@games.acidlemon.com>');
eq('other titles fall back to MAILGUN_FROM', fromFor('sumi', { MAILGUN_FROM: 'X <x@y.z>' }), 'X <x@y.z>');
eq('no override falls back to postmaster', fromFor('sumi', { MAILGUN_DOMAIN: 'games.acidlemon.com' }),
  'Acidlemon Games <postmaster@games.acidlemon.com>');
const receipt = accountDeletedMessage('cyberkart', {});
ok('receipt is from CyberKart', receipt.from.includes('cyberkart@games.acidlemon.com'));
ok('receipt subject names the title', receipt.subject.includes('CyberKart'));
ok('receipt says irreversible', /cannot be undone/.test(receipt.text));
ok('receipt says one account covers all titles', /covers all our titles/.test(receipt.text));
ok('receipt carries no link', !/https?:\/\//.test(receipt.text + receipt.html));
ok('unknown app receipt is generic', accountDeletedMessage(null, {}).subject.includes('Acidlemon Games'));

// ---- account deletion ------------------------------------------------------
{
  const A = userId('delete-me@example.com');
  const B = userId('keep-me@example.com');
  const t = accountTargets(A);
  ok('targets sweep every registered app', APP_IDS.every((a) => t.prefixes.includes(`id/saves/${a}/${A}/`)));
  ok('targets include user_apps prefix', t.prefixes.includes(`id/user-apps/${A}/`));
  eq('users row is removed last', t.exact[t.exact.length - 1], `id/users/${A}.json`);
  ok('targets include login cooldown', t.exact.includes(`id/tokens/by-user/${A}.json`));
  ok('targets include website preferences', t.exact.includes(`id/prefs/${A}.json`));
  ok('no target mentions another user', [...t.prefixes, ...t.exact].every((p) => !p.includes(B)));

  const blobs = new Set();
  for (const u of [A, B]) {
    blobs.add(`id/users/${u}.json`);
    blobs.add(`id/tokens/by-user/${u}.json`);
    blobs.add(`id/prefs/${u}.json`);
    for (const a of ['sumi', 'cyberkart']) blobs.add(`id/user-apps/${u}/${a}.json`);
    blobs.add(`id/saves/sumi/${u}/level/stage-1.json`);
    blobs.add(`id/saves/cyberhell/${u}/pack/p1.json`);
  }
  const store = {
    async removePrefix(prefix) {
      const hit = [...blobs].filter((p) => p.startsWith(prefix));
      hit.forEach((p) => blobs.delete(p));
      return hit.length;
    },
    async removeExact(pathname) { return blobs.delete(pathname) ? 1 : 0; },
  };
  eq('removes every row for the user', await deleteAccountData(A, store), 7);
  ok('nothing of the user remains', [...blobs].every((p) => !p.includes(A)));
  eq('other user is untouched', [...blobs].filter((p) => p.includes(B)).length, 7);
  eq('deleting again is a no-op', await deleteAccountData(A, store), 0);

  for (const bad of ['', undefined, null, '../x', 'abc', 'a'.repeat(33)]) {
    let threw = false;
    try { await deleteAccountData(bad, store); } catch { threw = true; }
    ok(`malformed uid ${JSON.stringify(bad)} refused`, threw);
  }
  eq('refused uids deleted nothing', blobs.size, 7);
}

// ---- report ----------------------------------------------------------------
console.log(`acidlemon-id selftest: ${pass} passed, ${fails.length} failed`);
if (fails.length) {
  for (const f of fails) console.error(`  FAIL: ${f}`);
  process.exit(1);
}
