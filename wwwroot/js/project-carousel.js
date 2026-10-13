// Project carousels (MIS projects on Work, Marketing projects on Study): ‹ › and the project names show one project at a time
// (arrow keys work on the names too). Shared by _RideFlowProof and _MarketingWork, so it lives in its own file.
// It waits for the whole page: on the home page it loads before the Marketing section exists.
const projectCarousels = () => document.querySelectorAll('.mp-projects:not([data-carousel])').forEach(root => {
    root.dataset.carousel = '';
    const tabs = [...root.querySelectorAll('.mp-proj-tabs [role="tab"]')];
    const slides = [...root.querySelectorAll('.mp-proj')];
    if (!tabs.length) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let current = 0;
    const show = (i, focus) => {
        current = (i + slides.length) % slides.length;
        tabs.forEach((t, n) => { t.setAttribute('aria-selected', n === current); t.tabIndex = n === current ? 0 : -1; });
        slides.forEach((s, n) => {
            s.hidden = n !== current;
            s.classList.toggle('entering', n === current && !reduce);
        });
        // live previews marked data-live (Saturday in Austin, Personality Site) only load once their slide is opened
        slides[current].querySelectorAll('iframe[data-live]').forEach(f => { f.src = f.dataset.live; f.removeAttribute('data-live'); });
        if (focus) tabs[current].focus();
        // a marketing study has its own address (/marketing/glossier): say which one is open, so the home page can show it in the address bar
        const study = tabs[current].dataset.study;
        if (study) {
            root.dataset.study = study;
            const title = slides[current].querySelector('[id^="mk-title-"]')?.textContent.trim() || tabs[current].textContent.trim();
            window.dispatchEvent(new CustomEvent('study:change', { detail: { study, title } }));
        }
        // keep the chosen tab in view when the row scrolls
        const row = tabs[current].parentElement;
        const tab = tabs[current].getBoundingClientRect(), box = row.getBoundingClientRect();
        if (tab.left < box.left || tab.right > box.right) {
            row.scrollBy({ left: tab.left < box.left ? tab.left - box.left - 4 : tab.right - box.right + 4, behavior: reduce ? 'auto' : 'smooth' });
        }
    };
    // ‹ › only show when the tabs don't fit on one line
    const nav = root.querySelector('.mp-proj-nav');
    // measure with the arrows hidden, or the arrows themselves would make the row look too narrow
    const fits = () => { const row = root.querySelector('.mp-proj-tabs'); if (!nav) return; nav.classList.remove('overflows'); nav.classList.toggle('overflows', row.scrollWidth > row.clientWidth + 2); };
    if (nav) { new ResizeObserver(fits).observe(nav); fits(); }
    tabs.forEach((t, n) => {
        t.addEventListener('click', () => show(n));
        t.addEventListener('keydown', e => {
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
            e.preventDefault();
            e.stopPropagation();   // don't also spin the MIS cycle
            show(current + (e.key === 'ArrowRight' ? 1 : -1), true);
        });
    });
    root.querySelectorAll('.mp-proj-arrow').forEach(b => b.addEventListener('click', () => show(current + +b.dataset.go)));
    // a link like /home/work#mp-rideflow opens that project's slide and scrolls to it (the homepage cards use these)
    const fromHash = () => {
        const target = location.hash.length > 1 && root.querySelector(location.hash);
        const slide = target && target.closest('.mp-proj');
        if (!slide) return;
        show(slides.indexOf(slide));
        root.scrollIntoView({ block: 'start' });
    };
    window.addEventListener('hashchange', fromHash);
    fromHash();
    // a shared study link (/marketing/glossier) opens that deck and lands on it: instantly (the site scrolls smoothly, which can
    // stall on load), and once more after images settle, unless the visitor has already started scrolling on their own
    const shared = location.pathname.match(/^\/marketing\/([^/]+)\/?$/);
    const tab = shared && tabs.find(t => t.dataset.study === shared[1]);
    if (tab) {
        show(tabs.indexOf(tab));
        const land = () => (root.closest('section') || root).scrollIntoView({ behavior: 'instant' });
        let moved = false;
        ['wheel', 'touchstart', 'keydown'].forEach(ev => addEventListener(ev, () => moved = true, { once: true, passive: true }));
        setTimeout(land, 0);
        if (document.readyState === 'complete') setTimeout(() => { if (!moved) land(); }, 400);
        else addEventListener('load', () => { if (!moved) land(); }, { once: true });
        // the decks above size themselves to the window, so a late reflow (fonts, a rotated phone) would leave the page somewhere
        // else: for the first few seconds, land again whenever the page changes height, until the visitor scrolls
        const until = Date.now() + 5000;
        const steady = new ResizeObserver(() => { if (moved || Date.now() > until) return steady.disconnect(); land(); });
        steady.observe(document.body);
    } else if (tabs[0].dataset.study && !root.dataset.study) {
        // nothing picked yet: the first study is the open one
        const title = slides[current].querySelector('[id^="mk-title-"]')?.textContent.trim() || tabs[current].textContent.trim();
        root.dataset.study = tabs[current].dataset.study;
        window.dispatchEvent(new CustomEvent('study:change', { detail: { study: root.dataset.study, title } }));
    }
});
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', projectCarousels); else projectCarousels();
