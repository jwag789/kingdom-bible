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

// The app opens on its launch picture (cream paper, the icon, the name) and keeps it up until the
// first page has drawn, then fades it away, rather than flashing an empty screen.
export function appReady() {
  plugin('SplashScreen')?.hide({ fadeOutDuration: 450 }).catch(() => {});
}
