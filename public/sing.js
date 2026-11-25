(function () {
  const token = decodeURIComponent(location.pathname.split('/').filter(Boolean)[1] || '');
  const $ = (id) => document.getElementById(id);
  const KEY = 'xmas-song-' + token;
  const CHIPS = ['Funky & danceable', 'Retro 80s disco', 'Pop & catchy', 'Soulful & bluesy', 'Big band swing', 'Rock anthem', 'Gospel choir', 'Surprise me!'];
  let st = null, editing = false, member = null;
  // Personal link: /sing/<token>#k=<id.secret> restores the guest's song on any device (the hash never reaches the server logs).
  const hk = (location.hash.match(/k=([\w.-]+)/) || [])[1];
  if (hk) { try { localStorage.setItem(KEY, hk); } catch (_) {} window.__hk = hk; history.replaceState(null, '', location.pathname); }
  const getKey = () => { try { return localStorage.getItem(KEY) || window.__hk || ''; } catch (_) { return window.__hk || ''; } };
  const setKey = (k) => { window.__hk = k; try { localStorage.setItem(KEY, k); } catch (_) {} };
  const show = (v) => ['loading', 'fatal', 'formView', 'doneView', 'songView'].forEach((x) => $(x).classList.toggle('hidden', x !== v));
  const req = (url, o = {}) => fetch(url, { method: o.method || 'GET', headers: { 'Content-Type': 'application/json', 'x-entry': getKey() }, body: o.body ? JSON.stringify(o.body) : undefined })
    .then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok) { const e = new Error(d.error || 'Something went wrong'); e.status = r.status; throw e; } return d; }, () => { throw new Error('No connection. Check your signal and try again.'); });

  function counters() {
    document.querySelectorAll('textarea[data-max]').forEach((ta) => {
      const n = clen(ta.value), max = +ta.dataset.max, c = document.querySelector(`.counter[data-for="${ta.id}"]`);
      c.textContent = `${n} / ${max}`; c.classList.toggle('near', n > max * 0.9 && n <= max); c.classList.toggle('over', n > max);
    });
  }
  document.querySelectorAll('textarea[data-max]').forEach((ta) => ta.addEventListener('input', counters)); counters();
  $('chips').innerHTML = CHIPS.map((c) => `<button type="button" class="vibe sm" data-c="${esc(c)}">${esc(c)}</button>`).join('');
  $('chips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-c]'); if (!b) return; const s = $('style');
    s.value = (s.value.trim() ? s.value.trim().replace(/[,.]?$/, ', ') : '') + b.dataset.c.toLowerCase(); counters(); s.focus();
  });

  // name: type-ahead over the guest list (free text allowed)
  function hits() {
    const q = $('name').value.trim().toLowerCase(); const ms = (st && st.members) || [];
    if (member && ms.find((m) => m.id === member)?.name === $('name').value) { $('nameHits').innerHTML = ''; return; }
    member = null;
    const list = q.length < 1 ? [] : ms.filter((m) => m.name.toLowerCase().split(/\s+/).some((w) => w.startsWith(q)) || m.name.toLowerCase().startsWith(q)).slice(0, 6);
    $('nameHits').innerHTML = list.map((m) => `<button type="button" class="vibe sm" data-m="${m.id}">${esc(m.name)}</button>`).join('');
  }
  $('name').addEventListener('input', hits);
  $('nameHits').addEventListener('click', (e) => { const b = e.target.closest('[data-m]'); if (!b) return; member = +b.dataset.m; $('name').value = b.textContent; $('nameHits').innerHTML = ''; });

  const myLink = () => location.origin + '/sing/' + encodeURIComponent(token) + '#k=' + getKey();
  function linkBox(el) {
    if (!getKey()) return;
    el.innerHTML = `<div class="linkbox"><b>Your personal song link</b><span>Open it on any phone or computer — or send it to yourself.</span>
      <div class="row2"><button type="button" class="btn btn-sm btn-gold" data-share>Share / save link</button><button type="button" class="btn btn-sm" data-copylink>Copy link</button></div></div>`;
  }
  document.addEventListener('click', async (e) => {
    if (e.target.closest('[data-copylink]')) copyText(myLink(), 'Your link');
    if (e.target.closest('[data-share]')) {
      if (navigator.share) { try { await navigator.share({ title: 'My Christmas song', text: 'My song from the LFG+Zest Christmas dinner', url: myLink() }); } catch (_) {} }
      else copyText(myLink(), 'Your link');
    }
  });
  const label = { Received: 'Received', Composed: 'In the studio', 'In Production': 'In the studio', Ready: 'Ready', Error: 'In the studio' };
  function render() {
    if (st.song) {
      const s = st.song;
      $('sEyebrow').textContent = s.finalist ? '🏆 Your song is in the final!' : 'Your song is ready';
      $('sTitle').textContent = s.title; $('sLyrics').textContent = s.lyrics.replace(/^\s*\[[^\]]*\]\s*$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
      $('sNote').textContent = s.note || ''; if (s.clip.image) $('sCover').src = s.clip.image.replace('image_', 'image_large_'); else $('sCover').classList.add('hidden');
      if ($('sAudio').getAttribute('src') !== s.clip.audioUrl) $('sAudio').src = s.clip.audioUrl;
      linkBox($('linkSong')); return show('songView');
    }
    if (st.mine && !editing) {
      linkBox($('linkDone'));
      const m = st.mine;
      $('mTitle').textContent = m.title || '(no title — the AI will find one)'; $('mLyrics').textContent = m.lyrics;
      $('mStyle').textContent = m.style; $('mStyleBlk').classList.toggle('hidden', !m.style);
      $('doneStatus').textContent = label[m.status] || m.status; $('doneStatus').className = 'status-pill st-' + (m.status === 'Received' ? 'Submitted' : 'In-Production');
      $('editBtn').classList.toggle('hidden', !m.editable);
      $('doneSub').textContent = m.editable ? `You can still edit it for a few minutes. Then the AI polishes it and sends it to the studio — your song will appear right here.`
        : 'Your song is in the studio. Keep this page open — it will appear right here in a few minutes.';
      return show('doneView');
    }
    if (!st.open && !st.mine) { $('fatalTitle').textContent = 'Submissions are closed'; $('fatalMsg').textContent = 'The songs are being produced — enjoy the dinner!'; return show('fatal'); }
    show('formView');
  }
  async function load(first) {
    try { st = await req('/api/s/' + encodeURIComponent(token)); if (first || !editing) render(); }
    catch (e) { if (first || e.status === 404) { $('fatalMsg').textContent = e.message; show('fatal'); } }
  }
  $('form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const body = { name: $('name').value.trim(), participantId: member, title: $('title').value.trim(), lyrics: $('lyrics').value.trim(), style: $('style').value.trim() };
    const m = $('formMsg'); m.classList.add('hidden');
    const err = !body.name ? 'Please tell us your name.' : !body.lyrics ? 'Write your lyrics — even a few lines!' : clen(body.lyrics) > 1500 ? 'Lyrics are over 1,500 characters.' : clen(body.style) > 400 ? 'Style is over 400 characters.' : '';
    if (err) { m.textContent = err; m.classList.remove('hidden'); m.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    const btn = $('submitBtn'); btn.disabled = true; const lbl = btn.textContent; btn.textContent = 'Sending…';
    try {
      if (st.mine) await req(`/api/s/${encodeURIComponent(token)}/entries/mine`, { method: 'PUT', body });
      else { const r = await req(`/api/s/${encodeURIComponent(token)}/entries`, { method: 'POST', body }); setKey(r.key); }
      $('doneTitle').textContent = st.mine ? 'Song updated!' : 'Your song is in!';
      editing = false; await load(true); window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { m.textContent = e.message; m.classList.remove('hidden'); }
    finally { btn.disabled = false; btn.textContent = lbl; }
  });
  $('editBtn').addEventListener('click', () => {
    const x = st.mine; editing = true; $('name').value = x.name; member = x.participantId; $('title').value = x.title; $('lyrics').value = x.lyrics; $('style').value = x.style;
    counters(); $('submitBtn').textContent = 'Update My Song'; $('cancelEdit').classList.remove('hidden'); show('formView');
  });
  $('cancelEdit').addEventListener('click', () => { editing = false; render(); });
  load(true);
  setInterval(() => { if (!document.hidden && !editing && !(st && st.song && !$('sAudio').paused)) load(false); }, 15000);
})();
