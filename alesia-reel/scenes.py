"""All the shots of the reel. Each scene is f(t, c) -> 1080x1920 RGB image, t = global seconds."""
import math
import os
from functools import lru_cache
import numpy as np
from PIL import Image, ImageDraw
import art
from art import W, H, OUT, WHITE, BLACK, RED, RED_B, RED_D, GOLD, GOLD_D, SILVER, GREEN, BLUE, CREAM, blit, figure, text, outline
import sprites as sp
import world
import mapart as ma
from mapart import FW, FH, Painter, blob, partial, arrow, bezier

S3 = 3  # base -> full scale


# ---------------------------------------------------------------- small utils
def clamp01(x):
    return max(0.0, min(1.0, x))


def prog(t, a, b):
    return clamp01((t - a) / max(1e-6, b - a))


def ease(x):
    x = clamp01(x)
    return x * x * (3 - 2 * x)


def back(x):
    """ease-out with overshoot, for pops."""
    x = clamp01(x)
    c = 1.9
    return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2


def base(col=(0, 0, 0)):
    return Image.new("RGBA", (W, H), (*col, 255))


def up(img):
    return img.convert("RGB").resize((FW, FH), Image.NEAREST)


def tag(img, x, y, s, size=10, fg=WHITE, bg=(30, 22, 38), f="press", anchor="mm", pad=4, border=None):
    tw, th = art.text_size(s, size, f)
    d = ImageDraw.Draw(img)
    if anchor == "mm":
        x0, y0 = x - tw // 2 - pad, y - th // 2 - pad
    else:
        x0, y0 = x, y
    d.rectangle([x0, y0, x0 + tw + pad * 2, y0 + th + pad * 2 + 1], fill=bg, outline=border or OUT)
    text(img, (x0 + pad, y0 + pad), s, size, fg, f, "lt", outline=None)
    return x0, y0, tw + pad * 2, th + pad * 2


def bubble(img, x, y, w, h, tail=(0, 12), think=False):
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([x, y, x + w, y + h], radius=6, fill=WHITE, outline=OUT, width=1)
    tx, ty = x + w // 2 + tail[0], y + h
    if think:
        for i, r in enumerate([4, 3, 2]):
            cx, cy = tx + tail[0] * 0.3 * i, ty + 5 + i * 7
            d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=WHITE, outline=OUT)
    else:
        d.polygon([(tx - 5, ty), (tx + 5, ty), (tx + tail[0], ty + tail[1])], fill=WHITE, outline=OUT)
        d.line([(tx - 4, ty), (tx + 4, ty)], fill=WHITE)


def shake(img, amt, t, seed=0):
    if amt <= 0:
        return img
    rng = np.random.RandomState(int(t * 60) + seed)
    dx, dy = rng.randint(-amt, amt + 1, 2)
    out = Image.new(img.mode, img.size, (0, 0, 0))
    out.paste(img, (int(dx), int(dy)))
    return out


def stage(t, horizon=300, seed=0, **kw):
    img = base()
    world.sky_scene(img, t, horizon=horizon, seed=seed, **kw)
    return img


def health_bar(img, x, y, frac, label="MOUSTACHE"):
    d = ImageDraw.Draw(img)
    text(img, (x, y - 11), label, 8, WHITE, "press", "lt")
    d.rectangle([x, y, x + 72, y + 8], fill=(40, 30, 40), outline=OUT)
    col = (90, 220, 90) if frac > 0.5 else ((250, 200, 50) if frac > 0.25 else (240, 60, 60))
    d.rectangle([x + 1, y + 1, x + 1 + int(70 * frac), y + 7], fill=col)
    d.line([(x + 1, y + 2), (x + int(70 * frac), y + 2)], fill=tuple(min(255, c + 60) for c in col))
    blit(img, sp.heart(frac > 0), x - 10, y, 1, anchor="lt")


# ---------------------------------------------------------------- portraits for map dialogue
def portrait(kind, mouth, face="normal", name="", col=RED, seed=3, curl=0.0, head=0):
    s = 4
    fig = figure(kind, mouth=mouth, face=face, seed=seed, curl=curl, head=head)
    crop = fig.crop((4, 0, 30, 26))
    panel = Image.new("RGBA", (30, 34), (0, 0, 0, 0))
    d = ImageDraw.Draw(panel)
    d.rectangle([0, 0, 29, 33], fill=(36, 30, 48), outline=col)
    d.rectangle([1, 1, 28, 25], fill=tuple(int(c * 0.45 + 60) for c in col))
    panel.alpha_composite(crop, (2, 0))
    big = panel.resize((30 * s, 34 * s), Image.NEAREST)
    d = ImageDraw.Draw(big)
    text(big, (60, 116), name, 8 * 2, WHITE, "press", "mm", outline=OUT, ow=2)
    return big


# ---------------------------------------------------------------- Alesia map geometry (full-res px)
PLAT = (620, 965)
OPPIDUM = blob(612, 962, 172, 60, seed=2, wob=0.07, rot=-0.06)
INNER = blob(608, 968, 360, 255, seed=5, wob=0.045)
OUTER = blob(588, 978, 492, 392, seed=9, wob=0.055)
OZE = [(1090, 975), (960, 940), (860, 888), (760, 822), (660, 772), (580, 742), (480, 732), (360, 742), (240, 760), (120, 772), (44, 784)]
OZERAIN = [(1090, 1250), (1000, 1204), (910, 1156), (840, 1118), (760, 1072), (640, 1078), (520, 1062), (380, 1038), (240, 1042), (120, 1062), (40, 1084)]
BRENNE = [(70, -10), (56, 300), (44, 520), (40, 784), (34, 1084), (62, 1290), (100, 1520), (84, 1930)]
RABUTIN = [(300, 330), (296, 450), (310, 560), (330, 650), (360, 742)]


def ring_point(poly, ang):
    """Point on a closed blob at angle (radians, screen coords)."""
    i = int((ang % (2 * math.pi)) / (2 * math.pi) * len(poly)) % len(poly)
    return poly[i]


CAMPS = [(math.radians(a), r) for a, r in [(200, 0.0), (228, 0.0), (300, 0.0), (340, 0.0), (35, 0.0), (90, 0.0), (130, 0.0), (165, 0.0)]]
WEAK = ring_point(OUTER, math.radians(222))   # the north-west camp below Mont Rea


