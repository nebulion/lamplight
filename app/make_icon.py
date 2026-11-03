"""The project's icon, in every size, from the site's own tracker/favicon.svg (32 x 32 pixel art).

Writes assets/icon.ico (the desktop shortcut) and assets/icon.png, icon-128.png, icon-32.png (the README).
Run it after changing the favicon:  python app/make_icon.py
It reads only the plain shapes the favicon uses: <rect> and <path> with M, H, V, h, v, z.
"""
import os
import re
from xml.etree import ElementTree as ET

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SVG = os.path.join(ROOT, "tracker", "favicon.svg")
OUT = os.path.join(ROOT, "assets")
SIZE = 32


def hex_rgba(c):
    return tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


def polygons(d):
    """A path's closed shapes, as lists of corner points."""
    shapes, pts, x, y = [], [], 0.0, 0.0
    for cmd, arg in re.findall(r"([MHVhvz])([^MHVhvz]*)", d):
        nums = [float(n) for n in re.findall(r"-?\d+(?:\.\d+)?", arg)]
        if cmd == "M":
            if pts:
                shapes.append(pts)
            x, y = nums[0], nums[1]
            pts = [(x, y)]
        elif cmd == "z":
            shapes.append(pts)
            pts = []
        else:
            for n in nums:
                if cmd == "H":
                    x = n
                elif cmd == "V":
                    y = n
                elif cmd == "h":
                    x += n
                else:
                    y += n
                pts.append((x, y))
    if pts:
        shapes.append(pts)
    return shapes


def inside(px, py, shape):
    hit = False
    for (x1, y1), (x2, y2) in zip(shape, shape[1:] + shape[:1]):
        if (y1 > py) != (y2 > py) and px < x1 + (py - y1) * (x2 - x1) / (y2 - y1):
            hit = not hit
    return hit


def draw():
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    px = img.load()

    def shapes_in(el, fill):
        for child in el:
            tag = child.tag.split("}")[-1]
            colour = child.get("fill", fill)
            if tag == "g":
                shapes_in(child, colour)
            elif tag == "rect":
                x, y, w, h = (int(float(child.get(k))) for k in ("x", "y", "width", "height"))
                for yy in range(y, y + h):
                    for xx in range(x, x + w):
                        if 0 <= xx < SIZE and 0 <= yy < SIZE:
                            px[xx, yy] = hex_rgba(colour)
            elif tag == "path":
                for shape in polygons(child.get("d")):
                    for yy in range(SIZE):
                        for xx in range(SIZE):
                            if inside(xx + 0.5, yy + 0.5, shape):
                                px[xx, yy] = hex_rgba(colour)

    shapes_in(ET.parse(SVG).getroot(), None)
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    art = draw()
    big = art.resize((512, 512), Image.NEAREST)
    big.save(os.path.join(OUT, "icon.png"))
    art.resize((128, 128), Image.NEAREST).save(os.path.join(OUT, "icon-128.png"))
    art.save(os.path.join(OUT, "icon-32.png"))
    frames = [art.resize((s, s), Image.NEAREST if s % 32 == 0 else Image.BOX) for s in (256, 128, 96, 64, 48, 32, 24, 16)]
    frames[0].save(os.path.join(OUT, "icon.ico"), format="ICO", append_images=frames[1:], sizes=[f.size for f in frames])
    print("made", os.path.join(OUT, "icon.ico"))


if __name__ == "__main__":
    main()
