// The reader: the story as a deck of slides — a cover, then for each scene a title slide
// and one slide per beat, then the end. One flick of the wheel or trackpad, one swipe or
// one key press moves exactly one slide; the stage paints the matching scene and beat, the
// sound engine plays that day's ambience and score, and the narrator can read each slide.

import { Stage } from './stage.js';
import { Sound } from './audio.js';
import { Narrator, alignWords } from './narrator.js';
import { Collection, stickerSrc, showToast, showLambToast, showPiecesToast, showPlaceToast, openBook } from './stickers.js';
import { buzz, isApp } from './native.js';
import { openGame } from './games.js';
import { voices, voicesFor, chosenVoice, chooseVoice, getClip } from './voices.js';
import { receiveVoice } from './cloud.js';
import { openRecorder } from './recorder.js';

// Which story: ?story=noah reads data/noah.json; with none given, the first one.
const asked = new URLSearchParams(location.search).get('story');
const storyId = /^[a-z0-9-]+$/.test(asked ?? '') ? asked : 'genesis-1';
const story = await (await fetch(`data/${storyId}.json`)).json();
const library = await fetch('data/library.json').then(r => r.json(), () => ({ stories: [] }));
const games = await fetch('data/games.json').then(r => r.json(), () => ({}));
const game = games[storyId];
// A button that opens the story's little game (it's always optional).
const gameButton = cls => {
  const b = document.createElement('button');
  b.className = `begin ${cls}`;
  b.textContent = `Play: ${game.title}`;
  b.onclick = () => playGame();
  return b;
};
document.title = `${story.title} · Kingdom Bible`;

// Installed from the web, it keeps working offline (see sw.js). The store apps carry everything inside already.
if ('serviceWorker' in navigator && !isApp()) navigator.serviceWorker.register('sw.js').catch(() => {});
const text = await (await fetch(story.text)).json();
const verseOf = new Map(text.verses.map(v => [v.ref, v.text]));
const order = text.verses.map(v => v.ref);

const sound = new Sound();
const narrator = new Narrator(sound);
await narrator.load(`audio/${storyId}/narration.json`);

// ---- Family voices: a link like ?story=noah&voice=<id> brings a shared recording to this device.
// Only the id itself: a share sheet's "Copy" can glue the message ("Dad reads “Noah's Ark” 🎧") onto the end.
const sharedVoice = (new URLSearchParams(location.search).get('voice') ?? '').match(/^[a-z0-9]{8,40}/i)?.[0].toLowerCase() ?? null;
const received = sharedVoice ? await receiveVoice(sharedVoice, storyId).catch(() => null) : null;
if (received) {
  chooseVoice(storyId, sharedVoice);
  // Tidy the address bar, so copying it from here passes on a clean link.
  try { history.replaceState(null, '', `?story=${storyId}&voice=${sharedVoice}${location.hash}`); } catch {}
}
let clipUrls = {};
async function useVoice(voiceId) {
  chooseVoice(storyId, voiceId);
  Object.values(clipUrls).forEach(u => u.startsWith('blob:') && URL.revokeObjectURL(u));
  clipUrls = {};
  const voice = voices().find(v => v.id === voiceId);
  if (voice?.remote) clipUrls = { ...(voice.urls?.[storyId] ?? {}) };
  else if (voice) {
    for (const key of voice.stories?.[storyId] ?? []) {
      const blob = await getClip(voice.id, storyId, key).catch(() => null);
      if (blob) clipUrls[key] = URL.createObjectURL(blob);
    }
  }
  narrator.custom = key => clipUrls[key] ?? null;
  showVoices();
}
await useVoice(chosenVoice(storyId));

// A verse reference: "1:5" (in the story's book) or "Luke 2:7" (a story drawing on more than one book).
function parseRef(ref) {
  const [, book, ch, v] = /^(?:(.+) )?(\d+):(\d+)$/.exec(ref);
  return { book: book ?? story.book, ch, v };
}

// "1:1"–"1:5" → "Genesis 1:1–5"; "2:1"–"2:3" → "Genesis 2:1–3"; "Luke 2:8"–"Luke 2:14" → "Luke 2:8–14"
function refLabel([a, b]) {
  const from = parseRef(a), to = parseRef(b);
  return `${from.book} ${from.ch}:${from.v}–${from.ch === to.ch ? to.v : `${to.ch}:${to.v}`}`;
}

