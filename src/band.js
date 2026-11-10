// A little band for the livelier pages, made live like everything else in audio.js: no
// recordings. Each style plays a four-chord loop with a tune it makes up as it goes, a two-bar
// idea said twice, the second time coming home, so it sounds like a melody, not noodling.
//
//   storybook   a gentle flute over rippling harp, a twinkle of glockenspiel (most pages)
//   folk        strummed guitar, a hand drum and a whistled tune (busy, happy pages)
//   adventure   marching plucked strings, a bold flute, brass and timpani (giants, parting seas)
//
// audio.js picks a style for each mood; a scene (or a layer) can ask for one with `"music"`.

const midiHz = m => 440 * 2 ** ((m - 69) / 12);
const pick = list => list[(Math.random() * list.length) | 0];

// Chords as [root, third, fifth] around D3, so each style can voice them as it likes.
const PROGS = {
  story: [[50, 54, 57], [55, 59, 62], [59, 62, 66], [57, 61, 64]],      // D  G  Bm A
  folk:  [[50, 54, 57], [55, 59, 62], [50, 54, 57], [57, 61, 64]],      // D  G  D  A
  quest: [[59, 62, 66], [55, 59, 62], [50, 54, 57], [57, 61, 64]],      // Bm G  D  A
};
const NOTES = [62, 64, 66, 69, 71, 74, 76, 78, 81, 83];                  // D pentatonic: no wrong notes

// Four bars of tune over `chords`: rhythms are lists of [beat, length in beats].
function phrase(chords, rhythms, low = 74) {
  const notes = NOTES.filter(n => n >= low - 12 && n <= low + 12);
  let at = notes.indexOf(pick(notes.filter(n => n >= low - 2 && n <= low + 5)));
  if (at < 0) at = notes.length >> 1;
  const idea = [pick(rhythms), pick(rhythms)].map(r => r.map(([beat, len]) => {
    at = Math.max(0, Math.min(notes.length - 1, at + pick([-2, -1, -1, 0, 1, 1, 2])));
    return { beat, len, step: at };
  }));
  // Notes on the beat lean onto the chord.
  const toNote = (chord, n) => {
    let m = notes[n.step];
    if (n.beat % 1 === 0) {
      const tones = chord.map(c => c % 12);
      for (let d = 1; d < 3 && !tones.includes(m % 12); d++) m = notes[Math.min(notes.length - 1, n.step + d)];
    }
    return m;
  };
  return chords.map((chord, b) => {
    const bar = idea[b % 2].map(n => ({ ...n, m: toNote(chord, n) }));
    if (b === 3) {
      const last = bar[bar.length - 1];
      last.m = notes.find(x => x % 12 === chord[0] % 12 && x >= low - 3) ?? last.m;
      last.len = Math.max(last.len, 1.5);
    }
    return bar;
  });
}

