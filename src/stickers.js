// Stickers: round cut-outs of the paintings that children collect by playing. Each scene gives
// one for playing with its picture (or tapping its light or rainbow in), and more for the
// secrets hidden in the pictures. They're kept on this device and shown in the sticker book.
//
// A sticker in the story data: { id, name, earn: 'play' | 'reveal' | 'secret', layer, at, r }
// — `at` is the middle of the round crop and `r` its radius, as fractions of the painting's
// width; a secret also has `hit` (how close a tap must be) and may have `with` / `until` a layer.

const STORE = 'kb:stickers';
const ASPECT = 16 / 9;

export class Collection {
  constructor() {
    try { this.got = new Set(JSON.parse(localStorage.getItem(STORE) ?? '[]')); } catch { this.got = new Set(); }
  }
  has(key) { return this.got.has(key); }
  // True if it's new.
  add(key) {
    if (this.got.has(key)) return false;
    this.got.add(key);
    try { localStorage.setItem(STORE, JSON.stringify([...this.got])); } catch {}
    return true;
  }
  get size() { return this.got.size; }
}

// The painting a sticker is cut from.
export function stickerSrc(scene, sticker) {
  const layer = scene.layers.find(l => l.id === sticker.layer) ?? scene.layers[0];
  return layer?.src;
}

// A circle cut from the painting, `px` across, with a white paper edge (see .sticker in index.html).
export function stickerEl(sticker, src, px) {
  const el = document.createElement('div');
  el.className = 'sticker';
  const w = px / (2 * sticker.r), h = w / ASPECT;
  Object.assign(el.style, {
    width: `${px}px`, height: `${px}px`,
    backgroundImage: `url("${src}")`,
    backgroundSize: `${w}px ${h}px`,
    backgroundPosition: `${px / 2 - sticker.at[0] * w}px ${px / 2 - sticker.at[1] * h}px`,
  });
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', sticker.name);
  return el;
}

// The little lamb hidden in every scene, as a round badge.
export function lambEl(px, found = true) {
  const el = document.createElement('div');
  el.className = `sticker lamb${found ? '' : ' missing'}`;
  Object.assign(el.style, { width: `${px}px`, height: `${px}px`, backgroundImage: 'url("art/lamb.png")' });
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', found ? 'A little lamb you found' : 'A little lamb still hiding');
  return el;
}

// "New sticker!" — it pops up, then flies into the sticker book button.
export function showToast(sticker, src, target) {
  popUp(stickerEl(sticker, src, 120), 'New sticker', sticker.name, target);
}

// "You found the little lamb!"
export function showLambToast(found, total, target) {
  popUp(lambEl(120), `Little lamb ${found} of ${total}`, found === total ? 'You found every lamb!' : 'You found a little lamb!', target);
}

function popUp(art, eyebrow, title, target) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  const words = document.createElement('div');
  words.className = 'words';
  const kicker = document.createElement('div');
  kicker.className = 'eyebrow';
  kicker.textContent = eyebrow;
  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = title;
  words.append(kicker, name);
  toast.append(art, words);
  document.body.append(toast);
  setTimeout(() => toast.classList.add('in'), 30);     // after it's on the page, so it animates in
  setTimeout(() => {
    const from = art.getBoundingClientRect(), to = target?.getBoundingClientRect();
    if (to) {
      const dx = to.left + to.width / 2 - (from.left + from.width / 2), dy = to.top + to.height / 2 - (from.top + from.height / 2);
      art.style.transform = `translate(${dx}px, ${dy}px) scale(0.2) rotate(20deg)`;
    }
    toast.classList.add('out');
    setTimeout(() => { toast.remove(); target?.classList.add('bump'); setTimeout(() => target?.classList.remove('bump'), 500); }, 750);
  }, 2400);
}

const stories = new Map();
const loadStory = id => {
  if (!stories.has(id)) stories.set(id, fetch(`data/${id}.json`).then(r => r.json()));
  return stories.get(id);
};

function howToFind(sticker, scene) {
  if (sticker.earn === 'secret') return `Something is hidden in “${scene.title}”`;
  if (sticker.earn === 'reveal') return `Tap the picture in “${scene.title}”`;
  return `Play with the picture in “${scene.title}”`;
}

// The sticker book: every story's stickers, the ones found and the ones still to find.
export async function openBook({ collection, library, onClose }) {
  if (document.querySelector('.book')) return;   // already open
  const book = document.createElement('div');
  book.className = 'book';
  book.setAttribute('role', 'dialog');
  book.setAttribute('aria-modal', 'true');
  book.setAttribute('aria-label', 'Sticker book');
  const page = document.createElement('div');
  page.className = 'page';
  const close = document.createElement('button');
  close.className = 'close';
  close.setAttribute('aria-label', 'Close the sticker book');
  close.textContent = '×';
  const head = document.createElement('div');
  head.className = 'head';
  head.innerHTML = '<div class="eyebrow">Your collection</div><h2>Sticker Book</h2>';
  page.append(close, head);
  book.append(page);
  document.body.append(book);
  document.body.classList.add('book-open');

  const done = () => {
    book.classList.remove('in');
    document.body.classList.remove('book-open');
    removeEventListener('keydown', onKey, true);
    setTimeout(() => book.remove(), 350);
    onClose?.();
  };
  const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); done(); } };
  addEventListener('keydown', onKey, true);
  close.onclick = done;
  book.addEventListener('click', e => { if (e.target === book) done(); });
  setTimeout(() => book.classList.add('in'), 30);
  close.focus();

  let total = 0, found = 0;
  for (const entry of library.stories) {
    const story = await loadStory(entry.id);
    const section = document.createElement('section');
    const title = document.createElement('h3');
    const count = document.createElement('span');
    title.textContent = story.title;
    title.append(count);
    const lambScenes = story.scenes.filter(sc => sc.lamb);
    if (lambScenes.length) {
      const row = document.createElement('div');
      row.className = 'lambs';
      const got = lambScenes.filter(sc => collection.has(`${entry.id}/lamb:${sc.id}`)).length;
      const label = document.createElement('span');
      label.textContent = `Little lambs found: ${got} of ${lambScenes.length}`;
      row.append(label);
      lambScenes.forEach((sc, i) => row.append(lambEl(40, i < got)));
      section.append(row);
    }
    const grid = document.createElement('div');
    grid.className = 'grid';
    let have = 0, all = 0;
    for (const scene of story.scenes) {
      for (const sticker of scene.stickers ?? []) {
        all++;
        const got = collection.has(`${entry.id}/${sticker.id}`);
        if (got) have++;
        const tile = document.createElement('figure');
        tile.className = got ? 'got' : 'missing';
        const label = document.createElement('figcaption');
        if (got) {
          tile.append(stickerEl(sticker, stickerSrc(scene, sticker), 104));
          label.textContent = sticker.name;
        } else {
          const blank = document.createElement('div');
          blank.className = 'blank';
          blank.textContent = '?';
          tile.append(blank);
          label.textContent = howToFind(sticker, scene);
        }
        tile.append(label);
        grid.append(tile);
      }
    }
    count.textContent = ` · ${have} of ${all}`;
    total += all; found += have;
    section.prepend(title);
    section.append(grid);
    page.append(section);
  }
  head.querySelector('.eyebrow').textContent = `Your collection · ${found} of ${total}`;
}
