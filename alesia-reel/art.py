"""Pixel-art helpers: palette, fonts, outlined sprites and the character builder.

Everything is drawn at the base resolution (360x640) and scaled up 3x with
nearest-neighbour at encode time, so every 'pixel' here is a chunky pixel."""
import os
from functools import lru_cache
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
W, H = 360, 640

OUT = (30, 22, 38)          # outline ink
WHITE = (252, 250, 240)
BLACK = (20, 16, 26)

# ---------------------------------------------------------------- fonts / text
FONTS = {
    "pix": "PixelifySans-Bold.ttf",
    "pixr": "PixelifySans-Regular.ttf",
    "silk": "Silkscreen-Bold.ttf",
    "silkr": "Silkscreen.ttf",
    "press": "PressStart2P.ttf",
}


@lru_cache(None)
def font(name, size):
    return ImageFont.truetype(os.path.join(HERE, "fonts", FONTS[name]), size)


def text(img, xy, s, size=16, fill=WHITE, f="pix", anchor="la", outline=OUT, ow=1, shadow=None):
    d = ImageDraw.Draw(img)
    d.fontmode = "1"
    fnt = font(f, size)
    x, y = xy
    if shadow:
        d.text((x + 1, y + 2), s, font=fnt, fill=shadow, anchor=anchor)
    if outline is not None:
        for dx in range(-ow, ow + 1):
            for dy in range(-ow, ow + 1):
                if dx or dy:
                    d.text((x + dx, y + dy), s, font=fnt, fill=outline, anchor=anchor)
    d.text((x, y), s, font=fnt, fill=fill, anchor=anchor)


def text_size(s, size=16, f="pix"):
    l, t, r, b = font(f, size).getbbox(s)
    return r - l, b - t


# ---------------------------------------------------------------- sprites
class Spr:
    """A tiny RGBA canvas drawn in flat colours, outlined automatically."""

    def __init__(self, w, h):
        self.w, self.h = w, h
        self.im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.im)

    def r(self, x, y, w, h, c):
        if w > 0 and h > 0:
            self.d.rectangle([x, y, x + w - 1, y + h - 1], fill=c)

    def p(self, x, y, c):
        self.d.point((x, y), fill=c)

    def pts(self, pts, c):
        self.d.point(pts, fill=c)

    def e(self, x, y, w, h, c):
        self.d.ellipse([x, y, x + w - 1, y + h - 1], fill=c)

    def poly(self, pts, c):
        self.d.polygon(pts, fill=c)

    def line(self, pts, c, w=1):
        self.d.line(pts, fill=c, width=w)

    def outlined(self, c=OUT):
        return outline(self.im, c)


def outline(im, c=OUT):
    a = np.array(im)
    h, w = a.shape[:2]
    out = np.zeros((h + 2, w + 2, 4), np.uint8)
    out[1:-1, 1:-1] = a
    m = out[..., 3] > 0
    dil = m.copy()
    dil[1:, :] |= m[:-1, :]
    dil[:-1, :] |= m[1:, :]
    dil[:, 1:] |= m[:, :-1]
    dil[:, :-1] |= m[:, 1:]
    ring = dil & ~m
    out[ring] = (*c, 255)
    return Image.fromarray(out)


def blit(canvas, im, x, y, s=1, flip=False, anchor="mb", alpha=1.0):
    """Paste sprite scaled by integer s. anchor: 'mb' = (x,y) is bottom-centre, 'lt' = top-left."""
    if flip:
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    if s != 1:
        im = im.resize((im.width * s, im.height * s), Image.NEAREST)
    if alpha < 1.0:
        a = np.array(im)
        a[..., 3] = (a[..., 3] * alpha).astype(np.uint8)
        im = Image.fromarray(a)
    if anchor == "mb":
        x, y = x - im.width // 2, y - im.height
    elif anchor == "mm":
        x, y = x - im.width // 2, y - im.height // 2
    canvas.alpha_composite(im, (int(x), int(y))) if canvas.mode == "RGBA" else canvas.paste(im, (int(x), int(y)), im)
    return im.size


