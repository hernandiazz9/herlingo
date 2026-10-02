#!/usr/bin/env python3
"""Update an orchestrator plan in one pass, for the hybrid skill (stdlib only).

Usage:
  plan_update.py PLAN [--task Tnn [--status TEXT] [--outcome TEXT]]...
                      [--header KEY=VALUE]... [--now KEY=VALUE]...
                      [--log TEXT]... [--review TEXT]... [--visual TEXT]...
                      [--tick-review Tnn=NOTE]... [--tick-visual Tnn=NOTE]...
                      [--decision TEXT]... [--proposal TEXT]... [--add-tasks FILE]
                      [--place cloud|pc]

--status / --outcome apply to the latest --task. --header rewrites a header line
("Base branch=claude/x-abc"). --now rewrites or adds the "- KEY:" line of ## Now
("KEY=" removes it); ## Now is created under the header if missing and its Updated line
is refreshed on every run. --log, --review, --visual, --decision and --proposal append
one line to their section, stamped with the UTC time or date and the place mark (queue
sections are created when missing). --tick-* marks the open queue line of Tnn done and
appends the note. --add-tasks inserts the task blocks in FILE after the last task.
Nothing is written if any part fails. Prints what changed and the Now line range.
"""
import os
import re
import sys
import time

MARK = {"cloud": "☁️", "pc": "\U0001F4BB"}
TASK = re.compile(r"^##\s+(T\d+(?:-fix\d*)?)\s+[—–-]+\s")
DATED = re.compile(r"^\d{4}-\d\d-\d\d")


class Fail(Exception):
    pass


class Plan:
    def __init__(self, lines, mark):
        self.lines = lines
        self.mark = mark
        self.when = time.strftime("%Y-%m-%d %H:%MZ", time.gmtime())
        self.day = self.when[:10]

    def headers(self):
        return [i for i, ln in enumerate(self.lines) if ln.startswith("## ")]

    def block(self, pred):
        hs = self.headers()
        for k, i in enumerate(hs):
            if pred(self.lines[i]):
                return i, (hs[k + 1] if k + 1 < len(hs) else len(self.lines))
        return None

    def section(self, prefix):
        return self.block(lambda ln: ln[3:].strip().lower().startswith(prefix))

    def last_content(self, start, end):
        k = end
        while k > start + 1 and not self.lines[k - 1].strip():
            k -= 1
        return k  # insert position after the last non-blank line

    def insert(self, pos, new):
        self.lines[pos:pos] = new
        after = pos + len(new)
        if after < len(self.lines) and self.lines[after].startswith("## "):
            self.lines.insert(after, "")

    # -- header and tasks ------------------------------------------------------------
    def set_header(self, key, val):
        first = (self.headers() or [len(self.lines)])[0]
        for i in range(first):
            if self.lines[i].startswith(key + ":"):
                self.lines[i] = f"{key}: {val}"
                return
        raise Fail(f"header line '{key}:' not found")

    def task(self, tid):
        b = self.block(lambda ln: bool(TASK.match(ln)) and TASK.match(ln).group(1) == tid)
        if not b:
            raise Fail(f"task {tid} not found")
        return b

    def set_field(self, tid, field, val):
        s, e = self.task(tid)
        for i in range(s + 1, e):
            if self.lines[i].startswith(f"- {field}:"):
                j = i + 1
                if field == "Outcome":  # drop indented continuation lines
                    while j < e and self.lines[j].startswith("  ") and self.lines[j].strip():
                        j += 1
                self.lines[i:j] = [f"- {field}: {val}".rstrip()]
                return
        if field != "Outcome":
            raise Fail(f"{tid} has no '- {field}:' line")
        self.insert(self.last_content(s, e), [f"- Outcome: {val}"])

    def add_tasks(self, text):
        new = text.strip("\n").splitlines()
        tasks = [i for i in self.headers() if TASK.match(self.lines[i])]
        if tasks:
            s, e = self.block(lambda ln, i0=tasks[-1]: ln == self.lines[i0])
            pos = self.last_content(s, e)
        else:
            t = self.section("tasks")
            if not t:
                raise Fail("no task blocks and no ## Tasks section")
            pos = self.last_content(*t)
        self.insert(pos, [""] + new)

    # -- Now -------------------------------------------------------------------------
    def now(self, updates):
        b = self.block(lambda ln: ln.strip().lower() == "## now" or ln.lower().startswith("## now "))
        if not b:
            first = (self.headers() or [len(self.lines)])[0]
            self.insert(first, ["## Now"])
        for key, val in [("Updated", f"{self.when} {self.mark}")] + updates:
            s, e = self.block(lambda ln: ln.strip().lower() == "## now" or ln.lower().startswith("## now "))
            pat = re.compile(rf"^- {re.escape(key)}:", re.I)
            hit = next((i for i in range(s + 1, e) if pat.match(self.lines[i])), None)
            if val == "":
                if hit is not None:
                    del self.lines[hit]
            elif hit is not None:
                self.lines[hit] = f"- {key}: {val}"
            elif key == "Updated":
                self.insert(s + 1, [f"- {key}: {val}"])
            else:
                self.insert(self.last_content(s, e), [f"- {key}: {val}"])

    # -- appended lines --------------------------------------------------------------
    def append(self, prefix, line, create=None):
        b = self.section(prefix)
        if not b:
            if not create:
                raise Fail(f"no '## {prefix}…' section")
            anchor = None
            for name in ("decisions", "proposals", "log"):
                found = self.section(name)
                if found:
                    anchor = found[0]
                    break
            if anchor is None:
                self.lines += ["", f"## {create}"]
            else:
                self.insert(anchor, [f"## {create}"])
            b = self.section(prefix)
        s, e = b
        self.insert(self.last_content(s, e), [line])

    def tick(self, prefix, tid, note):
        b = self.section(prefix)
        if not b:
            raise Fail(f"no '## {prefix}…' section")
        pat = re.compile(rf"^(\s*- )\[ \]( {re.escape(tid)}\b.*)$")
        for i in range(b[0] + 1, b[1]):
            m = pat.match(self.lines[i])
            if m:
                self.lines[i] = f"{m.group(1)}[x]{m.group(2)} · {note}"
                return
        raise Fail(f"no open '{tid}' line in ## {prefix}…")

    def stamp(self, text, with_time):
        if DATED.match(text):
            return f"- {text}"
        return f"- {self.when} {self.mark} {text}" if with_time else f"- {self.day} {text}"


