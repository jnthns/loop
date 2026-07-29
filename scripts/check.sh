#!/usr/bin/env bash
# check.sh — THE mechanical check. The single source of truth for "is the work
# good?" Lint + test + build, run identically here and in CI. Exit 0 = pass.
#
# It auto-detects the project stack so the loop is runnable from day one. On the
# empty scaffold (no project yet) it is a passing no-op with a clear notice.
# When you choose a stack (Phase 0 in specs/PLAN.md), replace the auto-detected
# commands below with the project's real lint/test/build.
#
# Rules (see skills/run-checks/SKILL.md):
#   - Never weaken this check to make a pass go green.
#   - Freeze it between passes so progress is comparable.
set -euo pipefail

cd "$(dirname "$0")/.."

log()  { printf '  %s\n' "$*"; }
step() { printf '\n== %s ==\n' "$*"; }

ran_something=0

run() {
  # run <label> <command...>
  local label="$1"; shift
  step "$label"
  log "\$ $*"
  "$@"
  ran_something=1
}

# --- Node / JS / TS ---------------------------------------------------------
if [ -f package.json ]; then
  step "Detected Node project"
  pm="npm"
  [ -f pnpm-lock.yaml ] && pm="pnpm"
  [ -f yarn.lock ] && pm="yarn"
  # Note: process.exit() rejects booleans on Node >= 22, so branch to a number.
  has_script() { node -e "process.exit((require('./package.json').scripts||{})['$1'] ? 0 : 1)" 2>/dev/null; }
  for s in lint typecheck test build; do
    if has_script "$s"; then run "$pm run $s" "$pm" run "$s"; fi
  done
fi

# --- Python -----------------------------------------------------------------
if [ -f pyproject.toml ] || [ -f requirements.txt ] || [ -f setup.py ]; then
  step "Detected Python project"
  command -v ruff  >/dev/null 2>&1 && run "ruff check" ruff check .
  command -v pytest >/dev/null 2>&1 && [ -d tests ] && run "pytest" pytest -q
fi

# --- Go ---------------------------------------------------------------------
if [ -f go.mod ]; then
  step "Detected Go project"
  run "go build" go build ./...
  run "go test"  go test ./...
fi

# --- Rust -------------------------------------------------------------------
if [ -f Cargo.toml ]; then
  step "Detected Rust project"
  run "cargo build" cargo build --quiet
  run "cargo test"  cargo test --quiet
fi

# --- Shell (this harness) ---------------------------------------------------
if ls scripts/*.sh >/dev/null 2>&1; then
  step "Shell syntax (harness scripts)"
  for f in scripts/*.sh scripts/lib/*.sh; do
    [ -f "$f" ] || continue
    log "bash -n $f"
    bash -n "$f"
  done
  ran_something=1
  if command -v shellcheck >/dev/null 2>&1; then
    step "shellcheck"
    # shellcheck disable=SC2086
    shellcheck scripts/*.sh scripts/lib/*.sh || true
  fi
fi

step "Result"
if [ "$ran_something" -eq 0 ]; then
  log "No project detected yet — nothing to check. This is expected on the empty"
  log "scaffold. Fill specs/spec.md, choose a stack, and wire real commands here."
fi
log "check.sh passed."
