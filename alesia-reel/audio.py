"""Procedural sound: chiptune oom-pah march, comedy sound effects, and the final mix.
Everything is synthesised here, so there are no third-party audio assets to license."""
import numpy as np
from scipy import signal

SR = 48000
RNG = np.random.RandomState(7)


def t_(d):
    return np.arange(int(d * SR)) / SR


def envexp(n, tau):
    return np.exp(-np.arange(n) / (tau * SR))


def adsr(n, a=0.005, r=0.05):
    e = np.ones(n)
    na, nr = min(n, int(a * SR)), min(n, int(r * SR))
    e[:na] = np.linspace(0, 1, na)
    if nr:
        e[-nr:] *= np.linspace(1, 0, nr)
    return e


def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], btype="band", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def lp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, btype="low", fs=SR, output="sos"), x)


def hp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, btype="high", fs=SR, output="sos"), x)


def noise(d):
    return RNG.uniform(-1, 1, int(d * SR))


def square(freq, d, duty=0.5):
    ph = np.cumsum(np.broadcast_to(freq, (int(d * SR),)) / SR) % 1.0
    return np.where(ph < duty, 1.0, -1.0)


def tri(freq, d):
    ph = np.cumsum(np.broadcast_to(freq, (int(d * SR),)) / SR) % 1.0
    return 4 * np.abs(ph - 0.5) - 1


def saw(freq, d):
    ph = np.cumsum(np.broadcast_to(freq, (int(d * SR),)) / SR) % 1.0
    return 2 * ph - 1


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def norm(x, peak=0.9):
    m = np.max(np.abs(x)) + 1e-9
    return x / m * peak


# ---------------------------------------------------------------- effects
def boom():
    d = 1.6
    t = t_(d)
    f = 70 * np.exp(-t * 2.2) + 32
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * envexp(len(t), 0.5)
    x += lp(noise(d), 400) * envexp(len(t), 0.12) * 0.8
    return norm(x)


def whoosh(d=0.45, lo=300, hi=3500):
    n = noise(d)
    t = t_(d)
    e = np.sin(np.pi * t / d) ** 2
    x = bp(n, lo, hi) * e
    return norm(x, 0.7)


def ding(f=1760, d=1.4):
    t = t_(d)
    x = sum(a * np.sin(2 * np.pi * f * k * t) * envexp(len(t), d / (k * 1.5)) for k, a in [(1, 1), (2.01, 0.45), (3.02, 0.2), (4.2, 0.12)])
    return norm(x * adsr(len(t), 0.002, 0.05), 0.7)


def hammer():
    d = 0.18
    t = t_(d)
    x = np.sin(2 * np.pi * 180 * t) * envexp(len(t), 0.03)
    x += bp(noise(d), 1500, 6000) * envexp(len(t), 0.01) * 0.8
    x += np.sin(2 * np.pi * 1100 * t) * envexp(len(t), 0.02) * 0.3
    return norm(x, 0.8)


def boing(d=0.7, f0=180):
    t = t_(d)
    f = f0 * (1 + 0.8 * t / d) + 60 * np.sin(2 * np.pi * 16 * t) * np.exp(-t * 3)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * envexp(len(t), 0.35)
    return norm(x * adsr(len(t), 0.003, 0.05), 0.8)


def crickets(d):
    out = np.zeros(int(d * SR))
    t0 = 0.05
    i = 0
    while t0 < d - 0.2:
        for k in range(3):
            s = int((t0 + k * 0.035) * SR)
            n = int(0.022 * SR)
            if s + n < len(out):
                tt = np.arange(n) / SR
                out[s : s + n] += np.sin(2 * np.pi * (4300 + 200 * (i % 2)) * tt) * np.sin(np.pi * tt / 0.022)
        t0 += 0.42 + 0.08 * (i % 3)
        i += 1
    return out * 0.35


def scratch():
    d = 0.55
    t = t_(d)
    f = 500 + 1400 * np.abs(np.sin(2 * np.pi * 2.2 * t)) * (1 - t / d)
    x = saw(f, d) * 0.6 + bp(noise(d), 800, 5000) * 0.5
    x = lp(x, 4000) * np.minimum(1, 6 * (1 - t / d))
    return norm(x, 0.8)


def woodblock(f=900):
    d = 0.12
    t = t_(d)
    x = (np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 2.7 * t)) * envexp(len(t), 0.018)
    return norm(x, 0.7)


