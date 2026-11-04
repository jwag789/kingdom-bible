"""Records the same line with several Kokoro voices so you can pick the narrator by ear.

    .narration/bin/python scripts/voice_samples.py

Writes audio/voices/<voice>.m4a and audio/voices/voices.json; listen at /voices.html.
A voice like "bm_george,am_onyx" is a blend of the two.
"""

import json
import subprocess
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro import KPipeline

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "audio" / "voices"
OUT.mkdir(parents=True, exist_ok=True)
RATE = 24000
SPEED = 0.92                             # the speed the stories are read at

LINE = ('Long ago in Bethlehem lived a boy named David. Out in the hills, he played his harp and sang songs to God. '
        '"Send someone to fight me!" Goliath roared. But David wasn\'t afraid.')

VOICES = [
    ("bm_lewis", "Lewis — British, deep (the narrator now)"),
    ("af_heart", "Heart — American, warm and natural"),
    ("af_bella", "Bella — American, bright and friendly"),
    ("af_nicole", "Nicole — American, soft and hushed (bedtime)"),
    ("af_sarah", "Sarah — American, clear and gentle"),
    ("af_kore", "Kore — American, calm"),
    ("bf_emma", "Emma — British, warm"),
    ("bf_isabella", "Isabella — British, bright"),
    ("af_heart,af_bella", "Heart + Bella blend — warm and bright"),
]

pipelines = {"a": KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M"),
             "b": KPipeline(lang_code="b", repo_id="hexgrad/Kokoro-82M")}
listing = []
for voice, label in VOICES:
    pipeline = pipelines[voice[0]]       # British voices read with British pronunciation
    chunks = [np.zeros(int(RATE * 0.2), dtype=np.float32)]
    for result in pipeline(LINE, voice=voice, speed=SPEED):
        if result.audio is not None:
            chunks.append(result.audio.detach().cpu().numpy().astype(np.float32))
    audio = np.concatenate(chunks + [np.zeros(int(RATE * 0.4), dtype=np.float32)])
    name = voice.replace(",", "+")
    with tempfile.NamedTemporaryFile(suffix=".wav") as wav:
        sf.write(wav.name, audio, RATE)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav.name, "-c:a", "aac", "-b:a", "96k",
                        str(OUT / f"{name}.m4a")], check=True)
    listing.append({"voice": voice, "label": label, "src": f"audio/voices/{name}.m4a"})
    print(f"{voice}: {len(audio) / RATE:.1f}s")

(OUT / "voices.json").write_text(json.dumps({"line": LINE, "speed": SPEED, "voices": listing}, indent=1) + "\n")
print("Done")
