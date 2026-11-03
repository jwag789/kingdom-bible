// The reader: the story as a deck of slides — a cover, then for each scene a title slide
// and one slide per beat, then the end. One flick of the wheel or trackpad, one swipe or
// one key press moves exactly one slide; the stage paints the matching scene and beat, the
// sound engine plays that day's ambience and score, and the narrator can read each slide.

import { Stage } from './stage.js';
import { Sound } from './audio.js';
import { Narrator, alignWords } from './narrator.js';
import { Collection, stickerSrc, showToast, openBook } from './stickers.js';
import { buzz, isApp } from './native.js';

// Which story: ?story=noah reads data/noah.json; with none given, the first one.
const asked = new URLSearchParams(location.search).get('story');
const storyId = /^[a-z0-9-]+$/.test(asked ?? '') ? asked : 'genesis-1';
const story = await (await fetch(`data/${storyId}.json`)).json();
const library = await fetch('data/library.json').then(r => r.json(), () => ({ stories: [] }));
document.title = `${story.title} · Kingdom Bible`;

// Installed from the web, it keeps working offline (see sw.js). The store apps carry everything inside already.
if ('serviceWorker' in navigator && !isApp()) navigator.serviceWorker.register('sw.js').catch(() => {});
const text = await (await fetch(story.text)).json();
const verseOf = new Map(text.verses.map(v => [v.ref, v.text]));
const order = text.verses.map(v => v.ref);

const sound = new Sound();
const narrator = new Narrator(sound);
await narrator.load(`audio/${storyId}/narration.json`);

// "1:1"–"1:5" → "Genesis 1:1–5"; "2:1"–"2:3" → "Genesis 2:1–3"
function refLabel([a, b]) {
  const [ca] = a.split(':'), [cb, vb] = b.split(':');
  return `${story.book} ${a}–${ca === cb ? vb : `${cb}:${vb}`}`;
}

// The real verses a scene retells, one tap away.
function sourceFor(s) {
  const details = document.createElement('details');
  details.className = 'source';
  const summary = document.createElement('summary');
  summary.textContent = `Read it in the Bible · ${refLabel(s.verses)}`;
  const verses = document.createElement('div');
  verses.className = 'verses';
  for (let i = order.indexOf(s.verses[0]); i <= order.indexOf(s.verses[1]); i++) {
    const [ch, v] = order[i].split(':');
    const p = document.createElement('p');
    const sup = document.createElement('sup');
    sup.textContent = ch !== '1' && v === '1' ? order[i] : v;
    p.append(sup, verseOf.get(order[i]));
    verses.append(p);
  }
  details.append(summary, verses);
  return details;
}

// A paragraph whose words are separate spans, so they can light up as they're read.
function wordsOf(line) {
  const p = document.createElement('p');
  p.className = 'beat';
  const spans = [], starts = [];
  let at = 0;
  for (const part of line.split(/(\s+)/)) {
    if (/^\s+$/.test(part) || !part) { p.append(part); at += part.length; continue; }
    const span = document.createElement('span');
    span.textContent = part;
    p.append(span);
    spans.push(span);
    starts.push(at);
    at += part.length;
  }
  return { p, spans, starts };
}

// ---- Build the deck
const $ = id => document.getElementById(id);
const deck = $('deck');
// Each slide: { el, scene, beat (story-wide; before a scene's first beat on its title), at (0..1 through
// the scene), scrim, key + say (what the narrator reads), words (spans for highlighting) }
const slides = [];
const firstBeat = [];

function addSlide(kind, info, fill) {
  const el = document.createElement('section');
  el.className = `slide ${kind} below`;
  const col = document.createElement('div');
  col.className = 'col';
  el.append(col);
  deck.append(el);
  const slide = { el, kind, ...info };
  fill(col, slide);
  slides.push(slide);
}
const node = (tag, cls, txt) => { const n = document.createElement(tag); n.className = cls; n.textContent = txt; return n; };

addSlide('cover', { scene: 0, beat: -1, at: 0, scrim: 0.9, key: 'cover', say: `${story.title}.` }, col => {
  const buttons = node('div', 'starts', '');
  buttons.append(node('button', 'begin', 'Begin'), node('button', 'begin read', 'Read it to me'));
  col.append(node('div', 'kicker', story.reference), node('h1', '', story.title), node('div', 'sub', story.subtitle), buttons);
  // The other stories, one tap away.
  const others = library.stories.filter(s => s.id !== storyId);
  if (others.length) {
    const more = node('div', 'more', '');
    more.append(node('span', '', 'More stories'));
    for (const other of others) {
      const link = node('a', '', other.title);
      link.href = `?story=${other.id}`;
      more.append(link);
    }
    col.append(more);
  }
});