def clipclop(d, rate=4.4):
    out = np.zeros(int(d * SR))
    k = 0
    tt = 0.0
    while tt < d - 0.15:
        s = int(tt * SR)
        b = woodblock(820 if k % 2 == 0 else 1040)
        out[s : s + len(b)] += b[: len(out) - s]
        tt += (1 / rate) * (0.7 if k % 2 == 0 else 1.3)
        k += 1
    return out * 0.6


def clang(f=523):
    d = 1.6
    t = t_(d)
    parts = [1, 2.37, 3.63, 5.18, 6.71, 8.3]
    x = sum(np.sin(2 * np.pi * f * p * t + RNG.rand() * 6) * envexp(len(t), 0.9 / p) / p ** 0.5 for p in parts)
    x += bp(noise(d), 2000, 9000) * envexp(len(t), 0.02)
    return norm(x, 0.8)


def clatter():
    out = np.zeros(int(2.0 * SR))
    for i, (tt, f) in enumerate([(0, 520), (0.18, 700), (0.31, 440), (0.52, 860), (0.7, 600)]):
        c = clang(f) * (1 - i * 0.12)
        s = int(tt * SR)
        out[s : s + len(c)] += c[: len(out) - s]
    return norm(out, 0.85)


def brass(m, d, vib=0.0):
    t = t_(d)
    f = mtof(m) * (1 + vib * np.sin(2 * np.pi * 5.5 * t) * np.minimum(1, t * 3))
    x = 0.6 * square(f, d, 0.3) + 0.5 * saw(f, d)
    x = lp(x, 2600)
    return x * adsr(len(t), 0.02, 0.06)


def seq(notes, voice, gap=0.0):
    parts = []
    for m, d in notes:
        parts.append(np.zeros(int(d * SR)) if m is None else voice(m, d))
        if gap:
            parts.append(np.zeros(int(gap * SR)))
    return np.concatenate(parts)


def fanfare():
    x = seq([(72, 0.12), (76, 0.12), (79, 0.12), (84, 0.55)], brass, 0.02)
    x2 = seq([(64, 0.12), (67, 0.12), (72, 0.12), (76, 0.55)], brass, 0.02)
    return norm(x + 0.6 * x2, 0.8)


def sad_trombone():
    x = seq([(62, 0.42), (61, 0.42), (60, 0.42)], lambda m, d: brass(m, d, 0.01), 0.04)
    x = np.concatenate([x, brass(59, 1.4, 0.03)])
    return norm(lp(x, 1600), 0.8)


def glitch(d):
    out = np.zeros(int(d * SR))
    tt = 0
    while tt < d:
        seg = RNG.uniform(0.03, 0.09)
        f = RNG.choice([110, 220, 330, 880, 1760, 55])
        s = int(tt * SR)
        x = square(f, seg, RNG.uniform(0.1, 0.5)) * (RNG.rand() > 0.3)
        x = np.round(x * 3) / 3
        out[s : s + len(x)] += x[: len(out) - s] * 0.5
        tt += seg
    return out


def stamp():
    d = 0.4
    t = t_(d)
    x = np.sin(2 * np.pi * 90 * t) * envexp(len(t), 0.06)
    x += lp(noise(d), 2500) * envexp(len(t), 0.03) * 0.9
    return norm(x, 0.9)


def pop():
    d = 0.12
    t = t_(d)
    f = 300 + 1600 * t / d
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * envexp(len(t), 0.05)
    return norm(x, 0.7)


def keyclick():
    d = 0.08
    x = hp(noise(d), 2000) * envexp(int(d * SR), 0.006)
    x += np.sin(2 * np.pi * 300 * t_(d)) * envexp(int(d * SR), 0.01) * 0.6
    return norm(x, 0.8)


def crowd(d, excited=1.0):
    n = int(d * SR)
    x = np.zeros(n)
    for k in range(10):
        lo = RNG.uniform(250, 600)
        band = bp(noise(d), lo, lo * RNG.uniform(1.8, 3.0))
        am = 0.6 + 0.4 * np.sin(2 * np.pi * RNG.uniform(0.3, 1.5) * t_(d) + RNG.rand() * 6)
        x += band * am
    e = np.minimum(1, t_(d) / 0.6) * np.minimum(1, (d - t_(d)) / 0.8)
    return norm(x * e, 0.6 * excited)


def drumroll(d):
    out = np.zeros(int(d * SR))
    step = 0.045
    for i in range(int(d / step)):
        s = int(i * step * SR)
        h = bp(noise(0.05), 1500, 7000) * envexp(int(0.05 * SR), 0.012) * (0.4 + 0.6 * i / (d / step))
        out[s : s + len(h)] += h[: len(out) - s]
    return out * 0.6


