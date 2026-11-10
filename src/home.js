// The menus, where the app opens: three tabs along a bar at the bottom, where small thumbs reach.
//
// Home: "Keep reading" (the page you were on, or the next story you haven't read), a story for
//   the season (Christmas, Easter, Pentecost; otherwise a story of the week), the stories to
//   read next, and games to play.
// Library: every story on its shelf (library.json's `shelves`, rows that scroll sideways) and
//   every game, behind a Stories | Games switch. Each story card shows whether it's been read and
//   a row of stars that fill in as its stickers and lambs are found.
// Me: reading time, weeks reading, stories read, stickers, little lambs and gold badges; Your
//   Kingdom; the newest stickers and the sticker book; the gold badges won.
//
// In the iPhone/iPad app the bar is drawn natively (NativeTabs.swift); on the website it's HTML.

import { Collection, openBook, stickerEl, stickerSrc } from './stickers.js';
import { openGame, badgeEl } from './games.js';
import { Sound } from './audio.js';
import { openKingdom, kingdomPieces, kingdomPlaces } from './kingdom.js';
import { plugin, appReady, launched, coldStart } from './native.js';
import { readingStats, weekOf } from './stats.js';

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const read = key => { try { return JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { return null; } };
const ICONS = {
  home: '<path d="M3.8 11.2 12 4.5l8.2 6.7"/><path d="M6 9.6V19.5h4.4v-5.2h3.2v5.2H18V9.6"/>',
  library: '<path d="M4.5 4.5h3.6v15H4.5zM10.2 4.5h3.6v15h-3.6z"/><path d="m15.6 5.6 3.4-.9 3 14.3-3.4.9z"/>',
  me: '<circle cx="12" cy="8.4" r="3.7"/><path d="M4.8 19.6c1.3-3.5 4.1-5.3 7.2-5.3s5.9 1.8 7.2 5.3"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
const DAY = 864e5;

// Easter Sunday (the Gregorian computus, as in the Book of Common Prayer's tables).
function easter(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

// The story for this time of year, if there is one: { story, eyebrow, line }.
function season(now = new Date()) {
  const y = now.getFullYear(), at = (m, d) => new Date(y, m, d), from = (a, b) => now >= a && now < b;
  const e = easter(y), pentecost = new Date(+e + 49 * DAY);
  if (from(at(10, 20), at(11, 25))) return { story: 'christmas', eyebrow: 'Christmas is coming', line: 'Get ready for the night Jesus was born in Bethlehem.' };
  if (now >= at(11, 25) || now < at(0, 7)) return { story: 'christmas', eyebrow: 'Merry Christmas', line: 'The angels, the shepherds and a baby in a manger.' };
  if (from(new Date(+e - 21 * DAY), e)) return { story: 'easter', eyebrow: 'Easter is coming', line: 'Get ready for the most amazing morning of all.' };
  if (from(e, new Date(+e + 8 * DAY))) return { story: 'easter', eyebrow: 'He is risen!', line: 'Happy Easter! Read about the empty tomb.' };
  if (from(new Date(+pentecost - 7 * DAY), new Date(+pentecost + 2 * DAY))) return { story: 'pentecost', eyebrow: 'Pentecost', line: 'Wind, fire and the church’s very first day.' };
  return null;
}

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
  const tabs = {};
  for (const [id, label] of [['home', 'Home'], ['library', 'Library'], ['me', 'Me']]) {
    const b = tabs[id] = el('button', `tab tab-${id}`);
    b.innerHTML = icon(id);
    b.append(el('span', '', label));
    b.onclick = () => show(id);
    bar.append(b);
  }
  document.body.append(bar);

  // In the iPhone/iPad app the same tabs are drawn natively (NativeTabs.swift: Liquid Glass, SF
  // Symbols, a haptic tick) and the HTML bar stays hidden. A tap comes back here as a click.
  const nativeTabs = plugin('NativeTabs');
  if (nativeTabs) {
    document.documentElement.classList.add('native-tabs');
    nativeTabs.configure({ tabs: [
      { id: 'home', title: 'Home', symbol: 'house' },
      { id: 'library', title: 'Library', symbol: 'books.vertical' },
      { id: 'me', title: 'Me', symbol: 'person.crop.circle' },
    ] }).catch(() => {});
    nativeTabs.addListener('tap', ({ id }) => tabs[id]?.click());
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
  let shelf = location.hash === '#games' ? 'games' : 'stories';     // which half of the Library
  const views = { home: () => homeView(), library: () => libraryView(), me: () => meView() };
  const show = (name, { keepScroll = false } = {}) => {
    current = name;
    for (const [id, b] of Object.entries(tabs)) { b.classList.toggle('on', id === name); b.setAttribute('aria-current', id === name ? 'page' : 'false'); }
    nativeTabs?.select({ id: name }).catch(() => {});
    const hash = name === 'library' ? (shelf === 'games' ? '#games' : '#library') : name === 'me' ? '#me' : '';
    try { history.replaceState(null, '', location.pathname + location.search + hash); } catch {}
    const y = scrollY;
    view.replaceChildren(...views[name]());
    scrollTo(0, keepScroll ? y : 0);
    arrows();
  };
  const refresh = () => show(current, { keepScroll: true });    // after a game, the Kingdom or the sticker book
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
    const stickersGot = stickers.filter(k => collection.has(`${id}/${k.id}`)).length;
    const lambsGot = lambs.filter(s => collection.has(`${id}/lamb:${s.id}`)).length;
    const game = games[id];
    return { read: collection.has(`${id}/finished`), got: stickersGot + lambsGot, of: stickers.length + lambs.length,
      stickersGot, stickers: stickers.length, lambsGot, lambs: lambs.length, won: !!(game && collection.has(`${id}/game:${game.id}`)) };
  };
  const isRead = id => collection.has(`${id}/finished`);

  // Five little stars that fill in as the story's stickers and lambs are found.
  const starRow = (got, of) => {
    const row = el('div', 'stars');
    const lit = of ? Math.round((got / of) * 5) : 0;
    for (let i = 0; i < 5; i++) row.append(el('i', i < lit ? 'lit' : ''));
    row.setAttribute('role', 'img');
    row.setAttribute('aria-label', `${got} of ${of} stickers found`);
    return row;
  };

  const head = (title, sub) => {
    const h = el('header', 'head');
    h.append(el('div', 'kicker', 'Kingdom Bible'), el('h1', '', title));
    if (sub) h.append(el('p', 'sub', sub));
    return h;
  };

  // A row that scrolls sideways, with arrows for a mouse (fingers and trackpads just swipe).
  const row = (title, count, items, cls = '') => {
    const section = el('section', 'row');
    const top = el('div', 'row-head');
    top.append(el('h2', 'shelf-title', title), el('span', 'row-count', count ?? ''));
    const track = el('div', `track ${cls}`);
    const nudge = dir => track.scrollBy({ left: dir * track.clientWidth * 0.8, behavior: 'smooth' });
    for (const [dir, label] of [[-1, 'Back'], [1, 'More']]) {
      const b = el('button', `arrow ${dir < 0 ? 'prev' : 'next'}`);
      b.setAttribute('aria-label', `${label}: ${title}`);
      b.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${dir < 0 ? 'M14.5 6l-6 6 6 6' : 'M9.5 6l6 6-6 6'}"/></svg>`;
      b.onclick = () => nudge(dir);
      top.append(b);
    }
    track.append(...items);
    section.append(top, track);
    return section;
  };

  // A big picture card: the story to keep reading, the season's story, Your Kingdom.
  const bigCard = ({ tag = 'a', href, onclick, src, position, eyebrow, title, sub, action, cls = '' }) => {
    const card = el(tag, `hero ${cls}`);
    if (href) card.href = href;
    if (onclick) card.onclick = onclick;
    const art = el('div', 'hero-art');
    art.style.backgroundImage = `url("${src}")`;
    if (position) art.style.backgroundPosition = position;
    const words = el('div', 'hero-words');
    words.append(el('div', 'eyebrow', eyebrow), el('h2', '', title));
    if (sub) words.append(el('p', 'sub', sub));
    words.append(el('span', 'begin read', action));
    card.append(art, words);
    return card;
  };

  const storyCard = id => {
    const story = stories[id], entry = entries[id], st = status(id);
    const card = el('a', `story${st.read ? ' read' : ''}`);
    card.href = `?story=${id}`;
    const art = el('div', 'art');
    if (entry.cover) art.style.backgroundImage = `url("${entry.cover}")`;
    art.append(el('span', 'num', String(order.indexOf(id) + 1)));
    if (st.read) art.append(el('span', 'ribbon', 'Read ✓'));
    const foot = el('div', 'foot');
    foot.append(starRow(st.got, st.of));
    const game = games[id];
    if (game && st.won) foot.append(badgeEl(game, 22));
    card.append(art, el('h3', '', story.title), el('p', 'ref', story.reference), foot);
    return card;
  };

  const gameCard = id => {
    const game = games[id], st = status(id);
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
        onClose: () => { refresh(); } });
    };
    return card;
  };
  const gameIds = order.filter(id => games[id]);
  const badgesWon = () => gameIds.filter(id => status(id).won).length;

  // ---- Home.
  const homeView = () => {
    const hour = new Date().getHours();
    const out = [head(hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening')];

    // Keep reading: the page you were on, or the first story you haven't finished.
    const last = read('kb:last');
    const resume = last && stories[last.story] && last.at > 0 && !isRead(last.story) ? last : null;
    const nextId = resume?.story ?? order.find(id => !isRead(id)) ?? order[0];
    const allRead = order.every(isRead);
    const story = stories[nextId], entry = entries[nextId];
    out.push(bigCard({ href: resume ? `?story=${nextId}#${resume.at}` : `?story=${nextId}`, src: entry.coverFrom ?? entry.cover,
      eyebrow: resume ? 'Keep reading' : allRead ? 'Read it again' : isRead(order[0]) || last ? 'Up next' : 'Start here',
      title: story.title, sub: resume?.where ?? story.subtitle ?? story.reference, action: resume ? 'Read on' : 'Read it' }));

    // The season's story, or one story each week.
    let feature = season();
    if (!feature || !stories[feature.story] || feature.story === nextId) {
      const choices = order.filter(id => id !== nextId);
      const n = Number(weekOf().slice(-2));
      feature = { story: choices[n % choices.length], eyebrow: 'Story of the week' };
    }
    const f = stories[feature.story], fe = entries[feature.story];
    out.push(bigCard({ href: `?story=${feature.story}`, src: fe.coverFrom ?? fe.cover, eyebrow: feature.eyebrow, title: f.title,
      sub: feature.line ?? f.subtitle ?? f.reference, action: 'Read it', cls: 'feature' }));

    // Read next: the stories after this one that haven't been read yet, in order.
    const start = order.indexOf(nextId);
    const upcoming = [...order.slice(start + 1), ...order.slice(0, start)].filter(id => !isRead(id) && id !== feature.story).slice(0, 8);
    if (upcoming.length) out.push(row('Read next', null, upcoming.map(storyCard)));

    // Games to play: ones not won yet, those from stories already read first.
    const toPlay = gameIds.filter(id => !status(id).won).sort((a, b) => isRead(b) - isRead(a)).slice(0, 8);
    if (toPlay.length) out.push(row('Games to play', `${badgesWon()} of ${gameIds.length} gold badges`, toPlay.map(gameCard)));
    return out;
  };

  // ---- Library: Stories | Games.
  const libraryView = () => {
    const out = [head('Library', `${order.filter(isRead).length} of ${order.length} stories read · ${badgesWon()} of ${gameIds.length} gold badges`)];
    const seg = el('div', 'seg');
    seg.setAttribute('role', 'tablist');
    for (const [id, label] of [['stories', 'Stories'], ['games', 'Games']]) {
      const b = el('button', '', label);
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(shelf === id));
      b.onclick = () => { if (shelf !== id) { shelf = id; show('library'); } };
      seg.append(b);
    }
    out.push(seg);

    if (shelf === 'games') {
      const grid = el('div', 'shelf games-shelf');
      grid.append(...gameIds.map(gameCard));
      out.push(grid);
    } else {
      // Rows from library.json; without them, one row for each testament.
      const byTestament = [['old', 'The Old Testament'], ['new', 'The New Testament']]
        .map(([t, title]) => ({ id: t, title, stories: library.stories.filter(s => (s.testament ?? 'old') === t).map(s => s.id) }));
      const shelves = (library.shelves ?? byTestament)
        .map(s => ({ ...s, stories: s.stories.filter(id => stories[id]) }))
        .filter(s => s.stories.length);
      const placed = new Set(shelves.flatMap(s => s.stories));
      const loose = order.filter(id => !placed.has(id));          // a new story not on a shelf yet still shows up
      if (loose.length) shelves.push({ id: 'more', title: 'More Stories', stories: loose });
      for (const s of shelves) out.push(row(s.title, `${s.stories.filter(isRead).length} of ${s.stories.length} read`, s.stories.map(storyCard)));
    }
    out.push(el('p', 'credit', 'Retold from the Berean Standard Bible, which is in the public domain. Narration voice: Kokoro (open source). Sounds and music are made live on your device.'));
    return out;
  };

  // ---- Me.
  const meView = () => {
    const out = [head('Me')];
    const time = readingStats();
    const all = order.map(status);
    const sum = key => all.reduce((n, s) => n + s[key], 0);
    const stats = el('div', 'stats');
    const tile = (value, label, of) => {
      const t = el('div', 'stat');
      const b = el('b', '', String(value));
      if (of != null) b.append(el('small', '', ` of ${of}`));
      t.append(b, el('span', '', label));
      return t;
    };
    stats.append(
      tile(time.minutes, time.minutes === 1 ? 'Minute reading' : 'Minutes reading'),
      tile(time.weeks, time.weeks === 1 ? 'Week reading' : 'Weeks reading'),
      tile(order.filter(isRead).length, 'Stories read', order.length),
      tile(sum('stickersGot'), 'Stickers', sum('stickers')),
      tile(sum('lambsGot'), 'Little lambs', sum('lambs')),
      tile(badgesWon(), 'Gold badges', gameIds.length));
    out.push(stats);
    if (time.streak > 1) out.push(el('p', 'streak', `${time.streak} weeks in a row. Keep it going!`));

    // Your Kingdom: the place you were building, and how much of it there is.
    const store = read('kb:kingdom');
    const placeId = Array.isArray(store) ? 'meadow' : store?.place ?? 'meadow';
    const kingdom = bigCard({ tag: 'button', src: `art/places/${placeId}.jpg`, position: '60% 60%', eyebrow: 'Your Kingdom',
      title: 'Build your kingdom', sub: 'Every story you finish brings its people, animals and places here.', action: 'Open', cls: 'kingdom-card',
      onclick: () => { sound.unlock(); openKingdom({ library, collection, games, sound, onClose: refresh }); } });
    const counts = el('p', 'counts', '\u00a0');
    kingdom.querySelector('h2').after(counts);
    out.push(kingdom);
    Promise.all([kingdomPieces({ library, collection }), kingdomPlaces({ library, collection })]).then(([pieces, places]) => {
      counts.textContent = `${pieces.filter(p => p.unlocked).length} of ${pieces.length} pieces · ${places.filter(p => p.unlocked).length} of ${places.length} places`;
    }).catch(() => {});

    // The newest stickers, and the whole book.
    const byKey = new Map();
    for (const id of order) for (const scene of stories[id].scenes) for (const k of scene.stickers ?? []) byKey.set(`${id}/${k.id}`, { sticker: k, scene });
    const newest = [...collection.got].reverse().filter(k => byKey.has(k)).slice(0, 12);
    const openSticker = () => openBook({ collection, library, games, onClose: refresh });
    const stickerRow = row('Sticker Book', `${sum('stickersGot')} of ${sum('stickers')}`,
      newest.map(k => { const { sticker, scene } = byKey.get(k); const s = stickerEl(sticker, stickerSrc(scene, sticker), 84); s.title = sticker.name; return s; }), 'sticker-track');
    if (!newest.length) stickerRow.querySelector('.track').replaceWith(el('p', 'empty', 'Tap the pictures in a story to find stickers.'));
    const open = el('button', 'open-book', 'Open the book');
    open.onclick = openSticker;
    stickerRow.querySelector('.row-head').append(open);
    out.push(stickerRow);

    // Gold badges won.
    const won = gameIds.filter(id => status(id).won);
    const badges = el('section', 'row');
    const bTop = el('div', 'row-head');
    bTop.append(el('h2', 'shelf-title', 'Gold badges'), el('span', 'row-count', `${won.length} of ${gameIds.length}`));
    const list = el('div', 'badges');
    if (won.length) list.append(...won.map(id => { const b = badgeEl(games[id], 64); b.title = games[id].title; return b; }));
    else list.append(el('p', 'empty', 'Win a game to earn its gold badge.'));
    badges.append(bTop, list);
    out.push(badges);

    // Signing in (coming in an update): until then, everything stays on this device.
    const save = el('section', 'save');
    save.append(el('h3', '', 'Your progress'),
      el('p', '', 'Stories read, stickers, badges and Your Kingdom are saved on this device. Signing in to keep them on every device is coming soon.'));
    out.push(save);
    return out;
  };

  show({ '#games': 'library', '#library': 'library', '#me': 'me' }[location.hash] ?? 'home');

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
