"""Small pixel sprites and props: unit icons, banners, tiny eBoy people, gag props."""
import math
from functools import lru_cache
import numpy as np
from PIL import Image
from art import (Spr, outline, OUT, WHITE, BLACK, SKIN, SKIN_D, RED, RED_B, RED_D, GOLD, GOLD_D, SILVER, SILVER_D,
                 MAIL, LEATHER, GREEN, GREEN_D, BLUE, BLUE_D, CREAM, BROWN, BROWN_D, WOOD, WOOD_D, GAUL_HAIRS,
                 GAUL_TUNICS, HAIR_RED, text, font)

# Gallic shield designs (body colour, ornament colour) after the painted La Tene shields
GAUL_SHIELDS = [
    ("oval", (200, 46, 40), (250, 236, 210)),
    ("hex", (40, 36, 36), (236, 226, 200)),
    ("oval", (236, 228, 206), (150, 50, 40)),
    ("hex", (70, 150, 60), (240, 230, 190)),
    ("oval", (240, 196, 60), (60, 40, 30)),
    ("hex", (60, 100, 190), (240, 236, 220)),
    ("chk", (200, 46, 40), (30, 30, 30)),
    ("oval", (130, 86, 50), (240, 226, 190)),
]


@lru_cache(None)
def gaul_shield(i=0):
    shape, body, orn = GAUL_SHIELDS[i % len(GAUL_SHIELDS)]
    s = Spr(11, 17)
    if shape == "oval" or shape == "chk":
        s.e(0, 0, 11, 17, body)
    else:
        s.poly([(2, 0), (8, 0), (10, 4), (10, 12), (8, 16), (2, 16), (0, 12), (0, 4)], body)
    if shape == "chk":
        for yy in range(2, 15):
            for xx in range(1, 10):
                if (xx + yy) % 2 == 0 and (yy < 6 or yy > 10):
                    s.p(xx, yy, orn)
    else:
        for (x, y) in [(2, 3), (8, 3), (2, 13), (8, 13), (3, 8), (7, 8)]:
            s.p(x, y, orn)
    s.r(5, 1, 1, 15, orn)          # spina
    s.r(3, 7, 5, 3, orn)           # boss
    s.p(5, 8, body)
    return s.outlined()


@lru_cache(None)
def scutum():
    s = Spr(11, 15)
    s.r(0, 0, 11, 15, RED)
    s.r(0, 0, 11, 1, GOLD)
    s.r(0, 14, 11, 1, GOLD)
    s.r(4, 6, 3, 3, GOLD)
    s.line([(1, 1), (4, 6)], GOLD)
    s.line([(9, 1), (6, 6)], GOLD)
    s.line([(1, 13), (4, 8)], GOLD)
    s.line([(9, 13), (6, 8)], GOLD)
    return s.outlined()


def bull(s, x, y, c=GOLD, run=0):
    """Original charging-bull emblem (Caesar's legions, e.g. Legio X), drawn at ~16x10."""
    s.e(x + 2, y + 3, 10, 5, c)            # body
    s.e(x + 7, y + 1, 6, 5, c)             # hump
    s.r(x + 12, y + 2, 3, 4, c)            # head
    s.r(x + 15, y + 4, 1, 2, c)            # muzzle
    s.p(x + 13, y + 1, c)
    s.p(x + 14, y + 0, c)                  # horn
    s.p(x + 12, y + 0, c)
    lg = [0, 1][run % 2]
    s.line([(x + 4, y + 7), (x + 2 + lg, y + 10)], c)
    s.line([(x + 6, y + 7), (x + 7 - lg, y + 10)], c)
    s.line([(x + 10, y + 7), (x + 12 + lg, y + 10)], c)
    s.line([(x + 11, y + 7), (x + 9, y + 10)], c)
    s.line([(x + 2, y + 4), (x + 0, y + 1)], c)   # tail up
    s.p(x + 1, y + 0, c)


