#!/usr/bin/env python3
"""Compact status of an orchestrator plan, for the hybrid skill.

Stdlib only; runs the same on the Mac and in cloud sessions. Read-only.

Usage: python3 plan_status.py [PLAN.md] [--place cloud|pc]

Run `git fetch -q origin` first so the remote checks are current. Without PLAN.md it uses
the plan in <repo>/plans whose header says "Status: active" (else the newest draft); with
no local plan it looks for active plans on the newest remote branches. Prints about 25
lines: where you are, the header, git state, branches with plan commits you don't have,
prerequisites, the writer lock, running tasks with liveness, ready tasks with line ranges,
queues, the Now block (raw, with its line range) and a title for a session starting now.
Reading this instead of the whole plan is the point.
"""
import glob
import os
import re
import subprocess
import sys
import time

TASK = re.compile(r"^##\s+(T\d+(?:-fix\d*)?)\s+[—–-]+\s+(.*)$")
# A dependency id, but not the T42 inside a cross-plan reference such as P004·T42.
DEP_ID = re.compile(r"(?<![·\w])T\d+(?:-fix\d*)?\b")
EXT_ID = re.compile(r"\bP\d{3}\s*·\s*T\d+\b")
KEY_NAME = re.compile(r"\b[A-Z][A-Z0-9_]{2,}\b")
STOP = {"a", "an", "and", "the", "for", "of", "to", "in", "on", "with",
        "y", "de", "del", "la", "el", "para", "con", "en"}
MARK = {"cloud": "☁️", "pc": "\U0001F4BB"}
MAX_TITLE = 45
SKIP_DIRS = {"node_modules", ".git", ".next", "dist", "build", "out", ".venv", "venv",
             "__pycache__", ".turbo", ".cache"}
ENV = dict(os.environ, GIT_OPTIONAL_LOCKS="0")


def run(args, cwd=None):
    try:
        out = subprocess.run(args, capture_output=True, text=True, timeout=20, cwd=cwd, env=ENV)
        return out.returncode, out.stdout.strip()
    except Exception:
        return 1, ""


def sh(*args, cwd=None):
    code, out = run(list(args), cwd)
    return out if code == 0 else ""


def short(text, n):
    return text if len(text) <= n else text[: n - 1] + "…"


def header_status(text):
    for line in text.splitlines():
        if line.startswith("Status:"):
            return line[7:].strip().lower()
        if line.startswith("## "):
            break
    return ""


def read(path):
    try:
        with open(path, encoding="utf-8", errors="replace") as f:
            return f.read()
    except OSError:
        return ""


def find_plan():
    plans = sorted(glob.glob("plans/[0-9]*.md"))
    for want in ("active", "draft"):
        hits = [p for p in plans if header_status(read(p)).startswith(want)]
        if hits:
            return hits[-1]
    return None


def remote_refs(limit):
    out = sh("git", "for-each-ref", "--sort=-committerdate", f"--count={limit + 1}",
             "--format=%(refname:short)", "refs/remotes/origin")
    return [r for r in out.splitlines() if r and r not in ("origin", "origin/HEAD")][:limit]


def remote_active_plans():
    seen, hits = set(), []
    for ref in remote_refs(10):
        for name in sh("git", "ls-tree", "--name-only", ref, "plans/").splitlines():
            if name in seen or not re.match(r"plans/\d+.*\.md$", name):
                continue
            if header_status(sh("git", "show", f"{ref}:{name}")).startswith("active"):
                seen.add(name)
                hits.append(f"{ref}:{name}")
    return hits[:3]


def newer_branches(rel):
    hits = []
    for ref in remote_refs(15):
        n = sh("git", "rev-list", "--count", f"HEAD..{ref}", "--", rel)
        if n and n != "0":
            hits.append(f"{ref} (+{n} plan commits)")
    return hits


