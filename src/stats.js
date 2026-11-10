// How much reading has happened on this device, for the Me page: time spent in stories and the
// weeks that had any reading in them. Kept in localStorage like the rest of the progress.
//
// Time counts in 10-second steps while a story is on screen and in use: something touched, a
// key pressed, or a page turned (read-aloud turns pages by itself) in the last two minutes. A
// story left open on the table, or the app in the background, doesn't count.

const KEY = 'kb:stats';
const STEP = 10;            // seconds
const IDLE = 120;           // seconds without a touch or a page turn before the clock stops

const load = () => {
  try { return { seconds: 0, weeks: [], ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; }
  catch { return { seconds: 0, weeks: [] }; }
};
const save = stats => { try { localStorage.setItem(KEY, JSON.stringify(stats)); } catch {} };

// "2026-W46": the ISO week (Monday to Sunday) a date falls in.
export function weekOf(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);                 // the Thursday of this week decides its year
  const week = Math.ceil(((d - Date.UTC(d.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

let lastActive = 0;
export const activity = () => { lastActive = Date.now(); };

// Called once by a story page.
export function readingClock() {
  activity();
  let away = false;
  for (const type of ['pointerdown', 'keydown', 'wheel']) addEventListener(type, activity, { capture: true, passive: true });
  for (const type of ['pause', 'kb-inactive']) document.addEventListener(type, () => { away = true; });
  for (const type of ['resume', 'kb-active']) document.addEventListener(type, () => { away = false; activity(); });
  setInterval(() => {
    if (away || document.hidden || Date.now() - lastActive > IDLE * 1000) return;
    const stats = load();
    stats.seconds += STEP;
    const week = weekOf();
    if (!stats.weeks.includes(week)) stats.weeks.push(week);
    save(stats);
  }, STEP * 1000);
}

// { minutes, weeks: weeks with any reading, streak: weeks in a row up to this one (or last) }
export function readingStats() {
  const { seconds, weeks } = load();
  const had = new Set(weeks);
  let streak = 0;
  const day = new Date();
  if (!had.has(weekOf(day))) day.setDate(day.getDate() - 7);   // a streak isn't broken until this week ends
  while (had.has(weekOf(day))) { streak++; day.setDate(day.getDate() - 7); }
  return { minutes: Math.floor(seconds / 60), weeks: had.size, streak };
}
