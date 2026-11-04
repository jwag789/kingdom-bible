// Where the app starts: the Stories page, or a story when the address names one (?story=noah).

if (new URLSearchParams(location.search).get('story')) await import('./reader.js');
else (await import('./home.js')).showHome();
