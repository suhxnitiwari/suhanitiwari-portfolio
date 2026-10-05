// Typed asides: <span class="aside-type" aria-hidden="true" data-text=" …totally bragging."></span>
// Each one waits until its sentence is fully on screen, gives you a beat to read it, then types itself on the end.
(() => {
    const asides = document.querySelectorAll('.aside-type[data-text]');
    if (!asides.length) return;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window);
    const wait = ms => new Promise(r => setTimeout(r, ms));

    async function type(aside) {
        const text = aside.dataset.text;
        const caret = document.createElement('i');
        caret.className = 'aside-caret typing';
        await wait(1800);
        aside.append(caret);
        await wait(700);
        for (let k = 1; k <= text.length; k++) {
            aside.textContent = text.slice(0, k);
            aside.append(caret);
            await wait(text[k - 1] === '…' ? 600 : 75);
        }
        caret.classList.remove('typing');
    }

    const seen = still ? null : new IntersectionObserver(entries => {
        for (const e of entries) {
            if (!e.isIntersecting) continue;
            seen.unobserve(e.target);
            type(e.target.querySelector('.aside-type'));
        }
    }, { threshold: 1 });

    asides.forEach(aside => {
        if (still) { aside.textContent = aside.dataset.text; return; }
        seen.observe(aside.parentElement);
    });
})();
