"""Build the Alesia reel: timeline from the voice lines -> frames -> audio mix -> subtitles -> MP4.

Usage: python3 build.py VOICE_DIR DATA_DIR OUT_DIR [--still SECONDS ...] [--workers N]
  VOICE_DIR  WAVs from tts.py      DATA_DIR  .npy terrain from fetch_dem.py (+ alesia_frame.npy)
"""
import argparse
import json
import math
import os
import subprocess
import sys
from multiprocessing import Process

import numpy as np
import soundfile as sf
from scipy import signal

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from lines import LINES  # noqa: E402

FPS = 30
LEAD = 0.9          # title boom before the first line
TAIL = 0.6
SR = 48000


def load_voice(vdir):
    clips, T, env, spk = {}, {}, {}, {}
    cur = LEAD
    for lid, who, _sp, _sub, gap in LINES:
        a, sr = sf.read(os.path.join(vdir, lid + ".wav"))
        idx = np.where(np.abs(a) > 0.01)[0]
        a = a[max(0, idx[0] - int(0.03 * sr)): idx[-1] + int(0.06 * sr)]
        a = signal.resample_poly(a, SR // 1000, sr // 1000)
        a = a / (np.max(np.abs(a)) + 1e-9) * 0.9
        d = len(a) / SR
        clips[lid] = a
        T[lid] = (cur, cur + d)
        spk[lid] = who
        hop = SR // FPS
        e = np.array([np.sqrt(np.mean(a[i:i + hop] ** 2)) for i in range(0, len(a), hop)])
        env[lid] = e / (e.max() + 1e-9)
        cur += d + gap
    return clips, T, env, spk, cur + TAIL


# ---------------------------------------------------------------- subtitles
COLORS = {"NARRATOR": "&H00FFFFFF", "CAESAR": "&H0050C8FF", "VERCINGETORIX": "&H00FFC070", "SOLDIER": "&H0080FF90"}
NAMES = {"CAESAR": "CAESAR", "VERCINGETORIX": "VERCINGETORIX", "SOLDIER": "SOLDIER"}


def chunks(textline, maxc=34):
    words = textline.split()
    out, cur = [], ""
    for w in words:
        if cur and len(cur) + 1 + len(w) > maxc:
            out.append(cur)
            cur = w
        else:
            cur = (cur + " " + w).strip()
        if cur.endswith((".", "?", "!")) and len(cur) > 12:
            out.append(cur)
            cur = ""
    if cur:
        out.append(cur)
    return out


def split2(s, limit=18):
    if len(s) <= limit:
        return s
    words = s.split()
    best, bi = 1e9, 1
    for i in range(1, len(words)):
        a, b = " ".join(words[:i]), " ".join(words[i:])
        sc = abs(len(a) - len(b))
        if sc < best:
            best, bi = sc, i
    return " ".join(words[:bi]) + "\\N" + " ".join(words[bi:])


def ts(t, ass=True):
    h, m = int(t // 3600), int(t % 3600 // 60)
    s = t % 60
    if ass:
        return f"{h}:{m:02d}:{s:05.2f}"
    return f"{h:02d}:{m:02d}:{int(s):02d},{int((s - int(s)) * 1000):03d}"


def write_subs(T, out_dir):
    ass = [
        "[Script Info]", "ScriptType: v4.00+", "PlayResX: 1080", "PlayResY: 1920", "WrapStyle: 2", "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        "Style: Sub,Pixelify Sans,72,&H00FFFFFF,&H00FFFFFF,&H00261A1E,&H96000000,-1,0,0,0,100,100,1,0,1,7,4,2,60,60,380,1",
        "Style: Name,Press Start 2P,30,&H00FFFFFF,&H00FFFFFF,&H00261A1E,&H96000000,0,0,0,0,100,100,2,0,1,5,3,2,60,60,700,1",
        "", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]
    srt = []
    n = 1
    for lid, who, _sp, sub, _gap in LINES:
        s, e = T[lid]
        parts = chunks(sub)
        total = sum(len(p) for p in parts)
        cur = s
        for p in parts:
            d = (e - s) * len(p) / total
            a, b = cur, cur + d
            cur = b
            col = COLORS[who]
            name = f"{{\\fnPress Start 2P\\b0\\fs30\\bord5}}{NAMES[who]}\\N{{\\fnPixelify Sans\\b1\\fs72\\bord7}}" if who in NAMES else ""
            ass.append(f"Dialogue: 1,{ts(a)},{ts(b + 0.05)},Sub,,0,0,0,,{{\\c{col}\\fad(40,0)}}{name}{split2(p).replace(' ', '  ')}")
            srt.append(f"{n}\n{ts(a, False)} --> {ts(b, False)}\n{(NAMES.get(who, '') + ': ') if who in NAMES else ''}{p}\n")
            n += 1
    with open(os.path.join(out_dir, "alesia.ass"), "w") as f:
        f.write("\n".join(ass) + "\n")
    with open(os.path.join(out_dir, "alesia.srt"), "w") as f:
        f.write("\n".join(srt))


# ---------------------------------------------------------------- audio
def make_audio(clips, T, total, vdir, out_path, c):
    import audio as A
    n = int(total * SR) + SR
    voice = np.zeros(n)
    sfx = np.zeros(n)
    for lid, (s, e) in T.items():
        A.place(voice, clips[lid], s)
    S, E = c.S, c.E

    def fx(at, clip, g=1.0):
        A.place(sfx, clip, at, g)

    # --- effects cue sheet
    fx(0.0, A.boom(), 0.9)
    fx(0.05, A.whoosh(0.6), 0.4)
    fx(S("intro1") + 1.55, A.tada(), 0.45)
    fx(S("intro2") + 0.2, A.crowd(c.S("verc2") - c.S("intro2"), 0.8), 0.25)
    fx(S("intro2") + 0.2, A.drumroll(2.0), 0.25)
    fx(S("verc2") - 0.05, A.pop(), 0.4)
    fx(S("surround") + 0.15, A.whoosh(1.3, 500, 5000), 0.5)
    for k in range(10):
        fx(S("surround") + 0.2 + k * 0.12, A.hammer(), 0.35)
    fx(S("surround") + 1.4, A.ding(1568), 0.6)
    fx(S("surround") + 1.6, A.boing(0.5, 120), 0.3)
    for k in range(5):
        fx(S("wall1") + k * 0.3, A.hammer(), 0.2)
    fx(S("lilies") + 0.3, A.pop(), 0.5)
    fx(S("tombs") + 0.3, A.pop(), 0.5)
    fx(S("tombs") + 0.35, A.ding(880, 0.8), 0.25)
    rain = A.bp(A.noise(E("marcus") - S("marcus") + 0.4), 2000, 8000) * 0.06
    fx(S("marcus"), rain, 1.0)
    for k in range(16):
        fx(S("wall2") + 0.6 + k * 0.17, A.hammer(), 0.3)
    fx(E("wall2") + 0.15, A.ding(1760), 0.5)
    fx(S("eff") + 0.05, A.ding(2093, 0.9), 0.35)
    cs, ce = S("crit"), E("crit")
    turn0 = cs + (ce - cs) * 0.62
    fx(turn0 - 0.05, A.scratch(), 0.7)
    fx(ce + 0.1, A.crickets(S("planb") - ce), 1.0)
    fx(S("planb") + 0.2, A.whoosh(0.5), 0.4)
    fx(S("planb") + 1.4, A.stamp(), 0.8)
    fx(S("friends") + 0.6, A.crowd(E("friends") - S("friends") + 1.0, 1.0), 0.45)
    fx(S("friends") + 0.6, A.drumroll(2.5), 0.3)
    fx(S("book"), A.pop(), 0.5)
    fx(S("book") + 0.7, A.ding(2093, 0.6), 0.3)
    lag0, lag1 = E("book") + 0.25, S("both1")
    fx(lag0, A.crowd(lag1 - lag0, 1.0), 0.5)
    fx(lag0 + 0.6, A.glitch(lag1 - lag0 - 0.6), 0.35)
    fx(lag0, A.lag_drone(lag1 - lag0), 0.3)
    fx(S("both1"), A.crowd(E("both2") - S("both1") + 0.5, 1.0), 0.35)
    for k in range(4):
        fx(S("both1") + 0.2 + k * 0.15, A.whoosh(1.0, 200, 2500), 0.35)
    for k in range(10):
        fx(S("both2") + k * 0.19, A.clang(500 + (k % 3) * 120), 0.18)
    fx(S("yes2") + 0.25, A.whoosh(0.3, 800, 6000), 0.4)
    fx(S("yes2") + 0.5, A.whoosh(0.3, 800, 6000), 0.4)
    fx(S("night"), A.crickets(E("find") - S("night") + 1.2), 0.9)
    for i in range(9):
        fx(S("find") + i * 0.16, A.boing(0.45, 150 + i * 12), 0.35)
    for i, k in enumerate(["ow1", "ow2", "ow3"]):
        p = os.path.join(vdir, k + ".wav")
        if os.path.exists(p):
            a, sr = sf.read(p)
            a = signal.resample_poly(a, SR // 1000, sr // 1000)
            fx(S("find") + 0.05 + i * 0.42, a / (np.max(np.abs(a)) + 1e-9), 0.55)
    fx(S("goodname") + 0.6, A.ding(1568), 0.4)
    fx(S("final") + 0.3, A.crowd(E("final") - S("final") + 0.5, 1.0), 0.55)
    fx(S("final") + 0.3, A.drumroll(2.2), 0.4)
    fx(S("final") + 3.0, A.boom(), 0.6)
    fx(S("cloak") + 0.9, A.fanfare(), 0.6)
    fx(S("esp") + 0.6, A.crowd(1.2, 0.8), 0.3)
    fx(S("cav") + 0.2, A.clipclop(2.4, 9.0), 0.6)
    fx(S("cav") + 2.4, A.boom(), 0.5)
    for k in range(4):
        fx(S("cav") + 2.45 + k * 0.11, A.clang(600 + k * 90), 0.2)
    fx(S("home") + 0.05, A.sad_trombone(), 0.55)
    fx(S("surr") + 0.3, A.clipclop(S("why") - S("surr") - 0.5, 4.0), 0.55)
    fx(S("throw") + 0.8, A.clatter(), 0.6)
    fx(E("throw") + 0.1, A.crickets(S("letter") - E("throw")), 1.0)
    fx(E("throw") + 0.2, A.whoosh(1.4, 200, 1200), 0.25)
    t_sl = A.t_(1.2)
    slide = np.sin(2 * np.pi * np.cumsum(500 + 900 * t_sl / 1.2) / SR) * np.minimum(1, (1.2 - t_sl) * 6)
    fx(S("looks") + 0.35, slide, 0.25)
    fx(S("teams") + 0.1, A.crowd(1.3, 1.0), 0.3)
    fx(S("sedan") + 1.6, A.drumroll(1.8), 0.3)
    fx(S("sedan") + 3.4, A.ding(784, 1.2), 0.4)
    fx(S("sent") + 0.2, A.whoosh(0.8, 400, 6000), 0.5)
    fx(E("sent") + 0.15, A.pop(), 0.6)
    fx(E("sent") + 0.3, A.ding(2093, 0.9), 0.4)
    dur = E("ctrl") - S("ctrl")
    marks = [S("ctrl"), S("ctrl") + dur * 0.36, S("ctrl") + dur * 0.62]
    for m in marks:
        fx(m, A.keyclick(), 0.7)
    fx(marks[2] + 0.4, A.gameover(), 0.5)
    fx(marks[2] + 1.0, A.tada(), 0.45)

    # --- music with automation
    mus = A.music(total + 1)
    g = np.ones(len(mus)) * 0.5

    def gain(a, b, v, fade=0.08):
        ia, ib = int(a * SR), int(b * SR)
        ia, ib = max(0, ia), min(len(g), ib)
        g[ia:ib] = v
        f = int(fade * SR)
        if ib + f < len(g) and f:
            g[ib:ib + f] = np.linspace(v, g[ib + f], f)

    gain(turn0, S("planb") + 0.2, 0.0, 0.3)
    gain(lag0, lag1, 0.0)
    gain(S("night"), S("goodname"), 0.18)
    gain(S("throw") + 0.8, S("statue"), 0.0, 0.3)
    gain(S("ctrl"), total + 1, 0.0)
    gain(0, 0.9, 0.0, 0.2)
    mus = mus * g[: len(mus)]
    # duck under the voice
    ve = A.smooth_env(voice, 0.12)
    ve = ve / (ve.max() + 1e-9)
    duck = 1 - 0.6 * np.clip(ve * 4, 0, 1)
    mus = mus[:n] if len(mus) >= n else np.pad(mus, (0, n - len(mus)))
    mix = voice * 0.95 + sfx * 0.8 + mus * duck * 0.55
    mix = np.tanh(mix * 1.1) / np.tanh(1.1)
    mix = mix[: int(total * SR)]
    sf.write(out_path, mix.astype(np.float32), SR)


# ---------------------------------------------------------------- render
def make_ctx(vdir, data):
    os.environ["ALESIA_DATA"] = data
    import scenes
    clips, T, env, spk, total = load_voice(vdir)
    c = scenes.Ctx(T, env, spk)
    return scenes, c, clips, T, total


def frame_at(scenes, slist, c, t):
    fn = slist[0][1]
    for st, f in slist:
        if t >= st:
            fn = f
    return fn(t, c)


def worker(vdir, data, out, k, n0, n1):
    scenes, c, clips, T, total = make_ctx(vdir, data)
    slist = scenes.scene_list(c)
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", "1080x1920", "-r", str(FPS),
           "-i", "-", "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-pix_fmt", "yuv420p",
           os.path.join(out, f"seg_{k:02d}.mp4")]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for i in range(n0, n1):
        img = frame_at(scenes, slist, c, i / FPS)
        p.stdin.write(img.tobytes())
        if (i - n0) % 150 == 0:
            print(f"[w{k}] {i - n0}/{n1 - n0}", flush=True)
    p.stdin.close()
    p.wait()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("voice")
    ap.add_argument("data")
    ap.add_argument("out")
    ap.add_argument("--still", type=float, nargs="*")
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--only", choices=["audio", "subs", "video", "all"], default="all")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    scenes, c, clips, T, total = make_ctx(a.voice, a.data)
    print("duration", round(total, 2))
    json.dump({k: [round(v[0], 3), round(v[1], 3)] for k, v in T.items()}, open(os.path.join(a.out, "timeline.json"), "w"), indent=1)
    if a.still is not None:
        slist = scenes.scene_list(c)
        for t in a.still:
            frame_at(scenes, slist, c, t).save(os.path.join(a.out, f"still_{t:07.2f}.png"))
        return
    if a.only in ("subs", "all"):
        write_subs(T, a.out)
    if a.only in ("audio", "all"):
        make_audio(clips, T, total, a.voice, os.path.join(a.out, "mix.wav"), c)
        print("audio done")
    if a.only in ("video", "all"):
        nf = int(total * FPS)
        step = math.ceil(nf / a.workers)
        procs = [Process(target=worker, args=(a.voice, a.data, a.out, k, k * step, min(nf, (k + 1) * step))) for k in range(a.workers)]
        for p in procs:
            p.start()
        for p in procs:
            p.join()
        with open(os.path.join(a.out, "segs.txt"), "w") as f:
            for k in range(a.workers):
                f.write(f"file 'seg_{k:02d}.mp4'\n")
        subprocess.check_call(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", os.path.join(a.out, "segs.txt"),
                               "-c", "copy", os.path.join(a.out, "video_raw.mp4")])
    if a.only == "all":
        final = os.path.join(a.out, "alesia_reel.mp4")
        subprocess.check_call([
            "ffmpeg", "-y", "-loglevel", "error", "-i", os.path.join(a.out, "video_raw.mp4"), "-i", os.path.join(a.out, "mix.wav"),
            "-vf", f"ass={os.path.join(a.out, 'alesia.ass')}:fontsdir={os.path.join(HERE, 'fonts')}",
            "-af", "loudnorm=I=-14:TP=-1.0:LRA=11", "-ar", "48000",
            "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
            "-c:a", "aac", "-b:a", "192k", "-shortest", final])
        print("wrote", final)


if __name__ == "__main__":
    main()
