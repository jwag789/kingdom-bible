"""Records the games' spoken lines (the intro, "Day Four…", "Two lions!", "You did it!") with the same
narrator as the stories.

    .narration/bin/python scripts/narrate_games.py [--voice af_heart,af_bella] [--speed 0.9] [--force]

Reads data/games.json (and data/props.json for the animals' names) and writes
audio/games/<story>/<key>.m4a. Lines already recorded are skipped unless --force is given.
"""

import argparse
import json
import subprocess
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro import KPipeline

ROOT = Path(__file__).resolve().parent.parent
RATE = 24000

parser = argparse.ArgumentParser()
parser.add_argument("--voice", default="af_heart,af_bella")
parser.add_argument("--speed", type=float, default=0.9)
parser.add_argument("--force", action="store_true")
args = parser.parse_args()

games = json.loads((ROOT / "data" / "games.json").read_text())
names = {p["id"]: p["name"] for p in json.loads((ROOT / "data" / "props.json").read_text())["props"]}
pipeline = KPipeline(lang_code="b" if args.voice.startswith("b") else "a", repo_id="hexgrad/Kokoro-82M")

for story, game in games.items():
    out = ROOT / "audio" / "games" / story
    out.mkdir(parents=True, exist_ok=True)
    # Every line is spoken except "done" (shown on the win card) and "pair" (a pattern, below).
    lines = {key: text for key, text in game["lines"].items() if key not in ("done", "pair")}
    if game.get("type") == "count":
        numbers = "One Two Three Four Five Six Seven Eight Nine Ten".split()
        for n in range(1, game.get("count", 10) + 1):
            lines[f"count-{n}"] = numbers[n - 1] + "!"
    for kind in game.get("pieces", []):
        lines[f"pair-{kind}"] = game["lines"]["pair"].replace("{name}", names.get(kind, kind))
    for key, text in lines.items():
        target = out / f"{key}.m4a"
        if target.exists() and not args.force:
            continue
        chunks = [np.zeros(int(RATE * 0.1), dtype=np.float32)]
        for result in pipeline(text.replace("’", "'"), voice=args.voice, speed=args.speed):
            if result.audio is not None:
                chunks.append(result.audio.detach().cpu().numpy().astype(np.float32))
        chunks.append(np.zeros(int(RATE * 0.2), dtype=np.float32))
        with tempfile.NamedTemporaryFile(suffix=".wav") as wav:
            sf.write(wav.name, np.concatenate(chunks), RATE)
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav.name, "-c:a", "aac", "-b:a", "80k", str(target)], check=True)
        print(f"{story}/{key}: {text}")
