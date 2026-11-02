"""Records the same lines with several Kokoro voices so you can pick the narrator by ear.

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
SPEED = 0.85

LINE = ('In the very beginning, before there was anything at all, there was God. '
        'Then God spoke: "Let there be light!" And light burst into being.')

VOICES = [
    ("bm_george", "George — British, mature storyteller"),
    ("bm_fable", "Fable — British, warm and grand"),
    ("bm_lewis", "Lewis — British, deep"),
    ("bm_daniel", "Daniel — British, calm"),
    ("am_onyx", "Onyx — American, very deep"),
    ("am_fenrir", "Fenrir — American, strong"),
    ("am_michael", "Michael — American, warm"),
    ("am_adam", "Adam — American, low"),
    ("bm_george,am_onyx", "George + Onyx blend — British gravitas, deeper"),
    ("bm_fable,bm_lewis", "Fable + Lewis blend — grand and deep"),
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
