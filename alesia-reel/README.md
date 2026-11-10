# Alesia, 52 BC: a very serious history (vertical reel)

A ~2.5 minute vertical (1080×1920, 30 fps) comedy short about the siege of Alesia.
It uses Kings-and-Generals-style relief maps built from real terrain data, eBoy-style
pixel characters and an isometric pixel diorama of Caesar's siege works. It has
burned-in subtitles, a free neural narrator, and synthesised music and sound effects.

**Output:** `alesia_reel.mp4` (with subtitles burned in) plus `alesia.srt`, which you can
upload as a separate caption track.

## What's in it

| Piece | How it's made |
| --- | --- |
| Voices | [Kokoro-82M](https://github.com/thewh1teagle/kokoro-onnx) (Apache-2.0), free and offline. Narrator `bm_george`, Caesar `bm_fable`, Vercingetorix `am_fenrir`, Soldier `bm_daniel` |
| Maps | Real elevation (AWS Terrarium open terrain tiles) for Alesia/Mont Auxois, Gaul and Sedan. Hillshade, field patchwork and woods are generated in `mapart.py`, with antialiased walls, arrows and labels drawn with cairo |
| Pixels | Every character, prop and the fortification diorama is drawn in code (`art.py`, `sprites.py`, `world.py`) at 360×640, then scaled up ×3 with nearest-neighbour |
| Sound | An original chiptune oom-pah march, plus every effect (boom, ding, boing, record scratch, crickets, clip-clop, sad trombone…), all synthesised in `audio.py`. No third-party audio |
| Subtitles | ASS, colour-coded per speaker (Pixelify Sans and Press Start 2P, both OFL, in `fonts/`). Burned in with libass |

The legion banner is an original pixel bull. The bull was the emblem of Caesar's
legions, Legio X among them.

## Rebuild

```bash
pip install kokoro-onnx soundfile scipy pycairo fonttools
```

```bash
# 1. voice model (free) and voices
mkdir -p work/tts && curl -L -o work/tts/kokoro.onnx https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.int8.onnx
curl -L -o work/tts/voices.bin https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
python3 tts.py work/tts work/voice && python3 gag_voices.py work/tts work/voice
```

```bash
# 2. terrain, then crop the Alesia DEM to the frame
python3 fetch_dem.py work/dem
python3 -c "import numpy as np, mapart; e=np.load('work/dem/alesia.npy'); np.save('work/dem/alesia_frame.npy', mapart.resize_elev(e,1080,1920,(243,213,1263,2026)))"
```

```bash
# 3. render (4 workers, a few minutes)
python3 build.py work/voice work/dem work/out --workers 4
```

Use `--still 12.5 40 …` to render single frames for checking. The script and timing
live in `lines.py`: edit a line or a pause there, re-run `tts.py`, and every scene,
subtitle and sound cue moves with it.
