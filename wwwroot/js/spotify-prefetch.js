// Starts loading my Spotify music as soon as any page opens (quietly, once the page is idle),
// so by the time someone reaches Favorites the music universe, On Repeat and listening DNA
// are already here. It also wakes up the server's copy, which is slow only on its first load.
// Saved for this tab for 30 minutes under "spotifyPrefetch"; the Favorites page reads it.
(() => {
    if (location.pathname.toLowerCase().startsWith('/home/favorites')) return;   // Favorites loads it itself

    const KEY = 'spotifyPrefetch';
    const FRESH = 30 * 60 * 1000;
    const URLS = {
        artists: '/spotify/GetTopArtists?limit=20',
        songs: '/spotify/GetTopTracks?limit=50',
        genres: '/spotify/GetTopGenres?limit=5',
        artistsShort: '/spotify/GetTopArtists?limit=5&timeRange=short_term',
        artistsLong: '/spotify/GetTopArtists?limit=5&timeRange=long_term',
        recent: '/spotify/GetRecentlyPlayed'
    };

    const read = () => {
        try {
            const saved = JSON.parse(sessionStorage.getItem(KEY));
            return saved && Date.now() - saved.at < FRESH ? saved : null;
        } catch { return null; }
    };

    const saved = read();
    if (saved && Object.keys(URLS).every(name => Array.isArray(saved[name]))) return;   // already have it all

    function start() {
        const store = read() || { at: Date.now() };
        Object.entries(URLS).forEach(([name, url]) => {
            if (Array.isArray(store[name])) return;
            fetch(url)
                .then(res => (res.ok ? res.json() : null))
                .then(data => {
                    if (!Array.isArray(data) || data.length === 0) return;
                    const latest = read() || store;
                    latest[name] = data;
                    try { sessionStorage.setItem(KEY, JSON.stringify(latest)); } catch { }
                    // warm the browser's cache with the artist photos for the universe bubbles
                    if (name === 'artists') data.forEach(a => { if (a.image) new Image().src = a.image; });
                })
                .catch(() => { });
        });
    }

    if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 1500 });
    else setTimeout(start, 800);
})();
