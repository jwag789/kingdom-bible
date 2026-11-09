// Paper-craft Bible book app icon options, painted with the story art's model (Seedream 4.5 via fal).
import { readFile, writeFile } from 'node:fs/promises';
const out = process.argv[2];
const env = await readFile('.env', 'utf8');
const key = env.match(/^\s*FAL_KEY\s*=\s*["']?([^"'\s]+)/m)?.[1];
const STYLE = 'App icon artwork, square, full bleed edge to edge (no rounded corners, no frame, no border, no text, no lettering, no letters on the book). Made of textured hand-cut paper, photographed flat: layered paper shapes with soft drop shadows, gentle depth, warm glowing light, rich harmonious colors, bright and cheerful, simple bold shapes that read clearly at a small size. ';
const options = {
  'open-book-sky': 'A big open storybook Bible seen from slightly above, centered, pages fanning up, with golden light and little paper stars rising out of the pages. Background: bright sky-blue paper with soft white paper clouds.',
  'book-sun': 'A closed hardcover Bible book with a deep red paper cover and gold paper edges, standing slightly open, centered; a warm golden paper sun with rays rises behind it. Background: soft sky-blue and cream paper layers.',
  'book-ark-rainbow': 'An open Bible storybook, centered, with a tiny paper Noah\'s ark and a paper rainbow popping up out of its pages like a pop-up book. Background: light sky-blue paper with a few white paper clouds.',
  'book-lamb': 'An open storybook Bible, centered, with a small fluffy white paper lamb sitting on top of the open pages, soft golden glow from the pages. Background: fresh meadow-green and sky-blue paper layers.',
};
await Promise.all(Object.entries(options).map(async ([name, idea], i) => {
  const res = await fetch('https://fal.run/fal-ai/bytedance/seedream/v4.5/text-to-image', {
    method: 'POST', headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: STYLE + idea, image_size: { width: 1024, height: 1024 }, num_images: 1, seed: 41 + i, enable_safety_checker: true }),
  });
  if (!res.ok) { console.log(name, 'failed', res.status, (await res.text()).slice(0, 200)); return; }
  const url = (await res.json()).images[0].url;
  await writeFile(`${out}/${name}.png`, Buffer.from(await (await fetch(url)).arrayBuffer()));
  console.log('saved', name);
}));
