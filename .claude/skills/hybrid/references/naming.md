# Session names

Read this only for a case SKILL.md section 3 doesn't cover. A title answers three questions at a
glance: is this the live session, where does it run (and where did the work go or come from),
which plan and tasks. Mobile lists show roughly the first 30–35 characters, so state, place and
arrow come first and the whole title stays within 45 characters.

## Format

```
STATE PLACE[→PLACE | ←PLACE] project · Pnnn Short · focus
```

| Part | Rule |
| --- | --- |
| STATE | one marker from the legend |
| PLACE | where this session runs: ☁️ cloud (claude.ai/code) or 💻 PC (the Mac: CLI, desktop app, Remote Control) |
| arrow | glued to PLACE, at most one: `→X` this session's work continued in X; `←X` this session took over from X |
| project | repo directory name, plain ASCII, so the sidebar search and the `claude --resume` picker find it |
| Pnnn Short | 3-digit plan number + ≤10 chars of the plan title; drop Short first if the title passes 45 |
| focus | ≤10 chars: open range while live (`T42–`), closed when ended (`T42–T45`), or a reason (`needs key`, `approve`, `review`, `limit`, `interview`) |

Sessions without a plan still lead with state and place: `🟢 ☁️ myapp · fix login`.

## Legend

| Marker | Code point | Meaning | Continue it? |
| --- | --- | --- | --- |
| 🟢 | U+1F7E2 | live writer of the plan (the app's own status dot says whether it is running right now) | yes, this is the one |
| ✋ | U+270B | live writer that needs Hernán: key, decision, approval, rate limit | yes, after answering |
| 🔍 | U+1F50D | review or visual-check pass on the PC; never writes Now → Writer | only to finish the pass |
| ✅ | U+2705 | finished: tasks done and queues empty, or a 🔍 pass done | no |
| ❌ | U+274C | superseded: the work continued where its arrow points | no (only by retaking a released lock, SKILL.md section 2) |
| ☁️ | U+2601 U+FE0F | cloud | |
| 💻 | U+1F4BB | PC | |
| → ← | U+2192 U+2190 | went to / came from | |
| · – | U+00B7 U+2013 | separator / task range | |

The state markers all have emoji presentation by default, so they render in colour and no
sanitizer can strip a variation selector from them. Exactly one session per plan carries 🟢 or
✋; the plan's Now → Writer line names it.

## Transitions (project `myapp`, plan 007 "Search")

1. Cloud session starts the plan: `🟢 ☁️ myapp · P007 Search · T12–`
2. Waits on a key, nothing else runnable: `✋ ☁️ myapp · P007 Search · needs key`; back to 🟢 when
   answered.
3. Cloud → PC. Leaving: `❌ ☁️→💻 myapp · P007 Search · T12–T15`. Arriving:
   `🟢 💻←☁️ myapp · P007 Search · T16–`
4. PC → cloud. Leaving: `❌ 💻→☁️ myapp · P007 Search · T16–T18`. Arriving:
   `🟢 ☁️←💻 myapp · P007 Search · T19–`
5. Fresh-session relay in the cloud. Leaving: `❌ ☁️→☁️ myapp · P007 Search · T12–T18`. Arriving:
   `🟢 ☁️←☁️ myapp · P007 Search · T19–`
6. Review pass on the PC while the cloud keeps going: `🔍 💻 myapp · P007 Search · review`, then
   `✅ 💻 myapp · P007 Search · reviewed`
7. Drafting: `🟢 ☁️ myapp · P008 draft · interview`, then `✋ ☁️ myapp · P008 Filters · approve`
8. Rate limit hit: `✋ ☁️ myapp · P007 Search · limit`
9. All tasks built, only PC queues left: `❌ ☁️→💻 myapp · P007 Search · T12–T22`
10. Plan finished, queues empty: `✅ 💻 myapp · P007 Search · T12–T22`
11. Duplicate live session, Hernán keeps the PC one: `❌ ☁️→💻 myapp · P007 Search · duplicate`

The `←` arrow stays until the session leaves (it becomes `→place`) or finishes (✅ drops it).

## Who renames what, when

| Moment | Who | New title |
| --- | --- | --- |
| A writer starts | itself (PC: Hernán launches it with the name) | 🟢 … (`←place` if it took over) |
| Needs Hernán / answered | the cloud writer (on the PC the title stays 🟢) | ✋ / 🟢 |
| Handoff | the **leaving** session, before Hernán switches | ❌ place→place … closed range |
| Arrival while an old title still looks live | the arriving cloud session renames old cloud (and Remote Control) sessions itself; otherwise it gives Hernán the line or says "tocá el título en la app" | ❌ … |
| Plan done | the writer | ✅ … closed range |
| Review pass | the review session | 🔍, then ✅ |

PC titles change only three times (launch, handoff, end) because each change costs Hernán a
paste. Now → Writer identifies the session by id (cloud) or as `💻 CLI` / `💻 desktop`, never by
title, so renames don't touch the plan.

## Mechanisms

Cloud (claude.ai/code):
- Own title: `mcp__claude-code-remote__get_session` with no arguments returns this session's id
  and title (`session_${CLAUDE_CODE_REMOTE_SESSION_ID#cse_}` gives the same id, and it matches the
  commits' `Claude-Session` trailer); then `mcp__claude-code-remote__set_session_title` with
  `session_id` and `title`.
- Another session of the account: `list_sessions` with `mine: true, limit: 10`, find it by
  title, then `set_session_title` with its id. Whether this also renames PC sessions that are
  connected with Remote Control (they appear in the same list) is untested (verify).
- Hernán can also type `/rename <title>` in a cloud session (Claude Code v2.1.205+).

PC (Mac):
- Launch: `claude --remote-control "<title>"` (recommended: the session appears in claude.ai/code
  and the mobile app with a computer icon, and a rename there syncs back to the CLI) or
  `claude -n "<title>"`.
- CLI during a session: Claude cannot run slash commands; print `/rename <title>` for Hernán to
  paste. In the `claude --resume` picker, Ctrl+R renames the highlighted session.
- Desktop app: Claude can rename its own desktop session (documented; the tool's name may vary).
  If none is offered, Hernán clicks the title in the session toolbar.
- Last resort for a cloud session the PC must mark ❌: Hernán taps its title in claude.ai or the
  app (cheapest), or `claude -p "Hernán continues on the Mac. Rename yourself to ❌ ☁️→💻 … and do nothing else." --cloud <session-id>`
  (one turn of that session's whole context).

Finding sessions later:
- Cloud and Remote Control sessions: the claude.ai/code sidebar and the desktop and mobile apps;
  search the project name or `P007`.
- CLI sessions: `claude --resume` (picker with search; Ctrl+A all projects, Ctrl+B current
  branch); search `P007` (emoji and `·` are hard to type). The CLI picker doesn't list cloud
  sessions: pull one down with `claude --teleport <session-id>`.

## Character safety

`/rename` replaces control and invisible characters with spaces and caps names at 200 characters.
Only ☁️ carries an invisible selector (U+FE0F); if it is stripped, a monochrome ☁ remains and the
title still reads. Whether `set_session_title` keeps it intact is untested (verify): Hernán
glances at the first cloud title once. If he wants ⛅ (U+26C5) instead, change this legend,
SKILL.md section 3 and `MARK` in `scripts/plan_status.py` and `scripts/plan_update.py`; read
older titles with ☁️ as the same thing.