// The real verses a scene retells, one tap away. They open in a panel of their own over the
// picture, so the story's words stay put, with a close button (or Escape, or a tap outside).
function sourceFor(s) {
  const source = document.createElement('div');
  source.className = 'source';
  const toggle = document.createElement('button');
  toggle.className = 'toggle';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.textContent = `Read it in the Bible · ${refLabel(s.verses)}`;
  toggle.onclick = () => showVerses(source, !source.classList.contains('open'));
  const verses = document.createElement('div');
  verses.className = 'verses';
  for (let i = order.indexOf(s.verses[0]); i <= order.indexOf(s.verses[1]); i++) {
    const { ch, v } = parseRef(order[i]);
    const p = document.createElement('p');
    const sup = document.createElement('sup');
    sup.textContent = ch !== '1' && v === '1' ? `${ch}:${v}` : v;
    p.append(sup, verseOf.get(order[i]));
    verses.append(p);
  }
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.hidden = true;
  source.sheet = sheet;
  const head = document.createElement('div');
  head.className = 'sheethead';
  const ref = document.createElement('span');
  ref.textContent = refLabel(s.verses);
  const close = document.createElement('button');
  close.className = 'shut';
  close.setAttribute('aria-label', 'Close the Bible verses');
  close.onclick = () => { showVerses(source, false); toggle.focus(); };
  head.append(ref, close);
  sheet.append(head, verses);
  source.append(toggle);
  return source;
}
function showVerses(source, on) {
  const { sheet } = source;
  // The panel sits on the slide itself, over everything on it, rather than among the words.
  if (on && !sheet.isConnected) source.closest('.slide').append(sheet);
  source.classList.toggle('open', on);
  sheet.hidden = !on;
  document.body.classList.toggle('verses-open', on);
  source.querySelector('.toggle').setAttribute('aria-expanded', String(on));
  if (on) sheet.querySelector('.verses').scrollTop = 0;
}
const versesOpen = () => slides[index].el.querySelector('.source.open');
const inVerses = (source, node) => source && (source.contains(node) || source.sheet.contains(node));

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
// A small round-cornered button with a line icon in front of its words.
const ICONS = {
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/></svg>',
  shelf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/></svg>',
};
const iconButton = (tag, cls, icon, txt) => { const n = node(tag, `soft ${cls}`, ''); n.innerHTML = ICONS[icon]; n.append(node('span', '', txt)); return n; };

addSlide('cover', { scene: 0, beat: -1, at: 0, scrim: 0.9, key: 'cover', say: `${story.title}.` }, col => {
  const buttons = node('div', 'starts', '');
  buttons.append(node('button', 'begin', 'Begin'), node('button', 'begin read', 'Read it to me'));
  col.append(node('div', 'kicker', story.reference), node('h1', '', story.title), node('div', 'sub', story.subtitle), buttons);
  // Who reads it: the narrator, or someone in the family who recorded it; and recording your own.
  const readBy = node('div', 'read-by', '');
  readBy.id = 'read-by';
  col.append(readBy);
  // Back to the Stories page.
  const all = iconButton('a', 'all-stories', 'shelf', 'All stories');
  all.href = './';
  col.append(all);
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
      if (bi === s.beats.length - 1 && game?.scene === s.id) col.append(gameButton('play-game'));
      if (bi === s.beats.length - 1) col.append(sourceFor(s));
    });
    beats++;
  });
});
// "Talk about it": a few questions for the family and a memory verse, before the last page.
// What the narrator says here must match talkText() in scripts/narrate.py.
if (story.talk) {
  const { questions, verse } = story.talk;
  const [, vBook, vCh, vV] = /^(.+) (\d+):(\d+)$/.exec(verse.ref);
  const say = `Let’s talk about it. ${questions.join(' ')} Our memory verse is ${vBook} ${vCh}, verse ${vV}. ${verse.text.replaceAll('LORD', 'Lord')}`;
  addSlide('talk', { scene: story.scenes.length - 1, beat: beats - 1, at: 1, scrim: 0.95, key: 'talk', say }, col => {
    const list = node('ol', 'questions', '');
    for (const q of questions) list.append(node('li', '', q));
    const card = node('figure', 'memory', '');
    const words = node('blockquote', '', '');
    // "LORD" is printed in small capitals, as Bibles do.
    for (const [i, part] of verse.text.split('LORD').entries()) {
      if (i) words.append(node('span', 'lord', 'Lord'));
      words.append(part);
    }
    card.append(node('div', 'eyebrow', 'Memory verse'), words, node('figcaption', '', verse.ref));
    col.append(node('div', 'eyebrow', 'Talk about it'), node('h2', '', 'Let’s talk about it'), list, card);
  });
}

