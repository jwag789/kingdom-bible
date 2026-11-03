// Your Kingdom: a paper meadow that children decorate with everything they've collected —
// stickers, the little lambs they found, game badges, and (after winning Two by Two) the paper
// animals. Drag pieces from the tray onto the meadow, drag them around, and tap one to make it
// bigger, smaller, flip it or put it away. The kingdom is saved on this device.
//
// Pieces are placed in fractions of the meadow's width and height, so the kingdom keeps its
// shape on a phone or a laptop (only the scenery behind it is cropped differently).

import { stickerEl, stickerSrc } from './stickers.js';
import { badgeEl } from './games.js';

const STORE = 'kb:kingdom';
const BACKGROUND = 'art/living/meadow.jpg';
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const load = () => { try { return JSON.parse(localStorage.getItem(STORE) ?? '[]'); } catch { return []; } };
const save = pieces => { try { localStorage.setItem(STORE, JSON.stringify(pieces)); } catch {} };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Everything this child has collected, as things that can be placed: { id, kind, make(px) }.
async function collectedItems({ library, collection, games }) {
  const items = [];
  const props = await fetch('data/props.json').then(r => r.json(), () => ({ props: [] }));
  for (const entry of library.stories) {
    const story = await fetch(`data/${entry.id}.json`).then(r => r.json());
    for (const scene of story.scenes) {
      for (const sticker of scene.stickers ?? []) {
        if (!collection.has(`${entry.id}/${sticker.id}`)) continue;
        const src = stickerSrc(scene, sticker);
        items.push({ id: `sticker:${entry.id}/${sticker.id}`, label: sticker.name, make: px => stickerEl(sticker, src, px) });
      }
      if (scene.lamb && collection.has(`${entry.id}/lamb:${scene.id}`)) {
        items.push({ id: `lamb:${entry.id}/${scene.id}`, label: 'A little lamb', cutout: 'art/lamb.png' });
      }
    }
    const game = games[entry.id];
    if (game && collection.has(`${entry.id}/game:${game.id}`)) {
      items.push({ id: `badge:${entry.id}`, label: game.title, make: px => badgeEl(game, px) });
      // Winning Two by Two brings the animals to your kingdom.
      if (game.type === 'pairs') {
        for (const kind of game.pieces) {
          const prop = props.props.find(p => p.id === kind);
          items.push({ id: `prop:${kind}`, label: prop?.name ?? kind, cutout: `art/props/${kind}.png` });
        }
      }
    }
  }
  return items;
}

// A placed or tray piece: a round sticker or badge, or a cut-out (lamb, animals) as a picture.
function pieceEl(item, px) {
  if (item.cutout) {
    const img = el('img', 'cutout');
    img.src = item.cutout;
    img.alt = item.label;
    img.draggable = false;
    img.style.width = `${px}px`;
    return img;
  }
  const node = item.make(px);
  node.style.transform = 'none';
  return node;
}

export async function openKingdom({ library, collection, games, sound, onClose }) {
  if (document.querySelector('.kingdom')) return;
  const items = await collectedItems({ library, collection, games });
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
  title.append(el('div', 'eyebrow', `${items.length} treasure${items.length === 1 ? '' : 's'} collected`), el('h2', '', 'Your Kingdom'));
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
  bigger.onclick = () => { selected.s = Math.min(0.6, selected.s * 1.25); draw(selected); placeTools(); commit(); };
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
    tray.append(el('p', 'empty', 'Read the stories, find stickers and little lambs, and play the games — everything you collect will appear here, ready for your kingdom!'));
  }
  for (const item of items) {
    const slot = el('button', 'slot');
    slot.setAttribute('aria-label', `Add ${item.label}`);
    slot.append(pieceEl(item, 58));
    slot.addEventListener('pointerdown', e => {
      e.preventDefault();
      const start = { x: e.clientX, y: e.clientY };
      let piece = null;
      const move = ev => {
        const box = meadow.getBoundingClientRect();
        if (!piece) {
          if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 8) return;
          piece = { item: item.id, x: 0.5, y: 0.5, s: item.cutout ? 0.22 : 0.16, flip: false };
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
          piece = { item: item.id, x: 0.35 + Math.random() * 0.3, y: 0.35 + Math.random() * 0.3, s: item.cutout ? 0.22 : 0.16, flip: false };
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

  // Wait a frame so the meadow has its size, then place what was saved.
  requestAnimationFrame(redraw);
  setTimeout(redraw, 60);
  close.focus();
}
