// Soft shapes painted once and stamped many times. Building a gradient for every glow on
// every frame is slow; drawing a ready-made image (scaled, with alpha) is cheap.

const cache = new Map();

function make(key, w, h, paint) {
  if (!cache.has(key)) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    paint(c.getContext('2d'), w, h);
    cache.set(key, c);
  }
  return cache.get(key);
}

// A round glow in one colour ("r,g,b"), fully bright at the centre and fading to nothing.
// `core` (0..1) is how far out it stays near full brightness.
export function glowSprite(rgb, core = 0) {
  return make(`glow:${rgb}:${core}`, 128, 128, (ctx, w) => {
    const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, `rgba(${rgb},1)`);
    if (core > 0) g.addColorStop(core, `rgba(${rgb},0.5)`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, w);
  });
}

// A beam: a thin wedge from a point at the top, widening and fading downward.
export function beamSprite(rgb) {
  return make(`beam:${rgb}`, 64, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, `rgba(${rgb},1)`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
  });
}

// Stamp a sprite centred at x, y with radius r.
export function stamp(ctx, sprite, x, y, r, alpha) {
  if (alpha <= 0.002) return;
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.drawImage(sprite, x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}
