// Music Lab (Favorites): every chart the Spotify data allows, numbered so I can pick which ones to keep.
// All of it comes from one call, /spotify/GetMusicLab, and is worked out here in the browser.
(() => {
    const root = document.getElementById('musicLab');
    if (!root) return;

    const esc = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const pct = (n, d) => d ? Math.round((n / d) * 100) : 0;
    const mins = ms => `${Math.floor(ms / 60000)}:${String(Math.round((ms % 60000) / 1000)).padStart(2, '0')}`;
    const year = t => parseInt((t.releaseDate || '').slice(0, 4), 10) || null;
    const key = t => t.id || `${t.name}|${t.artists[0]}`;
    const main = t => t.artists[0] || '';
    const TZ = 'America/Chicago';
    const RANGES = { short_term: '4 weeks', medium_term: '6 months', long_term: 'all time' };

    let count = 0;
    const cards = [];
    const card = (title, sub, body, extra = '') => {
        count++;
        cards.push(`
            <article class="lab-card ${extra}">
                <span class="lab-num">#${String(count).padStart(2, '0')}</span>
                <h4 class="lab-title">${esc(title)}</h4>
                ${sub ? `<p class="lab-sub">${esc(sub)}</p>` : ''}
                ${body}
            </article>`);
    };

    // horizontal bars: rows of { label, value, note }
    const bars = (rows, max = Math.max(...rows.map(r => r.value), 1)) => `
        <ul class="lab-bars">${rows.map(r => `
            <li><span class="lab-bar-label">${esc(r.label)}</span>
                <span class="lab-bar-track"><span style="width:${(r.value / max) * 100}%"></span></span>
                <span class="lab-bar-value">${esc(r.note ?? r.value)}</span></li>`).join('')}
        </ul>`;

    // a small donut: parts of { label, value, color }
    const donut = (parts, center, centerSub) => {
        const total = parts.reduce((a, p) => a + p.value, 0) || 1;
        let at = 0;
        const r = 42, c = 2 * Math.PI * r;
        const rings = parts.map(p => {
            const len = (p.value / total) * c;
            const seg = `<circle r="${r}" cx="60" cy="60" fill="none" stroke="${p.color}" stroke-width="18"
                stroke-dasharray="${len} ${c - len}" stroke-dashoffset="${-at}" transform="rotate(-90 60 60)"/>`;
            at += len;
            return seg;
        }).join('');
        return `
            <div class="lab-donut">
                <svg viewBox="0 0 120 120" aria-hidden="true">${rings}
                    <text x="60" y="58" class="lab-donut-big">${esc(center)}</text>
                    <text x="60" y="76" class="lab-donut-small">${esc(centerSub)}</text></svg>
                <ul class="lab-legend">${parts.map(p => `<li><i style="background:${p.color}"></i>${esc(p.label)} <b>${pct(p.value, total)}%</b></li>`).join('')}</ul>
            </div>`;
    };

    const stat = (big, label) => `<div class="lab-stat"><b>${esc(big)}</b><span>${esc(label)}</span></div>`;
    const list = items => `<ol class="lab-list">${items.map(i => `<li>${i}</li>`).join('')}</ol>`;
    const song = t => `<b>${esc(t.name)}</b> <span>${esc(t.artists.join(', '))}</span>`;
    const COLORS = ['#8A4D57', '#C27B8A', '#56634A', '#7F9A6B', '#E3B7BE', '#D9C9C4'];

    function build(lab) {
        const tracks = lab.topTracks || {};
        const artists = lab.topArtists || {};
        const mid = tracks.medium_term || [];
        const shortT = tracks.short_term || [];
        const longT = tracks.long_term || [];
        const recent = (lab.recent || []).filter(p => p.playedAt);
        const all = [...shortT, ...mid, ...longT];

        // 01 Album cover wall
        if (mid.length) card('Album Cover Wall', 'every cover in my top 50 songs, 6 months',
            `<div class="lab-wall">${mid.map(t => t.albumArt ? `<img src="${esc(t.albumArt)}" alt="${esc(t.album)}" loading="lazy">` : '').join('')}</div>`, 'tall');

        // 02 Artist face wall
        const midA = artists.medium_term || [];
        if (midA.length) card('Artist Face Wall', 'my top 50 artists in order, 6 months',
            `<div class="lab-wall faces">${midA.map(a => a.image ? `<img src="${esc(a.image)}" alt="${esc(a.name)}" title="${esc(a.name)}" loading="lazy">` : '').join('')}</div>`);

        // 03 Who owns my top 50
        if (mid.length) {
            const byArtist = {};
            mid.forEach(t => byArtist[main(t)] = (byArtist[main(t)] || 0) + 1);
            const rows = Object.entries(byArtist).sort((a, b) => b[1] - a[1]);
            card('Who Owns My Top 50', 'songs per artist in my top 50, 6 months',
                bars(rows.slice(0, 8).map(([label, value]) => ({ label, value }))) +
                `<p class="lab-note">${rows.length} different artists. The top 3 hold ${pct(rows.slice(0, 3).reduce((a, r) => a + r[1], 0), mid.length)}% of the list.</p>`);
        }

        // 04 Staying power
        if (shortT.length && longT.length) {
            const inS = new Set(shortT.map(key)), inM = new Set(mid.map(key)), inL = new Set(longT.map(key));
            const forever = shortT.filter(t => inM.has(key(t)) && inL.has(key(t)));
            card('Staying Power', 'songs in my top 50 for 4 weeks, 6 months and all time',
                `<div class="lab-stats">${stat(forever.length, 'in all three')}${stat(shortT.filter(t => inL.has(key(t))).length, 'now and all time')}${stat(shortT.filter(t => !inM.has(key(t)) && !inL.has(key(t))).length, 'brand new')}</div>` +
                (forever.length ? list(forever.slice(0, 6).map(song)) : ''));
        }

        // 05 New obsessions
        if (shortT.length && longT.length) {
            const old = new Set([...mid, ...longT].map(key));
            const fresh = shortT.filter(t => !old.has(key(t)));
            if (fresh.length) card('New Obsessions', 'top songs this month that were nowhere before', list(fresh.slice(0, 6).map(song)));
        }

        // 06 Ride or die artists, and the climbers
        const sA = artists.short_term || [], lA = artists.long_term || [];
        if (sA.length && lA.length) {
            const rankIn = list => Object.fromEntries(list.map((a, i) => [a.name, i + 1]));
            const sR = rankIn(sA), mR = rankIn(midA), lR = rankIn(lA);
            const loyal = sA.filter(a => mR[a.name] && lR[a.name]).slice(0, 10);
            card('Ride or Die', 'artists in my top 50 for 4 weeks, 6 months and all time',
                `<div class="lab-chips">${loyal.map(a => `<span>${esc(a.name)}</span>`).join('')}</div>`);

            const moves = sA.slice(0, 20).filter(a => lR[a.name]).map(a => ({ name: a.name, now: sR[a.name], then: lR[a.name] }))
                .sort((a, b) => (b.then - b.now) - (a.then - a.now));
            if (moves.length) card('Climbers and Fallers', 'rank this month vs all time',
                `<ul class="lab-moves">${[...moves.slice(0, 4), ...moves.slice(-3)].map(m => {
                    const d = m.then - m.now;
                    return `<li><span>${esc(m.name)}</span><span class="lab-move ${d > 0 ? 'up' : d < 0 ? 'down' : ''}">#${m.then} → #${m.now}</span></li>`;
                }).join('')}</ul>`);
        }

        // 07 Song lengths
        if (mid.length) {
            const lens = mid.map(t => t.durationMs).filter(Boolean);
            const buckets = [[0, 150000, 'under 2:30'], [150000, 180000, '2:30 to 3'], [180000, 210000, '3 to 3:30'], [210000, 240000, '3:30 to 4'], [240000, Infinity, 'over 4']];
            const longest = [...mid].sort((a, b) => b.durationMs - a.durationMs)[0];
            const shortest = [...mid].sort((a, b) => a.durationMs - b.durationMs)[0];
            card('Song Lengths', 'how long my top 50 songs run',
                bars(buckets.map(([lo, hi, label]) => ({ label, value: lens.filter(l => l >= lo && l < hi).length }))) +
                `<p class="lab-note">Average ${mins(lens.reduce((a, b) => a + b, 0) / lens.length)}. Longest: ${esc(longest.name)} (${mins(longest.durationMs)}). Shortest: ${esc(shortest.name)} (${mins(shortest.durationMs)}).</p>`);
        }

        // 08 Explicit
        if (mid.length) {
            const n = mid.filter(t => t.explicit).length;
            card('Clean or Explicit', 'my top 50 songs, 6 months',
                donut([{ label: 'Clean', value: mid.length - n, color: '#7F9A6B' }, { label: 'Explicit', value: n, color: '#8A4D57' }], `${pct(n, mid.length)}%`, 'explicit'));
        }

        // 09 Track number
        if (mid.length) {
            const pos = [1, 2, 3, 4, 5].map(n => ({ label: `Track ${n}`, value: mid.filter(t => t.trackNumber === n).length }));
            pos.push({ label: 'Track 6 or later', value: mid.filter(t => t.trackNumber >= 6).length });
            card('Where on the Album', 'which track number my favorites are', bars(pos));
        }

        // 10 Album, single or compilation
        if (mid.length) {
            const types = {};
            mid.forEach(t => types[t.albumType || 'other'] = (types[t.albumType || 'other'] || 0) + 1);
            const name = { album: 'Albums', single: 'Singles', compilation: 'Compilations' };
            card('Albums or Singles', 'where my top 50 songs come from',
                donut(Object.entries(types).map(([k, v], i) => ({ label: name[k] || k, value: v, color: COLORS[i] })), `${pct(types.album || 0, mid.length)}%`, 'from albums'));
        }

        // 11 Collabs
        if (mid.length) {
            const collabs = mid.filter(t => t.artists.length > 1);
            const partners = {};
            collabs.forEach(t => t.artists.slice(1).forEach(a => partners[a] = (partners[a] || 0) + 1));
            const topP = Object.entries(partners).sort((a, b) => b[1] - a[1]).slice(0, 5);
            card('Featuring', 'songs with more than one artist',
                `<div class="lab-stats">${stat(`${pct(collabs.length, mid.length)}%`, 'are collabs')}${stat(collabs.length, 'songs')}</div>` +
                (topP.length ? `<div class="lab-chips">${topP.map(([n]) => `<span>${esc(n)}</span>`).join('')}</div>` : ''));
        }

        // 12 Albums I can't leave
        if (all.length) {
            const albums = {};
            const seen = new Set();
            all.forEach(t => { if (seen.has(key(t))) return; seen.add(key(t)); const k = t.album; if (!k) return; albums[k] = albums[k] || { n: 0, art: t.albumArt, artist: main(t) }; albums[k].n++; });
            const top = Object.entries(albums).sort((a, b) => b[1].n - a[1].n).slice(0, 4);
            card('Albums I Can’t Leave', 'most songs across all my top lists',
                `<ul class="lab-albums">${top.map(([n, a]) => `<li>${a.art ? `<img src="${esc(a.art)}" alt="" loading="lazy">` : ''}<span><b>${esc(n)}</b><span>${esc(a.artist)}, ${a.n} songs</span></span></li>`).join('')}</ul>`);
        }

        // 13 From the vault
        if (all.length) {
            const seen = new Set();
            const oldest = all.filter(t => year(t) && !seen.has(key(t)) && seen.add(key(t))).sort((a, b) => year(a) - year(b)).slice(0, 5);
            card('From the Vault', 'the oldest songs still in my top lists', list(oldest.map(t => `${song(t)} <em>${year(t)}</em>`)));
        }

        // 14 How old my music is, then vs now
        if (shortT.length && longT.length) {
            const median = arr => { const ys = arr.map(year).filter(Boolean).sort((a, b) => a - b); return ys[Math.floor(ys.length / 2)]; };
            card('Song Age', 'the typical release year in each top 50',
                `<div class="lab-stats">${Object.entries(RANGES).map(([k, label]) => stat(median(tracks[k] || []) || '?', label)).join('')}</div>`);
        }

        // 15 Title words
        if (all.length) {
            const skip = new Set('the a an of to and in on my me you i it is for with feat remix version from at your be this that all what we no so up by do dont just like'.split(' '));
            const words = {};
            const seen = new Set();
            all.forEach(t => { if (seen.has(key(t))) return; seen.add(key(t)); t.name.toLowerCase().replace(/\(.*?\)|-.*$/g, '').replace(/[^a-z' ]/g, ' ').split(/\s+/).forEach(w => { w = w.replace(/'/g, ''); if (w.length > 2 && !skip.has(w)) words[w] = (words[w] || 0) + 1; }); });
            const top = Object.entries(words).sort((a, b) => b[1] - a[1]).slice(0, 18);
            const max = top[0]?.[1] || 1;
            card('Song Title Words', 'what my favorite song titles keep saying',
                `<p class="lab-cloud">${top.map(([w, n]) => `<span style="font-size:${0.85 + (n / max) * 1.3}em">${esc(w)}</span>`).join(' ')}</p>`);
        }

        // 16 Replays
        if (recent.length) {
            const plays = {};
            recent.forEach(p => { const k = key(p.track); plays[k] = plays[k] || { t: p.track, n: 0 }; plays[k].n++; });
            const again = Object.values(plays).filter(p => p.n > 1).sort((a, b) => b.n - a.n);
            card('On Loop', 'songs I played more than once in my last 50 plays',
                again.length ? list(again.slice(0, 6).map(p => `${song(p.t)} <em>${p.n}×</em>`)) : '<p class="lab-note">No repeats. Very balanced of me.</p>');
        }

        // 17 Time spent
        if (recent.length) {
            const ms = recent.reduce((a, p) => a + (p.track.durationMs || 0), 0);
            const times = recent.map(p => new Date(p.playedAt).getTime()).sort((a, b) => a - b);
            const hours = (times[times.length - 1] - times[0]) / 3600000;
            // sessions: a gap of 30 minutes starts a new one
            let sessions = 1, run = 1, best = 1;
            for (let i = 1; i < times.length; i++) { if (times[i] - times[i - 1] > 1800000) { sessions++; run = 1; } else { run++; best = Math.max(best, run); } }
            card('Last 50 Plays', 'how much listening my recent history covers',
                `<div class="lab-stats">${stat(`${Math.round(ms / 60000)} min`, 'of music')}${stat(hours < 48 ? `${Math.round(hours)} hrs` : `${Math.round(hours / 24)} days`, 'to play 50 songs')}${stat(sessions, 'sessions')}${stat(best, 'songs in a row, longest')}</div>`);
        }

        // 18 Where I press play
        if (recent.length) {
            const ctx = {};
            recent.forEach(p => { const c = p.context || 'other'; ctx[c] = (ctx[c] || 0) + 1; });
            const name = { playlist: 'Playlists', album: 'Albums', artist: 'Artist pages', other: 'Search or queue' };
            card('Where I Press Play', 'my last 50 plays',
                donut(Object.entries(ctx).map(([k, v], i) => ({ label: name[k] || k, value: v, color: COLORS[i] })), `${pct(ctx.playlist || 0, recent.length)}%`, 'playlists'));
        }

        // 19 Day of the week
        if (recent.length) {
            const day = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: TZ });
            const order = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            const n = Object.fromEntries(order.map(d => [d, 0]));
            recent.forEach(p => n[day.format(new Date(p.playedAt))]++);
            card('Day of the Week', 'my last 50 plays, by day', `<div class="lab-columns">${order.map(d => `<span><i style="height:${(n[d] / Math.max(...Object.values(n), 1)) * 100}%"></i><b>${d}</b></span>`).join('')}</div>`);
        }

        // 20 Right now
        if (lab.player && lab.player.deviceType) {
            const p = lab.player;
            card('How I’m Listening', 'straight from my Spotify player',
                `<div class="lab-stats">${stat(p.deviceType, 'device')}${stat(p.shuffle ? 'On' : 'Off', 'shuffle')}${stat(p.repeat === 'off' ? 'Off' : p.repeat === 'track' ? 'This song' : 'On', 'repeat')}${lab.profile?.plan ? stat(lab.profile.plan === 'premium' ? 'Premium' : 'Free', 'plan') : ''}</div>`);
        }

        // 21 What Spotify keeps to itself
        const locked = [];
        if (lab.status?.['audio-features'] >= 400) locked.push('Mood map (energy and happiness)', 'Tempo in BPM', 'Danceability');
        if (lab.status?.['related-artists'] >= 400) locked.push('Related artists');
        if (!midA.some(a => a.popularity)) locked.push('Popularity scores (how mainstream I am)', 'Follower counts', 'Genres');
        if (locked.length) card('Locked by Spotify', 'charts Spotify no longer shares with apps like mine',
            `<div class="lab-chips locked">${locked.map(l => `<span>${esc(l)}</span>`).join('')}</div>`, 'muted');

        root.innerHTML = cards.join('');
    }

    fetch('/spotify/GetMusicLab')
        .then(r => r.ok ? r.json() : null)
        .then(lab => lab ? build(lab) : root.innerHTML = '<p class="lab-sub">Spotify isn’t answering right now.</p>')
        .catch(() => root.innerHTML = '<p class="lab-sub">Spotify isn’t answering right now.</p>');
})();
