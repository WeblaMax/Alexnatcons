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
    window.matchMedia('(min-width:1021px)').addEventListener('change', e => { if (e.matches) set(false); });
  }

  /* formularul de ofertă: se trimite prin WhatsApp la numărul firmei (PHONE) */
  const quote = document.getElementById('quote');
  if (quote) quote.addEventListener('submit', e => {
    e.preventDefault();
    const val = id => document.getElementById(id).value.trim();
    const n = val('qname'), ph = val('qphone'), type = document.getElementById('qtype').value, det = val('qmsg');
    const done = document.getElementById('qdone');
    done.hidden = false;
    if (!n || ph.replace(/\D/g, '').length < 6) {
      done.textContent = 'Completează numele și un număr de telefon valid, ca să te putem contacta.';
      return;
    }
    const msg = 'Bună ziua! Aș dori o ofertă.\n' +
      'Nume: ' + n + '\n' +
      'Telefon: ' + ph + '\n' +
      'Tip lucrare: ' + type +
      (det ? '\nDetalii: ' + det : '');
    const url = waHref(msg);
    const w = window.open(url, '_blank');
    if (w) w.opener = null;
    done.innerHTML = '';
    done.append('Se deschide WhatsApp cu mesajul gata scris. Apasă „Trimite” acolo ca să ajungă la noi. Dacă nu s-a deschis, ');
    const a = document.createElement('a');
    a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'apasă aici';
    done.append(a, '.');
    if (!w) done.append(' Sau sună-ne la ' + PHONE + '.');
  });

  /* galerii: pozele vin din galerie.json (se administrează din admin.html) */
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function renderGalleries(data) {
    /* pagini de servicii: grila cu poze */
    $$('[data-gallery]').forEach(box => {
      const list = data[box.dataset.gallery] || [];
      if (!list.length) {
        box.className = 'gallery-empty';
        box.innerHTML = '<p>Pozele vor fi adăugate în curând.</p><a class="btn" href="index.html#contact">Cere o ofertă →</a>';
        return;
      }
      box.innerHTML = list.map(p =>
        '<figure class="g-item"><a href="' + esc(p.src) + '" aria-label="Mărește poza: ' + esc(p.alt) + '">' +
        '<img src="' + esc(p.thumb) + '" alt="' + esc(p.alt) + '"' + (p.w ? ' width="' + p.w + '" height="' + p.h + '"' : '') +
        ' loading="lazy" decoding="async"></a></figure>').join('');
    });
    /* pagina de start: slideshow în cardurile de servicii (primele 6 poze) */
    $$('[data-slideshow][data-cat]').forEach(box => {
      const list = (data[box.dataset.cat] || []).slice(0, 6);
      if (!list.length) {
        const ico = box.parentNode.querySelector('svg.ico');
        if (ico) { const c = ico.cloneNode(true); c.setAttribute('class', 'ph-ico'); box.appendChild(c); }
        return;
      }
      box.classList.remove('svc-ph');
      box.innerHTML = list.map((p, i) => i === 0
        ? '<img class="is-active" src="' + esc(p.card || p.thumb) + '" alt="" width="520" height="390" decoding="async">'
        : '<img data-src="' + esc(p.card || p.thumb) + '" alt="" width="520" height="390" decoding="async">').join('') +
        (list.length > 1 ? '<span class="svc-dots" aria-hidden="true">' + '<i></i>'.repeat(list.length) + '</span>' : '');
    });
  }

  /* galerie: vizualizare mărită (lightbox) */
  function initLightbox() {
    const items = $$('.gallery .g-item a');
    if (!items.length || typeof HTMLDialogElement !== 'function') return;
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

  /* servicii: poze care se schimbă automat la 5 secunde în fiecare coloană */
  function initSlideshows() {
    if (reduce) return;
    $$('[data-slideshow]').forEach((box, bi) => {
      const imgs = $$('img', box), dots = $$('.svc-dots i', box);
      if (imgs.length < 2) return;
      let cur = 0;
      if (dots[0]) dots[0].classList.add('on');
      const load = img => new Promise(res => {
        if (img.getAttribute('src') || !img.dataset.src) return res();
        img.onload = img.onerror = () => res();
        img.src = img.dataset.src;
      });
      const next = async () => {
        if (document.hidden) return;
        const n = (cur + 1) % imgs.length;
        await load(imgs[n]);
        imgs[cur].classList.remove('is-active'); imgs[n].classList.add('is-active');
        if (dots[cur]) dots[cur].classList.remove('on');
        if (dots[n]) dots[n].classList.add('on');
        cur = n;
      };
      setTimeout(() => setInterval(next, 5000), bi * 700);   // coloanele nu se schimbă toate odată
    });
  }

  if ($$('[data-gallery],[data-slideshow][data-cat]').length) {
    fetch('galerie.json', { cache: 'no-cache' })
      .then(r => r.json())
      .then(d => { renderGalleries(d); initLightbox(); initSlideshows(); })
      .catch(() => {});
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
