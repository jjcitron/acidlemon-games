# Shared identity schema — users, user_apps, saves

Job `20260903-0836-shared-auth-saves`. Direction OK'd by Joel 2026-09-03.

## Why membership is a table, not a column

One person plays more than one title. A single `users.app` column can only ever record the last
title they touched, so it cannot answer "does this player already own a Cyberhell pack?" without
destroying the answer to the same question about Sumi. Membership is therefore its own row per
(user, app), and the user record carries only a soft `last_app` pointer for routing and copy.

## Logical schema

This is the canonical shape. It is written as DDL because that is the clearest way to state it and
because a SQL backend is the likely destination, but nothing is deployed to SQL by this job — see
"Physical mapping" for what actually stores the bytes today.

```sql
CREATE TABLE users (
  id          TEXT PRIMARY KEY,   -- opaque, stable, derived from the email (see note below)
  email       TEXT UNIQUE,        -- NOT persisted by the current blob backend; see note
  username    TEXT UNIQUE,        -- optional display name, claimed after first sign-in
  created_at  TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  last_app    TEXT REFERENCES apps(id)   -- soft pointer, routing/copy only, never authorization
);

CREATE TABLE user_apps (
  user_id       TEXT NOT NULL REFERENCES users(id),
  app           TEXT NOT NULL,    -- sumi | space-runner-3d | clash-of-steel-blades | cyberhell
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_at  TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, app)
);

CREATE TABLE saves (
  id         TEXT NOT NULL,       -- unique within (user_id, app, kind)
  user_id    TEXT NOT NULL REFERENCES users(id),
  app        TEXT NOT NULL,
  kind       TEXT NOT NULL,       -- level | fighter | pack
  payload    JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, app, kind, id)
);
```

`app` enum: `sumi`, `space-runner-3d`, `clash-of-steel-blades`, `cyberhell`.
`kind` enum: `level`, `fighter`, `pack`.

A `kind` is only accepted for an app that declares it (`lib/apps.js` → `kinds`), so a Cyberhell
client cannot write a `fighter` row into Clash's namespace. Today: Sumi and Space Runner 3D take
`level`, Clash takes `fighter`, Cyberhell takes `pack`.

### Note on `users.email` — deviation from DESIGN.md, deliberate

DESIGN.md lists `users (id, email, created_at, last_app)`. The current backend is the **public**
Vercel Blob store that Sumi already uses, and Sumi's existing code deliberately never writes a raw
email into it (see the comment in `samurai-action-game-repo/api/auth/username.js`). Persisting
`email` now would be a privacy regression against the live behaviour, so:

- `users.id` is `HMAC(ID_SECRET, lower(trim(email)))`, truncated to 32 hex chars — stable,
  unguessable, and not reversible to an address.
- The raw email lives only inside the HMAC-signed session cookie, and is echoed back by
  `/api/auth/me` to the signed-in player themselves.
- The `email` column above is kept in the logical schema for the eventual private/SQL backend,
  where storing it is safe and makes account recovery and support possible.

This is the one place the implementation intentionally diverges from the design doc. Flagging it
for review rather than silently choosing either side.

### Note on the id secret

Sumi derived its user hash from `SESSION_SECRET`. That conflates two jobs: signing cookies (which
you want to be able to rotate) and naming users (which must never change). `lib/ids.js` reads
`ID_SECRET` and falls back to `SESSION_SECRET`, so the ids stay byte-compatible with what Sumi has
already written. **Set `ID_SECRET` once to the current `SESSION_SECRET` value before rotating
`SESSION_SECRET`, or every user and save is orphaned.**

## Physical mapping (Vercel Blob, today)

Reuses Sumi's existing public Blob store. No new third-party dependency: `@vercel/blob` is the same
package and version Sumi already declares. All keys sit under an `id/` prefix so this service never
collides with Sumi's existing `users/`, `usernames/`, `levels/`, and `tokens/` objects.

| Logical row | Blob pathname |
| --- | --- |
| `users` | `id/users/{user_id}.json` |
| `user_apps` | `id/user-apps/{user_id}/{app}.json` |
| `saves` | `id/saves/{app}/{user_id}/{kind}/{save_id}.json` |
| login token (transient, 15 min, one-time) | `id/tokens/{token}.json` |
| resend cooldown (transient, 60 s) | `id/tokens/by-user/{user_id}.json` |

One record per object, so concurrent writers never collide — the same property Sumi's store relies
on. `save_id` is constrained to `[A-Za-z0-9_-]{1,48}` because clients supply it (a guest row keeps
its local id through attach), and an unconstrained id could climb out of its prefix.

## Clash of Steel Blades — fighter kit

Groundwork only, per the job constraints: the slot vocabulary is fixed now so that fighters saved
today are still readable when the real mixer UI is built. No editor, no textures, no Wave 1 files
touched.

```
slots = { head, torso, arms, legs, weapon, style }
```

Every slot is optional and nullable — a guest may have mixed only a head — but unknown slots are
rejected, which keeps the vocabulary closed while the customizer is still being designed. Slot
values are opaque string ids up to 64 chars; resolving an id to art is the title's job, not
identity's. Textures/meshes come later.

```json
{
  "id": "fighter-1", "user_id": "…", "app": "clash-of-steel-blades", "kind": "fighter",
  "payload": { "slots": {
    "head": "head-oni-01", "torso": "torso-lamellar-02", "arms": "arms-bare-01",
    "legs": "legs-greaves-01", "weapon": "weapon-odachi-01", "style": "style-iai"
  } }
}
```

## Session

One HMAC-signed httpOnly cookie, `acidlemon_session`, on `Domain=.acidlemon.com`, so a single
magic link covers all four hosts. `Secure`, `SameSite=Lax` (Lax survives the top-level GET
navigation the magic link performs), 30-day `Max-Age`, and the signed payload's `iat` is rejected
past the same window so a copied token can't outlive its cookie.

`readSession()` re-derives `user_id` from the email in the payload rather than reading a `uid`
field, so a forged or stale payload cannot claim another user's saves.

Sumi's existing host-only `sumi_session` cookie is untouched and is not accepted by this service.
The two can coexist during cutover.

## Guest → signed-in

Guest work is never written to `saves`. It sits in `localStorage` under
`acidlemon.guest.{app}.{kind}` until a magic link is clicked, then `POST /api/saves/attach` folds
it into the account and the local rows are dropped. `PUT /api/saves` answering `401` is the whole
hook: the client keeps the build on disk and shows the sign-in form instead of losing it.