def bull_banner(wave=0):
    s = Spr(26, 42)
    s.r(12, 0, 2, 42, WOOD_D)                  # pole
    s.r(2, 4, 22, 2, WOOD)                     # crossbar
    s.r(11, 0, 4, 2, GOLD)                     # finial
    off = [0, 1, 0, -1][wave % 4]
    s.r(3, 6, 20, 20, RED)
    s.r(3, 6, 20, 1, RED_D)
    for i in range(3, 23, 2):                  # gold fringe
        s.r(i, 26 + ((i // 2 + wave) % 2) * 0 + (off if i > 12 else 0) * 0, 1, 3, GOLD)
    bull(s, 5, 11, GOLD, wave // 2)
    s.r(7, 23, 12, 1, GOLD_D)
    return s.outlined()


@lru_cache(None)
def boar_standard():
    s = Spr(18, 36)
    s.r(8, 8, 2, 28, WOOD_D)
    s.e(1, 1, 14, 7, (200, 170, 90))           # bronze boar body
    s.r(13, 2, 4, 4, (200, 170, 90))
    s.r(5, 0, 6, 2, (160, 130, 60))            # bristles
    s.r(3, 7, 1, 2, (160, 130, 60))
    s.r(11, 7, 1, 2, (160, 130, 60))
    s.p(15, 3, OUT)
    return s.outlined()


def mini(kind="roman", seed=0, frame=0, face=0):
    """eBoy-scale person, 5x9. kind: roman | gaul | caesar | eyes (night)."""
    s = Spr(5, 9)
    if kind == "eyes":
        s.p(1, 2, (255, 250, 200))
        s.p(3, 2, (255, 250, 200))
        return s.im
    skin = SKIN
    if kind in ("roman", "caesar"):
        body = RED if kind == "roman" else SILVER
        s.r(1, 3, 3, 4, body)
        s.r(1, 4, 3, 1, MAIL if kind == "roman" else GOLD)
        s.r(1, 0, 3, 3, skin)
        s.r(1, 0, 3, 1, SILVER if kind == "roman" else (200, 200, 205))
        if kind == "caesar":
            s.r(0, 3, 1, 5, RED)
            s.r(4, 3, 1, 5, RED)
    else:
        hair = GAUL_HAIRS[seed % len(GAUL_HAIRS)][0]
        body = GAUL_TUNICS[seed % len(GAUL_TUNICS)][0]
        s.r(1, 3, 3, 4, body)
        s.r(1, 0, 3, 3, skin)
        s.r(0, 0, 5, 1, hair)
        s.r(0, 1, 1, 3, hair)
        s.r(4, 1, 1, 3, hair)
        s.r(1, 2, 3, 1, hair)        # moustache
    lg = frame % 2
    s.r(1, 7, 1, 2 - lg, (60, 40, 30))
    s.r(3, 7, 1, 1 + lg, (60, 40, 30))
    if face:
        s.p(1, 1, OUT)
        s.p(3, 1, OUT)
    return s.outlined()


@lru_cache(None)
def mini_cached(kind, seed, frame):
    return mini(kind, seed, frame)


def cloud(w=40, seed=0):
    rng = np.random.RandomState(seed)
    s = Spr(w, 16)
    for i in range(6):
        cw = rng.randint(10, 18)
        s.e(rng.randint(0, w - cw), rng.randint(2, 8), cw, rng.randint(7, 10), WHITE)
    s.r(2, 10, w - 4, 4, WHITE)
    s.r(2, 13, w - 4, 1, (210, 226, 240))
    return s.im


def raincloud(frame=0):
    s = Spr(28, 26)
    s.e(0, 3, 14, 10, (120, 124, 140))
    s.e(8, 0, 14, 11, (130, 134, 150))
    s.e(14, 4, 14, 9, (110, 114, 130))
    s.r(3, 8, 22, 5, (120, 124, 140))
    for i, x in enumerate(range(4, 26, 4)):
        yy = 14 + ((frame + i * 3) % 4) * 3
        s.r(x, yy, 1, 2, (120, 180, 250))
    return s.outlined()


def sun(frame=0):
    s = Spr(24, 24)
    s.e(6, 6, 12, 12, (255, 220, 70))
    for k in range(8):
        a = k / 8 * 2 * math.pi + frame * 0.1
        x, y = 12 + math.cos(a) * 10, 12 + math.sin(a) * 10
        s.r(int(x), int(y), 2, 2, (255, 200, 50))
    s.p(9, 10, OUT)
    s.p(14, 10, OUT)
    s.r(10, 14, 4, 1, OUT)
    return s.outlined()


def lily_flower():
    s = Spr(9, 10)
    s.r(4, 4, 1, 6, GREEN_D)
    s.poly([(4, 0), (1, 4), (4, 5), (7, 4)], WHITE)
    s.r(3, 2, 3, 2, (255, 200, 220))
    s.p(4, 3, GOLD)
    s.r(5, 7, 2, 1, GREEN)
    return s.outlined()


def tombstone():
    s = Spr(11, 13)
    s.r(1, 3, 9, 10, (170, 170, 180))
    s.e(1, 0, 9, 7, (170, 170, 180))
    s.r(1, 3, 1, 10, (130, 130, 140))
    s.r(3, 4, 5, 1, (100, 100, 110))
    s.r(3, 6, 5, 1, (100, 100, 110))
    s.r(0, 12, 11, 1, (90, 150, 60))
    return s.outlined()


def heart(full=True):
    s = Spr(7, 6)
    c = (230, 40, 60) if full else (90, 80, 90)
    s.r(0, 1, 7, 2, c)
    s.r(1, 0, 2, 1, c)
    s.r(4, 0, 2, 1, c)
    s.r(1, 3, 5, 1, c)
    s.r(2, 4, 3, 1, c)
    s.p(3, 5, c)
    s.p(1, 1, WHITE)
    return s.outlined()


def crossed_swords():
    s = Spr(11, 11)
    s.line([(0, 0), (9, 9)], SILVER, 1)
    s.line([(10, 0), (1, 9)], SILVER, 1)
    s.r(1, 8, 2, 2, GOLD_D)
    s.r(8, 8, 2, 2, GOLD_D)
    return s.outlined()


def cauldron(bubble=0):
    s = Spr(24, 18)
    s.e(0, 2, 24, 16, (50, 50, 56))
    s.r(2, 2, 20, 3, (80, 80, 90))
    s.r(4, 3, 16, 1, (30, 30, 36))     # empty
    s.r(3, 16, 3, 2, (40, 40, 44))
    s.r(18, 16, 3, 2, (40, 40, 44))
    return s.outlined()


def fire(frame=0):
    s = Spr(16, 14)
    rng = np.random.RandomState(frame % 6)
    for i in range(5):
        h = rng.randint(5, 11)
        x = 2 + i * 2 + rng.randint(-1, 2)
        s.r(x, 12 - h, 3, h, (250, 120 + rng.randint(0, 60), 30))
        s.r(x + 1, 13 - h // 2, 1, h // 2, (255, 230, 100))
    s.r(0, 11, 16, 3, WOOD_D)
    return s.outlined()


def book_cover(t=0):
    s = Spr(60, 80)
    s.r(4, 0, 56, 80, RED_D)
    s.r(0, 0, 56, 80, RED)
    s.r(0, 0, 4, 80, RED_D)
    s.r(6, 4, 46, 1, GOLD)
    s.r(6, 75, 46, 1, GOLD)
    bull(s, 20, 30, GOLD)
    s.r(10, 46, 36, 1, GOLD_D)
    return s.outlined()


def envelope(seal=True):
    s = Spr(34, 22)
    s.r(0, 0, 34, 22, (246, 236, 210))
    s.poly([(0, 0), (17, 12), (34, 0)], (226, 214, 184))
    s.line([(0, 22), (13, 10)], (200, 186, 156))
    s.line([(34, 22), (21, 10)], (200, 186, 156))
    if seal:
        s.e(13, 9, 8, 8, (190, 30, 40))
        s.r(16, 11, 2, 4, (240, 200, 120))  # "N"
    return s.outlined()


def foam_finger(col, up=True):
    s = Spr(14, 26)
    s.r(2, 10, 10, 10, col)
    s.r(5, 0, 4, 11, col)       # index finger
    s.r(1, 12, 2, 5, col)       # thumb
    s.r(4, 20, 6, 6, col)
    s.r(6, 1, 1, 8, tuple(min(255, c + 50) for c in col))
    return s.outlined()


def tumbleweed(frame=0):
    s = Spr(16, 16)
    c = (170, 130, 70)
    a = frame * 0.6
    for k in range(10):
        ang = a + k * 0.63
        s.line([(8, 8), (8 + math.cos(ang) * 7, 8 + math.sin(ang) * 7)], c)
    s.e(2, 2, 12, 12, None) if False else None
    for k in range(16):
        ang = k / 16 * 2 * math.pi
        s.p(int(8 + math.cos(ang) * 7), int(8 + math.sin(ang) * 7), (140, 100, 50))
    return s.outlined()


def key(label, down=False, w=90):
    """A chunky keyboard key with a label, drawn at base resolution."""
    h = 40
    s = Spr(w, h + 6)
    top = 0 if not down else 4
    s.r(0, top + 6, w, h - 6, (110, 110, 124))
    s.r(0, top, w, h - 4, (226, 226, 236))
    s.r(3, top + 3, w - 6, h - 12, (244, 244, 250))
    im = s.outlined()
    text(im, (im.width // 2, top + 17), label, 14, (40, 40, 56), "press", "mm", outline=None)
    return im