let beats = 0;
story.scenes.forEach((s, si) => {
  firstBeat[si] = beats;
  const n = s.beats.length + 1;
  addSlide('title', { scene: si, beat: beats - 1, at: 0, scrim: 0.55, key: `${s.id}-title`, say: `${s.eyebrow}. ${s.title}.` },
    col => col.append(node('div', 'eyebrow', s.eyebrow), node('h2', '', s.title)));
  s.beats.forEach((line, bi) => {
    addSlide('beat', { scene: si, beat: beats, at: (bi + 1) / n, scrim: 1, key: `${s.id}-${bi}`, say: line }, (col, slide) => {
      const { p, spans, starts } = wordsOf(line);
      const entry = narrator.manifest[slide.key];
      slide.words = { spans, starts, times: entry ? alignWords(spans, entry.words) : null };
      col.append(node('div', 'eyebrow mini', `${s.eyebrow} · ${s.title}`), p);
      if (bi === s.beats.length - 1) col.append(sourceFor(s));
    });
    beats++;
  });
});
addSlide('end', { scene: story.scenes.length - 1, beat: beats - 1, at: 1, scrim: 0.9 }, col => {
  const next = story.next;
  if (next) {
    col.append(node('div', 'eyebrow', 'Next'), node('h2', '', next.title), node('p', 'sub', next.sub));
    if (next.story) {
      const go = node('a', 'begin', `Read ${next.title}`);
      go.href = `?story=${next.story}`;
      const starts = node('div', 'starts', '');
      starts.append(go);
      col.append(starts);
    }
  } else {
    col.append(node('div', 'eyebrow', 'The End'), node('h2', '', story.title));
  }
  col.append(node('p', 'credit', `Retold from the ${text.translation.replace(' (public domain)', '')}, which is in the public domain. ` +
    'Narration voice: Kokoro (open source). Sounds and music are made live in your browser.'));
});

// Day dots: one per scene, to see where you are and jump to a day.
const dots = $('dots');
const titleSlide = si => slides.findIndex(sl => sl.scene === si && sl.kind === 'title');
story.scenes.forEach((s, si) => {
  const b = document.createElement('button');
  b.setAttribute('aria-label', s.eyebrow);
  b.title = s.eyebrow;
  b.onclick = () => go(titleSlide(si));
  dots.append(b);
});

// ---- Sound and reading aloud
const stage = new Stage($('stage'), story, (si, beat) => firstBeat[si] + beat, $('hint'));
let readAloud = (() => { try { return localStorage.getItem('kb:read') === '1'; } catch { return false; } })();
let advanceTimer = null;

function setReadAloud(on) {
  readAloud = on;
  try { localStorage.setItem('kb:read', on ? '1' : '0'); } catch {}
  $('read').setAttribute('aria-pressed', on);
  if (on) { setSound(true); narrate(); } else { advanceIn(null); narrator.stop(); }
}
function setSound(on) {
  sound.setEnabled(on);
  $('sound').setAttribute('aria-pressed', on);
  if (!on && readAloud) setReadAloud(false);
}
$('sound').onclick = () => { sound.unlock(); setSound(!sound.enabled); };
$('read').onclick = () => { sound.unlock(); setReadAloud(!readAloud); };
$('sound').setAttribute('aria-pressed', sound.enabled);
$('read').setAttribute('aria-pressed', readAloud);

// The pending page turn in read-aloud mode, if any (null cancels it).
function advanceIn(ms) {
  clearTimeout(advanceTimer);
  advanceTimer = ms == null ? null : setTimeout(() => { advanceTimer = null; next(); }, ms);
}

// Read the current slide; in read-aloud mode, turn the page after a pause.
function narrate() {
  advanceIn(null);
  narrator.stop();
  const sl = slides[index];
  if (!readAloud || !sound.ready || !sl.say) return;
  narrator.play(sl.key, sl.say, () => {
    if (!readAloud || index === slides.length - 1) return;
    const waitingForTap = !!stage.waiting;
    advanceIn(sl.kind === 'title' ? 1400 : waitingForTap ? 8000 : 2200);
  });
  narrator.preload(slides[index + 1]?.key);
}

