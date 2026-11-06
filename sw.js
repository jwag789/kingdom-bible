// The service worker: keeps Kingdom Bible working offline once a story has been opened.
//
// The page, code and story data are fetched fresh when there's a connection (so updates
// arrive) and come from the cache when there isn't. Pictures and narration rarely change, so
// they come from the cache first and are refreshed in the background. Audio is asked for in
// byte ranges (Safari always does this), so cached audio is sliced to the range requested.
// scripts/build.mjs stamps VERSION with a hash of the site, so each release gets a fresh cache.

const VERSION = '8f30b6873b';
const CACHE = `kingdom-bible-${VERSION}`;
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'fonts/fonts.css',
  'src/main.js', 'src/home.js', 'src/kingdom.js', 'src/voices.js', 'src/gate.js', 'src/recorder.js', 'src/cloud.js', 'src/config.js', 'src/reader.js', 'src/stage.js', 'src/effects.js', 'src/touch.js', 'src/sprites.js', 'src/placeholders.js',
  'src/audio.js', 'src/narrator.js', 'src/stickers.js', 'src/native.js', 'src/games.js', 'data/games.json', 'data/props.json', 'data/pieces.json', 'data/library.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('kingdom-bible-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  // Unbuilt (the dev server): stay out of the way, so freshly made art and code always show.
  if (VERSION === 'dev' || req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (/\/(art|audio|icons|fonts)\//.test(url.pathname)) e.respondWith(cacheFirst(req));
  else e.respondWith(networkFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    // "no-cache" still uses the browser's copy, but only after checking with the server that it's current
    // (GitHub Pages lets browsers keep files for ten minutes, which could pair new code with old data).
    const res = await fetch(req, { cache: 'no-cache' });
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return (await cache.match(req, { ignoreSearch: req.mode === 'navigate' })) ?? Response.error();
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const range = req.headers.get('range');
  // Cache whole files: a ranged request is stored (and later answered) from the full file.
  const key = new Request(req.url);
  const fetchWhole = () => fetch(key).then(res => { if (res.status === 200) cache.put(key, res.clone()); return res; });
  const cached = await cache.match(key);
  if (cached) {
    if (!range) fetchWhole().catch(() => {});   // refresh it in the background for next time
    return range ? slice(cached, range) : cached;
  }
  const res = await fetchWhole().catch(() => null);
  if (!res) return Response.error();
  return range && res.status === 200 ? slice(res, range) : res;
}

// Answer "Range: bytes=start-end" from a full response.
async function slice(res, range) {
  const body = await res.blob();
  const [, from, to] = /bytes=(\d*)-(\d*)/.exec(range) ?? [];
  const start = from ? Number(from) : Math.max(0, body.size - Number(to));
  const end = from && to ? Math.min(Number(to), body.size - 1) : body.size - 1;
  return new Response(body.slice(start, end + 1), {
    status: 206,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/octet-stream',
      'content-range': `bytes ${start}-${end}/${body.size}`,
      'content-length': String(end - start + 1),
      'accept-ranges': 'bytes',
    },
  });
}
