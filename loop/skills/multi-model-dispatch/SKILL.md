---
name: multi-model-dispatch
description: Run the multi-provider plan → review → reconcile → dispatch → verify loop across Claude Code, Codex, and Grok 4.5 using ROUTING.md via real CLI shellouts (no MCP required).
when: Non-trivial feature work that should use adversarial plan review and/or multi-provider implementation lanes; user says review plan, reconcile, dispatch, review code, or rescue; or Hermes starts a coding ticket from a channel.
---

## Role

Orchestrate only. Package handoffs. Route to the right provider with **shellouts**. Enforce the gate.

**Default orchestrators (2026-07-14):**
- **In-repo coding:** Claude Code (`CLAUDE.md` + this skill + `ROUTING.md`)
- **Channels (WhatsApp/Telegram):** Hermes — write the same file artifacts, then shell the same CLIs

Do **not** require Codex MCP or a Grok-in-Claude plugin. Shell is the contract.

## Read first
1. `ROUTING.md`
2. `REVIEW-RUBRIC.md`
3. `CLAUDE.md` / `CODEX.md` / `GROK.md` (whichever harness you are in)
4. `loop/contract.md`
5. `loop/memory/STATE.md`
6. `config/providers.md` (if present) or kit `config/providers.md`

## Prerequisites (host)
```sh
command -v claude >/dev/null  # optional for Hermes-led runs
command -v codex  >/dev/null
command -v grok   >/dev/null
```

## Steps

### 1. Scope
- Write/confirm `PLAN.md` from `loop/routing/PLAN.template.md` (or project equivalent under `loop/runs/<id>/`).
- Triviality gate: one file / <10 lines / no search → skip multi-provider; do it + verify + two sentences.

### 2. Review plan (`"review plan"`)
Primary (Codex):
```sh
codex review -c model="gpt-5.5" -c model_reasoning_effort="xhigh" \
  "Adversarial plan review against REVIEW-RUBRIC.md. Read PLAN.md. Output findings only: blocker/major/nit with evidence. Write or overwrite REVIEW.md."
```
Optional second opinion (Grok):
```sh
grok -m grok-4.5 "Adversarial plan review. Read PLAN.md and REVIEW-RUBRIC.md. Attack missing edge cases, interface mismatches, unstated assumptions, acceptance criteria that cannot fail closed. Write findings suitable to merge into REVIEW.md."
```
Merge into `REVIEW.md` with severity tags: `blocker` / `major` / `nit` / `security`.

Log:
```text
# append to loop/memory/dispatch.tsv
# ts	run_id	seat	provider	model	artifact	status
```

### 3. Reconcile (`"reconcile"`)
- Address every `blocker` and `major` → `PLAN.v2.md`.
- Max **2** plan-review round-trips; then wake human.

### 4. Dispatch (`"dispatch"`)
For each DAG task:
1. `git worktree add` (or `grok --worktree=`) per lane.
2. Fill **all five** handoff fields from `loop/routing/HANDOFF.template.md`.
3. Route by seat:
   - careful / user-facing → Claude Code (impl-careful)
   - bulk / parallel → `codex exec -m gpt-5.4 ...`
   - rescue → different provider than failed seat
4. Set deadline (default 15m implement / 10m explore / 20m fan-out wall).

Codex impl example:
```sh
git worktree add ../wt-T1 -b loop/T1
codex exec -m gpt-5.4 -c model_reasoning_effort="high" -C ../wt-T1 \
  "$(cat loop/runs/<id>/handoff-T1.md)"
```

Grok impl example:
```sh
grok -m grok-4.5 --worktree=impl-T2 -p "$(cat loop/runs/<id>/handoff-T2.md)"
```

### 5. Collect
On timeout: pull partial output, kill or cut loose, reclaim. Log `delegate_timeout`.

### 6. Review code (`"review code"`)
```sh
codex review --uncommitted -c model="gpt-5.4" -c model_reasoning_effort="high" \
  "Review the diff against every acceptance criterion in PLAN.v2.md. Findings first, severity ordered."
```
Optional:
```sh
grok -m grok-4.5 "Final code review vs PLAN.v2.md acceptance criteria. Prefer concrete bugs/risks over style."
```

### 7. Gate
```sh
sh loop/guardrails/verify.sh
# or
pwsh -File loop/guardrails/verify.ps1
```
Exit 0 required before "done".

### 8. Log + state
- `loop/memory/dispatch.tsv` — seats used
- `loop/memory/usage.log` — model per seat + estimated cost if known
- `loop/memory/STATE.md` — run id, outcomes, next

## Hermes channel recipe
When the user messages on WhatsApp/Telegram:
1. Confirm repo path (default dogfood: `C:\Dev\aimg\aimg-sales-agent-app` only if already in context).
2. Write artifacts under that repo's `loop/runs/<id>/` and root `PLAN.md` when appropriate.
3. Shell the same `codex` / `grok` / `verify` commands from this skill.
4. Reply with paths + verify exit code — not "looks good".

## Tools allowed
- Read/write plan/review/handoff artifacts
- `git worktree`
- `codex`, `codex exec`, `codex review`
- `grok` (default `grok-4.5`)
- verify scripts
- fable-judge after substantive claims (optional)

## Never
- Never implement product code in the orchestrator seat by default
- Never dispatch without all five handoff fields
- Never burn frontier models on quiet triage
- Never claim done without verify gate
- Never third identical-tier retry without new info
- Never require MCP for cross-vendor dispatch (skill-only shellouts are the contract)

## Done when
- Host-global job/file claims and repository-local lane messages were handled per `loop/coordination.md`.
- PLAN.v2 acceptance criteria checked
- code-review blockers cleared or human-waived
- verify gate exits 0
- STATE.md updated with run id + outcomes
