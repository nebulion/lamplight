"""Local server for the job tracker. Run: python app/server.py

Serves tracker/index.html at http://localhost:8765 and saves every change
to data/jobs.json. Listens on localhost only.
"""
import base64
import json
import os
import socket
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import finder  # noqa: E402
import firstrun  # noqa: E402
import person  # noqa: E402
import store  # noqa: E402
import make_resumes  # noqa: E402

PORT = 8765
WEB = os.path.join(store.ROOT, "tracker")
STATIC = {  # the only files the server hands out
    "index.html": "text/html; charset=utf-8",
    "style.css": "text/css; charset=utf-8",
    "app.js": "text/javascript; charset=utf-8",
    "scene.js": "text/javascript; charset=utf-8",
    "light.js": "text/javascript; charset=utf-8",
    "sound.js": "text/javascript; charset=utf-8",
    "render.js": "text/javascript; charset=utf-8",
    "resume.js": "text/javascript; charset=utf-8",
    "letter.js": "text/javascript; charset=utf-8",
    "character.js": "text/javascript; charset=utf-8",
    "character-parts.json": "application/json; charset=utf-8",
    "setup.js": "text/javascript; charset=utf-8",
    "interview.js": "text/javascript; charset=utf-8",
    "finder.js": "text/javascript; charset=utf-8",
    "interview.json": "application/json; charset=utf-8",
    "favicon.svg": "image/svg+xml",
    "scene3d.js": "text/javascript; charset=utf-8",
    "street3d.js": "text/javascript; charset=utf-8",
}
RESUMES = os.path.join(store.ROOT, "resumes")
PERSONAL = {  # the person's own files, from data/ (a new person has none yet)
    "kit.json": ("application/json; charset=utf-8", b"[]"),
    "paths.html": ("text/html; charset=utf-8", b""),   # none: no Career paths menu
}
VENDOR = os.path.join(WEB, "vendor")                      # three.js 0.160.0, served from here instead of a CDN (2026-10-28, speed)


def _inside_resumes(rel):
    """A path under resumes/ (folders allowed, nothing outside it)."""
    path = os.path.normpath(os.path.join(RESUMES, rel or ""))
    if not path.startswith(RESUMES + os.sep):
        raise ValueError("not a resume path")
    return path


def _reveal(body):
    path = _inside_resumes(body.get("file", ""))
    if not os.path.isfile(path):
        raise ValueError(f"no resume {body.get('file')}")
    person.reveal(path)
    return {"ok": True}


def _signature_save(body):
    url = body["png"]
    if not url.startswith("data:image/png;base64,"):
        raise ValueError("expected a PNG")
    data = base64.b64decode(url.split(",", 1)[1], validate=True)
    w, h = make_resumes.png_size(data)
    if len(data) > 2_000_000 or not (0 < w <= 4000 and 0 < h <= 2000):
        raise ValueError("signature image too large")
    tmp = make_resumes.SIGNATURE + ".tmp"
    with open(tmp, "wb") as f:
        f.write(data)
    os.replace(tmp, make_resumes.SIGNATURE)
    return {"result": {"ok": True, "v": int(os.path.getmtime(make_resumes.SIGNATURE))}}


def _resume_make(body, letter=False):
    job = None
    if body.get("job_id"):
        job = store.find_job(store.load(), body["job_id"])
    folder = "custom/" + make_resumes.slug(job["employer"] + " " + job["title"]) if job else "custom/general"
    out = _inside_resumes(folder)
    r = make_resumes.render_letter(body["content"], out) if letter else make_resumes.render(body["content"], out)
    if job:
        patch = {"cover_file": r["pdf"], "cover_spec": body.get("spec")} if letter else {"resume_file": r["pdf"], "resume_spec": body.get("spec")}
        store.change(lambda d: store.patch_job(d, job["id"], patch))
    return {"result": r, "data": store.load()}


