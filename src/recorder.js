// Recording a story in your own voice: a grown-up check, "Who's reading?", then a teleprompter
// that shows each page's words big. Record, listen back, redo, next. Each page is saved on the
// device as it's recorded, so stopping halfway keeps what's done. At the end the recording can
// be sent to family as a link (when cloud.js is set up).

import { grownUpCheck } from './gate.js';
import { saveClip, getClip, voices, saveVoice, newVoiceId, chooseVoice } from './voices.js';
import { cloudReady, shareVoice } from './cloud.js';

// Round buttons get drawn icons: text symbols (−, +, ‹) sit below the middle of a circle.
const icon = d => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
// AAC in MP4 first: every phone and browser can play it back (Opus-in-MP4 isn't safe on older iPhones).
const TYPES = ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];

// `pages`: [{ key, say, label }] in reading order. Calls onClose(voiceId or null) when done.
export async function openRecorder({ story, storyId, pages, sound, onClose }) {
  if (!(await grownUpCheck('Recording your voice and sending it to family is for grown-ups.'))) return;
  const voice = await whoIsReading(storyId);
  if (!voice) return;
  voice.stories ??= {};
  voice.stories[storyId] ??= [];

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch {
    alert('The microphone isn’t available. Check that this app is allowed to use it, then try again.');
    return;
  }
  await sound.ctx?.suspend();       // the story's music would get into the recording
  const type = TYPES.find(t => window.MediaRecorder?.isTypeSupported?.(t)) ?? '';

  const root = el('div', 'recorder');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', `Record ${story.title}`);
  const top = el('div', 'top');
  const title = el('div', 'title');
  title.append(el('div', 'eyebrow', 'Your voice'), el('h2', '', `${voice.name} reads ${story.title}`));
  const close = el('button', 'close');
  close.setAttribute('aria-label', 'Stop recording and close');
  top.append(title, close);
  const where = el('div', 'where');
  const prompt = el('p', 'prompt');
  const level = el('div', 'level');
  const controls = el('div', 'controls');
  const prev = el('button', 'step'), next = el('button', 'step');
  prev.innerHTML = icon('M14 6l-6 6 6 6');
  next.innerHTML = icon('M10 6l6 6-6 6');
  prev.setAttribute('aria-label', 'Previous page'); next.setAttribute('aria-label', 'Next page');
  const rec = el('button', 'rec'), listen = el('button', 'begin', 'Listen');
  rec.setAttribute('aria-label', 'Record this page');
  controls.append(prev, listen, rec, next);
  const dots = el('div', 'dots');
  const finish = el('button', 'begin read finish', 'Finished');
  root.append(top, where, prompt, level, controls, dots, finish);
  document.body.append(root);
  document.body.classList.add('game-open');
  setTimeout(() => root.classList.add('in'), 30);

  const recorded = new Set(voice.stories[storyId]);
  const dotEls = pages.map((p, i) => {
    const d = el('button', recorded.has(p.key) ? 'done' : '');
    d.setAttribute('aria-label', `Page ${i + 1}`);
    d.onclick = () => go(i);
    dots.append(d);
    return d;
  });

  let at = Math.max(0, pages.findIndex(p => !recorded.has(p.key)));
  let recorder = null, chunks = [], player = new Audio();
  function go(i) {
    if (recorder) return;
    at = Math.min(pages.length - 1, Math.max(0, i));
    const page = pages[at];
    where.textContent = `${page.label} · page ${at + 1} of ${pages.length}`;
    prompt.textContent = page.say;
    dotEls.forEach((d, j) => d.classList.toggle('on', j === at));
    listen.disabled = !recorded.has(page.key);
    rec.classList.remove('on');
    prev.disabled = at === 0;
    next.disabled = at === pages.length - 1;
  }

  // A little ring that grows with the voice, so it's clear the microphone is hearing you.
  const meter = new AudioContext(), analyser = meter.createAnalyser();
  meter.createMediaStreamSource(stream).connect(analyser);
  const data = new Uint8Array(analyser.fftSize);
  let alive = true;
  (function tick() {
    if (!alive) return;
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (const v of data) sum += (v - 128) ** 2;
    level.style.setProperty('--level', Math.min(1, Math.sqrt(sum / data.length) / 40).toFixed(3));
    requestAnimationFrame(tick);
  })();

  rec.onclick = () => {
    if (recorder) { recorder.stop(); return; }
    player.pause();
    chunks = [];
    recorder = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 48000 } : undefined);
    recorder.ondataavailable = e => e.data.size && chunks.push(e.data);
    recorder.onstop = async () => {
      const page = pages[at];
      const blob = new Blob(chunks, { type: recorder.mimeType || type || 'audio/webm' });
      recorder = null;
      rec.classList.remove('on');
      root.classList.remove('recording');
      await saveClip(voice.id, storyId, page.key, blob);
      recorded.add(page.key);
      voice.stories[storyId] = [...recorded];
      saveVoice(voice);
      dotEls[at].classList.add('done');
      listen.disabled = false;
      if (at < pages.length - 1) setTimeout(() => go(at + 1), 500);
    };
    recorder.start();
    rec.classList.add('on');
    root.classList.add('recording');
  };
  listen.onclick = async () => {
    const blob = await getClip(voice.id, storyId, pages[at].key);
    if (!blob) return;
    URL.revokeObjectURL(player.src);
    player.src = URL.createObjectURL(blob);
    player.play().catch(() => {});
  };
  prev.onclick = () => go(at - 1);
  next.onclick = () => go(at + 1);

  const done = () => {
    alive = false;
    recorder?.stop();
    player.pause();
    stream.getTracks().forEach(t => t.stop());
    meter.close();
    sound.ctx?.resume();
    root.classList.remove('in');
    document.body.classList.remove('game-open');
    setTimeout(() => root.remove(), 350);
    if (recorded.size) chooseVoice(storyId, voice.id);
    onClose?.(recorded.size ? voice.id : null);
  };
  close.onclick = done;
  finish.onclick = () => summary();

  // The end: how much is recorded, and sending it to family.
  function summary() {
    if (recorder) return;
    const card = el('div', 'summary');
    const send = el('button', 'begin read', 'Send to family');
    const back = el('button', 'begin', 'Keep recording');
    const ok = el('button', 'begin', 'Done');
    const note = el('p', 'note');
    const buttons = el('div', 'starts');
    buttons.append(...(cloudReady() ? [send] : []), back, ok);
    card.append(el('div', 'eyebrow', `${recorded.size} of ${pages.length} pages`),
      el('h3', '', recorded.size === pages.length ? 'All done!' : 'Saved so far'),
      el('p', '', `“${story.title}” will be read in ${voice.name}’s voice on this device${recorded.size < pages.length ? ', with the narrator reading any pages you skipped' : ''}.`),
      note, buttons);
    if (!cloudReady()) note.textContent = 'Sending it to family is coming very soon.';
    root.append(card);
    setTimeout(() => card.classList.add('in'), 30);
    back.onclick = () => card.remove();
    ok.onclick = done;
    send.onclick = async () => {
      send.disabled = true;
      try {
        const clips = [];
        for (const p of pages) {
          if (!recorded.has(p.key)) continue;
          const blob = await getClip(voice.id, storyId, p.key);
          if (blob) clips.push({ key: p.key, blob });
        }
        const link = await shareVoice({ name: voice.name, storyId, clips, onProgress: f => { note.textContent = `Sending… ${Math.round(f * 100)}%`; } });
        const text = `${voice.name} reads “${story.title}” 🎧`;
        if (navigator.share) {
          // The message goes on its own line, so even when it's copied together with the link, the link stays clean.
          await navigator.share({ title: text, text: `${text}\n`, url: link }).catch(() => {});
          note.textContent = 'Sent! Anyone you shared the link with can listen.';
        } else {
          await navigator.clipboard?.writeText(link).catch(() => {});
          note.textContent = `Link copied — paste it in a message: ${link}`;
        }
      } catch (err) {
        note.textContent = `That didn’t send (${err.message}). Check the internet connection and try again.`;
      }
      send.disabled = false;
    };
  }

  go(at);
  rec.focus();
}

