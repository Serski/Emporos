"""Pixel backgrounds and the isometric (eBoy-style) diorama of Caesar's siege lines."""
import math
import numpy as np
from PIL import Image, ImageDraw
from art import W, H, OUT, WHITE, RED, GOLD, WOOD, WOOD_D, blit, figure
import sprites as sp

BAYER = (np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) + 0.5) / 16


def gradient(img, y0, y1, c0, c1, levels=7):
    """Dithered vertical gradient (classic pixel-art banding)."""
    a = np.array(img)
    h = y1 - y0
    yy, xx = np.mgrid[0:h, 0:W]
    t = yy / max(1, h - 1)
    lv = np.floor(t * (levels - 1) + BAYER[yy % 4, xx % 4]).clip(0, levels - 1) / (levels - 1)
    c0, c1 = np.array(c0, float), np.array(c1, float)
    col = c0[None, None] * (1 - lv[..., None]) + c1[None, None] * lv[..., None]
    a[y0:y1, :, :3] = col.astype(np.uint8)
    a[y0:y1, :, 3] = 255
    img.paste(Image.fromarray(a))


def hills(img, y, col, amp=20, seed=0, freq=1.0):
    d = ImageDraw.Draw(img)
    rng = np.random.RandomState(seed)
    ph = rng.rand(3) * 6
    pts = [(0, H)]
    for x in range(0, W + 4, 4):
        yy = y - amp * (0.5 + 0.3 * math.sin(x / 50 * freq + ph[0]) + 0.2 * math.sin(x / 23 * freq + ph[1]))
        pts.append((x, int(yy)))
    pts.append((W, H))
    d.polygon(pts, fill=col)


def grass(img, y0, y1, col, dark, seed=0, density=0.03):
    d = ImageDraw.Draw(img)
    d.rectangle([0, y0, W, y1], fill=col)
    rng = np.random.RandomState(seed)
    n = int(W * (y1 - y0) * density)
    xs, ys = rng.randint(0, W, n), rng.randint(y0, y1, n)
    d.point(list(zip(xs.tolist(), ys.tolist())), fill=dark)
    d.point(list(zip(xs.tolist(), (ys - 1).tolist())), fill=dark)


def sky_scene(img, t, top=(110, 190, 245), bot=(200, 236, 250), horizon=300, ground=(118, 186, 72),
              ground_d=(86, 150, 56), seed=0, clouds=True, far=(150, 196, 140), near=(110, 170, 90)):
    gradient(img, 0, horizon, top, bot)
    if clouds:
        for i in range(4):
            cx = (i * 110 + t * (6 + i * 2)) % (W + 80) - 60
            blit(img, sp.cloud(40 + i * 6, i), int(cx), 40 + i * 37, 1, anchor="lt")
    hills(img, horizon - 10, far, 30, seed + 1, 0.8)
    hills(img, horizon + 4, near, 18, seed + 2, 1.3)
    grass(img, horizon + 4, H, ground, ground_d, seed)


# ---------------------------------------------------------------- iso
def shade(c, k):
    return tuple(max(0, min(255, int(v * k))) for v in c)


