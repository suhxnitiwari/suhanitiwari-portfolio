// Music Lab (Favorites): every chart the Spotify data allows, numbered so I can pick which ones to keep.
// All of it comes from one call, /spotify/GetMusicLab, and is worked out here in the browser.
(() => {
    const root = document.getElementById('musicLab');
    if (!root) return;

    const esc = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const pct = (n, d) => d ? Math.round((n / d) * 100) : 0;
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

    const stat = (big, label) => `<div class="lab-stat"><b>${esc(big)}</b><span>${esc(label)}</span></div>`;
    const list = items => `<ol class="lab-list">${items.map(i => `<li>${i}</li>`).join('')}</ol>`;
    const song = t => `<b>${esc(t.name)}</b> <span>${esc(t.artists.join(', '))}</span>`;

    function build(lab) {
        const tracks = lab.topTracks || {};
        const artists = lab.topArtists || {};
        const mid = tracks.medium_term || [];
        const shortT = tracks.short_term || [];
        const longT = tracks.long_term || [];
        const recent = (lab.recent || []).filter(p => p.playedAt);
        const all = [...shortT, ...mid, ...longT];

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

        // 06 Climbers and fallers
        const sA = artists.short_term || [], lA = artists.long_term || [];
        if (sA.length && lA.length) {
            const rankIn = list => Object.fromEntries(list.map((a, i) => [a.name, i + 1]));
            const sR = rankIn(sA), lR = rankIn(lA);
            const moves = sA.slice(0, 20).filter(a => lR[a.name]).map(a => ({ name: a.name, now: sR[a.name], then: lR[a.name] }))
                .sort((a, b) => (b.then - b.now) - (a.then - a.now));
            if (moves.length) card('Climbers and Fallers', 'rank this month vs all time',
                `<ul class="lab-moves">${[...moves.slice(0, 4), ...moves.slice(-3)].map(m => {
                    const d = m.then - m.now;
                    return `<li><span>${esc(m.name)}</span><span class="lab-move ${d > 0 ? 'up' : d < 0 ? 'down' : ''}">#${m.then} → #${m.now}</span></li>`;
                }).join('')}</ul>`);
        }

        // 09 Track number
        if (mid.length) {
            const pos = [1, 2, 3, 4, 5].map(n => ({ label: `Track ${n}`, value: mid.filter(t => t.trackNumber === n).length }));
            pos.push({ label: 'Track 6 or later', value: mid.filter(t => t.trackNumber >= 6).length });
            card('Where on the Album', 'which track number my favorites are', bars(pos));
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
            // each word gets a font that matches its mood; anything unlisted gets one of the plain faces
            const MOODS = {
                'w-love': 'love heart kiss hold baby darling sweet honey forever lover dream angel',
                'w-angry': 'hate bad dead drop break stupid kill wrong hurt mad crazy fight liar cruel',
                'w-move': 'run hills down fast drive dance fly fall move jump high ride',
                'w-time': 'one last time never again night tonight day yesterday tomorrow always',
            };
            const wordFont = w => Object.keys(MOODS).find(k => MOODS[k].split(' ').includes(w))
                || ['w-plain', 'w-hand', 'w-type'][[...w].reduce((a, c) => a + c.charCodeAt(0), 0) % 3];
            const max = top[0]?.[1] || 1;
            card('Song Title Words', 'what my favorite song titles keep saying',
                `<p class="lab-cloud">${top.map(([w, n]) => `<span class="${wordFont(w)}" style="font-size:${0.85 + (n / max) * 1.3}em">${esc(w)}</span>`).join(' ')}</p>`);
        }

        // 16 Replays
        if (recent.length) {
            const plays = {};
            recent.forEach(p => { const k = key(p.track); plays[k] = plays[k] || { t: p.track, n: 0 }; plays[k].n++; });
            const again = Object.values(plays).filter(p => p.n > 1).sort((a, b) => b.n - a.n);
            card('On Loop', 'songs I played more than once in my last 50 plays',
                again.length ? list(again.slice(0, 6).map(p => `${song(p.t)} <em>${p.n}×</em>`)) : '<p class="lab-note">No repeats. Very balanced of me.</p>');
        }

        // 19 Day of the week
        if (recent.length) {
            const day = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: TZ });
            const order = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            const n = Object.fromEntries(order.map(d => [d, 0]));
            recent.forEach(p => n[day.format(new Date(p.playedAt))]++);
            card('Day of the Week', 'my last 50 plays, by day', `<div class="lab-columns">${order.map(d => `<span><i style="height:${(n[d] / Math.max(...Object.values(n), 1)) * 100}%"></i><b>${d}</b></span>`).join('')}</div>`);
        }

        root.innerHTML = cards.join('');
    }

    fetch('/spotify/GetMusicLab')
        .then(r => r.ok ? r.json() : null)
        .then(lab => lab ? build(lab) : root.innerHTML = '<p class="lab-sub">Spotify isn’t answering right now.</p>')
        .catch(() => root.innerHTML = '<p class="lab-sub">Spotify isn’t answering right now.</p>');
})();
