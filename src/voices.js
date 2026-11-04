// Family voices: a parent reads a story aloud, page by page, and the app plays it back in their
// voice instead of the narrator's. Recordings live on this device (IndexedDB); a voice that was
// shared with you by link (see cloud.js) is remembered here too and played from the internet.
//
// A voice: { id, name, remote?: true, stories: { [storyId]: [slide keys recorded] } }.
// Which voice reads a story on this device: localStorage "kb:voice:<storyId>" (a voice id, or
// nothing for the narrator).

const DB = 'kingdom-bible', CLIPS = 'clips';
const VOICES = 'kb:voices';

let db = null;
function open() {
  db ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(CLIPS);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return db;
}
const tx = async (mode, fn) => {
  const store = (await open()).transaction(CLIPS, mode).objectStore(CLIPS);
  return new Promise((resolve, reject) => {
    const req = fn(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};
const clipKey = (voiceId, storyId, key) => `${voiceId}/${storyId}/${key}`;

export const saveClip = (voiceId, storyId, key, blob) => tx('readwrite', s => s.put(blob, clipKey(voiceId, storyId, key)));
export const getClip = (voiceId, storyId, key) => tx('readonly', s => s.get(clipKey(voiceId, storyId, key)));
export const deleteClip = (voiceId, storyId, key) => tx('readwrite', s => s.delete(clipKey(voiceId, storyId, key)));

export function voices() {
  try { return JSON.parse(localStorage.getItem(VOICES) ?? '[]'); } catch { return []; }
}
export function saveVoice(voice) {
  const list = voices().filter(v => v.id !== voice.id);
  list.push(voice);
  try { localStorage.setItem(VOICES, JSON.stringify(list)); } catch {}
  return voice;
}
export const newVoiceId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function chosenVoice(storyId) {
  try { return localStorage.getItem(`kb:voice:${storyId}`) || null; } catch { return null; }
}
export function chooseVoice(storyId, voiceId) {
  try { voiceId ? localStorage.setItem(`kb:voice:${storyId}`, voiceId) : localStorage.removeItem(`kb:voice:${storyId}`); } catch {}
}

// Voices that have read (some of) this story.
export const voicesFor = storyId => voices().filter(v => v.stories?.[storyId]?.length);
