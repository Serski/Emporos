"""Download Terrarium elevation tiles (Mapzen/AWS open terrain, public domain-ish: see
https://github.com/tilezen/joerd/blob/master/docs/attribution.md) and stitch them into
elevation arrays saved as .npy for the three maps (Gaul, Alesia, Sedan)."""
import io, math, os, sys, urllib.request
import numpy as np
from PIL import Image

OUT = sys.argv[1]
URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"


def deg2num(lat, lon, z):
    n = 2 ** z
    x = (lon + 180) / 360 * n
    y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
    return x, y


def stitch(name, z, lat0, lon0, lat1, lon1):
    x0, y0 = deg2num(lat1, lon0, z)   # top-left (north-west)
    x1, y1 = deg2num(lat0, lon1, z)   # bottom-right
    tx0, ty0, tx1, ty1 = int(x0), int(y0), int(x1), int(y1)
    rows = []
    for ty in range(ty0, ty1 + 1):
        row = []
        for tx in range(tx0, tx1 + 1):
            cache = os.path.join(OUT, f"t_{z}_{tx}_{ty}.png")
            if not os.path.exists(cache):
                urllib.request.urlretrieve(URL.format(z=z, x=tx, y=ty), cache)
            a = np.array(Image.open(cache).convert("RGB")).astype(np.float32)
            row.append(a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768)
        rows.append(np.concatenate(row, 1))
    elev = np.concatenate(rows, 0)
    # crop to the exact box
    px0, py0 = int((x0 - tx0) * 256), int((y0 - ty0) * 256)
    px1, py1 = int((x1 - tx0) * 256), int((y1 - ty0) * 256)
    elev = elev[py0:py1, px0:px1]
    np.save(os.path.join(OUT, name + ".npy"), elev)
    print(name, elev.shape, float(elev.min()), float(elev.max()))


# Alesia (Mont Auxois, 47.537N 4.500E): ~8.5 km wide box, tall for the vertical frame
stitch("alesia", 14, 47.475, 4.435, 47.600, 4.565)
# Gaul overview
stitch("gaul", 6, 41.0, -5.5, 52.5, 9.5)
# Sedan 1870 (49.70N 4.94E)
stitch("sedan", 13, 49.62, 4.86, 49.78, 5.02)
