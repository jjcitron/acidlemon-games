# ROUTING.md — multi-model multi-provider dispatch

**Status:** Active  
**Created:** 2026-07-10  
**Source pattern:** https://x.com/i/status/2075537516011130882 (Av1dlive)  
**Local capture:** `reference/post_2075537516011130882.md`  
**Siblings:** `CLAUDE.md`, `CODEX.md`, `AGENTS.md`, `loop/`, `REVIEW-RUBRIC.md`, `config/providers.md`

You are the **orchestrator**. You plan, dispatch, reconcile, and judge.  
You do **not** implement product code in the orchestrator seat unless the user explicitly overrides this file.

Every non-trivial coding task goes through this file. If a task does not match a dispatch row, ask before routing.

This file is **process law**. Model names are **dated config** (see seat map). Update the seat map when the lineup changes; do not rewrite the process.

---

## 0. Provider mesh (what is actually installed)

| Provider / harness | Role in the mesh | How to invoke (this machine) |
|---|---|---|
| **Claude Code** | Primary orchestrator + careful implementer | Claude Code session (`CLAUDE.md`) |
| **OpenAI Codex CLI** | Plan review, code review, Luna-style executors, rescue | `codex`, `codex exec`, `codex review` (`CODEX.md`) |
| **Grok CLI** | Adversarial planning, research, unconventional rescue, parallel best-of | `grok -m grok-4.5` (default) |
| **Hermes** | Cross-channel ops, multi-tool orchestration, Grok 4.5 sessions | Hermes agent (this profile can run Grok 4.5) |
| **Loop runtime** | Memory, trust, deterministic gate | `loop/guardrails/verify.sh` or `verify.ps1` |

Codex does **not** natively host Grok models. Grok is a **peer provider** via Grok CLI / Hermes, not a Codex `model=` slug.

---

## 1. Seat map (dated 2026-07-10 — update when models change)

| Seat alias | Job | Default model | Effort | Provider |
|---|---|---|---|---|
| `orch` | Plan, DAG, reconcile, judge | Claude Fable 5 / Opus (session model) | high / adaptive | Claude Code |
| `plan-review` | Adversarial plan review | `gpt-5.5` | `xhigh` | Codex |
| `plan-review-alt` | Second opinion / unconventional plan attack | `grok-4.5` | high | Grok CLI |
| `impl-careful` | Spec-complete careful implementation | Claude Opus / Sonnet | high | Claude Code |
| `impl-bulk` | Narrow work orders, parallel lanes | `gpt-5.4` | high | Codex |
| `impl-fast` | Trivial / mechanical | `gpt-5.4-mini` | medium | Codex |
| `code-review` | Diff vs PLAN.v2 acceptance | `gpt-5.4` or `codex-auto-review` | high | Codex |
| `code-review-alt` | Edge-case / reality check review | `grok-4.5` | high | Grok CLI |
| `rescue` | Stuck task, smallest safe patch | `gpt-5.5` or `grok-4.5` | high / xhigh | Codex or Grok |
| `triage` | Quiet ticks, log skim | `gpt-5.4-mini` / Haiku | medium / low | Codex / Claude |
| `gate` | Final vote | shell | n/a | `loop/guardrails/verify.*` |

**Asymmetry is deliberate:** plan errors compound → frontier plan-review. Code errors often surface in tests → mid-tier code-review is acceptable. Always keep `gate` deterministic.

---

## 2. Trigger phrases → actions

When the user says any of these (or close variant), execute without re-asking for permission to route:

### "review plan" / "review the plan" / "adversarial plan review"
1. Require `PLAN.md` (or active plan path) + `REVIEW-RUBRIC.md`.
2. Run **Codex plan-review** (primary):
   ```sh
   codex review -c model="gpt-5.5" -c model_reasoning_effort="xhigh" \
     "Adversarial plan review against REVIEW-RUBRIC.md. Read PLAN.md. Output REVIEW.md findings only: blocker/major/nit with evidence."
   ```
3. Optional second opinion (recommended for high blast radius):
   ```sh
   grok -m grok-4.5 "Adversarial plan review. Read PLAN.md and REVIEW-RUBRIC.md. Attack missing edge cases, interface mismatches, unstated assumptions, acceptance criteria that can't fail closed. Write findings suitable to merge into REVIEW.md."
   ```
