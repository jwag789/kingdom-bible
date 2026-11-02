// The narrator: plays each slide's recording (made by scripts/narrate.py) through the sound
// mix, and says which word is being spoken. A slide with no recording falls back to the
// browser's own voice.

export class Narrator {
  constructor(sound) {
    this.sound = sound;
    this.el = new Audio();
    this.el.preload = 'auto';
    this.manifest = {};
    this.current = null;
  }

  async load(url) {
    try {
      const res = await fetch(url);
      if (res.ok) this.manifest = await res.json();
    } catch { /* no recordings yet: the fallback voice will read */ }
  }

  // Route the recording through the mix once the audio context exists (after a gesture).
  connect() {
    if (this.source || !this.sound.ctx) return;
    this.source = this.sound.ctx.createMediaElementSource(this.el);
    this.source.connect(this.sound.voiceBus);
  }

  has(key) { return !!this.manifest[key]; }

  play(key, text, onEnd) {
    this.stop();
    const entry = this.manifest[key];
    const current = this.current = { key, text, entry, onEnd, char: -1 };
    this.sound.duck(true);
    if (entry) {
      this.connect();
      this.el.src = entry.src;
      this.el.onended = () => this.finish(current);
      this.el.play().catch(() => this.finish(current));
    } else if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.9;
      u.onboundary = e => { current.char = e.charIndex; };
      u.onend = () => this.finish(current);
      u.onerror = () => this.finish(current);
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } else {
      this.finish(current);
    }
  }

  stop() {
    if (!this.current) return;
    this.current = null;
    this.el.onended = null;
    this.el.pause();
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    this.sound.duck(false);
  }

  finish(which) {
    if (this.current !== which) return;
    this.current = null;
    this.sound.duck(false);
    which.onEnd?.();
  }

  // Where the narration is: { key, time, words } for a recording, or { key, char } for the fallback voice.
  where() {
    const c = this.current;
    if (!c) return null;
    return c.entry ? { key: c.key, time: this.el.currentTime, words: c.entry.words } : { key: c.key, char: c.char };
  }

  // Warm the cache for a slide that's probably next.
  preload(key) {
    const e = this.manifest[key];
    if (e) fetch(e.src).catch(() => {});
  }
}

// Pair each displayed word with the narrator's timing for it. The narrator's words can
// split differently (punctuation, "God's"), so match on letters and digits only.
export function alignWords(spans, words) {
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  let i = 0;
  return spans.map(span => {
    const target = norm(span.textContent);
    if (!target) return null;
    let got = '', start = null, end = null;
    while (i < words.length && got.length < target.length) {
      const n = norm(words[i].w);
      if (n) {
        if (start == null) start = words[i].s;
        got += n;
        end = words[i].e;
      }
      i++;
    }
    return start == null ? null : [start, end];
  });
}
