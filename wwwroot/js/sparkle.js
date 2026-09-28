// ✦ Fairy dust: a little trail of gold and pink glitter behind the cursor.
// Only with a real mouse, and never for people who've asked for less motion.
(() => {
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const COLORS = ['#E0A83E', '#F5C95C', '#FBE3A6', '#F6B8C8', '#E9A6BC'];
    const MAX = 40;          // never more than this many bits on screen
    const GAP = 28;          // ms between bits, so a fast swipe doesn't make a blizzard
    let last = 0, lastX = 0, lastY = 0, alive = 0;

    addEventListener('pointermove', e => {
        if (e.pointerType !== 'mouse') return;
        const now = performance.now();
        const moved = Math.abs(e.clientX - lastX) + Math.abs(e.clientY - lastY);
        if (now - last < GAP || moved < 6 || alive >= MAX) return;
        last = now; lastX = e.clientX; lastY = e.clientY;

        const bit = document.createElement('span');
        bit.className = 'fairy-dust' + (Math.random() < 0.35 ? ' dot' : '');
        const size = 3 + Math.random() * 6;
        bit.style.cssText =
            `left:${e.clientX + (Math.random() * 10 - 5)}px;top:${e.clientY + 6 + (Math.random() * 8 - 4)}px;` +
            `--s:${size}px;--c:${COLORS[Math.floor(Math.random() * COLORS.length)]};` +
            `--dx:${Math.random() * 24 - 12}px;--dy:${10 + Math.random() * 22}px;--r:${Math.random() * 180 - 90}deg`;
        document.body.appendChild(bit);
        alive++;
        bit.addEventListener('animationend', () => { bit.remove(); alive--; }, { once: true });
    }, { passive: true });
})();
