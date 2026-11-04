// Living touches drawn over a scene's painted layers. Each effect is created
// once per scene and drawn every frame with an alpha that fades it in, plus `env`:
//   env.pointer  { x, y, active } in 0..1 screen space; active while the reader is moving it
//   env.focus    { x, y } where the reader tapped to reveal something, or null
//   env.dt       seconds since the last frame

import { TOUCH } from './touch.js';
import { glowSprite, beamSprite, stamp } from './sprites.js';

function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const EFFECTS = {
  // Low drifting fog over the water.
  mist(o) {
    const rnd = seeded(7);
    const puffs = Array.from({ length: 16 }, () => ({
      x: rnd(), y: 0.58 + rnd() * 0.3, r: 0.12 + rnd() * 0.18, speed: 0.004 + rnd() * 0.008, a: 0.05 + rnd() * 0.06,
    }));
    const puff = glowSprite('220,226,235');
    return (ctx, w, h, t, alpha) => {
      for (const p of puffs) {
        const x = (((p.x + t * p.speed) % 1.4) - 0.2) * w;
        stamp(ctx, puff, x, p.y * h, p.r * w, p.a * alpha);
      }
    };
  },

  // Slowly turning beams of light from a point in the sky. They shine from where the
  // reader tapped (if they did) and lean gently toward the pointer.
  rays(o) {
    const strength = o.soft ? 0.05 : 0.09;
    let cx = o.x ?? 0.5, cy = o.y ?? 0.2, lean = 0;
    const beam = beamSprite('255,236,190'), core = glowSprite('255,240,205');
    return (ctx, w, h, t, alpha, env) => {
      const k = 1 - Math.exp(-2 * env.dt);
      if (env.focus) { cx += (env.focus.x - cx) * k; cy += (env.focus.y - cy) * k; }
      lean += (((env.pointer.x - cx) * 0.5) - lean) * k;
      const x = cx * w, y = cy * h, len = Math.hypot(w, h);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 9; i++) {
        const a = -lean + (i - 4) * 0.2 + Math.sin(t * 0.07 + i * 1.7) * 0.06;   // 0 = straight down
        const spread = 0.045 + 0.03 * Math.sin(t * 0.11 + i);
        const bw = 2 * len * Math.tan(spread);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a);
        ctx.globalAlpha = strength * alpha * (0.6 + 0.4 * Math.sin(t * 0.3 + i * 2.1));
        ctx.drawImage(beam, -bw / 2, 0, bw, len);
        ctx.restore();
      }
      stamp(ctx, core, x, y, w * 0.25, 0.35 * alpha);
      ctx.restore();
    };
  },

  // Golden dust rising slowly.
  motes(o) {
    const rnd = seeded(31);
    const ps = Array.from({ length: 70 }, () => ({
      x: rnd(), y: rnd(), s: 0.6 + rnd() * 1.8, v: 0.006 + rnd() * 0.012, ph: rnd() * 6.28,
    }));
    return (ctx, w, h, t, alpha) => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const p of ps) {
        const y = (((p.y - t * p.v) % 1) + 1) % 1;
        const x = p.x + Math.sin(t * 0.3 + p.ph) * 0.01;
        const tw = 0.5 + 0.5 * Math.sin(t * 1.3 + p.ph);
        ctx.fillStyle = `rgba(255,226,160,${0.55 * tw * alpha})`;
        ctx.beginPath();
        ctx.arc(x * w, y * h, p.s * (w / 1200 + 0.5), 0, 6.28);
        ctx.fill();
      }
      ctx.restore();
    };
  },

  // Twinkling stars in the upper sky.
  stars(o) {
    const rnd = seeded(97);
    const ps = Array.from({ length: 240 }, () => ({
      x: rnd(), y: Math.pow(rnd(), 1.6) * 0.5, s: 0.4 + Math.pow(rnd(), 3) * 1.8, ph: rnd() * 6.28, sp: 0.6 + rnd() * 2,
    }));
    return (ctx, w, h, t, alpha) => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ps.forEach((p, i) => {
        // Stars appear one by one over the first few seconds.
        const born = Math.min(1, Math.max(0, alpha * 1.6 - (i / ps.length) * 0.6));
        const tw = 0.55 + 0.45 * Math.sin(t * p.sp + p.ph);
        ctx.fillStyle = `rgba(255,250,235,${0.85 * tw * born})`;
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, p.s * (w / 1400 + 0.4), 0, 6.28);
        ctx.fill();
      });
      ctx.restore();
    };
  },

  // A small flock crossing the sky.
  birds(o) {
    const rnd = seeded(13);
    const flock = Array.from({ length: 11 }, () => ({ dx: rnd() * 0.12, dy: rnd() * 0.08, ph: rnd() * 6.28, s: 0.7 + rnd() * 0.5 }));
    return (ctx, w, h, t, alpha) => {
      const lap = (t * 0.018) % 1.5;
      ctx.save();
      ctx.strokeStyle = `rgba(40,38,48,${0.7 * alpha})`;
      ctx.lineWidth = Math.max(1.2, w / 900);
      ctx.lineCap = 'round';
      for (const b of flock) {
        const x = (lap - 0.25 + b.dx) * w, y = (0.24 + b.dy + Math.sin(t * 0.4 + b.ph) * 0.01) * h;
        const s = b.s * w * 0.008, flap = Math.sin(t * 6 + b.ph) * s * 0.7;
        ctx.beginPath();
        ctx.moveTo(x - s, y - flap);
        ctx.quadraticCurveTo(x - s * 0.4, y - s * 0.2, x, y);
        ctx.quadraticCurveTo(x + s * 0.4, y - s * 0.2, x + s, y - flap);
        ctx.stroke();
      }
      ctx.restore();
    };
  },

  // Rain: slanting streaks falling across the whole picture.
  rain(o) {
    const rnd = seeded(29);
    const drops = Array.from({ length: o.drops ?? 180 }, () => ({ x: rnd(), y: rnd(), len: 0.02 + rnd() * 0.035, speed: 0.9 + rnd() * 0.6, a: 0.12 + rnd() * 0.22 }));
    return (ctx, w, h, t, alpha) => {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(1, w / 1200);
      for (const d of drops) {
        const y = ((d.y + t * d.speed) % 1.2) - 0.1, x = ((d.x + y * 0.18) % 1.1) - 0.05;
        ctx.strokeStyle = `rgba(210,222,240,${d.a * alpha})`;
        ctx.beginPath();
        ctx.moveTo(x * w, y * h);
        ctx.lineTo((x - d.len * 0.18) * w, (y - d.len) * h);
        ctx.stroke();
      }
      ctx.restore();
    };
  },

  // Sparkles dancing on the sea surface.
  shimmer(o) {
    const rnd = seeded(53);
    const band = o.y ?? 0.62;
    const ps = Array.from({ length: 90 }, () => ({ x: rnd(), y: band + Math.pow(rnd(), 1.5) * 0.3, ph: rnd() * 6.28, sp: 1 + rnd() * 3 }));
    return (ctx, w, h, t, alpha) => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const p of ps) {
        const k = Math.max(0, Math.sin(t * p.sp + p.ph));
        const len = (2 + (p.y - band) * 30) * (w / 1200 + 0.5);
        ctx.fillStyle = `rgba(255,244,215,${0.5 * k * k * alpha})`;
        ctx.fillRect(p.x * w - len, p.y * h, len * 2, Math.max(1, w / 1400));
      }
      ctx.restore();
    };
  },

  // The Spirit hovering over the waters: a soft light that follows the reader's finger
  // (or wanders on its own), leaving ripples on the water below the horizon.
  spirit(o) {
    const horizon = o.water ?? 0.58;
    let x = 0.62, y = 0.5, lastRipple = 0;
    const ripples = [];
    const haze = glowSprite('190,210,250'), heart = glowSprite('215,228,255');
    return (ctx, w, h, t, alpha, env) => {
      const p = env.pointer;
      const tx = p.active ? p.x : 0.6 + 0.22 * Math.sin(t * 0.13);
      const ty = p.active ? p.y : 0.52 + 0.08 * Math.sin(t * 0.21);
      const k = 1 - Math.exp(-(p.active ? 3.5 : 0.8) * env.dt);
      const px = x, py = y;
      x += (tx - x) * k; y += (ty - y) * k;
      const moved = Math.hypot(x - px, y - py);
      if (t - lastRipple > (moved > 0.002 ? 0.18 : 0.9)) {
        lastRipple = t;
        ripples.push({ x, y: Math.max(y + 0.05, horizon + 0.02), born: t });
      }
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      // Ripples spread out on the water.
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i], age = (t - r.born) / 2.6;
        if (age > 1) { ripples.splice(i, 1); continue; }
        const persp = 0.4 + (r.y - horizon) * 2.4;     // ripples look bigger nearer the viewer
        const rx = (0.015 + age * 0.08) * w * persp;
        ctx.strokeStyle = `rgba(200,220,255,${0.3 * (1 - age) * alpha})`;
        ctx.lineWidth = Math.max(1, w / 900);
        ctx.beginPath();
        ctx.ellipse(r.x * w, r.y * h, rx, rx * 0.2, 0, 0, 6.28);
        ctx.stroke();
      }
      const breathe = 1 + 0.08 * Math.sin(t * 1.4);
      stamp(ctx, haze, x * w, y * h, w * 0.14 * breathe, 0.2 * alpha);
      stamp(ctx, heart, x * w, y * h, w * 0.035 * breathe, 0.4 * alpha);
      ctx.restore();
    };
  },

  // A soft pulsing glow, e.g. the sun on the horizon. With `follow`, it sits where the reader tapped.
  glow(o) {
    let cx = o.x ?? 0.5, cy = o.y ?? 0.5;
    const color = o.color ?? '#ffd08a';
    const rgb = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16)).join(',');
    const sprite = glowSprite(rgb);
    return (ctx, w, h, t, alpha, env) => {
      if (o.follow && env.focus) { cx = env.focus.x; cy = env.focus.y; }
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      stamp(ctx, sprite, cx * w, cy * h, w * (0.32 + 0.03 * Math.sin(t * 0.5)), 0.45 * alpha);
      ctx.restore();
    };
  },
};

// Always returns { draw, tap? }; tap is there for effects the reader can play with (see touch.js).
export function makeEffect(spec) {
  if (TOUCH[spec.type]) return TOUCH[spec.type](spec);
  const make = EFFECTS[spec.type];
  if (!make) throw new Error(`Unknown effect "${spec.type}"`);
  return { draw: make(spec) };
}
