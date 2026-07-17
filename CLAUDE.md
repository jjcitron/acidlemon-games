# CLAUDE.md

Local operating constitution for repo-agent work. Workflow detail belongs in `loop/skills/` and `claude_operating_manual.md`.

## REPOSITORY DISCOVERY
- Identify the repository root and read `AGENTS.md`, `CLAUDE.md`, `GROK.md`, `GEMINI.md`, and `.github/copilot-instructions.md` when present; then follow `loop/coordination.md` and every referenced runtime artifact. These files are complementary. Claude is the primary in-repo developer/orchestrator, but shares project law and active-lane state with every harness. More-specific nested instructions govern their subtrees; never work through another live claim.

## PRECEDENCE
- Interactive sessions: personal operating persona (`soul.md`) governs autonomy.
- Scheduled or unattended work: the per-skill trust ledger governs — no skill acts beyond its earned tier, regardless of persona-level autonomy.

## NEVER (exceptions require asking first)
- Never exceed 200 changed lines in one commit without asking.
- Never touch auth/, billing/, migrations/, secrets, or production config unattended.
- Never report work as done from your own assessment. Done means the relevant predicate or gate passed.
- Never invent a secret, endpoint, path convention, or dependency. Stop and ask or queue it.
- Never add a dependency without explicit approval.
- Never edit or delete a test to make it pass.
- Never echo hidden chain-of-thought. Provide concise rationale, evidence, and assumptions instead.
- When a goal condition passes, write `loop/goals/<name>.md` with its predicate before claiming success.
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
- Multi-provider routing: `ROUTING.md` + `REVIEW-RUBRIC.md` + `loop/routing/`
- Provider cookbook: `config/providers.md`

## DISPATCH
Model map (dated config as of 2026-07, not durable law — update when the lineup changes):
- conductor = the session's chosen model (Fable or Opus)
- strongest = Opus
- mid-tier = Sonnet
- low end = Haiku

1. Decision / plan / review / standoff -> Opus (or the session model when it is Fable), read-only when possible.
2. Huge reads (logs/PDFs) -> Haiku; do not burn frontier tokens.
3. User-facing UI/API/copy -> Opus high-taste final pass.
4. Spec-complete implementation -> Sonnet.
5. Quiet triage -> Haiku, always.
6. Escalate one rung on a miss without asking (Haiku -> Sonnet -> Opus).

### Cross-provider (when Codex / Grok are in play)
Follow `ROUTING.md`. Short form:
- Orchestrator seat plans only; do not implement product code by default.
- Triggers: review plan / reconcile / dispatch / review code / rescue / status.
- Plan review primary: Codex `gpt-5.5` xhigh; optional Grok 4.5 second opinion.
- Bulk impl: Codex `gpt-5.4` worktrees; careful impl: Claude Opus/Sonnet.
- Rescue: different provider than the failed seat (`grok -m grok-4.5` is excellent here).
- Final vote: `loop/guardrails/verify.sh` (or `.ps1`).

## WORDS
- "done" = the predicate or deterministic gate passed.
- "small" = under 50 changed lines.
- "cleanup" = behavior identical; gate green before and after.
- "quiet" = no actionable work found; not a skill pass.
- "very close" = the active work order needs at most one more worker+verifier cycle and verify is expected green; anything needing new planning, new scope, or >1 cycle is not close.
- "delivered" = usable handoff artifact received by the orchestrator; not idle/available status.
- "delegate_timeout" = deadline passed without a deliverable; must pull/kill/reclaim.

## BUDGET
- Subscription 5-hour window is the primary limit; no programmatic query exists — treat harness rate-limit warnings as the signal.
- Cross into overage only when the goal is "very close" (WORDS definition); otherwise park to `loop/memory/STATE.md` and resume after reset.
- Overage cap: $20/day estimated, audited from `loop/memory/usage.log` rows where `window = overage`. Breach -> stop and wake.

## DONE
- Machine-checkable `done_when` exists before work starts.
- Fresh-context verifier saw neither the plan nor the maker's rationale.
- `loop/guardrails/verify.sh` or its OS mirror has the final vote.
- Maker and checker disagree twice -> stop and wake the human.
- No open subagent wait past its deadline when claiming progress or answering a status check.
