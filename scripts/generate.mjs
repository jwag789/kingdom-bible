// Makes and edits the art for a story's layers with fal, and points each layer at its image.
//
//   node scripts/generate.mjs                          dry run: list what would be made (no cost)
//   node scripts/generate.mjs --go                     make every layer that has no art yet
//   node scripts/generate.mjs --go --only land         just one scene (or scene/layer, e.g. land/trees)
//   node scripts/generate.mjs --go --force ...         remake even if art exists
//   node scripts/generate.mjs --go --edit beginning/dark "Remove the glowing orb."
//                                                      change an existing image by instruction
//
// Plates are full scenes. Cutouts are painted on white, then their background is removed.
// Every prompt starts with the story's `style`, so all the art shares one look. A layer with
// `editOf` is made by editing another layer's image with its `edit` instruction (plus the
// story's `editKeep`), so "darkness" and "light breaks in" are the same picture. When an image changes, every
// layer edited from it is remade too. Replaced images go to <art>/<scene>/history.
//
// A story can have a `cast`: characters and things (Noah, the ark) painted once as reference
// pictures (in <art>/cast). A layer that lists them in `refs` is painted with those pictures
// as references, so Noah looks like the same Noah in every scene. `--only cast` remakes them.
// An edit can set `"editModel": "kontext"` to use FLUX Kontext, which keeps the picture's
// composition more exactly (no reference pictures, though) — for "the same scene, but…".

