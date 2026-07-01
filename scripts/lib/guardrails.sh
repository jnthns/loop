#!/usr/bin/env bash
# guardrails.sh — safety helpers shared by the loop scripts.
# Source this file; do not execute it. See docs/guardrails.md.
#
# Agents must never read .env (see docs/guardrails.md). This script may be
# sourced by loop.sh after a human creates .env locally.

# guardrails_check_env — warn on obviously unsafe configuration.
guardrails_check_env() {
  if [ "${MAX_ITERATIONS:-0}" -le 0 ] 2>/dev/null; then
    echo "guardrail: MAX_ITERATIONS must be a positive integer" >&2
    return 1
  fi
}

# guardrails_protect_wip — refuse to start if there is uncommitted work, so the
# loop never silently overwrites a human's work in progress. Override with
# ALLOW_DIRTY=1 only when you know the tree should be dirty.
guardrails_protect_wip() {
  [ "${ALLOW_DIRTY:-0}" = "1" ] && return 0
  if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
    echo "guardrail: working tree is dirty. Commit/stash your work or set ALLOW_DIRTY=1." >&2
    return 1
  fi
}

# guardrails_scan_secrets <file...> — best-effort scan for obvious secret-looking
# strings before they are committed. Not a substitute for a real scanner.
guardrails_scan_secrets() {
  local hit=0 f
  local pattern='(api[_-]?key|secret|password|token|BEGIN (RSA|OPENSSH|EC|PGP) PRIVATE KEY|AKIA[0-9A-Z]{16})'
  for f in "$@"; do
    [ -f "$f" ] || continue
    if grep -Eiq "$pattern" "$f"; then
      echo "guardrail: possible secret in $f" >&2
      hit=1
    fi
  done
  return "$hit"
}

# guardrails_forbidden_cmd <string> — returns 0 (true) if a command string looks
# like a consequential action that must be gated behind a human.
guardrails_forbidden_cmd() {
  local cmd="$1"
  case "$cmd" in
    *"rm -rf /"* | *"git push --force"* | *"push -f"* | *"drop database"* | \
    *"DROP TABLE"* | *"kubectl delete"* | *"terraform destroy"* | *" deploy "* )
      return 0 ;;
  esac
  return 1
}

# guardrails_check_plan_consistency [status_file] [sentinel] [plan_file] — the
# maker once ticked every box in specs/PLAN.md in a commit that added no app
# code, and a prior handoff.md claimed the build was done as a result (see
# specs/STATUS.md Pass 2). This is the tripwire: the done-sentinel must never
# be trusted on its own — it can only mean success if every task in the plan
# is actually checked. Returns 0 if consistent (or if the sentinel is absent —
# nothing to check yet), 1 if the sentinel is present but the plan disagrees.
guardrails_check_plan_consistency() {
  local status_file="${1:-specs/STATUS.md}"
  local sentinel="${2:-ALL TASKS DONE}"
  local plan="${3:-specs/PLAN.md}"
  [ -f "$status_file" ] || return 0
  grep -q "^$sentinel" "$status_file" 2>/dev/null || return 0
  if [ ! -f "$plan" ]; then
    echo "guardrail: '$sentinel' present in $status_file but $plan is missing." >&2
    return 1
  fi
  if grep -q '^- \[ \]' "$plan"; then
    echo "guardrail: '$sentinel' found in $status_file but $plan still has" >&2
    echo "           unchecked tasks. The sentinel cannot be trusted on its own." >&2
    return 1
  fi
  return 0
}

# guardrails_check_plan_evidence [plan_file] — for every task checked
# `- [x]` in the plan, any backtick-quoted token that looks like a filename
# (has a dot extension) must exist on disk. Catches a task being ticked
# without the file it names ever being created — the exact failure mode in
# specs/STATUS.md Pass 2, where 20 tasks were ticked with no app source
# committed. Returns 0 if every referenced file exists, 1 otherwise.
guardrails_check_plan_evidence() {
  local plan="${1:-specs/PLAN.md}"
  [ -f "$plan" ] || return 0
  local missing=0 in_checked=0 line path rest match
  while IFS= read -r line; do
    case "$line" in
      '- [x]'*) in_checked=1 ;;
      '- ['*) in_checked=0 ;;
    esac
    [ "$in_checked" -eq 1 ] || continue
    rest="$line"
    while [[ "$rest" =~ \`([]A-Za-z0-9_./[-]+\.[A-Za-z0-9]+)\` ]]; do
      match="${BASH_REMATCH[0]}"
      path="${BASH_REMATCH[1]}"
      rest="${rest#*"$match"}"
      if [ ! -e "$path" ]; then
        echo "guardrail: $plan marks a task done but referenced file is missing: $path" >&2
        missing=1
      fi
    done
  done <"$plan"
  return "$missing"
}
