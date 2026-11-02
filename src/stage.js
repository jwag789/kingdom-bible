// The stage: one full-screen canvas that paints the active scene's layers with
// depth, fades layers and effects in on their beat, and crossfades scenes.
//
// A layer with `"trigger": "tap"` waits at its beat for the reader to tap the art;
// it then spreads out from the tap point with a burst of light. If nobody taps
// within a few seconds, it reveals by itself so reading is never blocked.
// An effect can follow a layer: `"with": "light"` shows it as that layer is revealed,
// `"until": "light"` hides it once that layer starts to appear.
// Taps that aren't revealing a layer go to the scene's playable effects (touch.js),
// and a scene's `touch.hint` invites the first tap. A tap on a hidden secret (a sticker with
// `earn: "secret"`, see stickers.js) is offered to `onSecret` first.
//
// Positions in the story (effects, tap origins, hints) are fractions of the picture, not the
// screen. On a tall phone screen only a slice of the wide picture fits, so the picture is
// centered on the scene's `frame` point and everything drawn on it moves with it.

import { PAINTERS } from './placeholders.js';
import { makeEffect } from './effects.js';
import { glowSprite, stamp } from './sprites.js';

const OVERSCAN = 1.12;     // layers are drawn larger than the screen so they can drift
const ASPECT = 16 / 9;     // the shape of the paintings
const WIPE_SECONDS = 1.9;
const TAP_PATIENCE = 7;    // seconds a tap-triggered layer waits before revealing by itself
const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const easeOut = t => 1 - Math.pow(1 - t, 3);
const clamp01 = v => Math.min(1, Math.max(0, v));