# name -> handler(doc, body); each runs inside store.change
ACTIONS = {
    "add_job": lambda d, b: {"id": store.add_job(d, b["job"])},
    "patch_job": lambda d, b: store.patch_job(d, b["id"], b["patch"]),
    "patch_jobs": lambda d, b: [store.patch_job(d, i, b["patch"]) for i in b["ids"]],   # bulk: one save for many
    "vote": lambda d, b: store.add_vote(d, b["type"], b.get("job_id"), b.get("note", "")),
    "undo_vote": lambda d, b: store.undo_last_vote(d),
    "event": lambda d, b: store.add_event(d, b["type"], b.get("job_id"), b.get("note", "")),
    "settings": lambda d, b: d["settings"].update(b["patch"]) or d["settings"],
}


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"                         # keep connections open between requests (every reply has a Content-Length)

    def _send(self, code, body, ctype="application/json"):
        data = body if isinstance(body, bytes) else json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/api/data":
            return self._send(200, store.load())
        if path == "/api/profile":
            return self._send(200, {**person.load(), "exists": person.exists()})
        if path.lstrip("/") in PERSONAL:
            ctype, missing = PERSONAL[path.lstrip("/")]
            full = os.path.join(person.DATA, path.lstrip("/"))
            if os.path.isfile(full):
                with open(full, "rb") as f:
                    return self._send(200, f.read(), ctype)
            return self._send(200, missing, ctype) if missing is not None else self._send(404, {"error": "not found"})
        if path == "/api/resume":
            return self._send(200, make_resumes.load_lib())
        if path == "/api/signature":                        # is a signature on file (and its version, for the image URL)
            sig = make_resumes.SIGNATURE
            return self._send(200, {"exists": os.path.isfile(sig), "v": int(os.path.getmtime(sig)) if os.path.isfile(sig) else 0})
        if path == "/signature.png":
            if os.path.isfile(make_resumes.SIGNATURE):
                with open(make_resumes.SIGNATURE, "rb") as f:
                    return self._send(200, f.read(), "image/png")
            return self._send(404, {"error": "no signature"})
        if path.startswith("/sounds/"):                     # the Amsterdam recordings (see README credits)
            snd = os.path.basename(path)
            ctype = {".mp3": "audio/mpeg", ".ogg": "audio/ogg"}.get(os.path.splitext(snd)[1])
            full = os.path.join(WEB, "sounds", snd)
            if ctype and os.path.isfile(full):
                with open(full, "rb") as f:
                    return self._send(200, f.read(), ctype)
            return self._send(404, {"error": "not found"})
        if path.startswith("/vendor/"):                     # the three.js library files (only .js under tracker/vendor/)
            full = os.path.normpath(os.path.join(WEB, path.lstrip("/")))
            if full.startswith(VENDOR + os.sep) and full.endswith(".js") and os.path.isfile(full):
                with open(full, "rb") as f:
                    return self._send(200, f.read(), "text/javascript; charset=utf-8")
            return self._send(404, {"error": "not found"})
        name = "index.html" if path in ("/", "/index.html") else path.lstrip("/")
        if name in STATIC:
            with open(os.path.join(WEB, name), "rb") as f:
                return self._send(200, f.read(), STATIC[name])
        self._send(404, {"error": "not found"})

    def do_POST(self):
        # Reject requests from other sites (only our own page may write).
        origin = self.headers.get("Origin")
        if origin and origin not in (f"http://localhost:{PORT}", f"http://127.0.0.1:{PORT}", f"http://[::1]:{PORT}"):
            return self._send(403, {"error": "bad origin"})
        name = self.path.removeprefix("/api/")
        try:
            length = int(self.headers.get("Content-Length") or 0)
            body = json.loads(self.rfile.read(length) or b"{}")
            if name == "setup":                             # the first-run page's answers (a new person)
                return self._send(200, {"result": firstrun.start(body), "data": store.load()})
            if name == "resume_prompt":                     # the prompt they take to Claude with their resume
                return self._send(200, {"result": {"prompt": firstrun.resume_prompt(body.get("text"))}})
            if name == "resume_import":                     # Claude's answer, checked, becomes their resume library
                return self._send(200, {"result": firstrun.import_resume(body.get("reply"))})
            if name == "find_prompt":                       # free plans: a prompt for any Claude chat to find a batch of jobs
                return self._send(200, {"result": {"prompt": finder.find_prompt()}})
            if name == "jobs_import":                       # Claude's batch, checked job by job
                return self._send(200, {"result": finder.import_jobs(body.get("reply")), "data": store.load()})
            if name == "alerts_import":                     # a pasted job-alert email's links, as unchecked Inbox jobs
                return self._send(200, {"result": finder.import_alerts(body.get("html")), "data": store.load()})
            if name == "scan_prompt":                       # the interview's answers, for Claude to write their scan from
                return self._send(200, {"result": {"prompt": firstrun.scan_prompt()}})
            if name == "scan_save":                         # Claude's scan, checked, saved as data/SCAN.md
                return self._send(200, {"result": firstrun.scan_save(body.get("reply"))})
            if name == "profile":                           # the person's own settings (for now: their character, D43)
                return self._send(200, {"result": person.save(body["patch"])})
            if name == "reveal":
                return self._send(200, _reveal(body))
            if name == "resume_lib":                        # the builder saved the library (a new wording, a star...)
                make_resumes.save_lib(body["lib"])
                return self._send(200, {"result": {"ok": True}})
            if name == "resume_make":                       # lay out the PDF from the .odt (a few seconds), then link it to the job
                return self._send(200, _resume_make(body))
            if name == "letter_make":                       # the same for a cover letter
                return self._send(200, _resume_make(body, letter=True))
            if name == "signature_save":                    # the signature he drew: a PNG, kept in data/
                return self._send(200, _signature_save(body))
            if name == "signature_clear":
                if os.path.isfile(make_resumes.SIGNATURE):
                    os.remove(make_resumes.SIGNATURE)
                return self._send(200, {"result": {"ok": True}})
            if name not in ACTIONS:
                return self._send(404, {"error": f"unknown action {name}"})
            result = store.change(lambda d: ACTIONS[name](d, body))
            self._send(200, {"result": result, "data": store.load()})
        except (KeyError, ValueError, OSError, subprocess.SubprocessError) as e:
            self._send(400, {"error": str(e)})

    def log_message(self, *args):
        pass


class ThreadingHTTPServer6(ThreadingHTTPServer):
    address_family = socket.AF_INET6


def main():
    # Browsers try "localhost" over IPv6 first; with only an IPv4 listener each new connection waited ~210 ms for the
    # fallback (measured 2026-10-28). So it listens on both loopback addresses (never on the network).
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    try:
        server6 = ThreadingHTTPServer6(("::1", PORT), Handler)
        threading.Thread(target=server6.serve_forever, daemon=True).start()
    except OSError as e:
        print(f"(IPv6 loopback not available: {e})")
    print(f"Tracker running at http://localhost:{PORT}  (Ctrl+C to stop)")
    server.serve_forever()


if __name__ == "__main__":
    main()