def thud():
    d = 0.35
    t = t_(d)
    x = np.sin(2 * np.pi * (110 * np.exp(-t * 8) + 45) * t) * envexp(len(t), 0.08)
    return norm(x + lp(noise(d), 600) * envexp(len(t), 0.03) * 0.5, 0.9)


def gameover():
    v = lambda m, d: square(mtof(m), d, 0.25) * adsr(int(d * SR), 0.003, 0.03)
    x = seq([(76, 0.14), (72, 0.14), (67, 0.14), (64, 0.14), (60, 0.5)], v, 0.02)
    return norm(x, 0.6)


def tada():
    x = seq([(72, 0.1), (79, 0.6)], brass, 0.03)
    x2 = seq([(64, 0.1), (76, 0.6)], brass, 0.03)
    return norm(x + 0.7 * x2, 0.8)


def lag_drone(d):
    t = t_(d)
    f = 120 * np.exp(-t * 0.6) + 30
    x = square(f, d, 0.5) * 0.4
    return lp(x, 900) * np.minimum(1, t * 4)


# ---------------------------------------------------------------- music
BPM = 116
BEAT = 60 / BPM
MEL = [  # (midi, beats) -- an original D-minor oom-pah march
    (74, .75), (74, .25), (77, 1), (74, 1), (81, 1),
    (79, .75), (77, .25), (76, 1), (72, 2),
    (72, .75), (72, .25), (76, 1), (79, 1), (76, 1),
    (77, .75), (76, .25), (74, 1), (74, 2),
    (81, .75), (81, .25), (82, 1), (81, 1), (79, 1),
    (77, .75), (79, .25), (81, 1), (76, 2),
    (77, .75), (76, .25), (74, 1), (72, 1), (76, 1),
    (74, 1), (69, 1), (74, 2),
]
ROOTS = [38, 36, 33, 38, 41, 36, 34, 38]


def music(duration):
    bar = 4 * BEAT
    loop = 8 * bar
    n = int(duration * SR) + SR
    out = np.zeros(n)

    def add(x, at, g=1.0):
        s = int(at * SR)
        if s >= n:
            return
        e = min(n, s + len(x))
        out[s:e] += x[: e - s] * g

    kick = lambda: np.sin(2 * np.pi * np.cumsum(100 * np.exp(-t_(0.25) * 25) + 45) / SR) * envexp(int(0.25 * SR), 0.07)
    snare = lambda: bp(noise(0.18), 1200, 7000) * envexp(int(0.18 * SR), 0.04) + np.sin(2 * np.pi * 190 * t_(0.18)) * envexp(int(0.18 * SR), 0.03) * 0.5
    hat = lambda: hp(noise(0.04), 6000) * envexp(int(0.04 * SR), 0.008)
    K, S, Hh = kick(), snare(), hat()

    t0 = 0.0
    rep = 0
    while t0 < duration:
        # melody
        tt = t0
        for m, b in MEL:
            d = b * BEAT
            x = square(mtof(m), d * 0.92, 0.25) * adsr(int(d * 0.92 * SR), 0.004, 0.04)
            add(x, tt, 0.16)
            # harmony a third below on the second pass
            if rep % 2 == 1:
                add(square(mtof(m - 4), d * 0.92, 0.5) * adsr(int(d * 0.92 * SR), 0.004, 0.04), tt, 0.06)
            tt += d
        for bi, r in enumerate(ROOTS):
            bt = t0 + bi * bar
            for k in range(4):   # oom-pah: root, fifth, root, fifth
                m = r if k % 2 == 0 else r + 7
                d = BEAT * 0.55
                add(tri(mtof(m), d) * adsr(int(d * SR), 0.003, 0.05), bt + k * BEAT, 0.42)
                add(K if k % 2 == 0 else S, bt + k * BEAT, 0.35 if k % 2 == 0 else 0.22)
                add(Hh, bt + k * BEAT + BEAT / 2, 0.08)
            if bi == 7:
                add(drumroll(BEAT * 2), bt + 2 * BEAT, 0.5)
        t0 += loop
        rep += 1
    return out[: int(duration * SR)]


# ---------------------------------------------------------------- mix helpers
def place(track, clip, at, gain=1.0):
    s = int(at * SR)
    if s < 0:
        clip = clip[-s:]
        s = 0
    e = min(len(track), s + len(clip))
    if e > s:
        track[s:e] += clip[: e - s] * gain


def smooth_env(x, win=0.08):
    a = np.abs(x)
    k = int(win * SR)
    c = np.convolve(a, np.ones(k) / k, mode="same")
    return c
