// Paints the cut-paper pieces the games use (the animals for Two by Two, and so on): each one
// painted on white with Seedream, then cut out onto a transparent background with BiRefNet.
//
//   node scripts/props.mjs                 dry run: list what's missing
//   node scripts/props.mjs --go            paint the missing ones (bills your fal account, ~5¢ each)
//   node scripts/props.mjs --go --force    repaint them all
//
// The list is data/props.json (a prop marked `"thing": true` is an object, painted with the
// `thing` style instead of the animal one); pictures go to art/props/<id>.png. Then trim them with
// scripts/trim_props.py so each picture ends at the animal's edges.

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const { style, thing, props } = JSON.parse(await readFile(join(root, 'data/props.json'), 'utf8'));
const go = process.argv.includes('--go'), force = process.argv.includes('--force');
const exists = p => access(p).then(() => true, () => false);
const todo = [];
for (const prop of props) if (force || !(await exists(join(root, 'art/props', `${prop.id}.png`)))) todo.push(prop);
console.log(`${todo.length} piece(s) to paint: ${todo.map(p => p.id).join(', ') || 'none'}`);
if (!go || !todo.length) { if (todo.length) console.log('Dry run. Add --go to paint them (bills your fal account).'); process.exit(0); }

const env = await readFile(join(root, '.env'), 'utf8').catch(() => '');
const key = process.env.FAL_KEY ?? env.match(/^\s*FAL_KEY\s*=\s*["']?([^"'\s]+)/m)?.[1];
if (!key) throw new Error('No FAL_KEY found in the environment or in .env');
const fal = async (model, input) => {
  const res = await fetch(`https://fal.run/${model}`, {
    method: 'POST', headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`${model} failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return res.json();
};

await mkdir(join(root, 'art/props'), { recursive: true });
// Two at a time: fal allows only so many requests at once, and the story art may be painting too.
const queue = todo.map((prop, i) => [prop, i]);
const worker = async () => { for (let job; (job = queue.shift());) await paint(...job); };
await Promise.all([worker(), worker()]);

async function paint(prop, i) {
  const painted = (await fal('fal-ai/bytedance/seedream/v4.5/text-to-image',
    { prompt: `${prop.thing ? thing : style}. ${prop.prompt}`, image_size: { width: 1024, height: 1024 }, num_images: 1, seed: 500 + i, enable_safety_checker: true })).images[0].url;
  const cut = (await fal('fal-ai/birefnet', { image_url: painted })).image.url;
  await writeFile(join(root, 'art/props', `${prop.id}.png`), Buffer.from(await (await fetch(cut)).arrayBuffer()));
  console.log(`saved art/props/${prop.id}.png`);
}
