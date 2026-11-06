// Little games, one per story at most, always optional: they open over the story from its
// end slide (or from a button on the scene they belong to) and close back to it.
// Each game is described in data/games.json; finishing one earns that story's gold badge.
//
// "pairs" (Two by Two): animals wait in the meadow; tap two that match and they walk up
// the ramp into the ark together. Bring every pair in to win.
// "count" (Count the Stars): ten things are hidden around the picture — `item` is "star",
// "bubble" or "lamb" — and each one tapped is counted out loud.
// Every other kind (Which Day?, Frog Frenzy, Five Smooth Stones…) is in play.js.
//
// Spoken lines (intro, win, "Two lions!") are recorded by scripts/narrate_games.py into
// audio/games/<story>/<key>.m4a; without them the game simply plays silently.

import { PLAY } from './play.js';

const ASPECT = 16 / 9;
const shuffle = list => {
  for (let i = list.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [list[i], list[j]] = [list[j], list[i]]; }
  return list;
};
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const wait = ms => new Promise(r => setTimeout(r, ms));

let names = null;
async function propNames() {
  names ??= fetch('data/props.json').then(r => r.json()).then(d => Object.fromEntries(d.props.map(p => [p.id, p.name])));
  return names;
}

// A game's gold badge, for the win screen and the sticker book.
export function badgeEl(game, px, found = true) {
  const b = el('div', `sticker badge${found ? '' : ' missing'}`);
  Object.assign(b.style, { width: `${px}px`, height: `${px}px` });
  if (game.badge) b.style.backgroundImage = `url("${game.badge}")`;
  else { b.textContent = game.badgeEmoji ?? '★'; b.style.fontSize = `${px * 0.5}px`; b.classList.add('emoji'); }
  b.setAttribute('role', 'img');
  b.setAttribute('aria-label', found ? `${game.title}: done!` : `${game.title}: not played yet`);
  return b;
}

