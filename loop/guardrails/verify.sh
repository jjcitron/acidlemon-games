#!/usr/bin/env sh
set -eu

# Replace or extend this file with project-specific checks (tests, lint, typecheck).
# The gate ships minimal; configure it before scheduling any autonomous loop.

# A gate that cannot check must fail loudly, not pass silently.
if ! command -v rg >/dev/null 2>&1; then
  echo "verify failed: ripgrep (rg) not installed; gate cannot run its checks"
  exit 4
fi

if rg -n "TODO_VERIFY_FAIL" . -g '!loop/guardrails/verify.*' >/dev/null 2>&1; then
  echo "verify failed: TODO_VERIFY_FAIL marker present"
  exit 4
fi

echo "verify passed: no project-specific checks configured"
exit 0
