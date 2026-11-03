// Sound for the reader, all made live with the Web Audio API — no recordings, nothing to
// license: an ambience for each day (sea, wind, birds, crickets…), a gentle generative score
// in D major, and an effect for every slide turn and tap. Narration plays through the same
// mix (see narrator.js) so the music can duck under the voice.
//
// Browsers only allow sound after the reader interacts, so nothing starts until `unlock()`.

const midiHz = m => 440 * 2 ** ((m - 69) / 12);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = list => list[(Math.random() * list.length) | 0];
const PENTA = [0, 2, 4, 7, 9];
const KEY = 62;                                     // D4

// The score for each mood: chords as [scale degree in semitones above D, 'maj' | 'min'],
// how often a bell note sounds, and how bright the pad is.
const MOODS = {
  void:     { chords: [[0, 'drone']], bells: null, cutoff: 380, level: 0.05 },
  dawn:     { chords: [[0, 'maj'], [9, 'min'], [5, 'maj'], [7, 'maj']], bells: [2.5, 5], cutoff: 1100, level: 0.045 },
  sky:      { chords: [[0, 'maj'], [5, 'maj'], [4, 'min'], [7, 'maj']], bells: [3, 6], cutoff: 1300, level: 0.04 },
  growing:  { chords: [[5, 'maj'], [0, 'maj'], [9, 'min'], [7, 'maj']], bells: [2, 4.5], cutoff: 1400, level: 0.04 },
  night:    { chords: [[9, 'min'], [5, 'maj'], [0, 'maj'], [7, 'maj']], bells: [3.5, 7], cutoff: 900, level: 0.04, high: true },
  lively:   { chords: [[0, 'maj'], [7, 'maj'], [9, 'min'], [5, 'maj']], bells: [1.6, 3.5], cutoff: 1500, level: 0.038 },
  warm:     { chords: [[5, 'maj'], [7, 'maj'], [0, 'maj'], [9, 'min']], bells: [2.5, 5], cutoff: 1200, level: 0.042 },
  rest:     { chords: [[0, 'maj'], [5, 'maj']], bells: [5, 9], cutoff: 800, level: 0.04, slow: true },
  glory:    { chords: [[0, 'maj'], [7, 'maj'], [5, 'maj'], [0, 'maj']], bells: [1.8, 3.5], cutoff: 1700, level: 0.05 },
  storm:    { chords: [[9, 'min'], [5, 'maj'], [4, 'min'], [9, 'min']], bells: null, cutoff: 520, level: 0.05 },
};

function store(key, fallback) {
  try { const v = localStorage.getItem(`kb:${key}`); return v == null ? fallback : v === '1'; } catch { return fallback; }
}
function save(key, on) { try { localStorage.setItem(`kb:${key}`, on ? '1' : '0'); } catch {} }

