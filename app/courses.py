"""Video courses on the Skills page (2026-11-05, he asked): a folder of course videos played in the page, a note per video
kept in their own notes folder (an Obsidian vault works), and progress counted in minutes of video watched.

A course is listed in data/profile.json:
  "courses": [{"id": "ccna", "name": "CCNA course",
               "videos": "C:\\Users\\...\\CCNA Course Videos",   # read only: every video under it, sub-folders as sections
               "notes": "C:\\Users\\...\\vault\\Work\\CCNA",      # one .md per video, same sub-folders; the page reads and writes these
               "week_minutes": 300,                                # optional: the weekly goal, in minutes of video
               "finish_by": "2027-03-01",                          # optional: shows the weekly pace that would finish it by then
               "star_minutes": 30}]                                # optional: one star in the street's sky per this many minutes (30)

What was watched is kept in data/watched.json: per video the stretches of it played (so rewatching or skipping ahead
doesn't count twice), where it was left, and its length; per day the new minutes watched.
"""
import datetime as dt
import json
import os
import re
import threading

import person

WATCHED = os.path.join(person.DATA, "watched.json")
VIDEO_TYPES = {".mp4": "video/mp4", ".m4v": "video/mp4", ".mov": "video/mp4", ".webm": "video/webm",
               ".mkv": "video/x-matroska", ".ogv": "video/ogg"}
DONE_SHARE = 0.9                                          # a video counts as watched at 90%
_lock = threading.Lock()


def _natural(s):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", s)]


def course(cid):
    c = next((c for c in person.load().get("courses") or [] if c.get("id") == cid), None)
    if not c:
        raise ValueError(f"no course {cid}")
    return c


def _inside(root, rel):
    """root/rel, refusing anything that steps outside root."""
    root = os.path.normpath(root)
    path = os.path.normpath(os.path.join(root, rel or ""))
    if os.path.isabs(rel or "") or os.path.commonpath([root, path]) != root or path == root:
        raise ValueError("not inside the course folder")
    return path


def videos(c):
    root = c.get("videos", "")
    if not os.path.isdir(root):
        return []
    out = []
    for here, dirs, files in os.walk(root):
        dirs.sort(key=_natural)
        for f in files:
            if os.path.splitext(f)[1].lower() in VIDEO_TYPES:
                rel = os.path.relpath(os.path.join(here, f), root).replace(os.sep, "/")
                out.append(rel)
    out.sort(key=lambda r: [_natural(p) for p in r.split("/")])
    return [{"id": r, "title": os.path.splitext(r.rsplit("/", 1)[-1])[0], "section": r.rsplit("/", 1)[0] if "/" in r else ""}
            for r in out]


def video_file(cid, rel):
    path = _inside(course(cid).get("videos", ""), rel)
    ctype = VIDEO_TYPES.get(os.path.splitext(path)[1].lower())
    if not ctype or not os.path.isfile(path):
        raise ValueError("no such video")
    return path, ctype