def parse(path):
    lines = read(path).splitlines()
    title = lines[0].lstrip("#").strip() if lines else path
    head, blocks, cur = {}, [], None
    for i, ln in enumerate(lines, 1):
        if ln.startswith("## "):
            m = TASK.match(ln)
            if m:
                cur = {"task": True, "id": m.group(1), "title": m.group(2).strip(), "start": i,
                       "status": "", "deps": [], "ext": [], "where": "any", "needs": []}
            else:
                cur = {"task": False, "name": ln[3:].strip(), "start": i, "body": []}
            blocks.append(cur)
            continue
        if cur is None:
            for key in ("Status", "Base branch", "Test command", "Worktree setup"):
                if ln.startswith(key + ":"):
                    head[key] = ln.split(":", 1)[1].strip()
        elif cur["task"]:
            if ln.startswith("- Status:"):
                cur["status"] = ln[9:].strip()
            elif ln.startswith("- Depends on:"):
                cur["deps"] = DEP_ID.findall(EXT_ID.sub("", ln[13:]))
                cur["ext"] = EXT_ID.findall(ln[13:])
            elif ln.startswith("- Where:"):
                cur["where"] = ln[8:].strip().lower()
            elif ln.startswith("- Needs:"):
                cur["needs"] = KEY_NAME.findall(ln[8:])
        else:
            cur["body"].append(ln)
    for k, b in enumerate(blocks):
        end = blocks[k + 1]["start"] - 1 if k + 1 < len(blocks) else len(lines)
        while end > b["start"] and not lines[end - 1].strip():
            end -= 1
        b["end"] = end
    tasks = [b for b in blocks if b["task"]]
    sections = [b for b in blocks if not b["task"]]
    return title, head, tasks, sections


def word(status):
    s = status.strip().lower()
    if s.startswith("done") and "pending" in s:  # e.g. "done (verify pending)"
        return "verifying"
    m = re.match(r"[a-z]+", s)
    return m.group(0) if m else "pending"


def num(task_id):
    m = re.match(r"T(\d+)", task_id)
    return (int(m.group(1)) if m else 0, task_id)


def span(ids):
    ids = sorted(set(ids), key=num)
    if not ids:
        return ""
    if len(ids) == 1:
        return ids[0]
    ns = [num(i)[0] for i in ids]
    if "-" not in "".join(ids) and ns == list(range(ns[0], ns[0] + len(ns))):
        return f"{ids[0]}–{ids[-1]}"
    return "+".join(ids) if len(ids) == 2 else f"{ids[0]}+{len(ids) - 1}"


def section(sections, prefix):
    for b in sections:
        if b["name"].lower().startswith(prefix):
            return b
    return None


def open_items(block):
    return sum(1 for ln in (block or {}).get("body", []) if re.match(r"^\s*- \[ \]", ln))


def known_keys(sections):
    names = set(os.environ)
    for ln in read(".env.local").splitlines():
        m = re.match(r"^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=", ln)
        if m:
            names.add(m.group(1))
    dec = section(sections, "decisions")
    for ln in (dec or {}).get("body", []):
        if "api credential" in ln.lower():
            names.update(KEY_NAME.findall(ln))
    return names


def prereqs():
    miss = []
    if not re.search(r'"baseRef"\s*:\s*"head"', read(".claude/settings.json")):
        miss.append("worktree.baseRef head")
    if run(["git", "check-ignore", "-q", ".claude/worktrees/agent-x/f"])[0] != 0:
        miss.append(".claude/worktrees/ not ignored")
    if run(["git", "check-ignore", "-q", ".env.local"])[0] != 0:
        miss.append(".env* not ignored")
    cfgs = [p for p in ["tsconfig.json"] + glob.glob("eslint.config.*") + glob.glob(".eslintrc*")
            + glob.glob("vitest.config.*") + glob.glob("jest.config.*") if os.path.isfile(p)]
    lacking = [p for p in cfgs if ".claude" not in read(p)]
    if lacking:
        miss.append("no .claude exclude in " + ", ".join(lacking))
    if "hybrid" not in read("CLAUDE.md"):
        miss.append("CLAUDE.md hybrid line")
    return miss


def quiet_minutes(path):
    newest, seen = 0.0, 0
    for root, dirs, files in os.walk(path):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for f in files:
            seen += 1
            try:
                newest = max(newest, os.path.getmtime(os.path.join(root, f)))
            except OSError:
                pass
        if seen > 20000:
            break
    return int((time.time() - newest) / 60) if newest else None


def liveness(detail, me, place):
    """Owner and worktree state of one running task."""
    sid = re.search(r"session_\w+", detail)
    if sid:
        owner = "mine" if me and sid.group(0) == me else f"other {short(sid.group(0), 18)}"
    elif "\U0001F4BB" in detail:
        owner = "mine" if place == "pc" else "💻"
    else:
        owner = "unknown session"
    agent = re.search(r"agent\s+([0-9a-f]{6,})", detail)
    if not agent:
        return owner
    wt = f".claude/worktrees/agent-{agent.group(1)}"
    if not os.path.isdir(wt):
        return f"{owner} · worktree missing" if owner == "mine" else owner
    age = sh("git", "-C", wt, "log", "-1", "--format=%cr")
    q = quiet_minutes(wt)
    files = f"files {q} min ago" if q is not None else "no files"
    return f"{owner} · wt ok · commit {age or '?'} · {files}"


