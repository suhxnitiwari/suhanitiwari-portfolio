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

    function open() {
        root.classList.add('open');
        panel.hidden = false;
        launch.setAttribute('aria-expanded', 'true');
        input.focus();
    }
    function shut() {
        root.classList.remove('open');
        panel.hidden = true;
        launch.setAttribute('aria-expanded', 'false');
        launch.focus();
    }
    launch.addEventListener('click', open);
    close.addEventListener('click', shut);
    root.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) shut(); });

    function add(text, who, extra) {
        const el = document.createElement('div');
        el.className = `sitara-msg ${who}${extra ? ' ' + extra : ''}`;
        el.textContent = text;
        log.append(el);
        log.scrollTop = log.scrollHeight;
        return el;
    }

    let busy = false;
    let asked = 0;   // questions this visit; Sitara only gets sleepy after a lot of them
    async function ask(question) {
        question = question.trim();
        if (!question || busy) return;
        busy = true;
        send.disabled = true;
        chips.hidden = true;
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
                body: JSON.stringify({ message: question, count: ++asked })
            });
            const data = await res.json().catch(() => ({}));
            dots.remove();
            if (data.reply) {
                add(data.reply, 'bot');
                mood('helpful', 'your guide to all things Suhani');
            } else {
                add(data.error || 'Something went sideways. Try again in a moment. ✦', 'bot', 'oops');
                mood('tired', 'even fairy dust has its limits');
            }
        } catch {
            dots.remove();
            add('I can’t reach my notes right now. Try again in a moment. ✦', 'bot', 'oops');
            mood('tired', 'even fairy dust has its limits');
        } finally {
            root.classList.remove('thinking');
            busy = false;
            send.disabled = false;
            input.focus();
        }
    }

    form.addEventListener('submit', e => { e.preventDefault(); ask(input.value); });
    chips.querySelectorAll('button').forEach(b => b.addEventListener('click', () => ask(b.textContent)));
})();
