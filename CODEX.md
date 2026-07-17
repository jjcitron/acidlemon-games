# CODEX.md

Local operating constitution for **OpenAI Codex** repo-agent work. Workflow detail belongs in `loop/skills/` and `codex_operating_manual.md`.

Sibling Claude constitution: `CLAUDE.md` (same `loop/` runtime; different model dispatch).

## REPOSITORY DISCOVERY
- Identify the repository root and read `AGENTS.md`, `CLAUDE.md`, `GROK.md`, `GEMINI.md`, and `.github/copilot-instructions.md` when present; then follow `loop/coordination.md` and every referenced runtime artifact. These files are complementary, and Claude's primary-developer role does not make its project context optional. More-specific nested instructions govern their subtrees; never work through another live claim.

## PRECEDENCE
- Interactive sessions: personal operating persona governs autonomy.
- Scheduled or unattended work: the per-skill trust ledger governs — no skill acts beyond its earned tier, regardless of persona-level autonomy.

## NEVER (exceptions require asking first)
- Never exceed 200 changed lines in one commit without asking.
- Never touch auth/, billing/, migrations/, secrets, or production config unattended.
- Never report work as done from your own assessment. Done means the relevant predicate or gate passed.
- Never invent a secret, endpoint, path convention, or dependency. Stop and ask or queue it.
- Never add a dependency without explicit approval.
- Never edit or delete a test to make it pass.
- Never dump hidden chain-of-thought into the user channel. Provide concise rationale, evidence, and assumptions instead.
- When a goal condition passes, write `loop/goals/<name>.md` with its predicate before claiming success.
- Never let executor subagents inherit the orchestrator model by default.
- Never wait open-ended on subagents. Every spawn has a deadline (default 10m explore / 15m implement / 20m fan-out wall). At deadline: pull partial output, kill or cut loose, reclaim the work yourself. Idle/available is not a deliverable.

## PATHS
- Gate: `loop/guardrails/verify.sh` or Windows mirror `loop/guardrails/verify.ps1`
- Contract: `loop/contract.md`
- State: `loop/memory/STATE.md`
- Trust ledger: `loop/memory/trust.tsv`
- Dispatch ledger: `loop/memory/dispatch.tsv`
- Goal ledger: `loop/memory/goal-ledger.tsv`
- Usage log: `loop/memory/usage.log`
- Cross-harness coordination: `loop/coordination.md`
- Repository-local lane board: `loop/memory/AGENT_NOTES.md`
- Skills: `loop/skills/<name>/SKILL.md`
- Doctrine: `codex_operating_manual.md`
- Multi-provider routing: `ROUTING.md` + `REVIEW-RUBRIC.md` + `loop/routing/`
- Provider cookbook: `config/providers.md`

## DISPATCH
Model map (dated config as of 2026-07, not durable law — update when the lineup changes).
Source pattern: Sol orchestrator + Luna executors (https://x.com/i/status/2075284449147920437).

| Seat | Model | Effort | Notes |
|---|---|---|---|
| orchestrator / conductor | GPT 5.6 **Sol** | Extra High / Max | Plan, route, accept/reject only |
| executors / workers | GPT 5.6 **Luna** | Extra High | Narrow work orders; 3–5 parallel max |
| cheap triage | Luna Medium / Terra Medium | Medium | Quiet ticks; never Sol |
| verifier | Sol or **fresh-context** Luna | High | Never the maker instance |
| gate | `verify.sh` | n/a | Final vote |

1. Decision / plan / review / standoff -> Sol Extra High, read-only when possible.
2. Quiet triage / huge log skims -> Luna/Terra Medium; never Sol.
3. Spec-complete implementation -> Luna Extra High (pin model; do not inherit Sol).
4. User-facing UI/API/copy final pass -> Sol.
5. Verify against `done_when` -> fresh-context agent; `verify.sh` final.
6. Escalate Luna miss -> Sol replan once; second miss -> wake human.
7. Parallel executors default 3, hard cap 5.

### Cross-provider (Claude / Grok peers)
When the session is part of a multi-harness run, `ROUTING.md` is process law:
- Seat aliases: plan-review = `gpt-5.5` xhigh; code-review = `gpt-5.4` high; impl-bulk = `gpt-5.4`; impl-fast = `gpt-5.4-mini`; rescue = `gpt-5.5` xhigh.
- Grok 4.5 is **not** a Codex model slug — peer via `grok` CLI / Hermes.
- Prefer real CLIs: `codex review`, `codex exec -m ...`, not assumed slash plugins.
- Plan errors → frontier review; code review can be mid-tier; gate is still `verify.sh`.

## WORDS
- "done" = the predicate or deterministic gate passed.
- "small" = under 50 changed lines.
- "cleanup" = behavior identical; gate green before and after.
- "quiet" = no actionable work found; not a skill pass.
- "very close" = the active work order needs at most one more worker+verifier cycle and verify is expected green; anything needing new planning, new scope, or >1 cycle is not close.
- "work order" = JSON/markdown with skill, spec, done_when, must_not, deadline.
- "delivered" = usable handoff artifact received by the orchestrator; not idle/available status.
- "delegate_timeout" = deadline passed without a deliverable; must pull/kill/reclaim.

## BUDGET
- Codex subscription / rate limits are the primary constraint; treat harness rate-limit warnings as the signal.
- Cross into overage only when the goal is "very close" (WORDS definition); otherwise park to `loop/memory/STATE.md` and resume after reset.
- Overage cap: $20/day estimated, audited from `loop/memory/usage.log` rows where `window = overage`. Breach -> stop and wake.
- Burning Sol on executors is a budget bug, not a performance win — log model per seat.

## DONE
- Machine-checkable `done_when` exists before work starts.
- Fresh-context verifier saw neither the plan nor the maker's rationale.
- `loop/guardrails/verify.sh` or its OS mirror has the final vote.
- Maker and checker disagree twice -> stop and wake the human.
- No open subagent wait past its deadline when claiming progress or answering a status check.