def stray_worktrees(running_text):
    out = []
    for ln in sh("git", "worktree", "list", "--porcelain").splitlines():
        m = re.match(r"^worktree .*/\.claude/worktrees/agent-([0-9a-f]+)$", ln)
        if m and m.group(1) not in running_text:
            n = sh("git", "rev-list", "--count", f"HEAD..worktree-agent-{m.group(1)}") or "?"
            out.append(f"agent-{m.group(1)} ({n} commits not in HEAD)")
    return out


def main(argv):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    place = "cloud" if os.environ.get("CLAUDE_CODE_REMOTE") == "true" else "pc"
    path, args = None, list(argv)
    while args:
        a = args.pop(0)
        if a == "--place" and args:
            place = args.pop(0)
        elif a.startswith("--place="):
            place = a.split("=", 1)[1]
        else:
            path = os.path.abspath(a)
    mark = MARK.get(place, place)
    rsid = os.environ.get("CLAUDE_CODE_REMOTE_SESSION_ID", "")
    me = "session_" + rsid[4:] if rsid.startswith("cse_") else ""
    orch = os.path.expanduser("~/.claude/skills/orchestrator")
    skill = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    print(f"where    {mark} {place} · me {me or '-'} · orchestrator "
          f"{orch if os.path.isdir(orch) else 'none'} · skill {skill}")

    top = sh("git", "rev-parse", "--show-toplevel")
    if top:
        os.chdir(top)
    path = path or find_plan()
    if not path or not os.path.exists(path):
        print("plan     none active locally")
        for hit in remote_active_plans():
            print(f"remote   active plan at {hit} → sync to that branch (SKILL.md section 2)")
        for p in sorted(glob.glob("plans/[0-9]*.md"))[-5:]:
            print(f"  {p}: {short(header_status(read(p)), 60)}")
        return 0

    title, head, tasks, sections = parse(path)
    rel = os.path.relpath(path)
    by_id = {t["id"]: t for t in tasks}
    done = {t["id"] for t in tasks if word(t["status"]) == "done"}
    keys = known_keys(sections)
    groups, ready, waiting, pc_only, nokey = {}, [], [], [], []
    for t in tasks:
        w = word(t["status"])
        groups.setdefault(w, []).append(t["id"])
        if w != "pending":
            continue
        unmet = [d for d in t["deps"] if d in by_id and d not in done]
        missing = [k for k in t["needs"] if k not in keys]
        if t["where"].startswith("pc"):
            pc_only.append(t["id"])
            if place == "cloud":
                continue
        if unmet:
            waiting.append(f"{t['id']}({','.join(unmet)})")
        elif missing:
            nokey.append(f"{t['id']}({','.join(missing)})")
        else:
            ext = f" ext {','.join(t['ext'])}" if t["ext"] else ""
            ready.append(f"{t['id']} L{t['start']}–{t['end']}{ext}")

    print(f"plan     {rel} · {short(title, 70)}")
    print(f"header   status {short(head.get('Status', '?'), 40)} · base {head.get('Base branch', '?')}"
          f" · test {head.get('Test command', '?')} · setup {head.get('Worktree setup', '?')}")
    branch = sh("git", "branch", "--show-current") or "?"
    sha = sh("git", "rev-parse", "--short", "HEAD") or "?"
    unpushed = sh("git", "rev-list", "--count", "@{u}..HEAD") or "no upstream"
    dirty = len([ln for ln in sh("git", "status", "--porcelain").splitlines() if ln.strip()])
    base = head.get("Base branch", "").strip("`").split(" ")[0]
    note = " · not the Base branch" if base and branch != base else ""
    print(f"git      {branch} @ {sha} · unpushed {unpushed} · dirty {dirty}{note}")
    newer = newer_branches(rel)
    if newer:
        print(f"newer    {'; '.join(newer[:3])} → sync before anything else")
    miss = prereqs()
    print(f"prereqs  {'ok' if not miss else 'missing: ' + '; '.join(miss)}")
    if os.path.exists("package.json") and not os.path.isdir("node_modules"):
        print("deps     node_modules missing → run the Worktree setup in the main checkout")

    now = section(sections, "now")
    wl = next((ln for ln in (now or {}).get("body", []) if ln.lower().startswith("- writer:")), "")
    by = re.search(r"\bby\s+(☁️|☁|\U0001F4BB)", wl)
    if not now:
        writer = "none (no ## Now block: adopt, references/plan-blocks.md)"
    elif "released" in wl.lower():
        writer = "released" + (f" by {by.group(1)}" if by else "")
    elif me and me in wl:
        writer = "me"
    else:
        writer = "other: " + short(wl.split(":", 1)[1].strip() if wl else "?", 70)
    print(f"writer   {writer}")

    counts = " · ".join(f"{len(v)} {k}" for k, v in groups.items())
    print(f"tasks    {len(tasks)} total · {counts or 'none'}")
    running_text = ""
    for i in groups.get("running", []):
        detail = re.sub(r"^running\s*", "", by_id[i]["status"].strip(), flags=re.I).strip("() ")
        running_text += detail
        print(f"running  {i} ({detail}) [{liveness(detail, me, place)}]")
    stray = stray_worktrees(running_text)
    if stray:
        print(f"stray    {'; '.join(stray)} · not recorded as running")
    print(f"ready    {', '.join(ready) or '-'}")
    print(f"waiting  {short(' '.join(waiting), 110) or '-'}")
    if pc_only or nokey:
        print(f"pc-only  {', '.join(pc_only) or '-'} · no-key {', '.join(nokey) or '-'}")
    if groups.get("blocked"):
        print(f"blocked  {', '.join(groups['blocked'])}")
    rq, vq = section(sections, "review queue"), section(sections, "visual check")
    open_q = open_items(rq) + open_items(vq)

    def queue(b):
        return "no section" if b is None else f"{open_items(b)} open"
    contract = section(sections, "shared contract")
    where_c = f" · contract L{contract['start']}–{contract['end']}" if contract else ""
    print(f"queues   reviews {queue(rq)} · visual {queue(vq)}{where_c}")
    if now:
        print(f"Now      L{now['start']}–{now['end']}:")
        for ln in now["body"]:
            if ln.strip():
                print(ln)

    # Title for a session starting now (SKILL.md section 3).
    project = os.path.basename(top) if top else "project"
    m = re.search(r"(\d{3})", os.path.basename(path))
    pnum = f"P{m.group(1)}" if m else "P?"
    name = re.split(r"\s+[—–-]\s+", title, maxsplit=1)[-1].split(":")[0]
    words = []
    for w in name.split():
        if w.lower() in STOP or len(" ".join(words + [w])) > 10:
            break
        words.append(w)
    name = " ".join(words) or short(name.strip(), 10)
    plain = sorted((t["id"] for t in tasks if "-" not in t["id"]), key=num)
    mine_running = [i for i in groups.get("running", [])
                    if liveness(by_id[i]["status"], me, place).startswith("mine")]
    live_ids = mine_running + [r.split()[0] for r in ready]
    all_done = bool(tasks) and len(done) == len(tasks)
    leave = f"{mark}→{MARK['pc']}"
    arrive = f"{mark}←{by.group(1)}" if (now and "released" in wl.lower() and by) else mark
    hint = ""
    if head.get("Status", "").lower().startswith("draft"):
        state, where, focus = "✋", mark, "approve"
    elif all_done and open_q == 0:
        state, where, focus = "✅", mark, f"{plain[0]}–{plain[-1]}" if plain else "done"
    elif all_done:
        if place == "cloud":
            state, where, focus = "❌", leave, "queues"
            hint = "only PC work left (queues) → hand off: references/handoff.md A"
        else:
            state, where, focus = "🔍", mark, "review"
    elif live_ids:
        state, where, focus = "🟢", arrive, f"{min(live_ids, key=num)}–"
    elif pc_only and place == "cloud" and not waiting and not nokey:
        state, where, focus = "❌", leave, "next on PC"
        hint = "only PC tasks left → hand off: references/handoff.md A"
    else:
        state, where = "✋", arrive
        focus = "needs key" if nokey else "blocked" if groups.get("blocked") else "waiting"
    full = f"{state} {where} {project} · {pnum} {name} · {focus}"
    if len(full) > MAX_TITLE:
        full = f"{state} {where} {project} · {pnum} · {focus}"
    print(f"title    {full}")
    if hint:
        print(f"hint     {hint}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
