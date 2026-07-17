$ErrorActionPreference = "Stop"

# Windows mirror of verify.sh. Replace or extend with project-specific checks.

# A gate that cannot check must fail loudly, not pass silently.
if (-not (Get-Command rg -ErrorAction SilentlyContinue)) {
    Write-Output "verify failed: ripgrep (rg) not installed; gate cannot run its checks"
    exit 4
}

$markerHits = @(rg -n "TODO_VERIFY_FAIL" . -g '!loop/guardrails/verify.*' 2>$null)

if ($markerHits.Count -gt 0) {
    Write-Output "verify failed: TODO_VERIFY_FAIL marker present"
    exit 4
}

Write-Output "verify passed: no project-specific checks configured"
exit 0
