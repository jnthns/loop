#!/usr/bin/env bash
# progress.sh — where the build actually stands.
#
# Read-only. Prints per-phase progress from specs/PLAN.md, queue depth from
# specs/BACKLOG.md, and the last recorded pass plus sentinel state from
# specs/STATUS.md. Deliberately NOT part of scripts/check.sh: a progress report
# is information, not a gate, and a gate that moves is not a gate.
#
#   npm run progress
set -euo pipefail

cd "$(dirname "$0")/.."

PLAN=specs/PLAN.md
BACKLOG=specs/BACKLOG.md
STATUS=specs/STATUS.md

for f in "$PLAN" "$STATUS"; do
  [ -f "$f" ] || { echo "missing $f" >&2; exit 2; }
done

bar() {
  # bar <done> <total> — a 24-cell progress bar.
  local done=$1 total=$2 width=24 filled=0
  [ "$total" -gt 0 ] && filled=$(( done * width / total ))
  printf '['
  local i
  for ((i = 0; i < width; i++)); do
    if [ "$i" -lt "$filled" ]; then printf '#'; else printf '.'; fi
  done
  printf ']'
}

total_done=0
total_all=0

printf '\n== Plan (%s) ==\n\n' "$PLAN"

# Walk the plan once, tracking the current "## Phase" heading.
phase=""
p_done=0
p_total=0
next_task=""

flush_phase() {
  [ -z "$phase" ] && return 0
  [ "$p_total" -eq 0 ] && return 0
  printf '  %s %2d/%-2d  %s\n' "$(bar "$p_done" "$p_total")" "$p_done" "$p_total" "$phase"
  total_done=$(( total_done + p_done ))
  total_all=$(( total_all + p_total ))
}

while IFS= read -r line; do
  case "$line" in
    '## '*)
      flush_phase
      phase="${line###\# }"
      p_done=0
      p_total=0
      ;;
    '- [x] '*|'- [X] '*)
      p_total=$(( p_total + 1 ))
      p_done=$(( p_done + 1 ))
      ;;
    '- [ ] '*)
      p_total=$(( p_total + 1 ))
      if [ -z "$next_task" ]; then
        # Note: "${line#- [ ] }" would treat [ ] as a glob character class and
        # strip the wrong thing, so strip the marker explicitly.
        next_task="$(printf '%s' "$line" | sed 's/^- \[ \] //' | cut -c1-88)"
      fi
      ;;
  esac
done < "$PLAN"
flush_phase

percent=0
[ "$total_all" -gt 0 ] && percent=$(( total_done * 100 / total_all ))
printf '\n  TOTAL %s %d/%d (%d%%)\n' "$(bar "$total_done" "$total_all")" "$total_done" "$total_all" "$percent"

if [ -n "$next_task" ]; then
  printf '\n  Next: %s…\n' "$next_task"
else
  printf '\n  Next: nothing unchecked in the plan.\n'
fi

if [ -f "$BACKLOG" ]; then
  printf '\n== Backlog (%s) ==\n\n' "$BACKLOG"
  for p in P0 P1 P2 P3; do
    n=$(grep -c "^- \[$p\]" "$BACKLOG" || true)
    printf '  %s  %2d\n' "$p" "$n"
  done
  printf '\n'
  grep "^- \[P0\]" "$BACKLOG" 2>/dev/null | sed 's/^- \[P0\] /  P0: /' | cut -c1-96 || true
fi

printf '\n== Status (%s) ==\n\n' "$STATUS"
last_pass=$(grep '^### ' "$STATUS" | tail -n 1 | sed 's/^### //' || true)
printf '  Last pass : %s\n' "${last_pass:-none recorded}"

# The sentinel is kept commented out in the scaffold, so strip comments before
# looking for it — otherwise this would report a finished build from day one.
if sed 's/<!--.*-->//' "$STATUS" | grep -qx 'ALL TASKS DONE'; then
  printf '  Sentinel  : ALL TASKS DONE (build complete)\n'
else
  printf '  Sentinel  : not set (build in progress)\n'
fi

printf '\n'
