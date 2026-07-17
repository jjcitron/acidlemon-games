#!/usr/bin/env sh
# Multi-vendor mesh preflight — fail closed if peer CLIs missing.
set -eu

missing=0

if ! command -v codex >/dev/null 2>&1; then
  echo "preflight FAIL: codex not on PATH (install OpenAI Codex CLI)"
  missing=1
else
  echo "preflight OK: codex -> $(command -v codex)"
fi

if ! command -v grok >/dev/null 2>&1; then
  echo "preflight FAIL: grok not on PATH (install Grok Build CLI)"
  missing=1
else
  echo "preflight OK: grok -> $(command -v grok)"
fi

if command -v claude >/dev/null 2>&1; then
  echo "preflight OK: claude -> $(command -v claude) (optional)"
else
  echo "preflight WARN: claude not on PATH (optional for Hermes-only channel orch)"
fi

if [ "$missing" -ne 0 ]; then
  echo "preflight FAILED: install missing CLIs before multi-model-dispatch"
  exit 1
fi

echo "preflight PASSED: codex + grok available (skill-only shellouts ready)"
exit 0
