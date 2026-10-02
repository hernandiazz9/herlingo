#!/usr/bin/env bash
# Guarded push for the hybrid skill (bash 3.2+, Mac and cloud).
# Usage: guarded_push.sh plans/NNN-slug.md
#
# Pushes HEAD to origin/<current branch> only when that branch is the plan's Base branch and
# is not main, master or the remote's default branch. Never forces, never pushes tags.
# After the push it checks the Now block's "- Previous: <branch> @ <sha>" line: if that
# frozen branch moved, another session may still be writing.
# Exit: 0 pushed · 2 refused, nothing pushed · 3 pushed, but Previous moved (stop, ask Hernán)
#       · 4 push failed (a rejection means someone else wrote to this branch; never force).
set -u
plan=${1:?usage: guarded_push.sh PLAN.md}
b=$(git branch --show-current)
base=$(awk '/^Base branch:/{gsub("`","",$3); print $3; exit}' "$plan")
def=$(git ls-remote --symref origin HEAD 2>/dev/null | awk '/^ref:/{sub("refs/heads/","",$2); print $2; exit}')

case "$b" in
  "" | main | master)
    echo "REFUSED: on '${b:-detached HEAD}' (main/master/detached); nothing pushed. A plan based on main keeps its lock local until a handoff moves it to a work branch."
    exit 2 ;;
esac
if [ -n "$def" ] && [ "$b" = "$def" ]; then
  echo "REFUSED: '$b' is the repo's default branch; nothing pushed."
  exit 2
fi
if [ "$b" != "$base" ]; then
  echo "REFUSED: on '$b' but the plan's Base branch is '$base'; nothing pushed. Fix the header (plan_update.py --header) or switch branches."
  exit 2
fi

if out=$(git push -u origin HEAD 2>&1); then
  echo "pushed $b @ $(git rev-parse --short HEAD)"
else
  echo "$out" | tail -4
  echo "PUSH FAILED on $b. If rejected, someone else wrote to it: never force (cloud-loop.md, Rejected push)."
  exit 4
fi

prev=$(sed -n 's/^- Previous:[[:space:]]*\([^[:space:]]*\)[[:space:]]*@[[:space:]]*\([0-9a-f]\{7,\}\).*/\1 \2/p' "$plan" | head -1)
if [ -n "$prev" ]; then
  pb=${prev% *}
  ps=${prev#* }
  cur=$(git ls-remote origin "refs/heads/$pb" 2>/dev/null | cut -c1-${#ps})
  if [ -n "$cur" ] && [ "$cur" != "$ps" ]; then
    echo "WARNING: Previous branch $pb moved ($ps → $cur): another session may still be writing. Stop writing and ask Hernán (handoff.md G)."
    exit 3
  fi
fi
exit 0
