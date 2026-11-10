"""Extra one-word yelps for the night-attack gag, same free Kokoro model as tts.py."""
import os, sys, soundfile as sf
from kokoro_onnx import Kokoro
model_dir, out = sys.argv[1], sys.argv[2]
k = Kokoro(os.path.join(model_dir, "kokoro.onnx"), os.path.join(model_dir, "voices.bin"))
for name, txt, voice in [("ow1", "Ow!", "am_puck"), ("ow2", "Ouch!", "am_echo"), ("ow3", "Aiee!", "am_michael")]:
    a, sr = k.create(txt, voice=voice, speed=1.1, lang="en-us")
    sf.write(os.path.join(out, name + ".wav"), a, sr)
