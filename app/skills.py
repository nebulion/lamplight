"""The Skills page's data: the person's list (data/skills.json) and any study plans they keep elsewhere, read only.

A study plan is a Markdown file named in data/profile.json ("study_plans": [{"id", "name", "file"}]): "### Session N"
headings with "- [x]" tick boxes under them. Their notes stay the one source; this never writes to that file.
A session counts as finished when every box is ticked, leaving out the daily flashcards ("Anki..."), which repeat.
"""
import datetime as dt
import json
import os
import re

import person

ITEMS = os.path.join(person.DATA, "skills.json")
LINK = re.compile(r"\[\[([^\]|]+)(?:\|[^\]]*)?\]\]")


def read_plan(plan):
    path = plan.get("file", "")
    out = {"id": plan.get("id"), "name": plan.get("name"), "found": os.path.isfile(path)}
    if not out["found"]:
        return out
    with open(path, encoding="utf-8") as f:
        text = f.read()
    parts = re.split(r"^### Session (\d+)[^\n]*$", text, flags=re.M)
    sessions = []
    for i in range(1, len(parts), 2):
        body = re.split(r"^#{1,3} ", parts[i + 1], maxsplit=1, flags=re.M)[0]
        tasks = [{"done": box == "x", "text": LINK.sub(r"\1", line).strip()}
                 for box, line in re.findall(r"^- \[( |x)\] (.*)$", body, flags=re.M)]
        real = [t for t in tasks if not t["text"].startswith("Anki")]
        sessions.append({"n": int(parts[i]), "done": bool(real) and all(t["done"] for t in real), "tasks": tasks})
    ticks = [t for s in sessions for t in s["tasks"]]
    following = next((s for s in sessions if not s["done"]), None)
    out.update({
        "sessions": [s["done"] for s in sessions],
        "finished": sum(1 for s in sessions if s["done"]),
        "ticked": sum(1 for t in ticks if t["done"]),
        "boxes": len(ticks),
        "next": following,
        "last_saved": dt.date.fromtimestamp(os.path.getmtime(path)).isoformat(),
    })
    return out


def load():
    if not os.path.isfile(ITEMS):
        return {"groups": [], "plans": [], "exists": False}
    with open(ITEMS, encoding="utf-8") as f:
        doc = json.load(f)
    doc["plans"] = [read_plan(p) for p in person.load().get("study_plans") or []]
    doc["exists"] = True
    return doc
