# Goal: shared Acidlemon magic-link identity + saves

Job `20260903-0836-shared-auth-saves`, round 1. Worker: Claude (box). Direction OK'd by Joel
2026-09-03.

## done_when (machine-checkable)

1. `node shared/acidlemon-id/scripts/selftest.mjs` exits 0 and prints `0 failed`.
2. `node --check` passes on every `.js` in `shared/acidlemon-id/{lib,api,client}` and on
   `3d-harrier/src/net/identity.js`.
3. The live Sumi auth files in `samurai-action-game-repo/api/{_lib,auth}/**` are byte-unchanged.
4. `git apply --check` succeeds for the takeup patch, and the tree it produces is byte-identical
   to the box copy.
5. `loop/guardrails/verify.sh` exits 0.
6. No secret literal, no `5177`, no payment surface, no family name in any added file.

## Result — round 1

| # | Predicate | Outcome |
|---|---|---|
| 1 | selftest | **PASS** — 63 passed, 0 failed |
| 2 | `node --check` | **PASS** — 16 service files + harrier consumer + harness inline module |
| 3 | Sumi auth untouched | **PASS** — mtimes still 2026-06-23/25; md5s intact (copy, not move) |
| 4 | patch applies clean | **PASS** — applied into a scratch repo, `diff -r` identical, selftest 63/0 there too |
| 5 | repo gate | **PASS** (exit 0) — but see caveat |
| 6 | secret/forbidden scan | **PASS** — `.env.example` holds names only, zero values |

### Caveat on predicate 5

`loop/guardrails/verify.sh` is still the shipped stub: it only checks that ripgrep is installed and
that the repo contains no copy of its own placeholder failure marker, then prints "no
project-specific checks configured". Its pass carries almost no signal. The real evidence for this
job is predicates 1–4. Wiring the gate to run `shared/acidlemon-id/scripts/selftest.mjs` would make
it meaningful and is worth doing.

(Note for whoever edits this file: the gate greps the whole tree for its placeholder marker string,
so writing that string literally in any doc makes the gate fail. Describe it, don't spell it.)

## What is NOT verified

Nothing was deployed, pushed, or published. Untestable from a box copy, all deferred to the deploy:

- Mailgun delivery of a real magic link, and whether the acidlemon.com sender is fully verified or
  still sandbox/authorized-recipients only.
- Any Vercel Blob read or write (`@vercel/blob` is not installed here; the selftest deliberately
  covers only the modules that do not import it).
- The `.acidlemon.com` cookie actually travelling between two title hosts in a browser.
- The end-to-end guest → save → 401 → magic link → attach round trip.

See `shared/acidlemon-id/INTEGRATION.md` for the deploy prerequisites and blockers.

## Scope note requiring sign-off

25 new files, 1532 added lines. `CLAUDE.md` caps a commit at 200 changed lines without asking
first. Extracting a whole service cannot fit that, so this is flagged rather than assumed: the
laptop should split it (service / consumer / docs) and Joel should OK the size before it lands.
