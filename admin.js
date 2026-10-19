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
    'lucrari-teren': 'Lucrări de teren',
    'utilaje': 'Utilaje de Construcții',
    'dispozitive-vulcanizare': 'Dispozitive pentru vulcanizare'
  };
  const SIZES = { full: 1600, thumb: 720, card: 520 };   // latura maximă, px
  const QUALITY = { full: 0.8, thumb: 0.76, card: 0.7 };
  const TOKEN_KEY = 'anc-admin-token';

  const $ = id => document.getElementById(id);
  const api = 'https://api.github.com/repos/' + REPO.owner + '/' + REPO.name;
  let token = '';
  let data = {};            // galerie.json curent (cu modificările din panou)
  let removed = {};         // { cat: [item, …] } pozele marcate pentru ștergere
  let added = {};           // { cat: [{files, alt, …}] } pozele noi, încă nepublicate
  let busy = false;

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
    removed = {}; added = {};
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
    if (!parts.length && dirty()) parts.push('descrieri / ordine schimbate');
    $('summary').textContent = parts.length ? 'Modificări: ' + parts.join(', ') + '.' : 'Nicio modificare.';
    $('publish').disabled = busy || !dirty();
  }

  /* ---------- Publicare (un singur commit) ---------- */
  async function publish() {
    if (busy || !dirty()) return;
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

      /* galerie.json actualizat */
      say(msg, 'Se salvează lista de poze…');
      const gj = await gh('/git/blobs', { method: 'POST', body: { content: b64utf8(JSON.stringify(out, null, 1)), encoding: 'base64' } });
      tree.push({ path: 'galerie.json', mode: '100644', type: 'blob', sha: gj.sha });

      say(msg, 'Se publică…');
      const ref = await gh('/git/ref/heads/' + REPO.branch);
      const parent = await gh('/git/commits/' + ref.object.sha);
      const t = await gh('/git/trees', { method: 'POST', body: { base_tree: parent.tree.sha, tree } });
      const c = await gh('/git/commits', { method: 'POST', body: {
        message: 'Admin: actualizare poze (' + (n ? n + ' noi' : 'modificări') + ')', tree: t.sha, parents: [ref.object.sha] } });
      await gh('/git/refs/heads/' + REPO.branch, { method: 'PATCH', body: { sha: c.sha } });

      Object.values(added).forEach(l => l.forEach(p => URL.revokeObjectURL(p.preview)));
      await loadData();
      renderList();
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
