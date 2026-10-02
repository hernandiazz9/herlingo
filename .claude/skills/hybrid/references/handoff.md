# Handoffs, endings, recovery

The pushed plan (its Now block) is the baton. A handoff is complete when the leaving session has
pushed `Writer: released …` and renamed itself ❌. The arriving session takes the lock by
writing itself into Now and pushing (start ritual, SKILL.md section 2). `$S` = the skill folder.

## A. Cloud → PC

Cloud session (leaving):
1. Stop launching agents.
2. Running agents: finishing within ~10 minutes → wait and integrate. Otherwise `pending`, log
   `Tnn interrupted (handoff ☁️ → 💻)`. Their worktrees die with this container; don't push
   their branches (the proxy cannot delete branches).
3. One call, commit, push, then `git status -sb` shows no `ahead`:

   ```bash
   python3 "$S/scripts/plan_update.py" "$PLAN" --now "Writer=released $(date -u '+%H:%MZ') by ☁️ session_01AbC → continue on 💻" \
     --now "Next step=…" --log "handoff ☁️ → 💻 · <branch> @ <sha>"
   git add "$PLAN" && git commit -qm "plan NNN: handoff ☁️ → 💻" && "$S/scripts/guarded_push.sh" "$PLAN"
   ```

4. Rename yourself now: `❌ ☁️→💻 myapp · P007 Search · T12–T15`. Later the PC can't easily.
5. Give Hernán, in Spanish, the commands for the repo on his Mac:

   ```bash
   git status --short          # must be empty; otherwise commit or stash first
   git fetch origin && git switch <branch> && git pull --ff-only
   claude --remote-control "🟢 💻←☁️ myapp · P007 Search · T16–"    # or: claude -n "…"
   ```

   Then "seguí con el plan P007" (or `/hybrid`). `--remote-control` makes the Mac session
   visible in claude.ai/code and on the phone, so the cloud can list it and a rename from the
   app syncs back. When the conversation itself matters: `claude --teleport <session-id>`
   (clean tree, pushed branch, same account; it loads the whole transcript and checks out this
   session's branch; take "Resume from summary" if offered).

PC session (arriving): start ritual; Writer `💻 CLI` (or `💻 desktop`) `· since …`; commit
`plan NNN: resume on 💻`; guarded push. Relaunch interrupted tasks (orchestrator if installed).

## B. PC → cloud

PC session (leaving):
1. Stop launching; integrate or interrupt running agents as in A.2.
2. **Rename first**, before anything else: in the desktop app rename yourself; in the CLI tell
   Hernán "Pegá esto primero: `/rename ❌ 💻→☁️ myapp · P007 Search · T16–T18`".
3. Base branch main (or anything that must not be pushed) → `git switch -c <work-branch>`,
   `--header "Base branch=<work-branch>"`, log `base branch moved: main → <work-branch>`. Local
   main keeps its unpushed commits: leave it alone and tell Hernán.
4. Keys the cloud tasks need → Needs Hernán, by name, with where to set them (cloud environment
   menu → Edit → Environment variables). Never copy values anywhere.
5. Now `Writer=released … by 💻 → continue on ☁️`; commit `plan NNN: handoff 💻 → ☁️`; guarded
   push.
6. Start the cloud session yourself via Bash, from the repo:
   `claude --cloud "Use the hybrid skill if available. Continue plan plans/NNN-slug.md on branch <branch>: run its start ritual, then keep going."`
   It clones the pushed current branch, not the local checkout (`/remote-env` picks the default
   environment). Alternatives: the desktop app's Continue in → Claude Code on the Web (clean
   tree; it pushes, summarizes and offers to archive the local session), or a new claude.ai/code
   session on that branch with the same prompt.

Cloud session (arriving): start ritual. It runs on a new suffixed branch: check
`git merge-base --is-ancestor <handoff sha> HEAD`, set `Base branch` to the session branch and
`Previous: <PC branch> @ <sha> (frozen)`, log `base branch moved: X → Y (session_…)`, commit
`plan NNN: resume on ☁️`, push, name yourself `🟢 ☁️←💻 …`, run the loop.

