# AGENTS.md

Codex / multi-agent entrypoint for this repo.

## Read first
1. `CODEX.md` — local laws, dispatch (Sol orchestrator / Luna executors), budget, done definition
2. `CLAUDE.md` — primary developer/orchestrator laws and shared runtime context
3. `GROK.md` — Grok peer-provider laws and shared runtime context
4. `GEMINI.md` — Gemini project laws and shared runtime context
5. `.github/copilot-instructions.md` — GitHub Copilot project laws and shared runtime context
6. `ROUTING.md` — multi-provider dispatch; use for cross-harness work
7. `loop/coordination.md` — cross-harness discovery, host-global claims, and local lane board
8. `loop/contract.md` — acts alone / queues / wakes
9. `loop/memory/STATE.md` — current state
10. `loop/memory/AGENT_NOTES.md` — repository-local lane board
11. `codex_operating_manual.md` — full doctrine (reference; do not paste whole file into every turn)
12. `config/providers.md` — real CLI invocations for seats

## Runtime
- Deterministic gate: `loop/guardrails/verify.sh` (Windows: `loop/guardrails/verify.ps1`)
- Trust: `loop/memory/trust.tsv`
- Skills: `loop/skills/<name>/SKILL.md`
- Host-global coordination on Joel's workstation: `C:\Dev\agentnotes\PROTOCOL.md`

## Default operating mode
1. **Orchestrator (Sol Extra High):** plan in depth; emit work orders only.
2. **Executors (Luna Extra High):** 3–5 parallel max; one work order each; pin Luna — do not inherit Sol; every spawn has a wall-clock deadline.
3. **Verifier (fresh context):** judge spec + diff only.
4. **Gate:** `verify.sh` final vote before claiming done.
5. **Watchdog:** if an executor is silent/idle past deadline, pull partial output, kill it, reclaim the work — never multi-hour "holding for" teammates.

## Never
See `CODEX.md` NEVER block. Short form: no self-graded done, no unattended auth/billing/migrations/secrets, no dependency adds, no test deletion to pass, no Sol on quiet triage, no open-ended subagent waits.

## Sibling
Claude agents use `CLAUDE.md` + `claude_operating_manual.md`. Same `loop/` runtime.
Cross-provider orchestration (including Grok 4.5) uses `ROUTING.md` + skill `loop/skills/multi-model-dispatch/`.