import { readFile, writeFile, mkdir, rename, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const flag = name => args.includes(name);
const value = name => (flag(name) ? args[args.indexOf(name) + 1] : null);
const go = flag('--go');
const force = flag('--force');
const only = value('--only');
const editTarget = value('--edit');
const editText = editTarget ? args[args.indexOf('--edit') + 2] : null;
const storyFile = args.find(a => a.endsWith('.json')) ?? 'data/genesis-1.json';

const IMAGE_MODEL = 'fal-ai/bytedance/seedream/v4.5/text-to-image';
const EDIT_MODEL = 'fal-ai/bytedance/seedream/v4.5/edit';
const KONTEXT_MODEL = 'fal-ai/flux-pro/kontext';
const CUTOUT_MODEL = 'fal-ai/birefnet';
const SIZE = { width: 2048, height: 1152 };

async function falKey() {
  if (process.env.FAL_KEY) return process.env.FAL_KEY;
  const env = await readFile(join(root, '.env'), 'utf8').catch(() => '');
  return env.match(/^\s*FAL_KEY\s*=\s*["']?([^"'\s]+)/m)?.[1];
}

async function fal(model, input, key) {
  const res = await fetch(`https://fal.run/${model}`, {
    method: 'POST',
    headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`${model} failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

async function dataUri(src) {
  const bytes = await readFile(join(root, src));
  return `data:${src.endsWith('.png') ? 'image/png' : 'image/jpeg'};base64,${bytes.toString('base64')}`;
}

const seedFor = id => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 1_000_000;
const exists = p => access(p).then(() => true, () => false);

// ---- Work out the jobs
const story = JSON.parse(await readFile(join(root, storyFile), 'utf8'));
const artRoot = story.art ?? 'art';
const cast = new Map((story.cast ?? []).map(c => [c.id, c]));
const jobs = [];   // { scene, layer, name, how: 'cast' | 'paint' | 'edit-from-base' | 'edit-self', instruction? }

for (const entry of cast.values()) {
  const name = `cast/${entry.id}`;
  if (editTarget || (entry.src && !(force && (only === 'cast' || only === name)))) continue;
  jobs.push({ layer: entry, name, how: 'cast' });
}
for (const scene of story.scenes) {
  const changed = new Set();
  for (const layer of scene.layers) {
    const name = `${scene.id}/${layer.id}`;
    for (const ref of layer.refs ?? []) if (!cast.has(ref)) throw new Error(`${name} refers to "${ref}", which isn't in the cast`);
    if (editTarget) {
      if (name === editTarget) {
        if (!editText) throw new Error('--edit needs an instruction, e.g. --edit beginning/dark "Remove the orb."');
        if (!layer.src) throw new Error(`${name} has no image to edit yet`);
        jobs.push({ scene, layer, name, how: 'edit-self', instruction: editText });
        changed.add(layer.id);
      } else if (layer.editOf && changed.has(layer.editOf)) {
        jobs.push({ scene, layer, name, how: 'edit-from-base' });
        changed.add(layer.id);
      }
      continue;
    }
    const picked = !only || only === scene.id || only === name;
    const baseChanged = layer.editOf && changed.has(layer.editOf);
    if (!baseChanged && (!picked || (layer.src && !force))) continue;
    jobs.push({ scene, layer, name, how: layer.editOf ? 'edit-from-base' : 'paint' });
    changed.add(layer.id);
  }
}
if (editTarget && !jobs.length) throw new Error(`No layer called ${editTarget}`);

const withRefs = j => j.layer.refs?.length ? ` with ${j.layer.refs.join(', ')}` : '';
const describe = j => j.how === 'cast' ? 'reference picture'
  : j.how === 'paint' ? `paint (${j.layer.kind})` + (j.layer.kind === 'cutout' ? ' + cut out' : '') + withRefs(j)
  : j.how === 'edit-self' ? `edit: “${j.instruction}”` : `edit of ${j.layer.editOf}` + withRefs(j);
const paints = jobs.filter(j => j.how === 'cast' || (j.how === 'paint' && !j.layer.refs?.length)).length;
console.log(`${jobs.length} image(s): ${paints} painted with ${IMAGE_MODEL}, ${jobs.length - paints} made with ${EDIT_MODEL}.`);
for (const j of jobs) console.log(`  ${j.name.padEnd(22)} ${describe(j)}`);
if (!jobs.length) process.exit(0);
if (!go) {
  console.log('\nDry run. Add --go to run it (this bills your fal account).');
  process.exit(0);
}

// ---- Run them
const key = await falKey();
if (!key) throw new Error('No FAL_KEY found in the environment or in .env');

// "Image 2 shows Noah, image 3 shows the ark." — numbered after any images that come first.
function refNote(refs, first) {
  if (!refs?.length) return '';
  const said = refs.map((r, i) => `image ${first + i} shows ${cast.get(r).name ?? r}`).join(', ');
  return ` Reference pictures: ${said}. Draw them exactly as they look there, in this picture's cut-paper style, and leave out the references' plain backgrounds.`;
}

for (const job of jobs) {
  const { scene, layer, name, how } = job;
  const seed = layer.seed ?? seedFor(scene?.id ?? name);
  const refs = await Promise.all((layer.refs ?? []).map(r => {
    if (!cast.get(r).src) throw new Error(`${name} needs the "${r}" reference picture first`);
    return dataUri(cast.get(r).src);
  }));
  let url, model, note;
  if (how === 'cast') {
    process.stdout.write(`${name}: painting…`);
    const prompt = `${story.castStyle ?? story.style}. ${layer.prompt}`;
    url = (await fal(IMAGE_MODEL, { prompt, image_size: SIZE, num_images: 1, seed, enable_safety_checker: true }, key)).images[0].url;
    model = IMAGE_MODEL;
  } else if (how === 'paint' && refs.length) {
    process.stdout.write(`${name}: painting with ${layer.refs.join(', ')}…`);
    const prompt = `${story.style}. ${layer.prompt}.${refNote(layer.refs, 1)}`;
    const made = await fal(EDIT_MODEL, { prompt, image_urls: refs, image_size: SIZE, num_images: 1, seed, enable_safety_checker: true }, key);
    url = made.images?.[0]?.url;
    model = EDIT_MODEL;
  } else if (how === 'paint') {
    const cutout = layer.kind === 'cutout';
    const prompt = `${story.style}. ${layer.prompt}` + (cutout ? '. Single subject group, centered, plain pure white background.' : '');
    process.stdout.write(`${name}: painting…`);
    url = (await fal(IMAGE_MODEL, { prompt, image_size: SIZE, num_images: 1, seed, enable_safety_checker: true }, key)).images[0].url;
    if (cutout) {
      process.stdout.write(' cutting out…');
      url = (await fal(CUTOUT_MODEL, { image_url: url }, key)).image.url;
    }
    model = IMAGE_MODEL;
  } else {
    const base = how === 'edit-self' ? layer : scene.layers.find(l => l.id === layer.editOf);
    if (!base?.src) throw new Error(`${name} edits "${layer.editOf}", which has no image yet`);
    const instruction = how === 'edit-self' ? job.instruction : layer.edit;
    process.stdout.write(`${name}: editing ${base.src}…`);
    const lead = refs.length ? ' Image 1 is the picture to change.' : '';
    const prompt = [instruction, story.editKeep].filter(Boolean).join(' ') + lead + refNote(layer.refs, 2);
    if (layer.editModel === 'kontext') {
      if (refs.length) throw new Error(`${name}: Kontext edits can't use reference pictures`);
      const made = await fal(KONTEXT_MODEL, { prompt, image_url: await dataUri(base.src), aspect_ratio: '16:9', seed }, key);
      url = made.images?.[0]?.url;
      model = KONTEXT_MODEL;
    } else {
      const made = await fal(EDIT_MODEL, { prompt, image_urls: [await dataUri(base.src), ...refs], image_size: SIZE, num_images: 1, seed, enable_safety_checker: true }, key);
      url = made.images?.[0]?.url ?? made.image?.url;
      model = EDIT_MODEL;
    }
    if (how === 'edit-self') note = instruction;
  }
  if (!url) throw new Error(`${name}: fal returned no image`);

  const img = await fetch(url);
  if (!img.ok) throw new Error(`Download failed for ${name}: ${img.status}`);
  const ext = (img.headers.get('content-type') ?? '').includes('png') ? 'png' : 'jpg';
  const folder = how === 'cast' ? 'cast' : scene.id;
  const dir = join(root, artRoot, folder);
  await mkdir(join(dir, 'history'), { recursive: true });
  const file = join(dir, `${layer.id}.${ext}`);
  const stamp = Date.now();
  if (await exists(file)) await rename(file, join(dir, 'history', `${layer.id}-${stamp}.${ext}`));
  await writeFile(file, Buffer.from(await img.arrayBuffer()));

  layer.src = `${artRoot}/${folder}/${layer.id}.${ext}`;
  // Hand edits are kept as a list, so the image can be rebuilt by repainting and replaying them.
  const edits = how === 'paint' || how === 'cast' ? [] : (layer.generated?.edits ?? []);
  if (note) edits.push(note);
  layer.generated = { model, seed, at: new Date(stamp).toISOString(), ...(edits.length ? { edits } : {}) };
  // Save after every image so a failure part-way keeps what's done.
  await writeFile(join(root, storyFile), JSON.stringify(story, null, 2) + '\n');
  console.log(` saved ${layer.src}`);
}
console.log('Done. Reload the reader to see the new art.');
