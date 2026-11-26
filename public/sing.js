(function () {
  const token = decodeURIComponent(location.pathname.split('/').filter(Boolean)[1] || '');
  const T = encodeURIComponent(token);
  const $ = (id) => document.getElementById(id);
  const KEY = 'xmas-song-' + token, ME = 'xmas-me-' + token;
  const CHIPS = ['Funky & danceable', 'Retro 80s disco', 'Pop & catchy', 'Soulful & bluesy', 'Big band swing', 'Rock anthem', 'Gospel choir', 'Surprise me!'];
  const ls = { get: (k) => { try { return localStorage.getItem(k) || ''; } catch (_) { return ''; } }, set: (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (_) {} } };
  // Legacy personal link (#k=…) for guests not on the list
  const hk = (location.hash.match(/k=([\w.-]+)/) || [])[1]; if (hk) ls.set(KEY, hk);
  const hp = (location.hash.match(/p=(\d+)/) || [])[1]; if (hp) ls.set(ME, hp);
  if (hk || hp) history.replaceState(null, '', location.pathname);

  let me = +ls.get(ME) || null;      // selected guest (participant id)
  let free = !me && !!ls.get(KEY);   // "not on the list" mode
  let st = null, people = [], editing = false;
  const show = (v) => { ['loading', 'fatal', 'whoView', 'formView', 'doneView', 'songView'].forEach((x) => $(x).classList.toggle('hidden', x !== v)); $('personBar').classList.toggle('hidden', !me || ['whoView', 'loading', 'fatal'].includes(v)); };
  const req = (url, o = {}) => fetch(url, { method: o.method || 'GET', headers: { 'Content-Type': 'application/json', 'x-entry': ls.get(KEY) }, body: o.body ? JSON.stringify(o.body) : undefined })
    .then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok) { const e = new Error(d.error || 'Something went wrong'); e.status = r.status; throw e; } return d; }, () => { throw new Error('No connection. Check your signal and try again.'); });

  // ---- form helpers
  function counters() {
    document.querySelectorAll('textarea[data-max]').forEach((ta) => {
      const n = clen(ta.value), max = +ta.dataset.max, c = document.querySelector(`.counter[data-for="${ta.id}"]`);
      c.textContent = `${n} / ${max}`; c.classList.toggle('near', n > max * 0.9 && n <= max); c.classList.toggle('over', n > max);
    });
  }
  document.querySelectorAll('textarea[data-max]').forEach((ta) => ta.addEventListener('input', counters)); counters();
  $('chips').innerHTML = CHIPS.map((c) => `<button type="button" class="vibe sm" data-c="${esc(c)}">${esc(c)}</button>`).join('');
  $('chips').addEventListener('click', (e) => { const b = e.target.closest('[data-c]'); if (!b) return; const s = $('style'); s.value = (s.value.trim() ? s.value.trim().replace(/[,.]?$/, ', ') : '') + b.dataset.c.toLowerCase(); counters(); s.focus(); });

  // ---- who are you
  function renderPeople() {
    const q = $('who').value.trim().toLowerCase();
    const list = people.filter((p) => !q || p.name.toLowerCase().split(/\s+/).some((w) => w.startsWith(q)) || p.name.toLowerCase().includes(q));
    $('people').innerHTML = list.map((p) => `<button type="button" class="person" data-p="${p.id}"><span>${esc(p.name)}</span>${p.song ? '<i title="Song sent">♪</i>' : ''}</button>`).join('') || '<p class="tiny">No name found — tap “I’m not on the list”.</p>';
  }
  $('who').addEventListener('input', renderPeople);
  $('people').addEventListener('click', (e) => { const b = e.target.closest('[data-p]'); if (!b) return; me = +b.dataset.p; free = false; ls.set(ME, String(me)); editing = false; load(true); window.scrollTo({ top: 0 }); });
  $('notListed').addEventListener('click', () => { me = null; free = true; ls.set(ME, ''); editing = false; load(true); });
  $('changeMe').addEventListener('click', () => { me = null; free = false; ls.set(ME, ''); editing = false; load(true); });

  // ---- personal area
  const label = { Received: 'Received', Composed: 'In the studio', 'In Production': 'In the studio', Ready: 'Ready', Error: 'In the studio' };
  function renderPerson() {
    if (!me) return;
    const p = st.person;
    $('pName').textContent = p.name;
    $('pTable').textContent = p.table ? 'Table ' + p.table.number + (p.table.name ? ' · ' + p.table.name : '') : 'Drawn at dinner';
    $('pSeat').textContent = p.table ? (p.seat ? 'Seat ' + p.seat : 'Pick your seat') : 'from the glass jar ✦';
    $('pMenu').textContent = p.menu || 'Not on file — ask the organizer';
  }
  const myLink = () => location.origin + '/sing/' + T + (me ? '#p=' + me : '#k=' + ls.get(KEY));
  function linkBox(el) {
    el.innerHTML = `<div class="linkbox"><b>Your personal link</b><span>Open your page on any phone or computer — or send it to yourself.</span>
      <div class="row2"><button type="button" class="btn btn-sm btn-gold" data-share>Share / save link</button><button type="button" class="btn btn-sm" data-copylink>Copy link</button></div></div>`;
  }
  document.addEventListener('click', async (e) => {
    if (e.target.closest('[data-copylink]')) copyText(myLink(), 'Your link');
    if (e.target.closest('[data-share]')) { if (navigator.share) { try { await navigator.share({ title: 'My Christmas song', url: myLink() }); } catch (_) {} } else copyText(myLink(), 'Your link'); }
  });
  function render() {
    if (!me && !free) { renderPeople(); return show('whoView'); }
    renderPerson();
    $('nameField').classList.toggle('hidden', !!me);
    if (st.song) {
      const s = st.song;
      $('sEyebrow').textContent = s.finalist ? '🏆 Your song is in the final!' : 'Your song is ready';
      $('sTitle').textContent = s.title; $('sLyrics').textContent = s.lyrics.replace(/^\s*\[[^\]]*\]\s*$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
      $('sNote').textContent = s.note || ''; if (s.clip.image) { $('sCover').src = s.clip.image.replace('image_', 'image_large_'); $('sCover').classList.remove('hidden'); } else $('sCover').classList.add('hidden');
      if ($('sAudio').getAttribute('src') !== s.clip.audioUrl) $('sAudio').src = s.clip.audioUrl;
      linkBox($('linkSong')); return show('songView');
    }
    if (st.mine && !editing) {
      const m = st.mine;
      $('mTitle').textContent = m.title || '(no title — the AI will find one)'; $('mLyrics').textContent = m.lyrics;
      $('mStyle').textContent = m.style; $('mStyleBlk').classList.toggle('hidden', !m.style);
      $('doneStatus').textContent = label[m.status] || m.status; $('doneStatus').className = 'status-pill st-' + (m.status === 'Received' ? 'Submitted' : 'In-Production');
      $('editBtn').classList.toggle('hidden', !m.editable);
      $('doneSub').textContent = m.editable ? 'You can still edit it for a few minutes. Then the AI polishes it and sends it to the studio — your song will appear right here.'
        : 'Your song is in the studio. It will appear right here in a few minutes.';
      linkBox($('linkDone')); return show('doneView');
    }
    if (!st.open) { $('fatalTitle').textContent = 'Submissions are closed'; $('fatalMsg').textContent = 'The songs are being produced — enjoy the dinner!'; $('fatal').classList.remove('hidden'); show('fatal'); $('personBar').classList.toggle('hidden', !me); return; }
    $('submitBtn').textContent = st.mine ? 'Update My Song' : 'Submit My Song'; $('cancelEdit').classList.toggle('hidden', !st.mine);
    show('formView');
  }
  async function load(first) {
    try {
      if (!me && !free) { const r = await req(`/api/s/${T}/people`); people = r.people; st = { open: r.open }; }
      else if (me) { st = await req(`/api/s/${T}/p/${me}`); }
      else { st = await req(`/api/s/${T}`); }
      if (first || !editing) render();
    } catch (e) {
      if (e.status === 404 && me) { me = null; ls.set(ME, ''); return load(true); }
      if (first || e.status === 404) { $('fatalMsg').textContent = e.message; show('fatal'); }
    }
  }
  $('form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const body = { name: $('name').value.trim(), title: $('title').value.trim(), lyrics: $('lyrics').value.trim(), style: $('style').value.trim() };
    const m = $('formMsg'); m.classList.add('hidden');
    const err = (!me && !body.name) ? 'Please tell us your name.' : !body.lyrics ? 'Write your lyrics — even a few lines!' : clen(body.lyrics) > 1500 ? 'Lyrics are over 1,500 characters.' : clen(body.style) > 400 ? 'Style is over 400 characters.' : '';
    if (err) { m.textContent = err; m.classList.remove('hidden'); m.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    const btn = $('submitBtn'); btn.disabled = true; const lbl = btn.textContent; btn.textContent = 'Sending…';
    try {
      if (me) await req(`/api/s/${T}/p/${me}/song`, { method: 'POST', body });
      else if (st.mine) await req(`/api/s/${T}/entries/mine`, { method: 'PUT', body });
      else { const r = await req(`/api/s/${T}/entries`, { method: 'POST', body }); ls.set(KEY, r.key); }
      $('doneTitle').textContent = st.mine ? 'Song updated!' : 'Your song is in!';
      editing = false; await load(true); window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { m.textContent = e.message; m.classList.remove('hidden'); }
    finally { btn.disabled = false; btn.textContent = lbl; }
  });
  $('editBtn').addEventListener('click', () => {
    const x = st.mine; editing = true; $('name').value = st.person ? st.person.name : ''; $('title').value = x.title; $('lyrics').value = x.lyrics; $('style').value = x.style;
    counters(); $('submitBtn').textContent = 'Update My Song'; $('cancelEdit').classList.remove('hidden'); show('formView');
  });
  $('cancelEdit').addEventListener('click', () => { editing = false; render(); });
  load(true);
  setInterval(() => { if (!document.hidden && !editing && document.activeElement?.id !== 'who' && !(st && st.song && !$('sAudio').paused)) load(false); }, 15000);
})();
