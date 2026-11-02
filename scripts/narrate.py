"""Records the narrator for a story with Kokoro, an open-source voice model that runs on
this machine (free; the model downloads from Hugging Face on first use), and saves the
timing of every word so the reader can light words up as they're spoken.

    .narration/bin/python scripts/narrate.py                  # data/genesis-1.json
    .narration/bin/python scripts/narrate.py data/x.json --voice af_heart --speed 0.92 --force

Writes audio/<story>/<slide>.m4a and audio/<story>/narration.json. Slides whose text
hasn't changed are skipped unless --force is given.
"""

import argparse
import json
import re
import subprocess
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro import KPipeline

ROOT = Path(__file__).resolve().parent.parent
RATE = 24000

parser = argparse.ArgumentParser()
parser.add_argument("story", nargs="?", default="data/genesis-1.json")
parser.add_argument("--voice", default="af_heart")
parser.add_argument("--speed", type=float, default=0.92)
parser.add_argument("--force", action="store_true")
args = parser.parse_args()

story_path = ROOT / args.story
story = json.loads(story_path.read_text())
story_id = story_path.stem
out_dir = ROOT / "audio" / story_id
out_dir.mkdir(parents=True, exist_ok=True)
manifest_path = out_dir / "narration.json"
manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}

# Every slide that has words to read, keyed the same way the reader keys its slides.
lines = [("cover", f"{story['title']}.")]
for scene in story["scenes"]:
    lines.append((f"{scene['id']}-title", f"{scene['eyebrow']}. {scene['title']}."))
    for i, beat in enumerate(scene["beats"]):
        lines.append((f"{scene['id']}-{i}", beat))


def speakable(text):
    """Small changes so the voice phrases it naturally; the words themselves stay the same."""
    text = text.replace("—", ", ").replace("“", '"').replace("”", '"').replace("’", "'")
    return re.sub(r"\s+", " ", text).strip()


# British voices (b…) read with British pronunciation, the rest with American.
pipeline = KPipeline(lang_code="b" if args.voice.startswith("b") else "a", repo_id="hexgrad/Kokoro-82M")
lead = np.zeros(int(RATE * 0.25), dtype=np.float32)   # a breath before speaking

for key, text in lines:
    target = out_dir / f"{key}.m4a"
    entry = manifest.get(key)
    if not args.force and entry and entry.get("text") == text and entry.get("voice") == args.voice and target.exists():
        continue

    chunks, words, offset = [lead], [], len(lead) / RATE
    for result in pipeline(speakable(text), voice=args.voice, speed=args.speed):
        if result.audio is None:
            continue
        audio = result.audio.detach().cpu().numpy().astype(np.float32)
        for token in result.tokens or []:
            if token.start_ts is None or token.end_ts is None or not re.search(r"\w", token.text):
                continue
            words.append({"w": token.text, "s": round(offset + token.start_ts, 3), "e": round(offset + token.end_ts, 3)})
        chunks.append(audio)
        offset += len(audio) / RATE
    chunks.append(np.zeros(int(RATE * 0.3), dtype=np.float32))
    audio = np.concatenate(chunks)

    with tempfile.NamedTemporaryFile(suffix=".wav") as wav:
        sf.write(wav.name, audio, RATE)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav.name, "-c:a", "aac", "-b:a", "80k", str(target)], check=True)

    manifest[key] = {
        "src": f"audio/{story_id}/{key}.m4a",
        "text": text,
        "voice": args.voice,
        "duration": round(len(audio) / RATE, 3),
        "words": words,
    }
    manifest_path.write_text(json.dumps(manifest, indent=1, ensure_ascii=False) + "\n")
    print(f"{key}: {len(words)} words, {len(audio) / RATE:.1f}s")

print(f"Done: {len(lines)} slides in {out_dir.relative_to(ROOT)}")
