// Builds the site for hosting into dist/: only what the reader needs, with the pictures
// shrunk for phones, and the service worker stamped with a version so updates reach people.
//
//   node scripts/build.mjs
//   node scripts/serve.mjs 8141 dist       try the built site
//
// Every story in data/library.json goes in: its data, Bible text, narration and art.
// Tools, test pages, reference pictures and replaced art (history/) stay out.

import { readFile, writeFile, mkdir, rm, cp, readdir, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = join(root, 'dist');
const ART_WIDTH = 1600;      // wide enough for a laptop screen, a fraction of the original's weight
const ART_QUALITY = 74;

const copy = async rel => {
  await mkdir(dirname(join(out, rel)), { recursive: true });
  await cp(join(root, rel), join(out, rel), { recursive: true });
};
const json = async rel => JSON.parse(await readFile(join(root, rel), 'utf8'));
const writeJson = async (rel, data) => {
  await mkdir(dirname(join(out, rel)), { recursive: true });
  await writeFile(join(out, rel), JSON.stringify(data));
};

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const rel of ['index.html', 'manifest.webmanifest', 'icons', 'fonts', 'src', 'data/library.json', 'art/lamb.png']) await copy(rel);
await writeFile(join(out, '.nojekyll'), '');    // GitHub Pages: serve files as they are

const library = await json('data/library.json');
for (const { id } of library.stories) {
  const story = await json(`data/${id}.json`);
  // What only the art generator needs (prompts, references, history) stays behind.
  for (const key of ['style', 'castStyle', 'editKeep', 'cast']) delete story[key];
  for (const scene of story.scenes) {
    for (const layer of scene.layers) {
      for (const key of ['prompt', 'edit', 'editOf', 'refs', 'generated', 'seed']) delete layer[key];
      if (!layer.src) continue;
      const to = join(out, layer.src);
      await mkdir(dirname(to), { recursive: true });
      execFileSync('sips', ['-Z', String(ART_WIDTH), '-s', 'format', 'jpeg', '-s', 'formatOptions', String(ART_QUALITY),
        join(root, layer.src), '--out', to], { stdio: 'ignore' });
    }
  }
  await writeJson(`data/${id}.json`, story);
  await copy(story.text);

  const narration = await json(`audio/${id}/narration.json`).catch(() => null);
  if (narration) {
    for (const entry of Object.values(narration)) await copy(entry.src);
    await writeJson(`audio/${id}/narration.json`, narration);
  }
}

// Stamp the service worker with a hash of everything it serves.
async function files(dir) {
  const list = [];
  for (const name of (await readdir(dir)).sort()) {
    const p = join(dir, name);
    if ((await stat(p)).isDirectory()) list.push(...await files(p));
    else list.push(p);
  }
  return list;
}
const hash = createHash('sha256');
let bytes = 0;
for (const f of await files(out)) {
  const body = await readFile(f);
  hash.update(f.slice(out.length)).update(body);
  bytes += body.length;
}
const version = hash.digest('hex').slice(0, 10);
const sw = (await readFile(join(root, 'sw.js'), 'utf8')).replace("const VERSION = 'dev';", `const VERSION = '${version}';`);
if (!sw.includes(version)) throw new Error('Could not stamp the version into sw.js');
await writeFile(join(out, 'sw.js'), sw);

console.log(`Built dist/ (version ${version}): ${(bytes / 1e6).toFixed(1)} MB across ${library.stories.length} stories.`);