export const STYLES = {
  storybook: {
    bpm: 92, prog: 'story', level: 0.62,
    rhythms: [[[0, 1.5], [1.5, 0.5], [2, 2]], [[0, 1], [1, 1], [2, 1], [3, 1]], [[0, 2], [2, 1], [3, 1]]],
    bar(I, chord, at, beat, tune, i) {
      for (const n of tune) I.flute(n.m, at + n.beat * beat, n.len * beat * 0.95);
      [chord[0], chord[1], chord[2], chord[0] + 12, chord[2], chord[1], chord[2], chord[0] + 12]
        .forEach((m, k) => I.pluck(m + 12, at + k * beat * 0.5, 0.05, 1.8));
      I.bass(chord[0] - 12, at, beat * 3.5, 0.12);
      if (i % 4 === 3) I.glock(tune[tune.length - 1].m + 12, at + 3 * beat, 0.07);
    },
  },
  folk: {
    bpm: 88, prog: 'folk', level: 1.25,
    rhythms: [[[0, 1], [1, 1], [2, 2]], [[0, 0.5], [0.5, 0.5], [1, 1], [2, 1], [3, 1]], [[0, 1.5], [1.5, 1.5], [3, 1]]],
    bar(I, chord, at, beat, tune, i) {
      if (i % 2 === 1) for (const n of tune) I.flute(n.m + 12, at + n.beat * beat, n.len * beat * 0.9, 0.04);
      // Down, down-up, up-down-up.
      const shape = [chord[0] - 12, chord[2] - 12, chord[0], chord[1], chord[2], chord[0] + 12];
      for (const [b, down] of [[0, 1], [1, 1], [1.5, 0], [2.5, 0], [3, 1], [3.5, 0]]) {
        (down ? shape : [...shape].reverse()).forEach((m, k) => I.pluck(m, at + b * beat + k * 0.012, down ? 0.045 : 0.03, 0.9));
      }
      I.drum(at, true); I.drum(at + beat, false, 0.18); I.drum(at + 2 * beat, true, 0.18); I.drum(at + 2.5 * beat, true, 0.12); I.drum(at + 3 * beat, false, 0.18);
    },
  },
  adventure: {
    bpm: 116, prog: 'quest', level: 0.66,
    rhythms: [[[0, 1], [1, 0.5], [1.5, 0.5], [2, 2]], [[0, 0.5], [0.5, 0.5], [1, 0.5], [1.5, 0.5], [2, 1], [3, 1]], [[0, 1.5], [1.5, 0.5], [2, 1], [3, 1]]],
    bar(I, chord, at, beat, tune, i) {
      for (const n of tune) I.flute(n.m + 12, at + n.beat * beat, n.len * beat * 0.9, 0.06);
      for (let b = 0; b < 8; b++) I.pizz(b % 2 ? chord[2] : chord[0], at + b * beat * 0.5, b % 2 ? 0.08 : 0.12);
      I.timpani(chord[0] - 12, at, 0.2);
      if (i % 2) I.timpani(chord[0] - 12, at + 3.5 * beat, 0.12);
      I.brass(chord, at, beat * 0.9, 0.035);
      if (i % 4 === 3) [0, 4, 7].forEach((up, k) => I.glock(chord[0] + 24 + up, at + (2 + k * 0.5) * beat, 0.06));
    },
  },
};

export class Band {
  // `out` is where the band plays (audio.js gives it a bus of its own, ducked under the voice).
  constructor(ctx, out) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(out);
    // A small room, so it sounds played in a place rather than beeped.
    this.room = ctx.createConvolver();
    const len = ctx.sampleRate * 1.8, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3; }
    this.room.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.22;
    this.room.connect(wet).connect(this.out);
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    this.style = null;
    this.I = instruments(this);
  }

  // Start a style (or carry on, if it's already the one playing).
  play(id) {
    const style = STYLES[id];
    if (!style || id === this.style) return;
    const now = this.ctx.currentTime;
    this.style = id;
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setTargetAtTime(style.level, now, 0.6);
    this.beat = 60 / style.bpm;
    // A new style comes in on the next bar of the old one, so the change sounds meant.
    this.next = Math.max(now + 0.15, this.next && this.next > now ? this.next : 0);
    this.bar = 0;
  }

  stop(fade = 1.5) {
    if (!this.style) return;
    this.style = null;
    this.out.gain.setTargetAtTime(0, this.ctx.currentTime, fade / 3);
  }

  // Called by audio.js's clock: schedule whatever falls in the next moment.
  tick(now) {
    const style = STYLES[this.style];
    if (!style) return;
    const chords = PROGS[style.prog];
    while (this.next < now + 0.45) {
      if (this.bar % 4 === 0) this.tune = phrase(chords, style.rhythms);
      style.bar(this.I, chords[this.bar % 4], this.next, this.beat, this.tune[this.bar % 4], this.bar);
      this.next += this.beat * 4;
      this.bar++;
    }
  }
}

