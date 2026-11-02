// Paints the same two scenes in a few candidate looks, to choose one art direction for the
// whole story. Writes art/style-test/<look>-<scene>.jpg and art/style-test/looks.json; compare
// them at /styles.html.
//
//   node scripts/style_test.mjs        dry run
//   node scripts/style_test.mjs --go   paint them (bills your fal account, about $0.04 each)

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const MODEL = 'fal-ai/bytedance/seedream/v4.5/text-to-image';
const SIZE = { width: 2048, height: 1152 };
const FRAME = 'Wide cinematic landscape composition, the main subjects right of center, calm open space in the left third. No text, no lettering, no frame, no border.';

const LOOKS = [
  { id: 'gouache', label: 'Luminous gouache',
    style: 'Hand-painted gouache storybook illustration: soft matte brushwork, subtle paper grain, simplified gentle shapes, a warm luminous palette of gold, teal and soft rose, glowing atmospheric light, timeless classic picture book art' },
  { id: 'watercolor', label: 'Watercolor and ink',
    style: 'Delicate watercolor and fine ink illustration from a treasured antique children\'s Bible: loose transparent washes, soft blooms of color, fine expressive pen lines, plenty of luminous paper white, gentle muted palette warmed with gold' },
  { id: 'epic', label: 'Epic oil painting',
    style: 'Majestic painterly oil painting in the tradition of nineteenth-century Romantic landscape painters: vast sublime scale, dramatic shafts of golden light through clouds, rich glowing color, visible confident brushstrokes, awe and reverence, suitable for a children\'s Bible' },
  { id: 'paper', label: 'Layered paper',
    style: 'Handcrafted layered cut-paper illustration: textured paper layers stacked in soft depth with gentle shadows between them, hand-cut organic edges, warm glowing light, rich harmonious colors, a magical storybook diorama' },
];

const SCENES = [
  { id: 'light', label: 'Day 1 · Let there be light',
    prompt: 'The first light breaking over a vast dark primordial ocean: warm golden light pours down from high above through parting darkness, soft mist drifting over the deep still water, nothing else exists yet, no land' },
  { id: 'people', label: 'Day 6 · Adam and Eve',
    prompt: 'Adam and Eve, the first man and woman, stand together in a golden wildflower meadow beside a winding river, seen from behind and a little to the side, looking out at animals at peace: a lion lying beside a lamb, an elephant, a giraffe and deer. Distant blue hills, warm afternoon light. They have warm olive-brown skin; he has dark curly hair and a short beard, she has long dark wavy hair down her back; they wear simple garments of woven green leaves' },
];

const go = process.argv.includes('--go');
const jobs = LOOKS.flatMap(look => SCENES.map(scene => ({ look, scene })));
console.log(`${jobs.length} images with ${MODEL}:`);
for (const { look, scene } of jobs) console.log(`  ${look.id}-${scene.id}`);
if (!go) { console.log('\nDry run. Add --go to paint them (bills your fal account).'); process.exit(0); }

const env = await readFile(join(root, '.env'), 'utf8').catch(() => '');
const key = process.env.FAL_KEY ?? env.match(/^\s*FAL_KEY\s*=\s*["']?([^"'\s]+)/m)?.[1];
if (!key) throw new Error('No FAL_KEY found in the environment or in .env');

const dir = join(root, 'art', 'style-test');
await mkdir(dir, { recursive: true });
await Promise.all(jobs.map(async ({ look, scene }) => {
  const res = await fetch(`https://fal.run/${MODEL}`, {
    method: 'POST',
    headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: `${look.style}. ${scene.prompt}. ${FRAME}`, image_size: SIZE, num_images: 1, seed: 4242, enable_safety_checker: true }),
  });
  if (!res.ok) throw new Error(`${look.id}-${scene.id} failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const url = (await res.json()).images[0].url;
  const img = await fetch(url);
  await writeFile(join(dir, `${look.id}-${scene.id}.jpg`), Buffer.from(await img.arrayBuffer()));
  console.log(`saved ${look.id}-${scene.id}.jpg`);
}));
await writeFile(join(dir, 'looks.json'), JSON.stringify({
  looks: LOOKS, scenes: SCENES.map(({ id, label }) => ({ id, label })),
}, null, 1) + '\n');
console.log('Done. Compare them at /styles.html');
