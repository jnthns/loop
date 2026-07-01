#!/usr/bin/env bash
# verify.sh — the maker-checker gate.
#
# The maker is a generous grader of its own homework. This gate grades the work
# independently: (1) it re-runs the mechanical check, then (2) if a separate
# checker agent is configured, it invokes it (adversarial, trusts tests over the
# diff — see .claude/agents/checker.md / .codex/agents/checker.toml).
#
# Exit 0 = APPROVE. Non-zero = REJECT (the loop must not tick the task).
#
# Env:
#   CHECKER_CMD  command that runs the checker subagent, given a prompt as $1.
#                If unset, only the mechanical check runs (a weaker gate).
set -euo pipefail

cd "$(dirname "$0")/.."

echo "== verify: re-running the mechanical check =="
if ! scripts/check.sh; then
  echo "REJECT: mechanical check failed." >&2
  exit 1
fi

if [ -n "${CHECKER_CMD:-}" ]; then
  echo "== verify: invoking independent checker agent =="
  prompt="Act as the 'checker' subagent (see .claude/agents/checker.md). Independently \
verify the most recent change against specs/spec.md and specs/PLAN.md. Re-run \
scripts/check.sh yourself, confirm the diff matches the claimed task with no scope \
creep, confirm spec conformance and guardrails, and confirm specs/STATUS.md holds \
real evidence. Print APPROVE or REJECT with reasons, and exit non-zero on REJECT."
  if ! $CHECKER_CMD "$prompt"; then
    echo "REJECT: checker agent rejected the change." >&2
    exit 1
  fi
else
  echo "note: CHECKER_CMD not set — running without an independent agent checker."
  echo "      For unattended loops, configure a separate checker (ideally a"
  echo "      stronger model on higher reasoning effort) so the maker never"
  echo "      grades its own work. See docs/guardrails.md."
fi

echo "APPROVE"