# ---------------- watched ----------------
def _load_watched():
    try:
        with open(WATCHED, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {}


def _save_watched(doc):
    os.makedirs(person.DATA, exist_ok=True)
    tmp = WATCHED + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(doc, f, indent=1)
    os.replace(tmp, WATCHED)


def _merge(ranges):
    out = []
    for a, b in sorted([float(a), float(b)] for a, b in ranges if float(b) > float(a)):
        if out and a <= out[-1][1] + 1:                   # touching or within a second: one stretch
            out[-1][1] = max(out[-1][1], b)
        else:
            out.append([a, b])
    return [[round(a, 1), round(b, 1)] for a, b in out]


def _seen(v):
    dur = v.get("dur") or 0
    return sum(min(b, dur) - a for a, b in v.get("ranges", []) if not dur or a < dur) if dur else sum(b - a for a, b in v.get("ranges", []))


def _week_start(day):
    return day - dt.timedelta(days=day.weekday())


def summary(c, state=None):
    """The course in numbers: minutes watched of its total, this week's minutes, videos watched."""
    state = state if state is not None else _load_watched().get(c.get("id"), {})
    vids = videos(c)
    seen = state.get("videos", {})
    today = dt.date.today()
    monday = _week_start(today).isoformat()
    days = state.get("days", {})
    total = sum(seen.get(v["id"], {}).get("dur") or 0 for v in vids)
    watched = sum(_seen(seen[v["id"]]) for v in vids if v["id"] in seen)
    done = sum(1 for v in vids if v["id"] in seen and seen[v["id"]].get("dur") and _seen(seen[v["id"]]) >= DONE_SHARE * seen[v["id"]]["dur"])
    out = {
        "id": c.get("id"), "name": c.get("name") or c.get("id"),
        "found": os.path.isdir(c.get("videos", "")), "notes_found": os.path.isdir(c.get("notes", "")),
        "videos": len(vids), "timed": sum(1 for v in vids if seen.get(v["id"], {}).get("dur")), "done": done,
        "total_s": round(total), "watched_s": round(watched),
        "week_s": round(sum(s for d, s in days.items() if d >= monday)), "today_s": round(days.get(today.isoformat(), 0)),
        "week_minutes": c.get("week_minutes"), "finish_by": c.get("finish_by"), "star_minutes": c.get("star_minutes") or 30,
        "last": state.get("last"),
    }
    out["stars"] = int(out["watched_s"] // 60 // out["star_minutes"])
    if c.get("finish_by") and total:
        try:
            weeks = max((dt.date.fromisoformat(c["finish_by"]) - today).days / 7, 1 / 7)
            out["pace_minutes"] = round(max(total - watched, 0) / 60 / weeks)
        except ValueError:
            pass
    return out


def load(cid):
    c = course(cid)
    state = _load_watched().get(cid, {})
    seen = state.get("videos", {})
    vids = videos(c)
    for v in vids:
        s = seen.get(v["id"], {})
        v.update({"dur": s.get("dur"), "pos": s.get("pos", 0), "seen": round(_seen(s)) if s else 0})
    return {"course": summary(c, state), "videos": vids}


def watch(body):
    """The page's report: stretches just played of one video, where it is now, and its length."""
    cid, rel = body["course"], body["video"]
    video_file(cid, rel)                                   # only real videos of a real course
    with _lock:
        doc = _load_watched()
        state = doc.setdefault(cid, {})
        v = state.setdefault("videos", {}).setdefault(rel, {"ranges": []})
        if body.get("dur"):
            v["dur"] = round(float(body["dur"]), 1)
        before = _seen(v)
        new = [r for r in body.get("ranges") or [] if isinstance(r, list) and len(r) == 2]
        if v.get("dur"):
            new = [[max(0.0, float(a)), min(float(b), v["dur"])] for a, b in new]
        v["ranges"] = _merge(v["ranges"] + new)
        added = max(_seen(v) - before, 0)
        if "pos" in body:
            v["pos"] = round(float(body["pos"]), 1)
            state["last"] = rel
        if added:
            day = dt.date.today().isoformat()
            state.setdefault("days", {})[day] = round(state.get("days", {}).get(day, 0) + added, 1)
        _save_watched(doc)
        return {"course": summary(course(cid), state), "seen": round(_seen(v))}


def durations(body):
    """Lengths the page read from the videos' headers (once per video), so totals are known before watching."""
    cid = body["course"]
    with _lock:
        doc = _load_watched()
        vs = doc.setdefault(cid, {}).setdefault("videos", {})
        for rel, dur in (body.get("durs") or {}).items():
            video_file(cid, rel)
            vs.setdefault(rel, {"ranges": []})["dur"] = round(float(dur), 1)
        _save_watched(doc)
        return {"course": summary(course(cid), doc[cid])}


# ---------------- notes ----------------
def _note_path(c, rel):
    root = c.get("notes", "")
    if not root:
        raise ValueError("no notes folder for this course")
    return _inside(root, os.path.splitext(rel)[0] + ".md")


def _starter(c, rel):
    title = os.path.splitext(rel.rsplit("/", 1)[-1])[0]
    section = rel.rsplit("/", 1)[0] if "/" in rel else ""
    q = lambda s: json.dumps(s, ensure_ascii=False)   # noqa: E731  (a quoted YAML string)
    return (f"---\ncourse: {q(c.get('name') or c.get('id'))}\nsection: {q(section)}\nvideo: {q(title)}\n---\n\n# {title}\n\n")


def note(cid, rel):
    c = course(cid)
    video_file(cid, rel)
    path = _note_path(c, rel)
    if not os.path.isfile(path):
        return {"exists": False, "text": _starter(c, rel), "mtime": 0, "file": path}
    with open(path, encoding="utf-8") as f:
        return {"exists": True, "text": f.read(), "mtime": os.path.getmtime(path), "file": path}


class Conflict(Exception):
    pass


def note_save(body):
    """Write one video's note. If the file changed since the page read it (edited in Obsidian), say so instead,
    unless the page asks to overwrite."""
    cid, rel = body["course"], body["video"]
    c = course(cid)
    video_file(cid, rel)
    path = _note_path(c, rel)
    if not os.path.isdir(c.get("notes", "")):
        raise ValueError("can't find the notes folder: check \"notes\" in data/profile.json")
    with _lock:
        if os.path.isfile(path) and not body.get("force") and abs(os.path.getmtime(path) - float(body.get("mtime") or 0)) > 0.001:
            raise Conflict(json.dumps(note(cid, rel)))
        os.makedirs(os.path.dirname(path), exist_ok=True)
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8", newline="") as f:
            f.write(body["text"])
        os.replace(tmp, path)
        return {"ok": True, "mtime": os.path.getmtime(path)}
