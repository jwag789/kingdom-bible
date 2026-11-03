// Things the reader can make happen with a tap, one per scene. Each returns
// { tap(x, y, t), draw(ctx, w, h, t, alpha, env) } with x, y as fractions of the screen.

import { glowSprite, stamp } from './sprites.js';

const rand = (a, b) => a + Math.random() * (b - a);
const clamp01 = v => Math.min(1, Math.max(0, v));
const easeOut = t => 1 - Math.pow(1 - t, 3);
const unit = w => w / 1400 + 0.4;                         // a size that scales with the screen
const depthScale = (y, horizon) => Math.min(1.6, Math.max(0.4, 0.5 + (y - horizon) * 2.4));

function ripple(ctx, x, y, r, a, w) {
  ctx.strokeStyle = `rgba(230,240,255,${a})`;
  ctx.lineWidth = Math.max(1, w / 900);
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.22, 0, 0, 6.28);
  ctx.stroke();
}

function wingStroke(ctx, x, y, s, flap) {
  ctx.beginPath();
  ctx.moveTo(x - s, y - flap);
  ctx.quadraticCurveTo(x - s * 0.4, y - s * 0.2, x, y);
  ctx.quadraticCurveTo(x + s * 0.4, y - s * 0.2, x + s, y - flap);
  ctx.stroke();
}