// "Who's reading?" — pick a voice already started on this device, or name a new one.
function whoIsReading(storyId) {
  return new Promise(resolve => {
    const box = el('div', 'gate');
    const card = el('div', 'card');
    const mine = voices().filter(v => !v.remote);
    const list = el('div', 'answers');
    for (const v of mine) {
      const b = el('button', 'begin read', v.name);
      b.onclick = () => finish(v);
      list.append(b);
    }
    const names = el('div', 'answers');
    for (const n of ['Dad', 'Mom', 'Grandma', 'Grandpa']) {
      if (mine.some(v => v.name === n)) continue;
      const b = el('button', 'begin', n);
      b.onclick = () => finish(saveVoice({ id: newVoiceId(), name: n, stories: {} }));
      names.append(b);
    }
    const input = el('input', 'name');
    input.placeholder = 'Or type a name…';
    input.maxLength = 24;
    const go = el('button', 'begin read', 'Start');
    go.onclick = () => { const n = input.value.trim(); if (n) finish(saveVoice({ id: newVoiceId(), name: n, stories: {} })); };
    input.onkeydown = e => { if (e.key === 'Enter') go.click(); };
    const typed = el('div', 'typed');
    typed.append(input, go);
    const cancel = el('button', 'cancel', 'Not now');
    cancel.onclick = () => finish(null);
    card.append(el('div', 'eyebrow', 'Your voice'), el('h3', '', 'Who’s reading?'),
      ...(mine.length ? [list] : []), names, typed, cancel);
    box.append(card);
    document.body.append(box);
    setTimeout(() => box.classList.add('in'), 30);
    function finish(v) {
      box.classList.remove('in');
      setTimeout(() => box.remove(), 300);
      resolve(v);
    }
  });
}
