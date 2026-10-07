// Records a project in action as a folder of JPEG frames, using Chrome's DevTools protocol (no extra installs).
// node record.mjs <name>   ->  /tmp/rec/<name>/00001.jpg ... plus times.json (ms since start for each frame)
// encode.swift then turns each folder into an MP4 for the Projects board.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// each shot: the page, the window size, an optional element to crop to, and what happens while recording
const shots = {
    rideflow: {
        url: 'https://rideflow-frontend.onrender.com/', w: 1280, h: 800,
        run: async ev => { await sleep(1500); await ev(`window.scrollTo({top: 0})`); for (let y = 0; y < 2400; y += 8) { await ev(`window.scrollTo(0, ${y})`); await sleep(16); } await sleep(800); }
    },
    galaxy: {
        // Heavy Rotation: prep waits for the soundcheck and picks "Continue without sound", then the video runs
        // from the warp into the galaxy forming, month by month
        url: 'https://suhxnitiwari.github.io/listening-galaxy/', w: 1280, h: 800,
        prep: async ev => {
            const quiet = `[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Continue without sound')`;
            for (let i = 0; i < 60 && !(await ev(`!!${quiet}`)); i++) await sleep(500);
            await ev(`${quiet}.click()`);
            await sleep(6500);   // skip the dark title card; start at the warp into the galaxy
        },
        run: async () => { await sleep(20000); }
    },
    bag: {
        // What's in My Bag?: filmed wide to match its tile. The page is zoomed out a little and scrolled so the backpack
        // sits in the middle of the frame; it opens on the closed backpack for a beat, then it tips and everything falls out
        url: 'https://suhxnitiwari.github.io/whats-in-my-bag/', w: 1280, h: 800,
        prep: async ev => {
            await ev(`document.documentElement.style.zoom = '0.62'; document.documentElement.style.scrollBehavior = 'auto'`);
            await sleep(400);
            await ev(`(() => { const r = document.getElementById('bag').getBoundingClientRect(); window.scrollBy(0, r.top + r.height / 2 - innerHeight / 2); })()`);
            await sleep(600);
        },
        run: async ev => {
            await sleep(2200);
            await ev(`(() => { const b = document.querySelector('#unzip-all'); b.hidden = false; b.dataset.mode = 'dump'; b.click(); })()`);
            await sleep(6500);
        }
    },
    starbucks: {
        url: 'http://localhost:5142/home/study#mk-title-starbucks', w: 1280, h: 900, crop: '#mk-proj-starbucks .mk-stage',
        run: async ev => { await sleep(1500); for (let i = 0; i < 6; i++) { await sleep(1700); await ev(`document.querySelector('#mk-proj-starbucks .mk-step[data-go="1"]').click()`); } await sleep(1500); }
    },
    fuelflow: {
        url: 'http://localhost:5142/home/study#mk-title-fuelflow', w: 1280, h: 900, crop: '#mk-proj-fuelflow .mk-stage',
        run: async ev => { await sleep(1500); for (let i = 0; i < 6; i++) { await sleep(1700); await ev(`document.querySelector('#mk-proj-fuelflow .mk-step[data-go="1"]').click()`); } await sleep(1500); }
    },
    personality: {
        url: 'https://suhxnitiwari.github.io/suhani-personality/', w: 1280, h: 800,
        run: async ev => { await sleep(1500); for (let y = 0; y < 2600; y += 8) { await ev(`window.scrollTo(0, ${y})`); await sleep(16); } await sleep(800); }
    },
    celestial: {
        url: 'https://suhxnitiwari.github.io/suhani-celestial/', w: 1280, h: 800,
        run: async ev => { await sleep(2500); for (let y = 0; y < 2600; y += 8) { await ev(`window.scrollTo(0, ${y})`); await sleep(16); } await sleep(800); }
    },
    saturday: {
        // prep waits for my Python planner to load (Pyodide) before recording starts, then the video plans three Saturdays
        url: 'https://suhxnitiwari.github.io/saturday-in-austin/', w: 1280, h: 800,
        prep: async ev => { for (let i = 0; i < 60 && !(await ev(`!!document.querySelector('#prefs button[type=submit]:not([disabled])')`)); i++) await sleep(500); },
        run: async ev => {
            // pick a kind of Saturday, then ask for a new plan
            const pick = label => ev(`[...document.querySelectorAll('#prefs button, #prefs label')].find(b => b.textContent.trim() === ${JSON.stringify(label)})?.click()`);
            const again = () => ev(`document.querySelector('.again').click()`);
            await sleep(1500);
            for (const kind of ['Foodie', 'Creative', 'Outside', 'Treat myself']) { await pick(kind); await sleep(500); await again(); await sleep(2000); }
            await sleep(800);
        }
    },
    suhaiku: {
        // Suhaiku: starts on the gallery wall, walks up to two prints (the words fade in, the label explains how each
        // was made), and steps back each time, so the loop ends where it starts. SUHAIKU_URL records a local build.
        url: process.env.SUHAIKU_URL || 'https://suhxnitiwari.github.io/suhaiku/', w: 1280, h: 800,
        prep: async ev => { await ev(`(() => { const w = document.querySelector('#wall'); scrollTo(0, w.getBoundingClientRect().top + scrollY - 90); })()`); await sleep(1500); },
        run: async ev => {
            const visit = async (k, hold) => {
                await ev(`document.querySelector('.frame[data-k="${k}"]').click()`); await sleep(hold);
                await ev(`document.querySelector('#roomBack').click()`); await sleep(1700);
            };
            await sleep(1800);
            await visit(3, 5600);
            await visit(2, 5200);
        }
    },
    dollhouse: {
        // The Suhani House: the 3D house built from my personality, on its own guided tour
        url: 'https://suhxnitiwari.github.io/suhani-personality/house/', w: 1280, h: 720,
        prep: async ev => {
            for (let i = 0; i < 40 && !(await ev(`!!document.querySelector('#tourBtn')`)); i++) await sleep(500);
            await sleep(1500);
            await ev(`[...document.querySelectorAll('button, a')].find(b => /open the dollhouse/i.test(b.textContent))?.click()`);
            await sleep(4000);   // the title card lifts and the front of the house swings open
        },
        run: async ev => {
            // a slow drag across the canvas orbits the camera around the open dollhouse
            await ev(`(() => { const c = document.querySelector('canvas'), r = c.getBoundingClientRect();
                const at = (type, x) => c.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: r.left + x, clientY: r.top + r.height * 0.55 }));
                window.__orbit = { at, x: r.width * 0.3 }; at('pointerdown', window.__orbit.x); })()`);
            for (let i = 0; i < 260; i++) { await ev(`window.__orbit.at('pointermove', window.__orbit.x += 2.2)`); await sleep(45); }
            await ev(`window.__orbit.at('pointerup', window.__orbit.x)`);
            await sleep(800);
        }
    },
    stillwatching: {
        // Still Watching: the cold open, from black. The red S glows in, then "Who's watching?" as the four profiles generate
        url: process.env.SW_URL || 'https://suhxnitiwari.github.io/still-watching/', w: 1280, h: 720,
        prep: async ev => { await ev(`sessionStorage.clear(); location.reload()`); await sleep(150); },
        run: async ev => { await sleep(4600); await ev(`document.querySelector('#intro-start').click()`); await sleep(13000); }
    },
    // Still Watching episodes for the montage (montage.py stitches them): the player opens on an episode the way a
    // visitor would, and the first seconds (while the player controls fade) are trimmed away afterwards
    'sw-dad': {
        url: 'https://suhxnitiwari.github.io/still-watching/', w: 1280, h: 720,
        prep: async ev => { await ev(`sessionStorage.setItem('entered', '1'); location.reload()`); await sleep(4000); await ev(`document.querySelector('[data-film="dad"]').click()`); await sleep(200); },
        run: async () => { await sleep(34000); }
    },
    'sw-copycat': {
        url: 'https://suhxnitiwari.github.io/still-watching/', w: 1280, h: 720,
        prep: async ev => { await ev(`sessionStorage.setItem('entered', '1'); location.reload()`); await sleep(4000); await ev(`document.querySelector('[data-film="copycat"]').click()`); await sleep(200); },
        run: async () => { await sleep(10000); }
    },
    doubletap: {
        // Double Tap: the Instagram-profile page is a phone-width column, so it's filmed narrow, scrolling from the header into the posts and back up
        url: 'https://suhxnitiwari.github.io/double-tap/', w: 640, h: 800,
        run: async ev => {
            await sleep(1500);
            const end = await ev(`document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, 0); document.documentElement.scrollHeight - innerHeight`);
            for (let y = 0; y <= end; y += 4) { await ev(`window.scrollTo(0, ${y})`); await sleep(16); }
            await sleep(1200);
        }
    },
    lullabyte: {
        // Lullabyte: the opening (the crib mobile lowered in on its string, its shadow swinging across the wall, the headline
        // rising after it), then Amaira, Maya and Asha, each typed letter by letter and played, so their felt charms drop onto the mobile.
        // LULLABYTE_URL can point at a local copy to record before it goes live.
        url: process.env.LULLABYTE_URL || 'https://suhxnitiwari.github.io/baby-name-maker/', w: 1280, h: 800,
        // forget any earlier visit, so the page waits behind its sound gate; the gate is then hidden without a fade
        prep: async ev => { await ev(`localStorage.clear(); location.reload()`); await sleep(3500); await ev(`document.getElementById('gate').hidden = true; MB.setOn(false); soundUI()`); await sleep(300); },
        run: async ev => {
            await ev(`enter(false)`);
            await sleep(2300);
            // three names, one after another: each typed letter by letter, played, then cleared for the next
            for (const [i, name] of ['Amaira', 'Maya', 'Asha'].entries()) {
                if (i) { await ev(`(() => { const f = document.getElementById('heroName'); f.value = ''; f.dispatchEvent(new Event('input', { bubbles: true })); })()`); await sleep(500); }
                for (const ch of name) {
                    await ev(`(() => { const f = document.getElementById('heroName'); f.value += ${JSON.stringify(ch)}; f.dispatchEvent(new Event('input', { bubbles: true })); })()`);
                    await sleep(240);
                }
                await sleep(600);
                await ev(`document.getElementById('heroPlay').click()`);
                await sleep(4200);
            }
        }
    },
    rhode: {
        // Rhode Has a Hailey Problem: the deck's cover, the shelf whose labels flip from rhode to hailey one at a time
        url: process.env.SITE_URL ? process.env.SITE_URL + '/#mk-proj-rhode' : 'http://localhost:5142/#mk-proj-rhode', w: 1280, h: 900, crop: '#mk-proj-rhode .mk-stage',
        select: `document.querySelector('[aria-controls="mk-proj-rhode"]').click()`,
        run: async () => { await sleep(12000); }
    },
    upnext: {
        // Up Next: the opening in the player (the play mark over candlelight, the question, then the first beats), cropped to the player.
        // UPNEXT_URL can point at a local copy to record before it goes live. Streaming ignores crop, so the frames are cropped to the player afterward
        url: process.env.UPNEXT_URL || 'https://suhxnitiwari.github.io/up-next/', w: 760, h: 900, crop: '.stage.trailer', stream: true,
        run: async () => { await sleep(16000); }
    },
    americaneagle: {
        // 40 Billion Impressions, 1% Growth: the American Eagle deck's cover, comments, headlines and reactions flooding in
        // while impressions climb to 40 billion. SITE_URL can point at a local copy of the site
        url: (process.env.SITE_URL || 'http://localhost:5142') + '/#mk-proj-americaneagle', w: 1280, h: 900, crop: '#mk-proj-americaneagle .mk-stage',
        select: `document.querySelector('[aria-controls="mk-proj-americaneagle"]').click()`,
        run: async () => { await sleep(13000); }
    },
    linkedin: {
        // for LinkedIn: the home page from the top (SUHANI TIWARI lands), a slow scroll down the site,
        // a visible cursor clicking "More on my MIS curriculum", then on into Marketing
        url: process.env.SITE_URL || 'https://suhanitiwari.com/', w: 1280, h: 1000, stream: true,
        // the About tagline starts its keyboard-mash typing as soon as the page loads (off screen), so it has settled by the time we get there
        preload: `{ const IO = window.IntersectionObserver; window.IntersectionObserver = class extends IO {
            constructor(cb, o) { super(cb, o); this.cb = cb; }
            observe(el) { if (el.classList && el.classList.contains('about-tagline')) setTimeout(() => this.cb([{ isIntersecting: true, target: el }], this), 0); else super.observe(el); } };
            // and its scrambled letters stay hidden, so on camera it simply types out
            addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '.about-tagline .x { visibility: hidden; } .sitara.tucked .sitara-launch { transform: none !important; opacity: 1 !important; }'; document.head.appendChild(st); }); }`,
        run: async ev => {
            const T0 = Date.now(), marks = {}, mark = k => { marks[k] = +((Date.now() - T0) / 1000).toFixed(2); console.log('mark', k, marks[k]); };
            await ev('setTimeout(() => location.reload(), 50)');
            await sleep(2300);
            // an eased scroll of exactly `ms`, re-aiming every frame so sections that shift above can't throw it off
            const go = (sel, off, ms) => ev(`new Promise(res => { const s = scrollY, t0 = performance.now(), d = ${ms};
                const tgt = () => { const e = document.querySelector(${JSON.stringify(sel)}); return Math.min(e.getBoundingClientRect().top + scrollY + ${off}, document.documentElement.scrollHeight - innerHeight); };
                const f = n => { const k = Math.min(1, (n - t0) / d), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; scrollTo({ top: s + (tgt() - s) * e, behavior: 'instant' }); k < 1 ? requestAnimationFrame(f) : res(); };
                requestAnimationFrame(f); })`);
            const hold = ms => sleep(ms);
            // a soft cursor that glides to an element and clicks it
            const tap = async (sel, ms = 420) => {
                await ev(`(() => {
                    const b = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect();
                    let c = document.getElementById('fakecursor');
                    if (!c) { c = document.createElement('div'); c.id = 'fakecursor';
                        c.style.cssText = 'position:fixed;z-index:99999;left:' + (b.right + 90) + 'px;top:' + (b.bottom + 70) + 'px;width:30px;height:30px;border-radius:50%;background:rgba(115,54,66,.9);box-shadow:0 0 0 7px rgba(243,201,207,.7);transition:left .4s cubic-bezier(.3,.7,.2,1),top .4s cubic-bezier(.3,.7,.2,1),transform .15s,opacity .25s;pointer-events:none';
                        document.body.appendChild(c); }
                    c.style.opacity = '1';
                    requestAnimationFrame(() => requestAnimationFrame(() => { c.style.left = (b.left + b.width / 2 - 15) + 'px'; c.style.top = (b.top + b.height / 2 - 15) + 'px'; }));
                })()`);
                await sleep(ms);
                await ev(`(() => { const c = document.getElementById('fakecursor'); c.style.transform = 'scale(.7)'; setTimeout(() => c.style.transform = '', 160); document.querySelector(${JSON.stringify(sel)}).click(); })()`);
            };
            const hideCursor = () => ev(`(() => { const c = document.getElementById('fakecursor'); if (c) c.style.opacity = '0'; })()`);
            // About on its own, before Selected work comes into view
            mark('about'); await go('#about', -370, 700); await hold(550);
            mark('truth'); await go('#selected-work', -70, 700); await hold(600);
            // a soft drift down so Still Watching and Listening Galaxy are both in full view
            mark('itsabout'); await go('#selected-work', 10, 1000); await hold(300);
            mark('experience'); await go('#experience', -70, 650); await hold(550);
            await go('#education', -70, 650); await hold(550);
            mark('why'); await go('#why-heading', -90, 700); await hold(600);
            // MIS: the project map, then the button
            mark('mis'); await go('.mis-more-btn', -926, 800); await hold(500);
            await tap('.mis-more-btn', 480); await sleep(250); await hideCursor();
            // the cycle, with a little room above its heading; the ball travels on to Technical skills
            await go('#mis-more-cycle', -120, 700); await hold(500);
            await ev(`document.querySelector('.mis-box[data-step="1"] .mis-box-main').click()`); await hold(900);
            // Hand me a problem: one click on the triangle's next problem
            await go('.mp-section.mis-more', -110, 650); await hold(200);
            await tap('.mp-tabs button:nth-child(2)', 400); await hold(600);
            // From one line of code: a quick turn of the dial
            await go('#zoom-heading', -330, 650); await hold(150);
            await tap('.zoom-tick[data-zoom="2"]', 400); await hold(500); await hideCursor();
            // Marketing: the project tabs with the whole deck under them, then a click over to Prime Book Club
            mark('marketing'); await go('.mp-proj-tabs', -90, 750); await hold(150);
            await tap('[aria-controls="mk-proj-primebookclub"]', 420); await hold(900); await hideCursor();
            // All projects, slowly enough for every card to load
            mark('projects'); await go('#projects', -70, 750); await hold(900);
            await go('#projects', 650, 1900); await hold(600);
            mark('beyond'); await go('#beyond', -70, 750); await hold(500);
            mark('finale'); await go('#finale-heading', -110, 900); await hold(2300);
            mark('end');
            writeFileSync('/tmp/rec/linkedin-marks.json', JSON.stringify(marks));
        }
    },
    search: {
        // Search History: my name drawn from my searches, then a question typed into the search bar and answered,
        // then the clock it opens, playing my day hour by hour
        // SEARCH_URL can point at a local copy when GitHub Pages is still serving a cached page
        url: process.env.SEARCH_URL || 'https://suhxnitiwari.github.io/search-history/', w: 1280, h: 800,
        run: async ev => {
            // reload once frames are rolling so the whole SUHANI doodle is drawn on camera (about five seconds)
            await ev('setTimeout(() => location.reload(), 50)');
            await sleep(6800);
            // the question goes in a few words at a time (one keystroke per call stalls headless capture)
            for (const part of ['is ', 'is she ', 'is she a ', 'is she a night ', 'is she a night owl?']) {
                await ev(`(() => { const i = document.getElementById('sq'); i.value = ${JSON.stringify(part)}; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
                await sleep(220);
            }
            await sleep(600);
            await ev(`document.getElementById('sq').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))`);
            await sleep(2800);
            await ev(`document.getElementById('open').click()`);
            await sleep(900);
            await ev(`document.getElementById('play').click()`);
            await sleep(9000);
        }
    },
    owala: {
        url: 'http://localhost:5142/home/study#mk-title-owala', w: 1280, h: 900, crop: '#mk-proj-owala .mk-stage',
        run: async ev => { await sleep(1500); for (let i = 0; i < 9; i++) { await sleep(1700); await ev(`document.querySelector('#mk-proj-owala .mk-step[data-go="1"]').click()`); } await sleep(1500); }
    },
    'linkedin-cover': {
        // the LinkedIn post video, 4:5: the hook, my site scrolling in a browser window, Read it / Use it
        url: new URL('./linkedin-cover.html', import.meta.url).href, w: 1080, h: 1350, fps: 30
    },
    'owala-cover': {
        // the Owala deck's cover: an animation page stepped frame by frame through window.render(t), so it plays smoothly
        url: new URL('./owala-cover.html', import.meta.url).href, w: 1280, h: 720, fps: 30
    },
    'fuelflow-cover': {
        // the FuelFlow deck's 15-second cover: a Tuesday at UT, the survey numbers, the station, the logo
        url: new URL('./fuelflow-cover.html', import.meta.url).href, w: 1280, h: 720, fps: 30
    }
};

const name = process.argv[2];
const shot = shots[name];
if (!shot) { console.error('pick one of: ' + Object.keys(shots).join(', ')); process.exit(1); }

const out = `/tmp/rec/${name}`;
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=/tmp/rec-profile-${name}`,
    '--hide-scrollbars', '--mute-audio', '--no-first-run', `--window-size=${shot.w},${shot.h}`], { stdio: 'ignore' });

try {
    let target;
    for (let i = 0; i < 50 && !target; i++) {
        try { target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json(); } catch { await sleep(200); }
    }
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise(r => ws.addEventListener('open', r));
    let id = 0;
    const pending = new Map();
    const events = [];
    ws.addEventListener('message', m => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } else if (d.method) events.forEach(f => f(d)); });
    const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
    const ev = async expr => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;

    await send('Emulation.setDeviceMetricsOverride', { width: shot.w, height: shot.h, deviceScaleFactor: 1, mobile: false });
    await send('Page.enable');
    if (shot.preload) await send('Page.addScriptToEvaluateOnNewDocument', { source: shot.preload });
    await send('Page.navigate', { url: shot.url });
    await sleep(4000);

    // crop to one element (the slide decks), measured after the page settles; select runs first (e.g. opening a deck's tab)
    let clip;
    if (shot.select) { await ev(shot.select); await sleep(1500); }
    if (shot.crop) {
        await ev(`document.querySelector(${JSON.stringify(shot.crop)}).scrollIntoView({block: 'center'})`);
        await sleep(600);
        const r = await ev(`(() => { const r = document.querySelector(${JSON.stringify(shot.crop)}).getBoundingClientRect(); return {x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height}; })()`);
        console.log('crop', JSON.stringify(r));
        clip = { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width) & ~1, height: Math.round(r.height) & ~1, scale: 1 };
    }

    if (shot.prep) await shot.prep(ev);

    // pages with window.render(t) are stepped one frame at a time instead of captured live
    if (shot.fps) {
        await ev('window.ready');
        const total = Math.round((await ev('window.DUR')) * shot.fps), times = [];
        for (let i = 0; i < total; i++) {
            await ev(`render(${i / shot.fps})`);
            const res = await send('Page.captureScreenshot', { format: 'jpeg', quality: 90 });
            writeFileSync(`${out}/${String(i + 1).padStart(5, '0')}.jpg`, Buffer.from(res.result.data, 'base64'));
            times.push(i * 1000 / shot.fps);
        }
        writeFileSync(`${out}/times.json`, JSON.stringify(times));
        console.log(`${name}: ${total} frames at ${shot.fps} fps`);
        chrome.kill();
        process.exit(0);
    }

    // canvas-heavy pages stream frames as Chrome paints them (smoother than asking for one screenshot at a time)
    if (shot.stream) {
        const times = [];
        let n = 0;
        const t0 = Date.now();
        events.push(d => {
            if (d.method !== 'Page.screencastFrame') return;
            writeFileSync(`${out}/${String(++n).padStart(5, '0')}.jpg`, Buffer.from(d.params.data, 'base64'));
            times.push(Date.now() - t0);
            send('Page.screencastFrameAck', { sessionId: d.params.sessionId });
        });
        await send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: shot.w, maxHeight: shot.h, everyNthFrame: 1 });
        await shot.run(ev);
        await send('Page.stopScreencast');
        writeFileSync(`${out}/times.json`, JSON.stringify(times));
        console.log(`${name}: ${n} frames over ${(times.at(-1) / 1000).toFixed(1)}s (${(n / (times.at(-1) / 1000)).toFixed(1)} fps)`);
        ws.close();
    } else {
    // capture frames as fast as Chrome gives them while the script plays
    const times = [];
    let recording = true, n = 0;
    const t0 = Date.now();
    const grab = (async () => {
        while (recording) {
            // a screenshot asked for mid-reload never answers, so give up on it after a moment
            const res = await Promise.race([send('Page.captureScreenshot', { format: 'jpeg', quality: 85, ...(clip ? { clip } : {}) }), sleep(500).then(() => ({}))]);
            if (!res.result) continue;
            writeFileSync(`${out}/${String(++n).padStart(5, '0')}.jpg`, Buffer.from(res.result.data, 'base64'));
            times.push(Date.now() - t0);
        }
    })();
    await shot.run(ev);
    recording = false;
    await grab;
    writeFileSync(`${out}/times.json`, JSON.stringify(times));
    console.log(`${name}: ${n} frames over ${(times.at(-1) / 1000).toFixed(1)}s (${(n / (times.at(-1) / 1000)).toFixed(1)} fps)`);
    ws.close();
    }
} finally {
    chrome.kill();
}
