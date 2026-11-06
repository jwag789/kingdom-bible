// Hand-coded stand-ins for each layer until real art is generated.
// Each painter fills a w×h canvas; plates are opaque, cutouts leave transparency.

function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function vgrad(ctx, w, h, stops, y0 = 0, y1 = h) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.fillRect(0, y0, w, y1 - y0);
}

function glow(ctx, x, y, r, inner, outer = 'rgba(0,0,0,0)') {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

// A hill or mountain line filled down to the bottom of the canvas.
function ridge(ctx, w, h, { y, amp, seed, fill, bumps = 4, from = 0, to = 1 }) {
  const rnd = seeded(seed);
  const waves = Array.from({ length: bumps }, (_, i) => ({ f: (i + 1) * (0.7 + rnd()), p: rnd() * 6.28, a: 1 / (i + 1) }));
  ctx.beginPath();
  ctx.moveTo(from * w, h);
  for (let i = 0; i <= 120; i++) {
    const u = from + (to - from) * (i / 120);
    let v = 0;
    for (const wv of waves) v += Math.sin(u * 6.28 * wv.f + wv.p) * wv.a;
    ctx.lineTo(u * w, (y - amp * (0.5 + 0.35 * v)) * h);
  }
  ctx.lineTo(to * w, h);
  ctx.closePath();
  if (Array.isArray(fill)) {
    const g = ctx.createLinearGradient(0, (y - amp) * h, 0, h);
    fill.forEach((c, i) => g.addColorStop(i / (fill.length - 1), c));
    ctx.fillStyle = g;
  } else ctx.fillStyle = fill;
  ctx.fill();
}

// Glints and long sheen lines on the water.
function sheen(ctx, w, h, { top, seed, color = '255,255,255', alpha = 0.12, count = 160, column = null }) {
  const rnd = seeded(seed);
  for (let i = 0; i < count; i++) {
    const d = Math.pow(rnd(), 1.4);
    const y = (top + d * (1 - top)) * h;
    let x = rnd() * w;
    if (column != null) x = column * w + (rnd() - 0.5) * w * (0.05 + d * 0.25);
    const len = (0.01 + d * 0.06) * w * (0.5 + rnd());
    ctx.fillStyle = `rgba(${color},${alpha * (0.3 + rnd() * 0.7)})`;
    ctx.fillRect(x - len / 2, y, len, Math.max(1, h * 0.0016 * (1 + d * 2)));
  }
}

function clouds(ctx, w, h, { y, spread, count, seed, size, light = '255,250,240', shade = '200,190,200' }) {
  const rnd = seeded(seed);
  ctx.save();
  ctx.filter = `blur(${w / 260}px)`;
  for (let i = 0; i < count; i++) {
    const cx = rnd() * w, cy = (y + (rnd() - 0.5) * spread) * h, r = size * w * (0.4 + rnd());
    glow(ctx, cx, cy + r * 0.25, r, `rgba(${shade},0.35)`, `rgba(${shade},0)`);
    glow(ctx, cx, cy, r * 0.9, `rgba(${light},0.75)`, `rgba(${light},0)`);
  }
  ctx.restore();
}

function blobs(ctx, cx, cy, r, colors, n, rnd) {
  for (let i = 0; i < n; i++) {
    const a = rnd() * 6.28, d = Math.sqrt(rnd()) * r;
    ctx.fillStyle = colors[(rnd() * colors.length) | 0];
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, r * (0.35 + rnd() * 0.35), 0, 6.28);
    ctx.fill();
  }
}

