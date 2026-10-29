"""The person this tracker belongs to: data/profile.json, plus the few things that differ per computer.

Everything personal lives in data/ (profile, jobs, resume library, kit, career pages, signature), so the code
can be shared without anyone's details in it (docs/SHARE-DESIGN.md).
"""
import json
import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
PROFILE = os.path.join(DATA, "profile.json")

DEFAULTS = {
    "name": "",
    "resume_look": "",        # the person's own .odt whose look the resumes copy; empty = the built-in look
    "scan_mode": "paste",     # "scheduled" (a Claude desktop task, Pro or higher) or "paste" (free plan)
    "fields": [],
    "cities": [],
    "hours": [],
    "stretch": True,
    "character": None,        # the townsperson in the street (D43): person() options, checked by clean_character()
}

# what a character may be made of: tracker/character-parts.json (the page builds its controls from the same file)
HEX = re.compile(r"^#[0-9a-f]{6}$")
PARTS = os.path.join(ROOT, "tracker", "character-parts.json")


def _parts():
    with open(PARTS, encoding="utf-8") as f:
        groups = json.load(f)["groups"]
    rows = [r for g in groups for r in g["rows"]]
    return ({r["key"] for r in rows if "colours" in r},
            {r["key"]: {c[0] for c in r["choices"]} for r in rows if "choices" in r},
            {r["key"] for r in rows if r.get("flag")})


def load():
    try:
        with open(PROFILE, encoding="utf-8") as f:
            return {**DEFAULTS, **json.load(f)}
    except FileNotFoundError:
        return dict(DEFAULTS)


def exists():
    return os.path.isfile(PROFILE)


def clean_character(c):
    """Only known parts with sane values, so the profile can't carry anything odd into the page."""
    if not isinstance(c, dict):
        raise ValueError("character must be an object")
    colours, choices, flags = _parts()
    out = {}
    for k, v in c.items():
        if k in colours and isinstance(v, str) and HEX.match(v.lower()):
            out[k] = v.lower()
        elif k in choices and isinstance(v, str) and v in choices[k] and v:
            out[k] = v
        elif k in flags and v is True:
            out[k] = True
        elif k == "preset" and isinstance(v, str) and re.match(r"^[a-z-]{1,24}$", v):
            out[k] = v
    return out


INTERVIEW = os.path.join(ROOT, "tracker", "interview.json")


def clean_prefs(p):
    """The job interview's answers (tracker/interview.json): known questions only, each answer of its kind."""
    if not isinstance(p, dict):
        raise ValueError("answers must be an object")
    with open(INTERVIEW, encoding="utf-8") as f:
        qs = {q["key"]: q for r in json.load(f)["rounds"] for q in r["questions"]}
    out = {}
    for k, v in p.items():
        q = qs.get(k)
        if not q:
            continue
        if q["kind"] == "text" and isinstance(v, str):
            out[k] = v.strip()[:600]
        elif q["kind"] == "pick" and v in q["options"]:
            out[k] = v
        elif q["kind"] == "multi" and isinstance(v, list):
            out[k] = [x for x in q["options"] if x in v][: q.get("max", 99)]
        elif q["kind"] in ("grid", "sort") and isinstance(v, dict):
            out[k] = {r: c for r, c in v.items() if r in q["rows"] and c in q["cols"]}
    return out


def save(patch):
    """Merge a change into data/profile.json (atomic): the character, or answers from the job interview."""
    if set(patch) - {"character", "prefs"}:
        raise ValueError("only the character and the interview answers can be changed here")
    prof = {}
    if os.path.isfile(PROFILE):
        with open(PROFILE, encoding="utf-8") as f:
            prof = json.load(f)
    if "character" in patch:
        prof["character"] = clean_character(patch["character"])
    if "prefs" in patch:
        prof["prefs"] = dict(prof.get("prefs") or {}, **clean_prefs(patch["prefs"]))
    os.makedirs(DATA, exist_ok=True)
    tmp = PROFILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(prof, f, indent=1, ensure_ascii=False)
    os.replace(tmp, PROFILE)
    return load()


def file_stem(name, what):
    """"Ada Lovelace" + "Resume" -> "Ada_Lovelace_Resume" (the name of the file an employer receives)."""
    words = "".join(c if c.isalnum() or c in " -" else " " for c in name).split()
    return "_".join(words + [what]) if words else what


def soffice():
    """LibreOffice's command on this computer, or None."""
    for path in (r"C:\Program Files\LibreOffice\program\soffice.exe",
                 r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
                 "/Applications/LibreOffice.app/Contents/MacOS/soffice"):
        if os.path.isfile(path):
            return path
    return shutil.which("soffice") or shutil.which("libreoffice")


def reveal(path):
    """Show a file in the system's file manager."""
    if sys.platform == "win32":
        subprocess.Popen(["explorer", "/select,", path])
    elif sys.platform == "darwin":
        subprocess.Popen(["open", "-R", path])
    else:
        subprocess.Popen(["xdg-open", os.path.dirname(path)])
