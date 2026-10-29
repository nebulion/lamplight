r"""Make the built-in resume look (app/template/resume-look.odt) from a person's own .odt.

  python app/make_template.py [their.odt]      default: the resume_look in data/profile.json

The resume builder copies the look of the person's own .odt. A new person may not have one, and the first user's can't be
shared: it embeds Microsoft fonts (Garamond, Cambria, Georgia) and Lucida Sans, its thumbnail is a picture of the
resume, and the name, contact, education and jobs are typed into it. This keeps the layout and styles and removes
everything else:
- every text is replaced: the name and contact line with placeholders, the degree and school with {{MARKERS}} that
  make_resumes.fill_education() fills from resume.json "education", the job and skill entries with neutral words (the
  builder rebuilds those from the library anyway);
- comments (the first user's held coursework), the thumbnail, the author and dates in meta.xml, and all embedded fonts are dropped;
- Garamond, Cambria and Georgia become Liberation Serif, Lucida Sans becomes Liberation Sans (they come with
  LibreOffice, which the PDFs need anyway).
Run once by the maintainer; the result is shipped. Check its output with a test profile (docs/SHARE-DESIGN.md).
"""
import os
import re
import sys
import zipfile

from lxml import etree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import person  # noqa: E402
import make_resumes  # noqa: E402

OUT = os.path.join(person.ROOT, "app", "template", "resume-look.odt")
T, OFF = make_resumes.T, "{%s}" % make_resumes.NS["office"]
SERIF_SWAP = {"Garamond": "Liberation Serif", "Cambria": "Liberation Serif", "Georgia": "Liberation Serif", "Lucida Sans": "Liberation Sans"}


def swap_fonts(xml):
    for old, new in SERIF_SWAP.items():
        xml = xml.replace(old, new)
    return xml


def neutral(el, word):
    """Every text and tail under el that has letters becomes word (spacing and tabs are kept)."""
    for node in el.iter():
        if node.text and node.text.strip():
            node.text = word
        if node is not el and node.tail and node.tail.strip():
            node.tail = " "


def content(xml):
    root = etree.fromstring(xml)
    make_resumes.strip_comments(root)
    body = root.find(".//%stext" % OFF)
    paras = [el for el in body if el.tag == T + "p"]
    name_p, contact_p, _, degree_p, school_p = paras[:5]
    make_resumes.set_para_text(name_p, "Your Name")
    last = contact_p.findall(T + "span")[-1]
    for el in list(contact_p):
        if el is not last:
            contact_p.remove(el)
    contact_p.text = None
    span = etree.Element(T + "span"); span.set(T + "style-name", last.get(T + "style-name")); span.text = "you@example.com | (555) 010-0000 | "
    last.addprevious(span); last.text = "City, ST"
    # education (its heading paragraph stays): degree and date; school and GPA
    d = [s for s in degree_p.iter(T + "span") if s.text and s.text.strip()]
    d[0].text, d[-1].text = "{{DEGREE}}", "{{EDU_DATE}}"
    sc = [s for s in school_p.iter(T + "span") if s.text and s.text.strip()]
    sc[0].text, sc[-1].text = "{{SCHOOL}}", "{{GPA_LINE}}"
    for sec in list(body.iter(T + "section")):
        name = sec.get(T + "name") or ""
        if name.startswith("Job_") and name != "Job_ElectionLab":   # one job entry stays, as the shape the builder copies
            sec.getparent().remove(sec)
            continue
        if name == "Job_ElectionLab":
            sec.set(T + "name", "Job_Template")             # (its old name named a job)
        if name == "Section3":                              # the languages line: keep its "Spoken Languages:" label
            spans = [sp for sp in sec.iter(T + "span") if sp.text and sp.text.strip()]
            spans[-1].text = "Text"
        else:
            neutral(sec, "Text")
    data = etree.tostring(root, xml_declaration=True, encoding="UTF-8").decode("utf-8")
    left = [w for w in personal_words() if w in data]
    if left:
        raise SystemExit("personal text left in the template: %s" % left)
    return swap_fonts(strip_fonts_decls(data)).encode("utf-8")


def personal_words():
    """Whole names that would give the look file's owner away (their name, email, phone, city, school, employers),
    from their profile and resume library."""
    lib = make_resumes.load_lib()
    h, e = lib.get("header", {}), lib.get("education") or {}
    words = [person.load().get("name", ""), h.get("name", ""), h.get("location", ""), e.get("school", "").split("|")[0]]
    words += [x.strip() for x in h.get("contact", "").split("|")] + [x.get("employer", "") for x in lib.get("entries", [])]
    words += [w for n in (h.get("name", ""),) for w in n.split() if len(w) > 2]
    return {w.strip() for w in words if len(w.strip()) > 3}


def strip_fonts_decls(xml):
    """Drop embedded-font references to the removed font files (font-face-src blocks pointing into Fonts/)."""
    return re.sub(r"<svg:font-face-src>.*?</svg:font-face-src>", "", xml, flags=re.S)


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else person.load()["resume_look"]
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    zin = zipfile.ZipFile(src)
    with zipfile.ZipFile(OUT, "w") as zout:
        for info in zin.infolist():
            n = info.filename
            if n.startswith("Thumbnails/") or n.startswith("Fonts/"):   # no embedded fonts at all (Liberation comes with LibreOffice)
                continue
            data = zin.read(n)
            if n == "content.xml":
                data = content(data)
            elif n == "styles.xml":
                data = swap_fonts(strip_fonts_decls(data.decode("utf-8"))).encode("utf-8")
            elif n == "meta.xml":
                data = re.sub(rb"<dc:creator>.*?</dc:creator>|<meta:initial-creator>.*?</meta:initial-creator>|<dc:date>.*?</dc:date>|<meta:creation-date>.*?</meta:creation-date>|<meta:printed-by>.*?</meta:printed-by>", b"", data)
            elif n == "settings.xml":
                data = re.sub(rb'<config:config-item config:name="PrinterName"[^>]*>[^<]*</config:config-item>', b"", data)
            elif n == "META-INF/manifest.xml":
                data = re.sub(rb'\s*<manifest:file-entry manifest:full-path="(Thumbnails/[^"]*|Fonts/[^"]*)"[^>]*/>', b"", data)
            comp = zipfile.ZIP_STORED if n == "mimetype" else zipfile.ZIP_DEFLATED
            zout.writestr(info, data, compress_type=comp)
    print("wrote", OUT)


if __name__ == "__main__":
    main()
