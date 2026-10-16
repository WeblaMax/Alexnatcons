/* ALEXNATCONS — cod comun pentru toate paginile */

/* Numărul de telefon se definește O SINGURĂ DATĂ, aici. */
const PHONE = '+373 606 21 387';
const PHONE_E164 = PHONE.replace(/[^\d+]/g, '');      // +37360621387
const PHONE_DIGITS = PHONE_E164.replace('+', '');     // 37360621387
const TEL_HREF = 'tel:' + PHONE_E164;
const VIBER_HREF = 'viber://chat?number=' + encodeURIComponent(PHONE_E164);
const waHref = msg => 'https://wa.me/' + PHONE_DIGITS + '?text=' + encodeURIComponent(msg);

(function () {
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  /* linkuri / texte de telefon */
  $$('[data-tel]').forEach(a => { a.href = TEL_HREF; });
  $$('[data-phone-text]').forEach(el => { el.textContent = PHONE; });
  $$('[data-wa]').forEach(a => {
    a.href = waHref(a.getAttribute('data-wa'));
    a.target = '_blank'; a.rel = 'noopener';
  });
  $$('[data-viber]').forEach(a => { a.href = VIBER_HREF; });

  /* Viber: dacă aplicația nu se deschide (pagina rămâne în prim-plan), cădem pe apel telefonic */
  document.addEventListener('click', e => {
    const a = e.target.closest('a[data-viber]');
    if (!a) return;
    let left = false;
    const leave = () => { left = true; };
    window.addEventListener('blur', leave, { once: true });
    document.addEventListener('visibilitychange', leave, { once: true });
    setTimeout(() => {
      window.removeEventListener('blur', leave);
      document.removeEventListener('visibilitychange', leave);
      if (!left && !document.hidden) location.href = TEL_HREF;
    }, 1500);
  });

  /* meniu mobil */
  const btn = document.getElementById('menuBtn');
  const nav = document.getElementById('nav');
  if (btn && nav) {
    const icon = btn.querySelector('path');
    const BURGER = 'M4 7h16M4 12h16M4 17h16', CLOSE = 'M6 6l12 12M18 6L6 18';
    const set = open => {
      nav.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open);
      btn.setAttribute('aria-label', open ? 'Închide meniul' : 'Deschide meniul');
      icon.setAttribute('d', open ? CLOSE : BURGER);
    };
    btn.addEventListener('click', () => set(!nav.classList.contains('open')));
    nav.addEventListener('click', e => { if (e.target.closest('a')) set(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('open')) { set(false); btn.focus(); } });
    window.matchMedia('(min-width:821px)').addEventListener('change', e => { if (e.matches) set(false); });
  }

  /* formularul de ofertă (doar pe index) */
  const quote = document.getElementById('quote');
  if (quote) quote.addEventListener('submit', e => {
    e.preventDefault();
    const n = document.getElementById('qname').value.trim(), ph = document.getElementById('qphone').value.trim();
    const done = document.getElementById('qdone');
    done.hidden = false;
    done.textContent = (!n || !ph)
      ? 'Completează numele și telefonul ca să te putem contacta.'
      : 'Mulțumim, ' + n + '. Cererea pentru „' + document.getElementById('qtype').value + '” e înregistrată — revenim la ' + ph + '.';
  });

  /* galerie: vizualizare mărită (lightbox) */
  const items = $$('.gallery .g-item a');
  if (items.length && typeof HTMLDialogElement === 'function') {
    const dlg = document.createElement('dialog');
    dlg.className = 'lightbox';
    dlg.setAttribute('aria-label', 'Galerie foto');
    dlg.innerHTML = '<button class="lb-btn lb-close" type="button" aria-label="Închide">×</button>' +
      '<button class="lb-btn lb-prev" type="button" aria-label="Poza anterioară">‹</button>' +
      '<figure class="lb-fig"><img alt=""><figcaption></figcaption></figure>' +
      '<button class="lb-btn lb-next" type="button" aria-label="Poza următoare">›</button>';
    document.body.appendChild(dlg);
    const img = dlg.querySelector('img'), cap = dlg.querySelector('figcaption');
    let cur = 0;
    const show = i => {
      cur = (i + items.length) % items.length;
      const a = items[cur], t = a.querySelector('img');
      img.src = a.href; img.alt = t.alt; cap.textContent = t.alt + ' (' + (cur + 1) + '/' + items.length + ')';
    };
    items.forEach((a, i) => a.addEventListener('click', e => { e.preventDefault(); show(i); dlg.showModal(); }));
    dlg.querySelector('.lb-close').addEventListener('click', () => dlg.close());
    dlg.querySelector('.lb-prev').addEventListener('click', () => show(cur - 1));
    dlg.querySelector('.lb-next').addEventListener('click', () => show(cur + 1));
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') show(cur - 1);
      if (e.key === 'ArrowRight') show(cur + 1);
    });
    let x0 = null;
    dlg.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
    dlg.addEventListener('touchend', e => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 50) show(cur + (dx < 0 ? 1 : -1));
    });
  }

  /* apariție discretă la scroll */
  const els = $$('.reveal');
  if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
  const io = new IntersectionObserver(es => es.forEach(en => {
    if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
  }), { threshold: .12 });
  els.forEach(e => io.observe(e));
  setTimeout(() => els.forEach(e => e.classList.add('in')), 4000);
})();