export const TOUCH = {
  // Day 2: tap the sea and a column of water rises into the sky and becomes a cloud.
  lift(o) {
    const horizon = o.water ?? 0.6;
    const events = [];
    const cloud = glowSprite('255,252,245');
    return {
      tap(x, y, t) {
        const base = Math.max(y, horizon + 0.02);
        events.push({
          x, base, t, top: rand(0.14, 0.3),
          drops: Array.from({ length: 50 }, () => ({ dx: rand(-0.012, 0.012), s: rand(0.6, 1.9), d: rand(0, 0.3) })),
          puffs: Array.from({ length: 7 }, () => ({ dx: rand(-0.05, 0.05), dy: rand(-0.02, 0.02), r: rand(0.025, 0.05) })),
        });
        if (events.length > 8) events.shift();
      },
      draw(ctx, w, h, t, alpha) {
        for (let i = events.length - 1; i >= 0; i--) {
          const e = events[i], age = t - e.t;
          if (age > 10) { events.splice(i, 1); continue; }
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          if (age < 2.2) ripple(ctx, e.x * w, e.base * h, (0.01 + age * 0.05) * w * depthScale(e.base, horizon), 0.4 * (1 - age / 2.2) * alpha, w);
          for (const d of e.drops) {
            const p = clamp01((age - d.d) / 1.7);
            if (p <= 0 || p >= 1) continue;
            const y = e.base + (e.top - e.base) * (1 - Math.pow(1 - p, 2));
            ctx.fillStyle = `rgba(225,240,255,${0.75 * (1 - p) * alpha})`;
            ctx.beginPath();
            ctx.arc((e.x + d.dx * (1 + p * 3)) * w, y * h, d.s * unit(w), 0, 6.28);
            ctx.fill();
          }
          ctx.restore();
          // The cloud gathers where the water arrives, drifts, and slowly fades.
          const c = clamp01((age - 1.1) / 1.6) * clamp01((10 - age) / 3);
          if (c > 0) {
            for (const p of e.puffs) {
              stamp(ctx, cloud, (e.x + p.dx + age * 0.004) * w, (e.top + p.dy) * h, p.r * w * (0.7 + 0.3 * c), 0.5 * c * alpha);
            }
          }
        }
      },
    };
  },

  // Day 3: tap the ground and flowers sprout and bloom there.
  sprout(o) {
    const horizon = o.ground ?? 0.55;
    const plants = [];
    const BLOOMS = ['#f4d35e', '#ee6c8a', '#ffffff', '#f08a4b', '#b48ef0', '#ff5d5d'];
    return {
      tap(x, y, t) {
        y = Math.max(y, horizon + 0.03);
        for (let i = 0; i < 3; i++) {
          plants.push({ x: x + rand(-0.02, 0.02), y: y + rand(-0.008, 0.012), t: t + i * 0.15, h: rand(0.05, 0.1),
            bloom: BLOOMS[(Math.random() * BLOOMS.length) | 0], lean: rand(-0.3, 0.3), ph: rand(0, 6.28) });
        }
        while (plants.length > 120) plants.shift();
      },
      draw(ctx, w, h, t, alpha) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.lineCap = 'round';
        for (const p of [...plants].sort((a, b) => a.y - b.y)) {
          const age = t - p.t;
          if (age < 0) continue;
          const g = easeOut(clamp01(age / 1.4)), k = depthScale(p.y, horizon);
          const len = p.h * h * g * k;
          const sway = Math.sin(t * 1.2 + p.ph) * 0.06 + p.lean * 0.3;
          const bx = p.x * w, by = p.y * h;
          const tx = bx + Math.sin(sway) * len, ty = by - Math.cos(sway) * len;
          // A tuft of grass for the flower to stand in.
          ctx.fillStyle = '#4f8a3c';
          ctx.beginPath();
          ctx.ellipse(bx, by, 14 * unit(w) * k * Math.min(1, g * 2), 4 * unit(w) * k * Math.min(1, g * 2), 0, Math.PI, 0);
          ctx.fill();
          ctx.strokeStyle = '#5f9c47';
          ctx.lineWidth = 1.4 * unit(w) * k;
          for (let i = -3; i <= 3; i++) {
            const gx = bx + i * 3.5 * unit(w) * k;
            ctx.beginPath();
            ctx.moveTo(gx, by);
            ctx.lineTo(gx + i * 1.2 * unit(w) * k + Math.sin(t * 1.5 + i + p.ph) * 1.5, by - (7 + (i % 2) * 3) * unit(w) * k * Math.min(1, g * 1.5));
            ctx.stroke();
          }
          ctx.strokeStyle = '#3f7a3a';
          ctx.lineWidth = 2.2 * unit(w) * k;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.quadraticCurveTo(bx, by - len * 0.5, tx, ty);
          ctx.stroke();
          ctx.fillStyle = '#5a9a45';
          for (const [f, side] of [[0.4, -1], [0.65, 1]]) {
            const lx = bx + (tx - bx) * f, ly = by + (ty - by) * f;
            ctx.beginPath();
            ctx.ellipse(lx + side * 5 * unit(w) * k * g, ly, 6 * unit(w) * k * g, 2.4 * unit(w) * k * g, side * 0.6, 0, 6.28);
            ctx.fill();
          }
          const b = clamp01((g - 0.6) / 0.4);
          if (b > 0) {
            const r = 5 * unit(w) * k * b;
            ctx.fillStyle = p.bloom;
            for (let i = 0; i < 5; i++) {
              const a = (i / 5) * 6.28 + p.ph;
              ctx.beginPath();
              ctx.arc(tx + Math.cos(a) * r, ty + Math.sin(a) * r, r * 0.75, 0, 6.28);
              ctx.fill();
            }
            ctx.fillStyle = '#f7c948';
            ctx.beginPath();
            ctx.arc(tx, ty, r * 0.55, 0, 6.28);
            ctx.fill();
          }
        }
        ctx.restore();
      },
    };
  },

  // Day 4: tap the sky to place a star. Stars placed close together in time join into a constellation.
  starmaker(o) {
    const sky = o.sky ?? 0.56;
    const stars = [];
    const flash = glowSprite('255,245,220');
    return {
      tap(x, y, t) {
        const last = stars[stars.length - 1];
        stars.push({ x, y: Math.min(y, sky), t, link: last && t - last.t < 5 ? stars.length - 1 : -1, s: rand(1.4, 2.4), ph: rand(0, 6.28) });
        if (stars.length > 80) stars.shift();
      },
      draw(ctx, w, h, t, alpha) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineWidth = Math.max(1, w / 1300);
        stars.forEach((st, i) => {
          const from = stars[st.link];
          if (st.link >= 0 && from && st.link < i) {
            ctx.strokeStyle = `rgba(200,215,255,${0.28 * clamp01((t - st.t) / 0.8) * alpha})`;
            ctx.beginPath(); ctx.moveTo(from.x * w, from.y * h); ctx.lineTo(st.x * w, st.y * h); ctx.stroke();
          }
        });
        for (const st of stars) {
          const age = t - st.t, x = st.x * w, y = st.y * h;
          const tw = 0.7 + 0.3 * Math.sin(t * 2 + st.ph);
          const s = st.s * unit(w) * (age < 0.4 ? 1 + (0.4 - age) * 5 : 1);
          if (age < 1) stamp(ctx, flash, x, y, w * 0.06, 0.6 * (1 - age) * alpha);
          ctx.fillStyle = `rgba(255,250,235,${tw * alpha})`;
          ctx.beginPath(); ctx.arc(x, y, s, 0, 6.28); ctx.fill();
          ctx.fillStyle = `rgba(255,250,235,${0.5 * tw * alpha})`;
          ctx.fillRect(x - s * 5, y - s * 0.18, s * 10, s * 0.36);
          ctx.fillRect(x - s * 0.18, y - s * 5, s * 0.36, s * 10);
        }
        ctx.restore();
      },
    };
  },

  // Day 5: tap the sea and a fish leaps out with a splash; tap the sky and a bird takes off.
  leap(o) {
    const horizon = o.water ?? 0.5;
    const fish = [], birds = [], splashes = [];
    return {
      tap(x, y, t) {
        if (y > horizon) {
          const y0 = Math.max(y, horizon + 0.04);
          fish.push({ x0: x, y0, t, dx: rand(0.06, 0.11) * (Math.random() < 0.5 ? -1 : 1), hgt: rand(0.1, 0.18), s: rand(0.8, 1.3) * depthScale(y0, horizon) });
          splashes.push({ x, y: y0, t });
        } else {
          birds.push({ x, y, t, vx: rand(0.05, 0.09) * (Math.random() < 0.5 ? -1 : 1), vy: -rand(0.02, 0.05), ph: rand(0, 6.28) });
        }
        for (const list of [fish, birds, splashes]) while (list.length > 20) list.shift();
      },
      draw(ctx, w, h, t, alpha) {
        ctx.save();
        for (let i = fish.length - 1; i >= 0; i--) {
          const f = fish[i], p = (t - f.t) / 1.3;
          if (p >= 1) { splashes.push({ x: f.x0 + f.dx, y: f.y0, t }); fish.splice(i, 1); continue; }
          const x = (f.x0 + f.dx * p) * w, y = (f.y0 - f.hgt * 4 * p * (1 - p)) * h;
          const angle = Math.atan2(-f.hgt * 4 * (1 - 2 * p) * h, f.dx * w);
          const s = 14 * unit(w) * f.s;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(angle);
          ctx.globalAlpha = alpha;
          ctx.fillStyle = '#f2f8fa';
          ctx.beginPath(); ctx.ellipse(0, 0, s * 1.6, s * 0.6, 0, 0, 6.28); ctx.fill();
          ctx.fillStyle = '#e8a33c';
          ctx.beginPath(); ctx.ellipse(0, -s * 0.15, s * 1.4, s * 0.32, 0, 0, 6.28); ctx.fill();
          ctx.beginPath(); ctx.moveTo(-s * 1.4, 0); ctx.lineTo(-s * 2.4, -s * 0.7); ctx.lineTo(-s * 2.4, s * 0.7); ctx.closePath(); ctx.fill();
          ctx.restore();
        }
        ctx.globalCompositeOperation = 'lighter';
        for (let i = splashes.length - 1; i >= 0; i--) {
          const sp = splashes[i], age = t - sp.t;
          if (age > 1.6) { splashes.splice(i, 1); continue; }
          const k = depthScale(sp.y, horizon);
          ripple(ctx, sp.x * w, sp.y * h, (0.008 + age * 0.04) * w * k, 0.45 * (1 - age / 1.6) * alpha, w);
          for (let j = 0; j < 10; j++) {
            const a = Math.PI + (j / 9) * Math.PI, d = age * 0.05 * w * k;
            ctx.fillStyle = `rgba(235,245,255,${0.7 * (1 - age / 1.6) * alpha})`;
            ctx.beginPath();
            ctx.arc(sp.x * w + Math.cos(a) * d, sp.y * h + Math.sin(a) * d * 0.8 + age * age * 0.06 * h, 1.4 * unit(w), 0, 6.28);
            ctx.fill();
          }
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = `rgba(40,38,48,${0.8 * alpha})`;
        ctx.lineWidth = Math.max(1.4, w / 800);
        ctx.lineCap = 'round';
        for (let i = birds.length - 1; i >= 0; i--) {
          const b = birds[i], age = t - b.t;
          if (age > 6) { birds.splice(i, 1); continue; }
          ctx.globalAlpha = clamp01((6 - age) / 1.5);
          const s = w * 0.01 * (1 + age * 0.05);
          wingStroke(ctx, (b.x + b.vx * age) * w, (b.y + b.vy * age) * h, s, Math.sin(t * 9 + b.ph) * s * 0.7);
        }
        ctx.restore();
      },
    };
  },

  // Day 6: tap the meadow and butterflies flutter up out of the grass.
  flutter() {
    const flies = [];
    const COLORS = ['#f6c344', '#f08a4b', '#ffffff', '#9fd0f5', '#e98ab6'];
    return {
      tap(x, y, t) {
        for (let i = 0; i < 5; i++) {
          flies.push({ x, y, t: t + i * 0.08, vx: rand(-0.05, 0.07), vy: -rand(0.03, 0.07), ph: rand(0, 6.28),
            c: COLORS[(Math.random() * COLORS.length) | 0], s: rand(0.8, 1.3) });
        }
        while (flies.length > 60) flies.shift();
      },
      draw(ctx, w, h, t, alpha) {
        ctx.save();
        for (let i = flies.length - 1; i >= 0; i--) {
          const f = flies[i], age = t - f.t;
          if (age < 0) continue;
          if (age > 8) { flies.splice(i, 1); continue; }
          const x = (f.x + f.vx * age + Math.sin(age * 2 + f.ph) * 0.02) * w;
          const y = (f.y + f.vy * age + Math.sin(age * 3.1 + f.ph) * 0.015) * h;
          const r = 11 * unit(w) * f.s, flap = 0.15 + 0.85 * Math.abs(Math.sin(t * 13 + f.ph));
          ctx.globalAlpha = alpha * clamp01(age / 0.3) * clamp01((8 - age) / 2);
          ctx.fillStyle = f.c;
          for (const side of [-1, 1]) {
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(side * flap, 1);
            ctx.beginPath(); ctx.ellipse(r * 0.55, -r * 0.3, r * 0.6, r * 0.45, -0.4, 0, 6.28); ctx.fill();
            ctx.beginPath(); ctx.ellipse(r * 0.45, r * 0.3, r * 0.4, r * 0.32, 0.4, 0, 6.28); ctx.fill();
            ctx.restore();
          }
          ctx.fillStyle = '#3a2e2a';
          ctx.fillRect(x - r * 0.06, y - r * 0.45, r * 0.12, r * 0.9);
        }
        ctx.restore();
      },
    };
  },

  // Day 7: tap and a soft ring of light spreads out while fireflies gather and settle there.
  gather() {
    const events = [];
    const firefly = glowSprite('255,236,170');
    return {
      tap(x, y, t) {
        events.push({ x, y, t, flies: Array.from({ length: 28 }, () => ({ a: rand(0, 6.28), r: rand(0.08, 0.22), sp: rand(0.5, 1.2), ph: rand(0, 6.28) })) });
        if (events.length > 6) events.shift();
      },
      draw(ctx, w, h, t, alpha) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = events.length - 1; i >= 0; i--) {
          const e = events[i], age = Math.max(0, t - e.t);
          if (age > 9) { events.splice(i, 1); continue; }
          const x = e.x * w, y = e.y * h;
          if (age < 2.8) {
            ctx.strokeStyle = `rgba(255,226,160,${0.35 * (1 - age / 2.8) * alpha})`;
            ctx.lineWidth = Math.max(1.5, w / 600) * (1 - age / 2.8);
            ctx.beginPath(); ctx.arc(x, y, easeOut(age / 2.8) * w * 0.25, 0, 6.28); ctx.stroke();
          }
          const life = clamp01(age / 0.6) * clamp01((9 - age) / 2.5);
          const pull = easeOut(clamp01(age / 3.5));
          for (const f of e.flies) {
            const r = f.r * (1 - 0.75 * pull) * w;
            const a = f.a + age * 0.35 * f.sp;
            const fx = x + Math.cos(a) * r, fy = y + Math.sin(a) * r * 0.6 + Math.sin(t * 1.7 + f.ph) * 4;
            const tw = 0.6 + 0.4 * Math.sin(t * 3 + f.ph);
            stamp(ctx, firefly, fx, fy, 9 * unit(w), 0.9 * tw * life * alpha);
          }
        }
        ctx.restore();
      },
    };
  },

  // Noah builds the ark: tap and a hammer blow knocks wood chips flying.
  hammer() {
    const blows = [];
    const flash = glowSprite('255,230,180');
    const WOOD = ['#b07a45', '#8c5a2e', '#d4a26a', '#6f4523'];
    return {
      tap(x, y, t) {
        blows.push({ x, y, t, chips: Array.from({ length: 14 }, () => ({
          vx: rand(-0.12, 0.12), vy: -rand(0.08, 0.22), spin: rand(-12, 12), s: rand(0.6, 1.4), c: WOOD[(Math.random() * WOOD.length) | 0] })) });
        if (blows.length > 10) blows.shift();
      },
      draw(ctx, w, h, t, alpha) {
        ctx.save();
        for (let i = blows.length - 1; i >= 0; i--) {
          const b = blows[i], age = t - b.t;
          if (age < 0) continue;
          if (age > 1.8) { blows.splice(i, 1); continue; }
          if (age < 0.35) stamp(ctx, flash, b.x * w, b.y * h, w * 0.05, 0.7 * (1 - age / 0.35) * alpha);
          for (const c of b.chips) {
            const x = (b.x + c.vx * age) * w, y = (b.y + c.vy * age + 0.45 * age * age) * h;
            const s = 5 * unit(w) * c.s;
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(c.spin * age);
            ctx.globalAlpha = alpha * clamp01((1.8 - age) / 0.6);
            ctx.fillStyle = c.c;
            ctx.fillRect(-s, -s * 0.35, s * 2, s * 0.7);
            ctx.restore();
          }
        }
        ctx.restore();
      },
    };
  },

  // The flood: tap the clouds and lightning strikes down from them, lighting up the storm.
  lightning(o) {
    const sky = o.sky ?? 0.4;
    const strikes = [];
    return {
      tap(x, y, t) {
        const top = Math.min(y, sky);
        // A jagged path from the clouds down toward the sea, with a branch or two.
        const path = [[x, top]];
        let px = x, py = top;
        while (py < 0.92) { px += rand(-0.035, 0.035); py += rand(0.04, 0.08); path.push([px, py]); }
        const forks = Array.from({ length: 2 }, () => {
          const from = path[1 + ((Math.random() * (path.length - 2)) | 0)];
          let fx = from[0], fy = from[1];
          const dir = Math.random() < 0.5 ? -1 : 1, fork = [[fx, fy]];
          for (let k = 0; k < 3; k++) { fx += dir * rand(0.02, 0.05); fy += rand(0.03, 0.06); fork.push([fx, fy]); }
          return fork;
        });
        strikes.push({ t, path, forks });
        if (strikes.length > 4) strikes.shift();
      },
      draw(ctx, w, h, t, alpha) {
        ctx.save();
        for (let i = strikes.length - 1; i >= 0; i--) {
          const st = strikes[i], age = t - st.t;
          if (age < 0) continue;
          if (age > 1.2) { strikes.splice(i, 1); continue; }
          // The sky flashes white, flickers once, and fades.
          const flicker = age < 0.08 ? 1 : age < 0.16 ? 0.3 : age < 0.24 ? 0.8 : Math.max(0, 1 - (age - 0.24) / 0.9);
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = `rgba(200,215,255,${0.28 * flicker * alpha})`;
          ctx.fillRect(0, 0, w, h);
          if (age < 0.5) {
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            for (const [line, width] of [[st.path, 1], ...st.forks.map(f => [f, 0.5])]) {
              for (const [stroke, glow] of [[`rgba(170,190,255,${0.35 * flicker * alpha})`, 7], [`rgba(255,255,255,${0.95 * flicker * alpha})`, 1.6]]) {
                ctx.strokeStyle = stroke;
                ctx.lineWidth = glow * width * unit(w);
                ctx.beginPath();
                line.forEach(([lx, ly], k) => (k ? ctx.lineTo(lx * w, ly * h) : ctx.moveTo(lx * w, ly * h)));
                ctx.stroke();
              }
            }
          }
        }
        ctx.restore();
      },
    };
  },

  // The dove: tap the sky and a white dove flies off with an olive leaf in her beak.
  dove() {
    const doves = [];
    return {
      tap(x, y, t) {
        doves.push({ x, y, t, dir: x < 0.5 ? 1 : -1, vy: -rand(0.015, 0.035), ph: rand(0, 6.28) });
        if (doves.length > 8) doves.shift();
      },
      draw(ctx, w, h, t, alpha) {
        ctx.save();
        for (let i = doves.length - 1; i >= 0; i--) {
          const d = doves[i], age = t - d.t;
          if (age < 0) continue;
          if (age > 7) { doves.splice(i, 1); continue; }
          const x = (d.x + d.dir * 0.07 * age) * w, y = (d.y + d.vy * age + Math.sin(age * 2.2 + d.ph) * 0.01) * h;
          const s = 16 * unit(w), flap = Math.sin(t * 8 + d.ph);
          ctx.save();
          ctx.globalAlpha = alpha * clamp01(age / 0.25) * clamp01((7 - age) / 1.5);
          ctx.translate(x, y);
          ctx.scale(d.dir, 1);
          ctx.fillStyle = '#fbfaf6';
          ctx.strokeStyle = 'rgba(70,80,95,0.35)';
          ctx.lineWidth = Math.max(1, w / 1400);
          // Body and head.
          ctx.beginPath(); ctx.ellipse(0, 0, s * 1.1, s * 0.45, -0.1, 0, 6.28); ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.arc(s * 1.05, -s * 0.2, s * 0.32, 0, 6.28); ctx.fill(); ctx.stroke();
          // Tail.
          ctx.beginPath(); ctx.moveTo(-s, 0); ctx.lineTo(-s * 1.7, -s * 0.3); ctx.lineTo(-s * 1.7, s * 0.3); ctx.closePath(); ctx.fill(); ctx.stroke();
          // Two wings beating up and down.
          for (const lift of [1, 0.75]) {
            ctx.beginPath();
            ctx.moveTo(-s * 0.3, -s * 0.1);
            ctx.quadraticCurveTo(-s * 0.1, -s * (0.4 + 1.3 * flap * lift), s * 0.5, -s * (0.2 + 1.5 * flap * lift));
            ctx.quadraticCurveTo(s * 0.4, -s * 0.2, s * 0.3, -s * 0.05);
            ctx.closePath(); ctx.fill(); ctx.stroke();
          }
          // The olive leaf.
          ctx.fillStyle = '#6f9a3c';
          ctx.beginPath(); ctx.ellipse(s * 1.55, -s * 0.05, s * 0.32, s * 0.11, 0.5, 0, 6.28); ctx.fill();
          ctx.restore();
        }
        ctx.restore();
      },
    };
  },

  // The road to Bethlehem: tap and the donkey kicks up a puff of dust (and brays).
  dust() {
    const puffs = [];
    const cloud = glowSprite('214,186,140');
    return {
      tap(x, y, t) {
        puffs.push({ x, y, t, bits: Array.from({ length: 9 }, () => ({ dx: rand(-0.05, 0.05), dy: rand(-0.03, 0), r: rand(0.02, 0.045) })) });
        if (puffs.length > 8) puffs.shift();
      },
      draw(ctx, w, h, t, alpha) {
        for (let i = puffs.length - 1; i >= 0; i--) {
          const p = puffs[i], age = t - p.t;
          if (age < 0) continue;
          if (age > 2.2) { puffs.splice(i, 1); continue; }
          const k = easeOut(clamp01(age / 1.4)), fade = clamp01((2.2 - age) / 1.4);
          for (const b of p.bits) stamp(ctx, cloud, (p.x + b.dx * (0.4 + k)) * w, (p.y + b.dy * (0.5 + k)) * h, b.r * w * (0.6 + k), 0.45 * fade * alpha);
        }
      },
    };
  },

  // Angels and lullabies: tap and a golden note floats up; the higher you tap, the higher it sings.
  sing() {
    const notes = [];
    const glow = glowSprite('255,232,170');
    return {
      tap(x, y, t) {
        notes.push({ x, y, t, sway: rand(0, 6.28), s: rand(0.8, 1.2) });
        if (notes.length > 24) notes.shift();
      },
      draw(ctx, w, h, t, alpha) {
        ctx.save();
        for (let i = notes.length - 1; i >= 0; i--) {
          const n = notes[i], age = t - n.t;
          if (age < 0) continue;
          if (age > 3) { notes.splice(i, 1); continue; }
          const fade = clamp01(age / 0.2) * clamp01((3 - age) / 1.2);
          const x = (n.x + Math.sin(age * 2.4 + n.sway) * 0.012) * w, y = (n.y - age * 0.05) * h, s = 9 * unit(w) * n.s;
          stamp(ctx, glow, x, y, s * 5, 0.5 * fade * alpha);
          // A little eighth note.
          ctx.globalAlpha = fade * alpha;
          ctx.fillStyle = '#fff3d0';
          ctx.strokeStyle = '#fff3d0';
          ctx.lineWidth = s * 0.28;
          ctx.beginPath(); ctx.ellipse(x, y, s * 0.75, s * 0.55, -0.4, 0, 6.28); ctx.fill();
          ctx.beginPath(); ctx.moveTo(x + s * 0.65, y); ctx.lineTo(x + s * 0.65, y - s * 2.6); ctx.quadraticCurveTo(x + s * 1.6, y - s * 2.1, x + s * 1.4, y - s * 1.3); ctx.stroke();
        }
        ctx.restore();
      },
    };
  },

  // Under the sea: tap and a stream of bubbles wobbles up toward the light.
  bubbles() {
    const bubbles = [];
    return {
      tap(x, y, t) {
        for (let i = 0; i < 9; i++) bubbles.push({ x: x + rand(-0.015, 0.015), y, t: t + i * 0.07, r: rand(0.004, 0.012), speed: rand(0.08, 0.14), ph: rand(0, 6.28) });
        while (bubbles.length > 90) bubbles.shift();
      },
      draw(ctx, w, h, t, alpha) {
        ctx.save();
        ctx.lineWidth = Math.max(1, w / 1100);
        for (let i = bubbles.length - 1; i >= 0; i--) {
          const b = bubbles[i], age = t - b.t;
          if (age < 0) continue;
          const y = b.y - age * b.speed;
          if (y < -0.05 || age > 7) { bubbles.splice(i, 1); continue; }
          const x = (b.x + Math.sin(age * 3 + b.ph) * 0.008) * w, r = b.r * w * (1 + age * 0.08);
          const a = alpha * clamp01(age / 0.15) * clamp01((7 - age) / 2);
          ctx.strokeStyle = `rgba(220,245,255,${0.75 * a})`;
          ctx.fillStyle = `rgba(200,235,255,${0.12 * a})`;
          ctx.beginPath(); ctx.arc(x, y * h, r, 0, 6.28); ctx.fill(); ctx.stroke();
          ctx.fillStyle = `rgba(255,255,255,${0.8 * a})`;
          ctx.beginPath(); ctx.arc(x - r * 0.35, y * h - r * 0.35, r * 0.22, 0, 6.28); ctx.fill();
        }
        ctx.restore();
      },
    };
  },

  // Adam names the animals: tap and a name floats up from where you tapped. A tap on one of
  // the picture's own animals (`animals: [{ at, name, hit }]`) says its name; anywhere else, any animal's.
  names(o) {
    const NAMES = ['Lion!', 'Elephant!', 'Giraffe!', 'Hippo!', 'Zebra!', 'Peacock!', 'Rabbit!', 'Bear!', 'Camel!', 'Owl!', 'Monkey!',
      'Tiger!', 'Kangaroo!', 'Turtle!', 'Penguin!', 'Fox!', 'Hedgehog!', 'Parrot!', 'Crocodile!', 'Squirrel!'];
    const words = [];
    let next = (Math.random() * NAMES.length) | 0;
    return {
      tap(x, y, t) {
        const near = (o.animals ?? []).find(a => Math.hypot(x - a.at[0], (y - a.at[1]) * 9 / 16) < (a.hit ?? 0.06));
        words.push({ x, y, t, text: near ? `${near.name}!` : NAMES[next++ % NAMES.length], tilt: rand(-0.12, 0.12) });
        if (words.length > 12) words.shift();
      },
      draw(ctx, w, h, t, alpha) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = words.length - 1; i >= 0; i--) {
          const wd = words[i], age = t - wd.t;
          if (age < 0) continue;
          if (age > 3) { words.splice(i, 1); continue; }
          const pop = age < 0.3 ? easeOut(age / 0.3) : 1;
          const size = 30 * unit(w) * (0.6 + 0.4 * pop);
          ctx.save();
          ctx.translate(wd.x * w, (wd.y - age * 0.04) * h);
          ctx.rotate(wd.tilt);
          ctx.globalAlpha = alpha * clamp01((3 - age) / 0.8);
          ctx.font = `600 ${size}px 'Cormorant Garamond', Georgia, serif`;
          ctx.lineWidth = size * 0.18;
          ctx.strokeStyle = 'rgba(30,22,14,0.7)';
          ctx.strokeText(wd.text, 0, 0);
          ctx.fillStyle = '#fff3d6';
          ctx.fillText(wd.text, 0, 0);
          ctx.restore();
        }
        ctx.restore();
      },
    };
  },

  // The plague of frogs: tap and a little green frog leaps across the floor.
  frogs() {
    const frogs = [];
    return {
      tap(x, y, t) {
        for (let i = 0; i < 2; i++) frogs.push({ x0: x + rand(-0.02, 0.02), y0: y, t: t + i * 0.12, dir: Math.random() < 0.5 ? -1 : 1, s: rand(0.8, 1.2) });
        while (frogs.length > 30) frogs.shift();
      },
      draw(ctx, w, h, t, alpha) {
        ctx.save();
        for (let i = frogs.length - 1; i >= 0; i--) {
          const f = frogs[i], age = t - f.t;
          if (age < 0) continue;
          if (age > 3.2) { frogs.splice(i, 1); continue; }
          // Three hops, each a little arc.
          const hop = Math.min(2, Math.floor(age / 0.55)), p = clamp01((age - hop * 0.55) / 0.45);
          const x = (f.x0 + f.dir * (hop + Math.min(1, p)) * 0.045) * w;
          const y = (f.y0 - (p < 1 ? Math.sin(p * Math.PI) * 0.05 : 0)) * h;
          const s = 12 * unit(w) * f.s;
          ctx.save();
          ctx.translate(x, y);
          ctx.scale(f.dir, 1);
          ctx.globalAlpha = alpha * clamp01((3.2 - age) / 0.6);
          ctx.fillStyle = '#5fae3e';
          ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.7, -0.2, 0, 6.28); ctx.fill();                 // body
          ctx.beginPath(); ctx.ellipse(-s * 0.9, s * 0.35, s * 0.55, s * 0.22, 0.4, 0, 6.28); ctx.fill(); // back leg
          ctx.fillStyle = '#7cc957';
          ctx.beginPath(); ctx.ellipse(s * 0.2, s * 0.15, s * 0.6, s * 0.35, -0.2, 0, 6.28); ctx.fill(); // belly
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(s * 0.55, -s * 0.55, s * 0.28, 0, 6.28); ctx.fill();                 // eye
          ctx.fillStyle = '#1d1d1d';
          ctx.beginPath(); ctx.arc(s * 0.62, -s * 0.55, s * 0.13, 0, 6.28); ctx.fill();
          ctx.restore();
        }
        ctx.restore();
      },
    };
  },
};
