// Where the app starts: the Stories page, or a story when the address names one (?story=noah).

import { isApp, appReady } from './native.js';

// In the iPhone/iPad app, a quick double tap (small children do it all the time) zoomed the
// page in and left it stuck there. The app's web view honors a fixed scale; the website keeps
// pinch-zoom for anyone who needs it.
if (isApp()) document.querySelector('meta[name=viewport]')?.setAttribute('content',
  'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');

if (new URLSearchParams(location.search).get('story')) { await import('./reader.js'); appReady(); }
else (await import('./home.js')).showHome();    // fades the launch picture itself, once its painting is in
