// The Stories page: where the app opens. A shelf of stories (Old Testament, New Testament),
// each with its picture and how many stickers and lambs have been found, a "Continue
// reading" card for the page you were on, and the games you've unlocked by playing them.

import { Collection, openBook } from './stickers.js';
import { openGame, badgeEl } from './games.js';
import { Sound } from './audio.js';
import { openKingdom } from './kingdom.js';

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const read = key => { try { return JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { return null; } };

export async function showHome() {
  const [library, games] = await Promise.all([
    fetch('data/library.json').then(r => r.json()),
    fetch('data/games.json').then(r => r.json(), () => ({})),
  ]);
  const stories = Object.fromEntries(await Promise.all(library.stories.map(async s => [s.id, await fetch(`data/${s.id}.json`).then(r => r.json())])));
  const collection = new Collection();
  const sound = new Sound();
  document.title = 'Kingdom Bible';
  document.documentElement.classList.add('home');   // the story view locks scrolling; this page scrolls
  document.body.classList.add('home');
  document.body.classList.remove('at-cover');
  if ('serviceWorker' in navigator && !window.Capacitor?.isNativePlatform?.()) navigator.serviceWorker.register('sw.js').catch(() => {});

  const home = el('main', 'shelves');
  home.id = 'home';
  const head = el('header', 'head');
  const kingdomBtn = el('button', 'begin read', 'Your Kingdom');
  const bookBtn = el('button', 'begin', 'Sticker Book');
  const buttons = el('div', 'starts');
  buttons.append(kingdomBtn, bookBtn);
  head.append(el('div', 'kicker', 'Kingdom Bible'), el('h1', '', 'Bible Stories'),
    el('p', 'sub', 'Pictures you can touch, and stories you can hear.'), buttons);
  home.append(head);
  bookBtn.onclick = () => openBook({ collection, library, games });
  kingdomBtn.onclick = () => { sound.unlock(); openKingdom({ library, collection, games, sound, onClose: () => kingdomBtn.focus() }); };

  // Continue where you left off.
  const last = read('kb:last');
  if (last && stories[last.story] && last.at > 0) {
    const story = stories[last.story], entry = library.stories.find(s => s.id === last.story);
    const card = el('a', 'continue');
    card.href = `?story=${last.story}#${last.at}`;
    const art = el('div', 'art');
    art.style.backgroundImage = `url("${entry.cover ?? ''}")`;
    const words = el('div', 'words');
    words.append(el('div', 'eyebrow', 'Continue reading'), el('h2', '', story.title), el('p', 'sub', last.where ?? story.reference));
    card.append(art, words, el('span', 'go', 'Read on →'));
    home.append(card);
  }

  // The story shelves.
  let number = 0;
  for (const [testament, heading] of [['old', 'The Old Testament'], ['new', 'The New Testament']]) {
    const entries = library.stories.filter(s => (s.testament ?? 'old') === testament);
    if (!entries.length) continue;
    const section = el('section');
    const shelf = el('div', 'shelf');
    section.append(el('h2', 'shelf-title', heading), shelf);
    for (const entry of entries) {
      number++;
      const story = stories[entry.id];
      const card = el('a', 'story');
      card.href = `?story=${entry.id}`;
      const art = el('div', 'art');
      if (entry.cover) art.style.backgroundImage = `url("${entry.cover}")`;
      art.append(el('span', 'num', String(number)));
      const stickers = story.scenes.flatMap(s => s.stickers ?? []);
      const lambs = story.scenes.filter(s => s.lamb);
      const got = stickers.filter(k => collection.has(`${entry.id}/${k.id}`)).length;
      const lambsGot = lambs.filter(s => collection.has(`${entry.id}/lamb:${s.id}`)).length;
      const progress = el('div', 'progress');
      const stars = el('span', got && got === stickers.length ? 'all' : '', `★ ${got}/${stickers.length}`);
      stars.title = 'Stickers found';
      progress.append(stars);
      if (lambs.length) {
        const sheep = el('span', lambsGot === lambs.length ? 'all' : '');
        sheep.title = 'Little lambs found';
        const icon = el('i', 'lamb-icon');
        sheep.append(icon, ` ${lambsGot}/${lambs.length}`);
        progress.append(sheep);
      }
      const game = games[entry.id];
      if (game && collection.has(`${entry.id}/game:${game.id}`)) progress.append(badgeEl(game, 22));
      card.append(art, el('h3', '', story.title), el('p', 'ref', story.reference), progress);
      shelf.append(card);
    }
    home.append(section);
  }

  // Games: one per story, unlocked the first time it's played in the story.
  const gameEntries = Object.entries(games);
  if (gameEntries.length) {
    const section = el('section');
    const shelf = el('div', 'shelf games-shelf');
    section.append(el('h2', 'shelf-title', 'Games'), shelf);
    for (const [storyId, game] of gameEntries) {
      const unlocked = collection.has(`${storyId}/game-unlocked:${game.id}`) || collection.has(`${storyId}/game:${game.id}`);
      const card = el(unlocked ? 'button' : 'div', `game-card${unlocked ? '' : ' locked'}`);
      const art = el('div', 'art');
      art.style.backgroundImage = `url("${game.background}")`;
      art.append(badgeEl(game, 56, unlocked));
      const story = stories[storyId];
      card.append(art, el('h3', '', game.title), el('p', 'ref', unlocked ? 'Tap to play' : `Find it in “${story?.title ?? storyId}”`));
      if (unlocked) {
        card.onclick = () => {
          sound.unlock();
          openGame({ storyId, game, sound,
            onWin: () => collection.add(`${storyId}/game:${game.id}`),
            onClose: () => location.reload() });
        };
      }
      shelf.append(card);
    }
    home.append(section);
  }

  home.append(el('p', 'credit', 'Retold from the Berean Standard Bible, which is in the public domain. Narration voice: Kokoro (open source). Sounds and music are made live in your device.'));
  document.body.append(home);
}
