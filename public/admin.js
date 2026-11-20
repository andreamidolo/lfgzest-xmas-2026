(function () {
  const $ = (id) => document.getElementById(id);
  let S = null; let tab = 'songs'; let sigs = {}; let seen = null; let filter = '';
  let pollTimer = null;

  // ---------- auth ----------
  async function boot() {
    const me = await api('/api/admin/me').catch(() => ({ admin: false }));
    if (me.admin) startApp(); else { $('loginView').classList.remove('hidden'); $('pw').focus(); }
  }
  $('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const m = $('loginMsg'); m.classList.add('hidden');
    try { await api('/api/admin/login', { method: 'POST', body: { password: $('pw').value } }); $('loginView').classList.add('hidden'); startApp(); }
    catch (err) { m.textContent = err.message; m.classList.remove('hidden'); }
  });
  $('logout').addEventListener('click', async () => { await api('/api/admin/logout', { method: 'POST' }); location.reload(); });

  function startApp() {
    $('appView').classList.remove('hidden');
    const h = (location.hash || '').slice(1); if (['songs', 'seating', 'qr'].includes(h)) setTab(h);
    refresh(); pollTimer = setInterval(() => { if (!document.hidden) refresh(); }, 4000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  }

  // ---------- tabs ----------
  function setTab(t) {
    tab = t; history.replaceState(null, '', '#' + t);
    document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === t));
    document.querySelectorAll('.tab').forEach((s) => s.classList.toggle('hidden', s.id !== 'tab-' + t));
  }
  document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));

  // ---------- data ----------
  async function refresh(force) {
    try {
      const data = await api('/api/admin/state');
      $('live').classList.remove('off');
      S = data; render(force);
    } catch (e) {
      $('live').classList.add('off');
      if (e.status === 401) location.reload();
    }
  }
  async function act(url, method, body, okMsg) {
    try { await api(url, { method, body }); if (okMsg) toast(okMsg); await refresh(true); return true; }
    catch (e) { toast(e.message, true); await refresh(true); return false; }
  }
  const tableById = (id) => S.tables.find((t) => t.id === id);
  const subByTable = (id) => S.submissions.find((s) => s.tableId === id);
  const tLabel = (t) => 'Table ' + t.number + (t.name ? ' · ' + t.name : '');
  const fmtTime = (d) => new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const editingIn = (el) => document.activeElement && el.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);

  function render(force) {
    renderStats();
    const parts = {
      songs: JSON.stringify([S.tables.map((t) => [t.id, t.number, t.name, t.locked]), S.submissions, filter]),
      seating: JSON.stringify([S.tables.map((t) => [t.id, t.number, t.name, t.capacity]), S.participants]),
      qr: JSON.stringify([S.tables, S.baseUrl]),
    };
    if (force || sigs.songs !== parts.songs) { renderSongs(); sigs.songs = parts.songs; }
    if ((force && !editingIn($('tab-seating'))) || (sigs.seating !== parts.seating && !editingIn($('tab-seating')))) { renderSeating(); sigs.seating = parts.seating; }
    if ((force || sigs.qr !== parts.qr) && !editingIn($('tab-qr'))) { renderQR(); sigs.qr = parts.qr; }
  }

  function renderStats() {
    $('sTables').textContent = S.tables.length;
    $('sSongs').textContent = S.submissions.length;
    const seated = S.participants.filter((p) => p.table_id).length;
    $('sGuests').textContent = seated + '/' + S.participants.length;
    const done = S.tables.filter((t) => subByTable(t.id)); const wait = S.tables.filter((t) => !subByTable(t.id));
    $('sDone').innerHTML = done.map((t) => `<span class="chip done">T${t.number}</span>`).join('') || '<span class="tiny">None yet</span>';
    $('sWait').innerHTML = wait.map((t) => `<span class="chip">T${t.number}</span>`).join('') || '<span class="tiny">Everyone has submitted 🎉</span>';
  }

  // ---------- songs ----------
  const sf = $('songFilter');
  S === null && ['Submitted', 'In Production', 'Ready', 'Played'].forEach((s) => sf.insertAdjacentHTML('beforeend', `<option>${s}</option>`));
  sf.addEventListener('change', () => { filter = sf.value; renderSongs(); });

  function formatAll(t, s) {
    return `TABLE ${t.number}${t.name ? ' — ' + t.name : ''}\nTITLE: ${s.title}\n${s.theme ? 'THEME: ' + s.theme + '\n' : ''}\nSTYLE OF MUSIC:\n${s.style}\n\nLYRICS:\n${s.lyrics}\n`;
  }

  function prodHtml(t, s) {
    const p = s.production;
    const karaoke = `<a class="btn btn-sm btn-gold" href="/admin/karaoke/${t.id}" target="_blank" rel="noopener">▶ Karaoke</a>`;
    if (!p || !p.clips || !p.clips.length) return `<div class="prod empty"><span class="eyebrow">Suno</span><span class="tiny">Not produced yet${t.locked ? ' — queued for production' : ' — lock the table to send it to Suno'}</span></div>`;
    const vers = p.clips.map((c, i) => `<label class="ver ${p.selected === c.id ? 'sel' : ''}">
        <input type="radio" name="sel-${t.id}" value="${esc(c.id)}" ${p.selected === c.id ? 'checked' : ''} data-sel>
        ${c.image ? `<img src="${esc(c.image)}" alt="">` : ''}<span>Version ${i + 1}${c.duration ? `<br><small>${Math.floor(c.duration / 60)}:${String(Math.round(c.duration % 60)).padStart(2, '0')}</small>` : ''}${c.alignment ? '' : '<br><small>no timing</small>'}</span>
        <a href="${esc(c.songUrl)}" target="_blank" rel="noopener" title="Open on Suno">↗</a></label>`).join('');
    const sel = p.clips.find((c) => c.id === p.selected) || p.clips[0];
    const src = sel.audioUrl || `https://cdn1.suno.ai/${sel.id}.mp4`;
    return `<div class="prod"><div class="blk-h"><span class="eyebrow">Suno · pick the version to play</span>${karaoke}</div>
      <div class="vers">${vers}</div><audio controls preload="none" src="${esc(src)}"></audio></div>`;
  }

  function renderSongs() {
    const box = $('songs');
    const fresh = [];
    const nowSeen = new Map(S.submissions.map((s) => [s.tableId, s.revision]));
    if (seen) for (const [id, rev] of nowSeen) if (seen.get(id) !== rev) fresh.push(id);
    if (seen && fresh.length) {
      const t = tableById(fresh[0]);
      toast(fresh.length > 1 ? `${fresh.length} songs updated` : `${seen.has(fresh[0]) ? 'Update' : 'New song'} from Table ${t ? t.number : ''} ✦`);
    }
    seen = nowSeen;
    const html = S.tables.map((t) => {
      const s = subByTable(t.id);
      if (!s) return filter ? '' : `<article class="song empty"><div><div class="song-table">${esc(tLabel(t))}</div><p class="muted" style="margin:6px 0 0">Waiting for this table's song…</p>${t.locked ? '<span class="status-pill st-Locked" style="margin-top:8px">Locked</span>' : ''}</div></article>`;
      if (filter && s.status !== filter) return '';
      const opts = S.statuses.map((x) => `<option ${x === s.status ? 'selected' : ''}>${x}</option>`).join('');
      return `<article class="song ${fresh.includes(t.id) ? 'new' : ''}" data-t="${t.id}">
        <div class="song-head"><div><div class="song-table">${esc(tLabel(t))}</div><h3>${esc(s.title)}</h3></div>
          <span class="status-pill st-${s.status.replace(/\s/g, '-')}">${esc(s.status)}</span></div>
        ${s.theme ? `<p class="theme">${esc(s.theme)}</p>` : ''}
        <div><div class="blk-h"><span class="eyebrow">Style of music · ${clen(s.style)}</span><button class="btn btn-sm" data-copy="style">Copy Style</button></div><pre>${esc(s.style)}</pre></div>
        <div><div class="blk-h"><span class="eyebrow">Lyrics · ${clen(s.lyrics)}</span><button class="btn btn-sm" data-copy="lyrics">Copy Lyrics</button></div><pre>${esc(s.lyrics)}</pre></div>
        ${prodHtml(t, s)}
        <div class="meta">Submitted ${fmtTime(s.createdAt)}${s.revision > 1 ? ` · edited ${s.revision - 1}× · last ${fmtTime(s.updatedAt)}` : ''}</div>
        <div class="actions">
          <button class="btn btn-sm btn-gold" data-copy="all">Copy All</button>
          <select data-status aria-label="Production status">${opts}</select>
          <button class="btn btn-sm lockbtn ${t.locked ? 'locked' : ''}" data-lock>${t.locked ? '🔒 Locked · Reopen' : 'Lock'}</button>
          <button class="btn btn-sm btn-ghost btn-danger" data-del title="Delete submission">✕</button>
        </div></article>`;
    }).join('');
    box.innerHTML = html || '<p class="muted">No songs match this filter.</p>';
  }
  $('songs').addEventListener('click', (e) => {
    const card = e.target.closest('.song[data-t]'); if (!card) return;
    const t = tableById(+card.dataset.t); const s = subByTable(t.id);
    const c = e.target.closest('[data-copy]');
    if (c) { const k = c.dataset.copy; copyText(k === 'all' ? formatAll(t, s) : s[k], k === 'all' ? 'Full proposal' : k === 'style' ? 'Style' : 'Lyrics'); return; }
    if (e.target.closest('[data-lock]')) act(`/api/admin/tables/${t.id}`, 'PATCH', { locked: !t.locked }, t.locked ? `Table ${t.number} reopened` : `Table ${t.number} locked`);
    if (e.target.closest('[data-del]') && confirm(`Delete Table ${t.number}'s song? The table will be able to submit again.`)) act(`/api/admin/submissions/${t.id}`, 'DELETE', undefined, 'Submission deleted');
  });
  $('songs').addEventListener('change', (e) => {
    if (e.target.matches('[data-sel]')) {
      const id = +e.target.closest('.song').dataset.t;
      act(`/api/admin/submissions/${id}/production`, 'PUT', { selected: e.target.value }, 'Version selected');
      return;
    }
    if (!e.target.matches('[data-status]')) return;
    const id = +e.target.closest('.song').dataset.t;
    act(`/api/admin/submissions/${id}`, 'PATCH', { status: e.target.value }, 'Status: ' + e.target.value);
  });
  $('lockAll').addEventListener('click', () => confirm('Lock ALL tables? Guests will no longer be able to edit.') && act('/api/admin/lock-all', 'POST', { locked: true }, 'All tables locked'));
  $('unlockAll').addEventListener('click', () => act('/api/admin/lock-all', 'POST', { locked: false }, 'All tables reopened'));

  // ---------- seating (manual only) ----------
  function tableOptions(sel) {
    return `<option value="">—</option>` + S.tables.map((t) => `<option value="${t.id}" ${t.id === sel ? 'selected' : ''}>Table ${t.number}</option>`).join('');
  }
  function seatOptions(p) {
    const t = tableById(p.table_id); if (!t) return '<option value="">—</option>';
    const taken = new Map(S.participants.filter((x) => x.table_id === t.id && x.seat && x.id !== p.id).map((x) => [x.seat, x.name]));
    let o = '<option value="">—</option>';
    const max = Math.max(t.capacity, p.seat || 0);
    for (let i = 1; i <= max; i++) o += `<option value="${i}" ${p.seat === i ? 'selected' : ''} ${taken.has(i) ? 'disabled' : ''}>${i}${taken.has(i) ? ' ✕' : ''}</option>`;
    return o;
  }
  function renderSeating() {
    const un = S.participants.filter((p) => !p.table_id);
    $('unCount').textContent = `(${un.length})`;
    $('unList').innerHTML = un.map((p) => `<div class="u" data-p="${p.id}"><span title="${esc(p.name)}">${esc(p.name)}</span><select data-f="table_id" aria-label="Assign table">${tableOptions(null)}</select></div>`).join('') || '<p class="tiny">Everyone is assigned to a table.</p>';
    $('tableCards').innerHTML = S.tables.map((t) => {
      const ps = S.participants.filter((p) => p.table_id === t.id).sort((a, b) => (a.seat || 99) - (b.seat || 99) || a.name.localeCompare(b.name));
      const pct = Math.min(100, (ps.length / t.capacity) * 100);
      const cls = ps.length > t.capacity ? 'over' : ps.length === t.capacity ? 'full' : '';
      const seated = new Map(ps.filter((p) => p.seat).map((p) => [p.seat, p]));
      let rows = '';
      for (let i = 1; i <= t.capacity; i++) { const p = seated.get(i); rows += p ? `<li><span class="sn">${i}</span>${esc(p.name)}</li>` : ''; }
      ps.filter((p) => !p.seat || p.seat > t.capacity).forEach((p) => { rows += `<li><span class="sn">${p.seat || '·'}</span>${esc(p.name)}</li>`; });
      if (!ps.length) rows = '<li class="emptyseat">No guests yet</li>';
      return `<div class="tcard"><h4>${esc(tLabel(t))}<small>${ps.length}/${t.capacity}</small></h4><div class="occ ${cls}"><i style="width:${pct}%"></i></div><ol>${rows}</ol></div>`;
    }).join('');
    renderGuestRows();
  }
  function renderGuestRows() {
    const q = ($('guestSearch').value || '').toLowerCase();
    $('guestRows').innerHTML = S.participants.filter((p) => !q || p.name.toLowerCase().includes(q)).map((p) => `<tr data-p="${p.id}">
      <td><input type="text" data-f="name" value="${esc(p.name)}" aria-label="Name"></td>
      <td><select data-f="table_id" aria-label="Table">${tableOptions(p.table_id)}</select></td>
      <td><select data-f="seat" aria-label="Seat" ${p.table_id ? '' : 'disabled'}>${seatOptions(p)}</select></td>
      <td><button class="btn btn-sm btn-ghost btn-danger" data-delp title="Remove guest">✕</button></td></tr>`).join('') || '<tr><td colspan="4" class="tiny">No guests yet — add them on the left.</td></tr>';
  }
  $('guestSearch').addEventListener('input', renderGuestRows);
  $('tab-seating').addEventListener('change', (e) => {
    const row = e.target.closest('[data-p]'); if (!row || !e.target.dataset.f) return;
    const f = e.target.dataset.f; const v = e.target.value;
    const body = {}; body[f] = f === 'name' ? v : v ? +v : null;
    e.target.blur();
    act(`/api/admin/participants/${row.dataset.p}`, 'PATCH', body, f === 'table_id' ? (v ? `Assigned to Table ${tableById(+v).number}` : 'Unassigned') : 'Saved');
  });
  $('tab-seating').addEventListener('click', (e) => {
    const b = e.target.closest('[data-delp]'); if (!b) return;
    const id = +b.closest('[data-p]').dataset.p; const p = S.participants.find((x) => x.id === id);
    if (confirm(`Remove ${p.name}?`)) act(`/api/admin/participants/${id}`, 'DELETE', undefined, 'Guest removed');
  });
  $('importBtn').addEventListener('click', async () => {
    const entries = $('importBox').value.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
      const parts = l.split(/[,;\t]/).map((x) => x.trim());
      return { name: parts[0], table: parts[1] || null, seat: parts[2] || null };
    });
    const m = $('importMsg');
    if (!entries.length) { m.className = 'msg err'; m.textContent = 'Paste at least one name.'; return; }
    try {
      const r = await api('/api/admin/participants', { method: 'POST', body: { entries } });
      m.className = r.warnings.length ? 'msg info' : 'msg ok';
      m.innerHTML = `${r.added} guest${r.added === 1 ? '' : 's'} added.` + (r.warnings.length ? '<br>' + r.warnings.map(esc).join('<br>') : '');
      $('importBox').value = ''; refresh(true);
    } catch (e) { m.className = 'msg err'; m.textContent = e.message; }
  });

  // ---------- tables & QR ----------
  function renderQR() {
    const local = /localhost|127\.0\.0\.1|\.local\b|192\.168\./.test(S.baseUrl);
    const w = $('baseWarn'); w.classList.toggle('hidden', !local);
    w.innerHTML = `QR codes currently point to <b>${esc(S.baseUrl)}</b> (a development address). Open this dashboard from the published URL — or set <code>PUBLIC_BASE_URL</code> — before printing.`;
    $('qrCards').innerHTML = S.tables.map((t) => `<div class="qcard" data-t="${t.id}">
      <div style="display:flex;justify-content:space-between;align-items:center"><h3 style="font-size:22px;color:var(--champagne)">Table ${t.number}</h3>
        ${subByTable(t.id) ? '<span class="status-pill st-Ready">Song in</span>' : '<span class="status-pill st-Waiting">Waiting</span>'}</div>
      <div class="qimg"><img src="/api/admin/qr/${t.id}.png?v=${t.token.slice(0, 6)}" alt="QR code for Table ${t.number}" loading="lazy"></div>
      <div class="url">${esc(t.url)}</div>
      <div class="row"><button class="btn btn-sm btn-gold" data-dl>Download PNG</button><button class="btn btn-sm" data-copyurl>Copy URL</button><a class="btn btn-sm" href="${esc(t.url)}" target="_blank" rel="noopener">Open</a></div>
      <div class="row">
        <div><label class="sm">Name (optional)</label><input type="text" data-tf="name" value="${esc(t.name)}" placeholder="e.g. Mistletoe"></div>
        <div style="max-width:90px"><label class="sm">Seats</label><input type="number" min="1" max="40" data-tf="capacity" value="${t.capacity}"></div>
      </div>
      <div class="row"><button class="btn btn-sm lockbtn ${t.locked ? 'locked' : ''}" data-lock>${t.locked ? '🔒 Locked · Reopen' : 'Lock submissions'}</button></div>
      <div class="row"><button class="btn btn-sm btn-ghost" data-regen>New link</button><button class="btn btn-sm btn-ghost btn-danger" data-deltable>Delete table</button></div>
    </div>`).join('');
  }
  $('qrCards').addEventListener('change', (e) => {
    const f = e.target.dataset.tf; if (!f) return;
    const id = +e.target.closest('[data-t]').dataset.t; const body = {}; body[f] = e.target.value;
    e.target.blur(); act(`/api/admin/tables/${id}`, 'PATCH', body, 'Table updated');
  });
  $('qrCards').addEventListener('click', (e) => {
    const card = e.target.closest('[data-t]'); if (!card) return;
    const t = tableById(+card.dataset.t);
    if (e.target.closest('[data-copyurl]')) copyText(t.url, `Table ${t.number} URL`);
    if (e.target.closest('[data-dl]')) downloadCard(t);
    if (e.target.closest('[data-lock]')) act(`/api/admin/tables/${t.id}`, 'PATCH', { locked: !t.locked }, t.locked ? 'Reopened' : 'Locked');
    if (e.target.closest('[data-regen]') && confirm(`Create a NEW link for Table ${t.number}? The old QR code will stop working (the song is kept).`)) act(`/api/admin/tables/${t.id}/regenerate`, 'POST', undefined, 'New link created — reprint this QR');
    if (e.target.closest('[data-deltable]') && confirm(`Delete Table ${t.number}? Its song is deleted and its guests become unassigned.`)) act(`/api/admin/tables/${t.id}`, 'DELETE', undefined, 'Table deleted');
  });
  $('addTable').addEventListener('click', () => act('/api/admin/tables', 'POST', {}, 'Table added'));

  // Branded PNG card (QR + table number) drawn on canvas
  function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
  window.drawQrCard = async function (t) {
    await document.fonts.ready;
    const W = 1200, H = 1600; const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0C3540'); bg.addColorStop(1, '#051E25'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const glow = g.createRadialGradient(W / 2, 0, 0, W / 2, 0, 900); glow.addColorStop(0, 'rgba(213,178,106,.22)'); glow.addColorStop(1, 'rgba(213,178,106,0)'); g.fillStyle = glow; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(213,178,106,.7)'; g.lineWidth = 3; g.strokeRect(40, 40, W - 80, H - 80);
    g.strokeStyle = 'rgba(213,178,106,.3)'; g.lineWidth = 1.5; g.strokeRect(56, 56, W - 112, H - 112);
    const [lz, la, qr] = await Promise.all([loadImg('/brand/lfg-zest-white.png'), loadImg('/brand/lfa-white.png'), loadImg(`/api/admin/qr/${t.id}.png?v=${t.token.slice(0, 6)}`)]);
    g.drawImage(lz, W / 2 - 150, 110, 120, 120); g.drawImage(la, W / 2 + 30, 110, 120, 120);
    g.textAlign = 'center'; g.fillStyle = '#D5B26A'; g.font = '800 26px Mulish'; g.letterSpacing = '8px';
    g.fillText('CHRISTMAS DINNER 2026', W / 2, 300);
    g.letterSpacing = '0px'; g.fillStyle = '#F3E6C8'; g.font = 'italic 500 84px "Playfair Display"'; g.fillText('Music Battle', W / 2, 400);
    g.fillStyle = '#fff'; roundRect(g, W / 2 - 360, 460, 720, 720, 24); g.fill();
    g.drawImage(qr, W / 2 - 340, 480, 680, 680);
    g.fillStyle = '#F3E6C8'; g.font = '500 120px "Playfair Display"'; g.fillText('Table ' + t.number, W / 2, 1340);
    if (t.name) { g.fillStyle = '#D5B26A'; g.font = 'italic 44px "Playfair Display"'; g.fillText(t.name, W / 2, 1400); }
    g.fillStyle = '#B9C9CC'; g.font = '400 30px Mulish'; g.fillText('Scan to submit your table’s song', W / 2, t.name ? 1470 : 1430);
    return c;
  };
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  async function downloadCard(t) {
    try {
      const c = await drawQrCard(t);
      const a = document.createElement('a'); a.download = `LFG-Zest-Xmas-Table-${t.number}-QR.png`; a.href = c.toDataURL('image/png'); a.click();
    } catch (e) { location.href = `/api/admin/qr/${t.id}.png?download=1`; }
  }

  boot();
})();
