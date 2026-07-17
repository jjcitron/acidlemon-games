# Loop Contract

## coordination

- Follow `loop/coordination.md` before shared edits.
- A repository-local lane message never replaces a host-global file claim.

## budget

- Primary constraint is the subscription's 5-hour rolling usage window, not dollars.
  There is no programmatic query for remaining window; the signals are (a) rate-limit
  warnings or errors surfaced by the harness in-session, and (b) local accounting in
  `loop/memory/usage.log`.
- On an approaching-limit or limit-hit signal: continue into overage ONLY if the goal
  is very close (see WORDS in `CLAUDE.md`: at most one more worker+verifier cycle with
  verify expected green). Otherwise park — write progress to `loop/memory/STATE.md`,
  log `budget_stop` in `loop/memory/dispatch.tsv`, and resume after the window resets.
- Overage hard cap: $20/day estimated. Log overage rows in `usage.log` with
  `window = overage`; daily overage = sum of `estimated_cost_usd` where
  `window = overage` for today. At or past $20 → stop and wake the human.
- Quiet ticks never run into overage under any circumstances.

## acts alone

- Draft low-risk code or documentation changes within the current repo.
- Run read-only inspections and deterministic checks.
- Update `loop/memory/STATE.md` and ledgers.
- Kill or cut loose stalled subagents past deadline, reclaim their work, and log `delegate_timeout`.

## queues for me

- New dependencies.
- Changes over 200 lines.
- Ambiguous product decisions.
- Any change where the deterministic gate cannot prove the stated `done_when`.

## wakes me up

- `loop/guardrails/verify.sh` fails twice on the same item.
- Budget is breached.
- A secret, token, payment path, migration, auth path, or production config is needed.
- A standing goal is marked `VIOLATED`.
- Maker and verifier disagree twice.
- A fan-out hits the 20-minute wall twice on the same work order after reclaim (tooling is broken, not just slow).
