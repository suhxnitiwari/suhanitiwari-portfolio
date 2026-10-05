// Download the list: each trip card can save its spots as a one-page PDF to keep on your phone while you travel.
// The list is read straight from the card, and every spot name opens Google Maps.
// jsPDF only loads the first time someone asks for a list.
(() => {
    const LIB = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/4.2.1/jspdf.umd.min.js';
    const SRI = 'sha384-qovJwSBbRDPP5cEjCp8S0UP66wrvnjaa60XMOGzTNanrThcrGfXfnZkvgY8N1KT3';
    let loading;

    const loadLib = () => loading ??= new Promise((resolve, reject) => {
        const s = Object.assign(document.createElement('script'), { src: LIB, integrity: SRI, crossOrigin: 'anonymous' });
        s.onload = () => resolve(window.jspdf.jsPDF);
        s.onerror = () => { loading = null; reject(new Error('jsPDF failed to load')); };
        document.head.append(s);
    });

    // the PDF's built-in fonts don't have curly quotes, so they go straight
    const plain = t => t.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').trim();

    const readCard = card => ({
        city: plain(card.querySelector('h2').textContent),
        spots: [...card.querySelectorAll('.trip-spot')].map(li => {
            const h3 = li.querySelector('h3');
            const must = h3.querySelector('.trip-must');
            return {
                name: plain([...h3.childNodes].filter(n => n !== must).map(n => n.textContent).join('')),
                must: !!must,
                kind: plain(li.querySelector('.trip-kind')?.textContent ?? ''),
                line: plain(li.querySelector('.trip-kind + p')?.textContent ?? '')
            };
        })
    });

    const build = (jsPDF, { city, spots }) => {
        const doc = new jsPDF({ unit: 'pt', format: 'letter' });
        const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
        const M = 64, text = W - M * 2 - 44;
        const wine = [126, 63, 74], ink = [30, 16, 10], sage = [107, 127, 94], mute = [90, 71, 64], rule = [235, 213, 208];
        let y = M;

        const footer = () => {
            doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...mute);
            doc.text('suhanitiwari.com', M, H - 36);
            doc.text('Tap a name to open it in Google Maps', W - M, H - 36, { align: 'right' });
        };

        doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...wine);
        doc.setCharSpace(2.5).text('TRAVELING', M, y).setCharSpace(0);
        y += 34;
        doc.setFont('times', 'normal').setFontSize(34).setTextColor(...ink);
        doc.text(`My ${city} Edit`, M, y);
        y += 22;
        doc.setFont('helvetica', 'italic').setFontSize(11).setTextColor(...mute);
        doc.text(`The ${spots.length} spots I'd send you to`, M, y);
        y += 26;

        spots.forEach((s, i) => {
            const lines = s.line ? doc.setFontSize(10.5).splitTextToSize(s.line, text) : [];
            const need = 50 + lines.length * 15;
            if (y + need > H - 64) { footer(); doc.addPage(); y = M; }

            doc.setDrawColor(...rule).setLineWidth(0.75).line(M, y, W - M, y);
            y += 26;
            doc.setFont('times', 'normal').setFontSize(13).setTextColor(...wine);
            doc.text(String(i + 1).padStart(2, '0'), M, y);

            const x = M + 44;
            doc.setFont('times', 'normal').setFontSize(15).setTextColor(...ink);
            doc.textWithLink(s.name, x, y, { url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${s.name}, ${city}`)}` });
            if (s.must) {
                const bx = x + doc.getTextWidth(s.name) + 8;
                doc.setFont('helvetica', 'bold').setFontSize(7).setTextColor(...wine);
                doc.text('MUST DO', bx, y - 1);
            }
            y += 15;
            if (s.kind) {
                doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(...sage);
                doc.setCharSpace(1).text(s.kind.toUpperCase(), x, y).setCharSpace(0);
                y += 16;
            }
            if (lines.length) {
                doc.setFont('helvetica', 'normal').setFontSize(10.5).setTextColor(...mute);
                doc.text(lines, x, y, { lineHeightFactor: 1.45 });
                y += lines.length * 15.2;
            }
            y += 8;
        });
        footer();
        doc.save(`Suhani-${city.replace(/\s+/g, '-')}-Edit.pdf`);
    };

    document.querySelectorAll('.trip-download').forEach(btn => btn.addEventListener('click', async () => {
        const label = btn.querySelector('.trip-download-label');
        const was = label.dataset.text ??= label.textContent;
        btn.disabled = true;
        label.textContent = 'Making your list…';
        try {
            build(await loadLib(), readCard(btn.closest('.trip-card')));
            label.textContent = was;
        } catch {
            label.textContent = 'Couldn’t download. Try again';
        } finally {
            btn.disabled = false;
        }
    }));
})();
