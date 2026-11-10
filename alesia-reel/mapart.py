"""Kings-and-Generals style relief maps built from real elevation data (Terrarium DEM),
plus antialiased vector overlays (walls, arrows, camps, labels) drawn with cairo."""
import math
import os
import cairo
import numpy as np
from PIL import Image
from scipy import ndimage

FW, FH = 1080, 1920


def _noise(shape, scale, seed, octaves=4):
    rng = np.random.RandomState(seed)
    out = np.zeros(shape, np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        s = max(1, int(scale / (2 ** o)))
        small = rng.rand(shape[0] // s + 2, shape[1] // s + 2).astype(np.float32)
        big = ndimage.zoom(small, s, order=3)[: shape[0], : shape[1]]
        out += big * amp
        tot += amp
        amp *= 0.5
    return out / tot


def relief(elev, m_per_px, sea_level=None, seed=1, forest=0.0, fields=0.0, exag=1.0):
    """Turn an elevation array (already at output size) into an RGB float image in 0..1."""
    e = ndimage.gaussian_filter(elev.astype(np.float32), 1.6)
    gy, gx = np.gradient(e, m_per_px)
    gx, gy = gx * exag, gy * exag
    # light from the north-west, 45 degrees up
    az, alt = math.radians(315), math.radians(42)
    lx, ly, lz = math.cos(alt) * math.cos(az), -math.cos(alt) * math.sin(az), math.sin(alt)
    nz = 1.0 / np.sqrt(gx * gx + gy * gy + 1)
    hs = np.clip((-gx * lx * nz) + (gy * ly * nz) * -1 + lz * nz, 0, 1)
    soft = ndimage.gaussian_filter(hs, 6)
    hs = hs * 0.7 + soft * 0.3

    land = np.ones_like(e, bool) if sea_level is None else e > sea_level
    lo, hi = np.percentile(e[land], 2), np.percentile(e[land], 99.5)
    h = np.clip((e - lo) / (hi - lo + 1e-6), 0, 1)
    # hypsometric ramp: lush valley greens -> olive -> sunlit tan -> pale rock
    stops = np.array([0.0, 0.35, 0.65, 0.88, 1.0])
    cols = np.array([[112, 150, 74], [140, 170, 88], [170, 182, 108], [204, 196, 146], [232, 228, 214]], np.float32) / 255
    rgb = np.stack([np.interp(h, stops, cols[:, i]) for i in range(3)], -1)

    n1 = _noise(e.shape, 64, seed)
    n2 = _noise(e.shape, 10, seed + 7, 2)
    rgb *= (0.92 + 0.16 * n1)[..., None]
    rgb *= (0.96 + 0.08 * n2)[..., None]
    if fields > 0:  # satellite-like patchwork of fields in the flat valleys
        rng = np.random.RandomState(seed + 3)
        cell = 46
        ny, nx = e.shape[0] // cell + 2, e.shape[1] // cell + 2
        tint = rng.rand(ny, nx)
        yy, xx = np.mgrid[0 : e.shape[0], 0 : e.shape[1]]
        warp = (_noise(e.shape, 120, seed + 11) - 0.5) * 60
        ci = ((yy + warp) // cell).astype(int) % ny
        cj = ((xx * 0.8 + yy * 0.25 + warp) // (cell * 1.4)).astype(int) % nx
        t = tint[ci, cj]
        flat = np.clip(1 - np.sqrt(gx * gx + gy * gy) * 6, 0, 1) * fields
        fcol = np.where(t[..., None] > 0.66, np.array([0.80, 0.74, 0.50]), np.where(t[..., None] > 0.33, np.array([0.55, 0.64, 0.36]), np.array([0.66, 0.70, 0.42])))
        rgb = rgb * (1 - 0.35 * flat[..., None]) + fcol * 0.35 * flat[..., None]
    if forest > 0:  # dark woods on slopes and in noisy patches
        slope = np.sqrt(gx * gx + gy * gy) / max(exag, 1e-6)
        fm = (_noise(e.shape, 70, seed + 5) + np.clip(slope * 1.5, 0, 0.15)) > (0.86 - forest)
        fm = ndimage.gaussian_filter(fm.astype(np.float32), 2.5)
        tree = (0.85 + 0.3 * _noise(e.shape, 4, seed + 9, 1))[..., None]
        rgb = rgb * (1 - 0.75 * fm[..., None]) + np.array([0.20, 0.32, 0.16]) * tree * 0.75 * fm[..., None]

    shade = 0.30 + 0.95 * hs[..., None]
    rgb = rgb * shade
    if sea_level is not None:
        depth = np.clip((sea_level - e) / 600.0, 0, 1)[..., None]
        sea = np.array([0.33, 0.55, 0.70]) * (1 - 0.35 * depth) + np.array([0.0, 0.02, 0.06]) * depth
        coast = ndimage.binary_dilation(land, iterations=3) & ~land
        sea = sea * (1 - 0.0)
        rgb = np.where(land[..., None], rgb, sea)
        rgb = np.where(coast[..., None], np.array([0.52, 0.70, 0.78]), rgb)
    # vignette, the K&G cinematic look
    yy, xx = np.mgrid[0 : e.shape[0], 0 : e.shape[1]]
    vx = (xx / e.shape[1] - 0.5) * 2
    vy = (yy / e.shape[0] - 0.5) * 2
    vig = np.clip(1 - 0.32 * (vx ** 2 * 0.9 + vy ** 2 * 0.6), 0.55, 1)
    rgb *= vig[..., None]
    return np.clip(rgb, 0, 1)


def resize_elev(elev, w, h, box):
    """Crop box=(x0,y0,x1,y1) from the DEM and resample to w x h."""
    x0, y0, x1, y1 = box
    crop = elev[y0:y1, x0:x1]
    zy, zx = h / crop.shape[0], w / crop.shape[1]
    return ndimage.zoom(crop, (zy, zx), order=3)[:h, :w]


def trace_valley(e, axis, band, smooth=25):
    """Follow the lowest ground through a band: axis=1 -> river runs left/right (one y per x)."""
    if axis == 1:
        lo, hi = band
        sub = e[:, :]
        pts = []
        for x in range(0, e.shape[1], 4):
            col = sub[lo[x] if callable(lo) else lo : hi[x] if callable(hi) else hi, x]
            pts.append(np.argmin(col) + (lo[x] if callable(lo) else lo))
        ys = ndimage.uniform_filter1d(np.array(pts, float), smooth // 4 + 1)
        return [(x, y) for x, y in zip(range(0, e.shape[1], 4), ys)]
    lo, hi = band
    pts = []
    for y in range(0, e.shape[0], 4):
        row = e[y, lo:hi]
        pts.append(np.argmin(row) + lo)
    xs = ndimage.uniform_filter1d(np.array(pts, float), smooth // 4 + 1)
    return [(x, y) for x, y in zip(xs, range(0, e.shape[0], 4))]


# ---------------------------------------------------------------- cairo overlay helpers
class Painter:
    def __init__(self, base_rgb_u8):
        h, w = base_rgb_u8.shape[:2]
        self.w, self.h = w, h
        buf = np.empty((h, w, 4), np.uint8)
        buf[..., 0] = base_rgb_u8[..., 2]
        buf[..., 1] = base_rgb_u8[..., 1]
        buf[..., 2] = base_rgb_u8[..., 0]
        buf[..., 3] = 255
        self.buf = buf
        self.surf = cairo.ImageSurface.create_for_data(memoryview(buf), cairo.FORMAT_ARGB32, w, h)
        self.c = cairo.Context(self.surf)
        self.c.set_line_join(cairo.LINE_JOIN_ROUND)
        self.c.set_line_cap(cairo.LINE_CAP_ROUND)

    def image(self):
        self.surf.flush()
        return Image.fromarray(self.buf[..., [2, 1, 0]].copy())

    def rgba(self, col, a=1.0):
        self.c.set_source_rgba(col[0] / 255, col[1] / 255, col[2] / 255, a)

    def path(self, pts, closed=False):
        c = self.c
        c.new_path()
        c.move_to(*pts[0])
        for p in pts[1:]:
            c.line_to(*p)
        if closed:
            c.close_path()

    def stroke(self, pts, col, width, a=1.0, closed=False, dash=None, outline=None, ow=3):
        if len(pts) < 2:
            return
        if outline is not None:
            self.path(pts, closed)
            self.rgba(outline, a * 0.9)
            self.c.set_line_width(width + ow * 2)
            self.c.set_dash([] if dash is None else [d for d in dash])
            self.c.stroke()
        self.path(pts, closed)
        self.rgba(col, a)
        self.c.set_line_width(width)
        self.c.set_dash([] if dash is None else dash)
        self.c.stroke()
        self.c.set_dash([])

    def fill(self, pts, col, a=1.0, outline=None, ow=3):
        self.path(pts, True)
        self.rgba(col, a)
        if outline is not None:
            self.c.fill_preserve()
            self.rgba(outline, a)
            self.c.set_line_width(ow)
            self.c.stroke()
        else:
            self.c.fill()

    def circle(self, x, y, r, col, a=1.0, outline=None, ow=3):
        self.c.new_path()
        self.c.arc(x, y, r, 0, 2 * math.pi)
        self.rgba(col, a)
        if outline is not None:
            self.c.fill_preserve()
            self.rgba(outline, a)
            self.c.set_line_width(ow)
            self.c.stroke()
        else:
            self.c.fill()

    def label(self, x, y, s, size=40, col=(255, 250, 235), a=1.0, face="Inter Display", bold=True, italic=False,
              anchor="c", shadow=True, outline=None, angle=0.0, spacing=0.0):
        c = self.c
        c.select_font_face(face, cairo.FONT_SLANT_ITALIC if italic else cairo.FONT_SLANT_NORMAL,
                           cairo.FONT_WEIGHT_BOLD if bold else cairo.FONT_WEIGHT_NORMAL)
        c.set_font_size(size)
        ext = c.text_extents(s)
        tw = ext.x_advance + spacing * (len(s) - 1)
        c.save()
        c.translate(x, y)
        c.rotate(angle)
        ox = {"c": -tw / 2, "l": 0, "r": -tw}[anchor]
        oy = size * 0.36
        def run():
            cx = ox
            for ch in s:
                c.move_to(cx, oy)
                c.text_path(ch)
                cx += c.text_extents(ch).x_advance + spacing
        if shadow:
            c.save()
            c.translate(3, 4)
            run()
            c.set_source_rgba(0, 0, 0, 0.45 * a)
            c.fill()
            c.restore()
        run()
        if outline is not None:
            self.rgba(outline, a)
            c.set_line_width(size * 0.14)
            c.stroke_preserve()
        self.rgba(col, a)
        c.fill()
        c.restore()


def partial(pts, p):
    """First fraction p (0..1) of a polyline, by length."""
    if p >= 1:
        return list(pts)
    if p <= 0:
        return pts[:1]
    seg = [math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
    total = sum(seg)
    want = total * p
    out = [pts[0]]
    acc = 0
    for i, L in enumerate(seg):
        if acc + L >= want:
            f = (want - acc) / (L + 1e-9)
            out.append((pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f))
            return out
        out.append(pts[i + 1])
        acc += L
    return out


def bezier(p0, p1, p2, n=40):
    return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
             (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]) for t in np.linspace(0, 1, n)]


def blob(cx, cy, rx, ry, seed=0, n=72, wob=0.08, rot=0.0):
    rng = np.random.RandomState(seed)
    ph = rng.rand(4) * 6.28
    pts = []
    for i in range(n):
        a = i / n * 2 * math.pi
        r = 1 + wob * (math.sin(3 * a + ph[0]) + 0.6 * math.sin(5 * a + ph[1]) + 0.3 * math.sin(9 * a + ph[2]))
        x, y = math.cos(a) * rx * r, math.sin(a) * ry * r
        pts.append((cx + x * math.cos(rot) - y * math.sin(rot), cy + x * math.sin(rot) + y * math.cos(rot)))
    return pts


def arrow(pt, pts, p, col, width=46, outline=(20, 30, 14), a=0.95):
    """K&G style fat tapered arrow along a polyline, grown to fraction p."""
    pts = partial(pts, p)
    if len(pts) < 2 or p <= 0.02:
        return
    # resample evenly
    L = sum(math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1))
    if L < 10:
        return
    head = min(width * 1.6, L * 0.6)
    body = partial(pts, max(0.0, (L - head * 0.75) / L))
    left, right = [], []
    n = len(body)
    for i in range(n):
        x, y = body[i]
        j0, j1 = max(0, i - 1), min(n - 1, i + 1)
        dx, dy = body[j1][0] - body[j0][0], body[j1][1] - body[j0][1]
        d = math.hypot(dx, dy) + 1e-9
        nx, ny = -dy / d, dx / d
        w = width * (0.35 + 0.65 * (i / max(1, n - 1))) / 2
        left.append((x + nx * w, y + ny * w))
        right.append((x - nx * w, y - ny * w))
    tip = pts[-1]
    bx, by = body[-1]
    dx, dy = tip[0] - bx, tip[1] - by
    d = math.hypot(dx, dy) + 1e-9
    nx, ny = -dy / d, dx / d
    hw = width * 0.95
    poly = left + [(bx + nx * hw, by + ny * hw), tip, (bx - nx * hw, by - ny * hw)] + right[::-1]
    pt.fill(poly, (0, 0, 0), a * 0.25) if False else None
    shadow = [(x + 6, y + 8) for x, y in poly]
    pt.fill(shadow, (0, 0, 0), 0.25 * a)
    light = tuple(min(255, int(v * 1.18)) for v in col)
    pt.fill(poly, col, a, outline=outline, ow=4)
    # highlight stripe for a painted look
    hl = [((l[0] * 0.7 + r[0] * 0.3), (l[1] * 0.7 + r[1] * 0.3)) for l, r in zip(left, right)]
    pt.stroke(hl, light, max(3, width * 0.12), a * 0.7)
