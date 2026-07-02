#!/usr/bin/env bash
# budget.sh — spend accounting for the loop's third hard stop.
#
# The loop can't reliably read live token billing from every vendor, so we track
# an *estimated* spend on disk and halt when it crosses BUDGET_USD. Set
# COST_PER_ITERATION_USD to your rough per-pass cost, or have your agent write a
# real number into the ledger each pass via budget_add.
#
# Source this file; do not execute it.

: "${BUDGET_USD:=5}"                 # hard dollar ceiling for one loop run
: "${COST_PER_ITERATION_USD:=0.25}"  # rough per-pass estimate added each pass
: "${BUDGET_LEDGER:=memory/.budget}" # running total (git-ignored)

budget_reset() {
  mkdir -p "$(dirname "$BUDGET_LEDGER")"
  printf '0' >"$BUDGET_LEDGER"
}

budget_spent() {
  [ -f "$BUDGET_LEDGER" ] || printf '0'
  [ -f "$BUDGET_LEDGER" ] && cat "$BUDGET_LEDGER"
}

# budget_add <usd>  — add to the running total.
budget_add() {
  local add="${1:-0}" cur
  cur=$(budget_spent)
  awk -v a="$cur" -v b="$add" 'BEGIN { printf "%.4f", a + b }' >"$BUDGET_LEDGER"
}

# budget_exceeded — returns 0 (true) if spend >= BUDGET_USD.
budget_exceeded() {
  local cur
  cur=$(budget_spent)
  awk -v c="$cur" -v max="$BUDGET_USD" 'BEGIN { exit !(c + 0 >= max + 0) }'
}