addSlide('end', { scene: story.scenes.length - 1, beat: beats - 1, at: 1, scrim: 0.9 }, col => {
  const next = story.next;
  if (next) {
    col.append(node('div', 'eyebrow', 'Next'), node('h2', '', next.title), node('p', 'sub', next.sub));
    if (next.story) {
      const go = node('a', 'begin', `Read ${next.title}`);
      go.href = `?story=${next.story}`;
      const starts = node('div', 'starts', '');
      if (game) starts.append(gameButton('read'));
      starts.append(go);
      col.append(starts);
    }
    const all = iconButton('a', 'all-stories', 'shelf', 'All stories');
    all.href = './';
    col.append(all);
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

// The "Read by" choices on the cover.
function showVoices() {
  const box = document.getElementById('read-by');
  if (!box) return;
  box.replaceChildren();
  if (received) box.append(node('p', 'welcome', `🎧 ${received.name} recorded this story for you!`));
  const current = chosenVoice(storyId);
  const choice = (label, id) => {
    const b = node('button', `chip${(current ?? null) === id ? ' on' : ''}`, label);
    b.setAttribute('aria-pressed', (current ?? null) === id);
    b.onclick = async () => { await useVoice(id); if (readAloud) narrate(); };
    return b;
  };
  const mine = voicesFor(storyId);
  if (mine.length) {
    box.append(node('span', 'label', 'Read by'), choice('The narrator', null));
    for (const v of mine) box.append(choice(v.name, v.id));
  }
  const record = iconButton('button', 'record', 'mic', mine.some(v => !v.remote) ? 'Record more' : 'Read it in your own voice');
  record.onclick = () => {
    narrator.stop();
    clearTimeout(advanceTimer);
    const pages = slides.filter(sl => sl.say).map(sl => ({ key: sl.key, say: sl.say,
      label: sl.kind === 'cover' ? 'The cover' : `${story.scenes[sl.scene].eyebrow} · ${story.scenes[sl.scene].title}` }));
    openRecorder({ story, storyId, pages, sound, onClose: async id => { if (id) await useVoice(id); else showVoices(); } });
  };
  box.append(record);
}

// Bedtime: calmer pictures, softer music, read aloud with longer pauses, and at the end of the
// story the screen and the sound fade away to "Goodnight".
let bedtime = (() => { try { return localStorage.getItem('kb:bedtime') === '1'; } catch { return false; } })();
function setBedtime(on) {
  bedtime = on;
  try { localStorage.setItem('kb:bedtime', on ? '1' : '0'); } catch {}
  $('bedtime').setAttribute('aria-pressed', on);
  document.body.classList.toggle('bedtime', on);
  sound.setSoft(on);
  if (on && !readAloud) setReadAloud(true);
  if (!on) { document.body.classList.remove('goodnight'); sound.wake(); }
}
function goodnight() {
  document.body.classList.add('goodnight');
  sound.sleep();
}
// A tap on the goodnight screen wakes the story back up.
addEventListener('pointerdown', e => {
  if (!document.body.classList.contains('goodnight') || e.target !== document.body) return;
  document.body.classList.remove('goodnight');
  sound.wake();
}, true);

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
$('bedtime').onclick = () => { sound.unlock(); setBedtime(!bedtime); };
$('sound').setAttribute('aria-pressed', sound.enabled);
$('read').setAttribute('aria-pressed', readAloud);
$('bedtime').setAttribute('aria-pressed', bedtime);
document.body.classList.toggle('bedtime', bedtime);
sound.setSoft(bedtime);

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
    // A title moves on quickly; "Talk about it" leaves time to talk.
    const pause = sl.kind === 'title' ? 1400 : sl.kind === 'talk' ? 9000 : waitingForTap ? 8000 : 2200;
    advanceIn(bedtime ? pause * 1.8 : pause);
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
// The little lamb: every tap gets a "baa"; the first in each scene counts toward finding them all.
const lambScenes = story.scenes.filter(sc => sc.lamb);
stage.onLamb = si => {
  sound.baa();
  buzz('LIGHT');
  if (!collection.add(`${storyId}/lamb:${story.scenes[si].id}`)) return;
  const found = lambScenes.filter(sc => collection.has(`${storyId}/lamb:${sc.id}`)).length;
  setTimeout(() => sound.sticker(), 350);
  showLambToast(found, lambScenes.length, bookButton);
  setTimeout(showCount, 3100);
};
bookButton.onclick = () => {
  narrator.stop();
  clearTimeout(advanceTimer);
  openBook({ collection, library, games, onClose: () => { bookButton.focus(); narrate(); } });
};

async function unlockPieces() {
  const [{ pieces = [] }, { places = [] }] = await Promise.all(['data/pieces.json', 'data/places.json'].map(f => fetch(f).then(r => r.json(), () => ({}))));
  const place = places.find(p => p.story === storyId);
  const mine = pieces.filter(p => p.stories.includes(storyId));
  if (storyId === 'genesis-1') {
    const { props = [] } = await fetch('data/props.json').then(r => r.json(), () => ({}));
    for (const id of ['lion', 'sheep', 'rabbit', 'giraffe']) {
      const prop = props.find(p => p.id === id);
      if (prop) mine.push({ name: prop.name, src: `art/props/${id}.png` });
    }
  }
  if (mine.length) setTimeout(() => { sound.sticker(); showPiecesToast(mine, bookButton); }, 1200);
  if (place) setTimeout(() => { sound.sticker(); showPlaceToast(place, bookButton); }, mine.length ? 4600 : 1200);
}

function playGame() {
  sound.unlock();
  narrator.stop();
  clearTimeout(advanceTimer);
  const key = `${storyId}/game:${game.id}`;
  collection.add(`${storyId}/game-unlocked:${game.id}`);   // from now on it's on the Stories page too
  openGame({ storyId, game, sound, onWin: () => { const first = collection.add(key); showCount(); return first; }, onClose: () => narrate() });
}

stage.onEvent = (kind, e) => {
  const si = slides[index].scene;
  if (kind === 'reveal') {
    ({ promise: () => sound.promise(), choir: () => sound.glory(), gulp: () => sound.gulp(), grow: () => sound.grow(),
      flame: () => sound.flame(), part: () => sound.partSea(), hiss: () => sound.hiss() }[e.layer.sfx]
      ?? (() => sound.lightBurst()))();
    buzz('HEAVY');
    if (e.tapped) setTimeout(() => earn(si, stickersOf(si, 'reveal').find(k => k.layer === e.layer.id)), 1600);
    return;
  }
  if (kind === 'spot') {
    ({ crackle: () => sound.crackle(), twinkle: () => sound.twinkle(), rustle: () => sound.rustle(), baa: () => sound.baa(),
      heehaw: () => sound.heehaw(), chime: () => sound.sprout(e.x), roar: () => sound.roar(), trumpet: () => sound.trumpet(), horn: () => sound.horn(),
      moo: () => sound.moo(), chirp: () => sound.ready && sound.chirp(sound.ctx.currentTime), splash: () => sound.splash(),
      bubble: () => sound.bubble(e.y) }[e.spot.sound])?.();
    buzz('LIGHT');
    if (readAloud && advanceTimer) advanceIn(4000);
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
    dust: () => sound.heehaw(),
    sing: () => sound.sing(e.spec.voice, e.y),
    bubbles: () => sound.bubble(e.y),
    names: () => sound.animalName(),
    frogs: () => sound.ribbit(),
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
    if (i !== to) sl.el.querySelectorAll('.source.open').forEach(v => showVerses(v, false));
  });
  [...dots.children].forEach((d, si) => d.classList.toggle('on', si === slides[to].scene && to > 0));
  $('prev').disabled = to === 0;
  $('next').disabled = to === slides.length - 1;
  document.body.classList.toggle('at-cover', to === 0);
  changedAt = performance.now();
  history.replaceState(null, '', `#${to}`);
  // Remembered for the Stories page's "Continue reading".
  const here = story.scenes[slides[to].scene];
  try { localStorage.setItem('kb:last', JSON.stringify({ story: storyId, at: to, where: `${here.eyebrow} · ${here.title}` })); } catch {}

  sound.turn();
  if (slides[to].kind === 'title') sound.arrive();
  if (sceneChanged || !unlocked) applySound();
  narrate();
  // Reaching the end finishes the story, which brings its people and things to Your Kingdom.
  if (slides[to].kind === 'end' && collection.add(`${storyId}/finished`)) unlockPieces();
  // Bedtime: reaching the end of the story fades everything to "Goodnight".
  if (document.body.classList.contains('goodnight') && slides[to].kind !== 'end') { document.body.classList.remove('goodnight'); sound.wake(); }
  if (bedtime && slides[to].kind === 'end') setTimeout(() => { if (slides[index].kind === 'end') goodnight(); }, 2500);
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
// While the sticker book or a game is open, the page stays put.
const bookOpen = () => document.body.classList.contains('book-open') || document.body.classList.contains('game-open');
addEventListener('wheel', e => {
  if (e.ctrlKey || bookOpen()) return;                            // pinch-zoom, or reading the sticker book
  if (e.target.closest?.('.sheet')) {                              // reading the verses: they scroll, the page stays
    if (!scrollsInside(e.target.closest('.sheet').querySelector('.verses'), e.deltaY)) e.preventDefault();
    return;
  }
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
  const open = versesOpen();
  if (open && e.key === 'Escape') { showVerses(open, false); open.querySelector('.toggle').focus(); e.preventDefault(); return; }
  if (open?.sheet.contains(e.target) && !['Home', 'End'].includes(e.key)) return;   // arrows scroll the verses
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

// A tap outside the open verses closes them.
addEventListener('pointerdown', e => {
  const open = versesOpen();
  if (open && !inVerses(open, e.target)) showVerses(open, false);
});

// Swipes: up for the next slide, down for the previous one.
let touchStart = null;
addEventListener('touchstart', e => {
  const t = e.touches[0];
  touchStart = e.touches.length === 1 && !bookOpen() && !e.target.closest?.('.sheet') ? { x: t.clientX, y: t.clientY } : null;
}, { passive: true });
addEventListener('touchend', e => {
  if (!touchStart) return;
  const t = e.changedTouches[0], dy = touchStart.y - t.clientY, dx = touchStart.x - t.clientX;
  touchStart = null;
  if (Math.abs(dy) > 45 && Math.abs(dy) > Math.abs(dx)) dy > 0 ? next() : prev();
});

showVoices();

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
    } else if (w.estimate && w.duration > 0) {
      // A family recording has no word timings: move through the words in step with the clip.
      const total = words.starts.at(-1) + (words.spans.at(-1)?.textContent.length ?? 0);
      const reached = Math.min(1, Math.max(0, (w.time - 0.3) / Math.max(0.5, w.duration - 0.6))) * total;
      const end = words.starts[i] + span.textContent.length;
      state = end <= reached ? 'said' : words.starts[i] <= reached ? 'saying' : '';
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
  stage.calm = sl.kind === 'talk' || sl.kind === 'end';
  stage.set(sl.scene, sl.beat, at);
  stage.frame(now / 1000, dt);

  // The score follows the picture: a layer can carry its own mood (Day 1's light brings the dawn).
  const scene = stage.scenes[sl.scene], data = story.scenes[sl.scene];
  const lifted = scene.layers.find(l => l.mood && l.reveal > 0.5);
  sound.setMood(lifted?.mood ?? data.sound?.mood, lifted ? lifted.music : data.sound?.music);
  highlight();
}
requestAnimationFrame(frame);
