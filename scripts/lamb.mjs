// Paints the little lamb hidden in every scene of every story: one cut-paper lamb, cut out
// onto a transparent background, so it looks the same wherever it's tucked away.
//
//   node scripts/lamb.mjs        dry run
//   node scripts/lamb.mjs --go   paint it (bills your fal account, a few cents)
//
// Writes art/lamb.png. Each scene says where its lamb hides with `"lamb": { "at", "size", "flip" }`.

import { readFile, writeFile, rename, mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const PROMPT = "Children's picture book character made of cut paper, photographed flat: textured hand-cut paper shapes with soft drop shadows, " +
  'warm light. A single small, sweet white lamb with fluffy layered paper wool, a soft cream face, tiny dark eyes, pink-lined ears and ' +
  'little dark hooves, standing in side view facing left, full body. Centered on a plain pure white background, nothing else in the picture. ' +
  'No text, no border';

if (!process.argv.includes('--go')) {
  console.log('Would paint art/lamb.png with Seedream 4.5 and cut it out with BiRefNet. Add --go to run it (bills your fal account).');
  process.exit(0);
}
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

const painted = (await fal('fal-ai/bytedance/seedream/v4.5/text-to-image',
  { prompt: PROMPT, image_size: { width: 1024, height: 1024 }, num_images: 1, seed: 33, enable_safety_checker: true })).images[0].url;
const cut = (await fal('fal-ai/birefnet', { image_url: painted })).image.url;
const file = join(root, 'art', 'lamb.png');
await mkdir(join(root, 'art', 'history'), { recursive: true });
if (await access(file).then(() => true, () => false)) await rename(file, join(root, 'art', 'history', `lamb-${Date.now()}.png`));
await writeFile(file, Buffer.from(await (await fetch(cut)).arrayBuffer()));
console.log('Saved art/lamb.png');
