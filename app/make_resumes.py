r"""Lay out resumes in the look of the person's own .odt.

  python app/make_resumes.py           rebuild the preset resumes

Reads  the .odt named by "resume_look" in data/profile.json (never modified) for the look,
       data/resume.json (the library: every job, bullet, wording, project, skill line, and the presets).
Writes resumes/<Folder>/<First>_<Last>_Resume.odt and .pdf (PDF via LibreOffice). Short, plain file names,
so the file an employer receives looks normal; the folder says which version it is.
The site's resume builder calls render() with any selection (custom resumes go to resumes/custom/<job>/).
"""
import copy
import json
import os
import re
import subprocess
import zipfile

import pathlib

import pypdf
from lxml import etree

import person

ROOT = person.ROOT
OUT = os.path.join(ROOT, "resumes")
LIB = os.path.join(ROOT, "data", "resume.json")
# a LibreOffice profile of its own, so converting works even while LibreOffice is open
LO_PROFILE = pathlib.Path(ROOT, "data", "lo-profile").as_uri()


TEMPLATE = os.path.join(ROOT, "app", "template", "resume-look.odt")   # the built-in look (app/make_template.py)


def master():
    """The .odt whose look every resume copies: the person's own (never modified), else the built-in one."""
    path = person.load()["resume_look"]
    if not path:
        return TEMPLATE
    if not os.path.isfile(path):
        raise ValueError("No resume look file at %s: fix resume_look in data/profile.json, or clear it to use the built-in look" % path)
    return path


def stem(what):
    return person.file_stem(person.load()["name"], what)

NS = {
    "text": "urn:oasis:names:tc:opendocument:xmlns:text:1.0",
    "office": "urn:oasis:names:tc:opendocument:xmlns:office:1.0",
    "loext": "urn:org:documentfoundation:names:experimental:office:xmlns:loext:1.0",
}
T = "{%s}" % NS["text"]
LOEXT = "{%s}" % NS["loext"]

def strip_comments(root):
    for tag in ("annotation", "annotation-end"):
        for el in list(root.iter("{%s}%s" % (NS["office"], tag))):
            parent = el.getparent()
            if el.tail:
                prev = el.getprevious()
                if prev is not None:
                    prev.tail = (prev.tail or "") + el.tail
                else:
                    parent.text = (parent.text or "") + el.tail
            parent.remove(el)


def bullet(text):
    li = etree.Element(T + "list-item")
    p = etree.SubElement(li, T + "p")
    p.set(T + "style-name", "P10")
    p.set(LOEXT + "marker-style-name", "T12")
    span = etree.SubElement(p, T + "span")
    span.set(T + "style-name", "T7")
    span.text = text
    return li


def set_para_text(p, text):
    spans = p.findall(T + "span")
    spans[0].text = text
    for s in spans[1:]:
        p.remove(s)


def find_section(root, name):
    return root.find(".//%ssection[@%sname='%s']" % (T, T, name))


def set_bullets(sec, texts):
    lst = sec.find(T + "list")
    for li in list(lst):
        lst.remove(li)
    for t in texts:
        lst.append(bullet(t))


def job_section(template, name, job):
    """A new job/project entry shaped exactly like an existing one: title<tab>dates, employer<tab>tools, bullets."""
    sec = copy.deepcopy(template)
    sec.set(T + "name", name)
    head, sub = sec.findall(T + "p")[:2]
    spans = head.findall(T + "span")
    spans[0].text = job["title"]                      # its <text:tab/> child stays
    spans[1].text = job.get("dates", "")
    span = sub.find(T + "span")
    span.text = job.get("employer", "")
    tab = span.find(T + "tab")
    for el in list(tab.itersiblings()):
        span.remove(el)
    tab.tail = job.get("tools", "")
    set_bullets(sec, job["bullets"])
    return sec


def load_lib():
    with open(LIB, encoding="utf-8") as f:
        return json.load(f)


def save_lib(lib):
    tmp = LIB + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(lib, f, ensure_ascii=False, indent=1)
    os.replace(tmp, LIB)


