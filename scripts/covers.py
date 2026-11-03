"""Makes the small cover pictures for the Stories page (art/covers/<story>.jpg) from each
story's chosen painting in data/library.json ("coverFrom").

    python3 scripts/covers.py
"""

import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
library = json.loads((ROOT / "data" / "library.json").read_text())
(ROOT / "art" / "covers").mkdir(parents=True, exist_ok=True)
for entry in library["stories"]:
    src = ROOT / entry["coverFrom"]
    if not src.exists():
        print(f"{entry['id']}: {entry['coverFrom']} isn't painted yet")
        continue
    im = Image.open(src).convert("RGB")
    im = im.resize((720, round(720 * im.height / im.width)), Image.LANCZOS)
    out = ROOT / "art" / "covers" / f"{entry['id']}.jpg"
    im.save(out, quality=78, optimize=True)
    entry["cover"] = f"art/covers/{entry['id']}.jpg"
    print(f"{entry['id']}: {out.stat().st_size // 1024} KB")
(ROOT / "data" / "library.json").write_text(json.dumps(library, indent=2, ensure_ascii=False) + "\n")
