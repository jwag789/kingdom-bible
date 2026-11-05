// The games beyond Two by Two and counting, one kind for each story, so no two play alike.
// Each takes a `kit` from games.js (the field to play on, the spoken lines, the sounds, the
// win) and returns nothing; when the reader closes the game or plays again, kit.alive()
// turns false and anything still moving stops.
//
// "sort"    Which Day?           drag each thing God made into the day He made it
// "memory"  Animal Memory        flip cards to find two of each animal
// "float"   Float the Basket     steer baby Moses past rocks and reeds, collecting water lilies
// "frogs"   Frog Frenzy          tap the frogs popping up all over Pharaoh's palace
// "part"    Part the Sea         swipe across the water, then lead each family across
// "trace"   To the Beach         drag the big fish along a shining path to the shore
// "puzzle"  Stable Puzzle        put the picture of the night Jesus was born back together
// "net"     Fill the Nets        sweep the net through the water to catch the jumping fish
// "sling"   Five Smooth Stones   choose five smooth stones, then sling one at Goliath's helmet
// "hush"    Hush the Lions       stroke the roaring lions until they curl up asleep
// "coat"    Color the Coat       pick a paint pot and color each stripe of Joseph's coat
// "give"    Pay It Back          drag coins from Zacchaeus' purse, four to each person
// "palms"   Hosanna Road         lay palms and cloaks on the road for the little donkey
// "march"   March and Shout      hold to march the trumpets round Jericho seven times, then shout
// "gather"  Fill the Baskets     tap the leftover bread and fish to fill twelve baskets
// "lantern" Find the Lamb        shine the lantern over the dark hills to find the little lamb
// "glean"   Glean the Barley     sweep a finger across the field to gather the stalks Ruth gleans
// "echo"    Listen and Follow    four stone tablets sing a pattern; tap it back in the same order
// "wind"    Wind and Fire        swipe like a rushing wind to bring a little flame over each person
// "altar"   Build the Altar      stack twelve stones, pour on water three times, pray, and fire falls

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const shuffle = list => {
  for (let i = list.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [list[i], list[j]] = [list[j], list[i]]; }
  return list;
};
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const img = (src, cls) => { const i = el('img', cls); i.src = src; i.alt = ''; i.draggable = false; return i; };
const prop = id => `art/props/${id}.png`;

// Follows one finger from press to release on `node`.
function drag(node, { down, move, up }) {
  node.addEventListener('pointerdown', e => {
    if (down?.(e) === false) return;
    e.preventDefault();
    try { node.setPointerCapture(e.pointerId); } catch {}
    const mv = ev => move?.(ev);
    const end = ev => {
      node.removeEventListener('pointermove', mv);
      node.removeEventListener('pointerup', end);
      node.removeEventListener('pointercancel', end);
      up?.(ev);
    };
    node.addEventListener('pointermove', mv);
    node.addEventListener('pointerup', end);
    node.addEventListener('pointercancel', end);
  });
}

// A thing on the field, placed by its middle in pixels.
function put(node, x, y) {
  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
}

// A little counter that pops each time it goes up.
function tally(k) {
  const big = el('div', 'tally', '');
  k.root.append(big);
  return n => { big.textContent = n; big.classList.remove('pop'); void big.offsetWidth; big.classList.add('pop'); };
}

// ---- Which Day? Each round names a day; drag (or tap) the things God made that day into it.
function sort(k) {
  const { field, game, sound } = k;
  const rounds = game.rounds;
  const box = el('div', 'daybox'), label = el('div', 'daylabel'), inside = el('div', 'inside');
  box.append(label, inside);
  const pool = el('div', 'pool');
  field.append(box, pool);
  let round = 0, placed = 0, lastNope = 0;

  const begin = () => {
    const r = rounds[round];
    label.textContent = r.label;
    inside.replaceChildren();
    placed = 0;
    k.progress(`${round + 1} of ${rounds.length} days`);
    k.line(`round-${round + 1}`);
    fit();
  };
  const choose = piece => {
    const r = rounds[round];
    if (!r.items.includes(piece.dataset.id)) {
      piece.classList.remove('nope'); void piece.offsetWidth; piece.classList.add('nope');
      sound.boop?.();
      if (performance.now() - lastNope > 4000) { lastNope = performance.now(); k.line('nope'); }
      return;
    }
    if (sound.ready) sound.pluck(72 + placed * 3, sound.ctx.currentTime, 0.1);
    navigator.vibrate?.(12);
    piece.classList.add('placed');
    inside.append(piece);
    if (++placed < r.items.length) return;
    sound.sticker?.();
    setTimeout(() => {
      if (!k.alive()) return;
      if (++round < rounds.length) begin(); else k.win();
    }, 1200);
  };
  // Size the pieces so the day box and every piece fit below the words.
  const fit = () => {
    const W = field.clientWidth, room = field.clientHeight - k.head() - 8, all = rounds.flatMap(r => r.items).length;
    let p = 110;
    for (; p > 40; p -= 2) {
      const rows = Math.ceil(all / Math.max(1, Math.floor((W * 0.96) / (p + 12))));
      if (64 + p * 0.75 + 16 + rows * (p + 12) <= room) break;
    }
    field.style.setProperty('--p', `${p}px`);
    box.style.top = `${k.head()}px`;
  };
  fit();
  for (const id of shuffle(rounds.flatMap(r => r.items))) {
    const piece = el('button', 'piece');
    piece.dataset.id = id;
    piece.setAttribute('aria-label', k.names[id] ?? id);
    piece.append(img(prop(id)));
    let from = null, moved = false;
    drag(piece, {
      down: e => { if (piece.classList.contains('placed')) return false; from = { x: e.clientX, y: e.clientY }; moved = false; piece.classList.add('held'); },
      move: e => {
        const dx = e.clientX - from.x, dy = e.clientY - from.y;
        if (Math.hypot(dx, dy) > 8) moved = true;
        piece.style.translate = `${dx}px ${dy}px`;
      },
      up: e => {
        piece.classList.remove('held');
        piece.style.translate = '';
        const r = box.getBoundingClientRect();
        const over = e.clientX > r.left && e.clientX < r.right && e.clientY > r.top - 30 && e.clientY < r.bottom + 30;
        if (!moved || over) choose(piece);
      },
    });
    pool.append(piece);
  }
  begin();
}

// ---- Animal Memory: cards face down; turn two, and if they match they stay up.
function memory(k) {
  const { field, game, sound } = k;
  const kinds = shuffle([...game.pieces]).slice(0, game.count ?? 6);
  const grid = el('div', 'cards');
  field.append(grid);
  // As big as the cards can be in the room below the words: 4 across when it's wide, 3 when tall.
  const W = field.clientWidth, room = field.clientHeight - k.head() - 10, cols = W > room ? 4 : 3, rows = Math.ceil((kinds.length * 2) / cols);
  const c = Math.floor(Math.min(150, (room - (rows - 1) * 10) / rows, (W * 0.94 - (cols - 1) * 10) / cols));
  grid.style.setProperty('--cols', cols);
  grid.style.setProperty('--c', `${c}px`);
  grid.style.top = `${k.head() + Math.max(0, (room - rows * c - (rows - 1) * 10) / 2)}px`;
  let open = [], busy = false, left = kinds.length;
  k.progress(`0 of ${kinds.length} pairs`);
  k.line('intro');
  for (const kind of shuffle([...kinds, ...kinds])) {
    const card = el('button', 'card');
    card.setAttribute('aria-label', 'A card, face down');
    const face = el('div', 'face');
    face.append(img(prop(kind)));
    card.append(el('div', 'back'), face);
    card.onclick = async () => {
      if (busy || card.classList.contains('up')) return;
      card.classList.add('up');
      card.setAttribute('aria-label', k.names[kind] ?? kind);
      if (sound.ready) sound.pluck(74 + kinds.indexOf(kind) * 2, sound.ctx.currentTime, 0.07);
      open.push({ card, kind });
      if (open.length < 2) return;
      const [a, b] = open;
      open = [];
      busy = true;
      if (a.kind !== b.kind) {
        await new Promise(r => setTimeout(r, 900));
        for (const c of [a.card, b.card]) { c.classList.remove('up'); c.setAttribute('aria-label', 'A card, face down'); }
        busy = false;
        return;
      }
      for (const c of [a.card, b.card]) c.classList.add('matched');
      sound.sticker?.();
      navigator.vibrate?.(15);
      k.say(game.lines.pair.replace('{name}', k.names[kind] ?? kind), `pair-${kind}`);
      left--;
      k.progress(`${kinds.length - left} of ${kinds.length} pairs`);
      busy = false;
      if (!left) setTimeout(() => k.alive() && k.win(), 900);
    };
    grid.append(card);
  }
}

