// The story layer on the home page: numbers that count up, chapter bands that follow the cursor,
// threads that light up their connections, the chapter rail, / search, and the two guides.
// Everything it reads comes from the page itself (Views/Home/Index.cshtml), so adding a chapter,
// a number or a project there is all it takes for the rail and the search to know about it.
(() => {
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mouse = matchMedia('(hover: hover) and (pointer: fine)').matches;
    const chapters = [...document.querySelectorAll('.chapter')];
    if (!chapters.length) return;
    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
    const clean = el => (el?.textContent || '').replace(/\s+/g, ' ').trim();
    const behavior = calm ? 'auto' : 'smooth';

    // the chapter something sits in: the last chapter opener before it on the page
    const chapterOf = el => {
        let found = null;
        for (const ch of chapters) if (ch === el || ch.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) found = ch;
        return found;
    };
    const chapterName = el => { const ch = chapterOf(el); return ch ? ch.dataset.short : 'Prologue'; };

    // ===== Numbers count up from zero the first time they're on screen =====
    const fmt = (n, places) => n.toLocaleString('en-US', { minimumFractionDigits: places, maximumFractionDigits: places });
    const countUp = el => {
        const to = parseFloat(el.dataset.count), places = (el.dataset.count.split('.')[1] || '').length;
        const before = el.dataset.prefix || '', after = el.dataset.suffix || '', final = el.textContent;
        const t0 = performance.now(), ms = 1500;
        const step = now => {
            const p = Math.min(1, (now - t0) / ms), eased = 1 - Math.pow(1 - p, 3);
            el.textContent = p < 1 ? before + fmt(to * eased, places) + after : final;
            if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    };
    if (!calm && 'IntersectionObserver' in window) {
        const seen = new IntersectionObserver(entries => entries.forEach(e => {
            if (!e.isIntersecting) return;
            seen.unobserve(e.target);
            countUp(e.target);
        }), { threshold: 0.6 });
        $$('.st-num[data-count]').forEach(n => seen.observe(n));
    }

    // ===== The cursor: a glow follows it across each chapter band, the place name catches the light,
    // and each number leans toward it =====
    if (mouse && !calm) {
        chapters.forEach(ch => {
            const place = $('.chapter-place', ch);
            ch.addEventListener('pointermove', e => {
                const box = ch.getBoundingClientRect(), p = place.getBoundingClientRect();
                ch.style.setProperty('--mx', `${e.clientX - box.left}px`);
                ch.style.setProperty('--my', `${e.clientY - box.top}px`);
                place.style.setProperty('--px', `${e.clientX - p.left}px`);
                place.style.setProperty('--py', `${e.clientY - p.top}px`);
            });
        });
        $$('.st').forEach(st => {
            st.addEventListener('pointermove', e => {
                const box = st.getBoundingClientRect();
                st.style.setProperty('--tx', ((e.clientX - box.left) / box.width - 0.5) * 2);
                st.style.setProperty('--ty', ((e.clientY - box.top) / box.height - 0.5) * 2);
            });
            st.addEventListener('pointerleave', () => { st.style.setProperty('--tx', 0); st.style.setProperty('--ty', 0); });
        });
    }

    // ===== Threads: hovering a number (or a thread on the rail) lights everything it connects to =====
    const THREADS = { people: 'Understanding people', make: 'Making things', start: 'Starting things' };
    const tip = document.createElement('div');
    tip.className = 'story-tip';
    tip.setAttribute('aria-hidden', 'true');
    document.body.appendChild(tip);
    let pinned = null;

    const setThread = t => {
        if (t) document.body.dataset.thread = t;
        else if (pinned) document.body.dataset.thread = pinned;
        else delete document.body.dataset.thread;
    };
    const connections = (t, except) => $$(`.st[data-thread="${t}"], .about-story[data-thread="${t}"]`).filter(x => x !== except);
    const describe = x => x.classList.contains('st')
        ? `${clean($('.st-num', x))} ${clean($('.st-label', x))}`
        : clean($('h3', x));
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

    const showTip = (st, x, y) => {
        const t = st.dataset.thread;
        const links = t ? connections(t, st) : [];
        tip.innerHTML = `<b>Where this comes from</b>${esc(st.dataset.source)}` +
            (links.length ? `<b style="margin-top:8px">Same thread: ${esc(THREADS[t].toLowerCase())}</b><ul>` +
                links.slice(0, 4).map(l => `<li>${esc(describe(l))} <i>(${esc(chapterName(l))})</i></li>`).join('') + '</ul>' : '');
        tip.classList.add('on');
        placeTip(x, y);
    };
    const placeTip = (x, y) => {
        const w = tip.offsetWidth, h = tip.offsetHeight;
        tip.style.left = `${Math.min(innerWidth - w - 12, x + 16)}px`;
        tip.style.top = `${y + h + 24 > innerHeight ? y - h - 14 : y + 18}px`;
    };
    const hideTip = () => tip.classList.remove('on');

    $$('.st').forEach(st => {
        st.addEventListener('pointerenter', e => { setThread(st.dataset.thread); showTip(st, e.clientX, e.clientY); });
        st.addEventListener('pointermove', e => placeTip(e.clientX, e.clientY));
        st.addEventListener('pointerleave', () => { setThread(null); hideTip(); });
        st.addEventListener('focus', () => { const r = st.getBoundingClientRect(); setThread(st.dataset.thread); showTip(st, r.left, r.bottom - 10); });
        st.addEventListener('blur', () => { setThread(null); hideTip(); });
    });

    $$('.thread-chip').forEach(chip => {
        const t = chip.dataset.threadKey;
        chip.addEventListener('pointerenter', () => setThread(t));
        chip.addEventListener('pointerleave', () => setThread(null));
        chip.addEventListener('focus', () => setThread(t));
        chip.addEventListener('blur', () => setThread(null));
        // a click keeps a thread lit while you scroll the whole story
        chip.addEventListener('click', () => {
            pinned = pinned === t ? null : t;
            $$('.thread-chip').forEach(c => c.setAttribute('aria-pressed', c.dataset.threadKey === pinned));
            setThread(pinned);
        });
    });

    // ===== Flying somewhere: open whatever hides it (a closed tab, "a little more about me"), then glide there =====
    const reveal = el => {
        for (let a = el; a && a !== document.body; a = a.parentElement) {
            if (a.tagName === 'DETAILS') a.open = true;
            if (!a.hidden) continue;
            if (a.id === 'moreAboutMe') $('.come-far')?.click();
            else if (a.getAttribute('role') === 'tabpanel') $(`[aria-controls="${a.id}"]`)?.click();
        }
    };
    const fly = (el, flashEl = el) => {
        if (!el) return;
        reveal(el);
        requestAnimationFrame(() => {
            el.scrollIntoView({ behavior, block: el.classList.contains('chapter') || el.tagName === 'SECTION' ? 'start' : 'center' });
            flashEl.classList.remove('seek-flash');
            void flashEl.offsetWidth;
            flashEl.classList.add('seek-flash');
            flashEl.addEventListener('animationend', () => flashEl.classList.remove('seek-flash'), { once: true });
        });
    };

    // a number's link goes to where it comes from
    $$('.st[href^="#"]').forEach(st => st.addEventListener('click', e => {
        const target = document.getElementById(st.getAttribute('href').slice(1));
        if (!target) return;
        e.preventDefault();
        hideTip();
        history.replaceState(null, '', st.getAttribute('href'));
        fly(target, target);
    }));

    // ===== The rail: which chapter you're in, how far through the story you are =====
    const rail = $('.rail');
    if (rail) {
        const dots = $$('.rail-ch', rail);
        const fill = $('.rail-fill', rail);
        let ticking = false;
        const update = () => {
            ticking = false;
            const first = chapters[0].getBoundingClientRect().top + scrollY;
            const end = document.documentElement.scrollHeight - innerHeight;
            rail.classList.toggle('show', scrollY > first - innerHeight * 0.6);
            let now = -1;
            chapters.forEach((ch, i) => { if (ch.getBoundingClientRect().top <= innerHeight * 0.4) now = i; });
            dots.forEach((d, i) => {
                d.classList.toggle('read', i <= now);
                d.classList.toggle('now', i === now);
                if (i === now) d.setAttribute('aria-current', 'step'); else d.removeAttribute('aria-current');
            });
            fill.style.setProperty('--read', Math.min(1, Math.max(0, (scrollY - first + innerHeight * 0.4) / Math.max(1, end - first + innerHeight * 0.4))).toFixed(4));
        };
        addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
        addEventListener('resize', update);
        update();
        dots.forEach(d => d.addEventListener('click', e => {
            e.preventDefault();
            const target = document.getElementById(d.getAttribute('href').slice(1));
            history.replaceState(null, '', d.getAttribute('href'));
            target?.scrollIntoView({ behavior, block: 'start' });
        }));
    }

    // ===== The two guides =====
    const docs = { read: $('#storyRead'), build: $('#storyBuild') };
    Object.values(docs).forEach(d => {
        if (!d) return;
        $('.doc-close', d)?.addEventListener('click', () => d.close());
        d.addEventListener('click', e => { if (e.target === d) d.close(); });
    });
    const openDoc = name => {
        $$('dialog[open]').forEach(d => d.close());
        docs[name]?.showModal();
    };

    // ===== Search: press / (or ⌘K), type, and fly =====
    const seek = $('#seek');
    const input = $('.seek-input', seek);
    const list = $('.seek-list', seek);
    let index = null, results = [], active = 0;

    const link = (label, kind, href, external = true) => ({ label, kind, where: external ? 'Opens a new tab' : '', go: () => external ? window.open(href, '_blank', 'noopener') : location.assign(href) });
    const build = () => {
        const items = [];
        const add = (label, kind, el, flashEl) => {
            label = label.replace(/\s*[↗→↓]\s*$/, '').trim();
            if (label && label.length > 1) items.push({ label: label.length > 90 ? label.slice(0, 88) + '…' : label, kind, where: chapterName(el), go: () => fly(el, flashEl || el) });
        };
        chapters.forEach(ch => add(`${ch.dataset.num} · ${ch.dataset.place}: ${clean($('.chapter-title', ch))}`, 'Chapter', ch, $('.chapter-place', ch)));
        $$('.st').forEach(st => add(`${clean($('.st-num', st))} ${clean($('.st-label', st))}`, 'Number', st));
        $$('.job').forEach(job => add(`${clean($('.job-company', job))} · ${clean($('h3', job))}`, 'Experience', job));
        $$('.best-story').forEach(p => add(clean($('.best-title', p)), 'Project', p));
        $$('.edu-courses li').forEach(li => add(clean(li), 'Class', li));
        $$('main h2, main h3').forEach(h => {
            if (h.closest('dialog, .chapter, .job, .best-story, .about-tagline, .opening, .rail, .sitara, .quiz')) return;
            add(clean(h), h.tagName === 'H2' ? 'Section' : 'Topic', h);
        });
        $$('.kn-front').forEach(f => add(clean(f), 'Card', f.closest('.kn-item') || f));
        // tabs (Why MIS / Why McCombs, the coursework tabs): open the tab, then fly to it
        $$('main [role="tab"]').forEach(tab => {
            const label = clean(tab);
            if (label) items.push({ label, kind: 'Tab', where: chapterName(tab), go: () => { reveal(tab); tab.click(); fly(tab); } });
        });
        items.push(
            { label: 'How to read this', kind: 'Guide', where: 'Press ?', go: () => openDoc('read') },
            { label: 'How I built this', kind: 'Guide', where: 'The case study', go: () => openDoc('build') },
            { label: 'The quiz: How Well Do You Know Me?', kind: 'Game', where: 'Ch 04 · Home', go: () => fly($('.quiz-col')) },
            link('Résumé', 'Link', '/resume'),
            link('Heavy Rotation: four years of my Spotify listening', 'Link', 'https://suhxnitiwari.github.io/listening-galaxy/'),
            link('How I Work', 'Link', 'https://suhxnitiwari.github.io/how-i-work/'),
            link('GitHub', 'Link', 'https://github.com/suhxnitiwari'),
            link('LinkedIn', 'Link', 'https://www.linkedin.com/in/suhxnitiwari/'),
            link('Email me', 'Link', 'mailto:suhxnitiwari@gmail.com', false)
        );
        const seenLabels = new Set();
        return items.filter(it => { const key = it.kind + it.label.toLowerCase(); if (seenLabels.has(key)) return false; seenLabels.add(key); return true; });
    };

    // a word scores best at the start of the label, then at the start of any word, then anywhere, then as
    // initials ("gwc" finds Girls Who Code), then as letters in order close together ("rdflw" finds RideFlow).
    // Every word you type has to match.
    const scoreWord = (w, text) => {
        const at = text.indexOf(w);
        if (at === 0) return 100;
        if (at > 0) return /[\s\-·:(]/.test(text[at - 1]) ? 80 : 50;
        if (w.length > 1 && text.split(/[\s\-·:()&,.]+/).map(x => x[0] || '').join('').includes(w)) return 70;
        let i = 0, first = -1, last = -1;
        for (let j = 0; j < text.length && i < w.length; j++) if (text[j] === w[i]) { if (first < 0) first = j; last = j; i++; }
        return i === w.length && last - first < w.length * 2 ? 20 : -1;
    };
    const score = (q, it) => {
        const text = it.label.toLowerCase(), kind = it.kind.toLowerCase();
        let total = 0;
        for (const w of q.split(/\s+/).filter(Boolean)) {
            const s = Math.max(scoreWord(w, text), kind.startsWith(w) ? 40 : -1);
            if (s < 0) return -1;
            total += s;
        }
        return total - text.length / 100;
    };
    const highlight = (label, q) => {
        let html = esc(label);
        q.split(/\s+/).filter(w => w.length > 1).forEach(w => {
            const re = new RegExp(`(${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig');
            html = html.replace(re, '<mark>$1</mark>');
        });
        return html;
    };

    const render = () => {
        index = index || build();
        const q = input.value.trim().toLowerCase();
        results = q
            ? index.map(it => ({ it, s: score(q, it) })).filter(r => r.s >= 0).sort((a, b) => b.s - a.s).slice(0, 40).map(r => r.it)
            : index.filter(it => it.kind === 'Chapter' || it.kind === 'Guide' || it.label === 'Résumé');
        active = 0;
        list.innerHTML = results.length
            ? results.map((it, i) => `<li class="seek-item" role="option" id="seek-${i}" aria-selected="${i === 0}"><span class="seek-kind">${esc(it.kind)}</span><span class="seek-label">${highlight(it.label, q)}</span><span class="seek-where">${esc(it.where)}</span></li>`).join('')
            : `<li class="seek-empty">Nothing called “${esc(input.value.trim())}” yet. Try a project, a class, a city or a number.</li>`;
        input.setAttribute('aria-activedescendant', results.length ? 'seek-0' : '');
    };
    const move = to => {
        if (!results.length) return;
        active = (to + results.length) % results.length;
        $$('.seek-item', list).forEach((li, i) => li.setAttribute('aria-selected', i === active));
        input.setAttribute('aria-activedescendant', `seek-${active}`);
        $(`#seek-${active}`, list)?.scrollIntoView({ block: 'nearest' });
    };
    const choose = i => {
        const it = results[i];
        if (!it) return;
        seek.close();
        it.go();
    };
    const openSeek = () => {
        $$('dialog[open]').forEach(d => d.close());
        index = index || build();
        input.value = '';
        render();
        seek.showModal();
        input.focus();
    };

    if (seek) {
        input.addEventListener('input', render);
        input.addEventListener('keydown', e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); move(active + 1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); move(active - 1); }
            else if (e.key === 'Enter') { e.preventDefault(); choose(active); }
        });
        list.addEventListener('pointermove', e => { const li = e.target.closest('.seek-item'); if (li) move(+li.id.slice(5)); });
        list.addEventListener('click', e => { const li = e.target.closest('.seek-item'); if (li) choose(+li.id.slice(5)); });
        seek.addEventListener('click', e => { if (e.target === seek) seek.close(); });
        // the page may change after the first search (the quiz opens, a tab switches), so look again next time
        seek.addEventListener('close', () => { index = null; });
    }

    $$('[data-open]').forEach(b => {
        b.hidden = false;
        b.addEventListener('click', () => b.dataset.open === 'seek' ? openSeek() : openDoc(b.dataset.open));
    });

    addEventListener('keydown', e => {
        if (document.documentElement.classList.contains('opening-on')) return;
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSeek(); return; }
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (e.target.closest?.('input, textarea, select, [contenteditable="true"]') || $('dialog[open]')) return;
        if (e.key === '/') { e.preventDefault(); openSeek(); }
        else if (e.key === '?') { e.preventDefault(); openDoc('read'); }
    });
})();
