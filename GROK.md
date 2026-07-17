# GROK.md

Local operating constitution for **Grok Build CLI** (`grok`) repo-agent work.  
Workflow detail belongs in `loop/skills/` and, for cross-provider runs, `ROUTING.md`.

Sibling constitutions: `CLAUDE.md` (Claude Code), `CODEX.md` (OpenAI Codex). Same `loop/` runtime.

## REPOSITORY DISCOVERY
- Identify the repository root and read `AGENTS.md`, `CLAUDE.md`, `GROK.md`, `GEMINI.md`, and `.github/copilot-instructions.md` when present; then follow `loop/coordination.md` and every referenced runtime artifact. These files are complementary, and Claude's primary-developer role does not make its project context optional. More-specific nested instructions govern their subtrees; never work through another live claim.

## PRECEDENCE
- Interactive sessions: personal operating persona governs autonomy.
- Scheduled or unattended work: the per-skill trust ledger governs — no skill acts beyond its earned tier.

## ROLE IN THE MESH
Grok is a **peer provider**, not a Codex/Claude model slug.
Default seats (see `ROUTING.md`):
- `plan-review-alt` — unconventional / adversarial plan attack
- `code-review-alt` — production-reality edge cases
- `rescue` — break local maxima when another vendor failed
- optional bulk/impl when explicitly assigned

Default model: `grok-4.5` (`grok -m grok-4.5`).  
Composer/fast variants only for mechanical work with a named handoff.

## NEVER (exceptions require asking first)
- Never exceed 200 changed lines in one commit without asking.
- Never touch auth/, billing/, migrations/, secrets, or production config unattended.
- Never report work as done from your own assessment. Done means the predicate or gate passed.
- Never invent a secret, endpoint, path convention, or dependency. Stop and ask or queue it.
- Never add a dependency without explicit approval.
- Never edit or delete a test to make it pass.
- Never expand a rescue handoff into a redesign.
- Never wait open-ended on subagents/best-of lanes. Every spawn has a deadline; on miss pull/kill/reclaim.

## PATHS
- Gate: `loop/guardrails/verify.sh` or `loop/guardrails/verify.ps1`
- Contract: `loop/contract.md`
- State: `loop/memory/STATE.md`
- Dispatch ledger: `loop/memory/dispatch.tsv`
- Usage log: `loop/memory/usage.log`
- Cross-harness coordination: `loop/coordination.md`
- Repository-local lane board: `loop/memory/AGENT_NOTES.md`
- Skills: `loop/skills/<name>/SKILL.md`
- Process law: `ROUTING.md` + `REVIEW-RUBRIC.md`
- Handoffs: `loop/routing/HANDOFF.template.md`

## INVOCATION CHEAT SHEET
```sh
# Plan review (second opinion)
grok -m grok-4.5 "Adversarial plan review. Read PLAN.md and REVIEW-RUBRIC.md. Attack missing edge cases, interface mismatches, unstated assumptions, acceptance criteria that can't fail closed. Write findings suitable to merge into REVIEW.md."

# Code review
grok -m grok-4.5 "Final code review vs PLAN.v2.md acceptance criteria. Prefer concrete bugs/risks over style."

# Rescue (smallest safe patch)
grok -m grok-4.5 "RESCUE: <task>. Failure log: <path>. Smallest safe patch only. Do not expand scope."

# Worktree impl (when assigned)
grok -m grok-4.5 --worktree=<lane> -p "$(cat loop/runs/<id>/handoff-<lane>.md)"

# Parallel best-of (headless only when task is narrow)
grok -m grok-4.5 --best-of-n 3 "Solve: <narrow task>"
```

## DISPATCH (when you are the worker, not orch)
1. Read the handoff packet completely. If any of the five mandatory fields is missing → stop and return to orchestrator.
2. Stay inside `must_not` and `done_when`.
3. Prefer smallest correct change.
4. Leave evidence the gate can check (tests, paths, log lines).
5. Do not claim ship; orchestrator runs `verify.sh`.

## WORDS
- "done" = predicate or deterministic gate passed.
- "small" = under 50 changed lines.
- "rescue" = smallest safe patch; no redesign.
- "delivered" = usable handoff artifact for the orchestrator.

## BUDGET
- Prefer Grok for high-leverage adversarial/rescue seats, not quiet triage.
- Log model + seat to `loop/memory/usage.log`.
- Overage cap follows `loop/contract.md` ($20/day est.).

## DONE
- Machine-checkable `done_when` exists before work starts.
- Fresh-context verifier / `verify.sh` has the final vote when shipping.
- Rescue ends with a patch or a clear blocker for the human — not a second failed freestyle.