4. Write/merge `REVIEW.md` with severity tags: `blocker` / `major` / `nit` / `security`.

### "reconcile" / "fix the plan" / "address review"
1. Read `REVIEW.md`.
2. Address every `blocker` and `major` (accept, rebut with evidence, or amend plan).
3. Write `PLAN.v2.md`.
4. Ignore nits unless free.
5. Max **2** plan-review round-trips total. After that, wake the human.

### "dispatch" / "implement the plan" / "execute the plan"
1. Require `PLAN.v2.md` (or reconciled plan).
2. Split the task DAG by task class (dispatch table).
3. One **git worktree per lane** (or Grok `--worktree=` / Codex worktree policy).
4. Package each task as a **handoff packet** (section 4). If any of the five fields is missing → fix plan, do not dispatch.
5. Route each packet to its seat. Log seats in `loop/memory/dispatch.tsv` + model in `loop/memory/usage.log`.

### "review code" / "final review" / "ship review"
```sh
codex review --uncommitted -c model="gpt-5.4" -c model_reasoning_effort="high" \
  "Review the diff against every acceptance criterion in PLAN.v2.md. Findings first, severity ordered."
```
Optional Grok pass for "does this actually make sense in production":
```sh
grok -m grok-4.5 "Final code review vs PLAN.v2.md acceptance criteria. Prefer concrete bugs/risks over style."
```

### "rescue" / "it's stuck" / "unstick"
- Prefer **fresh provider** relative to the failed seat (Claude failed → Codex/Grok; Codex failed → Grok/Claude).
- Include failure log + smallest-safe-patch constraint.
```sh
# Codex rescue
codex exec -c model="gpt-5.5" -c model_reasoning_effort="xhigh" "RESCUE: <task>. Failure log: <path>. Smallest safe patch. Do not expand scope."

# Grok rescue (great at breaking local maxima)
grok -m grok-4.5 "RESCUE: <task>. Failure log: <path>. Smallest safe patch only."
```

### "handoff" / "transfer"
- Persist state to `loop/memory/STATE.md` + plan/review artifacts.
- Give the human the resume command for the target harness (`codex resume`, `grok -c`, Claude continue).

### "status"
- Summarize each background lane in one line: seat, model, deadline, state, artifact path.

---

## 3. Dispatch table

| Task class | Seat | Default invocation | Lane name |
|---|---|---|---|
| Planning, architecture, task DAG | `orch` | Claude Code plan mode; write `PLAN.md` | plan |
| Plan review | `plan-review` (+ optional `plan-review-alt`) | Codex `gpt-5.5` xhigh; optional Grok 4.5 | plan-review |
| Implementation (careful / user-facing) | `impl-careful` | Claude Opus/Sonnet per handoff | impl |
| Implementation (bulk / parallel) | `impl-bulk` | `codex exec -m gpt-5.4` per worktree | impl |
| Mechanical / tests-only | `impl-fast` | `codex exec -m gpt-5.4-mini` | impl |
| Code review | `code-review` (+ optional alt) | `codex review` gpt-5.4 high; optional Grok | code-review |
| Stuck recovery | `rescue` | Codex gpt-5.5 xhigh **or** Grok 4.5 | rescue |
| Quiet triage | `triage` | mini/Haiku — never frontier | triage |
| Final gate | `gate` | `sh loop/guardrails/verify.sh` | gate |

**Ambiguous spec → do not route.** Flag it and amend the plan first.

---

## 4. Handoff packet (mandatory, self-contained)

Receiving models have **zero** memory of the orchestrator chat. Every packet needs:

1. **Task** — verbatim from `PLAN.v2.md`
2. **Acceptance criteria** — inline, checkable
3. **Paths + interface signatures** — what to touch / conform to
4. **must_not** — files, layers, behaviors off-limits
5. **Test / validation command** — exact command the worker runs

Template: `loop/routing/HANDOFF.template.md`

Also set:
- `deadline` (default 10m explore / 15m implement / 20m fan-out wall) — see watchdog law
- `seat` + `model` + `provider`
- `worktree` path/branch