// ---- Float the Basket: the basket drifts along; drag up and down to steer it.
function float(k) {
  const { field, game, sound } = k;
  const total = game.count ?? 8;
  const W = () => field.clientWidth, H = () => field.clientHeight;
  const size = () => Math.min(W() * 0.16, H() * 0.24);
  const basket = img(prop('basket'), 'basket');
  field.append(basket);
  const things = [];
  let y = 0.66, aim = 0.66, got = 0, last = 0, spawnAt = 0.6, bumpUntil = 0;
  const top = 0.44, bottom = 0.88;
  const count = tally(k);
  k.progress(`0 of ${total} lilies`);
  k.line('intro');
  drag(field, {
    down: e => { aim = clamp((e.clientY - field.getBoundingClientRect().top) / H(), top, bottom); },
    move: e => { aim = clamp((e.clientY - field.getBoundingClientRect().top) / H(), top, bottom); },
  });
  k.loop((t, dt) => {
    // Steer gently toward the finger, bobbing on the water.
    y += (aim - y) * Math.min(1, dt * 5);
    const s = size(), bx = W() * 0.2, by = y * H() + Math.sin(t * 2.2) * s * 0.04;
    basket.style.width = `${s}px`;
    put(basket, bx, by);
    basket.style.rotate = `${Math.sin(t * 1.7) * 4 + (t < bumpUntil ? Math.sin(t * 40) * 8 : 0)}deg`;
    // New things drift in from the right: lilies to collect, and rocks and reeds to steer around.
    if (got < total && t > spawnAt) {
      const lily = Math.random() < 0.55;
      const kind = lily ? 'lotus' : Math.random() < 0.5 ? 'rock' : 'reeds';
      const node = img(prop(kind), `drift ${kind}`);
      field.append(node);
      things.push({ node, kind, x: W() + s, y: rand(top, bottom) * H(), hit: false });
      spawnAt = t + rand(0.9, 1.5);
    }
    const speed = W() * 0.17;
    for (let i = things.length - 1; i >= 0; i--) {
      const it = things[i];
      it.x -= speed * dt;
      const w = s * (it.kind === 'lotus' ? 0.7 : it.kind === 'rock' ? 0.85 : 1);
      it.node.style.width = `${w}px`;
      put(it.node, it.x, it.y);
      if (!it.hit && got < total && Math.hypot(it.x - bx, (it.y - by) * 1.3) < (s + w) * 0.36) {
        it.hit = true;
        if (it.kind === 'lotus') {
          got++;
          count(got);
          k.progress(`${got} of ${total} lilies`);
          sound.star?.(1 - got / total, 1);
          navigator.vibrate?.(10);
          it.node.classList.add('got');
          setTimeout(() => it.node.remove(), 500);
          things.splice(i, 1);
          if (got === total) {
            k.backdrop(game.end);
            setTimeout(() => k.alive() && k.win(), 1400);
          }
          continue;
        }
        sound.splash?.(undefined, 0.6);
        bumpUntil = t + 0.4;
        if (t - last > 5) { last = t; k.line('bump'); }
        it.node.classList.add('bumped');
      }
      if (it.x < -w) { it.node.remove(); things.splice(i, 1); }
    }
  });
}

// ---- Frog Frenzy: frogs pop up all over the palace; tap them and they hop away.
function frogs(k) {
  const { field, game, sound } = k;
  const total = game.count ?? 15;
  let got = 0, nextAt = 0.4;
  const live = [];
  const count = tally(k);
  k.progress(`0 of ${total} frogs`);
  k.line('intro');
  k.loop(t => {
    if (got >= total) return;
    const pace = got / total;                       // they come faster as you go
    if (t > nextAt && live.length < 1 + Math.round(pace * 2)) {
      const W = field.clientWidth, H = field.clientHeight;
      let x, y, tries = 0;
      do { x = rand(0.08, 0.92) * W; y = rand(0.64, 0.9) * H; } while (live.some(f => Math.hypot(f.x - x, f.y - y) < W * 0.12) && ++tries < 30);
      const frog = el('button', 'frog');
      frog.setAttribute('aria-label', 'A frog');
      const face = img(prop('frog'));
      if (Math.random() < 0.5) face.style.transform = 'scaleX(-1)';
      frog.append(face);
      frog.style.width = `${Math.min(W * 0.11, H * 0.17)}px`;
      put(frog, x, y);
      field.append(frog);
      const f = { frog, x, y, until: t + 1.8 - pace * 0.8 };
      live.push(f);
      frog.onpointerdown = e => {
        e.preventDefault();
        if (frog.classList.contains('caught')) return;
        frog.classList.add('caught');
        live.splice(live.indexOf(f), 1);
        got++;
        count(got);
        k.progress(`${got} of ${total} frogs`);
        sound.ribbit?.();
        navigator.vibrate?.(10);
        setTimeout(() => frog.remove(), 700);
        if (got === total) setTimeout(() => k.alive() && k.win(), 900);
      };
      nextAt = t + rand(0.5, 1.1) - pace * 0.3;
    }
    for (let i = live.length - 1; i >= 0; i--) {
      const f = live[i];
      if (t < f.until) continue;
      f.frog.classList.add('away');            // missed: it hops off on its own, no harm done
      setTimeout(() => f.frog.remove(), 600);
      live.splice(i, 1);
    }
  });
}

// ---- Part the Sea: swipe across the water three times; then tap each family to send them across.
function part(k) {
  const { field, game, sound } = k;
  const total = game.count ?? 6;
  let swipes = 0, crossed = 0, open = false;
  k.progress(`Swipe the sea`);
  k.line('intro');
  let from = null, travelled = 0, lastPt = null;
  drag(field, {
    down: e => { if (open) return false; from = lastPt = { x: e.clientX, y: e.clientY }; travelled = 0; },
    move: e => {
      const d = Math.hypot(e.clientX - lastPt.x, e.clientY - lastPt.y);
      travelled += d;
      lastPt = { x: e.clientX, y: e.clientY };
      if (d > 4) {
        const box = field.getBoundingClientRect(), dot = el('i', 'trail');
        put(dot, e.clientX - box.left, e.clientY - box.top);
        field.append(dot);
        setTimeout(() => dot.remove(), 700);
      }
    },
    up: () => {
      if (open || travelled < field.clientWidth * 0.25) return;
      swipes++;
      sound.whoosh?.(0.6 + swipes * 0.3);
      navigator.vibrate?.(20);
      field.classList.remove('shake'); void field.offsetWidth; field.classList.add('shake');
      if (swipes < 3) { k.progress(`${swipes} of 3 swipes`); k.line('more'); return; }
      open = true;
      sound.partSea?.();
      k.backdrop(game.reveal);
      k.progress(`0 of ${total} families`);
      setTimeout(() => { if (k.alive()) { k.line('parted'); families(); } }, 1600);
    },
  });
  const families = () => {
    const W = field.clientWidth, H = field.clientHeight;
    const s = Math.min(W * 0.15, H * 0.3);
    for (let i = 0; i < total; i++) {
      const fam = el('button', 'walker');
      fam.setAttribute('aria-label', 'A family');
      fam.append(img(prop(i % 2 ? 'family2' : 'family')));
      fam.style.width = `${s}px`;
      put(fam, W * (0.6 + (i % 3) * 0.14), H * (0.66 + Math.floor(i / 3) * 0.2));
      field.append(fam);
      fam.onclick = () => {
        if (fam.classList.contains('going')) return;
        fam.classList.add('going');
        if (sound.ready) sound.pluck(70 + crossed * 2, sound.ctx.currentTime, 0.08);
        // Along the dry path between the walls of water, getting smaller into the distance.
        const pts = game.path.map(([px, py]) => k.screen(px, py));
        const here = { x: parseFloat(fam.style.left), y: parseFloat(fam.style.top) };
        const frames = [here, ...pts].map((p, j, all) => ({
          left: `${p.x}px`, top: `${p.y}px`, scale: `${1 - (j / (all.length - 1)) * 0.82}`, opacity: j === all.length - 1 ? 0 : 1,
        }));
        fam.animate(frames, { duration: 3600, easing: 'ease-in-out', fill: 'forwards' });
        if (++crossed === total) setTimeout(() => k.alive() && k.win(), 3400);
        k.progress(`${crossed} of ${total} families`);
      };
    }
  };
}

