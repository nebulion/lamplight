"""Command-line access to data/jobs.json, used by the daily scan.

  python app/jobs_cli.py list [--status inbox,queued]   # id | status | closes | url
  python app/jobs_cli.py urls                           # every known URL (for dedupe)
  python app/jobs_cli.py add FILE.json                  # one job object or a list
  python app/jobs_cli.py set ID field=value [...]       # e.g. status=closed
  python app/jobs_cli.py summary                        # what the lunch check-in needs
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import store  # noqa: E402

sys.stdout.reconfigure(encoding="utf-8")


def cmd_list(args):
    wanted = None
    if args[:1] == ["--status"]:
        wanted = set(args[1].split(","))
    for j in store.load()["jobs"]:
        if wanted and j["status"] not in wanted:
            continue
        print(f"{j['id']} | {j['status']} | {j.get('closes') or '-'} | {j.get('url', '')}")


def cmd_urls(_):
    for j in store.load()["jobs"]:
        if j.get("url"):
            print(j["url"])


def cmd_add(args):
    with open(args[0], encoding="utf-8") as f:
        jobs = json.load(f)
    if isinstance(jobs, dict):
        jobs = [jobs]

    def go(doc):
        out = []
        for job in jobs:
            job.setdefault("source", "daily scan")
            out.append((job.get("title"), store.add_job(doc, job)))
        return out

    for title, jid in store.change(go):
        print(f"added {jid}" if jid else f"skipped (already known): {title}")


def cmd_set(args):
    jid, pairs = args[0], args[1:]
    patch = {}
    for p in pairs:
        k, _, v = p.partition("=")
        patch[k] = json.loads(v) if v[:1] in "[{" else v
    store.change(lambda d: store.patch_job(d, jid, patch))
    print(f"updated {jid}: {patch}")


def cmd_summary(_):
    doc = store.load()
    s = doc["settings"]
    votes = doc["votes"]
    queued = [j for j in doc["jobs"] if j["status"] == "queued"]
    queued.sort(key=lambda j: (j.get("closes") or "9999", -(j.get("match") or 0)))
    is_open = [j for j in doc["jobs"]
               if j["status"] in ("inbox", "queued", "later") and j.get("fit") != "watch"]
    everyday = sum(1 for j in is_open if "everyday" in j.get("paths", []))
    open_jobs = len(is_open) - everyday          # career jobs; gyms/venues/outdoors have their own target
    target = s.get("jobs_target", 100)
    ev_target = s.get("everyday_target", 50)
    print(json.dumps({
        "today": store.today(),
        "votes_total": len(votes),
        "votes_today": sum(1 for v in votes if v["date"] == store.today()),
        "daily_target": s.get("daily_target", 5),
        "last_vote": votes[-1]["date"] if votes else None,
        "open_jobs": open_jobs,
        "jobs_target": target,
        "jobs_needed": max(target - open_jobs, 0),
        "everyday_open": everyday,
        "everyday_target": ev_target,
        "everyday_needed": max(ev_target - everyday, 0),
        "inbox_count": sum(1 for j in doc["jobs"] if j["status"] == "inbox"),
        "next_jobs": [{k: j.get(k) for k in ("employer", "title", "closes", "match", "why")}
                      for j in queued[:s.get("daily_target", 5)]],
    }, indent=1, ensure_ascii=False))


COMMANDS = {"list": cmd_list, "urls": cmd_urls, "add": cmd_add, "set": cmd_set, "summary": cmd_summary}

if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        print(__doc__)
        sys.exit(1)
    COMMANDS[sys.argv[1]](sys.argv[2:])