export class Stage {
  // `beatAt(sceneIndex, beat)` turns a scene's own beat number into the story-wide beat index.
  // `hint` is an element shown while a tap-triggered layer is waiting.
  constructor(canvas, story, beatAt, hint) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.hint = hint;
    this.scenes = story.scenes.map((s, si) => ({
      id: s.id,
      frame: s.frame ?? [0.5, 0.5],
      alpha: 0,
      focus: null,
      touch: s.touch ?? null,
      secrets: (s.stickers ?? []).filter(k => k.earn === 'secret'),
      tapped: false,
      since: 0,                        // when this scene last became the active one
      layers: s.layers.map(l => ({
        ...l,
        from: l.from != null ? beatAt(si, l.from) : -Infinity,
        reveal: l.from != null ? 0 : 1,
        wipe: null,
        img: null,
        painted: null,
      })),
      fx: (s.effects ?? []).map(e => {
        const made = makeEffect(e);
        return { ...e, draw: made.draw, play: made.tap, from: e.from != null ? beatAt(si, e.from) : -Infinity, reveal: 0 };
      }),
    }));
    this.active = 0;
    this.prev = null;
    this.beat = -1;
    this.progress = 0;
    this.waiting = null;               // the tap-triggered layer currently waiting, if any
    this.onEvent = null;               // (kind, detail) for 'reveal' and 'touch', e.g. to play sounds
    this.onSecret = null;              // (sceneIndex, sticker) → true if that find was new
    this.bursts = [];
    this.pointer = { x: 0.5, y: 0.5, active: false, moved: -Infinity };
    this.drift = { x: 0, y: 0 };
    this.mask = document.createElement('canvas');
    this.scratch = document.createElement('canvas');
    this.resize();
    addEventListener('resize', () => this.resize());
    addEventListener('pointermove', e => {
      this.pointer.x = e.clientX / innerWidth;
      this.pointer.y = e.clientY / innerHeight;
      this.pointer.moved = performance.now() / 1000;
    });
    // A tap is a press and release that barely moves; a swipe turns the page instead.
    // Presses on the words or controls are for reading, not for the art.
    let press = null;
    addEventListener('pointerdown', e => {
      press = e.target.closest('p, h1, h2, summary, a, button, nav, .eyebrow, .verses, .kicker, .sub, .book, .toast')
        ? null : { x: e.clientX, y: e.clientY, at: performance.now() };
    });
    addEventListener('pointerup', e => {
      if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 14 && performance.now() - press.at < 600) {
        const [x, y] = this.toPicture(e.clientX / innerWidth, e.clientY / innerHeight);
        this.tap(x, y);
      }
      press = null;
    });
  }

  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    this.w = Math.round(innerWidth * dpr);
    this.h = Math.round(innerHeight * dpr);
    for (const c of [this.canvas, this.mask, this.scratch]) { c.width = this.w; c.height = this.h; }
    for (const s of this.scenes) for (const l of s.layers) l.painted = null;
  }

  // Where a scene's picture sits on the screen, in canvas pixels: { x, y, pw, ph }.
  view(s) {
    const { w, h } = this;
    const pw = Math.max(w, h * ASPECT) * OVERSCAN, ph = pw / ASPECT;
    let x = (w - pw) / 2;
    const y = (h - ph) / 2;
    // Narrower than the picture (a phone held upright): slide it to keep the scene's subject in view,
    // leaving a little margin so the drift never shows an edge.
    if (h * ASPECT > w * 1.2) {
      const margin = w * 0.04;
      x = Math.min(-margin, Math.max(w - pw + margin, w / 2 - s.frame[0] * pw));
    }
    return { x, y, pw, ph };
  }

  // Screen fractions → picture fractions for the active scene, and back.
  toPicture(sx, sy) {
    const v = this.view(this.scenes[this.active]);
    return [(sx * this.w - v.x) / v.pw, (sy * this.h - v.y) / v.ph];
  }
  toScreen(px, py, s = this.scenes[this.active]) {
    const v = this.view(s);
    return [(v.x + px * v.pw) / this.w, (v.y + py * v.ph) / this.h];
  }

  // Pictures load a scene at a time (this one and the next), so a phone isn't fetching the whole story at once.
  load(si) {
    for (const l of this.scenes[si]?.layers ?? []) {
      if (!l.src || l.loading) continue;
      l.loading = true;
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => { l.img = img; };
      img.src = l.src;
    }
  }

  // Where the reader is: which scene, which beat (story-wide index), how far through the scene.
  set(active, beat, progress) {
    this.load(active);
    this.load(active + 1);
    if (active !== this.active) {
      this.prev = this.active;
      this.active = active;
      this.scenes[active].since = performance.now() / 1000;
    }
    this.beat = beat;
    this.progress = progress;
  }

  tap(x, y) {
    if (this.waiting) {
      this.reveal(this.waiting, x, y, true);
      return;
    }
    // Use the animation clock, so a tap never lands "in the future" of the frame drawing it.
    const s = this.scenes[this.active], now = this.t ?? performance.now() / 1000;
    const shown = id => s.layers.find(l => l.id === id)?.reveal ?? 0;
    // Secrets only count once the scene has faded in, so a tap can't find the last scene's.
    for (const secret of s.alpha > 0.8 ? s.secrets : []) {
      if (secret.with && shown(secret.with) < 0.5) continue;
      if (secret.until && shown(secret.until) > 0.5) continue;
      const near = Math.hypot(x - secret.at[0], (y - secret.at[1]) / ASPECT) < (secret.hit ?? 0.05);
      if (near && this.onSecret?.(this.active, secret)) {
        this.burst(secret.at[0], secret.at[1], 0.45);
        return;
      }
    }
    let played = false;
    for (const f of s.fx) {
      if (f.play && f.reveal > 0.3) {
        f.play(x, y, now);
        played = true;
        this.onEvent?.('touch', { type: f.type, spec: f, x, y });
      }
    }
    if (played) s.tapped = true;
  }

  // `tapped` is false when the layer revealed itself because nobody tapped.
  reveal(layer, x, y, tapped = false) {
    const now = performance.now() / 1000;
    layer.wipe = { x, y, start: now };
    this.scenes[this.active].focus = { x, y };
    this.waiting = null;
    this.burst(x, y);
    this.onEvent?.('reveal', { layer, x, y, tapped });
  }

  // A flash and a spray of sparks; `size` 1 is the big one for "let there be light".
  burst(x, y, size = 1) {
    const sparks = Array.from({ length: Math.round(90 * size) }, () => {
      const a = Math.random() * 6.28, v = (0.08 + Math.random() * 0.45) * size;
      return { a, v, s: 0.6 + Math.random() * 2 };
    });
    this.bursts.push({ x, y, start: performance.now() / 1000, sparks, size });
  }

  source(layer) {
    if (layer.img) return layer.img;
    if (!layer.painted) {
      const c = document.createElement('canvas');
      c.width = Math.round(this.w * OVERSCAN);
      c.height = Math.round(this.h * OVERSCAN);
      const paint = PAINTERS[layer.paint];
      if (paint) paint(c.getContext('2d'), c.width, c.height);
      layer.painted = c;
    }
    return layer.painted;
  }

  frame(t, dt) {
    const { ctx, w, h } = this;
    this.t = t;
    this.pointer.active = t - this.pointer.moved < 4;
    const px = this.pointer.active ? this.pointer.x * 2 - 1 : 0, py = this.pointer.active ? this.pointer.y * 2 - 1 : 0;
    this.drift.x = ease(this.drift.x, px, 1.5, dt);
    this.drift.y = ease(this.drift.y, py, 1.5, dt);

    let waiting = null;
    this.scenes.forEach((s, i) => {
      s.alpha = ease(s.alpha, i === this.active ? 1 : 0, 1.6, dt);
      if (i !== this.active) return;
      for (const l of s.layers) {
        if (l.trigger !== 'tap') {
          l.reveal = ease(l.reveal, this.beat >= l.from ? 1 : 0, 1.3, dt);
          continue;
        }
        if (this.beat < l.from) {                 // scrolled back above it: ready to tap again
          l.wipe = null;
          l.waitStart = null;
          l.reveal = ease(l.reveal, 0, 2, dt);
          if (l.reveal < 0.01) s.focus = null;
        } else if (!l.wipe) {
          l.waitStart ??= t;
          if (t - l.waitStart > TAP_PATIENCE) this.reveal(l, l.origin?.[0] ?? 0.62, l.origin?.[1] ?? 0.22, false);
          else waiting = l;
        } else {
          l.reveal = clamp01((t - l.wipe.start) / WIPE_SECONDS);
        }
      }
      const byId = id => s.layers.find(l => l.id === id);
      for (const f of s.fx) {
        let target = this.beat >= f.from ? 1 : 0;
        if (f.with) target = target ? (byId(f.with)?.reveal ?? 0) : 0;
        if (f.until && (byId(f.until)?.reveal ?? 0) > 0.05) target = 0;
        f.reveal = ease(f.reveal, target, 0.9, dt);
      }
    });
    this.waiting = waiting;
    // Invite a tap: for a waiting layer, or for a scene's playable effect until it's first used.
    const s = this.scenes[this.active];
    if (waiting) {
      this.showHint(waiting.hint ?? 'Tap', waiting.origin ?? [0.62, 0.22]);
    } else if (s.touch && !s.tapped && t - s.since > 1.2 && s.fx.some(f => f.play && f.reveal > 0.3)) {
      this.showHint(s.touch.hint, s.touch.at ?? [0.66, 0.5]);
    } else {
      this.showHint(null);
    }

    ctx.fillStyle = '#04050a';
    ctx.fillRect(0, 0, w, h);
    // The scene being left stays fully painted underneath while the new one fades in over it.
    const prev = this.scenes[this.prev];
    const cur = this.scenes[this.active];
    if (prev && prev !== cur && cur.alpha < 0.995) this.drawScene(prev, 1, t, dt);
    this.drawScene(cur, cur.alpha, t, dt);
    this.drawBursts(t);
    this.vignette();
  }

  showHint(text, at) {
    if (!this.hint) return;
    if (text) {
      // Kept on screen even when the spot in the picture is cropped off a narrow screen.
      const [x, y] = this.toScreen(at[0], at[1]);
      this.hint.querySelector('.label').textContent = text;
      this.hint.style.left = `${Math.min(0.85, Math.max(0.15, x)) * 100}%`;
      this.hint.style.top = `${Math.min(0.9, Math.max(0.1, y)) * 100}%`;
    }
    this.hint.classList.toggle('on', !!text);
  }

  // Plates fill the scene's picture area (see view). A layer with `scale` is drawn that fraction
  // of the screen wide, centered at `pos` ([x, y] as fractions of the screen) — for cutouts.
  drawLayer(src, l, a, ox, oy, zoom, v) {
    const { ctx, w, h } = this;
    const sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height;
    let dw, dh, dx, dy;
    if (l.scale && l.img) {
      dw = w * l.scale * zoom;
      dh = dw * (sh / sw);
      const [px, py] = l.pos ?? [0.5, 0.5];
      dx = px * w - dw / 2 + ox;
      dy = py * h - dh / 2 + oy;
    } else {
      dw = v.pw * zoom; dh = v.ph * zoom;
      dx = v.x + (v.pw - dw) / 2 + ox; dy = v.y + (v.ph - dh) / 2 + oy;
    }

    if (!l.wipe || l.reveal >= 1) {
      ctx.globalAlpha = a;
      ctx.drawImage(src, dx, dy, dw, dh);
      return;
    }
    // Spreading from the tap point: paint the layer, then keep only a soft-edged growing circle of it.
    const s = this.scratch.getContext('2d');
    s.globalCompositeOperation = 'source-over';
    s.clearRect(0, 0, w, h);
    s.drawImage(src, dx, dy, dw, dh);
    const cx = v.x + l.wipe.x * v.pw, cy = v.y + l.wipe.y * v.ph;
    const far = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy));
    const r = easeOut(l.reveal) * far * 1.25 + 1;
    const g = s.createRadialGradient(cx, cy, r * 0.55, cx, cy, r);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    s.globalCompositeOperation = 'destination-in';
    s.fillStyle = g;
    s.fillRect(0, 0, w, h);
    ctx.globalAlpha = a;
    ctx.drawImage(this.scratch, 0, 0);
  }

  drawScene(s, alpha, t, dt) {
    const { ctx, w, h } = this;
    const v = this.view(s);
    const zoom = 1 + 0.035 * (s === this.scenes[this.active] ? this.progress : 1) + 0.008 * Math.sin(t * 0.12);
    for (const l of s.layers) {
      const a = alpha * (l.wipe ? 1 : l.reveal);
      if (a < 0.003 || (l.trigger === 'tap' && !l.wipe && l.reveal < 0.003)) continue;
      const d = l.depth ?? 0.1;
      const ox = -this.drift.x * d * w * 0.035;
      const oy = -this.drift.y * d * h * 0.025 + (0.5 - this.progress) * d * h * 0.08;
      this.drawLayer(this.source(l), l, a, ox, oy, zoom, v);
    }
    ctx.globalAlpha = 1;
    // Effects draw on the picture, in its own coordinates.
    const pointer = { ...this.pointer, x: (this.pointer.x * w - v.x) / v.pw, y: (this.pointer.y * h - v.y) / v.ph };
    const env = { pointer, focus: s.focus, dt };
    ctx.save();
    ctx.translate(v.x, v.y);
    for (const f of s.fx) {
      const a = alpha * f.reveal;
      if (a > 0.003) f.draw(ctx, v.pw, v.ph, t, a, env);
    }
    ctx.restore();
  }

  // A flash and a spray of sparks where the reader tapped.
  drawBursts(t) {
    const { ctx, w } = this;
    const v = this.view(this.scenes[this.active]);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    this.bursts = this.bursts.filter(b => {
      const age = t - b.start;
      if (age > 2.4) return false;
      const x = v.x + b.x * v.pw, y = v.y + b.y * v.ph;
      stamp(ctx, glowSprite('255,246,218'), x, y, w * (0.1 + age * 0.35) * b.size, 0.9 * Math.max(0, 1 - age / 0.9));
      const fade = 1 - age / 2.4;
      for (const p of b.sparks) {
        const d = p.v * w * easeOut(Math.min(1, age / 2));
        ctx.fillStyle = `rgba(255,232,170,${0.85 * fade})`;
        ctx.beginPath();
        ctx.arc(x + Math.cos(p.a) * d, y + Math.sin(p.a) * d * 0.7, p.s * (w / 1400 + 0.4), 0, 6.28);
        ctx.fill();
      }
      return true;
    });
    ctx.restore();
  }

  // Darkened edges, painted once per screen size.
  vignette() {
    const { ctx, w, h } = this;
    if (this.vig?.width !== w || this.vig?.height !== h) {
      this.vig = document.createElement('canvas');
      this.vig.width = w; this.vig.height = h;
      const v = this.vig.getContext('2d');
      const g = v.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.35, w / 2, h * 0.45, Math.hypot(w, h) * 0.62);
      g.addColorStop(0, 'rgba(4,5,10,0)');
      g.addColorStop(1, 'rgba(4,5,10,0.55)');
      v.fillStyle = g;
      v.fillRect(0, 0, w, h);
    }
    ctx.drawImage(this.vig, 0, 0);
  }
}
