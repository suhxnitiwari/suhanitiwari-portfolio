// autoplay(root, tick, ms): calls tick() every ms while root is on screen, so a diagram plays itself instead of waiting to be clicked.
// Someone clicking or using the keys inside it gets 10 quiet seconds before it moves again.
// Nothing moves for people who asked for less motion, or while the tab is in the background.
window.autoplay = window.autoplay || function (root, tick, ms) {
    if (!root || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let visible = false, quietUntil = 0, timer = null;
    const run = () => {
        clearInterval(timer);
        if (visible) timer = setInterval(() => { if (!document.hidden && Date.now() > quietUntil) tick(); }, ms);
    };
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; run(); }, { threshold: 0.35 }).observe(root);
    const hush = e => { if (e.isTrusted) quietUntil = Date.now() + 10000; };
    root.addEventListener('pointerdown', hush);
    root.addEventListener('keydown', hush);
};
