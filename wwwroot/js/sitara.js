// Sitara ✦ chat: opens from the floating button, sends each question to my Cloudflare Worker,
// and swaps her face and status line while she thinks, answers, or runs into trouble.
(() => {
    const root = document.querySelector('.sitara');
    if (!root) return;
    const endpoint = root.dataset.endpoint;
    const launch = root.querySelector('.sitara-launch');
    const panel = root.querySelector('.sitara-panel');
    const close = root.querySelector('.sitara-close');
    const log = root.querySelector('.sitara-log');
    const chips = root.querySelector('.sitara-chips');
    const form = root.querySelector('.sitara-form');
    const input = form.querySelector('input');
    const send = form.querySelector('button');
    const face = root.querySelector('.sitara-face');
    const status = root.querySelector('.sitara-status');
    const img = name => `/images/sitara/${name}.jpg`;

    const mood = (name, line) => { face.src = img(name); status.textContent = line; };

    // The chat is saved for this tab, so it stays open and remembers the conversation
    // as the visitor moves between pages. Closing the tab starts fresh.
    const chat = {
        load: () => { try { return JSON.parse(sessionStorage.getItem('sitaraChat')) || {}; } catch { return {}; } },
        save: () => {
            try {
                sessionStorage.setItem('sitaraChat', JSON.stringify({ open: !panel.hidden, msgs, suggest, history, misses }));
            } catch { }
        }
    };
    const saved = chat.load();
    const msgs = Array.isArray(saved.msgs) ? saved.msgs : [];     // [{ text, who, extra }]
    let suggest = Array.isArray(saved.suggest) ? saved.suggest : [];

    function open(focus = true) {
        root.classList.add('open');
        panel.hidden = false;
        launch.setAttribute('aria-expanded', 'true');
        if (focus) input.focus();
        chat.save();
    }
    // Focus goes back to the button only for keyboard users (Escape), so mouse users
    // don't see a focus ring around "Ask Sitara" after closing the chat
    function shut(fromKeyboard = false) {
        root.classList.remove('open');
        panel.hidden = true;
        launch.setAttribute('aria-expanded', 'false');
        if (fromKeyboard) launch.focus();
        chat.save();
    }
    launch.addEventListener('click', open);
    close.addEventListener('click', e => shut(e.detail === 0));   // detail 0 = pressed with the keyboard
    root.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) shut(true); });

    function add(text, who, extra, remember = true) {
        const el = document.createElement('div');
        el.className = `sitara-msg ${who}${extra ? ' ' + extra : ''}`;
        el.textContent = text;
        log.append(el);
        log.scrollTop = log.scrollHeight;
        if (remember) {
            msgs.push({ text, who, extra: extra || '' });
            if (msgs.length > 60) msgs.splice(0, msgs.length - 60);
            chat.save();
        }
        return el;
    }

    // Fairy dust: 25 questions per visit (kept across pages in this tab). The Worker adds the
    // "last question" warning at 24 and the goodbye at 25; after that the chat closes for the day.
    const LIMIT = 25;
    const store = {
        get: () => { try { return +sessionStorage.getItem('sitaraAsked') || 0; } catch { return 0; } },
        set: n => { try { sessionStorage.setItem('sitaraAsked', n); } catch { } }
    };
    let busy = false;
    let asked = store.get();
    let misses = Number.isFinite(saved.misses) ? saved.misses : 0;   // "I don't know" answers in a row; after three, Sitara offers a menu of things she does know
    // The last few questions and answers, sent along so Sitara can follow up without repeating herself
    const history = Array.isArray(saved.history) ? saved.history : [];

    function outOfDust() {
        input.disabled = true;
        send.disabled = true;
        input.placeholder = 'Out of fairy dust for today ✦';
        chips.hidden = true;
        mood('tired', 'out of fairy dust for today ✦');
    }
    if (asked >= LIMIT) outOfDust();
    // "Did you mean...?" options from Sitara, as buttons under her message; tapping one asks it
    function offer(questions, remember = true) {
        if (remember) { suggest = questions; chat.save(); }
        const row = document.createElement('div');
        row.className = 'sitara-suggest';
        row.setAttribute('role', 'group');
        row.setAttribute('aria-label', 'Did you mean');
        questions.forEach(text => {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = text;
            b.addEventListener('click', () => ask(text));
            row.append(b);
        });
        log.append(row);
        log.scrollTop = log.scrollHeight;
    }

    // returns { text, ok } for the MIS page's AI card, which asks her from inside the page; null when she can't take it
    async function ask(question) {
        question = question.trim();
        if (!question || busy || asked >= LIMIT) return null;
        let result = null;
        busy = true;
        send.disabled = true;
        chips.hidden = true;
        log.querySelectorAll('.sitara-suggest').forEach(row => row.remove());
        suggest = [];
        add(question, 'me');
        input.value = '';

        const dots = document.createElement('div');
        dots.className = 'sitara-msg bot sitara-dots';
        dots.setAttribute('aria-label', 'Sitara is typing');
        dots.innerHTML = '<span></span><span></span><span></span>';
        log.append(dots);
        log.scrollTop = log.scrollHeight;
        root.classList.add('thinking');
        mood('thinking', 'hmm, let me find that…');

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: question, count: ++asked, misses, history: history.slice(-3) })
            });
            store.set(asked);
            const data = await res.json().catch(() => ({}));
            dots.remove();
            if (data.reply) {
                if (data.clarify) {
                    // a clarifying question doesn't cost fairy dust
                    asked = Math.max(0, asked - 1);
                    store.set(asked);
                } else {
                    misses = data.unknown ? misses + 1 : 0;
                }
                add(data.reply, 'bot');
                result = { text: data.reply, ok: true };
                if (Array.isArray(data.suggest) && data.suggest.length) offer(data.suggest);
                if (!data.clarify) {
                    // sig proves the answer really came from Sitara when it goes back as history
                    history.push({ q: question, a: data.reply, sig: data.sig });
                    if (history.length > 6) history.shift();
                }
                chat.save();
                mood('helpful', 'your guide to all things Suhani');
            } else {
                add(data.error || 'Something went sideways. Try again in a moment. ✦', 'bot', 'oops');
                result = { text: data.error || 'Something went sideways. Try again in a moment. ✦', ok: false };
                mood('tired', 'even fairy dust has its limits');
            }
        } catch {
            asked = Math.max(0, asked - 1);   // a question that never arrived doesn't cost fairy dust
            store.set(asked);
            dots.remove();
            add('I can’t reach my notes right now. Try again in a moment. ✦', 'bot', 'oops');
            result = { text: 'I can’t reach my notes right now. Try again in a moment. ✦', ok: false };
            mood('tired', 'even fairy dust has its limits');
        } finally {
            root.classList.remove('thinking');
            busy = false;
            if (asked >= LIMIT) {
                outOfDust();
            } else {
                send.disabled = false;
                input.focus();
            }
        }
        return result;
    }
    window.sitaraAsk = ask;
    window.sitaraOpen = open;

    // Bring back this tab's conversation from earlier pages
    if (msgs.length) {
        chips.hidden = true;
        msgs.forEach(m => add(m.text, m.who, m.extra, false));
        if (suggest.length) offer(suggest, false);
    }
    if (saved.open) open(false);

    form.addEventListener('submit', e => { e.preventDefault(); ask(input.value); });
    chips.querySelectorAll('button').forEach(b => b.addEventListener('click', () => ask(b.textContent)));

    // Never sit on top of something you need to click: once the page stops scrolling, if a link, button, field or video
    // is under the launcher, she tucks into the right edge (a sliver of her face still shows, and she still opens on a tap).
    // Over empty space she slides back out.
    const clickable = 'a, button, input, select, textarea, label, video, [role="button"], [role="tab"], [tabindex]:not([tabindex="-1"])';
    const overlapsSomething = () => {
        const box = launch.getBoundingClientRect();
        root.style.pointerEvents = 'none';   // look underneath her, not at her
        const points = [[0.15, 0.25], [0.5, 0.5], [0.85, 0.25], [0.15, 0.85], [0.85, 0.85], [0.5, 0.1]];
        const hit = points.some(([fx, fy]) => {
            const el = document.elementFromPoint(box.left + box.width * fx, box.top + box.height * fy);
            return el && !root.contains(el) && el.closest(clickable);
        });
        root.style.pointerEvents = '';
        return hit;
    };
    let settle;
    const check = () => {
        if (root.classList.contains('open')) { root.classList.remove('tucked'); return; }
        root.classList.remove('tucked');           // measure from her normal spot
        root.classList.toggle('tucked', overlapsSomething());
    };
    addEventListener('scroll', () => { clearTimeout(settle); settle = setTimeout(check, 140); }, { passive: true });
    addEventListener('resize', () => { clearTimeout(settle); settle = setTimeout(check, 140); });
    // a tucked Sitara slides out on hover or focus, so she's easy to reach on purpose
    launch.addEventListener('focus', () => root.classList.remove('tucked'));
    setTimeout(check, 600);
})();