export class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = store('sound', true);
    this.want = { ambience: [], mood: null };       // what should be playing, applied once unlocked
    this.layers = new Map();                        // ambience name → { stop }
    this.mood = null;
    this.ducked = false;
  }

  get ready() { return !!this.ctx && this.ctx.state === 'running'; }

  // Call from a user gesture.
  unlock() {
    if (!this.ctx) this.build();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setEnabled(on) {
    this.enabled = on;
    save('sound', on);
    if (this.ctx) this.out.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.15);
  }

  build() {
    // On iPhones, web audio is silenced by the ring/silent switch unless the page says it's
    // playing media (like a video would). Safari 17+ understands this; elsewhere it's ignored.
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
    const ctx = this.ctx = new AudioContext();
    this.out = this.gain(this.enabled ? 1 : 0);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.3;
    this.out.connect(comp).connect(ctx.destination);

    // One shared hall for everything to sit in.
    this.verb = ctx.createConvolver();
    this.verb.buffer = this.impulse(3.4, 2.6);
    this.verb.connect(this.gain(0.55)).connect(this.out);

    this.musicBus = this.bus(0.9, 0.7);
    this.ambBus = this.bus(0.55, 0.12);
    this.sfxBus = this.bus(0.7, 0.45);
    // The narrator gets room to resound: warmth underneath, softened esses, and a long hall
    // of its own (after a short pre-delay so the words stay clear).
    this.voiceBus = this.gain(1.6);
    const warm = this.filter('lowshelf', 220), soft = this.filter('highshelf', 6500);
    warm.gain.value = 4; soft.gain.value = -2.5;
    this.voiceBus.connect(warm).connect(soft).connect(this.out);
    const pre = ctx.createDelay(0.2), hall = ctx.createConvolver();
    pre.delayTime.value = 0.07;
    hall.buffer = this.impulse(4.8, 3.2);
    soft.connect(this.gain(0.2)).connect(pre).connect(hall).connect(this.out);

    this.white = this.noise('white', 4);
    this.brown = this.noise('brown', 8);
    this.pink = this.noise('pink', 6);

    // One clock for everything scheduled: score, birds, crickets, waves.
    this.timer = setInterval(() => this.tick(), 200);
    this.setAmbience(this.want.ambience);
    this.setMood(this.want.mood);
  }

  // ---- small building blocks
  gain(v) { const g = this.ctx.createGain(); g.gain.value = v; return g; }
  bus(level, wet) {
    const g = this.gain(level);
    g.connect(this.out);
    g.connect(this.gain(wet)).connect(this.verb);
    return g;
  }
  osc(type, freq) { const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = freq; return o; }
  filter(type, freq, q = 0.7) { const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; return f; }
  loop(buffer) {
    const s = this.ctx.createBufferSource();
    s.buffer = buffer; s.loop = true;
    s.start(0, Math.random() * buffer.duration);
    return s;
  }
  impulse(seconds, decay) {
    const { sampleRate } = this.ctx, n = sampleRate * seconds;
    const buf = this.ctx.createBuffer(2, n, sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
    }
    return buf;
  }
  noise(kind, seconds) {
    const { sampleRate } = this.ctx, n = sampleRate * seconds;
    const buf = this.ctx.createBuffer(1, n, sampleRate), d = buf.getChannelData(0);
    let last = 0, b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else if (kind === 'pink') { b0 = 0.997 * b0 + 0.029591 * w; b1 = 0.985 * b1 + 0.032534 * w; b2 = 0.95 * b2 + 0.048056 * w; d[i] = (b0 + b1 + b2 + w * 0.1) * 0.6; }
      else d[i] = w;
    }
    return buf;
  }
  // A slow wobble applied to an AudioParam: base ± depth at `rate` Hz.
  lfo(param, base, depth, rate) {
    param.value = base;
    const o = this.osc('sine', rate), g = this.gain(depth);
    o.connect(g).connect(param);
    o.start();
    return o;
  }
  // An envelope: rise to `peak` over `attack`, then fall away over `release`.
  env(g, at, peak, attack, release) {
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + attack + release);
  }

  // ---- ambience: each layer is a little graph with a stop() that fades it out
  setAmbience(names) {
    this.want.ambience = names ?? [];
    if (!this.ctx) return;
    for (const [name, layer] of this.layers) {
      if (!this.want.ambience.includes(name)) { layer.stop(); this.layers.delete(name); }
    }
    for (const name of this.want.ambience) {
      if (!this.layers.has(name) && AMBIENCE[name]) this.layers.set(name, AMBIENCE[name](this));
    }
  }

  // Wraps a layer: fades in on creation; stop() fades out and cleans up.
  layer(level, build) {
    const ctx = this.ctx, g = this.gain(0);
    g.connect(this.ambBus);
    g.gain.setTargetAtTime(level, ctx.currentTime, 1.2);
    const parts = build(g) ?? {};
    return {
      tick: parts.tick,
      stop: () => {
        g.gain.setTargetAtTime(0, ctx.currentTime, 0.9);
        setTimeout(() => { (parts.nodes ?? []).forEach(n => { try { n.stop(); } catch {} }); g.disconnect(); }, 4000);
      },
    };
  }

  tick() {
    const now = this.ctx.currentTime;
    for (const layer of this.layers.values()) layer.tick?.(now);
    this.score(now);
  }

  // ---- the score
  setMood(name) {
    this.want.mood = name;
    if (!this.ctx || !name || name === this.mood) return;
    this.mood = name;
    const now = this.ctx.currentTime;
    this.releaseChord(now, 2.5);
    this.nextChord = now + 0.2;
    this.chordIndex = 0;
    this.nextBell = now + rand(1.5, 3);
  }

  releaseChord(at, time) {
    if (!this.chord) return;
    const { g, nodes } = this.chord;
    g.gain.cancelScheduledValues(at);
    g.gain.setTargetAtTime(0, at, time / 3);
    nodes.forEach(n => n.stop(at + time + 0.5));
    this.chord = null;
  }

  score(now) {
    const m = MOODS[this.mood];
    if (!m) return;
    const span = m.slow ? 11 : 8;
    if (now + 0.3 >= this.nextChord) {
      const at = Math.max(now, this.nextChord);
      this.releaseChord(at, 3);
      this.playChord(m, m.chords[this.chordIndex++ % m.chords.length], at);
      this.nextChord = at + span;
    }
    if (m.bells && now + 0.3 >= this.nextBell) {
      const at = Math.max(now, this.nextBell);
      const [deg, kind] = m.chords[(this.chordIndex + m.chords.length - 1) % m.chords.length];
      // Bells favour notes of the current chord, drawn from the pentatonic scale.
      const tones = kind === 'drone' ? PENTA : [deg, deg + (kind === 'min' ? 3 : 4), deg + 7, ...PENTA];
      const note = KEY + 12 + (m.high ? 12 : 0) + pick(tones) % 12 + pick([0, 0, 12]);
      this.bell(note, at, rand(0.05, 0.09), 4, this.musicBus);
      if (Math.random() < 0.3) this.bell(note + pick([7, 12, -5]), at + rand(0.3, 0.8), 0.04, 3.5, this.musicBus);
      this.nextBell = at + rand(...m.bells);
    }
  }

  playChord(m, [deg, kind], at) {
    const ctx = this.ctx;
    const g = this.gain(0);
    const lp = this.filter('lowpass', m.cutoff, 0.4);
    g.connect(lp).connect(this.musicBus);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(m.level, at + 3);
    const notes = kind === 'drone'
      ? [KEY - 24, KEY - 17, KEY - 12]
      : [KEY - 24 + deg, KEY - 12 + deg, KEY - 12 + deg + (kind === 'min' ? 3 : 4), KEY - 12 + deg + 7, KEY + deg + (kind === 'min' ? 3 : 4)];
    const nodes = [];
    for (const n of notes) {
      for (const cents of [-6, 6]) {
        const o = this.osc('triangle', midiHz(n));
        o.detune.value = cents;
        o.connect(g);
        o.start(at);
        nodes.push(o);
      }
    }
    // A slow swell in the filter keeps the pad breathing.
    const wob = this.osc('sine', 0.08), wg = this.gain(m.cutoff * 0.25);
    wob.connect(wg).connect(lp.frequency);
    wob.start(at);
    nodes.push(wob);
    this.chord = { g, nodes };
  }

  // A soft bell: a few partials, struck and left to ring.
  bell(midi, at, vel, decay, bus) {
    const g = this.gain(0);
    g.connect(bus);
    this.env(g, at, vel, 0.008, decay);
    const f = midiHz(midi);
    for (const [ratio, amp] of [[1, 1], [2, 0.4], [3.01, 0.16], [4.17, 0.08]]) {
      const o = this.osc('sine', f * ratio), pg = this.gain(amp / ratio);
      o.connect(pg).connect(g);
      o.start(at);
      o.stop(at + decay + 0.2);
    }
  }

  // A plucked note: bright at first, mellowing quickly — like a kalimba.
  pluck(midi, at, vel = 0.12) {
    const g = this.gain(0), lp = this.filter('lowpass', 4000, 0.8);
    g.connect(lp).connect(this.sfxBus);
    this.env(g, at, vel, 0.004, 1.1);
    lp.frequency.setValueAtTime(5000, at);
    lp.frequency.exponentialRampToValueAtTime(700, at + 0.4);
    for (const [type, mult] of [['triangle', 1], ['sine', 2]]) {
      const o = this.osc(type, midiHz(midi) * mult);
      o.connect(g); o.start(at); o.stop(at + 1.3);
    }
  }

  // Shaped noise: for whooshes, splashes and wind gusts.
  noiseBurst({ at, peak, attack, release, type = 'bandpass', from, to, q = 1, bus = this.sfxBus, buffer = this.white }) {
    const s = this.ctx.createBufferSource();
    s.buffer = buffer;
    const f = this.filter(type, from, q), g = this.gain(0);
    s.connect(f).connect(g).connect(bus);
    f.frequency.setValueAtTime(from, at);
    f.frequency.exponentialRampToValueAtTime(to, at + attack + release);
    this.env(g, at, peak, attack, release);
    s.start(at, Math.random() * 2);
    s.stop(at + attack + release + 0.1);
  }

  // A bird: a quick run of rising and falling whistles.
  chirp(at, bus = this.sfxBus, vel = 0.06) {
    const notes = (Math.random() * 4 | 0) + 2, base = rand(2400, 3600);
    for (let i = 0; i < notes; i++) {
      const t = at + i * rand(0.07, 0.13), o = this.osc('sine', base), g = this.gain(0);
      o.connect(g).connect(bus);
      const up = base * rand(1.15, 1.5);
      o.frequency.setValueAtTime(base * rand(0.9, 1.05), t);
      o.frequency.exponentialRampToValueAtTime(up, t + 0.04);
      o.frequency.exponentialRampToValueAtTime(base * rand(0.8, 1), t + 0.09);
      this.env(g, t, vel * rand(0.6, 1), 0.01, 0.08);
      o.start(t); o.stop(t + 0.14);
    }
  }

  // ---- effects for the story
  turn() {                           // a page turning: a soft breath of air
    if (!this.ready) return;
    this.noiseBurst({ at: this.ctx.currentTime, peak: 0.07, attack: 0.18, release: 0.45, from: 500, to: 2600, q: 0.9, buffer: this.pink });
  }

  arrive() {                         // a new day's title: two quiet bells
    if (!this.ready) return;
    const at = this.ctx.currentTime + 0.25;
    this.bell(KEY + 12, at, 0.07, 4.5, this.sfxBus);
    this.bell(KEY + 19, at + 0.18, 0.05, 4.5, this.sfxBus);
  }

  lightBurst() {                     // "Let there be light!"
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    const boom = this.osc('sine', 70), bg = this.gain(0);
    boom.connect(bg).connect(this.sfxBus);
    boom.frequency.exponentialRampToValueAtTime(38, now + 2.5);
    this.env(bg, now, 0.5, 0.02, 3);
    boom.start(now); boom.stop(now + 3.2);
    this.noiseBurst({ at: now, peak: 0.18, attack: 0.05, release: 2.6, type: 'highpass', from: 6000, to: 2500, q: 0.5 });
    // A cascade of bright bells rising into the light.
    const steps = [0, 4, 7, 12, 16, 19, 24, 28, 31];
    steps.forEach((s, i) => this.bell(KEY + s, now + 0.05 + i * 0.09, 0.09 - i * 0.004, 5, this.sfxBus));
  }

  lift() {                           // water rising into a cloud
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    const o = this.osc('sine', 260), g = this.gain(0);
    o.connect(g).connect(this.sfxBus);
    o.frequency.exponentialRampToValueAtTime(820, now + 0.12);
    this.env(g, now, 0.12, 0.01, 0.18);
    o.start(now); o.stop(now + 0.3);
    [0, 2, 4, 7, 9, 12, 14].forEach((s, i) => this.bell(KEY + 12 + s, now + 0.15 + i * 0.12, 0.05, 2.5, this.sfxBus));
  }

  sprout(x) {                        // three plucked notes, higher to the right
    if (!this.ready) return;
    const now = this.ctx.currentTime, root = Math.round(x * 4);
    for (let i = 0; i < 3; i++) {
      const step = root + i;
      this.pluck(KEY + PENTA[step % 5] + 12 * Math.floor(step / 5), now + i * 0.15, 0.1);
    }
  }

  star(y, sky) {                     // a bell: the higher in the sky, the higher the note
    if (!this.ready) return;
    const step = Math.round((1 - Math.min(1, y / sky)) * 9);
    this.bell(KEY + 12 + PENTA[step % 5] + 12 * Math.floor(step / 5), this.ctx.currentTime, 0.11, 5, this.sfxBus);
  }

  splash(at = this.ctx.currentTime, size = 1) {
    if (!this.ready) return;
    this.noiseBurst({ at, peak: 0.16 * size, attack: 0.01, release: 0.45, from: 2200, to: 700, q: 0.6 });
    const o = this.osc('sine', 190), g = this.gain(0);
    o.connect(g).connect(this.sfxBus);
    o.frequency.exponentialRampToValueAtTime(80, at + 0.15);
    this.env(g, at, 0.1 * size, 0.005, 0.2);
    o.start(at); o.stop(at + 0.3);
  }

  leap(isSea) {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    if (isSea) { this.splash(now, 0.8); this.splash(now + 1.3, 1); }
    else this.chirp(now, this.sfxBus, 0.08);
  }

  flutter() {                        // tiny wings and a shimmer
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 10; i++) {
      this.noiseBurst({ at: now + i * rand(0.04, 0.08), peak: 0.03, attack: 0.005, release: 0.04, from: 5000, to: 4000, q: 2 });
    }
    [7, 12, 16].forEach((s, i) => this.bell(KEY + 12 + s, now + 0.1 + i * 0.1, 0.035, 2.5, this.sfxBus));
  }

  gather() {                         // fireflies settling: a warm, slow chord
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    [0, 7, 12, 16, 19].forEach((s, i) => this.bell(KEY + s, now + i * 0.22, 0.06, 6, this.sfxBus));
  }

  hammer() {                         // a hammer on wood: a knock and a crack
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    const o = this.osc('sine', 210), g = this.gain(0);
    o.connect(g).connect(this.sfxBus);
    o.frequency.exponentialRampToValueAtTime(95, now + 0.08);
    this.env(g, now, 0.35, 0.002, 0.14);
    o.start(now); o.stop(now + 0.2);
    this.noiseBurst({ at: now, peak: 0.22, attack: 0.001, release: 0.06, from: 2400, to: 1500, q: 1.5 });
    this.noiseBurst({ at: now + 0.02, peak: 0.05, attack: 0.01, release: 0.4, type: 'lowpass', from: 900, to: 300, buffer: this.brown });
  }

  thunder() {                        // lightning close by: a crack, then a long rolling rumble
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    this.noiseBurst({ at: now, peak: 0.3, attack: 0.005, release: 0.5, type: 'highpass', from: 3000, to: 900, q: 0.5 });
    this.noiseBurst({ at: now + 0.08, peak: 0.7, attack: 0.15, release: 4.5, type: 'lowpass', from: 700, to: 90, q: 0.4, buffer: this.brown });
  }

  dove() {                           // wings, then a soft coo
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 6; i++) {
      this.noiseBurst({ at: now + i * 0.09, peak: 0.05, attack: 0.01, release: 0.06, from: 1800, to: 900, q: 1, buffer: this.pink });
    }
    [0, 0.45].forEach((d, i) => {
      const at = now + 0.6 + d, o = this.osc('sine', 470), g = this.gain(0), lp = this.filter('lowpass', 900, 0.5);
      o.connect(lp).connect(g).connect(this.sfxBus);
      o.frequency.setValueAtTime(i ? 430 : 470, at);
      o.frequency.exponentialRampToValueAtTime(i ? 360 : 400, at + 0.32);
      this.env(g, at, 0.06, 0.05, 0.3);
      o.start(at); o.stop(at + 0.4);
    });
  }

  promise() {                        // the rainbow: a shimmer and bells climbing through every color
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    this.noiseBurst({ at: now, peak: 0.06, attack: 0.8, release: 2.5, type: 'highpass', from: 4000, to: 7000, q: 0.5 });
    const steps = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
    steps.forEach((s, i) => this.bell(KEY + s, now + 0.1 + i * 0.13, 0.075 - i * 0.003, 5.5, this.sfxBus));
  }

  sticker() {                        // a new sticker: a paper pop and a bright little run of bells
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    this.noiseBurst({ at: now, peak: 0.12, attack: 0.003, release: 0.08, from: 3000, to: 1200, q: 1.2, buffer: this.pink });
    [12, 16, 19, 24].forEach((s, i) => this.bell(KEY + s, now + 0.08 + i * 0.08, 0.07, 3, this.sfxBus));
  }

  // A voice singing "ah": a few saws through vowel-shaped filters, with a little vibrato.
  voice(midi, at, vel = 0.05, length = 2.2) {
    const g = this.gain(0), f0 = midiHz(midi);
    const formants = [[800, 1], [1150, 0.5], [2900, 0.25]].map(([f, k]) => {
      const bp = this.filter('bandpass', f, 6), fg = this.gain(k);
      bp.connect(fg).connect(g);
      return bp;
    });
    g.connect(this.sfxBus);            // the effects bus already sends to the hall reverb
    for (const cents of [-8, 0, 8]) {
      const o = this.osc('sawtooth', f0), vib = this.osc('sine', 5.2), vg = this.gain(f0 * 0.006);
      o.detune.value = cents;
      vib.connect(vg).connect(o.frequency);
      formants.forEach(bp => o.connect(bp));
      o.start(at); vib.start(at); o.stop(at + length + 0.2); vib.stop(at + length + 0.2);
    }
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(vel, at + 0.35);
    g.gain.setTargetAtTime(0.0001, at + length * 0.6, length * 0.2);
  }

  sing(voice, y) {                   // a sung note (choir) or a music-box note: higher on the screen, higher the note
    if (!this.ready) return;
    const step = Math.round((1 - Math.min(1, Math.max(0, y))) * 9), at = this.ctx.currentTime;
    const midi = KEY + PENTA[step % 5] + 12 * Math.floor(step / 5);
    if (voice === 'choir') { this.voice(midi, at, 0.05); this.voice(midi - 12 + 7, at + 0.05, 0.03); }
    else if (voice === 'timbrel') this.jingle(at, midi);
    else this.bell(midi + 12, at, 0.08, 2.2, this.sfxBus);
  }

  jingle(at, midi) {                 // a tambourine: a slap and a shimmer of little cymbals, with a bright note
    this.noiseBurst({ at, peak: 0.12, attack: 0.002, release: 0.05, from: 1800, to: 900, q: 1, bus: this.sfxBus });
    for (let i = 0; i < 6; i++) {
      this.noiseBurst({ at: at + i * 0.035, peak: 0.05 * (1 - i / 7), attack: 0.002, release: 0.12, type: 'highpass', from: 7000, to: 6000, q: 0.8 });
    }
    this.pluck(midi, at + 0.02, 0.08);
  }

  glory() {                          // the sky fills with angels: a swelling chord of voices and bells
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    [0, 4, 7, 12, 16].forEach((s, i) => this.voice(KEY - 12 + s, now + i * 0.12, 0.045, 4.5));
    [12, 16, 19, 24, 28].forEach((s, i) => this.bell(KEY + s, now + 0.6 + i * 0.15, 0.06, 4, this.sfxBus));
  }

  heehaw() {                         // the little donkey brays, and its hooves scuff the road
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    [[0, 520, 380], [0.32, 300, 260], [0.6, 500, 360], [0.9, 290, 250]].forEach(([d, a, b]) => {
      const o = this.osc('sawtooth', a), lp = this.filter('lowpass', 1600, 2), g = this.gain(0);
      o.connect(lp).connect(g).connect(this.sfxBus);
      o.frequency.setValueAtTime(a, now + d);
      o.frequency.exponentialRampToValueAtTime(b, now + d + 0.26);
      this.env(g, now + d, 0.05, 0.03, 0.24);
      o.start(now + d); o.stop(now + d + 0.32);
    });
    this.noiseBurst({ at: now, peak: 0.05, attack: 0.02, release: 0.3, from: 1400, to: 600, q: 0.8, buffer: this.pink });
  }

  baa() {                            // the little lamb
    if (!this.ready) return;
    const now = this.ctx.currentTime, f = rand(560, 640);
    const o = this.osc('sawtooth', f), vib = this.osc('sine', 9), vg = this.gain(f * 0.04);
    const bp = this.filter('bandpass', 1300, 2), g = this.gain(0);
    vib.connect(vg).connect(o.frequency);
    o.connect(bp).connect(g).connect(this.sfxBus);
    o.frequency.setValueAtTime(f, now);
    o.frequency.exponentialRampToValueAtTime(f * 0.86, now + 0.55);
    this.env(g, now, 0.09, 0.04, 0.55);
    o.start(now); vib.start(now); o.stop(now + 0.65); vib.stop(now + 0.65);
  }

  bubble(y) {                        // a quick run of bloops, higher near the surface
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 5; i++) {
      const at = now + i * rand(0.05, 0.1), f = rand(500, 900) * (1.4 - Math.min(1, Math.max(0, y)) * 0.6);
      const o = this.osc('sine', f), g = this.gain(0);
      o.connect(g).connect(this.sfxBus);
      o.frequency.setValueAtTime(f, at);
      o.frequency.exponentialRampToValueAtTime(f * 2.2, at + 0.06);
      this.env(g, at, 0.05, 0.005, 0.07);
      o.start(at); o.stop(at + 0.1);
    }
  }

  gulp() {                           // the great fish swallows: a deep whoosh and a big, low gulp
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    this.noiseBurst({ at: now, peak: 0.35, attack: 0.25, release: 1.2, type: 'lowpass', from: 900, to: 120, q: 0.6, buffer: this.brown });
    const o = this.osc('sine', 140), g = this.gain(0);
    o.connect(g).connect(this.sfxBus);
    o.frequency.setValueAtTime(140, now + 0.5);
    o.frequency.exponentialRampToValueAtTime(45, now + 0.9);
    this.env(g, now + 0.5, 0.45, 0.02, 0.5);
    o.start(now + 0.5); o.stop(now + 1.1);
    [0, 3, 7].forEach((s, i) => this.bell(KEY - 12 + s, now + 1.1 + i * 0.12, 0.05, 3, this.sfxBus));
  }

  grow() {                           // a vine climbing up: rising plucks that settle into a chord
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    [0, 2, 4, 7, 9, 12, 14].forEach((s, i) => this.pluck(KEY + s, now + i * 0.09, 0.09));
    [0, 4, 7].forEach(s => this.bell(KEY + 12 + s, now + 0.75, 0.05, 3.5, this.sfxBus));
  }

  animalName() {                     // Adam names an animal: a cheerful little pluck
    if (!this.ready) return;
    const now = this.ctx.currentTime, a = pick([0, 2, 4, 7, 9]);
    this.pluck(KEY + 12 + a, now, 0.1);
    this.pluck(KEY + 12 + a + 7, now + 0.1, 0.08);
  }

  hiss() {                           // the staff becomes a snake: a long hiss and a surprised little drop
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    this.noiseBurst({ at: now, peak: 0.16, attack: 0.15, release: 1.1, type: 'highpass', from: 5000, to: 3500, q: 0.6 });
    [7, 4, 0].forEach((s, i) => this.pluck(KEY + 12 + s, now + 0.9 + i * 0.12, 0.08));
  }

  boop() {                           // not a match: a soft, friendly two-note "uh-uh"
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    [[0, 330], [0.14, 262]].forEach(([d, f]) => {
      const o = this.osc('triangle', f), g = this.gain(0);
      o.connect(g).connect(this.sfxBus);
      this.env(g, now + d, 0.08, 0.01, 0.14);
      o.start(now + d); o.stop(now + d + 0.18);
    });
  }

  ribbit() {                         // a frog
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    [0, 0.12].forEach(d => {
      const o = this.osc('square', rand(170, 210)), bp = this.filter('bandpass', 900, 3), g = this.gain(0), am = this.osc('sine', 38), ag = this.gain(0.5);
      am.connect(ag).connect(g.gain);
      o.connect(bp).connect(g).connect(this.sfxBus);
      this.env(g, now + d, 0.07, 0.01, 0.1);
      o.start(now + d); am.start(now + d); o.stop(now + d + 0.14); am.stop(now + d + 0.14);
    });
  }

  flame() {                          // the bush catches fire: a soft roar that swells, and warm bells
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    this.noiseBurst({ at: now, peak: 0.25, attack: 0.6, release: 2.8, type: 'bandpass', from: 300, to: 900, q: 0.5, buffer: this.brown });
    for (let i = 0; i < 14; i++) this.noiseBurst({ at: now + 0.3 + i * rand(0.08, 0.2), peak: rand(0.03, 0.07), attack: 0.002, release: 0.04, type: 'highpass', from: 2500, to: 1500, q: 0.7 });
    [0, 4, 7, 11, 12].forEach((s, i) => this.bell(KEY + s, now + 0.4 + i * 0.18, 0.06, 5, this.sfxBus));
  }

  partSea() {                        // the sea splits: a huge rushing roar from both sides, then a deep, settled hum
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    this.noiseBurst({ at: now, peak: 0.45, attack: 0.8, release: 2.6, type: 'lowpass', from: 300, to: 2400, q: 0.4, buffer: this.pink });
    this.noiseBurst({ at: now + 0.15, peak: 0.4, attack: 1.2, release: 3, type: 'lowpass', from: 120, to: 500, q: 0.5, buffer: this.brown });
    [0, 7, 12, 16, 19, 24].forEach((s, i) => this.bell(KEY - 12 + s, now + 1.2 + i * 0.15, 0.07, 5, this.sfxBus));
  }

  // While the narrator speaks, the music and ambience step back.
  duck(on) {
    if (!this.ctx || on === this.ducked) return;
    this.ducked = on;
    const now = this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(on ? 0.4 : 0.9, now, on ? 0.25 : 1.2);
    this.ambBus.gain.setTargetAtTime(on ? 0.3 : 0.55, now, on ? 0.25 : 1.2);
  }
}