def resolve(lib, spec):
    """A selection (ids, chosen wordings, one-off edits) -> the text that goes on the page.
    A bullet ref is "id" for its main wording or "id~2" for its second wording; spec["edits"][ref] overrides."""
    entries = {e["id"]: e for e in lib["entries"]}
    skills = {s["id"]: s for s in lib["skills"]}
    edits = spec.get("edits", {})

    def entry(sel):
        e = entries[sel["id"]]
        bmap = {b["id"]: b for b in e["bullets"]}
        texts = []
        for ref in sel["bullets"]:
            bid, _, alt = ref.partition("~")
            b = bmap[bid]
            texts.append(edits.get(ref) or (b["alts"][int(alt) - 1] if alt else b["text"]))
        return {"title": sel.get("title") or e["title"], "dates": e.get("dates", ""), "employer": e.get("employer", ""),
                "tools": sel.get("tools", e.get("tools", "")), "bullets": texts}
    return {
        "location": spec.get("location") or lib["header"]["location"],
        "projectsFirst": bool(spec.get("projectsFirst")),
        "experience": [entry(s) for s in spec.get("entries", [])],
        "projects": [entry(s) for s in spec.get("projects", [])],
        "skills": [{"label": s.get("label") or skills[s["id"]]["label"], "text": s.get("text") or skills[s["id"]]["text"]} for s in spec.get("skills", [])],
        "languages": spec.get("languages") or lib["languages"],
    }


def fill_header(root, c):
    """The look file's first two paragraphs: the name, then "contact | location" with the location in the last span.
    Name and contact come from the library's header; text that already matches is left alone, so the look's own
    spans and styling stay exactly as they are."""
    h = load_lib()["header"]
    body = root.find(".//{%s}text" % NS["office"])
    name_p, contact_p = [el for el in body if el.tag == T + "p"][:2]
    if "".join(name_p.itertext()).strip() != h["name"]:
        set_para_text(name_p, h["name"])
    last = contact_p.findall(T + "span")[-1]
    full, loc = "".join(contact_p.itertext()), "".join(last.itertext())
    if full[:len(full) - len(loc)] != h["contact"] + " | ":        # (the email may sit inside a mailto link)
        style = next(contact_p.iter(T + "span")).get(T + "style-name")
        for el in list(contact_p):
            if el is not last:
                contact_p.remove(el)
        contact_p.text = None
        span = etree.Element(T + "span")
        span.set(T + "style-name", style)
        span.text = h["contact"] + " | "
        last.addprevious(span)
    last.text = c["location"]


def fill_education(root):
    """The built-in look's {{DEGREE}}, {{EDU_DATE}}, {{SCHOOL}}, {{GPA_LINE}} from resume.json "education". A person's own
    look has its education typed in and no markers, so nothing changes there."""
    e = load_lib().get("education") or {}
    vals = {"{{DEGREE}}": e.get("degree", ""), "{{EDU_DATE}}": e.get("date", ""), "{{SCHOOL}}": e.get("school", ""),
            "{{GPA_LINE}}": ("GPA: " + e["gpa"]) if e.get("gpa") else ""}
    for node in root.iter(T + "span"):
        if node.text in vals:
            node.text = vals[node.text]


def _heading(root, word):
    for p in root.iter(T + "p"):
        if p.get(T + "style-name") == "P5" and "".join(p.itertext()).strip().startswith(word):
            return p
    raise ValueError("no heading " + word)