def recolor(im, ramp):
    """Map an RGBA sprite onto a colour ramp by luminance (used for the bronze statue)."""
    a = np.array(im).astype(np.float32)
    lum = (a[..., 0] * 0.3 + a[..., 1] * 0.59 + a[..., 2] * 0.11) / 255.0
    ramp = np.array(ramp, np.float32)
    idx = np.clip((lum * (len(ramp) - 1) + 0.5).astype(int), 0, len(ramp) - 1)
    out = a.copy()
    out[..., :3] = ramp[idx]
    return Image.fromarray(out.astype(np.uint8))


# ---------------------------------------------------------------- palette
SKIN = (246, 196, 152)
SKIN_D = (214, 150, 112)
SKIN_OLD = (236, 190, 160)
RED = (222, 38, 52)
RED_B = (255, 46, 58)
RED_D = (150, 22, 40)
GOLD = (252, 202, 58)
GOLD_D = (196, 136, 34)
SILVER = (214, 220, 230)
SILVER_D = (150, 158, 176)
MAIL = (128, 140, 132)
MAIL_D = (92, 102, 98)
LEATHER = (132, 78, 42)
LEATHER_D = (92, 52, 30)
GRAY_HAIR = (196, 196, 204)
GREEN = (98, 178, 64)
GREEN_D = (48, 112, 52)
BLUE = (58, 112, 206)
BLUE_D = (34, 64, 138)
CREAM = (238, 226, 184)
BROWN = (122, 70, 40)
BROWN_D = (84, 46, 30)
HAIR_RED = (176, 72, 34)
HAIR_RED_D = (120, 44, 24)
WOOD = (150, 104, 60)
WOOD_D = (100, 66, 38)
MOUTH = (120, 20, 34)

GAUL_HAIRS = [((206, 150, 60), (150, 100, 36)), (HAIR_RED, HAIR_RED_D), ((90, 60, 40), (60, 38, 26)),
              ((230, 200, 110), (180, 150, 70)), ((60, 46, 40), (40, 30, 28))]
GAUL_TUNICS = [((58, 112, 206), (34, 64, 138)), ((98, 160, 70), (52, 104, 48)), ((190, 120, 50), (130, 80, 34)),
               ((150, 60, 120), (100, 36, 84)), ((200, 190, 150), (150, 140, 106))]

# Art-space layout: sprite is 32 wide x 40 tall, body centred on x=16.
SW, SH = 32, 40
CX = 16


