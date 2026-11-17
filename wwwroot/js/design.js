// DESIGN pages (/design and /design/{study}): the starfield behind the index, cards that tilt toward the cursor,
// the mini galaxy that demonstrates my encoding with real data, the ask box, live embeds that load on request,
// and before/after cards that flip. Everything respects prefers-reduced-motion.
(() => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const $ = (s, el = document) => el.querySelector(s);
    const $$ = (s, el = document) => [...el.querySelectorAll(s)];

    // ---------- the index: a field of stars that leans toward the cursor ----------
    const sky = $('.ds-sky');
    if (sky) {
        const ctx = sky.getContext('2d');
        let w = 0, h = 0, dpr = 1, stars = [], mx = -1e4, my = -1e4;
        const size = () => {
            dpr = Math.min(2, devicePixelRatio || 1);
            w = sky.clientWidth; h = sky.clientHeight;
            sky.width = w * dpr; sky.height = h * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            const n = Math.round(w * h / 5200);
            stars = Array.from({ length: n }, () => ({
                x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.3 + 0.25,
                a: Math.random() * 0.55 + 0.15, t: Math.random() * Math.PI * 2, d: Math.random() * 0.6 + 0.2
            }));
        };
        const host = sky.parentElement;
        host.addEventListener('pointermove', e => { const b = sky.getBoundingClientRect(); mx = e.clientX - b.left; my = e.clientY - b.top; });
        host.addEventListener('pointerleave', () => { mx = my = -1e4; });
        const draw = time => {
            ctx.clearRect(0, 0, w, h);
            for (const s of stars) {
                let x = s.x, y = s.y;
                const dx = mx - x, dy = my - y, dist = Math.hypot(dx, dy);
                if (dist < 180) { const pull = (1 - dist / 180) * 14 * s.d; x += dx / dist * pull; y += dy / dist * pull; }
                const tw = reduce ? 1 : 0.65 + 0.35 * Math.sin(time / 900 * s.d + s.t);
                const glow = dist < 180 ? 1 + (1 - dist / 180) * 1.4 : 1;
                ctx.globalAlpha = Math.min(1, s.a * tw * glow);
                ctx.fillStyle = dist < 180 ? '#F3C6D2' : '#F9EDE9';
                ctx.beginPath(); ctx.arc(x, y, s.r * (dist < 180 ? 1.25 : 1), 0, Math.PI * 2); ctx.fill();
            }
            ctx.globalAlpha = 1;
            if (!reduce) requestAnimationFrame(draw);
        };
        size(); addEventListener('resize', size);
        requestAnimationFrame(draw);
    }

    // ---------- index cards tilt toward the cursor ----------
    if (!reduce && matchMedia('(hover: hover)').matches) {
        $$('.ds-shot').forEach(card => {
            card.addEventListener('pointermove', e => {
                const b = card.getBoundingClientRect();
                const px = (e.clientX - b.left) / b.width - 0.5, py = (e.clientY - b.top) / b.height - 0.5;
                card.style.transform = `perspective(1100px) rotateY(${px * 6}deg) rotateX(${-py * 6}deg) translateY(-4px)`;
            });
            card.addEventListener('pointerleave', () => { card.style.transform = ''; });
        });
    }

    // ---------- the mini galaxy: my real top 700 songs, drawn with the same encoding as the full galaxy ----------
    const gx = $('#dsGalaxy');
    if (gx) {
        const canvas = $('canvas', gx), ctx = canvas.getContext('2d'), tip = $('.ds-tip', gx);
        const range = $('input[type="range"]', gx), out = $('output', gx), playBtn = $('[data-play]', gx);
        const yearColor = { 2022: '#F4B6CC', 2023: '#C9A7F0', 2024: '#94B4F5', 2025: '#F6D27A', 2026: '#F49A86' };
        const moodColor = { love: '#F48FB1', party: '#F7D774', confident: '#F4A261', bittersweet: '#C9A0F0', heartbreak: '#D2486F', dark: '#8E63C9' };
        let mode = 'year', data = null, pts = [], months = [], now = 0, w = 0, h = 0, dpr = 1, hover = null, mx = -1e4, my = -1e4, playing = false;
        const monthIndex = ym => months.indexOf(ym);

        const layout = () => {
            dpr = Math.min(2, devicePixelRatio || 1);
            w = canvas.clientWidth; h = canvas.clientHeight;
            canvas.width = w * dpr; canvas.height = h * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            if (!data) return;
            const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.47;
            const order = data.artists.map((a, i) => ({ i, first: a[1] })).sort((a, b) => a.first < b.first ? -1 : 1);
            const centers = new Map();
            // artists in the order they entered my life, wound outward along two spiral arms
            const N = order.length;
            order.forEach((a, k) => {
                const f = k / Math.max(1, N - 1);
                const r = R * (0.16 + 0.82 * Math.pow(f, 0.6));
                const arm = k % 2 ? Math.PI : 0;
                const ang = arm + Math.sqrt(f) * 7.5 + Math.sin(k * 12.9898) * 0.35;
                centers.set(a.i, { x: cx + Math.cos(ang) * r * 1.45, y: cy + Math.sin(ang) * r * 0.82 });
            });
            const rank = new Map();
            pts = data.songs.map(s => {
                const k = (rank.get(s[1]) || 0); rank.set(s[1], k + 1);
                const c = centers.get(s[1]);
                const off = 5 + Math.sqrt(k) * 11, ang = k * 2.39996;
                return { title: s[0], artist: data.artists[s[1]][0], ai: s[1], listens: s[2], first: s[3], last: s[4], mood: s[5],
                    x: c.x + Math.cos(ang) * off, y: c.y + Math.sin(ang) * off, cx: c.x, cy: c.y,
                    r: Math.max(1.6, Math.sqrt(s[2]) * 0.22), fi: monthIndex(s[3]), li: monthIndex(s[4]), tw: Math.random() * 6.28 };
            });
        };

        const label = i => { const [y, m] = months[i].split('-'); return new Date(+y, +m - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' }); };

        const draw = time => {
            ctx.clearRect(0, 0, w, h);
            const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.6);
            g.addColorStop(0, 'rgba(120, 76, 160, 0.30)'); g.addColorStop(0.5, 'rgba(60, 30, 80, 0.12)'); g.addColorStop(1, 'rgba(20, 13, 26, 0)');
            ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
            if (hover) {   // the hovered artist's constellation
                ctx.strokeStyle = 'rgba(243, 236, 248, 0.35)'; ctx.lineWidth = 0.8;
                for (const p of pts) if (p.ai === hover.ai && p.fi <= now) { ctx.beginPath(); ctx.moveTo(p.cx, p.cy); ctx.lineTo(p.x, p.y); ctx.stroke(); }
            }
            for (const p of pts) {
                if (p.fi > now) continue;
                const faded = now - p.li > 12;                  // a star fades in the year after its last listen
                const col = mode === 'year' ? yearColor[p.first.slice(0, 4)] : (moodColor[p.mood] || '#8E86A0');
                let x = p.x, y = p.y;
                const dx = mx - x, dy = my - y, d = Math.hypot(dx, dy);
                if (d < 90 && d > 0) { const pull = (1 - d / 90) * 5; x += dx / d * pull; y += dy / d * pull; }
                const twinkle = reduce ? 1 : 0.8 + 0.2 * Math.sin(time / 700 + p.tw);
                const dim = hover && hover.ai !== p.ai ? 0.35 : 1;
                ctx.globalAlpha = (faded ? 0.38 : 0.95) * twinkle * dim * (mode === 'mood' && !p.mood ? 0.35 : 1);
                ctx.fillStyle = col;
                ctx.beginPath(); ctx.arc(x, y, p.r, 0, Math.PI * 2); ctx.fill();
                if (p.r > 2.4 && !faded) { ctx.globalAlpha *= 0.25; ctx.beginPath(); ctx.arc(x, y, p.r * 2.4, 0, Math.PI * 2); ctx.fill(); }
                p.sx = x; p.sy = y;
            }
            ctx.globalAlpha = 1;
            requestAnimationFrame(draw);
        };

        const pick = () => {
            let best = null, bd = 16;
            for (const p of pts) { if (p.fi > now || p.sx === undefined) continue; const d = Math.hypot(p.sx - mx, p.sy - my) - p.r; if (d < bd) { bd = d; best = p; } }
            hover = best;
            if (!best) { tip.classList.remove('on'); return; }
            tip.innerHTML = `<strong>${best.title.replace(/</g, '&lt;')}</strong>${best.artist.replace(/</g, '&lt;')}<br>${best.listens.toLocaleString()} listens, first heard ${label(monthIndex(best.first))}${best.mood ? `<br>Mood: ${best.mood}` : ''}`;
            tip.style.left = Math.min(w - 250, Math.max(8, best.sx + 14)) + 'px';
            tip.style.top = Math.max(8, best.sy - 20) + 'px';
            tip.classList.add('on');
        };

        canvas.addEventListener('pointermove', e => { const b = canvas.getBoundingClientRect(); mx = e.clientX - b.left; my = e.clientY - b.top; pick(); });
        canvas.addEventListener('pointerleave', () => { mx = my = -1e4; hover = null; tip.classList.remove('on'); });
        $$('[data-mode]', gx).forEach(b => b.addEventListener('click', () => {
            mode = b.dataset.mode;
            $$('[data-mode]', gx).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
            $('.ds-key[data-for="year"]', gx).hidden = mode !== 'year';
            $('.ds-key[data-for="mood"]', gx).hidden = mode !== 'mood';
        }));
        const setNow = i => { now = i; range.value = i; out.textContent = label(i); };
        range.addEventListener('input', () => { playing = false; setNow(+range.value); });
        playBtn.addEventListener('click', () => {
            if (reduce) { setNow(months.length - 1); return; }
            playing = true; const start = performance.now(), len = 6000;
            const step = t => { if (!playing) return; const k = Math.min(1, (t - start) / len); setNow(Math.round(k * (months.length - 1))); if (k < 1) requestAnimationFrame(step); else playing = false; };
            requestAnimationFrame(step);
        });

        fetch('/data/design-galaxy.json').then(r => r.json()).then(d => {
            data = d;
            const first = new Date(2022, 4, 1), last = new Date(2026, 8, 1);
            for (let t = new Date(first); t <= last; t.setMonth(t.getMonth() + 1)) months.push(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`);
            range.max = months.length - 1;
            layout(); setNow(months.length - 1);
            requestAnimationFrame(draw);
        });
        addEventListener('resize', layout);
    }

    // ---------- the ask box: real answers from my Search History data ----------
    const ask = $('#dsAsk');
    if (ask) {
        const field = $('.ds-ask-field span', ask), ans = $('.ds-ask-answer', ask);
        let typing = 0;
        $$('[data-q]', ask).forEach(b => b.addEventListener('click', () => {
            $$('[data-q]', ask).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
            const q = b.dataset.q, id = ++typing;
            const show = () => { ans.innerHTML = `<b>${b.dataset.a}</b><p>${b.dataset.more}</p>`; ans.classList.remove('fresh'); void ans.offsetWidth; ans.classList.add('fresh'); };
            if (reduce) { field.textContent = q; show(); return; }
            field.textContent = '';
            let i = 0;
            const tick = () => { if (id !== typing) return; field.textContent = q.slice(0, ++i); if (i < q.length) setTimeout(tick, 22); else setTimeout(show, 160); };
            tick();
        }));
    }

    // ---------- live embeds load only when someone asks ----------
    $$('.ds-embed button').forEach(b => b.addEventListener('click', () => {
        const box = b.closest('.ds-embed');
        const f = document.createElement('iframe');
        f.src = box.dataset.src; f.title = box.dataset.title; f.loading = 'eager'; f.allow = 'autoplay; fullscreen';
        box.replaceChildren(f);
    }));

    // ---------- before and after: click a card to flip it ----------
    $$('.ds-flip button').forEach(b => b.addEventListener('click', () => b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'))));
    $$('.ds-flip-all').forEach(b => b.addEventListener('click', () => {
        const cards = $$('.ds-flip button', b.parentElement);
        const flipTo = cards.some(c => c.getAttribute('aria-pressed') !== 'true');
        cards.forEach(c => c.setAttribute('aria-pressed', String(flipTo)));
        b.textContent = flipTo ? 'Show every before' : 'Flip every card';
    }));
})();