// Opens the game over the story. `sound` is the story's Sound; `onWin` is called the first
// time it's won (to save the badge); `onClose` when the reader goes back to the story.
export async function openGame({ storyId, game, sound, onWin, onClose }) {
  if (document.querySelector('.game')) return;
  const animalNames = await propNames();
  const root = el('div', 'game');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', game.title);
  root.style.backgroundImage = `url("${game.background}")`;
  root.style.backgroundPosition = `${game.frame[0] * 100}% ${game.frame[1] * 100}%`;
  const top = el('div', 'top');
  const title = el('div', 'title');
  title.append(el('div', 'eyebrow', 'Game'), el('h2', '', game.title));
  const progress = el('div', 'progress');
  const close = el('button', 'close');
  close.setAttribute('aria-label', 'Back to the story');
  top.append(title, progress, close);
  const say = el('p', 'say', game.lines.intro);
  const tray = el('div', 'tray');
  root.append(top, say, tray);
  document.body.append(root);
  document.body.classList.add('game-open');
  setTimeout(() => root.classList.add('in'), 30);

  // Spoken lines: short recordings, played straight (no word highlighting needed here).
  const voice = new Audio();
  const speak = key => {
    if (!sound.enabled) return;
    voice.src = `audio/games/${storyId}/${key}.m4a`;
    voice.play().catch(() => {});
  };

  const done = () => {
    run++;
    voice.pause();
    root.classList.remove('in');
    document.body.classList.remove('game-open');
    removeEventListener('keydown', onKey, true);
    setTimeout(() => root.remove(), 350);
    onClose?.();
  };
  const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); done(); } };
  addEventListener('keydown', onKey, true);
  close.onclick = done;

  // Where the ark's door is on screen: the background covers the screen, positioned on `frame`.
  const target = () => {
    const W = root.clientWidth, H = root.clientHeight;
    const pw = Math.max(W, H * ASPECT), ph = pw / ASPECT;
    const x0 = (W - pw) * game.frame[0], y0 = (H - ph) * game.frame[1];
    return { x: x0 + game.target[0] * pw, y: y0 + game.target[1] * ph };
  };

  // Each play of a game gets a fresh field to play on; playing again (or closing) retires the old one.
  let run = 0;
  const start = () => {
    run++;
    root.querySelectorAll('.field, .backdrop, .tally').forEach(n => n.remove());
    tray.replaceChildren();
    if (game.type === 'count') return startCount();
    if (game.type === 'pairs') return startPairs();
    const mine = run, field = el('div', 'field');
    root.append(field);
    const alive = () => mine === run && root.isConnected;
    PLAY[game.type]({
      root, field, game, sound, names: animalNames, alive,
      progress: text => { progress.textContent = text; },
      head: () => say.offsetTop + say.offsetHeight + 8,     // where the words end and the playing room begins
      say: (text, key) => { say.textContent = text; if (key) speak(key); },
      line: key => { say.textContent = game.lines[key] ?? ''; speak(key); },
      win: () => { if (alive()) win(); },
      // A point on the picture (fractions of it) to pixels on the field.
      screen: (px, py) => {
        const W = root.clientWidth, H = root.clientHeight, pw = Math.max(W, H * ASPECT), ph = pw / ASPECT;
        return { x: (W - pw) * game.frame[0] + px * pw, y: (H - ph) * game.frame[1] + py * ph };
      },
      // Fade the background to another painting (the sea parted, the nets full).
      backdrop: src => {
        if (!src) return;
        const b = el('div', 'backdrop');
        b.style.backgroundImage = `url("${src}")`;
        b.style.backgroundPosition = root.style.backgroundPosition;
        const last = [...root.querySelectorAll('.backdrop')].pop();
        if (last) last.after(b); else root.prepend(b);   // each one over the last
        requestAnimationFrame(() => b.classList.add('in'));
      },
      // Calls fn(seconds, secondsSinceLastFrame) every frame while this play lasts.
      loop: fn => {
        let t0 = null, last = 0;
        const frame = now => {
          if (!alive()) return;
          t0 ??= now;
          const t = (now - t0) / 1000;
          fn(t, Math.min(0.05, t - last));
          last = t;
          requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      },
    });
  };

  // ---- Tap and count: ten things around the picture, counted out loud as they're found.
  const startCount = () => {
    tray.replaceChildren();
    root.querySelectorAll('.item').forEach(n => n.remove());
    const total = game.count ?? 10;
    let found = 0;
    progress.textContent = `0 of ${total}`;
    say.textContent = game.lines.intro;
    speak('intro');
    const big = el('div', 'tally', '');
    root.append(big);
    const spots = [];
    const near = (x, y) => spots.some(([a, b]) => Math.hypot(a - x, (b - y) * 0.6) < 0.1);
    for (let i = 0; i < total; i++) {
      let x, y, tries = 0;
      do { x = 0.08 + Math.random() * 0.84; y = 0.26 + Math.random() * 0.56; } while (near(x, y) && ++tries < 40);
      spots.push([x, y]);
      const item = el('button', `item ${game.item}`);
      item.setAttribute('aria-label', `${game.item} ${i + 1}`);
      if (game.item === 'lamb') {
        const img = el('img');
        img.src = 'art/lamb.png';
        img.alt = '';
        if (Math.random() < 0.5) img.style.transform = 'scaleX(-1)';
        item.append(img);
      }
      item.style.left = `${x * 100}%`;
      item.style.top = `${y * 100}%`;
      item.style.setProperty('--delay', `${-Math.random() * 6}s`);
      item.style.setProperty('--size', `${0.8 + Math.random() * 0.5}`);
      item.onclick = () => {
        if (item.classList.contains('got')) return;
        item.classList.add('got');
        found++;
        progress.textContent = `${found} of ${total}`;
        big.textContent = found;
        big.classList.remove('pop');
        void big.offsetWidth;
        big.classList.add('pop');
        speak(`count-${found}`);
        if (game.item === 'bubble') sound.bubble?.(y);
        else if (game.item === 'lamb') sound.baa?.();
        else sound.star?.(y, 1);
        navigator.vibrate?.(10);
        if (found === total) setTimeout(() => { big.remove(); win(); }, 900);
      };
      root.append(item);
    }
  };

  const startPairs = () => {
    tray.replaceChildren();
    const kinds = shuffle([...game.pieces]).slice(0, game.count);
    let left = kinds.length, picked = null, busy = false;
    progress.textContent = `0 of ${kinds.length} pairs`;
    say.textContent = game.lines.intro;
    speak('intro');
    for (const kind of shuffle([...kinds, ...kinds])) {
      const piece = el('button', 'piece');
      piece.setAttribute('aria-label', animalNames[kind] ?? kind);
      const img = el('img');
      img.src = `art/props/${kind}.png`;
      img.alt = '';
      if (Math.random() < 0.5) img.style.transform = 'scaleX(-1)';
      piece.append(img);
      piece.onclick = async () => {
        if (busy || piece.classList.contains('gone')) return;
        if (picked === piece) { piece.classList.remove('picked'); picked = null; return; }
        if (sound.ready) sound.pluck(74 + kinds.indexOf(kind) * 2, sound.ctx.currentTime, 0.08);
        if (!picked) { picked = piece; piece.classList.add('picked'); return; }
        const first = picked;
        picked = null;
        if (first.dataset.kind !== kind) {
          busy = true;
          piece.classList.add('picked');
          await wait(250);
          for (const p of [first, piece]) { p.classList.remove('picked'); p.classList.add('nope'); }
          sound.boop?.();
          await wait(450);
          for (const p of [first, piece]) p.classList.remove('nope');
          busy = false;
          return;
        }
        // A pair! Off they go, up into the ark.
        busy = true;
        piece.classList.add('picked');
        const door = target();
        for (const p of [first, piece]) {
          const r = p.getBoundingClientRect(), box = root.getBoundingClientRect();
          p.style.setProperty('--dx', `${door.x - (r.left - box.left + r.width / 2)}px`);
          p.style.setProperty('--dy', `${door.y - (r.top - box.top + r.height / 2)}px`);
          p.classList.add('gone');
        }
        sound.sticker?.();
        navigator.vibrate?.(15);
        const name = animalNames[kind] ?? kind;
        say.textContent = game.lines.pair.replace('{name}', name);
        speak(`pair-${kind}`);
        left--;
        progress.textContent = `${kinds.length - left} of ${kinds.length} pairs`;
        await wait(700);
        busy = false;
        if (!left) win();
      };
      piece.dataset.kind = kind;
      tray.append(piece);
    }
  };

  const win = async () => {
    const first = onWin?.();
    sound.promise?.();
    confetti(root);
    const card = el('div', 'won');
    const again = el('button', 'begin', 'Play again');
    const back = el('button', 'begin read', 'Back to the story');
    const buttons = el('div', 'starts');
    buttons.append(again, back);
    card.append(badgeEl(game, 120), el('div', 'eyebrow', first ? 'New badge!' : 'Well done!'), el('h3', '', 'You did it!'), el('p', '', game.lines.done ?? game.lines.win), buttons);
    say.textContent = '';
    root.append(card);
    speak('win');
    setTimeout(() => card.classList.add('in'), 30);
    again.onclick = () => { card.remove(); start(); };
    back.onclick = done;
    back.focus();
  };

  start();
  close.focus();
}

// Paper confetti that bursts up and flutters down.
function confetti(root) {
  const COLORS = ['#f0cc8a', '#ee6c8a', '#7cc957', '#6fb7e8', '#f08a4b', '#b48ef0', '#fff3d6'];
  const box = el('div', 'confetti');
  for (let i = 0; i < 70; i++) {
    const bit = el('i');
    bit.style.setProperty('--x', `${(Math.random() - 0.5) * 120}vw`);
    bit.style.setProperty('--y', `${-30 - Math.random() * 60}vh`);
    bit.style.setProperty('--r', `${(Math.random() - 0.5) * 1440}deg`);
    bit.style.setProperty('--d', `${1.6 + Math.random() * 1.4}s`);
    bit.style.background = COLORS[i % COLORS.length];
    bit.style.left = `${45 + Math.random() * 10}%`;
    box.append(bit);
  }
  root.append(box);
  setTimeout(() => box.remove(), 3500);
}
