// ✦ Fairy dust: gold and pink glitter behind the cursor. The faster you move, the more it sheds.
// Only with a real mouse, and never for people who've asked for less motion.
(() => {
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const COLORS = ['#E0A83E', '#F5C95C', '#FBE3A6', '#F6B8C8', '#E9A6BC'];
    const MAX = 90;       // never more than this many bits on screen
    const GAP = 16;       // ms between bursts
    let last = 0, lastX = null, lastY = null, alive = 0;

    function sprinkle(x, y, speed) {
        const bit = document.createElement('span');
        bit.className = 'fairy-dust' + (Math.random() < 0.35 ? ' dot' : '');
        const size = 3 + Math.random() * (5 + Math.min(speed, 3) * 1.5);  // quick moves toss bigger bits too
        const spread = 5 + speed * 4;
        bit.style.cssText =
            `left:${x + (Math.random() * 2 - 1) * spread}px;top:${y + 6 + (Math.random() * 2 - 1) * spread}px;` +
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
        // 1 bit when drifting, up to 7 on a fast swipe (and a slow drift only sheds now and then)
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
