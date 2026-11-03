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

export const PLAY = { sort, memory, float, frogs, part, trace, puzzle, net, sling };