If you cannot fill all five core fields, the plan is underspecified — fix the plan.

---

## 5. Escalation ladder

1. Worker fails acceptance once → same seat, tighter packet, new deadline.
2. Fails twice → **rescue** on a different provider with failure log.
3. Rescue fails → back to `orch` for replan (not a third blind retry).
4. Maker and checker disagree twice → **stop and wake the human**.

Never retry a third time at the same tier without new information.

---

## 6. Worktree / isolation rules

Before shared edits, follow `loop/coordination.md`: use the host-global protocol for job/file ownership, then `loop/memory/AGENT_NOTES.md` for temporary repository-lane detail. Clear both layers when finished.

- One worktree (or equivalent isolation) per lane.
- No cross-lane file touching.
- Merge only after code-review findings are addressed or explicitly waived by human.
- Prefer:
  - `git worktree add ../wt-<lane> -b loop/<lane>`
  - `grok --worktree=<name> ...`
  - Codex `-C <worktree-path>` / project cwd

---

## 7. Hard rules

1. Nothing gets implemented that is not in `PLAN.v2.md` (or explicitly human-scoped one-shot).
2. Orchestrator seat does not write implementation code by default.
3. Max 2 plan-review round-trips; then human decides remaining disagreements.
4. Heavy reviews should not block the main loop forever — use background/exec patterns and poll with deadlines.
5. Log model per seat (`loop/memory/usage.log`). Burning frontier models on quiet triage is a budget bug.
6. `loop/guardrails/verify.sh` (or `.ps1`) has the **final vote** before "done".
7. Subagent watchdog applies to every lane (pull / kill / reclaim on deadline).
8. Never invent secrets, endpoints, or dependencies — queue or ask.
9. Never delete or weaken tests to pass a gate.
10. After provider lineup changes, update **only** the seat map + `config/` — keep triggers and hard rules stable.

---

## 8. Grok 4.5 — how it fits (explicit)

Grok 4.5 is first-class in this mesh:

| Use Grok 4.5 when | Why |
|---|---|
| Adversarial plan attack | Different prior than Claude/OpenAI; good at "what fails in reality" |
| Research / current external context | Native strengths; X/web when needed |
| Rescue after Claude or Codex local-maximum | Fresh provider perspective |
| Parallel best-of (`grok --best-of-n`) | Headless multi-attempt selection |
| Hermes multi-tool orchestration | Already available as Grok-backed agent |

Do **not** force Grok into Codex as a fake model slug. Dispatch with `grok` CLI or Hermes.

```sh
# Plan attack
grok -m grok-4.5 -w plan-attack "Read PLAN.md + REVIEW-RUBRIC.md; produce REVIEW findings."

# Implement in isolated worktree
grok -m grok-4.5 --worktree=impl-auth -p "$(cat loop/runs/<id>/handoff-auth.md)"

# Fast secondary model when available
grok -m grok-composer-2.5-fast "Mechanical renames only per handoff."
```

---

## 9. Minimal happy path

```text
human goal
  -> orch writes PLAN.md
  -> "review plan" (Codex gpt-5.5 xhigh [+ optional Grok])
  -> REVIEW.md
  -> "reconcile" -> PLAN.v2.md
  -> "dispatch" (worktrees + handoffs)
  -> impl seats execute
  -> "review code"
  -> loop/guardrails/verify.sh
  -> done (or rescue / replan)
```

Artifacts live under the repo (recommended):
```text
PLAN.md
PLAN.v2.md
REVIEW.md
loop/routing/          # templates
loop/runs/<run_id>/    # handoffs, status, verify logs
```

---

## 10. Relationship to existing doctrine

| Existing file | Still governs |
|---|---|
| `CLAUDE.md` / `claude_operating_manual.md` | Claude-local laws, budgets, words |
| `CODEX.md` / `codex_operating_manual.md` | Codex-local laws, Sol/Luna pattern |
| `loop/contract.md` | acts alone / queues / wakes |
| `loop/guardrails/verify.*` | final gate |
| **This file** | **cross-provider routing when multiple harnesses collaborate** |

If ROUTING.md conflicts with a constitution NEVER block, the NEVER block wins.