// ---- To the Beach: drag the big fish from one shining light to the next, all the way to the shore.
function trace(k) {
  const { field, game, sound } = k;
  const n = game.count ?? 12;
  const W = () => field.clientWidth, H = () => field.clientHeight;
  const at = i => ({ x: W() * (0.12 + (0.76 * i) / (n - 1)), y: H() * (0.6 + Math.sin((i / (n - 1)) * Math.PI * 2) * 0.14) });
  const lights = Array.from({ length: n }, (_, i) => { const d = el('i', 'light'); field.append(d); return d; });
  const fish = img(game.fish, 'swimmer');
  field.append(fish);
  let next = 1, pos = at(0), aim = at(0), facing = 1, done = false;
  k.progress(`0 of ${n - 1}`);
  k.line('intro');
  const toLocal = e => { const b = field.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
  drag(field, { down: e => { if (done) return false; aim = toLocal(e); }, move: e => { aim = toLocal(e); } });
  k.loop((t, dt) => {
    const s = Math.min(W() * 0.26, H() * 0.36);
    lights.forEach((d, i) => put(d, at(i).x, at(i).y));
    lights[next]?.classList.add('next');
    pos = { x: pos.x + (aim.x - pos.x) * Math.min(1, dt * 6), y: pos.y + (aim.y - pos.y) * Math.min(1, dt * 6) };
    if (Math.abs(aim.x - pos.x) > 2) facing = aim.x > pos.x ? -1 : 1;   // the fish faces left in its picture
    fish.style.width = `${s}px`;
    fish.style.transform = `translate(-50%, -50%) scaleX(${facing}) rotate(${Math.sin(t * 3) * 3}deg)`;
    put(fish, pos.x, pos.y);
    if (done || next >= n) return;
    const p = at(next);
    if (Math.hypot(p.x - pos.x, p.y - pos.y) > s * 0.45) return;
    lights[next].classList.remove('next');
    lights[next].classList.add('lit');
    sound.star?.(1 - next / n, 1);
    navigator.vibrate?.(8);
    k.progress(`${next} of ${n - 1}`);
    if (++next < n) return;
    done = true;
    k.backdrop(game.reveal);
    sound.gulp?.();
    const jonah = img(game.jonah, 'tumble');
    jonah.style.width = `${s * 0.5}px`;
    put(jonah, pos.x, pos.y);
    field.append(jonah);
    setTimeout(() => k.alive() && k.win(), 1800);
  });
}

// ---- Stable Puzzle: the picture cut into pieces; drag each to where it belongs.
// `crop` is the part of the painting to use ([x0, y0, x1, y1], fractions), so no piece is blank.
function puzzle(k) {
  const { field, game, sound } = k;
  const cols = game.cols ?? 3, rows = game.rows ?? 2, total = cols * rows;
  const [x0, y0, x1, y1] = game.crop ?? [0, 0, 1, 1];
  const aspect = ((x1 - x0) * 16) / ((y1 - y0) * 9);
  const W = field.clientWidth, H = field.clientHeight, top = k.head(), room = H - top - 10;
  // Wide and short (a phone on its side): the board on the left, the pieces beside it. Otherwise
  // the board on top and the pieces below.
  const side = W > room * aspect * 1.7;
  const bh = side ? room : Math.min(room * 0.58, (W * 0.86) / aspect), bw = bh * aspect;
  const bx = side ? Math.max(12, W * 0.48 - bw) : (W - bw) / 2, by = top;
  const tw = bw / cols, th = bh / rows;
  const full = { w: bw / (x1 - x0), h: bw / (x1 - x0) * (9 / 16) };
  const board = el('div', 'board');
  Object.assign(board.style, {
    left: `${bx}px`, top: `${by}px`, width: `${bw}px`, height: `${bh}px`, backgroundImage: `url("${game.puzzle}")`,
    backgroundSize: `${full.w}px ${full.h}px`, backgroundPosition: `${-x0 * full.w}px ${-y0 * full.h}px`,
  });
  field.append(board);
  // Where the loose pieces wait, a little smaller than they'll be.
  const pool = side ? { x: bx + bw + 20, y: by, w: W - (bx + bw + 20) - 12, h: room } : { x: 12, y: by + bh + 14, w: W - 24, h: H - (by + bh + 14) - 10 };
  let perRow = total, scale = 0;
  for (let n = 1; n <= total; n++) {
    const r = Math.ceil(total / n), sc = Math.min(0.8, (pool.w - (n - 1) * 10) / n / tw, (pool.h - (r - 1) * 10) / r / th);
    if (sc > scale) { scale = sc; perRow = n; }
  }
  const rowsUsed = Math.ceil(total / perRow);
  let placed = 0;
  k.progress(`0 of ${total} pieces`);
  k.line('intro');
  shuffle([...Array(total).keys()]).forEach((cell, slot) => {
    const c = cell % cols, r = Math.floor(cell / cols);
    const tile = el('div', 'tile');
    Object.assign(tile.style, {
      width: `${tw}px`, height: `${th}px`, backgroundImage: `url("${game.puzzle}")`, backgroundSize: `${full.w}px ${full.h}px`,
      backgroundPosition: `${-x0 * full.w - c * tw}px ${-y0 * full.h - r * th}px`,
    });
    const row = Math.floor(slot / perRow), inRow = Math.min(perRow, total - row * perRow);
    const home = {
      x: pool.x + pool.w / 2 + (slot % perRow - (inRow - 1) / 2) * (tw * scale + 10),
      y: pool.y + pool.h / 2 + (row - (rowsUsed - 1) / 2) * (th * scale + 10),
    };
    const goal = { x: bx + (c + 0.5) * tw, y: by + (r + 0.5) * th };
    const rest = () => { tile.style.scale = `${scale}`; put(tile, home.x, home.y); };
    rest();
    field.append(tile);
    let grab = null;
    drag(tile, {
      down: e => { if (tile.classList.contains('placed')) return false; grab = { x: e.clientX, y: e.clientY, left: parseFloat(tile.style.left), top: parseFloat(tile.style.top) }; tile.classList.add('held'); tile.style.scale = '1'; },
      move: e => put(tile, grab.left + e.clientX - grab.x, grab.top + e.clientY - grab.y),
      up: () => {
        tile.classList.remove('held');
        const x = parseFloat(tile.style.left), y = parseFloat(tile.style.top);
        if (Math.hypot(x - goal.x, y - goal.y) < Math.min(tw, th) * 0.45) {
          put(tile, goal.x, goal.y);
          tile.classList.add('placed');
          if (sound.ready) sound.pluck(72 + placed * 2, sound.ctx.currentTime, 0.1);
          navigator.vibrate?.(12);
          k.progress(`${++placed} of ${total} pieces`);
          if (placed === total) {
            board.classList.add('done');
            sound.sticker?.();
            setTimeout(() => k.alive() && k.win(), 1000);
          }
          return;
        }
        // Not there: back to the pile, and the right place glows for a moment.
        rest();
        const hint = el('div', 'hint');
        Object.assign(hint.style, { left: `${goal.x}px`, top: `${goal.y}px`, width: `${tw}px`, height: `${th}px` });
        field.append(hint);
        setTimeout(() => hint.remove(), 1200);
      },
    });
  });
}

// ---- Fill the Nets: fish leap out of the water; sweep the net through them (or tap them).
function net(k) {
  const { field, game, sound } = k;
  const total = game.count ?? 12;
  const W = () => field.clientWidth, H = () => field.clientHeight;
  const hoop = el('div', 'hoop');
  field.append(hoop);
  let hx = 0.5, hy = 0.6, got = 0, nextAt = 0.5;
  const fish = [];
  const count = tally(k);
  k.progress(`0 of ${total} fish`);
  k.line('intro');
  const aim = e => { const b = field.getBoundingClientRect(); hx = (e.clientX - b.left) / W(); hy = (e.clientY - b.top) / H(); };
  drag(field, { down: aim, move: aim });
  const catchIt = f => {
    if (f.caught) return;
    f.caught = true;
    got++;
    count(got);
    k.progress(`${got} of ${total} fish`);
    sound.splash?.(undefined, 0.5);
    if (sound.ready) sound.pluck(72 + (got % 6) * 2, sound.ctx.currentTime + 0.05, 0.07);
    navigator.vibrate?.(10);
    f.node.classList.add('caught');
    setTimeout(() => f.node.remove(), 500);
    if (got === total) {
      k.backdrop(game.reveal);
      setTimeout(() => k.alive() && k.win(), 1400);
    }
  };
  k.loop(t => {
    const r = Math.min(W(), H()) * 0.13, water = game.water ?? 0.8;
    hoop.style.width = hoop.style.height = `${r * 2}px`;
    put(hoop, hx * W(), hy * H());
    if (got < total && t > nextAt) {
      const node = img(prop('fish'), 'leaper');
      node.onpointerdown = e => { e.preventDefault(); e.stopPropagation(); catchIt(f); };
      field.append(node);
      const x0 = rand(0.12, 0.88), dir = x0 > 0.5 ? -1 : 1;
      const f = { node, t0: t, x0, vx: dir * rand(0.08, 0.16), peak: rand(0.22, 0.38), dur: rand(1.6, 2.2), caught: false };
      fish.push(f);
      nextAt = t + rand(0.5, 0.9);
    }
    const s = Math.min(W() * 0.08, H() * 0.12);
    for (let i = fish.length - 1; i >= 0; i--) {
      const f = fish[i], u = (t - f.t0) / f.dur;
      if (f.caught) { fish.splice(i, 1); continue; }
      if (u > 1) { f.node.remove(); fish.splice(i, 1); continue; }
      const x = (f.x0 + f.vx * u) * W(), y = (water - f.peak * 4 * u * (1 - u)) * H();
      f.node.style.width = `${s}px`;
      f.node.style.transform = `translate(-50%, -50%) scaleX(${f.vx < 0 ? -1 : 1}) rotate(${(u - 0.5) * 70 * Math.sign(f.vx)}deg)`;
      put(f.node, x, y);
      if (Math.hypot(x - hx * W(), y - hy * H()) < r * 0.9) catchIt(f);
    }
  });
}

// ---- Five Smooth Stones: pick the smooth stones from the stream, then pull back the sling and let go.
function sling(k) {
  const { field, game, sound } = k;
  const W = () => field.clientWidth, H = () => field.clientHeight;
  let bagged = 0, lastNope = 0;
  k.progress('0 of 5 stones');
  k.line('intro');
  const bag = img(prop('bag'), 'bag');
  bag.style.width = `${Math.min(W() * 0.13, H() * 0.2)}px`;
  put(bag, W() * 0.1, H() * 0.82);
  field.append(bag);
  const spots = [];
  const kinds = shuffle(['smooth', 'smooth', 'smooth', 'smooth', 'smooth', 'rough', 'rough', 'rough', 'rough', 'rough']);
  for (const kind of kinds) {
    let x, y, tries = 0;
    do { x = rand(0.24, 0.92); y = rand(0.55, 0.9); } while (spots.some(([a, b]) => Math.hypot(a - x, (b - y) * 0.7) < 0.1) && ++tries < 40);
    spots.push([x, y]);
    const stone = el('button', `stone ${kind}`);
    stone.setAttribute('aria-label', kind === 'smooth' ? 'A smooth stone' : 'A rough, pointy rock');
    stone.append(img(prop(kind)));
    stone.style.width = `${Math.min(W() * 0.07, H() * 0.11) * rand(0.9, 1.15)}px`;
    put(stone, x * W(), y * H());
    field.append(stone);
    stone.onclick = () => {
      if (stone.classList.contains('bagged') || bagged >= 5) return;
      if (kind === 'rough') {
        stone.classList.remove('nope'); void stone.offsetWidth; stone.classList.add('nope');
        sound.boop?.();
        if (performance.now() - lastNope > 4000) { lastNope = performance.now(); k.line('rough'); }
        return;
      }
      stone.classList.add('bagged');
      put(stone, W() * 0.1, H() * 0.8);
      if (sound.ready) sound.pluck(70 + bagged * 3, sound.ctx.currentTime, 0.1);
      navigator.vibrate?.(10);
      k.progress(`${++bagged} of 5 stones`);
      if (bagged === 5) setTimeout(() => k.alive() && aimAt(), 900);
    };
  }

  const aimAt = () => {
    field.querySelectorAll('.stone, .bag').forEach(n => n.remove());
    k.backdrop(game.sling);
    k.line('ready');
    k.progress('Aim for the helmet');
    const o = k.screen(...game.from), goal = k.screen(...game.target);
    const ring = el('div', 'ring');
    field.append(ring);
    const band = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    band.classList.add('band');
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    band.append(line);
    field.append(band);
    const stone = img(prop('smooth'), 'shot');
    const ss = Math.min(W(), H()) * 0.05;
    stone.style.width = `${ss}px`;
    field.append(stone);
    let misses = 0, flying = null, pull = null, hit = false;
    const reach = () => Math.min(W(), H()) * (0.09 + Math.min(misses, 3) * 0.025);
    const g = () => H() * 1.6, maxPull = () => Math.min(W(), H()) * 0.22;
    const reset = () => { flying = null; pull = null; put(stone, o.x, o.y); line.setAttribute('x1', o.x); line.setAttribute('y1', o.y); line.setAttribute('x2', o.x); line.setAttribute('y2', o.y); };
    reset();
    const local = e => { const b = field.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
    drag(field, {
      down: e => { if (flying || hit) return false; pull = { x: 0, y: 0 }; const p = local(e); pull.start = p; },
      move: e => {
        if (!pull) return;
        const p = local(e);
        let dx = p.x - pull.start.x, dy = p.y - pull.start.y;
        const len = Math.hypot(dx, dy), m = maxPull();
        if (len > m) { dx *= m / len; dy *= m / len; }
        pull.x = dx; pull.y = dy;
        put(stone, o.x + dx, o.y + dy);
        line.setAttribute('x2', o.x + dx); line.setAttribute('y2', o.y + dy);
      },
      up: () => {
        if (!pull) return;
        const len = Math.hypot(pull.x, pull.y);
        if (len < 12) { reset(); return; }
        // Let go: the stone flies the opposite way from the pull. After a few misses, it's helped along.
        const power = Math.sqrt(1.5 * W() * g()) / maxPull();
        let vx = -pull.x * power, vy = -pull.y * power;
        if (misses >= 4) { const t = 0.8; vx = (goal.x - o.x) / t; vy = (goal.y - o.y - 0.5 * g() * t * t) / t; }
        flying = { x: o.x, y: o.y, vx, vy };
        pull = null;
        line.setAttribute('x2', o.x); line.setAttribute('y2', o.y);
        sound.whoosh?.(0.7);
      },
    });
    k.loop((t, dt) => {
      const r = reach();
      ring.style.width = ring.style.height = `${r * 2}px`;
      put(ring, goal.x, goal.y);
      line.setAttribute('x1', o.x); line.setAttribute('y1', o.y);
      if (!flying) return;
      flying.vy += g() * dt;
      flying.x += flying.vx * dt;
      flying.y += flying.vy * dt;
      put(stone, flying.x, flying.y);
      if (Math.hypot(flying.x - goal.x, flying.y - goal.y) < r) {
        hit = true;
        flying = null;
        stone.remove(); ring.remove(); band.remove();
        sound.thud?.();
        navigator.vibrate?.([30, 40, 60]);
        k.backdrop(game.fallen);
        field.classList.remove('shake'); void field.offsetWidth; field.classList.add('shake');
        k.line('hit');
        k.progress('Hit!');
        setTimeout(() => k.alive() && k.win(), 1800);
        return;
      }
      if (flying.y > H() + 40 || flying.x > W() + 40 || flying.x < -40) {
        misses++;
        if (misses === 1 || misses % 2 === 0) k.line('miss');
        setTimeout(() => k.alive() && !hit && reset(), 300);
        flying = null;
      }
    });
  };
}

// ---- Hush the Lions: the lions roar and roar; stroke each one (or tap it) until it curls up asleep.
function hush(k) {
  const { field, game, sound } = k;
  const total = game.count ?? 5;
  const SPOTS = [[0.2, 0.67], [0.5, 0.65], [0.8, 0.67], [0.33, 0.86], [0.67, 0.86]];   // all on the sandy floor
  let asleep = 0, lastRoar = 0, nextRoar = 1.2;
  k.progress(`0 of ${total} lions asleep`);
  k.line('intro');
  const lions = [];
  const layout = () => {
    const W = field.clientWidth, H = field.clientHeight;
    const s = Math.min(W * 0.27, H * 0.3);
    for (const l of lions) {
      l.node.style.width = `${s}px`;
      put(l.node, W * l.at[0], Math.max(k.head() + s * 0.35, H * l.at[1]));
    }
    return s;
  };
  for (let i = 0; i < total; i++) {
    const node = el('button', 'lion');
    node.setAttribute('aria-label', 'A roaring lion');
    const face = img(prop('lion'));
    const sleep = img(prop('lion-asleep'), 'sleep');
    if (i % 2) { face.style.transform = sleep.style.transform = 'scaleX(-1)'; }
    node.append(face, sleep);
    field.append(node);
    const l = { node, at: SPOTS[i % SPOTS.length], calm: 0, asleep: false, hearts: 0 };
    lions.push(l);
    let last = null;
    const soothe = amount => {
      if (l.asleep) return;
      l.calm = Math.min(1, l.calm + amount);
      node.style.setProperty('--calm', l.calm);
      // A little heart for every bit calmer.
      while (l.hearts < Math.floor(l.calm * 5)) {
        l.hearts++;
        const heart = el('i', 'heart', '♥');
        const r = node.getBoundingClientRect(), box = field.getBoundingClientRect();
        put(heart, r.left - box.left + r.width * rand(0.3, 0.7), r.top - box.top + r.height * 0.3);
        field.append(heart);
        setTimeout(() => heart.remove(), 1000);
        if (sound.ready) sound.pluck(67 + l.hearts * 2, sound.ctx.currentTime, 0.06);
      }
      if (l.calm < 1) return;
      l.asleep = true;
      node.classList.remove('roar');
      node.classList.add('asleep');
      node.setAttribute('aria-label', 'A sleeping lion');
      const z = el('i', 'zzz', 'z z z');
      node.append(z);
      sound.sing?.('musicbox', 0.4);
      navigator.vibrate?.(15);
      k.progress(`${++asleep} of ${total} lions asleep`);
      if (asleep === total) {
        k.backdrop(game.reveal);
        setTimeout(() => k.alive() && k.win(), 1600);
      } else if (asleep === 1) k.line('first');
    };
    drag(node, {
      down: e => { if (l.asleep) return false; last = { x: e.clientX, y: e.clientY, at: performance.now() }; },
      move: e => {
        const d = Math.hypot(e.clientX - last.x, e.clientY - last.y);
        last = { x: e.clientX, y: e.clientY, at: last.at };
        soothe(d / (node.offsetWidth * 3));
      },
      up: () => { if (performance.now() - last.at < 300) soothe(0.34); },   // a tap helps too
    });
  }
  layout();
  addEventListener('resize', () => k.alive() && layout());
  k.loop(t => {
    if (asleep >= total || t < nextRoar) return;
    const awake = lions.filter(l => !l.asleep);
    const l = awake[(Math.random() * awake.length) | 0];
    l.node.classList.remove('roar'); void l.node.offsetWidth; l.node.classList.add('roar');
    if (t - lastRoar > 1.6) { sound.roar?.(); lastRoar = t; }
    nextRoar = t + rand(1.4, 2.6);
  });
}

// ---- Color the Coat: choose a paint pot, then tap each stripe of Joseph's coat to color it.
function coat(k) {
  const { field, game, sound } = k;
  const COLORS = game.colors;
  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs) => { const n = document.createElementNS(NS, tag); for (const [a, v] of Object.entries(attrs)) n.setAttribute(a, v); return n; };
  const ROBE = 'M72 18 Q100 44 128 18 L162 30 Q186 80 197 150 L167 160 L148 78 L172 250 Q100 262 28 250 L52 78 L33 160 L3 150 Q14 80 38 30 Z';   // a long robe with long, wide sleeves
  const svg = svgEl('svg', { viewBox: '0 0 200 264', class: 'robe' });
  const defs = svgEl('defs', {});
  const clip = svgEl('clipPath', { id: 'robe-clip' });
  clip.append(svgEl('path', { d: ROBE }));
  // A paper grain over every color, so it looks cut from paper like the rest of the book.
  const grain = svgEl('filter', { id: 'grain' });
  grain.append(svgEl('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.9', numOctaves: '2', result: 'n' }),
    svgEl('feColorMatrix', { in: 'n', type: 'matrix', values: '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.16 0', result: 'g' }),
    svgEl('feComposite', { in: 'g', in2: 'SourceGraphic', operator: 'in', result: 'gg' }),
    svgEl('feMerge', {}));
  grain.lastChild.append(svgEl('feMergeNode', { in: 'SourceGraphic' }), svgEl('feMergeNode', { in: 'gg' }));
  defs.append(clip, grain);
  svg.append(defs);
  const bands = svgEl('g', { 'clip-path': 'url(#robe-clip)', filter: 'url(#grain)' });
  const n = COLORS.length, y0 = 16, h = (254 - y0) / n;
  const stripes = [];
  for (let i = 0; i < n; i++) {
    const r = svgEl('rect', { x: 0, y: y0 + i * h, width: 200, height: h + 0.6, fill: i % 2 ? '#efe4cc' : '#f6eedb', class: 'stripe' });
    r.setAttribute('aria-label', `Stripe ${i + 1}`);
    bands.append(r);
    stripes.push({ node: r, color: null });
    if (i) bands.append(svgEl('line', { x1: 0, x2: 200, y1: y0 + i * h, y2: y0 + i * h, class: 'seam' }));
  }
  svg.append(bands, svgEl('path', { d: ROBE, class: 'edge' }));
  const box = el('div', 'coatbox');
  box.append(svg);
  const pots = el('div', 'pots');
  let chosen = null, painted = 0;
  for (const c of COLORS) {
    const pot = el('button', 'pot');
    pot.style.setProperty('--c', c.hex);
    pot.setAttribute('aria-label', c.name);
    pot.onclick = () => {
      chosen = c;
      pots.querySelectorAll('.pot').forEach(p => p.classList.toggle('on', p === pot));
      if (sound.ready) sound.pluck(64 + COLORS.indexOf(c) * 2, sound.ctx.currentTime, 0.09);
      k.say(`${c.name}!`, `color-${c.id}`);
    };
    pots.append(pot);
  }
  field.append(box, pots);
  stripes.forEach((s, i) => {
    s.node.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (!chosen) { pots.classList.remove('nudge'); void pots.offsetWidth; pots.classList.add('nudge'); k.line('pick'); return; }
      const fresh = !s.color;
      s.color = chosen;
      s.node.setAttribute('fill', chosen.hex);
      s.node.classList.remove('wet'); void s.node.getBBox(); s.node.classList.add('wet');
      sound.splash?.(undefined, 0.25);
      if (sound.ready) sound.pluck(72 + i * 2, sound.ctx.currentTime + 0.04, 0.08);
      navigator.vibrate?.(8);
      if (!fresh) return;
      k.progress(`${++painted} of ${n} stripes`);
      if (painted === n) {
        box.classList.add('twirl');
        sound.sticker?.();
        setTimeout(() => k.alive() && k.win(), 1500);
      }
    });
  });
  const layout = () => {
    const W = field.clientWidth, top = k.head(), room = field.clientHeight - top;
    const wide = W > room * 1.3;
    const p = Math.min(wide ? room / (n + 1.2) : W / (n + 1.5), 74);
    field.style.setProperty('--pot', `${p}px`);
    pots.classList.toggle('column', wide);
    const coatH = Math.min(wide ? room * 0.94 : room - p - 30, (wide ? W * 0.6 : W * 0.9) * 264 / 200);
    svg.style.height = `${coatH}px`;
    svg.style.width = `${coatH * 200 / 264}px`;
    if (wide) { put(box, W * 0.46, top + room / 2); put(pots, W * 0.46 + coatH * 0.38 + p + 24, top + room / 2); }
    else { put(box, W / 2, top + coatH / 2 + 4); put(pots, W / 2, top + coatH + 18 + p / 2); }
  };
  layout();
  addEventListener('resize', () => k.alive() && layout());
  k.progress(`0 of ${n} stripes`);
  k.line('intro');
}