def _plaid(s, x, y, w, h, a, b):
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            s.p(xx, yy, a if ((xx // 2 + yy // 2) % 2 == 0) else b)


def _mail(s, x, y, w, h):
    s.r(x, y, w, h, MAIL)
    for yy in range(y, y + h):
        for xx in range(x + (yy % 2), x + w, 2):
            s.p(xx, yy, MAIL_D)


def figure(kind="soldier", mouth=0, head=0, arm="down", arm2="down", face="normal", cloak=0,
           shield=False, walk=0, seed=0, curl=0.0, beard_len=0, eyes_closed=False, sweat=False, helmet=True,
           wave=0):
    """Build a chunky character. kind: caesar | soldier | marcus | verc | gaul | old | crit | nap.
    head: 0 front, 1 right, 2 back, 3 left.  mouth: 0 closed, 1 open.  curl: moustache 0 droopy .. 1 waxed.
    arm/arm2: right/left arm pose: down | salute | point | wave | thumb | up | cane | sword."""
    s = Spr(SW, SH)
    roman = kind in ("caesar", "soldier", "marcus")
    rng = np.random.RandomState(seed)

    # ---- colours per kind
    if kind == "caesar":
        hair, hair_d = GRAY_HAIR, (150, 150, 160)
        torso = "cuirass"
    elif roman:
        hair, hair_d = (92, 60, 40), (60, 40, 28)
        torso = "mail"
    elif kind == "verc":
        hair, hair_d = HAIR_RED, HAIR_RED_D
        torso = "verc"
    elif kind == "old":
        hair, hair_d = (240, 240, 244), (190, 190, 204)
        torso = "old"
    elif kind == "nap":
        hair, hair_d = (60, 44, 36), (36, 26, 22)
        torso = "nap"
    else:
        hair, hair_d = GAUL_HAIRS[seed % len(GAUL_HAIRS)]
        if kind == "crit":
            hair, hair_d = (50, 36, 32), (30, 22, 20)
        torso = "gaul"
    skin, skin_d = (SKIN_OLD, SKIN_D) if kind == "old" else (SKIN, SKIN_D)

    hy = 4 if kind != "old" else 7      # head top
    by = hy + 11                         # torso top

    # ---- cloak behind body
    if cloak:
        cc, cd = (RED_B, RED) if cloak == 2 else (RED, RED_D)
        if cloak == 2:
            s.poly([(CX - 7, by), (CX + 7, by), (CX + 15, SH - 3), (CX - 15, SH - 3)], cd)
            s.poly([(CX - 6, by), (CX + 6, by), (CX + 12, SH - 4), (CX - 12, SH - 4)], cc)
        else:
            s.poly([(CX - 7, by), (CX + 7, by), (CX + 9, by + 19), (CX - 9, by + 19)], cd)
    if kind == "verc":
        s.poly([(CX - 7, by), (CX + 7, by), (CX + 9, by + 18), (CX - 9, by + 18)], (210, 196, 150))

    # ---- legs
    ly = by + 14
    lo = [0, 1, 0, -1][walk % 4]
    if roman or kind == "caesar":
        s.r(CX - 4, ly, 3, 6 + lo, skin)
        s.r(CX + 1, ly, 3, 6 - lo, skin)
        s.r(CX - 5, ly + 5 + lo, 4, 2, LEATHER)
        s.r(CX + 1, ly + 5 - lo, 4, 2, LEATHER)
    elif kind == "nap":
        s.r(CX - 4, ly, 3, 7, (230, 230, 236))
        s.r(CX + 1, ly, 3, 7, (230, 230, 236))
        s.r(CX - 5, ly + 6, 4, 2, BLACK)
        s.r(CX + 1, ly + 6, 4, 2, BLACK)
    else:
        ta, tb = GAUL_TUNICS[(seed + 2) % len(GAUL_TUNICS)]
        if kind == "verc":
            ta, tb = (110, 130, 96), (80, 96, 70)
        if kind == "old":
            ta, tb = (150, 130, 110), (120, 104, 88)
        _plaid(s, CX - 4, ly, 3, 6 + lo, ta, tb)
        _plaid(s, CX + 1, ly, 3, 6 - lo, ta, tb)
        s.r(CX - 5, ly + 5 + lo, 4, 2, BROWN_D)
        s.r(CX + 1, ly + 5 - lo, 4, 2, BROWN_D)

    # ---- torso
    tw = 12
    tx = CX - tw // 2
    if torso == "cuirass":
        s.r(tx, by, tw, 10, SILVER)
        s.r(tx, by + 8, tw, 2, SILVER_D)
        s.r(tx + 1, by + 1, 3, 3, (240, 244, 250))
        s.pts([(CX - 1, by + 4), (CX, by + 4), (CX - 2, by + 3), (CX + 1, by + 3), (CX - 1, by + 5), (CX, by + 5)], GOLD)
        s.line([(tx, by), (tx + tw - 1, by + 9)], LEATHER)
        for i in range(6):                                  # pteruges
            s.r(tx + i * 2, by + 10, 2, 5, RED if i % 2 == 0 else RED_D)
            s.p(tx + i * 2, by + 10, GOLD)
    elif torso == "mail":
        s.r(tx, by + 9, tw, 5, RED)
        _mail(s, tx, by, tw, 10)
        s.r(tx, by + 9, tw, 1, LEATHER)
        s.r(CX - 3, by, 6, 2, RED)                          # scarf
        s.r(CX - 1, by + 2, 2, 2, RED)
        s.r(tx - 1, by, 2, 3, RED)
        s.r(tx + tw - 1, by, 2, 3, RED)
    elif torso == "verc":
        s.r(tx, by, tw, 14, (122, 62, 40))
        s.r(tx + 2, by + 1, tw - 4, 6, (176, 120, 50))       # embroidered vest
        for xx in range(tx + 2, tx + tw - 2, 2):
            s.p(xx, by + 3, GOLD)
        s.r(tx, by + 8, tw, 2, GOLD_D)                      # belt
        s.r(CX - 3, by, 6, 1, GOLD)                         # torc
    elif torso == "old":
        s.r(tx, by, tw, 14, (150, 120, 96))
        s.r(tx, by + 8, tw, 1, BROWN_D)
    elif torso == "nap":
        s.r(tx, by, tw, 14, (36, 48, 104))
        s.r(tx - 1, by, 3, 2, GOLD)
        s.r(tx + tw - 2, by, 3, 2, GOLD)
        s.line([(tx, by + 1), (tx + tw - 1, by + 9)], RED)
        s.line([(tx, by + 2), (tx + tw - 1, by + 10)], RED)
        for yy in range(by + 2, by + 13, 3):
            s.p(CX, yy, GOLD)
    else:
        ta, tb = GAUL_TUNICS[seed % len(GAUL_TUNICS)]
        if kind == "crit":
            ta, tb = (70, 90, 60), (50, 66, 44)
        _plaid(s, tx, by, tw, 14, ta, tb)
        s.r(tx, by + 8, tw, 1, BROWN_D)
        s.r(CX - 3, by, 6, 1, GOLD)

    # ---- arms
    sleeve = {"cuirass": RED, "mail": RED, "verc": (96, 120, 80), "old": (150, 120, 96), "nap": (36, 48, 104)}.get(
        torso, GAUL_TUNICS[seed % len(GAUL_TUNICS)][1])

    def arm_pose(side, pose):
        sx = tx + tw if side > 0 else tx - 3          # shoulder column
        if pose == "down":
            s.r(sx, by, 3, 3, sleeve)
            s.r(sx, by + 3, 3, 6, skin)
        elif pose in ("up", "wave"):
            dx = [0, 1, 2, 1][wave % 4] * side if pose == "wave" else 0
            s.r(sx, by - 2, 3, 3, sleeve)
            s.r(sx + dx, by - 9, 3, 7, skin)
            s.r(sx + dx - (1 if side > 0 else 0), by - 11, 4, 3, skin)
        elif pose == "salute":                         # Roman salute, up and out
            s.r(sx, by, 3, 3, sleeve)
            s.line([(sx + 1, by + 1), (sx + 1 + 6 * side, by - 6)], skin, 3)
        elif pose == "point":
            s.r(sx, by, 3, 3, sleeve)
            s.r(sx if side > 0 else sx - 6, by + 1, 9, 3, skin)
        elif pose == "thumb":
            s.r(sx, by, 3, 3, sleeve)
            s.r(sx + (1 if side > 0 else -1), by + 2, 3, 4, skin)
            s.r(sx + (2 if side > 0 else -2), by - 1, 4, 4, skin)
            s.r(sx + (3 if side > 0 else -1), by - 4, 2, 3, skin)    # the thumb
        elif pose == "cane":
            s.r(sx, by, 3, 3, sleeve)
            s.r(sx, by + 3, 3, 5, skin)
            s.r(sx + side * 2 + (0 if side > 0 else 1), by + 6, 1, SH - by - 8, WOOD)
        elif pose == "sword":
            s.r(sx, by, 3, 3, sleeve)
            s.r(sx, by + 3, 3, 6, skin)
            s.r(sx + 1, by + 9, 1, 12, SILVER)
            s.r(sx - 1, by + 8, 5, 1, GOLD_D)
        elif pose == "hold":                           # forearm forward, holding something
            s.r(sx, by, 3, 3, sleeve)
            s.r(sx + (0 if side > 0 else -2), by + 4, 5, 3, skin)

    arm_pose(1, arm)
    arm_pose(-1, arm2)

    # ---- head
    hx = CX - 5
    s.r(hx, hy, 10, 11, skin)
    if head in (0, 1, 3):
        s.r(hx - 1, hy + 4, 1, 3, skin)
        s.r(hx + 10, hy + 4, 1, 3, skin)

    def eyes(xs):
        for ex in xs:
            if eyes_closed:
                s.r(ex, hy + 6, 2, 1, OUT)
            else:
                s.r(ex, hy + 5, 1, 2, OUT)
                if face == "shock":
                    s.r(ex, hy + 4, 1, 3, OUT)
        if face == "sad":
            for ex in xs:
                s.p(ex - 1, hy + 3, hair_d)
                s.p(ex, hy + 4, hair_d) if False else None
        if face in ("angry", "smug"):
            for i, ex in enumerate(xs):
                s.r(ex - 1, hy + 3 + (i == 0) * 0, 3, 1, hair_d)

    def mouth_at(mx, w):
        my = hy + 9
        if mouth:
            s.r(mx, my - 1, w, 2, MOUTH)
        elif face == "sad":
            s.r(mx + 1, my - 1, w - 2, 1, OUT)
            s.p(mx, my, OUT)
            s.p(mx + w - 1, my, OUT)
        elif face in ("happy", "smug"):
            s.p(mx, my - 1, OUT)
            s.r(mx + 1, my, w - 2, 1, OUT)
            s.p(mx + w - 1, my - 1, OUT)
        elif face == "shock":
            s.r(mx + 1, my - 2, 2, 3, OUT)
        else:
            s.r(mx, my, w, 1, OUT)

    gaulish = kind in ("verc", "gaul", "old", "crit")
    if head == 0:
        eyes([hx + 2, hx + 7])
        s.r(hx + 4, hy + 6, 2, 2, skin_d)                   # nose
        if not gaulish and kind != "nap":
            mouth_at(hx + 3, 4)
    elif head in (1, 3):
        eyes([hx + 7])
        s.r(hx + 10, hy + 5, 1, 3, skin)                    # nose sticks out
        s.r(hx + 2, hy + 4, 2, 3, skin_d)                   # ear
        if not gaulish and kind != "nap":
            mouth_at(hx + 6, 3)

    # hair / helmets
    if roman and kind != "caesar" and helmet:
        metal, metal_d = ((206, 160, 72), (150, 108, 40)) if seed % 2 else (SILVER, SILVER_D)
        s.r(hx - 1, hy - 1, 12, 4, metal)
        s.r(hx - 1, hy + 2, 12, 1, metal_d)
        if head in (0, 1, 3):
            s.r(hx - 1, hy + 3, 2, 5, metal)
            s.r(hx + 9, hy + 3, 2, 5, metal)
        if head == 2:
            s.r(hx - 1, hy + 3, 12, 8, hair)
            s.r(hx - 1, hy + 9, 12, 2, metal)
        if kind == "soldier" and seed % 3 == 0:
            s.r(hx + 3, hy - 4, 4, 3, RED)                  # crest
    elif kind == "nap":
        s.r(hx - 1, hy - 1, 12, 4, hair)
        s.r(hx - 1, hy + 2, 2, 3, hair)
        s.r(hx + 9, hy + 2, 2, 3, hair)
        s.p(hx + 3, hy + 1, skin)                           # parting
    else:
        if gaulish:
            long_ = 9 if kind != "old" else 10
            s.r(hx - 2, hy - 1, 14, 4, hair)
            if head == 2:
                s.r(hx - 2, hy - 1, 14, 11 + long_ // 2, hair)
            else:
                s.r(hx - 2, hy + 2, 2, long_, hair)
                s.r(hx + 10, hy + 2, 2, long_, hair)
                s.r(hx - 2, hy + 2 + long_ - 2, 2, 2, hair_d)
                s.r(hx + 10, hy + 2 + long_ - 2, 2, 2, hair_d)
        else:  # caesar
            s.r(hx - 1, hy - 1, 12, 3, hair)
            if head in (0, 1, 3):
                s.r(hx - 1, hy + 2, 1, 3, hair)
                s.r(hx + 10, hy + 2, 1, 3, hair)
            if head == 2:
                s.r(hx - 1, hy - 1, 12, 9, hair)
            for i in range(0, 12, 2):                       # laurel wreath
                s.p(hx - 1 + i, hy + 1, GREEN)
                s.p(hx + i, hy, GREEN_D)
            if head == 1:
                s.r(hx - 1, hy - 1, 3, 7, hair)
            if head == 3:
                s.r(hx + 8, hy - 1, 3, 7, hair)

    if kind == "verc" and helmet:                           # winged golden helmet
        s.r(hx - 1, hy - 3, 12, 4, GOLD)
        s.r(hx - 1, hy, 12, 1, GOLD_D)
        s.r(hx + 3, hy - 4, 4, 1, GOLD)
        s.poly([(hx - 2, hy - 2), (hx - 7, hy - 8), (hx - 6, hy - 3)], (236, 236, 236))
        s.poly([(hx + 11, hy - 2), (hx + 16, hy - 8), (hx + 15, hy - 3)], (236, 236, 236))

    # facial hair for Gauls / Napoleon
    if head in (0, 1, 3) and (gaulish or kind == "nap"):
        mc, mcd = (hair, hair_d) if kind != "old" else ((248, 248, 252), (200, 200, 214))
        mx0 = hx + 2 if head == 0 else hx + 5
        my = hy + 8
        if beard_len or kind in ("old", "crit"):
            bl = beard_len or (9 if kind == "old" else 4)
            s.r(hx + 1, hy + 8, 8, 2 + bl, mc)
            s.r(hx + 2, hy + 9 + bl, 6, 2, mcd)
        if mouth:
            s.r(hx + 3 if head == 0 else hx + 6, my + 1, 4 if head == 0 else 3, 2, MOUTH)
        # moustache: droopy -> waxed, controlled by curl
        if kind == "nap":
            curl = 1.0
        mw = 8 if head == 0 else 5
        if head == 0:
            mx0 = hx + 1
        s.r(mx0, my, mw, 2, mc)
        if curl < 0.5:
            drop = int(round((1 - curl * 2) * 6))
            # droopy ends hanging down past the chin
            s.r(mx0 - 1, my + 1, 2, drop + 1, mc)
            s.r(mx0 + mw - 1, my + 1, 2, drop + 1, mc)
            s.r(mx0 - 1, my + drop + 1, 2, 1, mcd)
            s.r(mx0 + mw - 1, my + drop + 1, 2, 1, mcd)
        else:
            rise = int(round((curl - 0.5) * 2 * 5))
            reach = 3 + int(round((curl - 0.5) * 2 * 4))
            # waxed points out past the hair, tips turned up
            s.line([(mx0 - 1, my + 1), (mx0 - reach, my + 1 - rise)], mc, 2 if curl < 0.8 else 1)
            s.line([(mx0 + mw, my + 1), (mx0 + mw + reach - 1, my + 1 - rise)], mc, 2 if curl < 0.8 else 1)
            if curl > 0.7:  # the imperial (Napoleon III goatee)
                s.r(hx + 4 if head == 0 else hx + 6, hy + 11, 2, 3 + int((curl - 0.7) * 10), mc)
        if kind == "nap":
            s.r(hx + 4, hy + 11, 2, 5, mc)

    if sweat:
        s.r(hx + 11, hy + 1, 2, 3, (130, 200, 250))
        s.p(hx + 11, hy + 1, WHITE)

    # ---- shield in front
    if shield:
        if roman:
            s.r(CX + 1, by - 1, 10, 16, RED)
            s.r(CX + 1, by - 1, 10, 1, GOLD)
            s.r(CX + 1, by + 14, 10, 1, GOLD)
            s.r(CX + 5, by + 5, 3, 3, GOLD)
            s.line([(CX + 2, by + 1), (CX + 5, by + 5)], GOLD)
            s.line([(CX + 10, by + 1), (CX + 7, by + 5)], GOLD)
        else:
            s.e(CX + 1, by - 2, 10, 18, (214, 186, 136))
            s.e(CX + 4, by + 5, 4, 4, (150, 110, 70))

    return s.outlined()


def horse(frame=0, color=(150, 96, 52)):
    s = Spr(44, 30)
    c, cd = color, tuple(int(v * 0.7) for v in color)
    lg = [(0, 2), (1, 1), (2, 0), (1, 1)][frame % 4]
    for i, lx in enumerate([11, 15, 29, 33]):
        off = lg[i % 2]
        s.r(lx, 18, 3, 9 - off, cd if i in (1, 3) else c)
        s.r(lx, 26 - off, 3, 2, BLACK)
    s.e(8, 8, 30, 13, c)
    s.poly([(32, 12), (36, 2), (41, 3), (39, 14)], c)          # neck
    s.r(36, 1, 7, 6, c)                                          # head
    s.r(41, 4, 2, 3, cd)
    s.p(38, 3, OUT)
    s.r(33, 0, 4, 10, (60, 36, 24))                              # mane
    s.poly([(9, 10), (2, 20), (5, 21), (10, 14)], (60, 36, 24))  # tail
    s.r(18, 7, 12, 4, RED)                                       # saddle cloth
    s.r(18, 11, 12, 1, GOLD)
    return s.outlined()


def tiny_man(color, skin=SKIN):
    s = Spr(3, 6)
    s.r(0, 0, 3, 2, skin)
    s.r(0, 2, 3, 3, color)
    s.r(0, 5, 1, 1, OUT)
    s.r(2, 5, 1, 1, OUT)
    return s.outlined()
