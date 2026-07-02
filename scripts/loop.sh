#!/usr/bin/env bash
# loop.sh — the Ralph-style runner.
#
# Each iteration is a FRESH agent with an empty context that reads the current
# repo state (specs/, memory/) from disk, does one bounded unit of work, is
# graded by verify.sh, and exits. The loop continues until the build is done or
# one of the three hard stops fires.
#
#   1. Max iterations       (MAX_ITERATIONS)
#   2. No-progress detection (MAX_NO_PROGRESS) — no new commit for N passes
#   3. Budget               (BUDGET_USD)       — estimated spend ceiling
#
# Usage:
#   scripts/loop.sh                 # runs loops/build.md with configured AGENT_CMD
#   LOOP_FILE=loops/housekeeper.md scripts/loop.sh
#   LOOP_FILE=loops/triage.md scripts/loop.sh
#   AGENT_CMD=echo MAX_ITERATIONS=1 scripts/loop.sh   # dry run with a mock agent
#
# Config (env or .env): AGENT_CMD, LOOP_FILE, INTAKE_FILE, MAX_ITERATIONS,
#   MAX_NO_PROGRESS, BUDGET_USD, COST_PER_ITERATION_USD, STATUS_FILE,
#   DONE_SENTINEL, BACKLOG_FILE, ALLOW_DIRTY.
set -euo pipefail

cd "$(dirname "$0")/.."

# --- Load optional .env (never commit it) -----------------------------------
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

# shellcheck source=scripts/lib/budget.sh
. scripts/lib/budget.sh
# shellcheck source=scripts/lib/guardrails.sh
. scripts/lib/guardrails.sh

# --- Defaults ----------------------------------------------------------------
: "${LOOP_FILE:=loops/build.md}"
: "${INTAKE_FILE:=loops/intake.md}"
: "${STATUS_FILE:=specs/STATUS.md}"
: "${BACKLOG_FILE:=specs/BACKLOG.md}"
: "${DONE_SENTINEL:=ALL TASKS DONE}"
: "${MAX_ITERATIONS:=25}"
: "${MAX_NO_PROGRESS:=3}"
# AGENT_CMD: the coding-agent CLI invoked with the loop prompt as a single arg.
# If unset, we probe common CLIs; fall back to `echo` (a safe no-op dry run).
if [ -z "${AGENT_CMD:-}" ]; then
  for c in cursor-agent claude codex; do
    if command -v "$c" >/dev/null 2>&1; then AGENT_CMD="$c"; break; fi
  done
  : "${AGENT_CMD:=echo}"
fi

log() { printf '[loop] %s\n' "$*"; }

# --- Preflight ---------------------------------------------------------------
guardrails_check_env || exit 2
guardrails_protect_wip || exit 2
[ -f "$LOOP_FILE" ] || { log "loop file not found: $LOOP_FILE"; exit 2; }
[ -f "$STATUS_FILE" ] || { log "status file not found: $STATUS_FILE"; exit 2; }

budget_reset

log "agent      : $AGENT_CMD"
log "loop file  : $LOOP_FILE"
log "stops      : max_iter=$MAX_ITERATIONS  no_progress=$MAX_NO_PROGRESS  budget=\$$BUDGET_USD"
[ "$AGENT_CMD" = "echo" ] && log "NOTE: AGENT_CMD=echo — this is a DRY RUN (no real work performed)."

prompt="$(cat "$LOOP_FILE")"
iteration=0
noprogress=0
reason="unknown"

is_done() { grep -q "^$DONE_SENTINEL" "$STATUS_FILE"; }

# True when BACKLOG.md lists at least one goal with Status: queued.
has_queued_goal() {
  [ -f "$BACKLOG_FILE" ] && grep -qiE '\*\*Status:\*\*[[:space:]]*queued' "$BACKLOG_FILE"
}

head_sha() { git rev-parse HEAD 2>/dev/null || echo "no-git"; }

# Push approved commits only (called after verify APPROVE).
maybe_push_approved() {
  if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    return 0
  fi
  local unpushed=""
  if git rev-parse '@{u}' >/dev/null 2>&1; then
    unpushed="$(git log '@{u}..HEAD' --oneline 2>/dev/null || true)"
  elif git rev-parse origin/main >/dev/null 2>&1; then
    unpushed="$(git log origin/main..HEAD --oneline 2>/dev/null || true)"
  elif git rev-parse origin/HEAD >/dev/null 2>&1; then
    local default_branch
    default_branch="$(git symbolic-ref --short origin/HEAD 2>/dev/null | sed 's|^origin/||')"
    if [ -n "$default_branch" ]; then
      unpushed="$(git log "origin/$default_branch..HEAD" --oneline 2>/dev/null || true)"
    fi
  fi
  if [ -n "$unpushed" ]; then
    log "pushing approved commits to remote"
    git push
  fi
}