// ---- Pay It Back: drag coins from Zacchaeus' purse to each person, four coins each, counting as you go.
function give(k) {
  const { field, game, sound } = k;
  const each = game.each ?? 4, people = game.people;
  const W = () => field.clientWidth, H = () => field.clientHeight;
  let given = 0, lastFull = 0;
  const total = each * people.length;
  k.progress(`0 of ${total} coins`);
  k.line('intro');
  const folks = people.map((id, i) => {
    const node = el('div', 'person');
    node.append(img(prop(id)));
    const dots = el('div', 'dots');
    for (let j = 0; j < each; j++) dots.append(el('i'));
    node.append(dots);
    field.append(node);
    return { node, dots, got: 0, i };
  });
  const purse = el('button', 'purse');
  purse.setAttribute('aria-label', 'Zacchaeus’ coin purse');
  purse.append(img(prop('purse')));
  field.append(purse);
  const layout = () => {
    const top = k.head(), room = H() - top;
    const s = Math.min(W() / (people.length + 0.3), room * 0.34);
    // Everyone the same height, standing on one line, with their coins beneath their feet.
    folks.forEach(f => { f.node.style.setProperty('--ph', `${Math.min((W() / people.length) * 1.75, room * 0.46)}px`); put(f.node, W() * ((f.i + 0.5) / people.length), top + room * 0.6); });
    const ps = Math.min(W() * 0.32, room * 0.24);
    purse.style.width = `${ps}px`;
    put(purse, W() / 2, top + room * 0.8);
  };
  layout();
  addEventListener('resize', () => k.alive() && layout());
  const pay = (f, coin) => {
    if (f.got >= each) {
      coin.remove();
      f.node.classList.remove('nope'); void f.node.offsetWidth; f.node.classList.add('nope');
      sound.boop?.();
      if (performance.now() - lastFull > 4000) { lastFull = performance.now(); k.line('full'); }
      return;
    }
    const dot = f.dots.children[f.got++];
    const r = dot.getBoundingClientRect(), b = field.getBoundingClientRect();
    coin.classList.add('landing');
    put(coin, r.left - b.left + r.width / 2, r.top - b.top + r.height / 2);
    setTimeout(() => { coin.remove(); dot.classList.add('got'); }, 350);
    given++;
    k.progress(`${given} of ${total} coins`);
    k.say(game.lines[`count-${f.got}`], `count-${f.got}`);
    sound.jingle?.(sound.ctx?.currentTime, 76 + f.got * 2);
    navigator.vibrate?.(10);
    if (f.got === each) {
      f.node.classList.add('happy');
      setTimeout(() => { if (k.alive() && given < total) k.line('thanks'); }, 700);
    }
    if (given === total) { k.backdrop(game.reveal); setTimeout(() => k.alive() && k.win(), 1600); }
  };
  // Press the purse and a coin comes out under your finger; let go of it on someone.
  let coin = null;
  const near = (x, y) => folks.find(f => { const r = f.node.getBoundingClientRect(); return x > r.left - 20 && x < r.right + 20 && y > r.top - 20 && y < r.bottom + 20; });
  const at = e => { const b = field.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
  let pressAt = 0;
  drag(purse, {
    down: e => {
      if (given >= total) return false;
      pressAt = performance.now();
      coin = img(prop('coin'), 'coin');
      coin.style.width = `${Math.min(W(), H()) * 0.08}px`;
      const p = at(e);
      put(coin, p.x, p.y);
      field.append(coin);
      if (sound.ready) sound.pluck(84, sound.ctx.currentTime, 0.06);
      folks.forEach(f => f.node.classList.toggle('want', f.got < each));
    },
    move: e => { const p = at(e); put(coin, p.x, p.y); const f = near(e.clientX, e.clientY); folks.forEach(g => g.node.classList.toggle('over', g === f)); },
    up: e => {
      folks.forEach(f => f.node.classList.remove('want', 'over'));
      const f = near(e.clientX, e.clientY);
      // A quick tap sends the coin to the next person who still needs one.
      const to = f ?? (performance.now() - pressAt < 300 ? folks.find(g => g.got < each) : null);
      if (to) pay(to, coin);
      else { coin.classList.add('drop'); const c = coin; setTimeout(() => c.remove(), 400); }
      coin = null;
    },
  });
}

// ---- Hosanna Road: lay a palm branch or a cloak on the glowing spot, and the little donkey steps onto it, all the way to the city gate.
function palms(k) {
  const { field, game, sound } = k;
  const path = game.path, steps = path.length - 1;
  const W = () => field.clientWidth, H = () => field.clientHeight;
  let at = 0, busy = false;
  k.progress(`0 of ${steps}`);
  k.line('intro');
  const laid = el('div', 'laid');
  const rider = el('div', 'rider');
  rider.append(img(prop('rider')));
  const glow = el('div', 'spot');
  field.append(laid, glow, rider);
  const pile = el('div', 'pile');
  const KINDS = ['palm', 'cloak', 'palm', 'palm', 'cloak'];
  // The road runs away from us toward the gate, so everything on it gets smaller as it goes (path: [x, y, size]).
  const size = () => Math.min(W() * 0.38, H() * 0.3);
  const scaleAt = i => path[i][2] ?? 1;
  const place = () => {
    const s = size();
    const p = k.screen(path[at][0], path[at][1]);
    rider.style.width = `${s * scaleAt(at)}px`;
    put(rider, p.x, p.y - s * scaleAt(at) * 0.32);
    if (at < steps) { const q = k.screen(path[at + 1][0], path[at + 1][1]); put(glow, q.x, q.y); glow.style.width = `${s * 0.7 * scaleAt(at + 1)}px`; }
    laid.querySelectorAll('img').forEach(n => { const i = +n.dataset.at, q = k.screen(path[i][0], path[i][1]); put(n, q.x, q.y); n.style.width = `${s * 0.75 * scaleAt(i)}px`; });
  };
  const lay = kind => {
    if (busy || at >= steps) return;
    busy = true;
    const q = k.screen(path[at + 1][0], path[at + 1][1]);
    const leaf = img(prop(kind), 'leaf');
    leaf.dataset.at = at + 1;
    leaf.style.rotate = `${rand(-14, 14)}deg`;
    leaf.style.width = `${size() * 0.75 * scaleAt(at + 1)}px`;
    put(leaf, q.x, q.y);
    laid.append(leaf);
    sound.rustle?.();
    if (sound.ready) sound.pluck(65 + at * 2, sound.ctx.currentTime + 0.1, 0.1);
    navigator.vibrate?.(10);
    at++;
    k.progress(`${at} of ${steps}`);
    glow.classList.add('gone');
    // Clip-clop onto it.
    rider.classList.add('walk');
    setTimeout(() => {
      if (!k.alive()) return;
      rider.classList.remove('walk');
      place();
      glow.classList.remove('gone');
      if (at % 3 === 0 && at < steps) { k.line('hosanna'); sound.sing?.('choir', 0.3); }
      if (at === 1) sound.heehaw?.();
      busy = false;
      if (at === steps) {
        glow.remove();
        sound.glory?.();
        setTimeout(() => k.alive() && k.win(), 1200);
      }
    }, 650);
  };
  for (const kind of KINDS) {
    const b = el('button', 'piece');
    b.setAttribute('aria-label', kind === 'palm' ? 'A palm branch' : 'A cloak');
    b.append(img(prop(kind)));
    let from = null, moved = false;
    drag(b, {
      down: e => { from = { x: e.clientX, y: e.clientY }; moved = false; b.classList.add('held'); },
      move: e => { const dx = e.clientX - from.x, dy = e.clientY - from.y; if (Math.hypot(dx, dy) > 8) moved = true; b.style.translate = `${dx}px ${dy}px`; },
      up: e => {
        b.classList.remove('held');
        b.style.translate = '';
        const r = glow.getBoundingClientRect();
        const over = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) < Math.max(70, r.width);
        if (!moved || over) lay(kind);       // a tap lays it too
      },
    });
    pile.append(b);
  }
  field.append(pile);
  place();
  addEventListener('resize', () => k.alive() && place());
}

