"""Cuts every story's cast (Noah, the ark, Mary, Jonah's fish…) out of its reference picture,
for Your Kingdom. Runs on this Mac with rembg, an open-source background remover (free; the
model downloads once on first use).

    .narration/bin/python scripts/pieces.py [--force]

Writes art/pieces/<name>.png (trimmed to the figure) and data/pieces.json:
  { "pieces": [{ "id", "name", "src", "stories": [story ids that unlock it] }] }
A piece shared by several stories (Moses, in all three Moses stories) is cut out once and
unlocks with any of them.
"""

import argparse
import json
from pathlib import Path

from PIL import Image
from rembg import new_session, remove

ROOT = Path(__file__).resolve().parent.parent
SIZE = 520

parser = argparse.ArgumentParser()
parser.add_argument("--force", action="store_true")
args = parser.parse_args()

library = json.loads((ROOT / "data" / "library.json").read_text())
session = new_session("isnet-general-use")
out_dir = ROOT / "art" / "pieces"
out_dir.mkdir(parents=True, exist_ok=True)
pieces = {}   # source picture → piece

for entry in library["stories"]:
    story = json.loads((ROOT / "data" / f"{entry['id']}.json").read_text())
    for member in story.get("cast", []):
        src = member.get("src")
        if not src:
            continue
        if src in pieces:
            pieces[src]["stories"].append(entry["id"])
            continue
        name = member.get("name", member["id"])
        file = out_dir / f"{Path(story['art']).name}-{member['id']}.png"
        if args.force or not file.exists():
            cut = remove(Image.open(ROOT / src).convert("RGB"), session=session)
            box = cut.split()[3].point(lambda v: 255 if v > 40 else 0).getbbox()
            cut = cut.crop(box)
            cut.thumbnail((SIZE, SIZE))
            cut.save(file, optimize=True)
            print(f"{file.relative_to(ROOT)}: {cut.size[0]}x{cut.size[1]}")
        pieces[src] = {"id": f"{Path(story['art']).name}-{member['id']}", "name": name,
                       "src": str(file.relative_to(ROOT)), "stories": [entry["id"]]}

(ROOT / "data" / "pieces.json").write_text(json.dumps({"pieces": list(pieces.values())}, indent=2, ensure_ascii=False) + "\n")
print(f"{len(pieces)} pieces")
