# Cloud loop (and the PC without the orchestrator)

Everything a writer needs to run tasks: prompt, integration, bookkeeping, push, liveness. On the
PC with the orchestrator skill installed, that skill does launching and integration; the
bookkeeping, push and liveness parts still apply. `$S` = the skill folder printed by
plan_status.py; `$PLAN` = the plan path.

## Prerequisites (once per repo; plan_status.py prints a `prereqs` line)

1. `.claude/settings.json` has `{"worktree": {"baseRef": "head"}}`. The default `fresh`
   branches agent worktrees from the default branch, so agents would miss the plan's work. The
   prompt's base check covers the gap, so this doesn't block.
2. `.gitignore` covers `.claude/worktrees/` and `.env*` (with `!.env.example`): otherwise the
   cloud stop hook blocks on untracked files and secrets risk a commit.
3. Lint, typecheck and test configs exclude `.claude/` (eslint ignores, tsconfig `exclude`,
   jest/vitest ignore patterns): agent worktrees live inside the main checkout with their own
   dependencies, and the integration test run would scan them.
4. The project's CLAUDE.md has the line
   `Multi-task plans in plans/ follow the hybrid skill: on resume read the plan's ## Now block first.`
   (backup trigger for short messages and for sessions without the skill).
5. Optional: a SessionStart hook gated with `[ "$CLAUDE_CODE_REMOTE" = true ] || exit 0` that
   installs dependencies (the session-start-hook skill writes one); a committed PreToolUse guard
   that blocks `git push` to main (user-level hooks never reach the cloud).

Propose what is missing in one line; commit it as `orchestrator: hybrid setup` after Hernán's OK
(or with plan approval). Keep working meanwhile.

## Pick

Runnable = `ready` in plan_status.py: pending, deps done, `Where` not `pc` in the cloud, every
`Needs` key present. Launch up to 2 minus those running (1 on a rate-limit warning). Prefer the
critical path (most dependants); never two with overlapping may-touch paths. Fix tasks are
ordinary tasks.

## Launch

On a clean tree after the last integration: `BASE=$(git rev-parse --short HEAD)`. Take the line
ranges from `ready` (task) and `contract`. Agent tool with `isolation: "worktree"`,
`run_in_background: true`, one task each:

```text
You are a task agent. Do not invoke the hybrid or orchestrator skills, do not call any mcp__claude-code-remote__* tool, do not rename sessions, never edit plans/, never push, never change git config, never create or switch branches.
Task <Tnn> of plans/<NNN-slug>.md, in your own git worktree.
1. Base: `git merge-base --is-ancestor <BASE> HEAD || git reset --hard <BASE>` (fresh worktree, nothing to lose).
2. Setup: <Worktree setup>.
3. With the Read tool, read only lines <a>–<b> (Shared contract) and <c>–<d> (your task) of that plan. CLAUDE.md is already in your context: follow it.
4. Stay inside Scope. Commit on your current branch at each milestone ("WIP <Tnn>: …"; they get squashed). When the Done-when items hold and `<Test command>` exits 0, commit "<Tnn>: <title>".
5. Done-when items that need human eyes, a real device or real keys (visual checks, themes, widths, live API calls): do the headless part, list them under "could not check", don't claim them, still commit.
6. Missing key, unreachable host or unclear product decision: don't guess; commit what you have and reply blocked. Past ~30 minutes: commit and reply partial with what remains.
Final reply, ≤15 lines: STATUS: done|partial|blocked · commit sha · files touched (count + top dirs) · could not check · out-of-scope findings as one-liners.
```

Record the launch with the full agent id the Agent tool returns (SendMessage and the branch
`worktree-agent-<id>` need it), together with any integration of the same cycle:

```bash
python3 "$S/scripts/plan_update.py" "$PLAN" --task T14 \
  --status "running (attempt 1 · ☁️ session_01AbC · agent a7049cdf0c9035731 · since $(date -u +%H:%MZ))" \
  --log "T14 launched · attempt 1 · agent a7049cdf0c9035731"
git add "$PLAN" && git commit -qm "plan 007: T14 launched" && "$S/scripts/guarded_push.sh" "$PLAN"
```

On the PC write `💻` instead of `☁️ session_…`.

Optional (verify; it creates a Routine Hernán can see): after launching a batch while he is
away, `mcp__claude-code-remote__send_later` with `delay_minutes: 45`, `initiation: own_followup`,
message `hybrid: liveness check P007 T14/T15`; `delete_trigger` it when both notifications
arrive. One wake replaces polling and may restart a paused VM.