// ---- March and Shout: press and hold to march the trumpets around Jericho, seven times round; then SHOUT!
function march(k) {
  const { field, game, sound } = k;
  const laps = game.laps ?? 7, [cx, cy] = game.city, [rx, ry] = game.ring;
  const W = () => field.clientWidth, H = () => field.clientHeight;
  let a = Math.PI / 2, went = 0, lap = 0, holding = false, marching = true, lastHorn = -1;
  k.progress(`0 of ${laps} times around`);
  k.line('intro');
  const band = [0, 1, 2, 3].map(() => { const n = el('div', 'marcher'); n.append(img(prop('marcher'))); field.append(n); return n; });
  const hint = el('div', 'holdhint', 'Press and hold to march');
  field.append(hint);
  const shout = el('button', 'shout', 'Shout!');
  shout.hidden = true;
  field.append(shout);
  drag(field, {
    down: e => { if (!marching || e.target === shout) return false; holding = true; hint.classList.add('gone'); },
    up: () => { holding = false; },
  });
  const draw = () => {
    const s0 = Math.min(W() * 0.12, H() * 0.2);
    band.forEach((n, i) => {
      const t = a - i * 0.26, sin = Math.sin(t);
      // Around the walls; on a narrow phone the ring is pulled in so the band stays on screen.
      const c = k.screen(cx, cy), o = k.screen(0, 0), e = k.screen(1, 1);
      const rxp = Math.min(rx * (e.x - o.x), W() * 0.42), ryp = ry * (e.y - o.y);
      const p = { x: c.x + rxp * Math.cos(t), y: c.y + ryp * sin };
      const depth = 0.72 + 0.36 * (sin + 1) / 2;            // smaller at the back, bigger at the front
      n.style.width = `${s0 * depth}px`;
      put(n, p.x, p.y - s0 * depth * 0.4);
      n.style.zIndex = sin > 0 ? 3 : 1;
      n.style.opacity = sin < -0.25 ? 0.35 : 1;              // behind the city, the walls hide them
      n.firstChild.style.transform = sin > 0 ? 'scaleX(-1)' : '';   // along the front they march left
      n.classList.toggle('step', holding && marching);
    });
  };
  k.loop((t, dt) => {
    if (holding && marching) {
      const d = dt * (Math.PI * 2 / 3.2);                    // about three seconds a lap
      a += d; went += d;
      if (t - lastHorn > 0.9) { sound.horn?.(); lastHorn = t; }
      if (went >= Math.PI * 2 * (lap + 1)) {
        lap++;
        k.progress(`${lap} of ${laps} times around`);
        k.say(game.lines[`lap-${lap}`], `lap-${lap}`);
        navigator.vibrate?.(15);
        if (lap === laps) {
          marching = false; holding = false;
          setTimeout(() => { if (!k.alive()) return; k.line('ready'); shout.hidden = false; }, 900);
        }
      }
    }
    draw();
  });
  shout.onclick = () => {
    if (shout.disabled) return;
    shout.disabled = true;
    shout.classList.add('gone');
    sound.horn?.(true);
    setTimeout(() => {
      if (!k.alive()) return;
      sound.shout?.();
      navigator.vibrate?.([30, 40, 60]);
      field.classList.remove('shake'); void field.offsetWidth; field.classList.add('shake');
      k.backdrop(game.reveal);
      band.forEach(n => n.classList.add('cheer'));
      setTimeout(() => k.alive() && k.win(), 2000);
    }, 900);
  };
}

