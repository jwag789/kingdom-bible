"""Trims each cut-out game piece (art/props/*.png, and art/lamb.png) to the edges of what's
painted, and shrinks it to a sensible size for the web.

    python3 scripts/trim_props.py
"""

from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SIZE = 420

for path in sorted((ROOT / 'art' / 'props').glob('*.png')):
    im = Image.open(path).convert('RGBA')
    box = im.split()[3].point(lambda v: 255 if v > 24 else 0).getbbox()
    if not box:
        continue
    im = im.crop(box)
    im.thumbnail((SIZE, SIZE))
    im.save(path, optimize=True)
    print(f'{path.relative_to(ROOT)}: {im.size[0]}x{im.size[1]}')
