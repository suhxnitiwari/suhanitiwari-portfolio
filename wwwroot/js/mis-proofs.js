// "What I can do": the six cards on the MIS page, each a small working piece of something I built.
// Markup lives in Views/Home/Coursework.cshtml, styles in wwwroot/css/mis-proofs.css.
(() => {
    const money = n => '$' + n.toFixed(2);
    const el = (tag, cls, text) => {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text != null) e.textContent = text;
        return e;
    };

    // ---------- 01 BUILD: RideFlow's fare and ride rules (client/src/pages/RiderPortalPage.jsx, server/utils/rideLifecycle.js) ----------
    const ride = document.querySelector('[data-ride]');
    if (ride) {
        const BASE = 2.5, PER_MILE = 1.75, FEE = 1.2, MIN = 5, TAX = 0.0825, CANCELLATION_FEE = 2.0;
        const NEXT = {
            requested: ['accepted', 'cancelled'],
            accepted: ['en_route', 'in_progress', 'completed', 'cancelled'],
            en_route: ['in_progress', 'completed', 'cancelled'],
            in_progress: ['completed', 'cancelled'],
            completed: [],
            cancelled: []
        };
        const ORDER = ['requested', 'accepted', 'en_route', 'in_progress', 'completed'];
        // the driver's next move from each status, as the driver portal offers it
        const DRIVER = { requested: ['accepted', 'Accept ride'], accepted: ['en_route', 'Head to pickup'], en_route: ['in_progress', 'Start trip'], in_progress: ['completed', 'Complete trip'] };

        const slider = ride.querySelector('input');
        const out = ride.querySelector('.pf-ride-miles output');
        const f = name => ride.querySelector(`[data-f="${name}"]`);
        const steps = ride.querySelector('.pf-status');
        const acts = ride.querySelector('.pf-ride-acts');
        const msg = ride.querySelector('.pf-ride-msg');
        let status = null, driver = false, total = 0;

        const quote = () => {
            const miles = +slider.value;
            const dist = miles * PER_MILE;
            const subtotal = Math.max(BASE + dist + FEE, MIN);
            const tax = subtotal * TAX;
            total = subtotal + tax;
            out.textContent = miles;
            f('dist-label').textContent = `${miles} mi × ${money(PER_MILE)}`;
            f('dist').textContent = money(dist);
            f('tax').textContent = money(tax);
            f('total').textContent = money(total);
        };
        const say = (text, no = false) => { msg.textContent = text; msg.classList.toggle('is-no', no); };
        const button = (label, sub, cls, onClick) => {
            const b = el('button', cls, label);
            b.type = 'button';
            if (sub) b.append(el('small', null, sub));
            b.addEventListener('click', onClick);
            acts.append(b);
        };

        // the same checks the server makes: is it a legal move, and is this role allowed to make it?
        function move(next, role) {
            if (!NEXT[status].includes(next)) return say(`A ${status.replace('_', ' ')} ride can't be moved to ${next.replace('_', ' ')}.`, true);
            if (role === 'rider' && next !== 'cancelled') return say('403: Riders can only cancel a ride.', true);
            const hadDriver = driver;
            if (next === 'accepted') driver = true;
            status = next;
            if (next === 'completed') say(`Ride complete. The rider is charged ${money(total)}.`);
            else if (next === 'cancelled') say(hadDriver ? `Cancelled after a driver accepted, so the rider pays the ${money(CANCELLATION_FEE)} fee.` : 'Cancelled before anyone accepted. No charge.');
            else say({ accepted: 'A driver accepted. They’re now on a ride and can’t take another.', en_route: 'Driver is on the way.', in_progress: 'Trip started.' }[next]);
            draw();
        }

        function draw() {
            acts.replaceChildren();
            const reached = status === 'cancelled' ? -1 : ORDER.indexOf(status);
            steps.classList.toggle('is-cancelled', status === 'cancelled');
            steps.querySelectorAll('li').forEach((li, i) => li.classList.toggle('is-done', status !== null && (i <= reached || (status === 'cancelled' && li.classList.contains('is-done')))));
            if (status === null) {
                slider.disabled = false;
                button('Request ride', null, 'is-main', () => { status = 'requested'; driver = false; say(`Requested. Fare locked at ${money(total)}.`); draw(); });
                return;
            }
            slider.disabled = true;
            if (!NEXT[status].length) {
                button('Book another', null, 'is-main', () => { status = null; say(''); steps.querySelectorAll('li').forEach(li => li.classList.remove('is-done')); draw(); });
                return;
            }
            const [next, label] = DRIVER[status];
            button(label, 'as the driver', 'is-main', () => move(next, 'driver'));
            button('Cancel', 'as the rider', 'is-quiet', () => move('cancelled', 'rider'));
            if (status !== 'requested') button('Mark it done', 'as the rider', 'is-quiet', () => move('completed', 'rider'));
        }

        slider.addEventListener('input', quote);
        quote();
        draw();
    }

    // ---------- 02 DATA: questions for my Spotify warehouse (listening-history/sql), answered from its export ----------
    const sql = document.querySelector('[data-sql]');
    if (sql) {
        const QUERIES = {
            artists: `-- who I actually listen to
SELECT artist_name,
       COUNT(*)                   AS listens,
       ROUND(SUM(minutes) / 60)   AS hours
FROM   v_listen
GROUP  BY artist_name
ORDER  BY listens DESC
LIMIT  5;`,
            songs: `-- one artist, my three most-played songs
SELECT track_name, COUNT(*) AS listens
FROM   v_listen
WHERE  artist_name = :artist
GROUP  BY track_name
ORDER  BY listens DESC
LIMIT  3;`,
            years: `-- every year in one row
SELECT year,
       COUNT(*)                   AS listens,
       ROUND(SUM(minutes) / 60)   AS hours
FROM   v_listen
GROUP  BY year
ORDER  BY year;`,
            streaks: `-- the most days in a row I played one song
SELECT track_name, artist_name, days_in_a_row
FROM   v_song_streaks
ORDER  BY days_in_a_row DESC
LIMIT  5;`
        };
        const tabs = [...sql.querySelectorAll('[role="tab"]')];
        const pre = sql.querySelector('.pf-console-sql');
        const pick = sql.querySelector('.pf-console-pick');
        const select = pick.querySelector('select');
        const run = sql.querySelector('.pf-console-run');
        const result = sql.querySelector('.pf-console-out');
        let data = null, current = 'artists';

        const load = () => data ??= fetch('/data/heavy-rotation.json').then(r => {
            if (!r.ok) throw new Error();
            return r.json();
        }).then(d => {
            select.replaceChildren(...d.artists.map((a, i) => Object.assign(el('option', null, a[0]), { value: i })));
            return d;
        }).catch(e => { data = null; throw e; });

        // light highlighting: comments, strings, keywords
        const highlight = text => {
            const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
            return text.split('\n').map(line => {
                if (line.startsWith('--')) return `<span class="c">${esc(line)}</span>`;
                return esc(line)
                    .replace(/('[^']*')/g, '<span class="s">$1</span>')
                    .replace(/\b(SELECT|FROM|WHERE|GROUP|BY|ORDER|LIMIT|AS|DESC|COUNT|SUM|ROUND)\b/g, '<span class="k">$1</span>');
            }).join('\n');
        };
        const show = () => {
            let text = QUERIES[current];
            if (current === 'songs' && data) text = text.replace(':artist', `'${select.selectedOptions[0]?.textContent.replace(/'/g, "''") ?? ''}'`);
            pre.innerHTML = highlight(text);
        };

        function table(cols, rows, started) {
            const t = el('table');
            const head = t.createTHead().insertRow();
            cols.forEach(([name, num]) => head.append(el('th', num ? 'n' : null, name)));
            const body = t.createTBody();
            rows.forEach(r => {
                const tr = body.insertRow();
                r.forEach((v, i) => tr.append(el('td', cols[i][1] ? 'n' : null, typeof v === 'number' ? v.toLocaleString() : v)));
            });
            result.replaceChildren(t, el('p', null, `(${rows.length} row${rows.length === 1 ? '' : 's'}) · ${Math.max(1, Math.round(performance.now() - started))} ms`));
        }

        async function go() {
            const started = performance.now();
            run.disabled = true;
            try {
                const d = await load();
                const name = i => d.artists[i][0];
                if (current === 'artists') {
                    table([['artist_name'], ['listens', 1], ['hours', 1]], d.artists.slice(0, 5).map(a => [a[0], a[1], Math.round(a[2])]), started);
                } else if (current === 'songs') {
                    const who = +select.value;
                    const rows = d.songs.filter(s => s[1] === who).sort((a, b) => b[2] - a[2]).slice(0, 3).map(s => [s[0], s[2]]);
                    table([['track_name'], ['listens', 1]], rows, started);
                } else if (current === 'years') {
                    table([['year'], ['listens', 1], ['hours', 1]], d.years.map(y => [String(y[0]), y[1], y[2]]), started);
                    result.lastChild.textContent += ` · ${d.period[0].slice(0, 4)} starts in ${new Date(d.period[0] + 'T12:00').toLocaleString('en-US', { month: 'long' })}, ${d.period[1].slice(0, 4)} isn’t over`;
                } else {
                    const rows = [...d.songs].sort((a, b) => b[3] - a[3]).slice(0, 5).map(s => [s[0], name(s[1]), s[3]]);
                    table([['track_name'], ['artist_name'], ['days_in_a_row', 1]], rows, started);
                }
            } catch {
                result.replaceChildren(el('p', null, 'ERROR: could not reach the data. Try again in a moment.'));
            } finally {
                run.disabled = false;
            }
        }

        tabs.forEach(tab => tab.addEventListener('click', async () => {
            tabs.forEach(t => t.setAttribute('aria-selected', String(t === tab)));
            current = tab.dataset.q;
            pick.hidden = current !== 'songs';
            result.replaceChildren();
            if (current === 'songs') await load().catch(() => {});
            show();
        }));
        select.addEventListener('change', () => { if (current === 'songs') { show(); go(); } });
        run.addEventListener('click', go);
        show();
    }

    // ---------- 03 PROTECT: the locked poster flips to show how the lock works ----------
    const flip = document.querySelector('[data-flip]');
    if (flip) {
        const front = flip.querySelector('.pf-front'), back = flip.querySelector('.pf-back');
        const tryBtn = flip.querySelector('.pf-lock-try'), backBtn = flip.querySelector('.pf-lock-back');
        // in one column, the faces don't share a height: the card takes the height of the side that's showing
        const narrow = matchMedia('(max-width: 860px)');
        const fit = () => { flip.style.height = narrow.matches ? `${(flip.classList.contains('is-flipped') ? back : front).offsetHeight}px` : ''; };
        narrow.addEventListener('change', fit);
        addEventListener('resize', fit);
        fit();
        const turn = toBack => {
            flip.classList.toggle('is-flipped', toBack);
            fit();
            front.inert = toBack;
            back.inert = !toBack;
            tryBtn.setAttribute('aria-expanded', String(toBack));
            (toBack ? back.querySelector('.pf-q') : tryBtn).focus({ preventScroll: true });
        };
        back.querySelector('.pf-q').tabIndex = -1;
        tryBtn.addEventListener('click', () => turn(true));
        backBtn.addEventListener('click', () => turn(false));
    }

    // ---------- 04 AI: ask Sitara from inside the card (wwwroot/js/sitara.js) ----------
    const chat = document.querySelector('[data-chat]');
    if (chat) {
        const log = chat.querySelector('.pf-chat-log');
        const form = chat.querySelector('.pf-chat-form');
        const input = form.querySelector('input');
        const controls = [...chat.querySelectorAll('button, input')];
        const face = log.querySelector('img').getAttribute('src');
        const post = (text, who) => {
            const p = el('p', `pf-msg ${who}`);
            if (who.startsWith('bot')) p.append(Object.assign(el('img'), { src: face, alt: '', width: 24, height: 24 }));
            p.append(text);
            log.append(p);
            log.scrollTop = log.scrollHeight;
            return p;
        };
        async function ask(question) {
            question = question.trim();
            if (!question) return;
            if (typeof window.sitaraAsk !== 'function') return post('Sitara is still waking up. Try again in a second ✦', 'bot');
            post(question, 'me');
            input.value = '';
            controls.forEach(c => c.disabled = true);
            const wait = post('thinking…', 'bot wait');
            const answer = await window.sitaraAsk(question);
            wait.remove();
            post(answer?.text ?? 'I’m out of fairy dust for this visit. Come back later ✦', 'bot');
            controls.forEach(c => c.disabled = false);
        }
        chat.querySelectorAll('.pf-chat-chips button').forEach(b => b.addEventListener('click', () => ask(b.textContent)));
        form.addEventListener('submit', e => { e.preventDefault(); ask(input.value); });
    }

    // ---------- 05 ANALYZE: my Saturday in Austin planner, the real Python, in the browser (wwwroot/js/saturday.js) ----------
    const sat = document.querySelector('[data-sat]');
    if (sat) {
        const hours = sat.elements.hours;
        const hoursOut = sat.querySelector('.pf-sat-hours output');
        const go = sat.querySelector('button[type="submit"]');
        const out = sat.querySelector('.pf-sat-out');
        hours.addEventListener('input', () => { hoursOut.textContent = hours.value; });

        // start downloading Python once the card is on screen, so the first plan is quick
        new IntersectionObserver((entries, obs) => {
            if (entries.some(e => e.isIntersecting) && window.saturdayPlanner) { window.saturdayPlanner().catch(() => {}); obs.disconnect(); }
        }, { rootMargin: '200px' }).observe(sat);

        sat.addEventListener('submit', async e => {
            e.preventDefault();
            go.disabled = true;
            out.replaceChildren(el('p', null, 'Waking up Python in your browser… (the first plan takes a few seconds)'));
            try {
                const plan = JSON.parse((await window.saturdayPlanner())('09:00', '23:00', +hours.value, sat.elements.mood.value, '', false, false, 'anywhere'));
                const stops = plan.stops.filter(s => s.name);
                if (!stops.length) {
                    out.replaceChildren(el('p', null, 'Nothing fits that. Try more hours.'));
                    return;
                }
                const list = el('ol');
                stops.forEach(s => {
                    const li = el('li');
                    li.append(el('b', null, s.time), el('span', null, s.name));
                    if (s.note) li.lastChild.append(' ', el('i', null, `(${s.note})`));
                    list.append(li);
                });
                const home = el('li');
                home.append(el('b', null, plan.home), el('span', null, plan.sign_off));
                list.append(home);
                out.replaceChildren(...(plan.sass || []).map(n => el('p', null, n)), list,
                    el('p', null, `${stops.length} stops · ${plan.hours_out} hours out · ${plan.driving} min of driving`));
                go.textContent = 'Plan another ✦';
            } catch {
                out.replaceChildren(el('p', null, 'Python took a nap. Check your connection and try again ✦'));
            } finally {
                go.disabled = false;
            }
        });
    }

    // ---------- 06 DECIDE: three Starbucks features; you call it, then see my call and the RICE score ----------
    const memo = document.querySelector('[data-decide]');
    const pitches = JSON.parse(document.getElementById('pfDecide')?.textContent || '[]');
    if (memo && pitches.length) {
        const TOP = 33750;   // the highest RICE score of the ten
        const count = memo.querySelector('.pf-memo-count');
        const pitch = memo.querySelector('.pf-memo-pitch');
        const calls = [...memo.querySelectorAll('[data-call]')];
        const verdict = memo.querySelector('.pf-memo-verdict');
        let at = 0, agreed = 0;

        function show() {
            const p = pitches[at];
            count.replaceChildren(el('span', null, 'Memo · Starbucks app'), el('span', null, `Pitch ${at + 1} of ${pitches.length}`));
            pitch.replaceChildren(el('b', null, p.feature), p.pitch);
            calls.forEach(b => { b.disabled = false; b.classList.remove('is-picked'); });
            verdict.hidden = true;
        }

        calls.forEach(b => b.addEventListener('click', () => {
            const p = pitches[at];
            const same = b.dataset.call === p.call;
            if (same) agreed++;
            calls.forEach(c => { c.disabled = true; c.classList.toggle('is-picked', c === b); });

            const head = el('p', 'v-head');
            head.append(same ? 'Same call I made: ' : 'I went the other way: ', el('em', null, p.call === 'build' ? 'build it.' : 'don’t build it.'));
            const bar = el('div', 'v-bar');
            bar.setAttribute('role', 'img');
            bar.setAttribute('aria-label', `RICE score ${p.score.toLocaleString()}, number ${p.rank} of 10`);
            const fill = el('span');
            bar.append(fill);
            const parts = [head, bar, el('p', 'v-meta', `RICE ${p.score.toLocaleString()} · #${p.rank} of 10 features · ${p.quad}`), el('p', null, p.why)];
            if (at < pitches.length - 1) {
                const next = el('button', 'pf-memo-next', 'Next pitch →');
                next.type = 'button';
                next.addEventListener('click', () => { at++; show(); pitch.focus({ preventScroll: true }); });
                parts.push(next);
            } else {
                const again = el('button', 'pf-memo-next', 'Start over');
                again.type = 'button';
                again.addEventListener('click', () => { at = 0; agreed = 0; show(); });
                parts.push(el('p', 'v-head', `We agreed on ${agreed} of ${pitches.length}.`), again);
            }
            verdict.replaceChildren(...parts);
            verdict.hidden = false;
            requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = `${(p.score / TOP) * 100}%`; }));
        }));
        pitch.tabIndex = -1;
        show();
    }
})();
