# Plan blocks

Read this only for drafting a plan, adopting the blocks in an existing plan, writing fix tasks
or sending review results. The loop's everyday formats are in cloud-loop.md and
`scripts/plan_update.py` writes them.

These blocks extend the orchestrator plan format. Keep everything else byte-compatible (header
lines, section order, task field names and order, Status words, Decisions/Proposals/Log shapes):
the Mac orchestrator's scripts read the plan. The new pieces are additive; before relying on
them on the PC, check that the orchestrator's scripts tolerate `## Now`, the `- Where:` and
`- Needs:` fields and the extended `running (…)` status (verify).

## Where each block goes

```
# Plan NNN — Title
Status / Created / Base branch / Goal / Test command / Worktree setup
## Now                                  new: right after the header
## Shared contract (all tasks read this)
## Tasks
## Tnn — …                              task blocks; fix tasks are appended after the last one
## Review queue                         new: after the last task
## Visual checks queue                  new
## Decisions
## Proposals (new scope)
## Log
```

## Now (≤8 lines; rewritten in place, never appended)

Only what nothing else holds. Running, ready and queue counts come from task Status lines and
the queues (plan_status.py derives them); don't copy them here.

```markdown
## Now
- Updated: 2026-10-02 14:05Z ☁️
- Writer: ☁️ session_01AbC · since 13:40Z
- Branch: claude/search-x7k2 @ 3f2a9c1 · pushed
- Previous: claude/search @ 0a1b2c3 (frozen)
- Needs Hernán: SEARCH_API_KEY as a cloud env var (T18) · empty-state copy (T17, default proposed)
- Next step: integrate T14/T15 as they finish, then launch T16.
- Gotchas: cloud has Postgres 16 (plan assumed 17).
```

- **Writer** is the lock. Cloud: `☁️ session_<id>` (the URL is `https://claude.ai/code/<id>`,
  matching the commits' `Claude-Session` trailer). PC: `💻 CLI` or `💻 desktop`. Never the title.
- Released at a handoff: `- Writer: released 18:20Z by ☁️ session_01AbC → continue on 💻`
  (plan_status.py reads `by ☁️|💻` to suggest the arrival arrow).
- **Branch** is where the latest work is; an arriving session syncs to exactly this.
  **Previous** is the last writer's branch, frozen; `guarded_push.sh` warns if it moves (an old
  session still writing). Drop it once that session is ❌.
- Timestamps in UTC: `date -u '+%Y-%m-%d %H:%MZ'` works in both places.

## Task block (orchestrator format, plus optional Where and Needs)

