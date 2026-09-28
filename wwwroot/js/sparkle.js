// ✦ Fairy dust cursor: a gold sparkle that follows the mouse, plus glitter that sheds faster the
// faster you move. Only with a real mouse; the glitter skips people who've asked for less motion.
//
// The sparkle is drawn here instead of being a cursor image, because macOS swaps any cursor image
// for a plain arrow when you move quickly. The CSS gives every element an invisible cursor
// (blank-soft or blank-hot), and reading that tells us which sparkle to show. Anywhere else
// (text boxes, grab handles, embedded apps) we step aside and the normal cursor shows.
(() => {
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ---------------------------------------------------------------- the sparkle itself
    const pointer = document.createElement('div');
    pointer.className = 'fairy-pointer';
    pointer.hidden = true;
    pointer.setAttribute('aria-hidden', 'true');
    pointer.innerHTML = '<img class="soft" src="/images/cursor/sparkle.svg" alt=""><img class="hot" src="/images/cursor/sparkle-hot.svg" alt="">';
    const HOT_X = 13, HOT_Y = 15;   // where the click lands inside the 32x32 sparkle
    let x = 0, y = 0, queued = false, lastTarget = null, drawn = false;

    // only hide the real cursor once both sparkles have loaded, so nobody is ever left without one
    Promise.all([...pointer.querySelectorAll('img')].map(img => img.decode())).then(() => {
        document.body.appendChild(pointer);
        document.documentElement.classList.add('fairy-cursor');
        drawn = true;
    }).catch(() => { /* keep the plain sparkle cursor images from the CSS */ });

    const place = () => {
        queued = false;
        pointer.style.transform = `translate3d(${x - HOT_X}px, ${y - HOT_Y}px, 0)`;
    };

    // which sparkle (if any) belongs over this element
    const modeFor = el => {
        if (!el || el.tagName === 'IFRAME') return null;
        const c = getComputedStyle(el).cursor;
        return c.includes('blank-hot') ? 'hot' : c.includes('blank-soft') ? 'soft' : null;
    };

    addEventListener('pointermove', e => {
        if (e.pointerType !== 'mouse' || !drawn) return;
        x = e.clientX; y = e.clientY;
        if (e.target !== lastTarget) {
            lastTarget = e.target;
            const mode = modeFor(e.target);
            pointer.hidden = !mode;
            pointer.classList.toggle('is-hot', mode === 'hot');
        } else if (pointer.hidden && modeFor(e.target)) {
            pointer.hidden = false;
        }
        if (!queued) { queued = true; requestAnimationFrame(place); }
    }, { passive: true });

    // hide it when the mouse leaves the window or slips into an embedded app
    document.addEventListener('pointerout', e => {
        if (!e.relatedTarget || e.relatedTarget.tagName === 'IFRAME') { pointer.hidden = true; lastTarget = null; }
    });
    addEventListener('blur', () => { pointer.hidden = true; lastTarget = null; });

    if (calm) return;

    // ---------------------------------------------------------------- the glitter trail
    const COLORS = ['#E0A83E', '#F5C95C', '#FBE3A6', '#F6B8C8', '#E9A6BC'];
    const MAX = 90;       // never more than this many bits on screen
    const GAP = 16;       // ms between bursts
    let last = 0, lastX = null, lastY = null, alive = 0;

    function sprinkle(px, py, speed) {
        const bit = document.createElement('span');
        bit.className = 'fairy-dust' + (Math.random() < 0.35 ? ' dot' : '');
        const size = 3 + Math.random() * (5 + Math.min(speed, 3) * 1.5);  // quick moves toss bigger bits too
        const spread = 5 + speed * 4;
        bit.style.cssText =
            `left:${px + (Math.random() * 2 - 1) * spread}px;top:${py + 6 + (Math.random() * 2 - 1) * spread}px;` +
            `--s:${size}px;--c:${COLORS[Math.floor(Math.random() * COLORS.length)]};` +
            `--dx:${(Math.random() * 2 - 1) * (12 + speed * 8)}px;--dy:${10 + Math.random() * (22 + speed * 10)}px;` +
            `--r:${Math.random() * 180 - 90}deg`;
        document.body.appendChild(bit);
        alive++;
        bit.addEventListener('animationend', () => { bit.remove(); alive--; }, { once: true });
    }

    addEventListener('pointermove', e => {
        if (e.pointerType !== 'mouse') return;
        const now = performance.now();
        if (lastX === null) { lastX = e.clientX; lastY = e.clientY; last = now; return; }
        const dt = now - last;
        if (dt < GAP) return;
        const dx = e.clientX - lastX, dy = e.clientY - lastY;
        const distance = Math.hypot(dx, dy);
        if (distance < 4) return;

        // speed in pixels per millisecond: a slow drift is ~0.2, a quick swipe is 2+
        const speed = distance / dt;
        // up to 7 bits on a fast swipe; a slow drift only sheds now and then
        let count = Math.min(7, Math.round(speed * 2.2));
        if (count === 0 && Math.random() < 0.25) count = 1;
        count = Math.min(count, MAX - alive);

        // spread the burst along the path you just traveled, so fast swipes leave a streak
        for (let i = 0; i < count; i++) {
            const t = Math.random();
            sprinkle(lastX + dx * t, lastY + dy * t, speed);
        }
        last = now; lastX = e.clientX; lastY = e.clientY;
    }, { passive: true });
})();
