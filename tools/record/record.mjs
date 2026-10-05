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
        url: 'https://suhxnitiwari.github.io/whats-in-my-bag/', w: 1000, h: 1000,
        run: async ev => {
            await sleep(1800);
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
        // Still Watching: straight into S1:E1, the West Campus drop-off with the opening credits rolling
        url: 'https://suhxnitiwari.github.io/still-watching/', w: 1280, h: 720,
        prep: async ev => {
            await ev(`sessionStorage.setItem('entered', '1'); location.reload()`);
            await sleep(4000);
            await ev(`document.querySelector('#play').click()`);
            await sleep(300);
        },
        run: async () => { await sleep(20000); }
    },
    search: {
        // 8,730 Questions: "Play my day", the hour-by-hour chart of what I search
        url: 'https://suhxnitiwari.github.io/search-history/', w: 1280, h: 800,
        prep: async ev => {
            await ev(`document.documentElement.style.scrollBehavior = 'auto'; document.querySelector('#hours').scrollIntoView({block: 'center'})`);
            await sleep(1200);
        },
        run: async ev => { await sleep(600); await ev(`document.querySelector('#play').click()`); await sleep(13000); }
    },
    owala: {
        url: 'http://localhost:5142/home/study#mk-title-owala', w: 1280, h: 900, crop: '#mk-proj-owala .mk-stage',
        run: async ev => { await sleep(1500); for (let i = 0; i < 9; i++) { await sleep(1700); await ev(`document.querySelector('#mk-proj-owala .mk-step[data-go="1"]').click()`); } await sleep(1500); }
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
    ws.addEventListener('message', m => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } });
    const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
    const ev = async expr => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;

    await send('Emulation.setDeviceMetricsOverride', { width: shot.w, height: shot.h, deviceScaleFactor: 1, mobile: false });
    await send('Page.enable');
    await send('Page.navigate', { url: shot.url });
    await sleep(4000);

    // crop to one element (the slide decks), measured after the page settles
    let clip;
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

    // capture frames as fast as Chrome gives them while the script plays
    const times = [];
    let recording = true, n = 0;
    const t0 = Date.now();
    const grab = (async () => {
        while (recording) {
            const res = await send('Page.captureScreenshot', { format: 'jpeg', quality: 85, ...(clip ? { clip } : {}) });
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
} finally {
    chrome.kill();
}