// ---- Fill the Baskets: tap the leftover bread and fish on the grass; two pieces fill a basket, twelve baskets in all.
function gather(k) {
  const { field, game, sound } = k;
  const total = game.count ?? 12, per = game.per ?? 2;
  const W = () => field.clientWidth, H = () => field.clientHeight;
  let filled = 0, inBasket = 0, busy = false;
  k.progress(`0 of ${total} baskets`);
  k.line('intro');
  const shelf = el('div', 'shelf');
  for (let i = 0; i < total; i++) shelf.append(el('i'));
  const basket = el('div', 'catcher');
  basket.append(img(prop('breadbasket')));
  field.append(shelf, basket);
  const pieces = [];
  const layout = () => {
    const top = k.head();
    put(shelf, W() / 2, top + 22);
    const bs = Math.min(W() * 0.24, H() * 0.2);
    basket.style.width = `${bs}px`;
    put(basket, W() / 2, H() - bs * 0.55);
  };
  const area = () => ({ x0: W() * 0.08, x1: W() * 0.92, y0: k.head() + 70, y1: H() - Math.min(W() * 0.24, H() * 0.2) * 1.2 });
  const spawn = () => {
    const r = area(), kind = Math.random() < 0.7 ? 'loaf' : 'smallfish';
    let x, y, tries = 0;
    do { x = rand(r.x0, r.x1); y = rand(r.y0, r.y1); } while (pieces.some(p => Math.hypot(p.x - x, p.y - y) < W() * 0.1) && ++tries < 30);
    const n = el('button', 'crumb');
    n.setAttribute('aria-label', kind === 'loaf' ? 'A loaf of bread' : 'A little fish');
    const pic = img(prop(kind));
    pic.style.rotate = `${rand(-25, 25)}deg`;
    if (Math.random() < 0.5) pic.style.transform = 'scaleX(-1)';
    n.append(pic);
    n.style.width = `${Math.min(W() * 0.12, H() * 0.12) * (kind === 'loaf' ? 0.9 : 1.1)}px`;
    put(n, x, y);
    field.append(n);
    const p = { n, x, y };
    pieces.push(p);
    n.onpointerdown = e => {
      e.preventDefault();
      if (busy || n.classList.contains('taken')) return;
      n.classList.add('taken');
      pieces.splice(pieces.indexOf(p), 1);
      const b = basket.getBoundingClientRect(), f = field.getBoundingClientRect();
      put(n, b.left - f.left + b.width / 2, b.top - f.top + b.height * 0.3);
      if (sound.ready) sound.pluck(70 + inBasket * 4 + (filled % 4) * 2, sound.ctx.currentTime, 0.09);
      navigator.vibrate?.(8);
      setTimeout(() => n.remove(), 450);
      setTimeout(() => k.alive() && filled + 1 <= total && spawn(), 500);
      if (++inBasket < per) { basket.classList.remove('bump'); void basket.offsetWidth; basket.classList.add('bump'); return; }
      // Full! Up it goes onto the shelf, and a fresh basket comes.
      inBasket = 0; busy = true;
      filled++;
      setTimeout(() => {
        if (!k.alive()) return;
        shelf.children[filled - 1].classList.add('full');
        sound.sticker?.();
        k.progress(`${filled} of ${total} baskets`);
        k.say(game.lines[`count-${filled}`], `count-${filled}`);
        busy = false;
        if (filled === total) {
          field.querySelectorAll('.crumb').forEach(c => c.remove());
          k.backdrop(game.reveal);
          setTimeout(() => k.alive() && k.win(), 1600);
        }
      }, 420);
    };
  };
  layout();
  addEventListener('resize', () => k.alive() && layout());
  for (let i = 0; i < 7; i++) spawn();
}

