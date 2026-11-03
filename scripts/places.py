"""Makes Your Kingdom's places (the meadow, Under the Stars, Under the Sea…) from the stories'
own pictures: each is a story picture, or the part of one with nobody in it, cut to `crop`
(left and right edges, as fractions of the width) and saved smaller.

    .narration/bin/python scripts/places.py

Reads data/places.json and writes art/places/<id>.jpg, plus a small art/places/<id>-thumb.jpg
for the picker.
"""

import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
WIDTH, THUMB = 2400, 320

out = ROOT / "art" / "places"
out.mkdir(parents=True, exist_ok=True)
for place in json.loads((ROOT / "data" / "places.json").read_text())["places"]:
    im = Image.open(ROOT / place["from"]).convert("RGB")
    left, right = place.get("crop", [0, 1])
    im = im.crop((round(left * im.width), 0, round(right * im.width), im.height))
    if im.width > WIDTH:
        im = im.resize((WIDTH, round(im.height * WIDTH / im.width)), Image.LANCZOS)
    im.save(out / f"{place['id']}.jpg", quality=84, optimize=True, progressive=True)
    # The thumbnail is cut to 16:9 around the middle, like the picker's cards.
    h = min(im.height, round(im.width * 9 / 16))
    thumb = im.crop((0, (im.height - h) // 2, im.width, (im.height - h) // 2 + h))
    thumb.thumbnail((THUMB, THUMB))
    thumb.save(out / f"{place['id']}-thumb.jpg", quality=80, optimize=True)
    print(f"{place['id']}: {im.width}x{im.height}")