def main(argv):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    if not argv or argv[0].startswith("--"):
        print(__doc__.strip())
        return 2
    path, args = argv[0], list(argv[1:])
    place = "cloud" if os.environ.get("CLAUDE_CODE_REMOTE") == "true" else "pc"
    ops, cur, changes = [], None, []
    try:
        while args:
            a = args.pop(0)
            if not args:
                raise Fail(f"{a} needs a value")
            v = args.pop(0)
            if a == "--task":
                cur = v
            elif a in ("--status", "--outcome"):
                if not cur:
                    raise Fail(f"{a} needs a --task before it")
                ops.append(("field", cur, a[2:].capitalize(), v))
            elif a == "--place":
                place = v
            elif a in ("--header", "--now", "--tick-review", "--tick-visual"):
                if "=" not in v:
                    raise Fail(f"{a} expects KEY=VALUE")
                k, val = v.split("=", 1)
                ops.append((a[2:], k.strip(), val.strip()))
            elif a in ("--log", "--review", "--visual", "--decision", "--proposal", "--add-tasks"):
                ops.append((a[2:], v))
            else:
                raise Fail(f"unknown option {a}")
        with open(path, encoding="utf-8") as f:
            text = f.read()
        plan = Plan(text.splitlines(), MARK.get(place, place))
        now_updates = []
        for op in ops:
            kind = op[0]
            if kind == "field":
                plan.set_field(op[1], op[2], op[3])
                changes.append(f"{op[1]} {op[2].lower()}")
            elif kind == "header":
                plan.set_header(op[1], op[2])
                changes.append(f"header {op[1]}")
            elif kind == "now":
                now_updates.append((op[1], op[2]))
            elif kind == "add-tasks":
                with open(op[1], encoding="utf-8") as f:
                    plan.add_tasks(f.read())
                changes.append("tasks added")
            elif kind in ("tick-review", "tick-visual"):
                plan.tick("review queue" if kind == "tick-review" else "visual check", op[1], op[2])
                changes.append(f"{kind} {op[1]}")
            elif kind == "log":
                plan.append("log", plan.stamp(op[1], True))
                changes.append("log+1")
            elif kind in ("review", "visual"):
                prefix, create = (("review queue", "Review queue") if kind == "review"
                                  else ("visual check", "Visual checks queue"))
                plan.append(prefix, f"- [ ] {op[1]} (queued {plan.day} {plan.mark})", create)
                changes.append(f"{kind}+1")
            elif kind in ("decision", "proposal"):
                plan.append("decisions" if kind == "decision" else "proposals", plan.stamp(op[1], False))
                changes.append(f"{kind}+1")
        plan.now(now_updates)
        if now_updates:
            changes.append("now(" + ", ".join(k for k, _ in now_updates) + ")")
    except (Fail, OSError) as err:
        print(f"plan_update: nothing written: {err}")
        return 1
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write("\n".join(plan.lines) + "\n")
    os.replace(tmp, path)
    s, e = plan.block(lambda ln: ln.strip().lower() == "## now" or ln.lower().startswith("## now "))
    print(f"updated {path}: {', '.join(changes) or 'Updated only'} · Now L{s + 1}–L{plan.last_content(s, e)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