def build_custom(content_xml, c):
    """The master's own paragraphs and styles, refilled: header location, experience, projects, skills."""
    root = etree.fromstring(content_xml)
    strip_comments(root)
    fill_header(root, c)
    fill_education(root)
    template = find_section(root, "Job_Template")
    if template is None:
        template = find_section(root, "Job_ElectionLab")   # his own .odt's entry (the built-in look's is Job_Template)
    template = copy.deepcopy(template)
    for sec in list(root.iter(T + "section")):
        if (sec.get(T + "name") or "").startswith("Job_"):
            sec.getparent().remove(sec)
    exp_h, skills_h = _heading(root, "EXPERIENCE"), _heading(root, "SKILLS")

    def place(after, entries, prefix):
        for i, job in enumerate(entries):
            sec = job_section(template, "%s%d" % (prefix, i), job)
            if i == 0:
                sec.findall(T + "p")[0].set(T + "style-name", "P6")   # no gap above the first entry under a heading
            after.addnext(sec)
            after = sec
    place(exp_h, c["experience"], "Job_")
    if c["projects"]:
        ph = copy.deepcopy(exp_h)
        for node in ph.iter():
            if node.text and "EXPERIENCE" in node.text:
                node.text = node.text.replace("EXPERIENCE", "PROJECTS")
        (exp_h if c["projectsFirst"] else skills_h).addprevious(ph)
        place(ph, c["projects"], "Project_")
    # skills: label + text pairs, a small spacer between them, then languages
    ts, s1 = find_section(root, "TextSection"), find_section(root, "Section1")
    label_t, value_t = [copy.deepcopy(p) for p in ts.findall(T + "p")[:2]]
    spacer = copy.deepcopy(s1.findall(T + "p")[0])
    for p in list(ts):
        ts.remove(p)
    for i, line in enumerate(c["skills"]):
        if i:
            ts.append(copy.deepcopy(spacer))
        for tpl, text in ((label_t, line["label"]), (value_t, line["text"])):
            p = copy.deepcopy(tpl)
            set_para_text(p, text)
            ts.append(p)
    s1.getparent().remove(s1)
    lang = find_section(root, "Section3").find(T + "p").findall(T + "span")
    lang[-1].text = c["languages"]
    return etree.tostring(root, xml_declaration=True, encoding="UTF-8")


def slug(s):
    return re.sub(r"[^A-Za-z0-9]+", "-", s).strip("-")[:60] or "resume"


SIGNATURE = os.path.join(os.path.dirname(LIB), "signature.png")   # drawn on the Cover letter page
SIG_H = 0.55                                                        # inches tall on the page


def png_size(data):
    """(width, height) from a PNG's header."""
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("not a PNG")
    return int.from_bytes(data[16:20], "big"), int.from_bytes(data[20:24], "big")


def build_letter(content_xml, c):
    """A business letter in the master's fonts (Garamond 12 pt): sender block, date, recipient block, a "Re:" line,
    greeting, paragraphs, closing and name, left-aligned, at 1-inch side margins (0.5 in page margin + 0.5 in indent),
    115% line spacing, a blank line between blocks."""
    root = etree.fromstring(content_xml)
    strip_comments(root)
    ST = "{urn:oasis:names:tc:opendocument:xmlns:style:1.0}"
    FO = "{urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0}"
    auto = root.find("{%s}automatic-styles" % NS["office"])
    st = etree.SubElement(auto, ST + "style")
    st.set(ST + "name", "PLetter"); st.set(ST + "family", "paragraph"); st.set(ST + "parent-style-name", "normal")
    pp = etree.SubElement(st, ST + "paragraph-properties")
    for k, v in (("margin-left", "0.5in"), ("margin-right", "0.5in"), ("margin-top", "0in"), ("margin-bottom", "0in"), ("line-height", "115%"), ("text-align", "start")):
        pp.set(FO + k, v)
    body = root.find(".//{%s}text" % NS["office"])
    for el in list(body):
        if etree.QName(el).localname != "sequence-decls":
            body.remove(el)

    def para(text="", bold=False):
        p = etree.SubElement(body, T + "p")
        p.set(T + "style-name", "PLetter")
        if text:
            span = etree.SubElement(p, T + "span")
            span.set(T + "style-name", "T1" if bold else "T7")
            span.text = text
    para()                                   # with the 0.5 in page margin: about an inch from the top
    for line in c["sender"]:
        para(line)
    para(); para(c["date"]); para()
    for line in c["recipient"]:
        para(line)
    para(); para(c["subject"], bold=True); para(); para(c["greeting"]); para()
    for text in c["paragraphs"]:
        para(text)
        para()
    para(c["closing"])
    if c.get("signature_size"):                  # the drawn signature, in the space the blank lines used to leave
        w, h = c["signature_size"]
        DR, SV, XL = (root.nsmap[k] for k in ("draw", "svg", "xlink"))
        gs = etree.SubElement(auto, ST + "style"); gs.set(ST + "name", "frSig"); gs.set(ST + "family", "graphic")
        gp = etree.SubElement(gs, ST + "graphic-properties")
        gp.set(ST + "vertical-pos", "top"); gp.set(ST + "vertical-rel", "baseline")
        p = etree.SubElement(body, T + "p"); p.set(T + "style-name", "PLetter")
        fr = etree.SubElement(p, "{%s}frame" % DR)
        fr.set("{%s}style-name" % DR, "frSig"); fr.set("{%s}name" % DR, "Signature"); fr.set(T + "anchor-type", "as-char")
        fr.set("{%s}width" % SV, "%.3fin" % min(2.6, SIG_H * w / h)); fr.set("{%s}height" % SV, "%.3fin" % SIG_H); fr.set("{%s}z-index" % DR, "0")
        im = etree.SubElement(fr, "{%s}image" % DR)
        im.set("{%s}href" % XL, "Pictures/signature.png"); im.set("{%s}type" % XL, "simple")
        im.set("{%s}show" % XL, "embed"); im.set("{%s}actuate" % XL, "onLoad")
    else:
        para(); para()
    para(c["name"])
    return etree.tostring(root, xml_declaration=True, encoding="UTF-8")


