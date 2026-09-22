# acidlemon-id — shared magic-link identity + saves

One Acidlemon identity across all four titles. Magic link by email (Mailgun, from acidlemon.com),
one session cookie on `.acidlemon.com`, guest-create with sign-in required to save.

Extracted from the live Sumi implementation in `samurai-action-game-repo/api/`. **Those Sumi files
were not modified** — this is a copy that generalises them. Sumi keeps running on its own auth
until it is cut over in a later packet.

- Schema and the guest→account flow: [`SCHEMA.md`](./SCHEMA.md)
- Deploy prerequisites and the current blocker: [`INTEGRATION.md`](./INTEGRATION.md)

## Shape

Deployed **once** as its own Vercel project at `https://id.acidlemon.com`. The four titles call it
cross-origin with `credentials: 'include'`; the session cookie is scoped to `.acidlemon.com` so it
travels to all of them. That way there is exactly one auth implementation, not four vendored
copies that drift.

```
lib/apps.js     app registry — hosts, branding, allowed save kinds, CORS allowlist
lib/ids.js      opaque stable user ids (HMAC of email)
lib/session.js  HMAC-signed cookie on .acidlemon.com
lib/store.js    Vercel Blob helpers (from Sumi)
lib/mailgun.js  magic-link email, branded per title (from Sumi)
lib/schema.js   record shapes, blob paths, validation, fighter-kit slots
lib/users.js    users + user_apps upserts
lib/saves.js    save read/write, guest attach
lib/http.js     json/method helpers (from Sumi) + credentialed CORS

api/auth/request.js   POST { email, app, next? }  -> emails a link
api/auth/verify.js    GET  ?token=...             -> cookie + redirect back into the title
api/auth/me.js        GET                         -> { id, email, username, apps[] } | 401
api/auth/logout.js    POST                        -> clears the shared cookie
api/saves/index.js    GET ?app=&kind= | PUT       -> list / upsert  (401 = sign in to save)
api/saves/attach.js   POST { app, items[] }       -> fold guest work into the account

client/acidlemon-id.js   browser client the titles import
scripts/selftest.mjs     offline checks (no network, no deps)
```

## Consuming it from a title

```js
import { AcidlemonId } from 'https://id.acidlemon.com/client/acidlemon-id.js';

const id = new AcidlemonId({ app: 'space-runner-3d' });
await id.boot(['level']);          // resolves session; folds in guest work after a link lands

const r = await id.save('level', payload, 'stage-3');
if (r.needsSignIn) {
  // Work is already safe in localStorage. Show the email form.
  await id.requestLink(email, '/editor');
}
```

`save()` stashes to `localStorage` *before* it calls the server, so an unauthenticated or failed
save never costs the player their build.

## Checks

```
node scripts/selftest.mjs
```

63 assertions over the schema rules, fighter-kit slots, blob paths, cookie attributes, session
tamper-resistance, and id stability. Runs with no dependencies installed and no network, so it
works on a box copy. It does **not** cover Mailgun delivery or Blob I/O — those need the real
deploy and env, and are unverified here (see `INTEGRATION.md`).

## Rules this service keeps

- No second auth system. If a title needs sign-in, it calls this.
- Membership is `user_apps` rows, never a `users.app` column.
- Guest work lives in the browser until a link is clicked.
- Redirect targets come from the server-side app registry, never from request input.
- The public Blob store never receives a raw email.
