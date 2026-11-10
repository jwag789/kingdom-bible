// Sending a family voice to someone else's device: the recordings go up to Supabase Storage
// under a long random id, and the link (?story=noah&voice=<id>) brings them back down on any
// phone or tablet that opens it. No accounts: whoever has the link can listen.
//
//   <bucket>/<share id>/<story>/<slide key>.<ext>     one recording per page
//   <bucket>/<share id>/<story>/voice.json            { name, story, files: { key: file } }

import { SUPABASE, SITE } from './config.js';
import { isApp } from './native.js';
import { saveVoice } from './voices.js';

export const cloudReady = () => !!(SUPABASE.url && SUPABASE.key);
const objectUrl = path => `${SUPABASE.url}/storage/v1/object/${SUPABASE.bucket}/${path}`;
const publicUrl = path => `${SUPABASE.url}/storage/v1/object/public/${SUPABASE.bucket}/${path}`;
const shareId = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(36).padStart(2, '0')).join('').slice(0, 20);
const extension = type => (type.includes('mp4') || type.includes('aac') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm');

async function upload(path, body, type) {
  const res = await fetch(objectUrl(path), {
    method: 'POST',
    // A publishable key goes in "apikey" only (it isn't a JWT); "audio/webm;codecs=opus" → "audio/webm".
    headers: { apikey: SUPABASE.key, 'Content-Type': type.split(';')[0], 'x-upsert': 'false' },
    body,
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
}

// Uploads one story's recordings and returns the link to send. `clips`: [{ key, blob }].
export async function shareVoice({ name, storyId, clips, onProgress }) {
  const id = shareId(), files = {};
  let done = 0;
  for (const { key, blob } of clips) {
    const file = `${key}.${extension(blob.type)}`;
    await upload(`${id}/${storyId}/${file}`, blob, blob.type || 'audio/webm');
    files[key] = file;
    onProgress?.(++done / (clips.length + 1));
  }
  await upload(`${id}/${storyId}/voice.json`, JSON.stringify({ name, story: storyId, files }), 'application/json');
  onProgress?.(1);
  const link = new URL(isApp() ? SITE : location.href);
  link.search = `?story=${storyId}&voice=${id}`;
  link.hash = '';
  return link.toString();
}

// Opening a shared link: fetch the voice's list of pages and remember it on this device.
export async function receiveVoice(id, storyId) {
  if (!cloudReady() || !/^[a-z0-9]{8,40}$/.test(id)) return null;
  const res = await fetch(publicUrl(`${id}/${storyId}/voice.json`));
  if (!res.ok) return null;
  const { name, files } = await res.json();
  const urls = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, publicUrl(`${id}/${storyId}/${file}`)]));
  return saveVoice({ id, name, remote: true, stories: { [storyId]: Object.keys(files) }, urls: { [storyId]: urls } });
}
