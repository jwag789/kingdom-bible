// Small touches that only an installed app can do. In the iPhone/Android app (Capacitor) the
// native plugins are on window.Capacitor; in a browser these quietly fall back or do nothing.

export const isApp = () => !!window.Capacitor?.isNativePlatform?.();

// A native plugin by name (Haptics, SplashScreen, NativeTabs…), or null in a browser or when the
// app doesn't have it.
export function plugin(name) {
  const C = window.Capacitor;
  if (!isApp() || !C.isPluginAvailable?.(name)) return null;
  return C.Plugins?.[name] ?? C.registerPlugin(name);
}

// A haptic tap: 'LIGHT' for playing with a picture, 'MEDIUM' for a sticker, 'HEAVY' for the big moments.
export function buzz(style = 'LIGHT') {
  const haptics = plugin('Haptics');
  if (haptics) haptics.impact({ style }).catch(() => {});
  else navigator.vibrate?.(style === 'HEAVY' ? 30 : style === 'MEDIUM' ? 18 : 10);
}

// Haptics that mean something, for the games and the Kingdom:
//   'right'  a light tap: a good move, the score goes up
//   'wrong'  two soft taps: an "Oops!", gentle rather than a telling-off
//   'win'    the system's success buzz: a gold badge
//   'pick'   a small click as a piece lifts;  'place'  a firmer one as it lands
export function feel(kind) {
  const haptics = plugin('Haptics');
  const impact = style => (haptics ? haptics.impact({ style }).catch(() => {}) : navigator.vibrate?.(style === 'MEDIUM' ? 16 : 8));
  if (kind === 'win') {
    if (haptics) haptics.notification({ type: 'SUCCESS' }).catch(() => {});
    else navigator.vibrate?.([20, 60, 30]);
  } else if (kind === 'wrong') {
    impact('LIGHT');
    setTimeout(() => impact('LIGHT'), 120);
  } else {
    impact(kind === 'place' ? 'MEDIUM' : 'LIGHT');
  }
}

// Keep the screen on while a story reads aloud, a game is open or a grown-up records, so the
// phone doesn't lock mid-sentence; off again on the menus. Each asks with its own reason and the
// screen stays on while any of them still wants it. The app uses KeepAwake.swift (which also lets
// go whenever a new page loads); a browser, the Screen Wake Lock where it has one.
const awake = new Set();
let lock = null;
export function keepAwake(reason, on) {
  if (on) awake.add(reason); else awake.delete(reason);
  const want = awake.size > 0;
  const native = plugin('KeepAwake');
  if (native) { native.set({ on: want }).catch(() => {}); return; }
  if (want && !lock && navigator.wakeLock) {
    navigator.wakeLock.request('screen').then(l => { lock = l; l.addEventListener('release', () => { lock = null; }); }, () => {});
  } else if (!want && lock) {
    lock.release().catch(() => {});
  }
}
// A browser drops its wake lock whenever the tab is hidden; ask again on the way back.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && awake.size && !lock && !plugin('KeepAwake')) keepAwake([...awake][0], true);
});

// The app opens on its launch picture (cream paper, the icon, the name) and keeps it up until the
// first page has drawn, then fades it away, rather than flashing an empty screen. `launched`
// resolves as the fade starts (the native tab bar waits for it, so it isn't drawn over the
// picture). coldStart is true only for the first page since the app opened: going back to the
// Stories page from a story shouldn't wait on a launch picture that's long gone.
let markLaunched;
export const launched = new Promise(r => { markLaunched = r; });
export const coldStart = (() => { try { return !sessionStorage.getItem('kb:up'); } catch { return false; } })();
export function appReady() {
  try { sessionStorage.setItem('kb:up', '1'); } catch {}
  plugin('SplashScreen')?.hide({ fadeOutDuration: 450 }).catch(() => {});
  markLaunched();
}
