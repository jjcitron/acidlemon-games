# REVIEW-RUBRIC.md — adversarial plan & code review

Used by `ROUTING.md` plan-review and code-review seats.  
Reviewers produce `REVIEW.md` findings. Do not implement fixes in the review seat.

## Severity tags

| Tag | Meaning | Orchestrator duty |
|---|---|---|
| `blocker` | Ship/plan fails if unaddressed | Must fix or explicit human waive |
| `major` | Likely defect, missing acceptance, unsafe assumption | Must address in PLAN.v2 / code |
| `nit` | Taste, minor clarity, optional | Free wins only |
| `security` | Auth, secrets, injection, data leak, privilege | Treat as blocker unless proven none |

## Plan review checklist (vs PLAN.md / PLAN.v2.md)

Attack the plan. Prefer false negatives over polite agreement.

1. **Goal clarity** — Is the deliverable unambiguous? Who uses it?
2. **Acceptance criteria** — Machine-checkable? Can they fail closed?
3. **Missing edge cases** — empty inputs, partial failure, retries, timezone, pagination, concurrency
4. **Interface mismatches** — types, API contracts, event shapes, DB schema vs code
5. **Unstated assumptions** — env vars, feature flags, data already present, permissions
6. **Blast radius** — migrations, auth, billing, prod config, secrets (must not be unattended)
7. **Task DAG** — cycles? hidden dependencies? wrong parallelization?
8. **must_not completeness** — does each task fence off sibling lanes?
9. **Test strategy** — unit/integration/e2e? what proves done?
10. **Rollback / failure mode** — what if mid-dispatch failure?
11. **Budget / model fit** — frontier used where errors compound; cheap where not
12. **Self-failing tasks** — any task whose acceptance cannot be met by its own scope?

Output format for each finding:
```markdown
### [severity] <short title>
- where: <plan section / task id>
- evidence: <quote or concrete gap>
- impact: <what breaks>
- fix: <specific plan amendment>
```

## Code review checklist (vs PLAN.v2.md + diff)

1. Every acceptance criterion: met / unmet / untested
2. Behavioral regressions and missing tests
3. Security issues (injection, authz, secrets, path traversal)
4. Interface breaks vs stated signatures
5. Scope creep beyond handoff `must_not`
6. Error handling and partial-failure paths
7. Observability (logs/metrics) if plan required it
8. Performance footguns only when relevant to acceptance

Findings first, ordered by severity. Summaries last.

## Anti-patterns (reviewer must not)

- Rubber-stamping ("looks good" with no checklist evidence)
- Rewriting the implementation in the review pass
- Demanding style-only nits as blockers
- Asking the maker to self-grade as substitute for review
- Expanding scope beyond PLAN.v2 without flagging as plan defect
