// Music extras (Favorites): the song title words, the albums I can't leave and the oldest songs I still play,
// each dropped into its own spot on the page (#labWords, #labAlbums, #labVault).
// All of it comes from one call, /spotify/GetMusicLab, and is worked out here in the browser.
(() => {
    const slots = { albums: document.getElementById('labAlbums'), vault: document.getElementById('labVault'), words: document.getElementById('labWords') };
    if (!slots.albums) return;

    const esc = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const year = t => parseInt((t.releaseDate || '').slice(0, 4), 10) || null;
    const key = t => t.id || `${t.name}|${t.artists[0]}`;
    const main = t => t.artists[0] || '';

    // each card fills its own spot on the page
    const card = (slot, title, sub, body) => slots[slot].innerHTML = `
            <article class="lab-card">
                <h4 class="lab-title">${esc(title)}</h4>
                ${sub ? `<p class="lab-sub">${esc(sub)}</p>` : ''}
                ${body}
            </article>`;

    // the fives row's shared rows (the same as On Repeat): rank, cover, name and one detail line
    const fiveList = rows => `<ol class="five-list">${rows.map((r, i) => `
            <li><div><em>${i + 1}</em>${r.art ? `<img src="${esc(r.art)}" alt="" loading="lazy">` : '<i></i>'}<span><b>${esc(r.title)}</b><span>${esc(r.detail)}</span></span></div></li>`).join('')}</ol>`;

    // Kid-safe words only: nothing here should be a word Amaira (9) can't see. Any title word that
    // matches (or starts with / contains one of the swear roots) is dropped before counting.
    const NOT_FOR_KIDS = new Set(('kill killer killing killed murder murderer dead die dies died dying death deadly ' +
        'gun guns shoot shot shots bullet blood bloody knife stab war weapon bomb suicide grave ' +
        'rape raped raping rapist sex sexy kiss kisses kissing kissed naked nude bed lust seduce hot hottie thong ' +
        'drunk drink drinking wine whiskey tequila vodka beer liquor shots high weed smoke smoking drug drugs pill pills cocaine ' +
        'hate hated hater stupid dumb idiot hell damn god ' +
        'fuck shit bitch bitches ass asshole damn crap bastard dick piss slut whore hoe hoes pussy cock tits boobs devil').split(' '));
    const SWEAR_ROOTS = ['fuck', 'shit', 'bitch', 'slut', 'whore', 'pussy', 'dick', 'cock', 'bastard', 'nigg', 'fag'];
    const kidSafe = w => !NOT_FOR_KIDS.has(w) && !NOT_FOR_KIDS.has(w.replace(/(es|s|ed|ing|in)$/, '')) && !SWEAR_ROOTS.some(r => w.includes(r));

    // Song title words: every word gets its own font, picked for what that word means, and no font is used twice.
    // [font, color, extra style]
    const WORD_FONTS = {
        bad:    ["'Rubik Glitch'", '#7A2E3B'],                           // glitched, something's off
        love:   ["'Great Vibes'", '#B0566A'],                            // romantic script
        run:    ["'Racing Sans One'", '#56634A', 'font-style: italic'],  // built for speed
        better: ["'Abril Fatface'", '#2A1810'],                          // confident, levelled up
        hills:  ["'Rye'", '#6B7F5E'],                                    // wide open country
        drop:   ["'Rubik Wet Paint'", '#8A4D57'],                        // literally dripping
        break:  ["'Rubik Distressed'", '#8F4661'],                       // cracked and worn
        hands:  ["'Caveat'", '#8A4D57'],                                 // written by hand
        one:    ["'Monoton'", '#9E5A63'],                                // a single neon line
        last:   ["'Cormorant Garamond'", '#8C9BAE', 'font-style: italic; font-weight: 300'],   // thin and fading
        time:   ["'Orbitron'", '#5A3E36'],                               // a digital clock
        song:   ["'Pacifico'", '#D0708A'],                               // bubbly and sing-song
        heart:  ["'Lobster'", '#A3475C'],                                // big and warm
        down:   ["'Bebas Neue'", '#56634A', 'display: inline-block; transform: translateY(0.18em)'],   // sinking below the line
    };
    // a word that isn't listed above takes the first unused font from its mood, then from the spares
    const MOOD_WORDS = {
        love: 'lover loving hold baby darling sweetheart honey forever angel crush adore mine yours babe romance',
        angry: 'fire burn villain wrong hurt mad crazy fight liar cruel',
        sad: 'sorry cry tears alone lonely lost goodbye miss cold blue broken sad empty ghost gone without rain leave',
        move: 'fast drive dance fly fall move jump high ride go wild shake away',
        dream: 'dream dreams night stars star moon sky heaven light sun gold glow paradise wish magic midnight',
    };
    const MOOD_FONTS = {
        love: ["'Satisfy'", "'Dancing Script'"],
        angry: ["'Rubik Burned'", "'Bungee'"],
        sad: ["'Homemade Apple'", "'Special Elite'"],
        move: ["'Righteous'", "'Bungee Shade'"],
        dream: ["'Italiana'", "'Tangerine'"],
    };
    const SPARE_FONTS = ["'Bodoni Moda'", "'Playfair Display'", "'Shrikhand'", "'Amatic SC'", "'Kalam'", "'Josefin Sans'", "'Fraunces'", "'Syne'"];
    const SPARE_COLORS = ['#2A1810', '#8A4D57', '#56634A', '#9E5A63', '#5A3E36'];
    const stems = w => [w, w.replace(/es$/, ''), w.replace(/s$/, ''), w.replace(/ing$/, ''), w.replace(/ing$/, 'e'), w.replace(/ed$/, ''), w.replace(/d$/, '')];
    function fontsFor(words) {
        const used = new Set();
        const pick = list => { const f = list.find(x => !used.has(x)); if (f) used.add(f); return f; };
        const style = ([font, color, extra = '']) => `font-family: ${font}, Georgia, serif; color: ${color}; ${extra}`;
        // listed words first, so they always get their own font
        const out = {};
        words.forEach(w => { const hit = stems(w).find(f => WORD_FONTS[f]); if (hit && !used.has(WORD_FONTS[hit][0])) { used.add(WORD_FONTS[hit][0]); out[w] = style(WORD_FONTS[hit]); } });
        words.forEach((w, i) => {
            if (out[w]) return;
            const mood = Object.keys(MOOD_WORDS).find(m => stems(w).some(f => MOOD_WORDS[m].split(' ').includes(f)));
            const font = (mood && pick(MOOD_FONTS[mood])) || pick(SPARE_FONTS) || 'Georgia';
            out[w] = style([font, SPARE_COLORS[i % SPARE_COLORS.length]]);
        });
        return out;
    }

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
            const top = Object.entries(albums).sort((a, b) => b[1].n - a[1].n).slice(0, 5);
            card('albums', 'Albums on Loop', 'most songs in my top lists', fiveList(top.map(([n, a]) => ({ art: a.art, title: n, detail: `${a.artist}, ${a.n} songs` }))));
        }

        // From the vault
        if (all.length) {
            const seen = new Set();
            const oldest = all.filter(t => year(t) && !seen.has(key(t)) && seen.add(key(t))).sort((a, b) => year(a) - year(b)).slice(0, 5);
            card('vault', 'From the Vault', 'the oldest songs I still play', fiveList(oldest.map(t => ({ art: t.albumArt, title: t.name, detail: `${t.artists[0]}, ${year(t)}` }))));
        }

        // Song title words
        if (all.length) {
            const skip = new Set('the a an of to and in on my me you i it is for with feat remix version from at your be this that all what we no so up by do dont just like'.split(' '));
            const words = {};
            const seen = new Set();
            all.forEach(t => { if (seen.has(key(t))) return; seen.add(key(t)); t.name.toLowerCase().replace(/\(.*?\)|-.*$/g, '').replace(/[^a-z' ]/g, ' ').split(/\s+/).forEach(w => { w = w.replace(/'/g, ''); if (w.length > 2 && !skip.has(w) && kidSafe(w)) words[w] = (words[w] || 0) + 1; }); });
            const top = Object.entries(words).sort((a, b) => b[1] - a[1]).slice(0, 18);
            const max = top[0]?.[1] || 1;
            const fonts = fontsFor(top.map(([w]) => w));
            card('words', 'Song Title Words', 'what my favorite song titles keep saying',
                `<p class="lab-cloud">${top.map(([w, n]) => `<span style="${fonts[w]} font-size:${0.85 + (n / max) * 1.3}em">${esc(w)}</span>`).join(' ')}</p>`);
        }

    }

    fetch('/spotify/GetMusicLab')
        .then(r => r.ok ? r.json() : null)
        .then(lab => lab ? build(lab) : quiet())
        .catch(quiet);

    function quiet() {
        slots.albums.innerHTML = '<p class="lab-sub">Spotify isn’t answering right now.</p>';
    }
})();
