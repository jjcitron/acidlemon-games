# Deploying and consuming acidlemon-id

## Status: code complete, deploy BLOCKED on things only Joel can do

Nothing in this job was deployed, pushed, or published. The service is written and its offline
logic is tested (`node scripts/selftest.mjs`, 63 assertions). Mailgun delivery, Blob I/O, and the
cross-host cookie are **unverified** — none of them can be exercised from the box copy. The
blockers below are prerequisites, not defects.

### Blockers

1. **`id.acidlemon.com` does not exist yet.** Needs a new Vercel project rooted at
   `shared/acidlemon-id`, plus the DNS record. Until then no title can consume the service.
2. **`SESSION_SECRET` must be shared, and it is a secret nobody should copy around casually.**
   The cookie is only valid on all four hosts if every project that reads it signs with the same
   value. Today only the Sumi project has it. This is the one genuinely sensitive step.
3. **`ID_SECRET` must be set to the *current* `SESSION_SECRET` value before `SESSION_SECRET` is
   ever rotated.** User ids are an HMAC of the email under this key. Rotate without pinning it and
   every existing Sumi user and every save is orphaned. See SCHEMA.md.
4. **Mailgun sender.** Sumi already sends magic links from acidlemon.com, so the account and domain
   are proven. What is unproven is whether that domain is verified for general sending or still on
   sandbox/authorized-recipients — on sandbox, only allow-listed addresses receive a link, which
   would make guest→account fail for real players. Someone with Mailgun access has to confirm.
5. **Blob store scope.** The service writes under an `id/` prefix in Sumi's existing public store.
   If the four titles should not share one store, this needs its own store and token instead.

## Deploy order

1. New Vercel project, root `shared/acidlemon-id`, domain `id.acidlemon.com`.
2. Set env from `.env.example` (names only in that file; never commit values).
3. `node scripts/selftest.mjs` — must print `0 failed`.
4. Smoke the real path by hand: request a link, click it, confirm the cookie lands on
   `.acidlemon.com`, then `PUT /api/saves` and confirm a row appears.
5. Only then wire a title.

## Wiring a title

Space Runner 3D is already wired as the reference consumer:
`3d-harrier/src/net/identity.js` + `3d-harrier/signin-harness.html`.

Both are **new files**. No existing Space Runner file imports them, so the WS1 stage-signoff QA
candidate is byte-identical with them present. Session and play telemetry stay on WS1 `/api/event`
— identity never emits a play event.

For the other two titles, the same shape applies; neither is touched by this job:

- **Clash of Steel Blades** — schema groundwork only, already landed here (`fighter` kind, six
  slots). No Clash file was edited: Wave 1 (`20260902-1156`) is in flight, and there is no Clash
  checkout on this host anyway. The Clash PR waits for Wave 1.
- **Cyberhell** — consumes this service. Do not build a Cyberhell-only login. Guest assemble/drop
  a pack with Save prompting sign-in belongs to the queued `20260902-1719-cyberhell-editor`, which
  is not started here and must not collide with `1523`.
- **Sumi** — keeps its own live auth for now, untouched. Guest-create and save-requires-sign-in
  for Sumi is a later Sumi packet gated on Joel's exact text. Sumi's `sumi_session` cookie and
  `acidlemon_session` can coexist during cutover; this service does not accept the old cookie.

## Cutting Sumi over later (not this job)

Sketch only, so the extraction's intent is on record:

1. Set `ID_SECRET` to Sumi's current `SESSION_SECRET` so ids stay stable.
2. Point Sumi's client at `id.acidlemon.com`.
3. Accept either cookie for one release, then drop `sumi_session`.
4. Sumi's existing `users/{hash}.json` and `usernames/{name}.json` objects are *not* migrated by
   this service — it writes under `id/`. A one-time backfill into `id/users/` and
   `id/user-apps/{uid}/sumi.json` is needed, and should be its own packet with its own verifier.
