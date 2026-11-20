(function () {
  const token = decodeURIComponent(location.pathname.split('/').filter(Boolean)[1] || '');
  const $ = (id) => document.getElementById(id);
  const DRAFT_KEY = 'xmas-draft-' + token;
  const fields = ['title', 'theme', 'lyrics', 'style'];
  let state = null; let editing = false; let pollTimer = null;

  function show(view) {
    ['loading', 'fatal', 'formView', 'doneView'].forEach((v) => $(v).classList.toggle('hidden', v !== view));
  }

  // live counters
  function updateCounter(ta) {
    const max = +ta.dataset.max; const n = clen(ta.value);
    const c = document.querySelector(`.counter[data-for="${ta.id}"]`);
    c.textContent = `${n} / ${max}`;
    c.classList.toggle('near', n > max * 0.9 && n <= max);
    c.classList.toggle('over', n > max);
  }
  document.querySelectorAll('textarea[data-max]').forEach((ta) => {
    ta.addEventListener('input', () => { updateCounter(ta); saveDraft(); });
    updateCounter(ta);
  });
  ['title', 'theme'].forEach((f) => $(f).addEventListener('input', saveDraft));

  function saveDraft() {
    try { const d = {}; fields.forEach((f) => (d[f] = $(f).value)); localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch (_) {}
  }
  function loadDraft() { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (_) { return null; } }
  function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch (_) {} }

  function fill(obj) {
    fields.forEach((f) => ($(f).value = (obj && obj[f]) || ''));
    document.querySelectorAll('textarea[data-max]').forEach(updateCounter);
  }

  function renderDone() {
    const s = state.submission; const locked = state.table.locked;
    $('pTitle').textContent = s.title;
    $('pTheme').textContent = s.theme || '';
    $('pTheme').classList.toggle('hidden', !s.theme);
    $('pLyrics').textContent = s.lyrics;
    $('pStyle').textContent = s.style;
    const t = new Date(s.updatedAt);
    $('pTime').textContent = (s.revision > 1 ? 'Last edited ' : 'Submitted ') + t.toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
    const st = locked && s.status === 'Submitted' ? 'Locked' : s.status;
    const label = { Submitted: 'Received', 'In Production': 'In the studio', Ready: 'Ready to play', Played: 'Played tonight', Locked: 'Locked' }[st] || st;
    $('doneStatus').textContent = label;
    $('doneStatus').className = 'status-pill st-' + st.replace(/\s/g, '-');
    $('editBtn').classList.toggle('hidden', locked);
    $('lockedMsg').classList.toggle('hidden', !locked);
    show('doneView');
  }

  function renderForm() {
    $('cancelEdit').classList.toggle('hidden', !state.submission);
    $('submitBtn').textContent = state.submission ? 'Update Our Song' : 'Submit Our Song';
    show('formView');
  }

  async function load(initial) {
    try {
      const data = await api('/api/t/' + encodeURIComponent(token));
      const wasLocked = state && state.table.locked;
      state = data;
      $('badgeText').textContent = 'Table ' + data.table.number + (data.table.name ? ' · ' + data.table.name : '');
      $('badge').classList.remove('hidden');
      document.title = `Table ${data.table.number} · Christmas Music Battle`;
      if (initial) {
        if (data.submission) { fill(data.submission); renderDone(); }
        else { const d = loadDraft(); if (d) fill(d); renderForm(); }
      } else if (!editing && data.submission) {
        renderDone();
      } else if (editing && data.table.locked && !wasLocked) {
        editing = false; renderDone(); toast('The organizer just locked your song', true);
      }
    } catch (e) {
      if (initial || e.status === 404) { $('fatalMsg').textContent = e.message; show('fatal'); }
    }
  }

  $('form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const body = {}; fields.forEach((f) => (body[f] = $(f).value.trim()));
    const msg = $('formMsg'); msg.classList.add('hidden');
    let err = '';
    if (!body.title) err = 'Please give your song a title.';
    else if (!body.lyrics) err = 'Please write your lyrics.';
    else if (!body.style) err = 'Please describe the style of music.';
    else if (clen(body.lyrics) > 1000) err = 'Lyrics are over 1,000 characters — please shorten them.';
    else if (clen(body.style) > 1000) err = 'Style of music is over 1,000 characters — please shorten it.';
    if (err) { msg.textContent = err; msg.classList.remove('hidden'); msg.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    const btn = $('submitBtn'); btn.disabled = true; const label = btn.textContent; btn.textContent = 'Sending…';
    try {
      const r = await api('/api/t/' + encodeURIComponent(token), { method: 'PUT', body });
      const isUpdate = !!state.submission;
      state.submission = r.submission; editing = false; clearDraft();
      $('doneTitle').textContent = isUpdate ? 'Song updated!' : 'Your song is in!';
      renderDone(); window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      msg.textContent = e.message; msg.classList.remove('hidden');
      if (e.status === 423) { state.table.locked = true; setTimeout(() => { editing = false; state.submission ? renderDone() : null; }, 1800); }
    } finally { btn.disabled = false; btn.textContent = label; }
  });

  $('editBtn').addEventListener('click', () => { editing = true; fill(state.submission); renderForm(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  $('cancelEdit').addEventListener('click', () => { editing = false; renderDone(); });

  load(true);
  pollTimer = setInterval(() => { if (!document.hidden) load(false); }, 20000);
})();
