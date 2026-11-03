// Small touches that only an installed app can do. In the iPhone/Android app (Capacitor) the
// native plugins are on window.Capacitor; in a browser these quietly fall back or do nothing.

const plugins = () => window.Capacitor?.Plugins ?? {};

// A haptic tap: 'LIGHT' for playing with a picture, 'MEDIUM' for a sticker, 'HEAVY' for the big moments.
export function buzz(style = 'LIGHT') {
  const haptics = plugins().Haptics;
  if (haptics) haptics.impact({ style }).catch(() => {});
  else navigator.vibrate?.(style === 'HEAVY' ? 30 : style === 'MEDIUM' ? 18 : 10);
}

export const isApp = () => !!window.Capacitor?.isNativePlatform?.();
