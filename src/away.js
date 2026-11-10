// Everything goes quiet when Kingdom Bible isn't in front: the app sent to the background, half
// open in the app switcher or under Control Center, or the website's tab hidden. Narration picks
// up where it stopped when it comes back; the music and sounds wake with it.
//
// Sound comes from several places (the music and effects engine, the narrator, game voices, the
// recorder's playback), so rather than wire each one up, this keeps track of every <audio> that
// plays and every AudioContext made, and pauses them together. Imported first, by main.js.

const media = new Set();
const contexts = new Set();

const play = HTMLMediaElement.prototype.play;
HTMLMediaElement.prototype.play = function (...args) {
  media.add(this);
  if (away) { this.pause(); return Promise.resolve(); }   // nothing starts while the app is away
  return play.apply(this, args);
};
const Context = window.AudioContext;
if (Context) {
  window.AudioContext = class extends Context {
    constructor(...args) { super(...args); contexts.add(this); }
  };
}

let away = false;
let paused = [], suspended = [];

function goAway() {
  if (away) return;
  away = true;
  paused = [...media].filter(m => !m.paused && !m.ended);
  paused.forEach(m => m.pause());
  suspended = [...contexts].filter(c => c.state === 'running');
  suspended.forEach(c => c.suspend().catch(() => {}));
}

function comeBack() {
  if (!away) return;
  away = false;
  suspended.forEach(c => { if (c.state === 'suspended') c.resume().catch(() => {}); });
  paused.forEach(m => play.call(m).catch(() => {}));
  paused = []; suspended = [];
}

document.addEventListener('visibilitychange', () => (document.hidden ? goAway() : comeBack()));
// From the app (Capacitor and MainViewController.swift): backgrounded, and merely inactive.
document.addEventListener('pause', goAway);
document.addEventListener('resume', comeBack);
document.addEventListener('kb-inactive', goAway);
document.addEventListener('kb-active', comeBack);
