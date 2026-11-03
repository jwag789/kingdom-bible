// Your Kingdom: a paper meadow that children fill with the people, animals and things from the
// stories they've finished — Noah and the ark, Mary and Joseph, Jonah's great fish — like a
// Sunday-school felt board or a nativity set. Finishing a story unlocks its pieces (cut out by
// scripts/pieces.py); winning Two by Two brings the animals; finding a lamb brings the lamb.
// Pieces still to unlock wait in the tray as shadows. Drag a piece onto the meadow (or tap it
// to drop it in), drag it around, and tap it to make it bigger, smaller, flip it or put it away.
// The kingdom is saved on this device.
//
// Pieces are placed in fractions of the meadow's width and height, so the kingdom keeps its
// shape on a phone or a laptop (only the scenery behind it is cropped differently). A piece's
// size `s` is its height, as a fraction of the meadow's shorter side.

const STORE = 'kb:kingdom';
const BACKGROUND = 'art/living/meadow.jpg';
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const load = () => { try { return JSON.parse(localStorage.getItem(STORE) ?? '[]'); } catch { return []; } };
const save = pieces => { try { localStorage.setItem(STORE, JSON.stringify(pieces)); } catch {} };
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
  const all = await kingdomPieces({ library, collection });
  const items = all.filter(i => i.unlocked);
  const byId = new Map(items.map(i => [i.id, i]));
  let pieces = load().filter(p => byId.has(p.item));

  const root = el('div', 'kingdom');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Your Kingdom');
  const meadow = el('div', 'meadow');
  meadow.style.backgroundImage = `url("${BACKGROUND}")`;
  const top = el('div', 'top');
  const title = el('div', 'title');
  title.append(el('div', 'eyebrow', `${items.length} of ${all.length} pieces unlocked`), el('h2', '', 'Your Kingdom'));
  const close = el('button', 'close', '×');
  close.setAttribute('aria-label', 'Close Your Kingdom');
  top.append(title, close);
  const tray = el('div', 'tray');
  const tools = el('div', 'tools');
  const [smaller, bigger, flip, remove] = ['−', '+', '⇋', '🗑'].map(t => el('button', '', t));
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
  const commit = () => save(pieces);
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
      if (moved) { pop(); commit(); }
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
        commit();
        select(piece);
      };
      addEventListener('pointermove', move);
      addEventListener('pointerup', up);
    });
    tray.append(slot);
  }

  tray.append(...locked);

  // Wait a frame so the meadow has its size, then place what was saved.
  requestAnimationFrame(redraw);
  setTimeout(redraw, 60);
  close.focus();
}