// The players, all synthesized: each takes a MIDI note, a time and a loudness.
function instruments(band) {
  const { ctx } = band;
  const voice = (send = 0.5) => {
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(band.out);
    if (send) { const s = ctx.createGain(); s.gain.value = send; g.connect(s).connect(band.room); }
    return g;
  };
  const osc = (type, hz, at, stop, into) => {
    const o = ctx.createOscillator();
    o.type = type; o.frequency.value = hz;
    o.connect(into); o.start(at); o.stop(stop);
    return o;
  };
  const env = (g, at, peak, attack, decay) => {
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(peak, at + attack);
    g.gain.setTargetAtTime(0.0001, at + attack, decay / 3);
  };
  const noise = (at, dur, peak, type, freq, q = 1) => {
    const s = ctx.createBufferSource();
    s.buffer = band.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = voice(0.2);
    s.connect(f).connect(g);
    env(g, at, peak, 0.003, dur);
    s.start(at, Math.random() * 0.5); s.stop(at + dur + 0.1);
  };
  return {
    glock(m, at, v = 0.08) {
      for (const [mult, amp, d] of [[1, 1, 1.6], [2.76, 0.4, 0.5], [5.4, 0.2, 0.25]]) {
        const g = voice(0.6); env(g, at, v * amp, 0.002, d); osc('sine', midiHz(m) * mult, at, at + d + 0.5, g);
      }
    },
    pluck(m, at, v = 0.12, decay = 1.2) {
      const g = voice(); env(g, at, v, 0.004, decay);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.Q.value = 0.7;
      f.frequency.setValueAtTime(midiHz(m) * 8, at);
      f.frequency.exponentialRampToValueAtTime(midiHz(m) * 1.5, at + decay * 0.6);
      f.connect(g);
      osc('sawtooth', midiHz(m), at, at + decay + 0.4, f);
      osc('triangle', midiHz(m) * 2, at, at + decay + 0.4, f);
    },
    pizz(m, at, v = 0.16) {
      const g = voice(0.3); env(g, at, v, 0.005, 0.28);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; f.connect(g);
      osc('triangle', midiHz(m), at, at + 0.6, f);
      osc('sawtooth', midiHz(m), at, at + 0.6, f);
    },
    flute(m, at, dur, v = 0.07) {
      const g = voice(0.7);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(v, at + 0.07);
      g.gain.setValueAtTime(v, at + Math.max(0.08, dur - 0.08));
      g.gain.linearRampToValueAtTime(0.0001, at + dur + 0.05);
      const o = osc('sine', midiHz(m), at, at + dur + 0.2, g);
      const t = ctx.createGain(); t.gain.value = 0.18; t.connect(g);
      osc('triangle', midiHz(m), at, at + dur + 0.2, t);
      // Vibrato that grows in, and a breath at the start.
      const vib = ctx.createOscillator(), vg = ctx.createGain();
      vib.frequency.value = 5.2;
      vg.gain.setValueAtTime(0, at); vg.gain.linearRampToValueAtTime(midiHz(m) * 0.008, at + 0.3);
      vib.connect(vg).connect(o.frequency); vib.start(at); vib.stop(at + dur + 0.2);
      noise(at, 0.08, v * 0.25, 'bandpass', midiHz(m) * 2, 2);
    },
    brass(ms, at, dur, v = 0.05) {
      const g = voice(0.5);
      g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(v, at + 0.05); g.gain.setTargetAtTime(0.0001, at + dur, 0.1);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass';
      f.frequency.setValueAtTime(400, at); f.frequency.linearRampToValueAtTime(1800, at + 0.08); f.frequency.setTargetAtTime(900, at + 0.1, 0.2);
      f.connect(g);
      for (const m of ms) osc('sawtooth', midiHz(m), at, at + dur + 0.5, f);
    },
    bass(m, at, dur, v = 0.16) {
      const g = voice(0.1); env(g, at, v, 0.01, dur);
      osc('triangle', midiHz(m), at, at + dur + 0.3, g);
      osc('sine', midiHz(m), at, at + dur + 0.3, g);
    },
    drum(at, low = true, v = 0.25) {
      if (!low) { noise(at, 0.09, v * 0.5, 'bandpass', 1800, 1.2); return; }
      const g = voice(0.15); env(g, at, v, 0.003, 0.35);
      const o = osc('sine', 120, at, at + 0.5, g);
      o.frequency.exponentialRampToValueAtTime(55, at + 0.25);
    },
    timpani(m, at, v = 0.22) {
      const g = voice(0.4); env(g, at, v, 0.004, 0.9);
      const o = osc('sine', midiHz(m), at, at + 1.2, g);
      o.frequency.exponentialRampToValueAtTime(midiHz(m) * 0.97, at + 0.8);
      noise(at, 0.06, v * 0.2, 'lowpass', 400);
    },
  };
}