```markdown
## T16 — Search results page
- Status: pending
- Depends on: T14, T15
- Where: any
- Needs: SEARCH_API_KEY
- Goal: …
- Context: …
- Scope: may touch `src/search/**` … / must not touch `plans/`, …
- Done when:
  - …
  - `<test command>` → exit 0
  - Hand check (PC): results list in light and dark at 375 px
- Outcome:
```

- `Where: pc (reason)` marks work only the PC can do (Mac-only paths, a device, real keys). The
  cloud skips it and keeps going. Omitted means any.
- `Needs:` names env vars only, never values. plan_status.py keeps a task out of `ready` while a
  name is missing (env, `.env.local`, or a Decisions line `API credential: <host> NAME`).
- Write hand checks as the last Done-when bullet starting with `Hand check (PC):`. Agents do the
  headless part; the writer integrates on green and queues the bullet in the Visual queue.
- Status words: `pending` · `running (attempt N · ☁️ session_<id> | 💻 · agent <full id> · since HH:MMZ)`
  · `done` · `blocked (<reason>)`. `done (verify pending)` from older plans counts as not done.
- Outcome: `<summary> · <sha> · verify ✓ ☁️|💻 · not checked: <visual, live keys>`.
- Write Contexts portably: no `/Users/…` paths in tasks the cloud may run; for keys write
  "`.env.local` on the Mac (copied by `.worktreeinclude`) or cloud environment variables".
- Outside its own plan, write a task id as `P007·T14` (plan_status.py lists those deps as `ext`).

## Queues

```markdown
## Review queue
- [ ] T14 @3f2a9c1 — code review (queued 2026-10-02 ☁️)
- [x] T12 @0a1b2c3 — code review (queued 2026-10-02 ☁️) · reviewed 💻 2026-10-03 → T23
- [x] T13 @4d5e6f7 — code review (queued 2026-10-02 ☁️) · reviewed 💻 2026-10-03, no findings

## Visual checks queue
- [ ] T15 @9a8b7c6 — results list: light + dark, 375 px, empty and error states (queued 2026-10-02 ☁️)
```

A line is added only when the task is integrated (the SHA is what gets reviewed), with
`plan_update.py --review/--visual`; ticked with `--tick-review/--tick-visual "T12=<note>"`.
Say exactly what is left to check; the Outcome says what the agent already checked. The plan's
`Status: done` and `plan NNN: done` come only when both queues have no open line.

## Fix task (from a review or a visual check)

```markdown
## T23 — Fix: debounce fires twice on paste
- Status: pending
- Depends on: T12
- Where: any
- Goal: <the finding and the expected behaviour, one sentence>
- Context: review of T12 @0a1b2c3; `src/search/debounce.ts:41`
- Scope: may touch `src/search/**` / must not touch `plans/`
- Done when:
  - <the observable fix>
  - `<test command>` → exit 0
- Outcome:
```

- Use the next free task id (numbering below), one fix task per finding or tight group. Write
  blocks to a file and insert them with `plan_update.py --add-tasks FILE`.
- Fix tasks never change running tasks; if the affected code is still running, depend on it.

Message a 🔍 session sends to a live cloud writer (`claude -p "…" --cloud <session-id>`); it
writes `T?` and the writer assigns the ids:

```text
Review results for plan NNN (🔍 💻, 2026-10-03). Add these fix tasks with the next free ids, tick the queues, commit, push:
- tick review T12 → fix task 1 · tick review T13 → no findings
## T? — Fix: debounce fires twice on paste
(full task block)
```

## Commit messages

Keep the orchestrator's conventions, plus the hybrid ones:

| When | Message |
| --- | --- |
| repo setup | `orchestrator: project setup` / `orchestrator: hybrid setup` |
| draft / approval | `plan NNN: draft (interview done, awaiting approval)` / `plan NNN: approved` |
| revision | `plan NNN: <what changed>`, e.g. `plan NNN: adopt hybrid blocks` |
| launch | `plan NNN: T14 launched` |
| task squash | `T14: <task title>` |
| bookkeeping | `plan NNN: T14 done` or combined `plan NNN: T14 done, T16 launched` |
| failed integration on the Mac | git's default `Revert "T14: …"` |
| writer change | `plan NNN: resume on ☁️` / `plan NNN: resume on 💻` (only when Writer or Running changed) |
| handoff | `plan NNN: handoff ☁️ → 💻` / `plan NNN: handoff 💻 → ☁️` |
| review results | `plan NNN: review T12–T13 → T23` |
| done | `plan NNN: done` (queues empty) |

Keep whatever commit trailers the session's own instructions require.

## Decisions, Proposals, Log

```text
- 2026-10-02 plan: hybrid push policy: the cloud pushes its session branch after every integrated task; never main, no PR or deploy without OK. (Hernán)
- 2026-10-02 orchestrator: API credential: api.example.com SEARCH_API_KEY (proxy-injected, no env var in the VM). (Hernán)
- 2026-10-02 T14: <out-of-scope finding>          (Proposals)
- 2026-10-02 14:02Z ☁️ T14 done · worktree-agent-a7049cdf0c9035731 → 3f2a9c1 · verify ✓   (Log)
```

Decisions: `- YYYY-MM-DD <plan|orchestrator|Tnn>: <text>. (<who>)`. Proposals:
`- YYYY-MM-DD <Tnn|plan>: <text>`. Log: one line per event, UTC plus place (the script stamps
them). The Mac orchestrator's scripts may write their own Log lines; leave them as they are.

## Adopting the blocks in a running plan

One revision commit, `plan NNN: adopt hybrid blocks` (together with the resume commit):
- `plan_update.py --now "Writer=…" --now "Branch=<branch> @ <sha> · pushed" --now "Next step=…"`
  creates `## Now` under the header;
- record tasks that are actually running: Running from `git worktree list` plus the Log tail.
  A `stray` worktree (not recorded): `git -C <wt> log -1 --oneline` and `git -C <wt> status --short`;
  integrate it if it holds a finished task (record attempt 1), otherwise remove it;
- turn a "Deferred to the PC" list into the two queues, with lines only for tasks already
  integrated (keep the old heading as a one-line pointer if the orchestrator expects it);
- mark PC-only tasks `Where: pc (reason)` and key-dependent ones `Needs: NAME`;
- reconcile old text that says "no push": under this skill it means "no push to main, no PR".
  Record the push policy in Decisions (example above).

## Numbering

Plan numbers and task ids are global across branches; plans drafted on parallel branches have
collided before. Find the highest ones before numbering (command in cloud-loop.md, Drafting).

## Plan skeleton

```markdown
# Plan NNN — Title

Status: draft (interview done YYYY-MM-DD; awaiting Hernán's approval before anything runs)
Created: YYYY-MM-DD
Base branch: <branch>
Goal: <one paragraph>
Test command: <from the project's CLAUDE.md>
Worktree setup: <install command>

## Now
- Updated: …
- Writer: …
- Branch: …
- Next step: approve the plan

## Shared contract (all tasks read this)
<interfaces, names and rules every task shares>

## Tasks

## Tnn — <title>
(task blocks)

## Review queue

## Visual checks queue

## Decisions
- YYYY-MM-DD plan: <decision>. (Hernán)

## Proposals (new scope)

## Log
- YYYY-MM-DD HH:MMZ ☁️ plan written from the interview; not approved yet
```

Status moves `draft (…)` → `active` (commit `plan NNN: approved`, only after Hernán's explicit
OK) → `done` (all tasks done and both queues empty).
