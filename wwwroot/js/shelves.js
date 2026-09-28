// Shelves (Favorites and Make): the pop-up cards and the rows themselves.
// Each pop-up part only runs on the page that has its dialog.

// ===== Make: clicking a bake opens its recipe card =====
(function () {
    const dialog = document.getElementById('recipeCard');
    if (!dialog) return;
    const data = JSON.parse(document.getElementById('recipeData').textContent);
    const whisk = document.querySelector('.bake-whisk')?.outerHTML ?? '';
    const fill = (id, items) => {
        const list = document.getElementById(id);
        list.replaceChildren(...items.map(text => Object.assign(document.createElement('li'), { textContent: text })));
    };
    document.querySelectorAll('.bake-open[data-recipe]').forEach(button => {
        button.addEventListener('click', () => {
            const r = data[Number(button.dataset.recipe)];
            const kicker = document.getElementById('recipeKicker');
            if (kicker && button.dataset.kind) kicker.textContent = button.dataset.kind;
            const photo = document.getElementById('recipePhoto');
            if (r.Photo) {
                const img = Object.assign(document.createElement('img'), { src: r.Photo, alt: r.Title });
                photo.replaceChildren(img);
            } else {
                photo.innerHTML = whisk;
            }
            document.getElementById('recipeTitle').textContent = r.Title;
            document.getElementById('recipeLine').textContent = r.Line;
            document.getElementById('recipeMeta').textContent = [r.Time, r.Serves].filter(Boolean).join(', ');
            const hasRecipe = r.Steps.length > 0;
            document.getElementById('recipeSoon').hidden = hasRecipe;
            document.getElementById('recipeColumns').hidden = !hasRecipe;
            fill('recipeIngredients', r.Ingredients);
            fill('recipeSteps', r.Steps);
            dialog.showModal();
        });
    });
    dialog.querySelector('.recipe-close').addEventListener('click', () => dialog.close());
    // click outside the card closes it (Esc closes it too)
    dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
})();