// ---- ambience layers
const AMBIENCE = {
  // The deep: a low, slow-breathing rumble.
  deep(s) {
    return s.layer(0.9, g => {
      const src = s.loop(s.brown), lp = s.filter('lowpass', 180, 0.5), amp = s.gain(0.6);
      src.connect(lp).connect(amp).connect(g);
      const l = s.lfo(amp.gain, 0.6, 0.3, 0.06);
      return { nodes: [src, l] };
    });
  },

  // Wind: air that rises and falls, its pitch drifting.
  wind(s) {
    return s.layer(0.5, g => {
      const src = s.loop(s.pink), bp = s.filter('bandpass', 700, 0.8), amp = s.gain(0.3);
      src.connect(bp).connect(amp).connect(g);
      const a = s.lfo(bp.frequency, 750, 350, 0.05), b = s.lfo(amp.gain, 0.3, 0.2, 0.09);
      return { nodes: [src, a, b] };
    });
  },

  // Waves: each one rolls in, breaks and draws back, every 6–9 seconds.
  waves(s) {
    let next = 0;
    return s.layer(0.8, g => {
      const src = s.loop(s.pink), lp = s.filter('lowpass', 500, 0.5), amp = s.gain(0.05);
      src.connect(lp).connect(amp).connect(g);
      return {
        nodes: [src],
        tick(now) {
          if (now < next) return;
          const at = Math.max(now, next), peak = rand(0.5, 0.9), rise = rand(2, 3), fall = rand(3.5, 5);
          amp.gain.cancelScheduledValues(at);
          amp.gain.setTargetAtTime(peak, at, rise / 3);
          amp.gain.setTargetAtTime(0.06, at + rise, fall / 3);
          lp.frequency.setTargetAtTime(1800, at + rise * 0.7, 0.4);
          lp.frequency.setTargetAtTime(450, at + rise + 0.3, fall / 3);
          next = at + rise + fall * rand(0.7, 1);
        },
      };
    });
  },

  // Birds: now and then, somewhere nearby.
  birds(s) {
    let next = 0;
    return s.layer(1, g => ({
      tick(now) {
        if (now < next) return;
        s.chirp(Math.max(now, next), g, rand(0.02, 0.05));
        next = Math.max(now, next) + rand(1.2, 4.5);
      },
    }));
  },

  // Crickets: little trills in the dark, from two or three of them.
  crickets(s) {
    let next = 0;
    return s.layer(0.6, g => ({
      tick(now) {
        if (now < next) return;
        const at = Math.max(now, next), f = pick([4300, 4520, 4710]);
        const o = s.osc('sine', f), amp = s.gain(0);
        o.connect(amp).connect(g);
        for (let i = 0; i < 3; i++) {
          const t = at + i * 0.07;
          amp.gain.setValueAtTime(0.0001, t);
          amp.gain.exponentialRampToValueAtTime(0.02, t + 0.01);
          amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
        }
        o.start(at); o.stop(at + 0.3);
        next = at + rand(0.35, 1.1);
      },
    }));
  },

  // Gulls: an occasional cry far over the water.
  gulls(s) {
    let next = 0;
    return s.layer(1, g => ({
      tick(now) {
        if (now < next) return;
        const at = Math.max(now, next) + 0.5;
        for (let i = 0; i < pick([1, 2, 3]); i++) {
          const t = at + i * 0.35, o = s.osc('triangle', 1500), amp = s.gain(0), bp = s.filter('bandpass', 1800, 2);
          o.connect(bp).connect(amp).connect(g);
          o.frequency.setValueAtTime(1500, t);
          o.frequency.exponentialRampToValueAtTime(1050, t + 0.28);
          s.env(amp, t, 0.025, 0.03, 0.3);
          o.start(t); o.stop(t + 0.4);
        }
        next = at + rand(6, 13);
      },
    }));
  },

  // Rain: a steady hiss of drops over a deep wash of water.
  rain(s) {
    return s.layer(0.7, g => {
      const hiss = s.loop(s.pink), hp = s.filter('highpass', 1200, 0.5), lp = s.filter('lowpass', 7000, 0.5), ha = s.gain(0.5);
      hiss.connect(hp).connect(lp).connect(ha).connect(g);
      const body = s.loop(s.brown), blp = s.filter('lowpass', 450, 0.5), ba = s.gain(0.35);
      body.connect(blp).connect(ba).connect(g);
      const l = s.lfo(ha.gain, 0.5, 0.12, 0.07);
      return { nodes: [hiss, body, l] };
    });
  },

  // Thunder far away: a low roll every so often.
  thunder(s) {
    let next = 0;
    return s.layer(1, g => ({
      tick(now) {
        if (now < next) return;
        const at = Math.max(now, next) + rand(2, 5);
        s.noiseBurst({ at, peak: rand(0.15, 0.3), attack: rand(0.4, 0.9), release: rand(3, 5), type: 'lowpass', from: 380, to: 70, q: 0.4, bus: g, buffer: s.brown });
        next = at + rand(9, 18);
      },
    }));
  },

  // Under the sea: a deep, muffled hush, with now and then a far-off bubble.
  underwater(s) {
    let next = 0;
    return s.layer(0.9, g => {
      const src = s.loop(s.brown), lp = s.filter('lowpass', 220, 0.7), amp = s.gain(0.7);
      src.connect(lp).connect(amp).connect(g);
      const l = s.lfo(lp.frequency, 220, 80, 0.07);
      return {
        nodes: [src, l],
        tick(now) {
          if (now < next) return;
          const at = Math.max(now, next), f = rand(300, 600), o = s.osc('sine', f), bg = s.gain(0);
          o.connect(bg).connect(g);
          o.frequency.setValueAtTime(f, at);
          o.frequency.exponentialRampToValueAtTime(f * 1.8, at + 0.08);
          s.env(bg, at, 0.025, 0.01, 0.1);
          o.start(at); o.stop(at + 0.15);
          next = at + rand(0.8, 3);
        },
      };
    });
  },

  // A busy city: the murmur of many voices, rising and falling.
  crowd(s) {
    return s.layer(0.45, g => {
      const src = s.loop(s.pink), bp = s.filter('bandpass', 450, 1.2), bp2 = s.filter('bandpass', 1100, 2), amp = s.gain(0.35);
      src.connect(bp).connect(amp).connect(g);
      src.connect(bp2).connect(amp);
      const a = s.lfo(amp.gain, 0.35, 0.15, 0.23), b = s.lfo(bp.frequency, 450, 120, 0.4);
      return { nodes: [src, a, b] };
    });
  },

  // A small campfire: soft crackles and pops.
  fire(s) {
    let next = 0;
    return s.layer(0.8, g => {
      const bed = s.loop(s.brown), lp = s.filter('lowpass', 300, 0.5), amp = s.gain(0.12);
      bed.connect(lp).connect(amp).connect(g);
      return {
        nodes: [bed],
        tick(now) {
          if (now < next) return;
          const at = Math.max(now, next);
          s.noiseBurst({ at, peak: rand(0.03, 0.09), attack: 0.002, release: rand(0.02, 0.06), type: 'highpass', from: rand(1500, 3500), to: 1200, q: 0.7, bus: g });
          next = at + rand(0.08, 0.6);
        },
      };
    });
  },

  // A soft hum of insects in warm grass.
  meadow(s) {
    return s.layer(0.25, g => {
      const o = s.osc('sawtooth', 210), bp = s.filter('bandpass', 2600, 6), amp = s.gain(0.05);
      o.connect(bp).connect(amp).connect(g);
      o.start();
      const l = s.lfo(amp.gain, 0.05, 0.03, 0.3);
      return { nodes: [o, l] };
    });
  },
};