run_agent_pass() {
  local pass_prompt="$1"
  set +e
  $AGENT_CMD "$pass_prompt"
  local agent_status=$?
  set -e
  [ "$agent_status" -ne 0 ] && log "agent exited non-zero ($agent_status)"
}

# --- The loop ----------------------------------------------------------------
while true; do
  if is_done; then
    if has_queued_goal; then
      log "done sentinel found — backlog has queued goals; running intake"
      [ -f "$INTAKE_FILE" ] || { log "intake file not found: $INTAKE_FILE"; exit 2; }
      iteration=$((iteration + 1))
      if [ "$iteration" -gt "$MAX_ITERATIONS" ]; then
        reason="stop: reached MAX_ITERATIONS ($MAX_ITERATIONS) during intake"; break
      fi
      if budget_exceeded; then
        reason="stop: budget exceeded (\$$(budget_spent) >= \$$BUDGET_USD)"; break
      fi
      log "---- intake pass $iteration/$MAX_ITERATIONS ----"
      before="$(head_sha)"
      run_agent_pass "$(cat "$INTAKE_FILE")"
      if scripts/verify.sh; then
        log "verify: APPROVE (intake)"
        maybe_push_approved
      else
        log "verify: REJECT (intake pass not accepted)"
      fi
      [ "$(printf '%.0f' "${COST_PER_ITERATION_USD:-0}" 2>/dev/null || echo 0)" != "0" ] && \
        budget_add "$COST_PER_ITERATION_USD"
      after="$(head_sha)"
      if [ "$before" = "$after" ]; then
        noprogress=$((noprogress + 1))
        log "no new commit this pass (idle $noprogress/$MAX_NO_PROGRESS)"
      else
        noprogress=0
      fi
      if [ "$noprogress" -ge "$MAX_NO_PROGRESS" ]; then
        reason="stop: no progress for $MAX_NO_PROGRESS consecutive passes"; break
      fi
      continue
    fi
    reason="success: '$DONE_SENTINEL' found in $STATUS_FILE (backlog empty)"; break
  fi

  iteration=$((iteration + 1))
  if [ "$iteration" -gt "$MAX_ITERATIONS" ]; then
    reason="stop: reached MAX_ITERATIONS ($MAX_ITERATIONS)"; break
  fi
  if budget_exceeded; then
    reason="stop: budget exceeded (\$$(budget_spent) >= \$$BUDGET_USD)"; break
  fi

  log "---- pass $iteration/$MAX_ITERATIONS  (spent \$$(budget_spent), idle $noprogress/$MAX_NO_PROGRESS) ----"
  before="$(head_sha)"

  # One fresh agent, one bounded pass. The prompt tells it to read state from
  # disk, do one task, run the check, hand off, commit locally, and exit.
  run_agent_pass "$prompt"

  # Maker-checker gate: an independent verify decides if the pass counts.
  if scripts/verify.sh; then
    log "verify: APPROVE"
    maybe_push_approved
  else
    log "verify: REJECT (pass not accepted — commit stays local)"
  fi

  # Budget accounting (estimate unless the agent wrote a real number).
  [ "$(printf '%.0f' "${COST_PER_ITERATION_USD:-0}" 2>/dev/null || echo 0)" != "0" ] && \
    budget_add "$COST_PER_ITERATION_USD"

  # No-progress detection: a pass that produced no new commit is idle.
  after="$(head_sha)"
  if [ "$before" = "$after" ]; then
    noprogress=$((noprogress + 1))
    log "no new commit this pass (idle $noprogress/$MAX_NO_PROGRESS)"
  else
    noprogress=0
  fi
  if [ "$noprogress" -ge "$MAX_NO_PROGRESS" ]; then
    reason="stop: no progress for $MAX_NO_PROGRESS consecutive passes"; break
  fi
done

# --- Report ------------------------------------------------------------------
log "=============================================="
log "$reason"
log "passes run : $iteration"
log "est. spend : \$$(budget_spent)"
log "handoff    : memory/handoff.md"
log "=============================================="

case "$reason" in
  success:*) exit 0 ;;
  *)         exit 1 ;;
esac