export const PAINTERS = {
  void(ctx, w, h) {
    vgrad(ctx, w, h, [[0, '#04050a'], [0.5, '#0a0f1f'], [0.6, '#162235'], [0.615, '#0d1824'], [1, '#03070b']]);
    glow(ctx, w * 0.5, h * 0.6, w * 0.5, 'rgba(60,80,115,0.18)');
    sheen(ctx, w, h, { top: 0.615, seed: 3, alpha: 0.05 });
  },

  firstLight(ctx, w, h) {
    vgrad(ctx, w, h, [[0, '#2a2440'], [0.28, '#776380'], [0.5, '#e6bd86'], [0.6, '#fff0c8'], [0.615, '#8e9b92'], [0.75, '#2f4d5a'], [1, '#0c1f2b']]);
    glow(ctx, w * 0.62, h * 0.18, w * 0.65, 'rgba(255,236,190,0.55)', 'rgba(255,236,190,0)');
    glow(ctx, w * 0.62, h * 0.62, w * 0.3, 'rgba(255,230,170,0.35)', 'rgba(255,230,170,0)');
    sheen(ctx, w, h, { top: 0.615, seed: 5, color: '255,226,160', alpha: 0.35, count: 220, column: 0.62 });
    sheen(ctx, w, h, { top: 0.615, seed: 6, alpha: 0.08 });
  },

  expanse(ctx, w, h) {
    vgrad(ctx, w, h, [[0, '#3f63a0'], [0.35, '#8fb2d8'], [0.56, '#f3e3c6'], [0.6, '#f8ecd4'], [0.607, '#5f93a8'], [1, '#123548']]);
    clouds(ctx, w, h, { y: 0.28, spread: 0.18, count: 34, seed: 11, size: 0.07, shade: '210,180,190' });
    clouds(ctx, w, h, { y: 0.5, spread: 0.06, count: 22, seed: 12, size: 0.04 });
    sheen(ctx, w, h, { top: 0.607, seed: 13, alpha: 0.14 });
  },

  waters(ctx, w, h) {
    vgrad(ctx, w, h, [[0, '#5a83b8'], [0.42, '#c3d6e6'], [0.57, '#f4e6cc'], [0.6, '#f7ead2'], [0.605, '#6aa2b4'], [1, '#164257']]);
    clouds(ctx, w, h, { y: 0.3, spread: 0.2, count: 18, seed: 21, size: 0.05 });
    sheen(ctx, w, h, { top: 0.605, seed: 22, alpha: 0.14 });
  },

  land(ctx, w, h) {
    PAINTERS.waters(ctx, w, h);
    ridge(ctx, w, h, { y: 0.6, amp: 0.12, seed: 31, fill: ['#93aebd', '#a9bcc0'], bumps: 5, from: 0.1, to: 0.75 });
    ridge(ctx, w, h, { y: 0.66, amp: 0.08, seed: 32, fill: ['#7ea461', '#5d8a4a'], bumps: 4, from: -0.05, to: 0.9 });
    ridge(ctx, w, h, { y: 0.78, amp: 0.09, seed: 33, fill: ['#5b8b45', '#3a6631'], bumps: 3, from: -0.05, to: 1.05 });
    glow(ctx, w * 0.7, h * 0.3, w * 0.5, 'rgba(255,240,200,0.18)');
  },

  trees(ctx, w, h) {
    const rnd = seeded(41);
    ridge(ctx, w, h, { y: 0.92, amp: 0.04, seed: 42, fill: ['#43712f', '#2b4d22'] });
    ctx.save();
    ctx.filter = `blur(${w / 700}px)`;
    for (let i = 0; i < 9; i++) {
      const x = ((i + 0.2 + rnd() * 0.6) / 9) * w;
      if (x > w * 0.3 && x < w * 0.62) continue;   // keep the middle open
      const th = (0.16 + rnd() * 0.14) * h, base = h * (0.9 + rnd() * 0.04);
      ctx.fillStyle = '#5a4030';
      ctx.fillRect(x - w * 0.004, base - th, w * 0.008, th);
      const cr = th * 0.42;
      blobs(ctx, x, base - th, cr, ['#3f7a3a', '#4f8c40', '#2f6630', '#6a9d48'], 26, rnd);
      blobs(ctx, x, base - th, cr * 0.9, ['#d9473b', '#f0a43a', '#e86a3a'], 9, () => rnd() * 0.25 + rnd() * 0.75);
    }
    for (let i = 0; i < 160; i++) {
      ctx.fillStyle = ['#f6e27a', '#f2a1b8', '#ffffff', '#c9a1f0'][(rnd() * 4) | 0];
      ctx.beginPath();
      ctx.arc(rnd() * w, h * (0.9 + rnd() * 0.1), w * 0.0025 * (0.6 + rnd()), 0, 6.28);
      ctx.fill();
    }
    ctx.restore();
  },

  twilight(ctx, w, h) {
    vgrad(ctx, w, h, [[0, '#0f1433'], [0.25, '#2c2f66'], [0.45, '#8a4f72'], [0.56, '#e08a64'], [0.6, '#f6b874'], [0.605, '#6a4f62'], [1, '#1a1830']]);
    glow(ctx, w * 0.28, h * 0.6, w * 0.35, 'rgba(255,180,110,0.45)', 'rgba(255,180,110,0)');
    ctx.fillStyle = '#ffd890';
    ctx.beginPath(); ctx.arc(w * 0.28, h * 0.6, w * 0.045, Math.PI, 0); ctx.fill();
    glow(ctx, w * 0.78, h * 0.2, w * 0.08, 'rgba(240,236,220,0.35)', 'rgba(240,236,220,0)');
    ctx.fillStyle = '#f3efe1';
    ctx.beginPath(); ctx.arc(w * 0.78, h * 0.2, w * 0.022, 0, 6.28); ctx.fill();
    sheen(ctx, w, h, { top: 0.605, seed: 51, color: '255,190,120', alpha: 0.4, count: 200, column: 0.28 });
    ridge(ctx, w, h, { y: 0.72, amp: 0.07, seed: 52, fill: ['#2e2443', '#141226'], from: 0.45, to: 1.05 });
  },

  teeming(ctx, w, h) {
    vgrad(ctx, w, h, [[0, '#6f9fd2'], [0.45, '#cfe0ee'], [0.555, '#f6ead2'], [0.565, '#4aa2b6'], [1, '#0d3a52']]);
    clouds(ctx, w, h, { y: 0.22, spread: 0.12, count: 14, seed: 61, size: 0.05 });
    const rnd = seeded(62);
    for (let s = 0; s < 6; s++) {
      const cx = rnd() * w, cy = h * (0.68 + rnd() * 0.25);
      for (let i = 0; i < 26; i++) {
        ctx.fillStyle = `rgba(170,230,230,${0.12 + rnd() * 0.15})`;
        ctx.beginPath();
        ctx.ellipse(cx + (rnd() - 0.5) * w * 0.12, cy + (rnd() - 0.5) * h * 0.06, w * 0.008, w * 0.0025, 0.2, 0, 6.28);
        ctx.fill();
      }
    }
    sheen(ctx, w, h, { top: 0.565, seed: 63, alpha: 0.16 });
  },

  whale(ctx, w, h) {
    const x = w * 0.64, y = h * 0.6;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-1.05);
    const g = ctx.createLinearGradient(0, -w * 0.04, 0, w * 0.04);
    g.addColorStop(0, '#2b3d55'); g.addColorStop(0.7, '#4d6884'); g.addColorStop(1, '#c9d3d8');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(w * 0.07, 0, w * 0.1, w * 0.034, 0, 0, 6.28);
    ctx.fill();
    ctx.fillStyle = '#2b3d55';
    ctx.beginPath();
    ctx.ellipse(w * 0.08, w * 0.035, w * 0.03, w * 0.009, 0.5, 0, 6.28);
    ctx.fill();
    ctx.restore();
    const rnd = seeded(71);
    for (let i = 0; i < 40; i++) {
      const a = Math.PI + rnd() * Math.PI, d = rnd() * w * 0.09;
      glow(ctx, x + Math.cos(a) * d, y - Math.abs(Math.sin(a)) * d * 0.5, w * (0.008 + rnd() * 0.016),
        'rgba(255,255,255,0.85)', 'rgba(255,255,255,0)');
    }
  },

  meadow(ctx, w, h) {
    vgrad(ctx, w, h, [[0, '#79a7d9'], [0.4, '#cfe1ef'], [0.55, '#f7e7c4'], [0.6, '#f9ecd0']]);
    clouds(ctx, w, h, { y: 0.25, spread: 0.12, count: 12, seed: 81, size: 0.05 });
    ridge(ctx, w, h, { y: 0.58, amp: 0.08, seed: 82, fill: ['#8fa9c4', '#a4b8c2'], bumps: 5 });
    ridge(ctx, w, h, { y: 0.65, amp: 0.05, seed: 83, fill: ['#93ae62', '#7e9c50'], bumps: 3 });
    vgrad(ctx, w, h, [[0, '#a9bb5c'], [1, '#5f8636']], h * 0.7, h);
    ridge(ctx, w, h, { y: 0.72, amp: 0.03, seed: 84, fill: ['#a9bb5c', '#5f8636'], bumps: 2 });
    const rnd = seeded(85);
    for (let i = 0; i < 500; i++) {
      const d = Math.pow(rnd(), 1.5);
      ctx.fillStyle = ['#f6e27a', '#f2a1b8', '#ffffff', '#e86a5a', '#c9a1f0'][(rnd() * 5) | 0];
      ctx.globalAlpha = 0.5 + d * 0.5;
      ctx.beginPath();
      ctx.arc(rnd() * w, h * (0.72 + d * 0.28), w * 0.0015 * (1 + d * 3), 0, 6.28);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  },

  animals(ctx, w, h) {
    const ground = h * 0.76, u = w * 0.01;
    ctx.save();
    ctx.filter = `blur(${w / 1200}px)`;
    const body = (x, y, rx, ry, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 6.28); ctx.fill(); };
    const legs = (x, y, span, len, c, n = 4) => {
      ctx.fillStyle = c;
      for (let i = 0; i < n; i++) ctx.fillRect(x - span / 2 + (i * span) / (n - 1) - u * 0.25, y, u * 0.5, len);
    };
    // elephant
    legs(w * 0.27, ground - u * 3.2, u * 5, u * 3.2, '#6d6670');
    body(w * 0.27, ground - u * 4.6, u * 4.2, u * 2.8, '#7a737e');
    body(w * 0.27 - u * 4.4, ground - u * 5.4, u * 1.9, u * 1.8, '#7a737e');
    ctx.strokeStyle = '#7a737e'; ctx.lineWidth = u * 0.9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(w * 0.27 - u * 5.6, ground - u * 5); ctx.quadraticCurveTo(w * 0.27 - u * 6.4, ground - u * 2, w * 0.27 - u * 5.6, ground - u * 0.8); ctx.stroke();
    // giraffe
    legs(w * 0.4, ground - u * 4.5, u * 2.6, u * 4.5, '#b88a4a');
    body(w * 0.4, ground - u * 5, u * 2.4, u * 1.3, '#d0a05a');
    ctx.strokeStyle = '#d0a05a'; ctx.lineWidth = u * 0.8;
    ctx.beginPath(); ctx.moveTo(w * 0.4 - u * 1.6, ground - u * 5.4); ctx.lineTo(w * 0.4 - u * 3.2, ground - u * 10.5); ctx.stroke();
    body(w * 0.4 - u * 3.6, ground - u * 10.6, u * 0.9, u * 0.5, '#d0a05a');
    // lion
    legs(w * 0.66, ground - u * 1.8, u * 3, u * 1.8, '#b5873f');
    body(w * 0.66, ground - u * 2.6, u * 2.5, u * 1.3, '#cf9d4e');
    body(w * 0.66 - u * 2.6, ground - u * 3.2, u * 1.4, u * 1.4, '#9a6430');
    body(w * 0.66 - u * 2.8, ground - u * 3.2, u * 0.8, u * 0.8, '#cf9d4e');
    // deer
    legs(w * 0.74, ground - u * 2.4, u * 2, u * 2.4, '#94643d');
    body(w * 0.74, ground - u * 2.9, u * 1.7, u * 0.9, '#a8744a');
    body(w * 0.74 + u * 1.9, ground - u * 4, u * 0.6, u * 0.45, '#a8744a');
    // sheep
    for (const [sx, s] of [[0.81, 1], [0.85, 0.85], [0.78, 0.75]]) {
      legs(w * sx, ground - u * 1.2 * s, u * 1.4 * s, u * 1.2 * s, '#4a4048');
      blobs(ctx, w * sx, ground - u * 1.8 * s, u * 1.3 * s, ['#f4efe4', '#ebe4d6'], 10, seeded(Math.round(sx * 100)));
    }
    ctx.restore();
  },

  people(ctx, w, h) {
    const base = h * 0.78, u = w * 0.006;
    const figure = (x, tall, robe) => {
      ctx.fillStyle = robe;
      ctx.beginPath();
      ctx.moveTo(x - u * 1.1, base);
      ctx.quadraticCurveTo(x - u * 1.3, base - tall * 0.6, x - u * 0.7, base - tall * 0.85);
      ctx.lineTo(x + u * 0.7, base - tall * 0.85);
      ctx.quadraticCurveTo(x + u * 1.3, base - tall * 0.6, x + u * 1.1, base);
      ctx.fill();
      ctx.fillStyle = '#4a3428';
      ctx.beginPath(); ctx.arc(x, base - tall * 0.92, u * 0.7, 0, 6.28); ctx.fill();
    };
    figure(w * 0.52, u * 7.4, '#6b5644');
    figure(w * 0.535, u * 6.8, '#7b6450');
    const rnd = seeded(91);
    ctx.strokeStyle = '#5f8636'; ctx.lineWidth = Math.max(1, w / 1600);
    for (let i = 0; i < 90; i++) {
      const x = w * (0.49 + rnd() * 0.08), y = base + rnd() * u * 0.6;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rnd() - 0.5) * u, y - u * (1 + rnd() * 2.5)); ctx.stroke();
    }
  },

  rest(ctx, w, h) {
    vgrad(ctx, w, h, [[0, '#cf8f63'], [0.3, '#efc48c'], [0.5, '#fbe3b0'], [0.57, '#fff1cf'], [0.59, '#d6b88a'], [1, '#5e5136']]);
    glow(ctx, w * 0.5, h * 0.5, w * 0.55, 'rgba(255,244,214,0.6)', 'rgba(255,244,214,0)');
    sheen(ctx, w, h, { top: 0.59, seed: 101, color: '255,240,200', alpha: 0.3, count: 180, column: 0.5 });
    ridge(ctx, w, h, { y: 0.66, amp: 0.07, seed: 102, fill: ['#b19a6a', '#8c7d55'], from: -0.05, to: 0.4 });
    ridge(ctx, w, h, { y: 0.68, amp: 0.06, seed: 103, fill: ['#a99566', '#857650'], from: 0.62, to: 1.05 });
    ridge(ctx, w, h, { y: 0.84, amp: 0.05, seed: 104, fill: ['#7d7b4c', '#4f4e30'] });
  },
};
