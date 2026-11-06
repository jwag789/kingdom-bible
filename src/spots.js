// Little things in a picture that answer every tap: a lamp's flame flares and sends up sparks,
// a star twinkles, a sheep's "baa" floats up as notes, an olive tree drops a few leaves,
// a wave splashes, a fish blows bubbles.
// They never give stickers; they're just there to be poked.
//
// A scene lists them as `"spots": [{ "at", "fx", "sound", "hit", "size", "with", "until" }]`:
// `at` is the object (fractions of the picture), `fx` one of the kinds below, `sound` a sound
// the reader plays (see reader.js), `hit` how near a tap must land (a fraction of the picture's
// width, default 0.04), and `with`/`until` tie it to a layer, as for effects.

import { glowSprite, stamp } from './sprites.js';

const rand = (a, b) => a + Math.random() * (b - a);
const LIFE = { flame: 1.4, twinkle: 1, leaves: 1.8, petals: 2.2, notes: 1.4, sparkle: 1.1, splash: 1.2, bubbles: 1.8 };

export function makePing(spot, now) {
  const fx = LIFE[spot.fx] ? spot.fx : 'sparkle';
  const count = { flame: 12, twinkle: 7, leaves: 7, petals: 9, notes: 3, sparkle: 14, splash: 12, bubbles: 8 }[fx];
  const parts = Array.from({ length: count }, (_, i) => ({
    dx: rand(-1, 1), a: rand(0, 6.28), v: rand(0.5, 1), s: rand(0.6, 1.2), delay: fx === 'notes' ? i * 0.16 : rand(0, 0.25),
    turn: rand(-3, 3), glyph: Math.random() < 0.5 ? '♪' : '♫',
  }));
  return { fx, at: spot.at, size: spot.size ?? 1, start: now, parts };
}

