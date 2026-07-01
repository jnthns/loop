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
