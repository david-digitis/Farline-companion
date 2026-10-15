"""Draws the plugin's provisional icons (the real ones are a later step): the game's dark
screen, a cut-corner frame, a mint or ink mark. Run once; the PNGs are committed.

    python tools/make-icons.py
"""
import pathlib

from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent / "plugin" / "com.david-digitis.farline-companion.sdPlugin" / "imgs"
BG = (15, 20, 25, 255)
INK = (236, 232, 225, 255)
MINT = (62, 230, 180, 255)
CLEAR = (0, 0, 0, 0)


def frame(draw, size, colour, width):
    cut = size // 8
    m = width
    points = [(m, m + cut), (m + cut, m), (size - m, m), (size - m, size - m - cut), (size - m - cut, size - m), (m, size - m)]
    draw.line(points + [points[0]], fill=colour, width=width, joint="curve")


def key(size, mark):
    img = Image.new("RGBA", (size, size), BG)
    d = ImageDraw.Draw(img)
    frame(d, size, MINT, max(2, size // 48))
    mark(d, size)
    return img


def icon(size, mark, background=CLEAR):
    img = Image.new("RGBA", (size, size), background)
    d = ImageDraw.Draw(img)
    mark(d, size)
    return img


def press_mark(d, s):   # a key pressed: a square inside a square
    a, b = s * 0.32, s * 0.68
    d.rectangle([a, a, b, b], outline=INK, width=max(1, s // 24))
    d.rectangle([s * 0.43, s * 0.43, s * 0.57, s * 0.57], fill=MINT)


def value_mark(d, s):   # a gauge: three bars
    w = max(2, s // 12)
    for i, h in enumerate((0.3, 0.5, 0.7)):
        x = s * (0.3 + i * 0.2)
        d.rectangle([x, s * (0.8 - h), x + w, s * 0.8], fill=MINT if i == 2 else INK)


def plugin_mark(d, s):   # the plugin: an F in a cut frame
    frame(d, s, MINT, max(2, s // 24))
    t = max(2, s // 10)
    d.rectangle([s * 0.36, s * 0.26, s * 0.36 + t, s * 0.74], fill=INK)
    d.rectangle([s * 0.36, s * 0.26, s * 0.68, s * 0.26 + t], fill=INK)
    d.rectangle([s * 0.36, s * 0.46, s * 0.6, s * 0.46 + t], fill=INK)


def save(img, rel):
    path = ROOT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path)
    print("wrote", path.relative_to(ROOT.parent.parent.parent))


for scale, suffix in ((1, ""), (2, "@2x")):
    save(icon(20 * scale, press_mark), f"actions/command{suffix}.png")
    save(icon(20 * scale, value_mark), f"actions/value{suffix}.png")
    save(key(72 * scale, press_mark), f"actions/command-key{suffix}.png")
    save(key(72 * scale, value_mark), f"actions/value-key{suffix}.png")
    save(icon(28 * scale, plugin_mark), f"plugin/category{suffix}.png")
    save(icon(256 * scale, plugin_mark, BG), f"plugin/marketplace{suffix}.png")
