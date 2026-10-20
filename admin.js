/* Administrare poze — ALEXNATCONS
   Fără server: pozele și galerie.json se salvează direct în repo-ul GitHub al site-ului,
   printr-un singur commit (API GitHub "Git Data"). GitHub Pages publică site-ul în 1–2 minute.

   Dacă repo-ul se mută sau se redenumește, schimbă doar REPO de mai jos. */
(function () {
  'use strict';

  const REPO = { owner: 'WeblaMax', name: 'Alexnatcons', branch: 'main' };
  const CATS = {
    'constructii-civile': 'Construcții civile',
    'apa-canalizare': 'Apă și canalizare',
    'demolari': 'Demolări',
    'lucrari-teren': 'Lucrări de Terasament',
    'utilaje': 'Utilaje de Construcții',
    'dispozitive-vulcanizare': 'Vulcanizare pentru utilaje grele',
    'sertizare-furtunuri': 'Sertizarea furtunurilor hidraulice'
  };
  const SIZES = { full: 1600, thumb: 720, card: 520 };
  const PROD_SIZE = 900, PROD_Q = 0.8;                 // poza unui produs (un singur fișier)   // latura maximă, px
  const QUALITY = { full: 0.8, thumb: 0.76, card: 0.7 };
  const TOKEN_KEY = 'anc-admin-token';

  const $ = id => document.getElementById(id);
  const api = 'https://api.github.com/repos/' + REPO.owner + '/' + REPO.name;
  let token = '';
  let data = {};            // galerie.json curent (cu modificările din panou)
  let removed = {};         // { cat: [item, …] } pozele marcate pentru ștergere
  let added = {};           // { cat: [{files, alt, …}] } pozele noi, încă nepublicate
  let busy = false;
  let prod = [];            // produse.json curent
  let pAdded = {};          // { idProdus: { o:{main:{blob,w,h}}, preview } } poze noi pentru produse
  let pRemoved = {};        // { idProdus: true } poza produsului se scoate
  let pDirty = false;       // s-a schimbat lista de produse (adăugat / editat / șters / mutat)
  let pDeleted = [];        // poze de produse de șters din repo (produse șterse)
  let mode = 'gal';         // 'gal' (poze lucrări) | 'prod' (poze produse)

  /* ---------- GitHub API ---------- */
  async function gh(path, opts) {
    opts = opts || {};
    const res = await fetch(api + path, {
      method: opts.method || 'GET',
      headers: Object.assign({
        'Accept': 'application/vnd.github+json',
        'Authorization': 'Bearer ' + token,
        'X-GitHub-Api-Version': '2022-11-28'
      }, opts.body ? { 'Content-Type': 'application/json' } : {}),
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    if (!res.ok) {
      let m = '';
      try { m = (await res.json()).message || ''; } catch (e) { /* ignorat */ }
      const err = new Error(res.status + (m ? ' — ' + m : ''));
      err.status = res.status;
      throw err;
    }
    return res.status === 204 ? null : res.json();
  }

  const b64utf8 = s => btoa(String.fromCharCode.apply(null, new TextEncoder().encode(s)));
  const fromB64utf8 = b => new TextDecoder().decode(Uint8Array.from(atob(b.replace(/\s/g, '')), c => c.charCodeAt(0)));

  function blobToB64(blob) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(',')[1]);
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
  }

  /* ---------- Mesaje ---------- */
  function say(el, text, kind) { el.textContent = text; el.className = 'adm-msg' + (kind ? ' ' + kind : ''); }

  /* ---------- Conectare ---------- */
  async function connect(t) {
    token = t.trim();
    if (!token) { say($('login-msg'), 'Introdu tokenul.', 'err'); return false; }
    say($('login-msg'), 'Se verifică…');
    try {
      const repo = await gh('');
      if (repo.permissions && !repo.permissions.push) throw new Error('Tokenul nu are voie să scrie în repo (Contents: Read and write).');
      await loadData();
    } catch (e) {
      token = '';
      localStorage.removeItem(TOKEN_KEY);
      say($('login-msg'), e.status === 401 ? 'Token invalid sau expirat.' :
        e.status === 404 ? 'Tokenul nu vede repo-ul ' + REPO.owner + '/' + REPO.name + '.' : 'Eroare: ' + e.message, 'err');
      return false;
    }
    try { localStorage.setItem(TOKEN_KEY, token); } catch (e) { /* ignorat */ }
    $('login').hidden = true; $('panel').hidden = false; $('logout').hidden = false;
    renderAll();
    return true;
  }

  async function loadData() {
    const f = await gh('/contents/galerie.json?ref=' + encodeURIComponent(REPO.branch) + '&_=' + Date.now());
    data = JSON.parse(fromB64utf8(f.content));
    Object.keys(CATS).forEach(k => { if (!Array.isArray(data[k])) data[k] = []; });
    const pf = await gh('/contents/produse.json?ref=' + encodeURIComponent(REPO.branch) + '&_=' + Date.now());
    prod = JSON.parse(fromB64utf8(pf.content));
    removed = {}; added = {}; pAdded = {}; pRemoved = {}; pDirty = false; pDeleted = [];
  }

  /* ---------- Procesare poze (în browser) ---------- */
  async function resize(bitmap, max, q) {
    const k = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * k), h = Math.round(bitmap.height * k);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(bitmap, 0, 0, w, h);
    let blob = await new Promise(r => c.toBlob(r, 'image/webp', q));
    if (!blob || blob.type !== 'image/webp') blob = await new Promise(r => c.toBlob(r, 'image/jpeg', q));   // rezervă
    return { blob, w, h };
  }

  async function processFile(file) {
    const bmp = await createImageBitmap(file);      // respectă orientarea din telefon
    const out = {};
    for (const k of Object.keys(SIZES)) out[k] = await resize(bmp, SIZES[k], QUALITY[k]);
    if (bmp.close) bmp.close();
    return out;
  }

  async function addFiles(fileList) {
    const cat = $('cat').value;
    const files = Array.from(fileList).filter(f => /^image\//.test(f.type));
    if (!files.length) { say($('msg'), 'Alege fișiere de tip imagine.', 'err'); return; }
    busy = true;
    for (let i = 0; i < files.length; i++) {
      say($('msg'), 'Se procesează poza ' + (i + 1) + ' din ' + files.length + '…');
      try {
        const o = await processFile(files[i]);
        (added[cat] = added[cat] || []).push({
          o, alt: '', preview: URL.createObjectURL(o.thumb.blob), name: files[i].name
        });
      } catch (e) {
        say($('msg'), 'Nu pot citi „' + files[i].name + '” (' + e.message + ').', 'err');
      }
    }
    busy = false;
    say($('msg'), '');
    renderList();
  }

  /* ---------- Afișare ---------- */
  function renderAll() {
    const sel = $('cat');
    if (!sel.options.length) Object.keys(CATS).forEach(k => sel.add(new Option(CATS[k], k)));
    renderList();
    renderNewForm();
    renderProducts();
  }

  function pendingCount() {
    let n = 0;
    Object.keys(added).forEach(k => n += added[k].length);
    Object.keys(removed).forEach(k => n += removed[k].length);
    return n;
  }

  function renderList() {
    const cat = $('cat').value;
    const list = $('list');
    list.innerHTML = '';
    const cur = data[cat] || [];
    const rem = removed[cat] || [];
    const add = added[cat] || [];

    cur.forEach((p, i) => {
      const li = document.createElement('li');
      li.className = 'adm-item';
      li.innerHTML = '<img class="adm-thumb" alt="">' +
        '<div class="adm-fields"><input type="text" maxlength="200" aria-label="Descrierea pozei">' +
        '<div class="adm-btns">' +
        '<button type="button" data-act="up" aria-label="Mută mai sus">↑</button>' +
        '<button type="button" data-act="down" aria-label="Mută mai jos">↓</button>' +
        '<button type="button" class="danger" data-act="del">Șterge</button></div></div>';
      li.querySelector('img').src = p.thumb;
      li.querySelector('input').value = p.alt || '';
      li.querySelector('input').addEventListener('input', e => { p.alt = e.target.value; p._edited = true; updateSummary(); });
      li.querySelector('[data-act=up]').disabled = i === 0;
      li.querySelector('[data-act=down]').disabled = i === cur.length - 1;
      li.addEventListener('click', e => {
        const a = e.target.closest('button'); if (!a) return;
        if (a.dataset.act === 'up' && i > 0) { cur.splice(i - 1, 0, cur.splice(i, 1)[0]); data._order = true; }
        if (a.dataset.act === 'down' && i < cur.length - 1) { cur.splice(i + 1, 0, cur.splice(i, 1)[0]); data._order = true; }
        if (a.dataset.act === 'del') {
          if (!confirm('Ștergi această poză de pe site?')) return;
          (removed[cat] = removed[cat] || []).push(cur.splice(i, 1)[0]);
        }
        renderList();
      });
      list.appendChild(li);
    });

    add.forEach((p, i) => {
      const li = document.createElement('li');
      li.className = 'adm-item new';
      li.innerHTML = '<img class="adm-thumb" alt="">' +
        '<div class="adm-fields"><span class="adm-tag">Poză nouă · se publică la „Publică”</span>' +
        '<input type="text" maxlength="200" placeholder="Descriere scurtă (ex. Demolare casă veche, Ungheni)" aria-label="Descrierea pozei noi">' +
        '<div class="adm-btns"><button type="button" class="danger">Elimină</button></div></div>';
      li.querySelector('img').src = p.preview;
      li.querySelector('input').value = p.alt;
      li.querySelector('input').addEventListener('input', e => { p.alt = e.target.value; });
      li.querySelector('button').addEventListener('click', () => { add.splice(i, 1); renderList(); });
      list.appendChild(li);
    });

    $('empty').hidden = !!(cur.length || add.length);
    $('list-h').textContent = CATS[cat] + ' — ' + cur.length + (cur.length === 1 ? ' poză' : ' poze');
    updateSummary();
  }

  function dirty() {
    if (pendingCount()) return true;
    if (pDirty || Object.keys(pAdded).length || Object.keys(pRemoved).length) return true;
    if (data._order) return true;
    return Object.keys(CATS).some(k => (data[k] || []).some(p => p._edited));
  }

  function updateSummary() {
    let na = 0, nr = 0;
    Object.keys(added).forEach(k => na += added[k].length);
    Object.keys(removed).forEach(k => nr += removed[k].length);
    const parts = [];
    if (na) parts.push(na + ' de adăugat');
    if (nr) parts.push(nr + ' de șters');
    const np = Object.keys(pAdded).length, npr = Object.keys(pRemoved).length;
    if (np) parts.push(np + (np === 1 ? ' poză de produs de adăugat' : ' poze de produs de adăugat'));
    if (npr) parts.push(npr + (npr === 1 ? ' poză de produs de scos' : ' poze de produs de scos'));
    if (pDirty) parts.push('lista de produse modificată');
    if (!parts.length && dirty()) parts.push('descrieri / ordine schimbate');
    $('summary').textContent = parts.length ? 'Modificări: ' + parts.join(', ') + '.' : 'Nicio modificare.';
    $('publish').disabled = busy || !dirty();
  }

  /* ---------- Poze produse (Magazin Piese) ---------- */
  const CAT_P = { reparatie: 'Reparație', valve: 'Valve', echilibrare: 'Echilibrare', scule: 'Scule' };

  async function processProduct(file) {
    const bmp = await createImageBitmap(file);
    const o = await resize(bmp, PROD_SIZE, PROD_Q);
    if (bmp.close) bmp.close();
    return { main: o };
  }

  async function setProductPhoto(id, file) {
    if (!file || !/^image\//.test(file.type)) { say($('msg'), 'Alege un fișier de tip imagine.', 'err'); return; }
    busy = true; say($('msg'), 'Se procesează poza…');
    try {
      const o = await processProduct(file);
      if (pAdded[id]) URL.revokeObjectURL(pAdded[id].preview);
      pAdded[id] = { o, preview: URL.createObjectURL(o.main.blob) };
      delete pRemoved[id];
      say($('msg'), '');
    } catch (e) { say($('msg'), 'Nu pot citi poza (' + e.message + ').', 'err'); }
    busy = false; renderProducts();
  }

  const ICON_BY_CAT = { reparatie: 'patch', valve: 'valve', echilibrare: 'weight', scule: 'tool' };
  const VEH = { universal: 'Universal', autoturisme: 'Autoturisme', camioane: 'Camioane' };
  const optHtml = (o, sel) => Object.keys(o).map(k => '<option value="' + k + '"' + (k === sel ? ' selected' : '') + '>' + o[k] + '</option>').join('');

  function removeProductImage(p) {
    if (p.imagine && /^assets\/produse\//.test(p.imagine)) pDeleted.push(p.imagine);
    if (pAdded[p.id]) { URL.revokeObjectURL(pAdded[p.id].preview); delete pAdded[p.id]; }
    delete pRemoved[p.id];
  }

  function fieldsHtml(p) {
    return '<label class="adm-lbl">Nume produs *<input type="text" data-f="nume" maxlength="120"></label>' +
      '<label class="adm-lbl">Cod produs *<input type="text" data-f="cod" maxlength="30"></label>' +
      '<label class="adm-lbl">Categorie<select data-f="categorie">' + optHtml(CAT_P, p.categorie) + '</select></label>' +
      '<label class="adm-lbl">Tip vehicul<select data-f="vehicul">' + optHtml(VEH, p.vehicul) + '</select></label>' +
      '<label class="adm-lbl adm-wide">Descriere scurtă<textarea data-f="descriere" maxlength="300" rows="2"></textarea></label>';
  }

  function bindFields(root, p, onChange) {
    root.querySelectorAll('[data-f]').forEach(el => {
      el.value = p[el.dataset.f] == null ? '' : p[el.dataset.f];
      el.addEventListener('input', () => { p[el.dataset.f] = el.value; onChange && onChange(el); });
    });
  }

  function validProduct(p, list) {
    if (!String(p.nume || '').trim()) return 'Scrie numele produsului.';
    if (!String(p.cod || '').trim()) return 'Scrie codul produsului.';
    if (list.some(x => x !== p && String(x.cod).trim().toLowerCase() === String(p.cod).trim().toLowerCase())) return 'Există deja un produs cu codul „' + p.cod + '”.';
    return '';
  }

  /* formularul „Produs nou” */
  const newP = { nume: '', cod: '', categorie: 'reparatie', vehicul: 'universal', descriere: '' };
  let newFile = null;
  function renderNewForm() {
    const box = $('pnew-fields');
    box.innerHTML = fieldsHtml(newP);
    bindFields(box, newP);
  }

  async function addProduct() {
    const err = validProduct(newP, prod);
    if (err) { say($('pnew-msg'), err, 'err'); return; }
    const id = 'n' + Date.now().toString(36);
    const item = { id, cod: newP.cod.trim(), nume: newP.nume.trim(), descriere: newP.descriere.trim(),
      categorie: newP.categorie, imagine: null, vehicul: newP.vehicul, pictograma: ICON_BY_CAT[newP.categorie] || 'can' };
    prod.push(item); pDirty = true;
    if (newFile) await setProductPhoto(id, newFile);
    newFile = null; $('pnew-file').value = '';
    Object.assign(newP, { nume: '', cod: '', descriere: '' });
    renderNewForm();
    say($('pnew-msg'), 'Produs adăugat. Apasă „Publică modificările” ca să apară pe site.', 'ok');
    renderProducts();
  }

  function renderProducts() {
    const ul = $('plist'); ul.innerHTML = '';
    prod.forEach((p, i) => {
      const li = document.createElement('li');
      const pend = pAdded[p.id], rem = pRemoved[p.id];
      li.className = 'adm-item' + (pend ? ' new' : '') + (rem ? ' del' : '');
      const cur = rem ? null : (pend ? pend.preview : p.imagine);
      li.innerHTML = (cur ? '<img class="adm-thumb" alt="">' : '<div class="adm-thumb adm-noimg" aria-hidden="true">fără poză</div>') +
        '<div class="adm-fields"><div><span class="adm-tag"></span><div class="adm-pname"></div></div>' +
        '<div class="adm-btns"><button type="button" data-act="pick"></button>' +
        '<button type="button" data-act="rm">Scoate poza</button>' +
        '<button type="button" data-act="edit">Editează</button>' +
        '<button type="button" data-act="up" aria-label="Mută mai sus">↑</button>' +
        '<button type="button" data-act="down" aria-label="Mută mai jos">↓</button>' +
        '<button type="button" class="danger" data-act="del">Șterge produsul</button></div>' +
        '<div class="adm-edit" hidden></div>' +
        '<input type="file" accept="image/*" hidden></div>';
      if (cur) li.querySelector('img').src = cur;
      li.querySelector('.adm-tag').textContent = p.cod + ' · ' + (CAT_P[p.categorie] || p.categorie) + (pend ? ' · poză nouă' : rem ? ' · poza se scoate' : '');
      li.querySelector('.adm-pname').textContent = p.nume;
      const pick = li.querySelector('[data-act=pick]');
      pick.textContent = cur ? 'Schimbă poza' : 'Adaugă poză';
      li.querySelector('[data-act=rm]').disabled = !cur;
      li.querySelector('[data-act=up]').disabled = i === 0;
      li.querySelector('[data-act=down]').disabled = i === prod.length - 1;
      const fi = li.querySelector('input[type=file]');
      pick.addEventListener('click', () => fi.click());
      fi.addEventListener('change', () => { setProductPhoto(p.id, fi.files[0]); fi.value = ''; });
      li.querySelector('[data-act=rm]').addEventListener('click', () => {
        if (pend) { URL.revokeObjectURL(pend.preview); delete pAdded[p.id]; } else pRemoved[p.id] = true;
        renderProducts();
      });
      const ed = li.querySelector('.adm-edit');
      li.querySelector('[data-act=edit]').addEventListener('click', e => {
        if (!ed.hidden) { ed.hidden = true; e.target.textContent = 'Editează'; return; }
        ed.innerHTML = fieldsHtml(p) + '<p class="adm-msg" data-m></p>';
        ed.hidden = false; e.target.textContent = 'Închide';
        bindFields(ed, p, () => {
          pDirty = true;
          const er = validProduct(p, prod);
          say(ed.querySelector('[data-m]'), er, er ? 'err' : '');
          li.querySelector('.adm-pname').textContent = p.nume;
          li.querySelector('.adm-tag').textContent = p.cod + ' · ' + (CAT_P[p.categorie] || p.categorie);
          updateSummary();
        });
      });
      li.querySelector('[data-act=up]').addEventListener('click', () => { if (i > 0) { prod.splice(i - 1, 0, prod.splice(i, 1)[0]); pDirty = true; renderProducts(); } });
      li.querySelector('[data-act=down]').addEventListener('click', () => { if (i < prod.length - 1) { prod.splice(i + 1, 0, prod.splice(i, 1)[0]); pDirty = true; renderProducts(); } });
      li.querySelector('[data-act=del]').addEventListener('click', () => {
        if (!confirm('Ștergi produsul „' + p.nume + '” din magazin?')) return;
        removeProductImage(p);
        prod.splice(i, 1); pDirty = true; renderProducts();
      });
      ul.appendChild(li);
    });
    $('p-h').textContent = 'Produse în magazin — ' + prod.length;
    updateSummary();
  }

  function setMode(m) {
    mode = m;
    $('sec-gal').hidden = m !== 'gal';
    $('sec-prod').hidden = m !== 'prod';
    $('tab-gal').setAttribute('aria-pressed', m === 'gal');
    $('tab-prod').setAttribute('aria-pressed', m === 'prod');
  }

  /* ---------- Publicare (un singur commit) ---------- */
  async function publish() {
    if (busy || !dirty()) return;
    const bad = prod.map(p => validProduct(p, prod)).find(Boolean);
    if (bad) { say($('msg'), 'Produs incomplet: ' + bad, 'err'); return; }
    busy = true; $('publish').disabled = true;
    const msg = $('msg');
    try {
      const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
      const tree = [];
      const out = JSON.parse(JSON.stringify(data, (k, v) => (k === '_edited' || k === '_order') ? undefined : v));

      /* poze noi: 3 fișiere pentru fiecare (mare, miniatură, card) */
      let n = 0;
      for (const cat of Object.keys(added)) {
        for (const p of added[cat]) {
          n++;
          say(msg, 'Se încarcă poza ' + n + '…');
          const ext = p.o.full.blob.type === 'image/webp' ? 'webp' : 'jpg';
          const base = 'assets/lucrari/' + cat + '/up-' + stamp + '-' + n;
          const paths = { src: base + '.' + ext, thumb: base + '-thumb.' + ext, card: base + '-card.' + ext };
          for (const [k, path] of [['full', paths.src], ['thumb', paths.thumb], ['card', paths.card]]) {
            const blob = await gh('/git/blobs', { method: 'POST', body: { content: await blobToB64(p.o[k].blob), encoding: 'base64' } });
            tree.push({ path, mode: '100644', type: 'blob', sha: blob.sha });
          }
          out[cat].push({
            src: paths.src, thumb: paths.thumb, card: paths.card,
            alt: p.alt.trim() || ('Lucrare ALEXNATCONS — ' + CATS[cat]),
            w: p.o.thumb.w, h: p.o.thumb.h
          });
        }
      }

      /* poze șterse: se scot din repo (doar fișierele din assets/lucrari) */
      Object.keys(removed).forEach(cat => removed[cat].forEach(p => {
        [p.src, p.thumb, p.card].filter((x, i, a) => x && /^assets\/lucrari\//.test(x) && a.indexOf(x) === i)
          .forEach(path => tree.push({ path, mode: '100644', type: 'blob', sha: null }));
      }));

      /* poze produse: un fișier pe produs; vechea poză se șterge din repo */
      const prodOut = JSON.parse(JSON.stringify(prod));
      let pn = 0;
      for (const id of Object.keys(pAdded)) {
        const item = prodOut.find(x => x.id === id); if (!item) continue;
        pn++; say(msg, 'Se încarcă poza produsului ' + pn + '…');
        const m = pAdded[id].o.main;
        const ext = m.blob.type === 'image/webp' ? 'webp' : 'jpg';
        const path = 'assets/produse/' + id + '-' + stamp + '.' + ext;
        const blob = await gh('/git/blobs', { method: 'POST', body: { content: await blobToB64(m.blob), encoding: 'base64' } });
        tree.push({ path, mode: '100644', type: 'blob', sha: blob.sha });
        if (item.imagine && /^assets\/produse\//.test(item.imagine)) tree.push({ path: item.imagine, mode: '100644', type: 'blob', sha: null });
        item.imagine = path;
      }
      pDeleted.forEach(path => tree.push({ path, mode: '100644', type: 'blob', sha: null }));
      Object.keys(pRemoved).forEach(id => {
        const item = prodOut.find(x => x.id === id); if (!item) return;
        if (item.imagine && /^assets\/produse\//.test(item.imagine)) tree.push({ path: item.imagine, mode: '100644', type: 'blob', sha: null });
        item.imagine = null;
      });
      if (pn || pDirty || Object.keys(pRemoved).length) {
        const pj = await gh('/git/blobs', { method: 'POST', body: { content: b64utf8(JSON.stringify(prodOut, null, 1)), encoding: 'base64' } });
        tree.push({ path: 'produse.json', mode: '100644', type: 'blob', sha: pj.sha });
      }

      /* galerie.json actualizat */
      say(msg, 'Se salvează lista de poze…');
      const gj = await gh('/git/blobs', { method: 'POST', body: { content: b64utf8(JSON.stringify(out, null, 1)), encoding: 'base64' } });
      tree.push({ path: 'galerie.json', mode: '100644', type: 'blob', sha: gj.sha });

      say(msg, 'Se publică…');
      const ref = await gh('/git/ref/heads/' + REPO.branch);
      const parent = await gh('/git/commits/' + ref.object.sha);
      const t = await gh('/git/trees', { method: 'POST', body: { base_tree: parent.tree.sha, tree } });
      const c = await gh('/git/commits', { method: 'POST', body: {
        message: 'Admin: actualizare poze (' + (n + pn ? (n + pn) + ' noi' : 'modificări') + ')', tree: t.sha, parents: [ref.object.sha] } });
      await gh('/git/refs/heads/' + REPO.branch, { method: 'PATCH', body: { sha: c.sha } });

      Object.values(added).forEach(l => l.forEach(p => URL.revokeObjectURL(p.preview)));
      Object.values(pAdded).forEach(p => URL.revokeObjectURL(p.preview));
      await loadData();
      renderList(); renderProducts();
      say(msg, 'Gata! Pozele apar pe site în 1–2 minute (reîncarcă pagina cu Ctrl+Shift+R).', 'ok');
    } catch (e) {
      say(msg, e.status === 401 ? 'Tokenul a expirat — conectează-te din nou.' :
        e.status === 422 || e.status === 409 ? 'Site-ul s-a schimbat între timp. Reîncarcă pagina și încearcă din nou. (' + e.message + ')' :
        'Eroare la publicare: ' + e.message, 'err');
    }
    busy = false; updateSummary();
  }

  /* ---------- Evenimente ---------- */
  $('connect').addEventListener('click', () => connect($('token').value));
  $('token').addEventListener('keydown', e => { if (e.key === 'Enter') connect($('token').value); });
  $('logout').addEventListener('click', () => {
    try { localStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignorat */ }
    location.reload();
  });
  $('cat').addEventListener('change', renderList);
  $('pnew-add').addEventListener('click', addProduct);
  $('pnew-file').addEventListener('change', e => { newFile = e.target.files[0] || null; });
  $('tab-gal').addEventListener('click', () => setMode('gal'));
  $('tab-prod').addEventListener('click', () => setMode('prod'));
  $('publish').addEventListener('click', publish);

  const drop = $('drop'), input = $('files');
  drop.addEventListener('click', () => input.click());
  drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  input.addEventListener('change', () => { addFiles(input.files); input.value = ''; });
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => addFiles(e.dataTransfer.files));
  window.addEventListener('beforeunload', e => { if (dirty() && !busy) { e.preventDefault(); e.returnValue = ''; } });

  /* conectare automată dacă tokenul e deja salvat */
  try { const saved = localStorage.getItem(TOKEN_KEY); if (saved) { $('token').value = saved; connect(saved); } } catch (e) { /* ignorat */ }
})();