// Draws one ping at (x, y) on a picture `pw` pixels wide; false once it's over.
export function drawPing(ctx, p, x, y, pw, t, alpha) {
  const age = t - p.start, life = LIFE[p.fx];
  if (age > life) return false;
  const u = pw * 0.01 * p.size;          // one "unit": a hundredth of the picture
  const fade = alpha * (1 - age / life);
  ctx.save();
  ctx.globalCompositeOperation = ['leaves', 'petals', 'notes', 'splash', 'bubbles'].includes(p.fx) ? 'source-over' : 'lighter';
  if (p.fx === 'flame') {
    // The flame swells and settles, and sparks rise and wobble away.
    const swell = Math.sin(Math.PI * Math.min(1, age / 0.6));
    stamp(ctx, glowSprite('255,160,60'), x, y, u * (3 + swell * 3), 0.8 * swell * alpha);
    stamp(ctx, glowSprite('255,236,190'), x, y - u * 0.6, u * (1.5 + swell * 1.6), 0.9 * swell * alpha);
    for (const e of p.parts) {
      const k = age - e.delay;
      if (k < 0) continue;
      const life2 = 0.7 + e.v * 0.6, f = 1 - k / life2;
      if (f <= 0) continue;
      ctx.fillStyle = `rgba(255,${190 + (e.s * 40) | 0},110,${f * alpha})`;
      ctx.beginPath();
      ctx.arc(x + e.dx * u * 1.2 + Math.sin(k * 7 + e.a) * u * 0.6, y - k * u * 9 * e.v, u * 0.22 * e.s, 0, 6.28);
      ctx.fill();
    }
  } else if (p.fx === 'twinkle') {
    // A four-pointed star flashes and turns, with a few glints around it.
    const flash = Math.sin(Math.PI * Math.min(1, age / 0.8));
    stamp(ctx, glowSprite('255,246,218'), x, y, u * 5 * flash, 0.8 * flash * alpha);
    ctx.translate(x, y);
    ctx.rotate(age * 1.2);
    ctx.fillStyle = `rgba(255,250,232,${flash * alpha})`;
    const long = u * 4 * flash, thin = u * 0.5 * flash;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 ? thin : long, a = (i / 8) * 6.28;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.fill();
    ctx.rotate(-age * 1.2);
    for (const g of p.parts) {
      const k = age - g.delay, f = Math.sin(Math.PI * Math.min(1, Math.max(0, k / 0.6)));
      if (f <= 0) continue;
      stamp(ctx, glowSprite('255,240,200'), Math.cos(g.a) * u * 4 * g.v, Math.sin(g.a) * u * 3 * g.v, u * 0.7 * g.s, f * alpha);
    }
  } else if (p.fx === 'leaves' || p.fx === 'petals') {
    // A few leaves (or blossom petals, pink and slower) shaken loose, rocking as they fall.
    const petals = p.fx === 'petals';
    for (const l of p.parts) {
      const k = age - l.delay;
      if (k < 0) continue;
      ctx.save();
      ctx.translate(x + l.dx * u * (petals ? 4 : 3) + Math.sin(k * 3 + l.a) * u * 1.5, y + k * u * (petals ? 3.5 : 5) * l.v);
      ctx.rotate(l.a + Math.sin(k * 4) * 0.8);
      ctx.fillStyle = petals ? `rgba(${226 + (l.s * 20) | 0},${110 + (l.s * 40) | 0},${150 + (l.s * 30) | 0},${fade})`
        : `rgba(${96 + (l.s * 30) | 0},${128 + (l.s * 20) | 0},70,${fade})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, u * (petals ? 0.85 : 0.7) * l.s, u * (petals ? 0.45 : 0.3) * l.s, 0, 0, 6.28);
      ctx.fill();
      ctx.restore();
    }
  } else if (p.fx === 'notes') {
    // Little music notes float up and sway.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `600 ${Math.round(u * 2.6)}px Georgia, serif`;
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = u * 0.6;
    for (const n of p.parts) {
      const k = age - n.delay;
      if (k < 0) continue;
      const f = Math.min(1, k / 0.15) * Math.max(0, 1 - k / (life - n.delay));
      ctx.fillStyle = `rgba(255,250,236,${f * alpha})`;
      ctx.fillText(n.glyph, x + (n.dx * 2 + Math.sin(k * 5 + n.a)) * u, y - u * 2 - k * u * 6);
    }
  } else if (p.fx === 'splash') {
    // Water jumps up in drops that arc and fall back, and a ring spreads where they land.
    const ring = Math.min(1, age / life);
    ctx.strokeStyle = `rgba(235,245,255,${0.7 * fade})`;
    ctx.lineWidth = Math.max(1.5, u * 0.3);
    ctx.beginPath();
    ctx.ellipse(x, y, u * (1 + ring * 4), u * (1 + ring * 4) * 0.28, 0, 0, 6.28);
    ctx.stroke();
    ctx.fillStyle = `rgba(240,248,255,${fade})`;
    for (const d of p.parts) {
      const k = age - d.delay * 0.4;
      if (k < 0) continue;
      const vx = d.dx * u * 4, vy = u * 9 * d.v;       // thrown up, pulled back down
      const dy = vy * k - u * 14 * k * k;
      if (dy < -u * 0.5) continue;
      ctx.beginPath();
      ctx.arc(x + vx * k, y - dy, u * 0.4 * d.s, 0, 6.28);
      ctx.fill();
    }
  } else if (p.fx === 'bubbles') {
    // A string of bubbles wobbling up toward the light.
    ctx.lineWidth = Math.max(1.5, u * 0.18);
    for (const b of p.parts) {
      const k = age - b.delay * 2.5;
      if (k < 0) continue;
      const f = Math.max(0, 1 - k / (life - b.delay * 2.5));
      const r = u * 0.8 * b.s * (1 + k * 0.3);
      const bx = x + b.dx * u * 1.2 + Math.sin(k * 6 + b.a) * u * 0.7, by = y - u - k * u * 9 * b.v;
      ctx.strokeStyle = `rgba(230,248,255,${0.85 * f * alpha})`;
      ctx.fillStyle = `rgba(200,235,255,${0.18 * f * alpha})`;
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, 6.28);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${0.8 * f * alpha})`;
      ctx.beginPath();
      ctx.arc(bx - r * 0.35, by - r * 0.35, r * 0.22, 0, 6.28);
      ctx.fill();
    }
  } else {
    // A small spray of golden glints.
    stamp(ctx, glowSprite('255,236,180'), x, y, u * 3 * (1 - age / life), 0.7 * fade);
    for (const g of p.parts) {
      const d = u * 5 * g.v * (1 - Math.pow(1 - Math.min(1, age / 0.8), 3));
      ctx.fillStyle = `rgba(255,232,170,${fade})`;
      ctx.beginPath();
      ctx.arc(x + Math.cos(g.a) * d, y + Math.sin(g.a) * d * 0.8, u * 0.18 * g.s, 0, 6.28);
      ctx.fill();
    }
  }
  ctx.restore();
  return true;
}
