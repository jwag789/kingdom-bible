// The Stories page: where the app opens. Two tabs, Stories and Games, plus buttons for Your
// Kingdom and the Sticker Book, along a bar at the bottom where small thumbs can reach.
//
// Stories: one big "Up next" card (the page you were on, or the next story you haven't read),
// then the stories in rows that scroll sideways (In the Beginning, Joseph and Moses…, from
// library.json's `shelves`). Each card shows whether it's been read and a row of stars that
// fill in as its stickers and lambs are found.
// Games: every story's game, all of them playable; the gold badge is won by finishing one.

import { Collection, openBook } from './stickers.js';
import { openGame, badgeEl } from './games.js';
import { Sound } from './audio.js';
import { openKingdom } from './kingdom.js';
import { plugin, appReady, launched, coldStart } from './native.js';

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const read = key => { try { return JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { return null; } };
const ICONS = {
  stories: '<path d="M4 5.5C6.5 4.2 9.5 4.2 12 5.8c2.5-1.6 5.5-1.6 8-.3v13c-2.5-1.3-5.5-1.3-8 .3-2.5-1.6-5.5-1.6-8-.3z"/><path d="M12 5.8v13"/>',
  games: '<rect x="3" y="7.5" width="18" height="10" rx="5"/><path d="M8 10.5v4M6 12.5h4"/><circle cx="15.5" cy="11.5" r="0.9" fill="currentColor"/><circle cx="17.5" cy="13.8" r="0.9" fill="currentColor"/>',
  kingdom: '<path d="M4 19h16M5 19V9l3.5 3L12 6l3.5 6L19 9v10"/>',
  stickers: '<path d="M12 3.5l2.5 5.2 5.7.8-4.1 4 1 5.7L12 16.5l-5.1 2.7 1-5.7-4.1-4 5.7-.8z"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

export async function showHome() {
  const [library, games] = await Promise.all([
    fetch('data/library.json', { cache: 'no-cache' }).then(r => r.json()),
    fetch('data/games.json', { cache: 'no-cache' }).then(r => r.json(), () => ({})),
  ]);
  const stories = Object.fromEntries(await Promise.all(library.stories.map(async s => [s.id, await fetch(`data/${s.id}.json`).then(r => r.json())])));
  const entries = Object.fromEntries(library.stories.map(s => [s.id, s]));
  const order = library.stories.map(s => s.id);
  const collection = new Collection();
  const sound = new Sound();
  document.title = 'Kingdom Bible';
  document.documentElement.classList.add('home');   // the story view locks scrolling; this page scrolls
  document.body.classList.add('home');
  document.body.classList.remove('at-cover');
  if ('serviceWorker' in navigator && !window.Capacitor?.isNativePlatform?.()) navigator.serviceWorker.register('sw.js').catch(() => {});

  const home = el('main', 'shelves');
  home.id = 'home';
  const view = el('div', 'view');
  home.append(view);
  document.body.append(home);

  // ---- The bar along the bottom.
  const bar = el('nav', 'tabbar');
  bar.setAttribute('aria-label', 'Kingdom Bible');
  const tab = (id, label, onclick) => {
    const b = el('button', `tab tab-${id}`);
    b.innerHTML = icon(id);
    b.append(el('span', '', label));
    b.onclick = onclick;
    bar.append(b);
    return b;
  };
  const tabs = {
    stories: tab('stories', 'Stories', () => show('stories')),
    games: tab('games', 'Games', () => show('games')),
  };
  const kingdomBtn = tab('kingdom', 'Kingdom', () => { sound.unlock(); openKingdom({ library, collection, games, sound, onClose: () => kingdomBtn.focus() }); });
  tab('stickers', 'Stickers', () => openBook({ collection, library, games }));
  document.body.append(bar);

  // In the iPhone/iPad app the same four tabs are drawn natively (NativeTabs.swift: Liquid Glass,
  // SF Symbols, a haptic tick) and the HTML bar stays hidden. A tap comes back here as a click.
  const nativeTabs = plugin('NativeTabs');
  if (nativeTabs) {
    document.documentElement.classList.add('native-tabs');
    nativeTabs.configure({ tabs: [
      { id: 'stories', title: 'Stories', symbol: 'book' },
      { id: 'games', title: 'Games', symbol: 'gamecontroller' },
      { id: 'kingdom', title: 'Kingdom', symbol: 'crown' },
      { id: 'stickers', title: 'Stickers', symbol: 'star' },
    ] }).catch(() => {});
    nativeTabs.addListener('tap', ({ id }) => bar.querySelector(`.tab-${id}`)?.click());
    // Shown only where the HTML bar would be: not over a game, the Kingdom or the sticker book.
    let shown = null;
    const sync = () => {
      const visible = !document.body.classList.contains('game-open') && !document.querySelector('.kingdom, .book');
      if (visible === shown) return;
      shown = visible;
      (visible ? nativeTabs.show() : nativeTabs.hide()).catch(() => {});
    };
    new MutationObserver(sync).observe(document.body, { childList: true, attributes: true, attributeFilter: ['class'] });
    launched.then(sync);    // not before the launch picture starts to fade: it would sit on top of it
  }

  let current = null;
  const show = (name, { keepScroll = false } = {}) => {
    current = name;
    for (const [id, b] of Object.entries(tabs)) { b.classList.toggle('on', id === name); b.setAttribute('aria-current', id === name ? 'page' : 'false'); }
    nativeTabs?.select({ id: name }).catch(() => {});
    try { history.replaceState(null, '', name === 'games' ? '#games' : location.pathname + location.search); } catch {}
    const y = scrollY;
    view.replaceChildren(...(name === 'games' ? gamesView() : storiesView()));
    scrollTo(0, keepScroll ? y : 0);
    arrows();
  };
  // Arrows only on rows that don't already fit.
  const arrows = () => view.querySelectorAll('.row').forEach(row => {
    const track = row.querySelector('.track');
    row.querySelectorAll('.arrow').forEach(a => { a.hidden = track.scrollWidth <= track.clientWidth + 2; });
  });
  addEventListener('resize', arrows);

  // ---- How far along a story is.
  const status = id => {
    const story = stories[id];
    const stickers = story.scenes.flatMap(s => s.stickers ?? []);
    const lambs = story.scenes.filter(s => s.lamb);
    const got = stickers.filter(k => collection.has(`${id}/${k.id}`)).length + lambs.filter(s => collection.has(`${id}/lamb:${s.id}`)).length;
    const game = games[id];
    return { read: collection.has(`${id}/finished`), got, of: stickers.length + lambs.length, won: !!(game && collection.has(`${id}/game:${game.id}`)) };
  };

  // Five little stars that fill in as the story's stickers and lambs are found.
  const starRow = (got, of) => {
    const row = el('div', 'stars');
    const lit = of ? Math.round((got / of) * 5) : 0;
    for (let i = 0; i < 5; i++) row.append(el('i', i < lit ? 'lit' : ''));
    row.setAttribute('role', 'img');
    row.setAttribute('aria-label', `${got} of ${of} stickers found`);
    return row;
  };

  // ---- Stories.
  const storiesView = () => {
    const out = [];
    const head = el('header', 'head');
    head.append(el('div', 'kicker', 'Kingdom Bible'), el('h1', '', 'Bible Stories'));
    out.push(head);

    // Up next: the page you were on, or the first story you haven't finished.
    const last = read('kb:last');
    const resume = last && stories[last.story] && last.at > 0 && !collection.has(`${last.story}/finished`) ? last : null;
    const nextId = resume?.story ?? order.find(id => !collection.has(`${id}/finished`)) ?? order[0];
    const allRead = order.every(id => collection.has(`${id}/finished`));
    const story = stories[nextId], entry = entries[nextId];
    const hero = el('a', 'hero');
    hero.href = resume ? `?story=${nextId}#${resume.at}` : `?story=${nextId}`;
    const art = el('div', 'hero-art');
    art.style.backgroundImage = `url("${entry.coverFrom ?? entry.cover}")`;
    const words = el('div', 'hero-words');
    words.append(
      el('div', 'eyebrow', resume ? 'Keep reading' : allRead ? 'Read it again' : collection.has(`${order[0]}/finished`) || last ? 'Up next' : 'Start here'),
      el('h2', '', story.title),
      el('p', 'sub', resume?.where ?? story.subtitle ?? story.reference),
      el('span', 'begin read', resume ? 'Read on' : 'Read it'));
    hero.append(art, words);
    out.push(hero);

    // The rows.
    let number = 0;
    const numbers = Object.fromEntries(order.map(id => [id, ++number]));
    // Rows from library.json; without them, one row for each testament.
    const byTestament = [['old', 'The Old Testament'], ['new', 'The New Testament']]
      .map(([t, title]) => ({ id: t, title, stories: library.stories.filter(s => (s.testament ?? 'old') === t).map(s => s.id) }));
    const shelves = (library.shelves ?? byTestament)
      .map(s => ({ ...s, stories: s.stories.filter(id => stories[id]) }))
      .filter(s => s.stories.length);
    const placed = new Set(shelves.flatMap(s => s.stories));
    const loose = order.filter(id => !placed.has(id));          // a new story not on a shelf yet still shows up
    if (loose.length) shelves.push({ id: 'more', title: 'More Stories', stories: loose });
    for (const shelf of shelves) {
      const section = el('section', 'row');
      const top = el('div', 'row-head');
      const done = shelf.stories.filter(id => collection.has(`${id}/finished`)).length;
      top.append(el('h2', 'shelf-title', shelf.title), el('span', 'row-count', `${done} of ${shelf.stories.length} read`));
      const track = el('div', 'track');
      // Arrows for a mouse; fingers and trackpads just swipe.
      const nudge = dir => track.scrollBy({ left: dir * track.clientWidth * 0.8, behavior: 'smooth' });
      for (const [dir, label] of [[-1, 'Back'], [1, 'More']]) {
        const b = el('button', `arrow ${dir < 0 ? 'prev' : 'next'}`);
        b.setAttribute('aria-label', `${label}: ${shelf.title}`);
        b.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${dir < 0 ? 'M14.5 6l-6 6 6 6' : 'M9.5 6l6 6-6 6'}"/></svg>`;
        b.onclick = () => nudge(dir);
        top.append(b);
      }
      for (const id of shelf.stories) track.append(storyCard(id, numbers[id]));
      section.append(top, track);
      out.push(section);
    }
    out.push(el('p', 'credit', 'Retold from the Berean Standard Bible, which is in the public domain. Narration voice: Kokoro (open source). Sounds and music are made live in your device.'));
    return out;
  };

  const storyCard = (id, number) => {
    const story = stories[id], entry = entries[id], st = status(id);
    const card = el('a', `story${st.read ? ' read' : ''}`);
    card.href = `?story=${id}`;
    const art = el('div', 'art');
    if (entry.cover) art.style.backgroundImage = `url("${entry.cover}")`;
    art.append(el('span', 'num', String(number)));
    if (st.read) art.append(el('span', 'ribbon', 'Read ✓'));
    const foot = el('div', 'foot');
    foot.append(starRow(st.got, st.of));
    const game = games[id];
    if (game && st.won) foot.append(badgeEl(game, 22));
    card.append(art, el('h3', '', story.title), el('p', 'ref', story.reference), foot);
    return card;
  };

  // ---- Games: every one ready to play.
  const gamesView = () => {
    const out = [];
    const head = el('header', 'head');
    const won = order.filter(id => games[id] && collection.has(`${id}/game:${games[id].id}`)).length;
    const total = order.filter(id => games[id]).length;
    head.append(el('div', 'kicker', 'Kingdom Bible'), el('h1', '', 'Games'),
      el('p', 'sub', won ? `${won} of ${total} gold badges won` : 'Win a gold badge for every game.'));
    out.push(head);
    const grid = el('div', 'shelf games-shelf');
    for (const id of order) {
      const game = games[id];
      if (!game) continue;
      const st = status(id);
      const card = el('button', `game-card${st.won ? ' won' : ''}`);
      const art = el('div', 'art');
      art.style.backgroundImage = `url("${game.background}")`;
      art.style.backgroundPosition = `${(game.frame?.[0] ?? 0.5) * 100}% ${(game.frame?.[1] ?? 0.5) * 100}%`;
      art.append(badgeEl(game, 56, st.won), el('span', 'play', 'Play'));
      card.append(art, el('h3', '', game.title), el('p', 'ref', stories[id].title));
      card.setAttribute('aria-label', `${game.title}, from ${stories[id].title}${st.won ? ', gold badge won' : ''}`);
      card.onclick = () => {
        sound.unlock();
        collection.add(`${id}/game-unlocked:${game.id}`);
        openGame({ storyId: id, game, sound,
          onWin: () => collection.add(`${id}/game:${game.id}`),
          onClose: () => { if (current === 'games') show('games', { keepScroll: true }); card.focus?.(); } });
      };
      grid.append(card);
    }
    out.push(grid);
    return out;
  };

  show(location.hash === '#games' ? 'games' : 'stories');

  // The app's launch picture fades once the page is drawn and its big painting is decoded (or
  // after a second and a half, whichever comes first), so it never fades onto an empty card;
  // and when the app has just opened it stays at least 1.5 s, long enough to be seen rather than
  // flash past. (Coming back from a story there's no launch picture to wait for.)
  const first = view.querySelector('.hero-art, .art')?.style.backgroundImage.match(/url\("(.+)"\)/)?.[1];
  const decoded = first ? Object.assign(new Image(), { src: first }).decode().catch(() => {}) : null;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  Promise.all([Promise.race([decoded, wait(1500)]), coldStart ? wait(1500 - performance.now()) : null])
    .then(() => requestAnimationFrame(appReady));
}
