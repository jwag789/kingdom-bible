// Puts the built site online with GitHub Pages: builds dist/, then publishes it as the
// gh-pages branch of the GitHub repo (only the built site goes up, never the tools or .env).
//
//   node scripts/deploy.mjs                  uses the repo in DEPLOY_REPO or the default below
//
// Needs the GitHub CLI (gh), signed in. The first run creates the repo and turns on Pages.

import { execFileSync } from 'node:child_process';
import { mkdtemp, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const repo = process.env.DEPLOY_REPO ?? 'jwag789/kingdom-bible';
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', ...opts });
const quiet = (cmd, args) => { try { return execFileSync(cmd, args, { stdio: 'pipe' }).toString(); } catch { return null; } };

run('node', [join(root, 'scripts/build.mjs')]);

if (quiet('gh', ['repo', 'view', repo]) == null) {
  run('gh', ['repo', 'create', repo, '--public', '--description', 'Kingdom Bible: Bible stories in cut-paper pictures you can touch, with narration and music.']);
}

// A fresh, single-commit branch each time: the site's history isn't worth keeping.
const dir = await mkdtemp(join(tmpdir(), 'kingdom-bible-deploy-'));
try {
  await cp(join(root, 'dist'), dir, { recursive: true });
  const git = args => run('git', args, { cwd: dir });
  git(['init', '-q', '-b', 'gh-pages']);
  git(['add', '-A']);
  git(['-c', 'user.name=Justin Wagner', '-c', 'user.email=justintwagner1@gmail.com', 'commit', '-q', '-m', 'Publish Kingdom Bible',
    '-m', 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>']);
  git(['push', '-q', '--force', `https://github.com/${repo}.git`, 'gh-pages']);
} finally {
  await rm(dir, { recursive: true, force: true });
}

// GitHub often turns Pages on by itself for a gh-pages branch; only ask when it hasn't.
if (quiet('gh', ['api', `repos/${repo}/pages`]) == null) {
  quiet('gh', ['api', '-X', 'POST', `repos/${repo}/pages`, '-f', 'source[branch]=gh-pages', '-f', 'source[path]=/']);
  if (quiet('gh', ['api', `repos/${repo}/pages`]) == null) throw new Error(`Couldn't turn on GitHub Pages for ${repo}; turn it on in the repo's Settings → Pages.`);
}
const [owner, name] = repo.split('/');
console.log(`Published. It will be live in a minute or two at https://${owner}.github.io/${name}/`);