// ===== Make > Traveling: clicking a trip opens its card of spots =====
document.querySelectorAll('.trip-open').forEach(button => {
    const dialog = document.getElementById(button.dataset.trip);
    if (!dialog) return;
    button.addEventListener('click', () => {
        if (button.closest('.shelf-rail').dataset.dragged) return;
        dialog.showModal();
    });
    dialog.querySelector('.recipe-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
});

// ===== Make > Digital Art: clicking a piece on the gallery wall shows it large =====
(function () {
    const dialog = document.getElementById('artCard');
    if (!dialog) return;
    const image = document.getElementById('artImage');
    document.querySelectorAll('.art-open').forEach(button => {
        button.addEventListener('click', () => {
            if (button.closest('.shelf-rail')?.dataset.dragged) return;
            image.src = button.dataset.image;
            image.alt = button.dataset.title;
            document.getElementById('artTitle').textContent = button.dataset.title;
            const idea = document.getElementById('artIdea');
            idea.textContent = button.dataset.idea;
            idea.hidden = !button.dataset.idea;
            // the cakes in the Baking row open here too: they get their own label and skip the art series note
            document.getElementById('artKicker').textContent = button.dataset.kind || 'Digital Art';
            document.getElementById('artNote').hidden = !!button.dataset.kind;
            dialog.showModal();
        });
    });
    dialog.querySelector('.recipe-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
})();

// ===== Make > Baking: the arrows flip through the cake gallery, one cake at a time =====
document.querySelectorAll('.cake-viewer').forEach(viewer => {
    const slides = [...viewer.querySelectorAll('.cake-slide')];
    let current = 0;
    const show = step => {
        slides[current].hidden = true;
        current = (current + step + slides.length) % slides.length;
        slides[current].hidden = false;
    };
    viewer.querySelector('.cake-arrow.prev')?.addEventListener('click', () => show(-1));
    viewer.querySelector('.cake-arrow.next')?.addEventListener('click', () => show(1));
});

// ===== Watch > Inspiration: clicking a video plays it in the pop-up =====
(function () {
    const dialog = document.getElementById('videoCard');
    if (!dialog) return;
    const frame = document.getElementById('videoFrame');
    document.querySelectorAll('.video-open').forEach(button => {
        button.addEventListener('click', () => {
            // a drag along the row shouldn't count as a click
            if (button.closest('.shelf-rail').dataset.dragged) return;
            const player = document.createElement('iframe');
            player.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(button.dataset.video)}?autoplay=1&rel=0`;
            player.title = button.dataset.title;
            player.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
            player.allowFullscreen = true;
            player.referrerPolicy = 'strict-origin-when-cross-origin';
            frame.replaceChildren(player);
            document.getElementById('videoTitle').textContent = button.dataset.title;
            document.getElementById('videoMeta').textContent = button.dataset.meta;
            dialog.showModal();
        });
    });
    dialog.querySelector('.recipe-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
    // removing the player stops the sound when the pop-up closes (button, click outside, or Esc)
    dialog.addEventListener('close', () => frame.replaceChildren());
})();

// ===== Watch > Inspiration: topic buttons show just that topic's talks =====
// All: one scrolling row led by the mulberry card. A topic: a 3-column grid led by its "Why I value…" card
// (if it has one), or a "coming soon" tile for a topic with no talks yet.
document.querySelectorAll('.video-topics').forEach(group => {
    const shelf = group.closest('.shelf');
    const rail = shelf.querySelector('.shelf-rail');
    const items = [...rail.querySelectorAll('.shelf-item')];
    const talks = items.filter(item => !item.matches('.why-item, .soon-item'));
    const seeAll = shelf.querySelector('.shelf-see-all');
    group.querySelectorAll('.video-topic-btn').forEach(btn => btn.addEventListener('click', () => {
        const topic = btn.dataset.topic;
        group.querySelectorAll('.video-topic-btn').forEach(b => b.setAttribute('aria-pressed', b === btn));
        items.forEach(item => {
            if (item.classList.contains('why-item')) item.hidden = item.dataset.why !== topic;
            else if (item.classList.contains('soon-item')) item.hidden = item.dataset.topic !== topic;
            else item.hidden = topic !== '' && item.dataset.topic !== topic;
        });
        shelf.classList.toggle('filtered', topic !== '');
        if (seeAll) {
            const shown = talks.filter(item => !item.hidden).length;
            seeAll.dataset.count = shown;
            seeAll.hidden = topic !== '' || shown <= 3;
            if (!shelf.classList.contains('expanded')) seeAll.textContent = `See all ${shown} →`;
        }
        rail.scrollLeft = 0;
        // let the arrows re-check whether there's anything to scroll to
        rail.dispatchEvent(new Event('scroll'));
    }));
});

// ===== Watch: "View more awesome recs" reveals the rest of the rows =====
document.querySelectorAll('.watch-more-btn').forEach(btn => {
    const more = document.getElementById(btn.getAttribute('aria-controls'));
    btn.addEventListener('click', () => {
        const open = more.hidden;
        more.hidden = !open;
        btn.setAttribute('aria-expanded', open);
        btn.textContent = open ? 'Okayyy Suhani, I’ve seen enough of your “taste” ↑' : 'View more awesome recs ↓';
        // the rows were hidden when the page loaded, so let their arrows measure again
        if (open) window.dispatchEvent(new Event('resize'));
        else btn.closest('section').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
});

// ===== Shelves: drag to scroll, arrows, "See all" =====
document.querySelectorAll('.shelf').forEach(shelf => {
    const rail = shelf.querySelector('.shelf-rail');
    if (!rail) return; // an empty shelf (just a note) has nothing to scroll
    const prev = shelf.querySelector('.shelf-arrow.prev');
    const next = shelf.querySelector('.shelf-arrow.next');
    const seeAll = shelf.querySelector('.shelf-see-all');
    const step = () => {
        const item = rail.querySelector('.shelf-item');
        return item ? item.offsetWidth + parseFloat(getComputedStyle(rail).columnGap) : 200;
    };

    // Arrows: center them on the covers, hide the one at each end
    const update = () => {
        const cover = rail.querySelector('.shelf-cover');
        if (cover) shelf.style.setProperty('--cover-height', `${cover.offsetHeight}px`);
        prev.disabled = rail.scrollLeft <= 2;
        next.disabled = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 2;
    };
    prev.addEventListener('click', () => rail.scrollBy({ left: -step() * 2, behavior: 'smooth' }));
    next.addEventListener('click', () => rail.scrollBy({ left: step() * 2, behavior: 'smooth' }));
    rail.addEventListener('scroll', update, { passive: true });
    // a drag along the row shouldn't open whatever card it ends on
    rail.addEventListener('click', e => {
        if (rail.dataset.dragged) { e.preventDefault(); e.stopPropagation(); }
    }, true);
    window.addEventListener('resize', update);
    update();

    // Click-and-drag with a mouse (touch and trackpads scroll natively)
    let drag = null;
    rail.addEventListener('pointerdown', e => {
        if (e.pointerType !== 'mouse' || e.button !== 0 || shelf.classList.contains('expanded')) return;
        drag = { x: e.clientX, left: rail.scrollLeft, moved: false };
    });
    window.addEventListener('pointermove', e => {
        if (!drag) return;
        const dx = e.clientX - drag.x;
        if (!drag.moved && Math.abs(dx) > 4) {
            drag.moved = true;
            rail.classList.add('dragging');
        }
        if (drag.moved) rail.scrollLeft = drag.left - dx;
    });
    window.addEventListener('pointerup', () => {
        if (!drag) return;
        if (drag.moved) {
            // Let the row settle neatly on a cover again
            const left = rail.scrollLeft;
            rail.classList.remove('dragging');
            rail.scrollLeft = left;
            rail.scrollTo({ left: Math.round(left / step()) * step(), behavior: 'smooth' });
            // the click that follows a drag isn't a real click
            rail.dataset.dragged = '1';
            setTimeout(() => delete rail.dataset.dragged, 0);
        }
        drag = null;
    });

    // Keyboard: arrow keys move the focused row
    rail.addEventListener('keydown', e => {
        if (e.key === 'ArrowRight') { e.preventDefault(); rail.scrollBy({ left: step(), behavior: 'smooth' }); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); rail.scrollBy({ left: -step(), behavior: 'smooth' }); }
    });

    // "See all" opens the row into the whole collection, and back
    seeAll?.addEventListener('click', () => {
        const expanded = shelf.classList.toggle('expanded');
        seeAll.setAttribute('aria-expanded', expanded);
        seeAll.textContent = expanded ? 'Back to one row ←' : `See all ${seeAll.dataset.count} →`;
        rail.scrollLeft = 0;
        update();
    });
});

// ===== Digital Art: the wall slides sideways; the arrows move it most of a screen at a time =====
(function () {
    const wall = document.querySelector('.gallery-wall');
    if (!wall) return;
    const wrap = wall.closest('.gallery-wall-wrap');
    const prev = wrap.querySelector('.shelf-arrow.prev');
    const next = wrap.querySelector('.shelf-arrow.next');
    const update = () => {
        prev.disabled = wall.scrollLeft <= 2;
        next.disabled = wall.scrollLeft + wall.clientWidth >= wall.scrollWidth - 2;
    };
    const slide = dir => wall.scrollBy({ left: dir * wall.clientWidth * 0.7, behavior: 'smooth' });
    prev.addEventListener('click', () => slide(-1));
    next.addEventListener('click', () => slide(1));
    wall.addEventListener('keydown', e => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); slide(e.key === 'ArrowLeft' ? -1 : 1); }
    });
    wall.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
})();