## Integrate (main checkout, one task at a time)

On the completion notification, by STATUS:
- `blocked` → don't integrate. Back to `pending` plus a Needs Hernán entry, or `Where: pc (<reason>)`;
  log `Tnn blocked by agent (<reason>)`; remove the worktree.
- `partial` → integrate only if green and in scope, and add the remainder as a new task;
  otherwise relaunch from its branch.
- `done` →

```bash
git status --porcelain                                    # must be empty: commit plan edits first
test "$(git rev-list --count HEAD..worktree-agent-<id>)" -ge 1 || echo "EMPTY BRANCH"
git merge --squash worktree-agent-<id>                    # conflict → git reset --hard HEAD
git diff --cached --stat | tail -3; git diff --cached --name-only   # vs the task's must-not-touch
<Test command> > /tmp/hybrid-verify.log 2>&1; echo "exit $?"; tail -40 /tmp/hybrid-verify.log
```

- **Empty branch**: `git -C .claude/worktrees/agent-<id> status --short`; dirty → ask the agent
  to commit; clean → the attempt failed.
- A dependency manifest or lockfile in the name list → run the Worktree setup before the test.
- Bash timeout 600000 ms; the log file keeps the real exit code. If the test may take over ~8
  minutes, run `(<Test command>; echo "exit $?") > /tmp/hybrid-verify.log 2>&1` with
  `run_in_background: true` and read the tail on its notification.
- **Green**: `git commit -qm "Tnn: <title>"`, then
  `git worktree remove --force --force .claude/worktrees/agent-<id> && git branch -D worktree-agent-<id>`
  (the double force removes a locked worktree; disk is ~30 GB).
- **Red, environmental first**: command not found, missing module, registry or network errors,
  timeouts, or failures only in files the task didn't touch → `git reset --hard HEAD`, run the
  test on HEAD, fix the environment or the base. Don't message the agent; no attempt counted.
- **Red, the task's code**: `git reset --hard HEAD` (the tree was clean, so only the squash goes).
  Message the same agent (if SendMessage is deferred, load it with ToolSearch
  `select:SendMessage`): "Current base is <HEAD sha>. First `git merge <HEAD sha>` in your
  worktree, reproduce with `<Test command>`, fix, commit." plus ≤30 lines of error. Log
  `Tnn tests_failed #k (<reason>)`. After 3 reds: `blocked (<reason>)`, Needs Hernán, move on.
  Relaunches after an orphan or an interruption don't count as reds.
- **Conflict**: reset; ask the agent to `git merge <HEAD sha>` and recommit; resolve it yourself
  only when trivial.
- **Scope violation** (a must-not-touch path): reset and send it back.

## Record and push

One `plan_update.py` call per cycle, one commit, the guarded push:

```bash
python3 "$S/scripts/plan_update.py" "$PLAN" \
  --task T14 --status done --outcome "Search API client + cache · 3f2a9c1 · verify ✓ ☁️ · not checked: live API" \
  --log "T14 done · worktree-agent-a7049cdf0c9035731 → 3f2a9c1 · verify ✓" \
  --review "T14 @3f2a9c1 — code review" \
  --visual "T14 @3f2a9c1 — results list: light + dark, 375 px, empty state" \
  --proposal "T14: <out-of-scope finding>" \
  --task T16 --status "running (attempt 1 · ☁️ session_01AbC · agent b19c2de40a1f2e3d4 · since 14:06Z)" \
  --log "T16 launched · attempt 1 · agent b19c2de40a1f2e3d4" \
  --now "Next step=integrate T15/T16 as they finish"
git add "$PLAN" && git commit -qm "plan 007: T14 done, T16 launched" && "$S/scripts/guarded_push.sh" "$PLAN"
```

- Outcome: `<summary> · <sha> · verify ✓ ☁️|💻 · not checked: <visual, live keys>`.
- The script stamps Log lines with UTC time and place, queue lines with `(queued <date> <place>)`,
  and refreshes Now's `Updated`. Status words: `pending` · `running (…)` · `done` ·
  `blocked (<reason>)`.
- Other Log events: `Tnn tests_failed #2 (type error in search.ts) · discarded · fix sent`,
  `Tnn orphaned (container reclaimed) · relaunched · attempt 2 · agent <id>`,
  `base branch moved: X → Y (session_…)`, `handoff ☁️ → 💻 · <branch> @ <sha>`.