class Iso:
    def __init__(self, img, ox, oy):
        self.img = img
        self.d = ImageDraw.Draw(img)
        self.ox, self.oy = ox, oy

    def P(self, x, y, z=0):
        return (self.ox + x - y, self.oy + (x + y) / 2 - z)

    def quad(self, pts, col, edge=None):
        self.d.polygon([self.P(*p) for p in pts], fill=col, outline=edge)

    def box(self, x0, y0, z0, x1, y1, z1, top, left=None, right=None, edge=True):
        left = left or shade(top, 0.78)
        right = right or shade(top, 0.62)
        e = (lambda c: shade(c, 0.6)) if edge else (lambda c: None)
        self.quad([(x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)], left, e(left))
        self.quad([(x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1)], right, e(right))
        self.quad([(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], top, e(top))

    def ground_rect(self, x0, y0, x1, y1, col, z=0):
        self.quad([(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z)], col)

    def sprite(self, im, x, y, z=0, s=1):
        sx, sy = self.P(x, y, z)
        blit(self.img, im, int(sx), int(sy), s)


# palette for the diorama
GR = (124, 190, 74)
GR_D = (98, 160, 62)
DIRT = (150, 104, 66)
DIRT_D = (118, 80, 50)
EARTH = (172, 132, 84)
WICKER = (168, 128, 78)
WICKER_D = (120, 88, 52)
WATER = (70, 140, 210)


def night_tint(img, k=0.38, tint=(40, 60, 140)):
    a = np.array(img).astype(np.float32)
    a[..., :3] = a[..., :3] * k + np.array(tint) * (1 - k) * 0.5
    img.paste(Image.fromarray(a.clip(0, 255).astype(np.uint8)))


def fort(img, t, ox=150, oy=58, build=1.0, romans=True, gauls=None, lilies=True, cippi=True,
         labels=False, flowers=0.0, stones=0.0, double=False, night=False, falling=None, banner=True, workers=False):
    """Draw the siege works diorama. gauls: list of (wx, wy, state) for attackers; falling: list of pit indexes
    a Gaul has dropped into."""
    iso = Iso(img, ox, oy)
    L, D, Z = 300, 180, 30
    # slab
    iso.box(0, 0, -Z, L, D, 0, GR, DIRT, DIRT_D)
    # grass texture on top
    rng = np.random.RandomState(4)
    pts = []
    for _ in range(900):
        x, y = rng.uniform(2, L - 2), rng.uniform(2, D - 2)
        pts.append(iso.P(x, y))
    iso.d.point(pts, fill=GR_D)

    WALL_X = 200
    # Roman camp behind the line: tents
    for i, (tx, ty) in enumerate([(240, 30), (262, 70), (240, 110), (270, 140)]):
        iso.box(tx, ty, 0, tx + 16, ty + 12, 7, (236, 226, 200), (210, 196, 166), (186, 172, 140))
        iso.quad([(tx, ty, 7), (tx + 16, ty, 7), (tx + 16, ty + 6, 12), (tx, ty + 6, 12)], (246, 238, 214))
        iso.quad([(tx, ty + 6, 12), (tx + 16, ty + 6, 12), (tx + 16, ty + 12, 7), (tx, ty + 12, 7)], (224, 212, 184))
    if double:
        # second (outer) wall on the far left, facing outwards
        iso.box(28, 0, 0, 40, D, 10, EARTH, shade(EARTH, 0.8), shade(EARTH, 0.65))
        for wy in range(0, D, 12):
            iso.box(28, wy, 10, 30, wy + 11, 26, WICKER, WICKER, WICKER_D)

    # ditch (fossa), filled with water from the river
    iso.ground_rect(176, 0, 190, D, WATER if not night else (40, 70, 120))
    iso.ground_rect(176, 0, 178, D, shade(WATER, 0.7))
    # cippi trench: rows of sharpened branches ("tombstones")
    if cippi:
        iso.ground_rect(156, 0, 166, D, DIRT_D)
    # lilies: pits in a quincunx
    pits = []
    if lilies:
        k = 0
        for row in range(4):
            for col in range(9):
                px = 112 + row * 11
                py = 8 + col * 19 + (row % 2) * 9
                if py > D - 8:
                    continue
                pits.append((px, py))
                k += 1
        for (px, py) in pits:
            iso.quad([(px - 4, py - 4), (px + 4, py - 4), (px + 4, py + 4), (px - 4, py + 4)], (60, 40, 26))
    # cross-section on the front-left face (wy = D): the textbook diagram
    face_y = D
    # pits in section
    for row in range(4):
        px = 112 + row * 11
        iso.quad([(px - 4, face_y, 0), (px + 4, face_y, 0), (px + 2, face_y, -14), (px - 2, face_y, -14)], (60, 40, 26))
        a = iso.P(px, face_y, -13)
        b = iso.P(px, face_y, -3)
        iso.d.line([a, b], fill=(226, 200, 150), width=1)
    # ditch section (V) with water
    iso.quad([(176, face_y, 0), (190, face_y, 0), (183, face_y, -16)], (54, 110, 180))
    # cippi section
    iso.quad([(156, face_y, 0), (166, face_y, 0), (164, face_y, -10), (158, face_y, -10)], (70, 48, 30))

    # ---- upright objects, sorted back-to-front
    items = []
    if cippi:
        for wy in range(4, D, 7):
            items.append((156 + wy, "branch", (161, wy)))
    if lilies:
        for i, (px, py) in enumerate(pits):
            items.append((px + py, "stake", (px, py, i)))
    # rampart + palisade + towers along the wall
    n_pan = int(math.ceil(D / 12 * build))
    items.append((WALL_X + 0, "rampart", None))
    for i in range(n_pan):
        wy = i * 12
        items.append((WALL_X + 1 + wy + 0.5, "panel", wy))
    towers = [20, 100, 170] if build >= 1 else []
    for ty in towers:
        items.append((WALL_X + 6 + ty + 3, "tower", ty))
    if romans:
        for i, wy in enumerate(range(10, D - 4, 28)):
            items.append((WALL_X + 9 + wy + 1, "roman", (WALL_X + 9, wy, i)))
    if workers and build < 1:
        y_end = n_pan * 12
        for i in range(3):
            items.append((WALL_X + 10 + y_end + i, "worker", (WALL_X + 12 + i * 8, y_end + 2 + i * 4, i)))
    if gauls:
        for (gx, gy, st) in gauls:
            items.append((gx + gy, "gaul", (gx, gy, st)))
    items.sort(key=lambda it: it[0])
    for _, kind, a in items:
        if kind == "branch":
            x, y = a
            p = iso.P(x, y, 0)
            iso.d.line([p, (p[0] - 2, p[1] - 6)], fill=WOOD_D)
            iso.d.line([p, (p[0] + 2, p[1] - 5)], fill=WOOD)
            iso.d.point([(p[0] - 2, p[1] - 7), (p[0] + 2, p[1] - 6)], fill=(230, 214, 170))
        elif kind == "stake":
            x, y, i = a
            p = iso.P(x, y, 0)
            if falling and i in falling:
                continue
            iso.d.line([(p[0], p[1] + 1), (p[0], p[1] - 5)], fill=(236, 210, 160))
            iso.d.point([(p[0], p[1] - 6)], fill=WHITE)
        elif kind == "rampart":
            iso.box(WALL_X, 0, 0, WALL_X + 14, D * min(1, build + 0.05), 12, (140, 170, 80), EARTH, shade(EARTH, 0.75))
            # front section of the rampart on the face
            iso.quad([(WALL_X, D, 0), (WALL_X + 14, D, 0), (WALL_X + 14, D, 12), (WALL_X, D, 12)], EARTH)
        elif kind == "panel":
            wy = a
            iso.box(WALL_X + 1, wy, 12, WALL_X + 3, wy + 11, 30, WICKER, WICKER, WICKER_D)
            for z in range(14, 30, 3):
                p0, p1 = iso.P(WALL_X + 3, wy, z), iso.P(WALL_X + 3, wy + 11, z)
                iso.d.line([p0, p1], fill=WICKER_D)
            # little pointed stakes on top
            for k in range(0, 11, 4):
                p = iso.P(WALL_X + 2, wy + k, 30)
                iso.d.line([p, (p[0], p[1] - 3)], fill=WOOD_D)
        elif kind == "tower":
            ty = a
            x0 = WALL_X + 2
            for (dx, dy) in [(0, 0), (12, 0), (0, 12), (12, 12)]:
                iso.box(x0 + dx, ty + dy, 0, x0 + dx + 2, ty + dy + 2, 52, WOOD, WOOD, WOOD_D, edge=False)
            iso.box(x0, ty, 46, x0 + 14, ty + 14, 49, WOOD, WOOD, WOOD_D)
            iso.box(x0, ty, 49, x0 + 14, ty + 14, 60, WICKER, WICKER, WICKER_D)
            iso.box(x0 + 2, ty + 2, 49, x0 + 12, ty + 12, 60, (90, 60, 40), (90, 60, 40), (90, 60, 40), edge=False)
            iso.sprite(sp.mini_cached("roman", 1, 0), x0 + 7, ty + 7, 52)
            if banner and ty == 100:
                iso.sprite(sp.bull_banner(int(t * 6)), x0 + 7, ty + 7, 58)
        elif kind == "roman":
            x, y, i = a
            iso.sprite(sp.mini_cached("roman", i, int(t * 4 + i) % 2 if night else 0), x, y, 12)
        elif kind == "worker":
            x, y, i = a
            hop = int((t * 8 + i) % 2) * 2
            iso.sprite(sp.mini_cached("roman", i + 1, int(t * 8 + i) % 2), x, y, 12 + hop)
        elif kind == "gaul":
            x, y, st = a
            if night:
                iso.sprite(sp.mini("eyes"), x, y, 0)
            else:
                iso.sprite(sp.mini_cached("gaul", int(x + y) % 5, int(t * 6) % 2), x, y, 0)
    if night:
        night_tint(img)
        # eyes stay bright after the tint
        if gauls:
            for (gx, gy, st) in gauls:
                if st == "walk":
                    p = iso.P(gx, gy, 0)
                    blink = (int(t * 3 + gx) % 7) == 0
                    if not blink:
                        iso.d.point([(p[0] - 1, p[1] - 7), (p[0] + 1, p[1] - 7)], fill=(255, 250, 190))
    return iso, pits
