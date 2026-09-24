// Offline self-test for the pure parts of the shared identity service: schema rules, fighter-kit
// slots, blob paths, cookie attributes, and session signing. No network, no Blob store, no
// Mailgun — so it runs anywhere, including a box copy with no deps installed.
process.env.SESSION_SECRET = 'selftest-session-secret';
process.env.ID_SECRET = 'selftest-id-secret';

const { APPS, APP_IDS, isApp, allowedOrigins } = await import('../lib/apps.js');
const {
  paths, validateSave, validateFighterKit, emptyFighterKit,
  FIGHTER_KIT_SLOTS, SAVE_KINDS, kindAllowed, isSaveId,
} = await import('../lib/schema.js');
const { sessionCookie, clearCookie, signSession, verifyToken, readSession } =
  await import('../lib/session.js');
const { userId } = await import('../lib/ids.js');

let pass = 0;
const fails = [];
const ok = (name, cond) => { if (cond) pass++; else fails.push(name); };
const eq = (name, a, b) => ok(`${name} (got ${JSON.stringify(a)})`, a === b);

// ---- app registry ----------------------------------------------------------
eq('four titles registered', APP_IDS.length, 4);
for (const id of ['sumi', 'space-runner-3d', 'clash-of-steel-blades', 'cyberhell']) {
  ok(`app ${id} exists`, isApp(id));
  ok(`app ${id} has acidlemon origin`, APPS[id].origin.endsWith('.acidlemon.com'));
}
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

// ---- report ----------------------------------------------------------------
console.log(`acidlemon-id selftest: ${pass} passed, ${fails.length} failed`);
if (fails.length) {
  for (const f of fails) console.error(`  FAIL: ${f}`);
  process.exit(1);
}
