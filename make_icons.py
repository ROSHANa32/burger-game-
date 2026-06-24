"""Generate original burger app icons for the PWA / Play Store packaging."""
from PIL import Image, ImageDraw
import os

OUT = os.path.dirname(os.path.abspath(__file__))


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def draw_icon(size, maskable=False):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # background: warm vertical gradient, rounded square (or full bleed if maskable)
    top = (255, 196, 92)
    bot = (233, 121, 39)
    bg = Image.new("RGBA", (size, size))
    bd = ImageDraw.Draw(bg)
    for y in range(size):
        bd.line([(0, y), (size, y)], fill=lerp(top, bot, y / size) + (255,))

    if maskable:
        img.paste(bg, (0, 0))
    else:
        radius = int(size * 0.22)
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius, fill=255)
        img.paste(bg, (0, 0), mask)

    # burger geometry (centered). Maskable shrinks art into safe zone.
    s = size * (0.62 if maskable else 0.78)
    cx, cy = size / 2, size / 2 + size * 0.02
    r = s / 2

    def ellipse(c, rx, ry, fill):
        d.ellipse([c[0] - rx, c[1] - ry, c[0] + rx, c[1] + ry], fill=fill)

    # drop shadow
    ellipse((cx, cy + r * 0.62), r * 1.02, r * 0.28, (120, 60, 10, 90))

    # bottom bun
    d.rounded_rectangle(
        [cx - r * 0.98, cy + r * 0.18, cx + r * 0.98, cy + r * 0.62],
        radius=int(r * 0.4), fill=(216, 142, 63))
    # patty
    d.rounded_rectangle(
        [cx - r, cy - r * 0.02, cx + r, cy + r * 0.30],
        radius=int(r * 0.22), fill=(84, 47, 21))
    # cheese (zig zag)
    cheese = [
        (cx - r * 0.98, cy + r * 0.02), (cx + r * 0.98, cy + r * 0.02),
        (cx + r * 0.62, cy + r * 0.34), (cx + r * 0.30, cy + r * 0.12),
        (cx + r * 0.02, cy + r * 0.40), (cx - r * 0.30, cy + r * 0.12),
        (cx - r * 0.62, cy + r * 0.34), (cx - r * 0.86, cy + r * 0.10),
    ]
    d.polygon(cheese, fill=(255, 200, 61))
    # lettuce
    for i in range(-2, 3):
        ex = cx + i * r * 0.42
        d.pieslice([ex - r * 0.34, cy - r * 0.42, ex + r * 0.34, cy + r * 0.10],
                   180, 360, fill=(123, 192, 67))
    # top bun (dome)
    d.pieslice([cx - r, cy - r * 0.95, cx + r, cy + r * 0.55], 180, 360, fill=(242, 171, 83))
    d.rectangle([cx - r, cy - r * 0.18, cx + r, cy - r * 0.02], fill=(242, 171, 83))
    # gloss highlight
    d.ellipse([cx - r * 0.55, cy - r * 0.62, cx - r * 0.05, cy - r * 0.38],
              fill=(255, 230, 180, 150))
    # sesame seeds
    seeds = [(-0.45, -0.40), (-0.10, -0.55), (0.28, -0.45),
             (0.50, -0.20), (-0.62, -0.16), (0.06, -0.28), (-0.28, -0.18)]
    for sx, sy in seeds:
        px, py = cx + sx * r, cy + sy * r
        d.ellipse([px - r * 0.07, py - r * 0.11, px + r * 0.07, py + r * 0.11],
                  fill=(255, 247, 226))
    return img


for sz in (192, 512):
    draw_icon(sz).save(os.path.join(OUT, f"icon-{sz}.png"))

draw_icon(512, maskable=True).save(os.path.join(OUT, "icon-maskable-512.png"))
draw_icon(180).save(os.path.join(OUT, "apple-touch-icon.png"))
draw_icon(32).save(os.path.join(OUT, "favicon-32.png"))
print("icons written")
