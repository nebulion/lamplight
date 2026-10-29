"""Shared read/write logic for data/jobs.json.

Used by server.py (the tracker) and jobs_cli.py (the daily scan).
Every change re-reads the file from disk first, so the browser and the
scan never overwrite each other's work.
"""
import datetime as dt
import json
import os
import re
import shutil
import threading

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data", "jobs.json")
BACKUPS = os.path.join(ROOT, "data", "backups")
KEEP_BACKUPS = 30

VOTE_TYPES = {"application", "agency", "followup"}
EVENT_TYPES = {"opened", "exam"}
STATUSES = {"inbox", "queued", "later", "applied", "skipped", "closed"}
OUTCOMES = {None, "", "no_reply", "response", "interview", "offer", "rejected", "withdrew"}
JOB_FIELDS = {
    "title", "employer", "url", "paths", "fit", "pay", "closes", "closes_text",
    "resume", "why", "status", "source", "notes", "outcome", "skip_reason",
    "location", "tag", "match", "salary_min", "speed", "toward_planning",
    "email_used", "resume_file", "resume_spec",   # resume_*: the custom resume made for this job in the builder
    "cover_letter", "cover_file", "cover_spec",   # cover_letter: the posting asks for one; cover_*: the letter made in the builder
    "want",                                       # how much they want it (ideal / good / fallback), from their scan (D42)
}
WANTS = {"ideal", "good", "fallback"}
# a new person's empty tracker (the first-run page fills in the settings)
EMPTY = {
    "version": 1,
    "settings": {"daily_target": 5, "daily_floor": 1, "jobs_target": 100, "everyday_target": 0,
                 "email": "", "cue": "", "intention": "", "identity": ""},
    "resumes": {}, "jobs": [], "votes": [], "events": [],
}

_lock = threading.Lock()


def today():
    return dt.date.today().isoformat()


def load():
    if not os.path.exists(DATA):
        os.makedirs(os.path.dirname(DATA), exist_ok=True)
        save(json.loads(json.dumps(EMPTY)))
    with open(DATA, encoding="utf-8") as f:
        return json.load(f)


def _backup():
    os.makedirs(BACKUPS, exist_ok=True)
    dest = os.path.join(BACKUPS, f"jobs-{today()}.json")
    if not os.path.exists(dest) and os.path.exists(DATA):
        shutil.copy2(DATA, dest)
    old = sorted(f for f in os.listdir(BACKUPS) if f.startswith("jobs-"))
    for name in old[:-KEEP_BACKUPS]:
        os.remove(os.path.join(BACKUPS, name))


def save(doc):
    _backup()
    tmp = DATA + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(doc, f, indent=1, ensure_ascii=False)
    os.replace(tmp, DATA)


def change(fn):
    """Load, apply fn(doc), save. Returns whatever fn returns."""
    with _lock:
        doc = load()
        result = fn(doc)
        save(doc)
        return result


def find_job(doc, job_id):
    for j in doc["jobs"]:
        if j["id"] == job_id:
            return j
    raise KeyError(f"no job {job_id}")


def slug(text):
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return s[:60] or "job"


def norm_url(url):
    return (url or "").strip().rstrip("/").lower()


def base_email(doc):
    """The address they apply with. (Per-job +tags were removed on 2026-10-27: he stopped using them.)"""
    return doc["settings"].get("email", "")


def add_job(doc, job):
    url = norm_url(job.get("url"))
    if url:
        for j in doc["jobs"]:
            if norm_url(j.get("url")) == url:
                return None  # already known
    base = slug(f"{job.get('employer', '')} {job.get('title', '')}")
    ids = {j["id"] for j in doc["jobs"]}
    jid, n = base, 2
    while jid in ids:
        jid, n = f"{base}-{n}", n + 1
    rec = {k: v for k, v in job.items() if k in JOB_FIELDS}
    if rec.get("want") not in WANTS:
        rec.pop("want", None)
    rec.setdefault("status", "inbox")
    rec.setdefault("paths", [])
    rec.setdefault("fit", "now")
    rec.setdefault("source", "manual")
    if rec["status"] not in STATUSES:
        raise ValueError(f"bad status {rec['status']}")
    rec["id"] = jid
    rec["added"] = today()
    doc["jobs"].append(rec)
    return jid


def patch_job(doc, job_id, patch):
    job = find_job(doc, job_id)
    for k, v in patch.items():
        if k not in JOB_FIELDS:
            raise ValueError(f"field {k} not editable")
        if k == "status" and v not in STATUSES:
            raise ValueError(f"bad status {v}")
        if k == "want" and v not in WANTS:
            raise ValueError(f"want must be one of {sorted(WANTS)}")
        if k == "outcome" and v not in OUTCOMES:
            raise ValueError(f"bad outcome {v}")
        job[k] = v
    if patch.get("status") == "applied" and not job.get("applied_date"):
        job["applied_date"] = today()
    return job


def add_vote(doc, vtype, job_id=None, note=""):
    if vtype not in VOTE_TYPES:
        raise ValueError(f"bad vote type {vtype}")
    vote = {"date": today(), "type": vtype, "job_id": job_id, "note": note}
    doc["votes"].append(vote)
    if vtype == "application" and job_id:
        job = patch_job(doc, job_id, {"status": "applied"})
        job.setdefault("email_used", base_email(doc))   # keep one he typed in by hand
    return vote


def undo_last_vote(doc):
    if not doc["votes"]:
        return None
    vote = doc["votes"].pop()
    if vote["type"] == "application" and vote.get("job_id"):
        try:
            job = find_job(doc, vote["job_id"])
            job["status"] = "queued"
            job.pop("applied_date", None)
            job.pop("email_used", None)
        except KeyError:
            pass
    return vote


def add_event(doc, etype, job_id=None, note=""):
    if etype not in EVENT_TYPES:
        raise ValueError(f"bad event type {etype}")
    ev = {"date": today(), "type": etype, "job_id": job_id, "note": note}
    doc["events"].append(ev)
    return ev
