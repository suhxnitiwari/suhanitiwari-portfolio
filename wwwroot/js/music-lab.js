// Music extras (Favorites): the song title words, the albums I can't leave and the oldest songs I still play.
// All of it comes from one call, /spotify/GetMusicLab, and is worked out here in the browser.
(() => {
    const root = document.getElementById('musicLab');
    if (!root) return;

    const esc = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const year = t => parseInt((t.releaseDate || '').slice(0, 4), 10) || null;
    const key = t => t.id || `${t.name}|${t.artists[0]}`;
    const main = t => t.artists[0] || '';

    const cards = [];
    const card = (title, sub, body, extra = '') => cards.push(`
            <article class="lab-card ${extra}">
                <h4 class="lab-title">${esc(title)}</h4>
                ${sub ? `<p class="lab-sub">${esc(sub)}</p>` : ''}
                ${body}
            </article>`);

    const list = items => `<ol class="lab-list">${items.map(i => `<li>${i}</li>`).join('')}</ol>`;
    const song = t => `<b>${esc(t.name)}</b> <span>${esc(t.artists.join(', '))}</span>`;

    // Song title words: every word is set in a font that feels like what it means.
    // A word that fits none of these moods stays in the site's own serif.
    const MOODS = {
        'w-love': 'love lover loving heart kiss hold baby darling sweetheart honey forever angel crush adore mine yours babe romance',
        'w-angry': 'hate bad dead drop break stupid kill wrong hurt mad crazy fight liar cruel bitch fire burn war revenge villain poison toxic',
        'w-sad': 'sorry cry tears alone lonely lost goodbye miss cold blue broken sad empty ghost gone without bleed rain lie leave',
        'w-move': 'run hills down fast drive dance fly fall move jump high ride go wild shake up away',
        'w-time': 'one last time never again yesterday tomorrow always until before after still years summer forget remember back',
        'w-dream': 'dream dreams night stars star moon sky heaven light sun gold glow paradise wish magic midnight',
        'w-fun': 'party girl girls boy boys fun sugar candy pink espresso song sing music radio good pretty cute',
        'w-body': 'hands hand eyes lips skin body face touch mouth feel breathe',
    };
    const MOOD_OF = {};
    Object.entries(MOODS).forEach(([mood, words]) => words.split(' ').forEach(w => MOOD_OF[w] ??= mood));
    // try the word as it is, then without an ending (kisses → kiss, breaking → break, loved → love)
    const wordFont = w => [w, w.replace(/es$/, ''), w.replace(/s$/, ''), w.replace(/ing$/, ''), w.replace(/ing$/, 'e'), w.replace(/ed$/, ''), w.replace(/d$/, '')]
        .map(form => MOOD_OF[form]).find(Boolean) || 'w-plain';

    function build(lab) {
        const tracks = lab.topTracks || {};
        const mid = tracks.medium_term || [];
        const shortT = tracks.short_term || [];
        const longT = tracks.long_term || [];
        const all = [...shortT, ...mid, ...longT];

        // Albums I can't leave
        if (all.length) {
            const albums = {};
            const seen = new Set();
            all.forEach(t => { if (seen.has(key(t))) return; seen.add(key(t)); const k = t.album; if (!k) return; albums[k] = albums[k] || { n: 0, art: t.albumArt, artist: main(t) }; albums[k].n++; });
            const top = Object.entries(albums).sort((a, b) => b[1].n - a[1].n).slice(0, 4);
            card('Albums I Can’t Leave', 'most songs across all my top lists',
                `<ul class="lab-albums">${top.map(([n, a]) => `<li>${a.art ? `<img src="${esc(a.art)}" alt="" loading="lazy">` : ''}<span><b>${esc(n)}</b><span>${esc(a.artist)}, ${a.n} songs</span></span></li>`).join('')}</ul>`);
        }

        // From the vault
        if (all.length) {
            const seen = new Set();
            const oldest = all.filter(t => year(t) && !seen.has(key(t)) && seen.add(key(t))).sort((a, b) => year(a) - year(b)).slice(0, 5);
            card('From the Vault', 'the oldest songs still in my top lists', list(oldest.map(t => `${song(t)} <em>${year(t)}</em>`)));
        }

        // Song title words
        if (all.length) {
            const skip = new Set('the a an of to and in on my me you i it is for with feat remix version from at your be this that all what we no so up by do dont just like'.split(' '));
            const words = {};
            const seen = new Set();
            all.forEach(t => { if (seen.has(key(t))) return; seen.add(key(t)); t.name.toLowerCase().replace(/\(.*?\)|-.*$/g, '').replace(/[^a-z' ]/g, ' ').split(/\s+/).forEach(w => { w = w.replace(/'/g, ''); if (w.length > 2 && !skip.has(w)) words[w] = (words[w] || 0) + 1; }); });
            const top = Object.entries(words).sort((a, b) => b[1] - a[1]).slice(0, 18);
            const max = top[0]?.[1] || 1;
            card('Song Title Words', 'what my favorite song titles keep saying',
                `<p class="lab-cloud">${top.map(([w, n]) => `<span class="${wordFont(w)}" style="font-size:${0.85 + (n / max) * 1.3}em">${esc(w)}</span>`).join(' ')}</p>`);
        }

        root.innerHTML = cards.join('');
    }

    fetch('/spotify/GetMusicLab')
        .then(r => r.ok ? r.json() : null)
        .then(lab => lab ? build(lab) : root.innerHTML = '<p class="lab-sub">Spotify isn’t answering right now.</p>')
        .catch(() => root.innerHTML = '<p class="lab-sub">Spotify isn’t answering right now.</p>');
})();