// ---- Find the Lamb: it's dark on the hills; move the lantern about and tap the little lamb when you find it.
function lantern(k) {
  const { field, game, sound } = k;
  const rounds = game.rounds ?? 3;
  const W = () => field.clientWidth, H = () => field.clientHeight;
  let round = 0, lx = 0.5, ly = 0.6, lastNope = 0, near = false;
  const dark = el('div', 'dark');
  field.append(dark);
  const R = () => Math.min(W(), H()) * 0.2;
  const shine = () => {
    dark.style.setProperty('--x', `${lx * W()}px`);
    dark.style.setProperty('--y', `${ly * H()}px`);
    dark.style.setProperty('--r', `${R()}px`);
  };
  const aim = e => { const b = field.getBoundingClientRect(); lx = (e.clientX - b.left) / W(); ly = (e.clientY - b.top) / H(); shine(); };
  field.addEventListener('pointermove', aim);
  drag(field, { down: aim, move: aim });
  let things = [], lamb = null;
  const hide = () => {
    things.forEach(t => t.remove());
    things = [];
    const top = k.head() + 20, spots = [];
    const kinds = shuffle(['lamb', 'rabbit', 'bird', 'frog', 'rock', 'rabbit']);
    for (const kind of kinds) {
      let x, y, tries = 0;
      do { x = rand(0.1, 0.9) * W(); y = rand(Math.max(top, H() * 0.4), H() * 0.9); } while (spots.some(([a, b]) => Math.hypot(a - x, b - y) < Math.min(W(), H()) * 0.22) && ++tries < 40);
      spots.push([x, y]);
      const n = el('button', `hider ${kind}`);
      n.setAttribute('aria-label', kind === 'lamb' ? 'The little lamb' : 'Something in the dark');
      n.append(img(kind === 'lamb' ? 'art/lamb.png' : prop(kind)));
      n.style.width = `${Math.min(W() * 0.13, H() * 0.15) * (kind === 'bird' ? 0.7 : 1)}px`;
      if (Math.random() < 0.5) n.firstChild.style.transform = 'scaleX(-1)';
      put(n, x, y);
      field.insertBefore(n, dark);
      things.push(n);
      if (kind === 'lamb') lamb = { n, x, y };
      n.onpointerdown = e => {
        e.stopPropagation();
        aim(e);
        if (kind === 'lamb') return found();
        n.classList.remove('hop'); void n.offsetWidth; n.classList.add('hop');
        if (kind === 'rabbit' || kind === 'frog') sound.ribbit?.(); else if (kind === 'bird') sound.chirp?.(sound.ctx?.currentTime); else sound.boop?.();
        if (performance.now() - lastNope > 4000) { lastNope = performance.now(); k.line('nope'); }
      };
    }
  };
  const found = () => {
    if (!lamb || lamb.n.classList.contains('found')) return;
    lamb.n.classList.add('found');
    sound.baa?.();
    navigator.vibrate?.([20, 30, 20]);
    round++;
    k.progress(`Found ${round} of ${rounds}`);
    dark.classList.add('lit');
    if (round === rounds) {
      k.backdrop(game.reveal);
      things.filter(t => t !== lamb.n).forEach(t => t.remove());
      setTimeout(() => k.alive() && k.win(), 1600);
      return;
    }
    k.line('found');
    setTimeout(() => { if (!k.alive()) return; dark.classList.remove('lit'); hide(); k.line('again'); }, 2600);
  };
  // A little "baa" when the lantern comes near, so there's something to listen for.
  k.loop(() => {
    if (!lamb || lamb.n.classList.contains('found')) return;
    const close = Math.hypot(lamb.x - lx * W(), lamb.y - ly * H()) < R() * 1.1;
    if (close && !near) { sound.baa?.(); lamb.n.classList.remove('peek'); void lamb.n.offsetWidth; lamb.n.classList.add('peek'); }
    near = close;
  });
  shine();
  hide();
  k.progress(`Found 0 of ${rounds}`);
  k.line('intro');
}

// ---- Glean the Barley: stalks lie where the harvesters dropped them; sweep a finger across the
// field to gather them into Ruth's bundle. Every few sheaves the workers drop a glowing
// handful "on purpose" (Ruth 2:16): catch it and it ties a whole sheaf at once.
function glean(k) {
  const { field, game, sound } = k;
  const total = game.count ?? 7, per = game.per ?? 3, every = game.purposeEvery ?? 3;
  const W = () => field.clientWidth, H = () => field.clientHeight;
  let tied = 0, inBundle = 0, busy = false, lastPurpose = 0, handful = null;
  k.progress(`0 of ${total} sheaves`);
  k.line('intro');
  const shelf = el('div', 'shelf sheaves');
  for (let i = 0; i < total; i++) shelf.append(el('i'));
  const bundle = el('div', 'catcher');
  bundle.append(img(prop('sheaf')));
  field.append(shelf, bundle);
  const stalks = [];
  const size = () => Math.min(W() * 0.15, H() * 0.19);
  const bs = () => Math.min(W() * 0.22, H() * 0.2);
  const layout = () => {
    put(shelf, W() / 2, k.head() + 22);
    bundle.style.width = `${bs()}px`;
    put(bundle, W() / 2, H() - bs() * 0.6);
  };
  const area = () => ({ x0: W() * 0.08, x1: W() * 0.92, y0: k.head() + 70, y1: H() - bs() * 1.3 });
  const into = n => { const b = bundle.getBoundingClientRect(), f = field.getBoundingClientRect(); put(n, b.left - f.left + b.width / 2, b.top - f.top + b.height * 0.35); };
  const bump = () => { bundle.classList.remove('bump'); void bundle.offsetWidth; bundle.classList.add('bump'); };

  const spawn = () => {
    if (!k.alive() || tied >= total) return;
    const r = area();
    let x, y, tries = 0;
    do { x = rand(r.x0, r.x1); y = rand(r.y0, r.y1); } while (stalks.some(p => Math.hypot(p.x - x, p.y - y) < W() * 0.11) && ++tries < 30);
    const n = el('button', 'crumb stalk');
    n.setAttribute('aria-label', 'A stalk of barley');
    const pic = img(prop('barley'));
    pic.style.rotate = `${rand(-70, 70)}deg`;
    n.append(pic);
    n.style.width = `${size()}px`;
    put(n, x, y);
    field.append(n);
    const p = { n, x, y };
    stalks.push(p);
    n.onpointerdown = () => take(p);   // a plain tap works too
  };

  const tie = () => {
    inBundle = 0; busy = true;
    tied++;
    setTimeout(() => {
      if (!k.alive()) return;
      shelf.children[tied - 1].classList.add('full');
      sound.sticker?.();
      k.progress(`${tied} of ${total} sheaves`);
      k.say(game.lines[`count-${tied}`], `count-${tied}`);
      busy = false;
      if (tied === total) {
        handful?.n.remove();
        field.querySelectorAll('.crumb').forEach(c => c.remove());
        k.backdrop(game.reveal);
        setTimeout(() => k.alive() && k.win(), 1600);
      } else if (tied - lastPurpose >= every && !handful) setTimeout(drop, 1800);
    }, 420);
  };

  const take = p => {
    if (busy || p.n.classList.contains('taken')) return;
    p.n.classList.add('taken');
    stalks.splice(stalks.indexOf(p), 1);
    into(p.n);
    if (sound.ready) sound.pluck(66 + inBundle * 5 + (tied % 3) * 2, sound.ctx.currentTime, 0.08);
    navigator.vibrate?.(8);
    setTimeout(() => p.n.remove(), 450);
    setTimeout(spawn, 600);
    if (++inBundle < per) return bump();
    tie();
  };

  // A glowing handful, dropped on purpose, drifting down the field: catch it before it lands.
  const drop = () => {
    if (!k.alive() || tied >= total || handful) return;
    lastPurpose = tied;
    k.line('purpose');
    const n = el('button', 'crumb stalk purpose');
    n.setAttribute('aria-label', 'A handful of barley, dropped on purpose');
    n.append(img(prop('sheaf')));
    n.style.width = `${size() * 1.15}px`;
    field.append(n);
    handful = { n, x: rand(0.2, 0.8) * W(), y: k.head() + 40, sway: rand(0, 6) };
    put(n, handful.x, handful.y);
    n.onpointerdown = () => catchIt();
  };
  const catchIt = () => {
    const h = handful;
    if (!h || busy) return;
    handful = null;
    h.n.classList.add('taken');
    into(h.n);
    sound.twinkle?.();
    navigator.vibrate?.([15, 30, 15]);
    setTimeout(() => h.n.remove(), 450);
    bump();
    tie();
  };
  k.loop((t, dt) => {
    if (!handful) return;
    const h = handful;
    h.y += H() * 0.06 * dt;
    put(h.n, h.x + Math.sin(t * 1.6 + h.sway) * W() * 0.03, h.y);
    if (h.y > area().y1) { h.n.classList.add('gone'); setTimeout(() => h.n.remove(), 400); handful = null; lastPurpose = tied - every + 1; setTimeout(drop, 2500); }
  });

  // Sweeping: anything the finger passes near is gathered.
  const sweep = e => {
    const b = field.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top, reach = size() * 0.6;
    for (const p of [...stalks]) if (Math.hypot(p.x - x, p.y - y) < reach) take(p);
    if (handful) { const r = handful.n.getBoundingClientRect(); if (Math.hypot(r.left - b.left + r.width / 2 - x, r.top - b.top + r.height / 2 - y) < reach * 1.3) catchIt(); }
  };
  drag(field, { down: sweep, move: sweep });

  layout();
  addEventListener('resize', () => k.alive() && layout());
  for (let i = 0; i < 8; i++) spawn();
}

// ---- Listen and Follow: on the mountain God spoke and Moses listened. Four stone tablets light up
// and sing in a pattern; tap them back in the same order. The patterns grow a little each round,
// and a wrong tap just plays the pattern again: there's no losing.
function echo(k) {
  const { field, game, sound } = k;
  const lengths = game.rounds ?? [2, 3, 4, 5];
  const NOTES = [60, 64, 67, 72], COLORS = ['#f0cc8a', '#8fd0ff', '#b8f0a0', '#ffb3c8'];
  const W = () => field.clientWidth, H = () => field.clientHeight;
  let round = 0, pattern = [], at = 0, listening = false;
  const stones = NOTES.map((note, i) => {
    const b = el('button', 'tablet');
    b.style.setProperty('--glow', COLORS[i]);
    b.setAttribute('aria-label', `Stone ${i + 1}`);
    b.append(img(prop('tablet')));
    field.append(b);
    b.onpointerdown = e => { e.preventDefault(); press(i); };
    return b;
  });
  const layout = () => {
    const top = k.head(), room = H() - top, s = Math.min(W() * 0.3, room * 0.3);
    const cx = W() / 2, cy = top + room * 0.5, dx = Math.min(W() * 0.24, s * 1.05), dy = Math.min(room * 0.24, s * 0.85);
    [[cx, cy - dy], [cx + dx, cy], [cx, cy + dy], [cx - dx, cy]].forEach(([x, y], i) => { stones[i].style.width = `${s * 0.78}px`; put(stones[i], x, y); });
  };
  const light = (i, ms = 420) => {
    const b = stones[i];
    b.classList.add('lit');
    if (sound.ready) { sound.bell?.(NOTES[i] + 12, sound.ctx.currentTime, 0.09, 1.6, sound.sfxBus); sound.pluck(NOTES[i], sound.ctx.currentTime, 0.1); }
    setTimeout(() => b.classList.remove('lit'), ms);
  };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const play = async () => {
    listening = false;
    field.classList.add('watching');
    await wait(700);
    for (const i of pattern) { if (!k.alive()) return; light(i); await wait(650); }
    field.classList.remove('watching');
    at = 0;
    listening = true;
    k.line('you');
  };
  const begin = async () => {
    const n = lengths[round];
    while (pattern.length < n) pattern.push((Math.random() * 4) | 0);
    k.progress(`Round ${round + 1} of ${lengths.length}`);
    if (round) k.line('more'); else k.line('intro');
    await wait(round ? 1400 : 3800);
    if (k.alive()) play();
  };
  const press = i => {
    if (!listening) return;
    light(i, 260);
    navigator.vibrate?.(8);
    if (i !== pattern[at]) {
      listening = false;
      stones[i].classList.remove('nope'); void stones[i].offsetWidth; stones[i].classList.add('nope');
      sound.boop?.();
      k.line('again');
      setTimeout(() => k.alive() && play(), 1600);
      return;
    }
    if (++at < pattern.length) return;
    listening = false;
    sound.sticker?.();
    if (++round === lengths.length) {
      stones.forEach((b, j) => setTimeout(() => light(j, 900), j * 120));
      k.backdrop(game.reveal);
      setTimeout(() => k.alive() && k.win(), 1500);
      return;
    }
    k.progress(`Round ${round} done!`);
    setTimeout(() => k.alive() && begin(), 700);
  };
  layout();
  addEventListener('resize', () => k.alive() && layout());
  begin();
}