def render_letter(content, outdir):
    content = dict(content)
    content.pop("signature_size", None)
    extra = {}
    if content.get("signature") and os.path.isfile(SIGNATURE):
        with open(SIGNATURE, "rb") as f:
            extra["Pictures/signature.png"] = f.read()
        content["signature_size"] = png_size(extra["Pictures/signature.png"])
    return render(content, outdir, build_letter, stem("Cover_Letter"), extra)


def render(content, outdir, builder=None, name=None, extra=None):
    """Write <outdir>/<stem>.odt and .pdf (a resume unless told otherwise); return the PDF's path (relative to resumes/) and its page count."""
    os.makedirs(outdir, exist_ok=True)
    name = name or stem("Resume")
    with zipfile.ZipFile(master()) as z:
        xml = z.read("content.xml")
        parts = [(i, z.read(i.filename)) for i in z.infolist()]
    odt = os.path.join(outdir, name + ".odt")
    with zipfile.ZipFile(odt, "w") as out:
        for info, data in parts:
            if info.filename == "content.xml":
                data = (builder or build_custom)(xml, content)
            if info.filename == "META-INF/manifest.xml" and extra:   # list added pictures
                data = data.replace(b"</manifest:manifest>", b"".join(
                    b' <manifest:file-entry manifest:full-path="%s" manifest:media-type="image/png"/>\n' % k.encode() for k in extra) + b"</manifest:manifest>")
            comp = zipfile.ZIP_STORED if info.filename == "mimetype" else zipfile.ZIP_DEFLATED
            out.writestr(info.filename, data, compress_type=comp)
        for name, data in (extra or {}).items():
            out.writestr(name, data, compress_type=zipfile.ZIP_STORED)
    soffice = person.soffice()
    if not soffice:
        raise ValueError("LibreOffice isn't installed (it makes the PDFs): get it from libreoffice.org")
    subprocess.run([soffice, "-env:UserInstallation=" + LO_PROFILE, "--headless", "--convert-to", "pdf", "--outdir", outdir, odt],
                   check=True, capture_output=True, timeout=180)
    pdf = os.path.join(outdir, name + ".pdf")
    return {"pdf": os.path.relpath(pdf, OUT).replace("\\", "/"), "pages": len(pypdf.PdfReader(pdf).pages)}


def main():
    lib = load_lib()
    for key, preset in lib["presets"].items():
        r = render(resolve(lib, preset), os.path.join(OUT, preset["folder"]))
        print(key, r["pdf"], r["pages"], "page" if r["pages"] == 1 else "PAGES: too long")


if __name__ == "__main__":
    main()
