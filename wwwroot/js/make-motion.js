// Make, in motion (styles in make-motion.css): pieces rise in as you reach them, the art wall drifts
// sideways by itself, and the cake gallery turns on its own. Touching any of them gives you 10 quiet seconds.
(() => {
    const page = document.querySelector('.make-page');
    if (!page || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // rise in: each shelf's pieces get an order, and come in one after another once the shelf is on screen
    const groups = [
        ...page.querySelectorAll('.shelf-head, .shelf-caption'),
        ...page.querySelectorAll('.wall-col'),
        ...page.querySelectorAll('.shelf-rail > .shelf-item'),
        ...page.querySelectorAll('.cake-stage, .treat-grid > li')
    ];
    const order = new Map();
    groups.forEach(el => {
        const box = el.closest('.shelf') || page;
        const n = order.get(box) || 0;
        order.set(box, n + 1);
        el.style.setProperty('--d', Math.min(n, 8));
        el.classList.add('mv');
    });
    const rise = new IntersectionObserver(entries => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('in'); rise.unobserve(e.target); }
    }), { threshold: 0.12 });
    groups.forEach(el => rise.observe(el));
    // the food and city photos get their own offsets too, so they don't all drift in step
    page.querySelectorAll('.treat-grid > li, #traveling .shelf-item').forEach((el, i) => el.style.setProperty('--d', i));

    // the art wall drifts back and forth on its own while it's on screen
    const wall = page.querySelector('.gallery-wall');
    if (wall) {
        let visible = false, quietUntil = 0, dir = 1, x = wall.scrollLeft;
        new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.3 }).observe(wall);
        const hush = e => { if (e.isTrusted) { quietUntil = Date.now() + 10000; } };
        ['pointerdown', 'wheel', 'touchstart', 'keydown'].forEach(ev => wall.addEventListener(ev, hush, { passive: true }));
        wall.parentElement.querySelectorAll('.shelf-arrow').forEach(b => b.addEventListener('click', hush));
        const step = () => {
            const max = wall.scrollWidth - wall.clientWidth;
            if (visible && !document.hidden && Date.now() > quietUntil && max > 0) {
                if (Math.abs(wall.scrollLeft - x) > 2) x = wall.scrollLeft;   // someone scrolled it: carry on from there
                x += dir * 0.45;
                if (x >= max) { x = max; dir = -1; }
                if (x <= 0) { x = 0; dir = 1; }
                wall.style.scrollSnapType = 'none';
                wall.style.scrollBehavior = 'auto';
                wall.scrollLeft = x;
            }
            requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }

    // the city cards take turns showing their edit while the Itineraries shelf is on screen
    const trips = [...page.querySelectorAll('#traveling .shelf-item:has(.trip-peek)')];
    if (trips.length && window.autoplay) {
        let now = -1;
        autoplay(page.querySelector('#traveling .shelf-rail'), () => {
            trips.forEach(t => t.classList.remove('peek'));
            now = (now + 1) % trips.length;
            trips[now].classList.add('peek');
        }, 3200);
    }

    // the cake gallery turns by itself, slowly enough to actually look at each cake
    const stage = page.querySelector('.cake-stage');
    const next = stage && stage.querySelector('.cake-arrow.next');
    if (next && window.autoplay) autoplay(stage, () => next.click(), 6500);
})();
