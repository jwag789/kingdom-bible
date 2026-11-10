// Your Kingdom: a paper meadow that children fill with the people, animals and things from the
// stories they've finished — Noah and the ark, Mary and Joseph, Jonah's great fish — like a
// Sunday-school felt board or a nativity set. Finishing a story unlocks its pieces (cut out by
// scripts/pieces.py); winning Two by Two brings the animals; finding a lamb brings the lamb.
// Pieces still to unlock wait in the tray as shadows. Drag a piece onto the meadow (or tap it
// to drop it in), drag it around, and tap it to make it bigger, smaller, flip it or put it away.
// The kingdom is saved on this device.
//
// Each story also brings a place (data/places.json, made by scripts/places.py): the meadow to
// start with, then Under the Stars, Under the Sea, Bethlehem Hills… Every place keeps its own
// pieces, so moving to another one never sweeps away what was set up in the last.
//
// Pieces are placed in fractions of the meadow's width and height, so the kingdom keeps its
// shape on a phone or a laptop (only the scenery behind it is cropped differently). A piece's
// size `s` is its height, as a fraction of the meadow's shorter side.

import { feel } from './native.js';

const STORE = 'kb:kingdom';
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
// Saved as { place, places: { <place id>: [pieces] } }. Before there were places it was one list (the meadow's).
const load = () => {
  let saved;
  try { saved = JSON.parse(localStorage.getItem(STORE) ?? 'null'); } catch {}
  if (Array.isArray(saved)) return { place: 'meadow', places: { meadow: saved } };
  return saved?.places ? saved : { place: 'meadow', places: {} };
};
const save = store => { try { localStorage.setItem(STORE, JSON.stringify(store)); } catch {} };
// Round buttons get drawn icons: text symbols (−, +, ‹) sit below the middle of a circle.
const icon = d => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const WIDE = /ark|ship|boat|fish|snake/;           // things drawn lying long, not standing tall
const FIRST_ANIMALS = ['lion', 'sheep', 'rabbit', 'giraffe'];   // made on Day 6, so In the Beginning brings them

// Every piece there is, and whether it's unlocked: { id, label, src, size, unlocked, hint }.
export async function kingdomPieces({ library, collection }) {
  const titles = Object.fromEntries(library.stories.map(s => [s.id, s.title]));
  const has = key => collection.has(key);
  const items = [];
  const lambFound = [...collection.got].some(k => k.includes('/lamb:'));
  items.push({ id: 'lamb', label: 'A little lamb', src: 'art/lamb.png', size: 0.13, unlocked: lambFound,
    hint: 'Find a little lamb hiding in a story' });
  const { pieces = [] } = await fetch('data/pieces.json').then(r => r.json(), () => ({}));
  for (const p of pieces) {
    const stories = p.stories.filter(id => titles[id]);
    if (!stories.length) continue;
    items.push({ id: `piece:${p.id}`, label: p.name, src: p.src, size: WIDE.test(p.id) ? 0.24 : 0.34,
      unlocked: stories.some(id => has(`${id}/finished`)), hint: `Finish “${titles[stories[0]]}” to unlock` });
  }
  const { props = [] } = await fetch('data/props.json').then(r => r.json(), () => ({}));
  const twoByTwo = has('noah/game:two-by-two');
  for (const prop of props) {
    const early = FIRST_ANIMALS.includes(prop.id) && has('genesis-1/finished');
    items.push({ id: `prop:${prop.id}`, label: prop.name, src: `art/props/${prop.id}.png`, size: 0.2,
      unlocked: twoByTwo || early, hint: 'Win Two by Two in “Noah’s Ark” to unlock' });
  }
  return items;
}

// Every place there is, and whether it's unlocked: { id, name, src, thumb, unlocked, hint }.
export async function kingdomPlaces({ library, collection }) {
  const titles = Object.fromEntries(library.stories.map(s => [s.id, s.title]));
  const { places = [] } = await fetch('data/places.json').then(r => r.json(), () => ({}));
  return places.filter(p => !p.story || titles[p.story]).map(p => ({
    id: p.id, name: p.name, src: `art/places/${p.id}.jpg`, thumb: `art/places/${p.id}-thumb.jpg`, position: p.position ?? '50% 60%',
    unlocked: !p.story || collection.has(`${p.story}/finished`), hint: p.story ? `Finish “${titles[p.story]}” to unlock` : '',
  }));
}

const cap = t => t[0].toUpperCase() + t.slice(1);

function pieceEl(item, px) {
  const img = el('img', 'cutout');
  img.src = item.src;
  img.alt = item.label;
  img.draggable = false;
  img.style.height = `${px}px`;
  return img;
}

