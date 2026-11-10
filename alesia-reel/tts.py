"""Generate one WAV per script line with the free Kokoro voice model (Apache-2.0).
Usage: python3 tts.py MODEL_DIR OUT_DIR   (MODEL_DIR holds kokoro.onnx and voices.bin)"""
import os, sys, soundfile as sf
from kokoro_onnx import Kokoro
from lines import LINES, VOICES

model_dir, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
k = Kokoro(os.path.join(model_dir, "kokoro.onnx"), os.path.join(model_dir, "voices.bin"))
for lid, spk, spoken, _sub, _gap in LINES:
    path = os.path.join(out, lid + ".wav")
    if os.path.exists(path):
        continue
    voice, lang, speed = VOICES[spk]
    samples, sr = k.create(spoken, voice=voice, speed=speed, lang=lang)
    sf.write(path, samples, sr)
    print(lid, round(len(samples) / sr, 2), flush=True)