// Browsers only allow sound after the reader does something; the first press starts it.
let unlocked = false;
const unlock = () => {
  sound.unlock();
  if (unlocked) return;
  unlocked = true;
  // Give the audio context a moment to start, then pick up where we are.
  setTimeout(() => { applySound(); narrate(); }, 60);
};
for (const type of ['pointerdown', 'keydown', 'touchend']) addEventListener(type, unlock, { capture: true });

function applySound() {
  const s = story.scenes[slides[index].scene];
  sound.setAmbience(s.sound?.ambience ?? []);
}

// ---- Stickers: one for playing with each scene, more for its hidden secrets.
const collection = new Collection();
const bookButton = $('stickers');
const showCount = () => { bookButton.querySelector('.count').textContent = collection.size || ''; };
showCount();
function earn(si, sticker) {
  if (!sticker || !collection.add(`${storyId}/${sticker.id}`)) return false;
  sound.sticker();
  buzz('MEDIUM');
  showToast(sticker, stickerSrc(story.scenes[si], sticker), bookButton);
  setTimeout(showCount, 3100);
  return true;
}
const stickersOf = (si, earnBy) => (story.scenes[si].stickers ?? []).filter(k => k.earn === earnBy);
stage.onSecret = (si, secret) => earn(si, secret);
bookButton.onclick = () => {
  narrator.stop();
  clearTimeout(advanceTimer);
  openBook({ collection, library, onClose: () => { bookButton.focus(); narrate(); } });
};

stage.onEvent = (kind, e) => {
  const si = slides[index].scene;
  if (kind === 'reveal') {
    e.layer.sfx === 'promise' ? sound.promise() : sound.lightBurst();
    buzz('HEAVY');
    if (e.tapped) setTimeout(() => earn(si, stickersOf(si, 'reveal').find(k => k.layer === e.layer.id)), 1600);
    return;
  }
  setTimeout(() => earn(si, stickersOf(si, 'play')[0]), 900);
  const play = {
    lift: () => sound.lift(),
    sprout: () => sound.sprout(e.x),
    starmaker: () => sound.star(e.y, e.spec.sky ?? 0.56),
    leap: () => sound.leap(e.y > (e.spec.water ?? 0.5)),
    flutter: () => sound.flutter(),
    gather: () => sound.gather(),
    hammer: () => sound.hammer(),
    lightning: () => sound.thunder(),
    dove: () => sound.dove(),
  }[e.type];
  play?.();
  buzz(e.type === 'lightning' ? 'HEAVY' : 'LIGHT');
  if (readAloud && advanceTimer) advanceIn(4000);  // they're playing after the reading ended: wait
};

// ---- Moving between slides
let index = 0;
let changedAt = -Infinity;

function go(to) {
  to = Math.max(0, Math.min(slides.length - 1, to));
  if (to === index && slides[to].el.classList.contains('on')) return false;
  const sceneChanged = slides[to].scene !== slides[index].scene;
  index = to;
  slides.forEach((sl, i) => {
    sl.el.classList.toggle('on', i === to);
    sl.el.classList.toggle('above', i < to);
    sl.el.classList.toggle('below', i > to);
    if (i !== to) sl.el.querySelector('details')?.removeAttribute('open');
  });
  [...dots.children].forEach((d, si) => d.classList.toggle('on', si === slides[to].scene && to > 0));
  $('prev').disabled = to === 0;
  $('next').disabled = to === slides.length - 1;
  document.body.classList.toggle('at-cover', to === 0);
  changedAt = performance.now();
  history.replaceState(null, '', `#${to}`);

  sound.turn();
  if (slides[to].kind === 'title') sound.arrive();
  if (sceneChanged || !unlocked) applySound();
  narrate();
  return true;
}
const next = () => go(index + 1);
const prev = () => go(index - 1);
$('next').onclick = next;
$('prev').onclick = prev;
deck.querySelector('.begin:not(.read)').onclick = () => { setReadAloud(false); next(); };
deck.querySelector('.begin.read').onclick = () => { readAloud = true; setReadAloud(true); next(); };