export async function openKingdom({ library, collection, sound, onClose }) {
  if (document.querySelector('.kingdom')) return;
  const [all, places] = await Promise.all([kingdomPieces({ library, collection }), kingdomPlaces({ library, collection })]);
  const items = all.filter(i => i.unlocked);
  const byId = new Map(items.map(i => [i.id, i]));
  const store = load();
  let place = places.find(p => p.id === store.place && p.unlocked) ?? places[0];
  let pieces = (store.places[place.id] ?? []).filter(p => byId.has(p.item));

  const root = el('div', 'kingdom');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Your Kingdom');
  const meadow = el('div', 'meadow');
  const top = el('div', 'top');
  const title = el('div', 'title');
  const eyebrow = el('div', 'eyebrow');
  title.append(eyebrow, el('h2', '', 'Your Kingdom'));
  const where = el('button', 'where');
  where.setAttribute('aria-haspopup', 'true');
  const whereThumb = el('img');
  whereThumb.alt = '';
  const whereName = el('span');
  where.append(whereThumb, whereName);
  const close = el('button', 'close');
  close.setAttribute('aria-label', 'Close Your Kingdom');
  top.append(title, where, close);
  const tray = el('div', 'tray');
  const tools = el('div', 'tools');
  const [smaller, bigger, flip, remove] = ['M6 12h12', 'M12 6v12M6 12h12', 'M9 7l-5 5 5 5M15 7l5 5-5 5M4 12h16', 'M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12M10 11v5M14 11v5']
    .map(d => { const b = el('button'); b.innerHTML = icon(d); return b; });
  smaller.setAttribute('aria-label', 'Smaller'); bigger.setAttribute('aria-label', 'Bigger');
  flip.setAttribute('aria-label', 'Flip'); remove.setAttribute('aria-label', 'Put it away');
  tools.append(smaller, bigger, flip, remove);
  meadow.append(tools);
  root.append(meadow, top, tray);
  document.body.append(root);
  document.body.classList.add('game-open');
  setTimeout(() => root.classList.add('in'), 30);

  const done = () => {
    root.classList.remove('in');
    document.body.classList.remove('game-open');
    removeEventListener('keydown', onKey, true);
    setTimeout(() => root.remove(), 350);
    onClose?.();
  };
  const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); done(); } };
  addEventListener('keydown', onKey, true);
  close.onclick = done;

  const unit = () => Math.min(meadow.clientWidth, meadow.clientHeight);
  const pop = () => { if (sound?.ready) sound.pluck(74 + ((Math.random() * 5) | 0) * 2, sound.ctx.currentTime, 0.07); };

  // ---- Placed pieces
  let selected = null;
  const nodes = new Map();      // piece → element
  function draw(piece) {
    nodes.get(piece)?.remove();
    const item = byId.get(piece.item), px = piece.s * unit();
    const node = el('div', 'placed');
    node.append(pieceEl(item, px));
    node.style.left = `${piece.x * 100}%`;
    node.style.top = `${piece.y * 100}%`;
    node.style.transform = `translate(-50%, -50%) scaleX(${piece.flip ? -1 : 1})`;
    node.classList.toggle('selected', piece === selected);
    node.addEventListener('pointerdown', e => startDrag(e, piece));
    meadow.append(node);
    nodes.set(piece, node);
  }
  const redraw = () => { for (const p of pieces) draw(p); placeTools(); };
  addEventListener('resize', redraw);

  function select(piece) {
    selected = piece;
    for (const [p, n] of nodes) n.classList.toggle('selected', p === piece);
    placeTools();
  }
  function placeTools() {
    tools.classList.toggle('on', !!selected);
    if (!selected) return;
    tools.style.left = `${clamp(selected.x, 0.12, 0.88) * 100}%`;
    tools.style.top = `${clamp(selected.y + selected.s * unit() / meadow.clientHeight / 2 + 0.06, 0.1, 0.92) * 100}%`;
  }
  const commit = () => { store.place = place.id; store.places[place.id] = pieces; save(store); };
  smaller.onclick = () => { selected.s = Math.max(0.06, selected.s * 0.8); draw(selected); placeTools(); commit(); };
  bigger.onclick = () => { selected.s = Math.min(0.9, selected.s * 1.25); draw(selected); placeTools(); commit(); };
  flip.onclick = () => { selected.flip = !selected.flip; draw(selected); commit(); };
  remove.onclick = () => { nodes.get(selected)?.remove(); nodes.delete(selected); pieces = pieces.filter(p => p !== selected); select(null); commit(); };
  meadow.addEventListener('pointerdown', e => { if (e.target === meadow) select(null); });

  // Drag a piece around the meadow; a press that barely moves just selects it.
  function startDrag(e, piece) {
    e.preventDefault();
    e.stopPropagation();
    const box = meadow.getBoundingClientRect(), start = { x: e.clientX, y: e.clientY }, from = { x: piece.x, y: piece.y };
    let moved = false;
    const move = ev => {
      const dx = ev.clientX - start.x, dy = ev.clientY - start.y;
      if (!moved && Math.hypot(dx, dy) < 6) return;
      if (!moved) feel('pick');
      moved = true;
      piece.x = clamp(from.x + dx / box.width, 0.02, 0.98);
      piece.y = clamp(from.y + dy / box.height, 0.02, 0.98);
      const node = nodes.get(piece);
      node.style.left = `${piece.x * 100}%`;
      node.style.top = `${piece.y * 100}%`;
      node.classList.add('lifted');
      placeTools();
    };
    const up = () => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      nodes.get(piece)?.classList.remove('lifted');
      if (moved) { pop(); feel('place'); commit(); }
      select(piece);
    };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
  }

  // ---- The tray: tap to drop a piece into the meadow, or drag it straight to its spot.
  if (!items.length) {
    tray.append(el('p', 'empty', 'Finish a story and its people and things will come to live here — Noah and his ark, Mary and Joseph, Jonah’s great fish!'));
  }
  // Still to unlock: shadows in the tray, with how to earn them.
  const hint = el('p', 'hint'), locked = [];
  for (const item of all.filter(i => !i.unlocked)) {
    const slot = el('button', 'slot locked');
    slot.setAttribute('aria-label', `${cap(item.label)}: ${item.hint}`);
    slot.append(pieceEl(item, 56));
    slot.onclick = () => { hint.textContent = `${cap(item.label)} — ${item.hint}`; hint.classList.add('on'); setTimeout(() => hint.classList.remove('on'), 2600); };
    locked.push(slot);
  }
  root.append(hint);
  for (const item of items) {
    const slot = el('button', 'slot');
    slot.setAttribute('aria-label', `Add ${item.label}`);
    slot.append(pieceEl(item, 56));
    slot.addEventListener('pointerdown', e => {
      e.preventDefault();
      const start = { x: e.clientX, y: e.clientY };
      let piece = null;
      const move = ev => {
        const box = meadow.getBoundingClientRect();
        if (!piece) {
          if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 8) return;
          piece = { item: item.id, x: 0.5, y: 0.5, s: item.size, flip: false };
          pieces.push(piece);
          draw(piece);
          nodes.get(piece).classList.add('lifted');
          feel('pick');
        }
        piece.x = clamp((ev.clientX - box.left) / box.width, 0.02, 0.98);
        piece.y = clamp((ev.clientY - box.top) / box.height, 0.02, 0.98);
        const node = nodes.get(piece);
        node.style.left = `${piece.x * 100}%`;
        node.style.top = `${piece.y * 100}%`;
      };
      const up = () => {
        removeEventListener('pointermove', move);
        removeEventListener('pointerup', up);
        if (!piece) {
          // A tap: drop it somewhere near the middle.
          piece = { item: item.id, x: 0.3 + Math.random() * 0.4, y: 0.45 + Math.random() * 0.3, s: item.size, flip: false };
          pieces.push(piece);
          draw(piece);
        }
        nodes.get(piece)?.classList.remove('lifted');
        pop();
        feel('place');
        commit();
        select(piece);
      };
      addEventListener('pointermove', move);
      addEventListener('pointerup', up);
    });
    tray.append(slot);
  }

  tray.append(...locked);

  // ---- Places: a row of cards to pick where the kingdom is. Each keeps its own pieces.
  const picker = el('div', 'places');
  picker.setAttribute('role', 'menu');
  const cards = new Map();
  for (const p of places) {
    const card = el('button', p.unlocked ? 'place' : 'place locked');
    card.setAttribute('role', 'menuitem');
    card.setAttribute('aria-label', p.unlocked ? p.name : `${p.name}: ${p.hint}`);
    const img = el('img');
    img.src = p.thumb;
    img.alt = '';
    card.append(img, el('span', '', p.name));
    card.onclick = () => {
      if (!p.unlocked) { hint.textContent = `${p.name} — ${p.hint}`; hint.classList.add('on'); setTimeout(() => hint.classList.remove('on'), 2600); return; }
      togglePicker(false);
      if (p !== place) goTo(p);
    };
    cards.set(p, card);
    picker.append(card);
  }
  root.append(picker);
  const togglePicker = on => { picker.classList.toggle('on', on); where.setAttribute('aria-expanded', on); };
  where.onclick = () => togglePicker(!picker.classList.contains('on'));
  meadow.addEventListener('pointerdown', () => togglePicker(false));

  function showPlace() {
    meadow.style.backgroundImage = `url("${place.src}")`;
    meadow.style.backgroundPosition = place.position;
    whereThumb.src = place.thumb;
    whereName.textContent = place.name;
    where.setAttribute('aria-label', `Place: ${place.name}. Choose another place`);
    for (const [p, card] of cards) card.classList.toggle('on', p === place);
    const open = places.filter(p => p.unlocked).length;
    eyebrow.textContent = `${items.length} of ${all.length} pieces · ${open} of ${places.length} places`;
  }
  // Moving to another place: fade out, swap the scenery and its pieces, fade back in.
  function goTo(p) {
    select(null);
    meadow.classList.add('moving');
    setTimeout(() => {
      for (const n of nodes.values()) n.remove();
      nodes.clear();
      place = p;
      pieces = (store.places[place.id] ?? []).filter(x => byId.has(x.item));
      store.place = place.id;
      save(store);
      showPlace();
      redraw();
      meadow.classList.remove('moving');
      pop();
    }, 280);
  }
  showPlace();

  // Wait a frame so the meadow has its size, then place what was saved.
  requestAnimationFrame(redraw);
  setTimeout(redraw, 60);
  close.focus();
}