// ---- Wind and Fire: swipe across the room like a rushing wind, and a little flame comes to rest
// over each of Jesus' friends the wind passes. When every one has a flame, the room fills with light.
function wind(k) {
  const { field, game, sound } = k;
  const heads = game.heads;                            // where each person's head is (fractions of the picture)
  const W = () => field.clientWidth, H = () => field.clientHeight;
  let lit = 0, lastWhoosh = 0;
  k.progress(`0 of ${heads.length} flames`);
  k.line('intro');
  const spots = heads.map(([px, py]) => {
    const glow = el('div', 'headglow');
    const flame = img(prop('flame'), 'flame');
    field.append(glow, flame);
    return { px, py, glow, flame, on: false };
  });
  const size = () => Math.min(W(), H()) * 0.075;
  const place = () => spots.forEach(s => {
    const p = k.screen(s.px, s.py), f = size();
    // On the narrowest phones the ends of the circle sit right at the edge; keep every flame on screen.
    p.x = clamp(p.x, f * 0.9, W() - f * 0.9);
    s.x = p.x; s.y = p.y;
    s.glow.style.width = s.glow.style.height = `${f * 1.8}px`;
    put(s.glow, p.x, p.y);
    s.flame.style.width = `${f * 0.7}px`;
    put(s.flame, p.x, p.y - f * 0.55);
  });
  const light = s => {
    if (s.on) return;
    s.on = true;
    s.flame.classList.add('on');
    s.glow.classList.add('on');
    if (sound.ready) sound.bell?.(67 + lit * 2, sound.ctx.currentTime, 0.07, 2.4, sound.sfxBus);
    navigator.vibrate?.(10);
    k.progress(`${++lit} of ${heads.length} flames`);
    if (lit === Math.ceil(heads.length / 2)) k.line('half');
    if (lit === heads.length) {
      sound.promise?.();
      k.backdrop(game.reveal);
      spots.forEach(t => t.glow.classList.add('gone'));
      setTimeout(() => k.alive() && k.win(), 1800);
    }
  };
  let last = null;
  const blow = e => {
    const b = field.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top;
    if (last && Math.hypot(x - last.x, y - last.y) > 6) {
      const gust = el('i', 'gust');
      put(gust, x, y);
      gust.style.rotate = `${Math.atan2(y - last.y, x - last.x)}rad`;
      field.append(gust);
      setTimeout(() => gust.remove(), 800);
      const now = performance.now();
      if (now - lastWhoosh > 450) { sound.whoosh?.(0.7); lastWhoosh = now; }
    }
    last = { x, y };
    for (const s of spots) if (!s.on && Math.hypot(s.x - x, s.y - y) < size() * 1.3) light(s);
  };
  drag(field, { down: e => { last = null; blow(e); }, move: blow, up: () => { last = null; } });
  place();
  addEventListener('resize', () => k.alive() && place());
}

// ---- Build the Altar: stack Elijah's twelve stones, pour on the water three times, then pray,
// and fire falls from heaven (1 Kings 18:30-38).
function altar(k) {
  const { field, game, sound } = k;
  const ROWS = [5, 4, 3];                               // twelve stones, widest at the bottom
  const total = ROWS.reduce((a, b) => a + b, 0);
  const W = () => field.clientWidth, H = () => field.clientHeight;
  let placed = 0, pours = 0, stage = 'build';
  k.progress(`0 of ${total} stones`);
  k.line('intro');
  const ditch = el('div', 'ditch');
  const water = el('div', 'water');
  ditch.append(water);
  const slots = [], stones = [];
  field.append(ditch);
  for (let r = 0; r < ROWS.length; r++) for (let c = 0; c < ROWS[r]; c++) { const s = el('div', 'slot'); s.dataset.r = r; s.dataset.c = c; field.append(s); slots.push(s); }
  const wood = img(prop('sheaf'), 'wood');                // a bundle on top, like Elijah's wood
  wood.style.opacity = 0;
  field.append(wood);
  const pile = el('div', 'stonepile');
  for (let i = 0; i < total; i++) {
    const b = el('button', 'piece');
    b.setAttribute('aria-label', 'A stone');
    b.append(img(prop('altarstone')));
    b.onclick = () => lay(b);
    pile.append(b);
    stones.push(b);
  }
  field.append(pile);
  const jar = el('button', 'jar');
  jar.setAttribute('aria-label', 'Pour the water');
  jar.append(img(prop('waterjar')));
  jar.hidden = true;
  const pray = el('button', 'begin read praybtn', 'Pray');
  pray.hidden = true;
  field.append(jar, pray);

  const size = () => Math.min(W() * 0.15, (H() - k.head()) * 0.13);
  const layout = () => {
    const top = k.head(), room = H() - top, s = size(), cx = W() / 2, base = top + room * 0.62;
    slots.forEach(sl => {
      const r = +sl.dataset.r, c = +sl.dataset.c, n = ROWS[r];
      sl.style.width = `${s}px`; sl.style.height = `${s * 0.78}px`;
      put(sl, cx + (c - (n - 1) / 2) * s * 1.02, base - r * s * 0.8);
    });
    ditch.style.width = `${s * 7.2}px`; ditch.style.height = `${s * 1.3}px`;
    put(ditch, cx, base + s * 0.55);
    wood.style.width = `${s * 1.6}px`;
    put(wood, cx, base - ROWS.length * s * 0.8 + s * 0.1);
    jar.style.width = `${s * 1.7}px`;
    put(jar, cx + s * 3.6, base - s * 1.6);
    put(pray, cx, top + room * 0.12 + 20);
    // Stones already on the altar stay in their slots.
    stones.forEach(b => { if (b.dataset.slot) { const sl = slots[+b.dataset.slot]; b.style.width = sl.style.width; b.style.left = sl.style.left; b.style.top = sl.style.top; } });
  };
  const lay = b => {
    if (stage !== 'build' || b.dataset.slot) return;
    const sl = slots[placed];
    b.dataset.slot = placed;
    b.classList.add('laid');
    field.append(b);                                      // off the pile, onto the altar
    b.style.width = sl.style.width;
    put(b, parseFloat(sl.style.left), parseFloat(sl.style.top));
    sl.classList.add('filled');
    sound.thud?.();
    navigator.vibrate?.(12);
    placed++;
    k.progress(`${placed} of ${total} stones`);
    k.say(game.lines[`count-${placed}`], `count-${placed}`);
    if (placed < total) return;
    stage = 'water';
    setTimeout(() => {
      if (!k.alive()) return;
      pile.remove();
      wood.style.opacity = 1;
      jar.hidden = false;
      k.progress('Pour the water');
      k.line('water');
    }, 900);
  };
  jar.onclick = () => {
    if (stage !== 'water' || jar.classList.contains('pouring')) return;
    jar.classList.add('pouring');
    sound.splash?.(undefined, 1.2);
    navigator.vibrate?.(20);
    pours++;
    water.style.setProperty('--fill', pours / 3);
    stones.forEach(b => b.classList.add('wet'));
    setTimeout(() => {
      jar.classList.remove('pouring');
      if (!k.alive()) return;
      if (pours < 3) { k.line(pours === 1 ? 'again' : 'third'); return; }
      stage = 'pray';
      jar.hidden = true;
      pray.hidden = false;
      k.progress('Now pray');
      k.line('pray');
    }, 900);
  };
  pray.onclick = () => {
    if (stage !== 'pray') return;
    stage = 'done';
    pray.hidden = true;
    sound.flame?.();
    navigator.vibrate?.([30, 40, 80]);
    const fire = el('div', 'skyfire');
    field.append(fire);
    setTimeout(() => { if (!k.alive()) return; sound.promise?.(); k.backdrop(game.reveal); field.querySelectorAll('.slot, .piece, .ditch, .wood').forEach(n => n.classList.add('burn')); }, 700);
    setTimeout(() => k.alive() && k.win(), 2600);
  };
  layout();
  addEventListener('resize', () => k.alive() && layout());
}

export const PLAY = { sort, memory, float, frogs, part, trace, puzzle, net, sling, hush, coat, give, palms, march, gather, lantern, glean, echo, wind, altar };