// Wheel and trackpad: one gesture moves one slide. A trackpad keeps sending events for a
// second or more after a flick, so a new move needs a short pause in the events first —
// timed by when the events happened, not when they're handled, so a busy moment can't fake
// a pause, and a pause in a still-fading flick (smaller deltas than before) doesn't count.
const SETTLE_MS = 650, GESTURE_GAP_MS = 160, NEW_GESTURE_MS = 600;
let lastWheel = -Infinity, lastSize = 0, wheelSum = 0, spent = false;
const scrollsInside = (el, dy) => el && (dy > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0);
const bookOpen = () => document.body.classList.contains('book-open');
addEventListener('wheel', e => {
  if (e.ctrlKey || bookOpen()) return;                            // pinch-zoom, or reading the sticker book
  if (scrollsInside(e.target.closest?.('.verses'), e.deltaY)) return; // let the verse list scroll
  e.preventDefault();
  const now = e.timeStamp, gap = now - lastWheel, size = Math.abs(e.deltaY);
  const fading = spent && size < lastSize;
  if (gap > NEW_GESTURE_MS || (gap > GESTURE_GAP_MS && !fading)) { spent = false; wheelSum = 0; }
  lastWheel = now;
  lastSize = size;
  if (spent || now - changedAt < SETTLE_MS) return;
  wheelSum += e.deltaY;
  if (Math.abs(wheelSum) > 28) {
    if (wheelSum > 0 ? next() : prev()) spent = true;
    wheelSum = 0;
  }
}, { passive: false });

addEventListener('keydown', e => {
  if (e.altKey || e.metaKey || e.ctrlKey || bookOpen()) return;
  const onControl = e.target.closest?.('a, button, summary, input, textarea');
  const forward = ['ArrowDown', 'ArrowRight', 'PageDown'].includes(e.key) || (e.key === ' ' && !e.shiftKey && !onControl);
  const back = ['ArrowUp', 'ArrowLeft', 'PageUp'].includes(e.key) || (e.key === ' ' && e.shiftKey && !onControl);
  if (forward) next();
  else if (back) prev();
  else if (e.key === 'Home') go(0);
  else if (e.key === 'End') go(slides.length - 1);
  else return;
  e.preventDefault();
});

// Swipes: up for the next slide, down for the previous one.
let touchStart = null;
addEventListener('touchstart', e => {
  const t = e.touches[0];
  touchStart = e.touches.length === 1 && !bookOpen() && !e.target.closest?.('.verses') ? { x: t.clientX, y: t.clientY } : null;
}, { passive: true });
addEventListener('touchend', e => {
  if (!touchStart) return;
  const t = e.changedTouches[0], dy = touchStart.y - t.clientY, dx = touchStart.x - t.clientX;
  touchStart = null;
  if (Math.abs(dy) > 45 && Math.abs(dy) > Math.abs(dx)) dy > 0 ? next() : prev();
});

// ---- Follow along
const scrim = $('scrim');
let scrimAlpha = 1, at = 0;
const start = parseInt(location.hash.slice(1), 10);
go(Number.isFinite(start) ? start : 0);

// Light up the words as the narrator says them.
let lit = null;
function highlight() {
  const sl = slides[index], w = narrator.where();
  const words = sl.words;
  if (lit && lit !== words) { lit.spans.forEach(s => s.className = ''); lit.spans[0]?.parentElement.classList.remove('reading'); lit = null; }
  if (!words || !w || w.key !== sl.key) {
    if (lit) { lit.spans.forEach(s => s.className = ''); lit.spans[0]?.parentElement.classList.remove('reading'); lit = null; }
    return;
  }
  lit = words;
  words.spans[0]?.parentElement.classList.add('reading');
  words.spans.forEach((span, i) => {
    let state = '';
    if (w.words && words.times) {
      const t = words.times[i];
      if (t) state = w.time >= t[1] ? 'said' : w.time >= t[0] - 0.05 ? 'saying' : '';
      else state = i > 0 && words.spans[i - 1].className === 'said' ? 'said' : '';
    } else if (w.char >= 0) {
      state = words.starts[i] < w.char ? 'said' : words.starts[i] === w.char ? 'saying' : '';
    }
    if (span.className !== state) span.className = state;
  });
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  // Capped generously so animations keep real-world timing even when frames are slow.
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  const sl = slides[index];
  const k = 1 - Math.exp(-dt * 1.2);
  at += (sl.at - at) * k;                           // the camera drifts gently through each scene
  scrimAlpha += (sl.scrim - scrimAlpha) * (1 - Math.exp(-dt * 2));
  scrim.style.opacity = scrimAlpha.toFixed(3);
  stage.set(sl.scene, sl.beat, at);
  stage.frame(now / 1000, dt);

  // The score follows the picture: a layer can carry its own mood (Day 1's light brings the dawn).
  const scene = stage.scenes[sl.scene], data = story.scenes[sl.scene];
  const lifted = scene.layers.find(l => l.mood && l.reveal > 0.5);
  sound.setMood(lifted?.mood ?? data.sound?.mood);
  highlight();
}
requestAnimationFrame(frame);