- `guarded_push.sh` exits 0 pushed · 2 refused, nothing pushed (fine for a PC plan based on
  main) · 3 pushed, but the frozen `Previous` branch moved: stop writing, ask Hernán · 4 failed.
- **Rejected push** (exit 4, non-fast-forward): someone else wrote to the branch. Never force.
  `git fetch origin <branch> && git log --oneline HEAD..FETCH_HEAD`: only unrelated commits →
  `git rebase FETCH_HEAD` and push; otherwise stop and ask (handoff.md G).

## Liveness check

In the start ritual, and first thing in any turn Hernán starts while running tasks of yours are
recorded. plan_status.py prints per running task: owner, worktree present, last commit age,
minutes since a file changed.

- Notification already received → integrate.
- Worktree present and a file changed in the last ~15 minutes → alive; leave it.
- Worktree present, quiet, no notification → interrupted (idle restore or restart). SendMessage
  the same agent: "You were interrupted; continue <Tnn> from your worktree and commit." If
  that fails: `git -C <wt> add -A && git -C <wt> commit -qm "WIP <Tnn>"`, relaunch with "first
  `git merge worktree-agent-<old id>`", log `Tnn orphaned (session restart) · WIP <sha> ·
  relaunched · agent <new id>`.
- Worktree missing (reclaim) → `pending`, relaunch from HEAD, log `Tnn orphaned (container
  reclaimed) · relaunched`. Nothing to undo: it was never integrated.
- The task's final commit is on its branch but no reply came → integrate it normally.
- A staged half-done squash in the main checkout → `git reset --hard HEAD`, redo.
- Entries of another live session (or 💻 entries seen from the cloud) are not yours.

## Cloud facts the loop relies on

- The stop hook checks only the main checkout (uncommitted, untracked, unpushed or unsigned
  commits) and nags once per stop; it can't see agent worktrees. Pushed state is the real check.
- Subagents cannot spawn subagents (spawn depth 1): only the main session fans out.
- Commands time out after 2 minutes unless given up to 600000 ms. If the test command regularly
  takes longer, suggest `BASH_DEFAULT_TIMEOUT_MS=600000` as a cloud environment variable.
- `gh` and the GitHub MCP tools work through the proxy with REST (`gh api`); GraphQL calls such
  as `gh repo view --json` return 403. Opening a PR still needs Hernán's OK.
- Each cloud session works on its own suffixed branch: record the old one as
  `Previous: <branch> @ <sha> (frozen)` in Now; `guarded_push.sh` warns if it moves.
- Whether running background agents keep an idle VM from pausing is undocumented (verify); the
  committed `running` marks make a reclaim recoverable either way.
- About 4 vCPU, 16 GB RAM, 30 GB disk. When short, remove finished worktrees and build caches;
  still short → push and relay to a fresh session.
- The clone is shallow; fetch without `--depth` (a depth-limited fetch can re-shallow shared
  history and confuse log, blame and the numbering scan).

## Drafting a plan without the orchestrator

Same flow: survey → fresh-worktree probe → interview → draft → explicit approval → execute.

1. **Survey** with an Explore agent (≤40-line summary).
2. **Probe**: in a fresh worktree run the Worktree setup and the Test command on the base branch.
   Record gaps (network or registry, service versions, missing keys by name) in Decisions as
   `(orchestrator)`.
3. **Interview** Hernán in Spanish: batched questions, each with a proposed default.
4. **Number** from the highest plan number and task id across every remote branch:

   ```bash
   for b in $(git ls-remote --heads origin | sed 's#.*refs/heads/##'); do
     git fetch -q --no-tags origin "$b" && git grep -h -oE '^(# Plan [0-9]+|## T[0-9]+)' FETCH_HEAD -- plans/
   done | sort -u | awk '/Plan/{if($3+0>p)p=$3+0} /^## T/{t=substr($2,2)+0; if(t>m)m=t} END{printf "last plan %03d, last task T%d\n", p, m}'
   ```

5. **Draft** with the skeleton in plan-blocks.md. Commit `plan NNN: draft (interview done,
   awaiting approval)`, guarded push, title `✋ ☁️ project · Pnnn Short · approve`.
6. Nothing runs before Hernán approves in his own words. Then `Status: active`, commit
   `plan NNN: approved`, push, start the loop.