@lru_cache(None)
def alesia_base_np(night=False):
    elev = np.load(os.path.join(DATA, "alesia_frame.npy"))
    rgb = ma.relief(elev, 6.1, seed=3, forest=0.05, fields=0.7, exag=4.0)
    img = (rgb * 255).astype(np.uint8)
    pt = Painter(img)
    for river, w in [(BRENNE, 16), (OZE, 11), (OZERAIN, 11), (RABUTIN, 6)]:
        pt.stroke(river, (40, 90, 140), w + 5, 0.6)
        pt.stroke(river, (86, 160, 214), w, 1.0)
        pt.stroke(river, (150, 206, 240), max(2, w // 4), 0.6)
    pt.label(820, 800, "Oze", 34, (210, 236, 255), italic=True, face="DejaVu Serif", angle=0.42)
    pt.label(960, 1250, "Ozerain", 34, (210, 236, 255), italic=True, face="DejaVu Serif", angle=0.48)
    pt.label(100, 640, "Brenne", 34, (210, 236, 255), italic=True, face="DejaVu Serif", angle=-1.5)
    pt.label(250, 500, "MONT RÉA", 30, (255, 248, 230), spacing=4)
    pt.label(150, 1010, "PLAIN OF LES LAUMES", 22, (255, 248, 230), spacing=2, angle=-1.45)
    # the oppidum on Mont Auxois
    pt.fill(OPPIDUM, (200, 170, 110), 0.55, outline=(30, 24, 20), ow=6)
    return pt.image()


def map_frame(night=False):
    return np.array(alesia_base_np(night))


def header(pt, title="ALESIA", sub="52 BC · CENTRAL GAUL", a=1.0):
    pt.c.rectangle(0, 150, FW, 120)
    pt.rgba((14, 12, 20), 0.55 * a)
    pt.c.fill()
    pt.stroke([(0, 150), (FW, 150)], (220, 180, 90), 3, a)
    pt.stroke([(0, 270), (FW, 270)], (220, 180, 90), 3, a)
    pt.label(FW / 2, 196, title, 58, (250, 236, 200), a, spacing=10, shadow=True)
    pt.label(FW / 2, 246, sub, 24, (220, 190, 120), a, spacing=5, shadow=False)


def wall(pt, poly, p, col=(214, 40, 44), towers=True, crack=None):
    pts = poly + [poly[0]]
    part = partial(pts, p)
    pt.stroke(part, (40, 10, 14), 13, 0.9)
    pt.stroke(part, col, 8)
    if towers:
        for i in range(0, len(part) - 1, 3):
            x, y = part[i]
            pt.c.rectangle(x - 5, y - 5, 10, 10)
            pt.rgba((120, 70, 40))
            pt.c.fill_preserve()
            pt.rgba((30, 16, 10))
            pt.c.set_line_width(2)
            pt.c.stroke()


def camps(pt, a=1.0, n=8):
    for i, (ang, _) in enumerate(CAMPS[:n]):
        x, y = ring_point(OUTER, ang)
        cx, cy = PLAT[0] + (x - PLAT[0]) * 0.88, PLAT[1] + (y - PLAT[1]) * 0.88
        poly = blob(cx, cy, 34, 24, seed=20 + i, wob=0.1, n=8)
        pt.fill(poly, (236, 150, 140), 0.8 * a, outline=(200, 30, 36), ow=5)


def paste_px(img, im, x, y, s=2, anchor="mm", alpha=1.0):
    blit(img, im, x, y, s, anchor=anchor, alpha=alpha)


def crowd(img, pts, kind, t, s=2, seed=0):
    for i, (x, y) in enumerate(pts):
        im = sp.mini_cached(kind, (i + seed) % 5, int(t * 6 + i) % 2)
        blit(img, im, int(x), int(y), s, anchor="mb")


def units_gauls_inside(img, t, n=12, a=1.0, jitter=0):
    rng = np.random.RandomState(1)
    for i in range(n):
        ang = rng.rand() * 2 * math.pi
        r = rng.rand() ** 0.5
        x = PLAT[0] + math.cos(ang) * 135 * r
        y = PLAT[1] + math.sin(ang) * 40 * r
        dy = int(math.sin(t * 5 + i) * jitter)
        paste_px(img, sp.gaul_shield(i), int(x), int(y) + dy, 2, alpha=a)


# ---------------------------------------------------------------- data paths
DATA = os.environ.get("ALESIA_DATA", "data")


# ==================================================================== SCENES
class Ctx:
    def __init__(self, T, env, speaker_of):
        self.T, self.env, self.speaker_of = T, env, speaker_of

    def S(self, k):
        return self.T[k][0]

    def E(self, k):
        return self.T[k][1]

    def mouth(self, spk, t):
        for k, (s, e) in self.T.items():
            if s <= t < e and self.speaker_of[k] == spk:
                env = self.env[k]
                i = int((t - s) * 30)
                if i < len(env) and env[i] > 0.22:
                    return 1
        return 0

    def say(self, k, t):
        s, e = self.T[k]
        return s <= t < e


# -------------------------------------------------- 1 title over the map of Gaul
@lru_cache(None)
def gaul_relief():
    e = np.load(os.path.join(DATA, "gaul.npy"))
    from scipy import ndimage
    e2 = ndimage.zoom(e, 2, order=3)
    rgb = ma.relief(e2, 2400 / 2, sea_level=0.0, seed=8, forest=0.0, fields=0.0, exag=14.0)
    return Image.fromarray((rgb * 255).astype(np.uint8))


def gaul_xy(lat, lon):
    z = 6
    x0, y0 = ma_deg(52.5, -5.5, z)
    x, y = ma_deg(lat, lon, z)
    return (x - x0) * 256 * 2, (y - y0) * 256 * 2


def ma_deg(lat, lon, z):
    n = 2 ** z
    return (lon + 180) / 360 * n, (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n


ALESIA_LL = (47.537, 4.500)


def sc_title(t, c):
    rel = gaul_relief()
    ax, ay = gaul_xy(*ALESIA_LL)
    end = c.S("intro1") + 1.6
    z = ease(prog(t, 0.0, end + 0.4))
    w0, w1 = rel.width * 0.92, 260
    cw = w0 + (w1 - w0) * z
    ch = cw * 16 / 9
    cx = rel.width * 0.5 + (ax - rel.width * 0.5) * z
    cy = rel.height * 0.52 + (ay - rel.height * 0.52) * z
    box = (cx - cw / 2, cy - ch / 2, cx + cw / 2, cy + ch / 2)
    frame = rel.transform((FW, FH), Image.EXTENT, box, Image.BILINEAR)
    pt = Painter(np.array(frame))

    def tr(lat, lon):
        x, y = gaul_xy(lat, lon)
        return (x - box[0]) / cw * FW, (y - box[1]) / ch * FH

    la = 1 - prog(t, end - 0.6, end)
    for name, lat, lon, size in [("GALLIA", 47.0, 2.0, 70), ("BRITANNIA", 51.6, -1.0, 40), ("GERMANIA", 50.8, 8.0, 40),
                                 ("PROVINCIA ROMANA", 43.7, 4.2, 30)]:
        x, y = tr(lat, lon)
        pt.label(x, y, name, size, (255, 246, 226), la * 0.9, spacing=8)
    # Roman province border (dotted red)
    border = [tr(la_, lo_) for la_, lo_ in [(42.6, -1.6), (43.3, 0.5), (44.2, 1.8), (44.6, 3.4), (45.6, 4.8), (46.2, 6.2), (45.9, 7.0), (44.8, 7.4), (43.8, 7.6)]]
    pt.stroke(border, (220, 30, 40), 6, la, dash=[2, 12], outline=None)
    x, y = tr(*ALESIA_LL)
    pulse = 1 + 0.25 * math.sin(t * 8)
    pt.circle(x, y, 26 * pulse, (230, 40, 40), 0.35)
    pt.circle(x, y, 11, (230, 40, 40), 1.0, outline=(255, 255, 255), ow=4)
    pt.label(x + 30, y - 40, "ALESIA", 44, (255, 250, 236), 1.0, anchor="l")
    img = pt.image()
    # title card
    a = prog(t, 0.0, 0.25) * (1 - prog(t, end - 0.4, end))
    if a > 0:
        b = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        sc = back(prog(t, 0.0, 0.35))
        tw = int(300 * sc)
        tim = Image.new("RGBA", (320, 120), (0, 0, 0, 0))
        text(tim, (160, 40), "ALESIA", 40, GOLD, "press", "mm", outline=OUT, ow=3, shadow=(120, 20, 30))
        text(tim, (160, 86), "52 BC", 16, WHITE, "press", "mm", outline=OUT, ow=2)
        if sc > 0.05:
            tim = tim.resize((max(1, int(320 * sc)), max(1, int(120 * sc))), Image.NEAREST)
            b.alpha_composite(tim, (W // 2 - tim.width // 2, 150 - tim.height // 2))
        tag(b, W // 2, 230, "A VERY SERIOUS HISTORY", 8, (255, 230, 160), (120, 20, 30))
        bb = b.resize((FW, FH), Image.NEAREST)
        if a < 1:
            arr = np.array(bb)
            arr[..., 3] = (arr[..., 3] * a).astype(np.uint8)
            bb = Image.fromarray(arr)
        img = img.convert("RGBA")
        img.alpha_composite(bb)
        img = img.convert("RGB")
    return img


# -------------------------------------------------- 2 hero shot
def sc_hero(t, c):
    img = stage(t, horizon=330, top=(255, 150, 90), bot=(255, 220, 150), far=(170, 120, 110), near=(120, 140, 80), seed=3)
    d = ImageDraw.Draw(img)
    # his big hill
    d.polygon([(-10, 470), (60, 400), (110, 392), (250, 392), (300, 400), (370, 470), (370, H), (-10, H)], fill=(98, 158, 62))
    d.polygon([(40, 420), (70, 402), (290, 402), (320, 420)], fill=(124, 190, 80))
    for k in range(30):
        x = (k * 47) % 360
        d.point([(x, 430 + (k * 13) % 40)], fill=(80, 130, 50))
    t0 = c.S("intro1") + 1.6
    rise = ease(prog(t, t0, t0 + 0.5))
    y = int(410 + 120 * (1 - rise))
    pose = "up" if not c.say("verc1", t) else "point"
    v = figure("verc", mouth=c.mouth("VERCINGETORIX", t), arm=pose, arm2="sword", face="smug", cloak=0)
    blit(img, sp.boar_standard(), 292, y + 2, 3)
    blit(img, v, 170, y, 4)
    # sparkle / heroic rays
    if rise > 0.9 and not c.say("verc1", t):
        for k in range(8):
            ang = k / 8 * 2 * math.pi + t
            x0, y0 = 170 + math.cos(ang) * 90, y - 90 + math.sin(ang) * 90
            d.point([(x0, y0)], fill=WHITE)
    health_bar(img, 140, 96, 1.0)
    tag(img, 180, 44, "VERCINGETORIX", 12, GOLD, (90, 20, 30))
    tag(img, 180, 66, "LVL 52  KING OF THE ARVERNI", 7, WHITE, (40, 30, 50))
    if c.say("verc1", t) or t > c.E("verc1"):
        k0 = c.S("verc1")
        bubble(img, 176, 126, 170, 92, tail=(-40, 26), think=True)
        lines = ["PLAN:", "1. BIG HILL", "2. WAIT", "3. FRIENDS"]
        for i, s in enumerate(lines):
            if t > k0 + i * 0.55:
                text(img, (186, 136 + i * 20), s, 10, (40, 30, 50), "press", "lt", outline=None)
                if i > 0 and t > k0 + i * 0.55 + 0.25:
                    text(img, (326, 136 + i * 20), "v", 10, (40, 160, 60), "press", "lt", outline=None)
    return up(img)


# -------------------------------------------------- 3 map: 80,000 men march in
def sc_enter(t, c):
    t0, t1 = c.S("intro2"), c.S("verc2")
    pt = Painter(map_frame())
    header(pt, a=prog(t, t0, t0 + 0.4))
    p = ease(prog(t, t0, t1))
    img = pt.image()
    # columns of Gauls marching up onto the plateau from the west and east
    pts = []
    rng = np.random.RandomState(3)
    for i in range(70):
        lane = i % 3
        start = [(-30, 830 + lane * 40), (1110, 700 + lane * 50), (560, 1500 + lane * 20)][lane]
        f = clamp01(p * 1.6 - (i // 3) * 0.035)
        if f <= 0:
            continue
        ex = PLAT[0] + rng.uniform(-140, 140)
        ey = PLAT[1] + rng.uniform(-30, 40)
        pts.append((start[0] + (ex - start[0]) * f, start[1] + (ey - start[1]) * f))
    crowd(img, pts, "gaul", t, 2)
    n = int(80000 * p)
    units_gauls_inside(img, t, int(12 * p))
    b = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    tag(b, W // 2, 470, f"GAULS: {n:,}", 12, (255, 240, 200), (40, 70, 150))
    img = img.convert("RGBA")
    img.alpha_composite(b.resize((FW, FH), Image.NEAREST))
    pt2 = Painter(np.array(img.convert("RGB")))
    pt2.label(PLAT[0], PLAT[1] - 100, "ALESIA", 54, (255, 250, 236), prog(t, t0 + 0.6, t0 + 1.0), spacing=6)
    return pt2.image()


# -------------------------------------------------- 4 smug close-up
def sc_smug(t, c):
    img = stage(t, horizon=360, top=(255, 160, 100), bot=(255, 226, 160), far=(170, 120, 110), near=(120, 140, 80), seed=3)
    v = figure("verc", mouth=c.mouth("VERCINGETORIX", t), arm="thumb", arm2="down", face="smug")
    blit(img, v, 180, 460, 6)
    health_bar(img, 140, 80, 1.0)
    if t > c.E("verc2") - 0.4:
        tag(img, 180, 120, "*FAMOUS LAST WORDS", 8, WHITE, (150, 20, 30))
    return up(img)


# -------------------------------------------------- 5 map: Caesar surrounds the entire hill
def sc_ring(t, c):
    t0 = c.S("surround")
    pt = Painter(map_frame())
    header(pt)
    p = ease(prog(t, t0 + 0.2, t0 + 1.4))
    wall(pt, INNER, p)
    img = pt.image()
    units_gauls_inside(img, t, 12, jitter=2 if p >= 1 else 0)
    # Roman diggers racing round
    if 0 < p < 1:
        hx, hy = partial(INNER + [INNER[0]], p)[-1]
        crowd(img, [(hx + dx, hy + dy) for dx, dy in [(-14, 0), (0, 10), (14, -4)]], "roman", t * 2, 2)
    b = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    if p >= 1:
        s = back(prog(t, t0 + 1.4, t0 + 1.7))
        tag(b, W // 2, 108, "11 MILES", int(10 + 4 * s), WHITE, (200, 30, 40))
    # Vercingetorix reaction portrait
    img = img.convert("RGBA")
    img.alpha_composite(b.resize((FW, FH), Image.NEAREST))
    face = "shock" if p >= 1 else "smug"
    pimg = portrait("verc", 0, face, "VERC.", (60, 110, 200))
    img.alpha_composite(pimg, (40, 300))
    hb = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    health_bar(hb, 70, 128, 1.0 - 0.2 * prog(t, t0 + 1.4, t0 + 1.8))
    img.alpha_composite(hb.resize((FW, FH), Image.NEAREST))
    return img.convert("RGB")


# -------------------------------------------------- fort scenes
def fort_stage(t, night=False, **kw):
    img = base()
    if night:
        world.gradient(img, 0, H, (16, 20, 50), (40, 50, 100))
    else:
        world.gradient(img, 0, H, (140, 206, 245), (236, 242, 222))
        for i in range(3):
            cx = (i * 140 + t * (5 + i * 2)) % (W + 80) - 60
            blit(img, sp.cloud(44, i + 5), int(cx), 14 + i * 22, 1, anchor="lt")
    iso, pits = world.fort(img, t, night=night, oy=86, **kw)
    world.grass(img, 374, H, (118, 186, 72) if not night else (40, 60, 70), (86, 150, 56) if not night else (30, 44, 56), 9)
    return img, iso, pits


def sc_wall(t, c):
    img, iso, pits = fort_stage(t)
    sal = "salute" if c.say("wall1", t) else "down"
    blit(img, figure("soldier", mouth=c.mouth("SOLDIER", t), arm=sal, seed=3, shield=True), 74, 458, 3)
    point = "point" if t > c.S("traps") else "down"
    blit(img, figure("caesar", mouth=c.mouth("CAESAR", t), arm=point, cloak=1, head=0, face="smug" if t > c.S("traps") else "normal"),
         286, 458, 3, flip=True)
    if c.say("wall1", t):
        tag(img, 180, 30, "WALL: 11 MILES  [OK]", 8, WHITE, (40, 120, 60))
    return up(img)


def sc_traps(t, c):
    t0, t1 = c.S("lilies"), c.S("tombs")
    img, iso, pits = fort_stage(t)
    # zoomed caption cards
    if t > t0 + 0.3:
        s = back(prog(t, t0 + 0.3, t0 + 0.6))
        x, y = iso.P(126, 180, 0)
        blit(img, sp.lily_flower(), int(x) - 40, int(y) + 70, max(1, int(3 * s)))
        tag(img, int(x) - 40, int(y) + 86, '"LILIES"', 10, WHITE, (220, 60, 120))
        d = ImageDraw.Draw(img)
        d.line([(int(x) - 40, int(y) + 78), (int(x), int(y) - 4)], fill=WHITE)
    if t > t1 + 0.3:
        s = back(prog(t, t1 + 0.3, t1 + 0.6))
        x, y = iso.P(161, 180, 0)
        blit(img, sp.tombstone(), int(x) + 44, int(y) + 70, max(1, int(3 * s)))
        tag(img, int(x) + 46, int(y) + 86, '"TOMBSTONES"', 10, WHITE, (90, 90, 110))
        d = ImageDraw.Draw(img)
        d.line([(int(x) + 46, int(y) + 76), (int(x), int(y) - 2)], fill=WHITE)
    tag(img, 180, 28, "ROMAN ENGINEERING 101", 8, GOLD, (120, 20, 30))
    return up(img)


def sc_marcus(t, c):
    img, iso, pits = fort_stage(t)
    t0 = c.S("marcus")
    blit(img, figure("soldier", mouth=c.mouth("SOLDIER", t), arm="down", seed=3, shield=True), 62, 458, 3)
    blit(img, figure("caesar", mouth=c.mouth("CAESAR", t), arm="down", cloak=1, face="normal"), 298, 458, 3, flip=True)
    if t > t0:
        a = prog(t, t0, t0 + 0.4)
        mx = 180
        blit(img, figure("marcus", face="sad", seed=4, helmet=True), mx, 450, 3, alpha=a)
        blit(img, sp.raincloud(int(t * 8)), mx, 320, 3, alpha=a)
        tag(img, mx, 236, "MARCUS", 8, WHITE, (60, 70, 100))
    return up(img)


# -------------------------------------------------- 9 map: second wall, besieged besiegers
def sc_double(t, c):
    t0 = c.S("wall2")
    pt = Painter(map_frame())
    header(pt)
    wall(pt, INNER, 1.0)
    p = ease(prog(t, t0 + 0.6, c.E("wall2") + 0.2))
    wall(pt, OUTER, p)
    if p >= 1:
        camps(pt, prog(t, c.E("wall2"), c.E("wall2") + 0.5))
    if t > c.S("eff") - 0.1:
        a = prog(t, c.S("eff"), c.S("eff") + 0.3)
        lx, ly = ring_point(OUTER, math.radians(80))
        ix, iy = ring_point(INNER, math.radians(80))
        mx, my = (lx + ix) / 2, (ly + iy) / 2
        pt.c.rectangle(mx - 250, my + 40, 500, 70)
        pt.rgba((150, 20, 30), 0.92 * a)
        pt.c.fill()
        pt.label(mx, my + 75, "ROMANS (CONFIDENT)", 38, (255, 246, 220), a, spacing=2, shadow=False)
        pt.stroke([(mx, my + 40), (mx, my + 4)], (255, 246, 220), 5, a)
    img = pt.image()
    units_gauls_inside(img, t, 12)
    if p >= 1:
        rng = np.random.RandomState(4)
        for i in range(14):
            ang = i / 14 * 2 * math.pi + 0.2
            a1, a2 = ring_point(INNER, ang), ring_point(OUTER, ang)
            paste_px(img, sp.scutum(), int((a1[0] + a2[0]) / 2), int((a1[1] + a2[1]) / 2), 2)
    if p < 1:
        b = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        tag(b, W // 2, 108, "+14 MILES (FACING OUT)", 9, WHITE, (200, 30, 40))
        img = img.convert("RGBA")
        img.alpha_composite(b.resize((FW, FH), Image.NEAREST))
        img = img.convert("RGB")
    img = img.convert("RGBA")
    # dialogue portraits for the besieging/besieged exchange
    for k, who, pos in [("bes1", "S", (40, 300)), ("yes1", "C", (920, 300)), ("bes2", "S", (40, 300)), ("eff", "C", (920, 300))]:
        if c.say(k, t):
            if who == "S":
                im = portrait("soldier", c.mouth("SOLDIER", t), "normal", "SOLDIER", (200, 40, 40), seed=3)
            else:
                im = portrait("caesar", c.mouth("CAESAR", t), "smug", "CAESAR", GOLD)
            img.alpha_composite(im, (pos[0] if who == "S" else FW - 40 - im.width, pos[1]))
    return img.convert("RGB")


# -------------------------------------------------- 10 war council
def council_bg(t):
    img = base((40, 26, 22))
    d = ImageDraw.Draw(img)
    world.gradient(img, 0, 300, (60, 38, 30), (96, 62, 44))
    for x in range(0, W, 24):       # timber wall planks
        d.rectangle([x, 0, x + 1, 300], fill=(50, 30, 24))
    d.rectangle([0, 300, W, H], fill=(110, 80, 56))
    rng = np.random.RandomState(2)
    d.point([(int(x), int(y)) for x, y in zip(rng.randint(0, W, 500), rng.randint(300, H, 500))], fill=(90, 64, 44))
    # shields on the wall
    for i in range(6):
        blit(img, sp.gaul_shield(i), 30 + i * 60, 120, 2)
    blit(img, sp.fire(int(t * 10)), 180, 400, 2)
    blit(img, sp.cauldron(), 180, 378, 2)
    return img


def sc_council(t, c):
    t0 = c.S("food")
    img = council_bg(t)
    cs = c.S("crit")
    dur = c.E("crit") - cs
    turn0 = cs + dur * 0.62
    # food meter
    if t < cs + 0.4:
        blink = int(t * 4) % 2 == 0
        tag(img, 180, 40, "FOOD: 0%", 12, (255, 80, 80) if blink else WHITE, (40, 20, 20))
    # seated council: 4 Gauls + Critognatus standing + the oldest Gaul at the far right
    seats = [(50, 310, 0), (110, 280, 1), (250, 280, 2), (310, 310, 3)]
    old_x = 318
    for i, (x, y, sd) in enumerate(seats):
        look = t > turn0 + i * 0.28
        head = 1 if look else 0
        blit(img, figure("gaul", seed=sd + 1, head=head, face="normal"), x, y + 80, 2)
    crit_head = 1 if t > turn0 + 1.3 else 0
    blit(img, figure("crit", arm="point" if t > cs + 0.5 else "down", head=crit_head, seed=7), 100, 456, 3)
    tag(img, 100, 322, "CRITOGNATUS", 7, WHITE, (40, 30, 50))
    shock = t > turn0 + 1.2
    blit(img, figure("old", arm="cane", face="shock" if shock else "normal", sweat=shock and int(t * 4) % 2 == 0, seed=1), 282, 456, 3)
    if t > turn0 + 1.6:
        tag(img, 282, 322, "OLDEST GAUL", 7, WHITE, (40, 30, 50))
    if c.say("crit", t) and t > cs + 0.5:
        bubble(img, 20, 150, 110, 36, tail=(30, 14))
        text(img, (75, 168), "IDEA!", 12, (40, 30, 50), "press", "mm", outline=None)
    return up(img)


# -------------------------------------------------- 11 Plan B
def sc_planb(t, c):
    t0 = c.S("planb")
    img = council_bg(t)
    d = ImageDraw.Draw(img)
    # filing cabinet
    d.rectangle([90, 150, 270, 410], fill=(120, 124, 134), outline=OUT)
    for k, lab in enumerate(["PLAN A", "PLAN B", "PLAN C"]):
        y = 162 + k * 82
        d.rectangle([100, y, 260, y + 70], fill=(150, 154, 164), outline=OUT)
        d.rectangle([150, y + 36, 210, y + 42], fill=(80, 80, 90))
        tag(img, 180, y + 18, lab, 8, (40, 40, 50), (236, 226, 190))
    tag(img, 180, 136, "WAR COUNCIL ARCHIVE", 7, WHITE, (40, 30, 50))
    # folder slides in to plan B drawer
    p = ease(prog(t, t0 + 0.2, t0 + 1.2))
    fx = int(360 - 180 * p)
    fy = int(90 + 120 * p)
    if p < 1:
        d.rectangle([fx - 60, fy - 30, fx + 60, fy + 30], fill=(236, 196, 110), outline=OUT)
        text(img, (fx, fy - 6), "EAT THE", 8, (60, 40, 30), "press", "mm", outline=None)
        text(img, (fx, fy + 10), "OLD PEOPLE", 8, (60, 40, 30), "press", "mm", outline=None)
    if t > t0 + 1.4:
        s = back(prog(t, t0 + 1.4, t0 + 1.6))
        st = Image.new("RGBA", (130, 40), (0, 0, 0, 0))
        dd = ImageDraw.Draw(st)
        dd.rectangle([0, 0, 129, 39], outline=(200, 30, 40), width=3)
        text(st, (65, 20), "FILED", 16, (200, 30, 40), "press", "mm", outline=None)
        st = st.rotate(12, expand=True, resample=Image.NEAREST)
        if s > 0.05:
            st = st.resize((max(1, int(st.width * s)), max(1, int(st.height * s))), Image.NEAREST)
            img.alpha_composite(st, (180 - st.width // 2, 240 - st.height // 2))
    blit(img, figure("old", arm="thumb", face="happy", seed=1), 316, 456, 2)
    return up(img)


# -------------------------------------------------- 12 the friends arrive
RELIEF_SOURCES = [(-60, 300), (1140, 380), (-60, 1500), (1140, 1600), (540, -40), (300, 1950), (900, 1950)]


def relief_crowd(t, t0, rate, count):
    rng = np.random.RandomState(11)
    pts = []
    for i in range(count):
        src = RELIEF_SOURCES[i % len(RELIEF_SOURCES)]
        born = t0 + (i / rate)
        if t < born:
            break
        f = clamp01((t - born) / 2.2)
        ang = rng.rand() * 2 * math.pi
        tx = PLAT[0] + math.cos(ang) * rng.uniform(560, 760)
        ty = PLAT[1] + math.sin(ang) * rng.uniform(450, 640)
        tx = min(max(tx, 20), FW - 20)
        ty = min(max(ty, 300), FH - 60)
        pts.append((src[0] + (tx - src[0]) * f + rng.uniform(-20, 20), src[1] + (ty - src[1]) * f + rng.uniform(-20, 20)))
    return pts


def sc_friends(t, c):
    t0 = c.S("friends")
    pt = Painter(map_frame())
    header(pt)
    wall(pt, INNER, 1)
    wall(pt, OUTER, 1)
    camps(pt)
    img = pt.image()
    units_gauls_inside(img, t, 12, jitter=3)
    pts = relief_crowd(t, t0 + 0.6, 40, 220)
    crowd(img, pts, "gaul", t, 2)
    p = prog(t, t0 + 2.0, c.E("friends"))
    b = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    if t > t0 + 1.6:
        n = int(250000 * ease(p))
        tag(b, W // 2, 108, f"FRIENDS: {n:,}*", 11, WHITE, (40, 120, 60))
        tag(b, W // 2, 128, "*SOURCE: CAESAR", 7, (255, 230, 160), (40, 30, 50))
    img = img.convert("RGBA")
    img.alpha_composite(b.resize((FW, FH), Image.NEAREST))
    return img.convert("RGB")


def sc_book(t, c):
    t0 = c.S("book")
    img = base()
    world.gradient(img, 0, H, (250, 236, 200), (220, 196, 150))
    s = back(prog(t, t0, t0 + 0.35))
    bk = sp.book_cover()
    if s > 0.05:
        k = max(1, int(round(3 * s)))
        blit(img, bk, 180, 150 + 60 * k, k, anchor="mb")
        if s > 0.9:
            text(img, (180, 168), "COMMENTARII", 10, GOLD, "press", "mm", outline=RED_D)
            text(img, (180, 184), "DE BELLO GALLICO", 9, GOLD, "press", "mm", outline=RED_D)
            text(img, (180, 312), "by G. IULIUS CAESAR", 7, GOLD, "press", "mm", outline=RED_D)
    if t > t0 + 0.7:
        tag(img, 180, 372, "***** 'FLAWLESS'  - CAESAR", 7, (60, 40, 20), (255, 220, 90))
    if t > t0 + 1.1:
        tag(img, 180, 394, "***** 'HE WAS THERE'  - CAESAR", 7, (60, 40, 20), (255, 220, 90))
    blit(img, figure("caesar", arm="thumb", face="smug", cloak=1), 300, 458, 2, flip=True)
    return up(img)


# -------------------------------------------------- 14 the game starts to lag
def sc_lag(t, c):
    t0 = c.E("book") + 0.25
    t1 = c.S("both1")
    p = prog(t, t0, t1)
    fps_eff = max(1.5, 30 * (1 - p) ** 2)
    tq = t0 + math.floor((t - t0) * fps_eff) / fps_eff
    pt = Painter(map_frame())
    header(pt)
    wall(pt, INNER, 1)
    wall(pt, OUTER, 1)
    camps(pt)
    img = pt.image()
    units_gauls_inside(img, tq, 12)
    pts = relief_crowd(tq, t0 - 2.8, 40 + 400 * p, 1400)
    crowd(img, pts, "gaul", tq, 2)
    b = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(b)
    fps = max(1, int(60 * (1 - p) ** 1.6))
    tag(b, 8, 96, f"FPS: {fps}", 9, (120, 255, 120) if fps > 20 else (255, 90, 90), (10, 10, 14), anchor="lt")
    if p > 0.45:
        d.rectangle([60, 260, 300, 330], fill=(236, 236, 244), outline=OUT)
        d.rectangle([60, 260, 300, 276], fill=(60, 90, 200))
        text(b, (66, 263), "ALESIA.EXE", 8, WHITE, "press", "lt", outline=None)
        text(b, (180, 304), "NOT RESPONDING", 9, (40, 40, 50), "press", "mm", outline=None)
    if p > 0.3:  # glitch blocks
        rng = np.random.RandomState(int(tq * 10))
        for _ in range(int(10 * p)):
            x, y = rng.randint(0, W), rng.randint(0, H)
            d.rectangle([x, y, x + rng.randint(10, 60), y + rng.randint(2, 6)],
                        fill=[(255, 0, 160), (0, 255, 200), (255, 255, 255)][rng.randint(3)])
    img = img.convert("RGBA")
    img.alpha_composite(b.resize((FW, FH), Image.NEAREST))
    return img.convert("RGB")


# -------------------------------------------------- 15 everyone attacks everyone
def sc_both(t, c):
    t0 = c.S("both1")
    pt = Painter(map_frame())
    header(pt)
    wall(pt, INNER, 1)
    wall(pt, OUTER, 1)
    camps(pt)
    flash = int(t * 6) % 2 == 0 and t > c.S("both2")
    green = (96, 170, 64)
    out_arrows = [
        [(140, 380), (230, 470), WEAK],
        [(1020, 420), (980, 540), ring_point(OUTER, math.radians(310))],
        [(80, 1640), (150, 1500), ring_point(OUTER, math.radians(140))],
        [(1000, 1700), (980, 1520), ring_point(OUTER, math.radians(50))],
    ]
    for i, (a, b_, cc) in enumerate(out_arrows):
        arrow(pt, bezier(a, b_, cc), ease(prog(t, t0 + 0.2 + i * 0.15, t0 + 1.4 + i * 0.15)), green, 54)
    tin = t0 + 2.6
    in_arrows = [
        [PLAT, (470, 880), ring_point(INNER, math.radians(200))],
        [PLAT, (520, 1120), ring_point(INNER, math.radians(130))],
        [PLAT, (760, 1060), ring_point(INNER, math.radians(30))],
    ]
    for i, (a, b_, cc) in enumerate(in_arrows):
        arrow(pt, bezier(a, b_, cc), ease(prog(t, tin + i * 0.12, tin + 1.0 + i * 0.12)), (70, 120, 210), 44)
    if flash:
        wall(pt, INNER, 1, col=(255, 230, 90), towers=False)
        wall(pt, OUTER, 1, col=(255, 230, 90), towers=False)
    img = pt.image()
    units_gauls_inside(img, t, 12, jitter=3)
    if t > c.S("both2"):
        for i in range(10):
            ang = i / 10 * 2 * math.pi
            for poly in (INNER, OUTER):
                x, y = ring_point(poly, ang + 0.1)
                if int(t * 5 + i) % 3 == 0:
                    paste_px(img, sp.crossed_swords(), int(x), int(y), 3)
    return img


# -------------------------------------------------- 16 which way do we face
def sc_face(t, c):
    img = stage(t, horizon=320, seed=4)
    d = ImageDraw.Draw(img)
    # two palisades in side view
    for x0 in (0, W - 40):
        d.rectangle([x0, 170, x0 + 40, 360], fill=world.WICKER, outline=OUT)
        for y in range(176, 360, 8):
            d.line([(x0 + 2, y), (x0 + 38, y)], fill=world.WICKER_D)
        for x in range(x0 + 4, x0 + 40, 8):
            d.polygon([(x - 3, 170), (x + 3, 170), (x, 160)], fill=world.WOOD)
    # Gauls peeking over both walls
    for i, (x, side) in enumerate([(14, 1), (26, 1), (334, -1), (346, -1)]):
        bob = int(math.sin(t * 6 + i) * 3)
        g = figure("gaul", seed=i + 2, face="angry")
        g = g.crop((0, 0, g.width, 18))
        blit(img, g, x, 172 + bob, 2, flip=side < 0)
    yes = t > c.S("yes2")
    for i, x in enumerate([90, 140, 220, 270]):
        if yes:
            head = [1, 3, 1, 3][i] if i != 2 else int(t * 10) % 4
        else:
            head = 0
        blit(img, figure("soldier", seed=i, head=head, shield=True, face="shock" if yes else "normal",
                         mouth=c.mouth("SOLDIER", t) if i == 1 else 0), x, 380, 2, flip=(head == 3))
    blit(img, figure("caesar", mouth=c.mouth("CAESAR", t), arm="point" if yes else "down", cloak=1, face="smug"), 180, 462, 3)
    return up(img)


# -------------------------------------------------- 17 the night attack
def sc_night(t, c):
    t0, tf = c.S("night"), c.S("find")
    gauls = []
    falling = []
    pits_xy = None
    n = 9
    for i in range(n):
        gy = 12 + i * 18
        start = t0 + i * 0.12
        f = clamp01((t - start) / 2.6)
        gx = 10 + f * 118
        gauls.append((gx, gy, "walk"))
    img, iso, pits = fort_stage(t, night=True, gauls=None)
    d = ImageDraw.Draw(img)
    for k in range(40):
        rng = np.random.RandomState(k)
        d.point([(rng.randint(0, W), rng.randint(0, 120))], fill=(255, 255, 220) if (int(t * 3) + k) % 5 else (120, 120, 160))
    d.ellipse([290, 20, 320, 50], fill=(250, 246, 210))
    d.ellipse([300, 18, 326, 46], fill=(16, 20, 50))
    # gauls sneaking (eyes only) and dropping into lilies once they reach them
    for i, (gx, gy, st) in enumerate(gauls):
        drop_t = tf + i * 0.16
        sx, sy = iso.P(gx, gy, 0)
        if t > drop_t and gx > 100:
            dt = t - drop_t
            if dt < 0.5:
                yy = sy - 8 - 12 * math.sin(min(1, dt / 0.35) * math.pi)
                tag(img, int(sx), int(yy) - 10, ["OW!", "OUCH!", "AIE!"][i % 3], 7, (255, 240, 120), (150, 20, 30))
                d.point([(sx - 1, yy), (sx + 1, yy)], fill=(255, 250, 190))
            else:
                # a little "x x" in the pit
                d.point([(sx - 1, sy - 1), (sx + 1, sy - 1)], fill=(255, 120, 120))
        else:
            blink = int(t * 3 + i) % 7 == 0
            if not blink:
                d.point([(sx - 1, sy - 6), (sx + 1, sy - 6)], fill=(255, 250, 190))
    if t > tf:
        tag(img, 180, 150, "LILIES: WORKING AS INTENDED", 7, WHITE, (150, 20, 80))
    return up(img)


def sc_goodname(t, c):
    img, iso, pits = fort_stage(t)
    t0 = c.S("goodname")
    blit(img, figure("caesar", mouth=c.mouth("CAESAR", t), arm="thumb", cloak=1, face="happy"), 290, 458, 3, flip=True)
    happy = t > t0 + 0.6
    blit(img, figure("marcus", face="happy" if happy else "sad", seed=4, arm="up" if happy else "down"), 120, 450, 3)
    blit(img, sp.sun(int(t * 10)) if happy else sp.raincloud(int(t * 8)), 120, 310, 3)
    tag(img, 120, 236, "MARCUS", 8, WHITE, (60, 70, 100))
    if happy:
        s = back(prog(t, t0 + 0.6, t0 + 0.9))
        tag(img, 240, int(270 - 10 * s), "+1 MORALE", 10, (120, 255, 120), (20, 60, 30))
    return up(img)


# -------------------------------------------------- 19 the final assault
def sc_final(t, c):
    t0 = c.S("final")
    pt = Painter(map_frame())
    header(pt)
    wall(pt, INNER, 1)
    wall(pt, OUTER, 1)
    camps(pt)
    p = ease(prog(t, t0 + 0.3, t0 + 2.4))
    arrow(pt, bezier((60, 260), (140, 420), WEAK), p, (96, 170, 64), 120)
    give = prog(t, t0 + 3.0, c.E("final"))
    if give > 0:
        # wall bends inward at the weak point
        i0 = OUTER.index(WEAK)
        seg = [OUTER[(i0 + k) % len(OUTER)] for k in range(-5, 6)]
        bent = []
        for k, (x, y) in enumerate(seg):
            f = math.sin(k / (len(seg) - 1) * math.pi) * 40 * give
            bent.append((x + (PLAT[0] - x) * f / 400, y + (PLAT[1] - y) * f / 400))
        flash = int(t * 8) % 2 == 0
        pt.stroke(bent, (255, 230, 90) if flash else (214, 40, 44), 12)
        pt.label(WEAK[0] + 200, WEAK[1] - 60, "!", 90, (255, 230, 90), 1.0)
    img = pt.image()
    b = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    if p > 0.3:
        tag(b, W // 2, 108, "60,000 GAULS", 12, WHITE, (40, 120, 60))
    img = img.convert("RGBA")
    img.alpha_composite(b.resize((FW, FH), Image.NEAREST))
    img = img.convert("RGB")
    return shake(img, int(10 * give), t)


# -------------------------------------------------- 20 the red cloak
def sc_cloak(t, c):
    t0 = c.S("cloak")
    img = stage(t, horizon=330, seed=6)
    d = ImageDraw.Draw(img)
    on = t > t0 + 0.9
    if on:  # spotlight
        a = 0.5 + 0.15 * math.sin(t * 6)
        d.polygon([(150, 0), (210, 0), (290, 440), (70, 440)], fill=(255, 250, 200))
        for k in range(12):
            ang = k / 12 * 2 * math.pi + t * 1.5
            x0, y0 = 180 + math.cos(ang) * 110, 300 + math.sin(ang) * 110
            d.point([(x0, y0), (x0 + 1, y0)], fill=(255, 255, 255))
    # rampart in side view
    d.rectangle([0, 420, W, 470], fill=world.EARTH, outline=OUT)
    for x in range(0, W, 18):
        d.rectangle([x, 380, x + 16, 420], fill=world.WICKER, outline=world.WICKER_D)
    wave = c.say("esp", t) or t > c.E("esp")
    cz = figure("caesar", mouth=c.mouth("CAESAR", t), arm="wave" if wave else "down", cloak=2 if on else 1, face="smug", wave=int(t * 8))
    blit(img, cz, 180, 430, 4)
    if on:
        tag(img, 180, 60, "VERY VISIBLE", 10, WHITE, (200, 30, 40))
    if c.say("enemy", t) or t > c.S("enemy"):
        blit(img, figure("soldier", mouth=c.mouth("SOLDIER", t), seed=3, shield=True, face="shock"), 46, 462, 2)
    if wave:
        for i, x in enumerate([268, 306, 344]):
            g = figure("gaul", seed=i + 1, arm="point", face="shock", head=3)
            blit(img, g, x, 462, 2, flip=True)
        bubble(img, 236, 340, 120, 28, tail=(20, 12))
        text(img, (296, 354), "IT'S HIM!", 9, (40, 30, 50), "press", "mm", outline=None)
    return up(img)


# -------------------------------------------------- 21 cavalry round the back
def sc_cav(t, c):
    t0 = c.S("cav")
    pt = Painter(map_frame())
    header(pt)
    wall(pt, INNER, 1)
    wall(pt, OUTER, 1)
    camps(pt)
    p = ease(prog(t, t0 + 0.2, t0 + 2.6))
    # outside loop from the north camps around to the rear of the attackers
    path = bezier(ring_point(OUTER, math.radians(275)), (520, 260), (300, 260)) + bezier((300, 260), (110, 260), (90, 470))[1:]
    arrow(pt, path, p, (232, 190, 60), 70)
    img = pt.image()
    # the relief army around the weak point scatters after the hit
    hit = prog(t, t0 + 2.4, t0 + 4.0)
    rng = np.random.RandomState(5)
    pts = []
    for i in range(70):
        bx = WEAK[0] - 80 + rng.uniform(-110, 110)
        by = WEAK[1] - 120 + rng.uniform(-90, 90)
        ang = math.atan2(by - PLAT[1], bx - PLAT[0]) + rng.uniform(-0.6, 0.6)
        pts.append((bx + math.cos(ang) * 900 * hit, by + math.sin(ang) * 900 * hit))
    crowd(img, pts, "gaul", t, 2)
    img = img.convert("RGBA")
    if t > c.S("home"):
        a = back(prog(t, c.S("home"), c.S("home") + 0.3))
        b = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        y = int(-40 + 140 * a)
        d = ImageDraw.Draw(b)
        d.rounded_rectangle([30, y, 330, y + 46], 6, fill=(54, 57, 63), outline=OUT)
        blit(b, sp.gaul_shield(5), 50, y + 23, 1, anchor="mm")
        text(b, (66, y + 10), "THE FRIENDS", 8, WHITE, "press", "lt", outline=None)
        text(b, (66, y + 26), "HAVE LEFT THE CHAT", 8, (180, 180, 190), "press", "lt", outline=None)
        img.alpha_composite(b.resize((FW, FH), Image.NEAREST))
    return img.convert("RGB")


# -------------------------------------------------- 22-23 the surrender lap
CZ = (180, 360)   # Caesar seat (base coords), feet position


def surrender_stage(t):
    img = stage(t, horizon=250, seed=8, top=(150, 200, 240), bot=(236, 230, 200))
    d = ImageDraw.Draw(img)
    # Roman camp behind
    for i, x in enumerate([30, 90, 270, 330]):
        d.polygon([(x - 22, 250), (x + 22, 250), (x, 222)], fill=(236, 226, 200), outline=OUT)
    blit(img, sp.bull_banner(int(t * 6)), 60, 300, 2)
    blit(img, sp.bull_banner(int(t * 6) + 2), 300, 300, 2)
    # dais
    d.rectangle([140, 340, 220, 366], fill=(200, 190, 170), outline=OUT)
    d.rectangle([140, 340, 220, 344], fill=(230, 222, 204))
    return img


def caesar_seated(img, t, c, head):
    cz = figure("caesar", mouth=c.mouth("CAESAR", t), head=head, cloak=1, face="normal")
    cz = cz.crop((0, 0, cz.width, cz.height - 6))
    blit(img, cz, CZ[0], CZ[1] - 14, 2)


def verc_rider(t, frame, shiny=True):
    h = art.horse(frame)
    v = figure("verc", face="normal", arm="down", arm2="down")
    top = v.crop((0, 0, v.width, 24))
    comp = Image.new("RGBA", (max(h.width, 46), h.height + 20), (0, 0, 0, 0))
    comp.alpha_composite(h, (0, 20))
    comp.alpha_composite(top, (comp.width // 2 - top.width // 2 - 2, 4))
    return comp


def sc_lap(t, c):
    t0 = c.S("surr")
    tl = c.S("lap")
    tend = c.S("why")
    img = surrender_stage(t)
    # ride in from the left, then one full lap round Caesar
    if t < tl:
        f = ease(prog(t, t0 + 0.3, tl))
        ang = math.pi
        x = -60 + (CZ[0] - 120 + 60) * f
        y = CZ[1] + 40
        behind = False
        flip = False
    else:
        f = ease(prog(t, tl, tend - 0.2))
        ang = math.pi + f * 2 * math.pi          # start on the left, go round the front first
        x = CZ[0] + math.cos(ang) * 120
        y = CZ[1] + 4 + math.sin(-ang) * -30
        behind = math.sin(ang) < 0
        flip = math.sin(ang) < 0   # moving right in front, left behind
    # Caesar's head follows the horse all the way round
    if t < tl:
        head = 3
    else:
        a = (ang - math.pi / 2) % (2 * math.pi)  # 0 = front
        head = [0, 1, 2, 3][int(((math.atan2(math.sin(ang), math.cos(ang)) + math.pi * 1.25) / (math.pi / 2))) % 4]
        if math.cos(ang) < -0.7:
            head = 3
        elif math.cos(ang) > 0.7:
            head = 1
        elif math.sin(ang) > 0:
            head = 0
        else:
            head = 2
    rider = verc_rider(t, int(t * 8))
    sscale = 2
    if behind:
        blit(img, rider, int(x), int(y), sscale, flip=True)
        caesar_seated(img, t, c, head)
    else:
        caesar_seated(img, t, c, head)
        blit(img, rider, int(x), int(y), sscale, flip=False)
    # sparkles on the finest armour
    d = ImageDraw.Draw(img)
    for k in range(3):
        if (int(t * 8) + k) % 3 == 0:
            d.point([(int(x) - 6 + k * 6, int(y) - 70 + k * 4)], fill=WHITE)
    # soldiers in the foreground
    for i, sx in enumerate([40, 320]):
        blit(img, figure("soldier", seed=i + 1, shield=True, face="shock" if t > tl + 1 else "normal"), sx, 462, 2)
    if t > tl + 0.2:
        tag(img, 180, 70, "LAP 1/1", 10, WHITE, (40, 30, 50))
    return up(img)


def sc_throw(t, c):
    t0 = c.S("why")
    tt = c.S("throw")
    tlet = c.S("letter")
    img = surrender_stage(t)
    caesar_seated(img, t, c, 0)
    vx, vy = 70, 420
    d = ImageDraw.Draw(img)
    if t < tt + 1.2:
        blit(img, verc_rider(t, 0), 40, CZ[1] + 40, 2, flip=False)
    # throw armour pieces in arcs to Caesar's feet
    if t > tt + 0.8:
        for k in range(4):
            f = clamp01((t - (tt + 0.8 + k * 0.12)) / 0.5)
            x0, y0 = vx + 10, 330
            x1, y1 = 150 + k * 16, 384
            x = x0 + (x1 - x0) * f
            y = y0 + (y1 - y0) * f - math.sin(f * math.pi) * 50
            piece = [(GOLD, 10, 8), (SILVER, 8, 6), (GOLD, 6, 6), (SILVER, 12, 4)][k]
            d.rectangle([x - piece[1] // 2, y - piece[2] // 2, x + piece[1] // 2, y + piece[2] // 2], fill=piece[0], outline=OUT)
    if t > tt + 1.2:
        v = figure("verc", face="normal", helmet=False)
        v = v.crop((0, 0, v.width, v.height - 10))
        blit(img, v, 110, 410, 2)
    if c.say("why", t):
        tag(img, 180, 70, "???", 14, WHITE, (40, 30, 50))
    if c.E("throw") < t < tlet:
        blit(img, sp.tumbleweed(int(t * 10)), int(-20 + (t - c.E("throw")) * 160), 440, 2)
        tag(img, 180, 70, "...", 14, WHITE, (40, 30, 50))
    for i, sx in enumerate([40, 320]):
        blit(img, figure("soldier", seed=i + 1, shield=True, head=0), sx, 462, 2)
    return up(img)


# -------------------------------------------------- 24 the statue
def statue_img(curl):
    v = figure("verc", face="normal", arm="down", arm2="sword", curl=curl)
    bronze = [(16, 30, 28), (34, 64, 54), (64, 108, 90), (104, 152, 126), (150, 196, 166), (210, 240, 214)]
    return art.recolor(v, bronze)


def sc_statue(t, c):
    t0 = c.S("statue")
    img = stage(t, horizon=300, seed=10)
    d = ImageDraw.Draw(img)
    d.ellipse([-40, 330, 400, 560], fill=(108, 170, 70))
    # pedestal
    d.rectangle([130, 300, 230, 420], fill=(200, 196, 184), outline=OUT)
    d.rectangle([120, 296, 240, 306], fill=(220, 216, 204), outline=OUT)
    d.rectangle([120, 410, 240, 422], fill=(180, 176, 164), outline=OUT)
    text(img, (180, 360), "VERCINGETORIX", 7, (90, 90, 90), "press", "mm", outline=None)
    curl = ease(prog(t, c.S("looks") + 0.3, c.E("looks") + 1.2))
    blit(img, statue_img(curl), 180, 300, 5)
    tag(img, 70, 40, "1865", 14, WHITE, (40, 30, 50))
    if t > c.S("looks"):
        a = prog(t, c.S("looks"), c.S("looks") + 0.3)
        p = portrait("nap", 0, "normal", "NAP. III", (60, 80, 180))
        b = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        img = img.convert("RGBA")
        small = p.resize((p.width // 3 * 2 // 2, p.height // 3 * 2 // 2), Image.NEAREST)
        img.alpha_composite(small, (W - small.width - 10, 20))
        if curl > 0.95:
            tag(img, 290, 150, "98% MATCH", 8, WHITE, (40, 140, 60))
    return up(img)


# -------------------------------------------------- 25 the biography
def sc_bio(t, c):
    t0 = c.S("bio")
    img = stage(t, horizon=330, seed=12, top=(200, 210, 240), bot=(240, 236, 226))
    d = ImageDraw.Draw(img)
    teams = t > c.S("teams")
    blit(img, figure("nap", arm="hold" if not teams else "up", arm2="hold" if not teams else "up", face="happy" if teams else "normal",
                     wave=int(t * 6)), 180, 458, 4)
    tag(img, 180, 100, "NAPOLEON III", 10, WHITE, (36, 48, 104))
    if not teams:
        d.rectangle([150, 330, 210, 380], fill=(40, 60, 140), outline=OUT)
        text(img, (180, 344), "HISTOIRE", 6, GOLD, "press", "mm", outline=None)
        text(img, (180, 356), "DE JULES", 6, GOLD, "press", "mm", outline=None)
        text(img, (180, 368), "CESAR", 6, GOLD, "press", "mm", outline=None)
        tag(img, 180, 40, "1865", 14, WHITE, (40, 30, 50))
    else:
        bob = int(math.sin(t * 10) * 4)
        blit(img, sp.foam_finger((60, 110, 220)), 140, 330 + bob, 3)
        blit(img, sp.foam_finger((220, 40, 50)), 214, 330 - bob, 3)
        tag(img, 110, 236 + bob, "GAULS #1", 8, WHITE, (40, 70, 150))
        tag(img, 250, 236 - bob, "ROME #1", 8, WHITE, (150, 20, 30))
    return up(img)


# -------------------------------------------------- 26 Sedan
SEDAN_C = None


@lru_cache(None)
def sedan_base():
    e = np.load(os.path.join(DATA, "sedan.npy"))
    h, w = e.shape
    cw = int(h * 9 / 16)
    x0 = (w - cw) // 2
    E = ma.resize_elev(e, FW, FH, (x0, 0, x0 + cw, h))
    rgb = ma.relief(E, 11.0, seed=21, forest=0.08, fields=0.8, exag=3.0)
    img = (rgb * 255).astype(np.uint8)
    pt = Painter(img)
    meuse = [(-20, 760), (200, 820), (380, 900), (480, 1010), (420, 1120), (520, 1180), (700, 1110), (820, 1030), (1100, 1000)]
    pt.stroke(meuse, (40, 90, 140), 20, 0.6)
    pt.stroke(meuse, (86, 160, 214), 14)
    pt.label(300, 820, "Meuse", 34, (210, 236, 255), italic=True, face="DejaVu Serif", angle=0.3)
    return pt.image()


def sc_sedan(t, c):
    t0 = c.S("sedan")
    pt = Painter(np.array(sedan_base()))
    header(pt, "SEDAN", "1 SEPTEMBER 1870 · FRANCE")
    town = (560, 980)
    ring = blob(town[0], town[1], 330, 280, seed=31, wob=0.06)
    p = ease(prog(t, t0 + 1.6, t0 + 3.4))
    pts = ring + [ring[0]]
    part = partial(pts, p)
    pt.stroke(part, (30, 30, 36), 15, 0.9)
    pt.stroke(part, (120, 124, 136), 10)
    pt.fill(blob(town[0], town[1], 90, 60, seed=4, wob=0.1, n=24), (200, 170, 120), 0.8, outline=(40, 30, 20), ow=5)
    pt.label(town[0], town[1] - 90, "SEDAN", 46, (255, 250, 236), spacing=6)
    img = pt.image()
    rng = np.random.RandomState(9)
    for i in range(8):
        x = town[0] + rng.uniform(-150, 150)
        y = town[1] + rng.uniform(-110, 110)
        im = sp.Spr(9, 7)
        im.r(0, 0, 3, 7, (40, 70, 180))
        im.r(3, 0, 3, 7, (250, 250, 250))
        im.r(6, 0, 3, 7, (220, 40, 50))
        paste_px(img, im.outlined(), int(x), int(y), 3)
    if p > 0:
        for i in range(12):
            ang = i / 12 * 2 * math.pi
            if ang / (2 * math.pi) < p:
                x, y = ring_point(ring, ang)
                im = sp.Spr(9, 9)
                im.r(0, 0, 9, 9, (90, 90, 100))
                im.r(4, 1, 1, 7, (20, 20, 24))
                im.r(1, 4, 7, 1, (20, 20, 24))
                paste_px(img, im.outlined(), int(x), int(y), 3)
    img = img.convert("RGBA")
    face = "shock" if p > 0.9 else "normal"
    pi_ = portrait("nap", 0, face, "NAP. III", (60, 80, 180))
    img.alpha_composite(pi_, (40, 300))
    if p > 0.9:
        b = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        tag(b, W // 2, 108, "SURROUNDED (AGAIN)", 10, WHITE, (80, 80, 96))
        img.alpha_composite(b.resize((FW, FH), Image.NEAREST))
    return img.convert("RGB")


# -------------------------------------------------- 27 he sent a letter
def sc_sent(t, c):
    t0 = c.S("sent")
    img = base()
    world.gradient(img, 0, H, (246, 236, 214), (224, 206, 170))
    f = ease(prog(t, t0 + 0.2, t0 + 1.1))
    s = 4 - 2 * f
    x = 180 + 200 * f
    y = 260 - 200 * f
    blit(img, sp.envelope(), int(x), int(y), max(1, int(round(s))), anchor="mm")
    if t < t0 + 0.4:
        tag(img, 180, 380, "TO: KING WILHELM I", 8, (60, 40, 30), (236, 226, 190))
    pop_t = c.E("sent") + 0.15
    if t > pop_t:
        k = back(prog(t, pop_t, pop_t + 0.35))
        cz = figure("caesar", arm="thumb", face="happy", cloak=1)
        blit(img, cz, int(W - 70), int(462 + 200 * (1 - k)), 3, flip=True)
        bubble(img, 150, 330, 120, 30, tail=(30, 12))
        text(img, (210, 345), "NICE.", 10, (40, 30, 50), "press", "mm", outline=None)
    return up(img)


# -------------------------------------------------- 28 Ctrl + Alt + Defeat
def sc_end(t, c):
    t0 = c.S("ctrl")
    img = base((18, 14, 26))
    world.gradient(img, 0, H, (24, 18, 34), (60, 30, 50))
    dur = c.E("ctrl") - t0
    marks = [t0, t0 + dur * 0.36, t0 + dur * 0.62]
    labels = [("CTRL", 96), ("ALT", 84), ("DEFEAT", 150)]
    xs = [12 + 48, 120 + 42, 236 + 25]
    y = 170
    x = 18
    for i, ((lab, w), m) in enumerate(zip(labels, marks)):
        down = m <= t < m + 0.25
        lit = t >= m
        k = sp.key(lab, down, w=w if i < 2 else 116)
        if lit:
            a = np.array(k)
            a[..., :3] = np.clip(a[..., :3] * np.array([1.0, 0.92, 0.75]), 0, 255)
            k = Image.fromarray(a.astype(np.uint8))
        img.alpha_composite(k, (x, y))
        x += k.width + 6
        if i < 2 and lit:
            text(img, (x - 3, y + 18), "+", 12, WHITE, "press", "mm")
            x += 6
    if t > marks[2] + 0.4:
        s = back(prog(t, marks[2] + 0.4, marks[2] + 0.7))
        tag(img, 180, 270, "GAME OVER", int(10 + 6 * s), (255, 80, 90), (40, 10, 20))
    if t > marks[2] + 1.0:
        tag(img, 180, 304, "ALESIA  52 BC", 8, GOLD, (40, 30, 50))
        blit(img, sp.bull_banner(int(t * 6)), 180, 420, 2)
    return up(img)


def scene_list(c):
    S, E = c.S, c.E
    return [
        (0.0, sc_title),
        (S("intro1") + 1.6, sc_hero),
        (S("intro2"), sc_enter),
        (S("verc2"), sc_smug),
        (S("surround"), sc_ring),
        (S("wall1"), sc_wall),
        (S("lilies"), sc_traps),
        (S("who"), sc_marcus),
        (S("wall2"), sc_double),
        (S("food"), sc_council),
        (S("planb"), sc_planb),
        (S("friends"), sc_friends),
        (S("book"), sc_book),
        (E("book") + 0.25, sc_lag),
        (S("both1"), sc_both),
        (S("face"), sc_face),
        (S("night"), sc_night),
        (S("goodname"), sc_goodname),
        (S("final"), sc_final),
        (S("cloak"), sc_cloak),
        (S("cav"), sc_cav),
        (S("surr"), sc_lap),
        (S("why"), sc_throw),
        (S("statue"), sc_statue),
        (S("bio"), sc_bio),
        (S("sedan"), sc_sedan),
        (S("sent"), sc_sent),
        (S("ctrl"), sc_end),
    ]