Steering a running cloud session from the Mac without opening it:
`claude -p "<message>" --cloud <session-id>` (archived sessions refuse messages; it costs one
turn of that session's whole context).

## C. Fresh-session relay (cloud → new cloud)

Due after ~6 integrated tasks, at a plan-phase boundary, after an automatic compaction or a
context warning, or past ~5M cache-read tokens (SKILL.md section 9).

- **Manual (default)**: A.1–A.3 with `continue on ☁️`, rename `❌ ☁️→☁️ …`, and give Hernán the
  prompt for a new session on the same branch (B.6's prompt).
- **Automatic**, only if the plan's Decisions say `auto-relay allowed. (Hernán)` and no agent is
  running: `create_session` (claude-code-remote) with `source_url` = the repo URL,
  `source_revision` and `outcome_branch` = the current branch (no new suffix, no base-branch
  move), `title` = `🟢 ☁️←☁️ …`, the B.6 prompt, and no `permission_mode: "plan"` (nobody would
  approve it). Then rename yourself `❌ ☁️→☁️ …` and stop writing.

## D. Ending a cloud turn where Hernán may leave

- [ ] `git status --porcelain` is empty in the main checkout.
- [ ] Every integrated task is committed and pushed (`git status -sb` shows no `ahead`).
- [ ] Now is current (≤8 lines) and task Status lines are true (running entries carry your
      session id; the resumer relaunches them if the container dies).
- [ ] The title matches: 🟢 while you are the live writer; ✋ when nothing runs without Hernán;
      ✅ when done; ❌ after a handoff.
- [ ] A Spanish summary of ≤5 lines: done, running, next, what is needed from him.

## E. Resume after a reclaim or restart

Signs: the conversation came back on a fresh VM; running entries whose worktree is missing;
worktrees present but quiet with no notification (idle restore restarts Claude Code; agents die
while files stay).

1. Start ritual (SKILL.md section 2).
2. Liveness check (cloud-loop.md) for every running entry that is yours: your session id, or a
   session that is gone (`get_session` shows archived, failed or completed, or its title is ❌).
3. Entries of another live session, or 💻 entries seen from the cloud, are not orphans: that
   place may still be working. Check Writer; not released → ask Hernán.

## F. Which session do I continue? ("qué sesión sigo?")

Read-only: no Now edit, commit or push.
1. Read Now → Writer on the branch with the latest work (`newer` in the start output, or
   `git fetch origin <branch> && git show FETCH_HEAD:plans/NNN-slug.md | sed -n '/^## Now/,/^## /p'`).
2. Writer is a cloud session → that id; `list_sessions` (`mine: true`, `limit: 10`) shows its
   title. Writer is 💻 and not released → the live session is on the Mac even if no list shows
   it (plain CLI sessions appear in neither claude.ai nor `list_sessions`): "Está en la Mac:
   `claude --resume` y buscá `P007`" (or the desktop app sidebar). Never conclude "no writer"
   from `list_sessions` alone.
3. Writer released → no session to continue: start a fresh one where Hernán wants and name it
   with `←`.
4. Answer in one line: the title and how to open it (claude.ai/code sidebar, desktop or mobile
   app: search `P007` or the project name; ❌/✅ rows are history, 🔍 are side passes).

Resuming an old session is worth it only when its conversation matters; otherwise a fresh
session plus the Now block is cheaper.

## G. Two writers (conflict)

Signs: Now's Writer names another live session; a rejected push; `guarded_push.sh` exit 3; two
🟢/✋ titles for one plan.

Stop writing. Tell Hernán in two lines which two sessions are involved and propose keeping the
one with the newest pushed commit. After his answer the other is renamed `❌ … → place`; the
winner merges or drops the loser's unintegrated work and records it in the Log.

## H. Tidying old sessions

At plan done, or at a handoff when this plan has more than 2 ❌/✅ sessions, offer once in one
line: "¿Archivo las sesiones ❌/✅ de P007?" On a yes, `archive_session` the cloud ones (archived
sessions refuse messages, so only ❌/✅ rows). PC ones: he archives them in the desktop app if
he wants.
