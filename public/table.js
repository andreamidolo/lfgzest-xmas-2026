(function () {
  const token = decodeURIComponent(location.pathname.split('/').filter(Boolean)[1] || '');
  const $ = (id) => document.getElementById(id);
  const KEY = 'xmas-idea-' + token;
  let state = null; let editing = false; let vibe = '';
  const getKey = () => { try { return localStorage.getItem(KEY) || ''; } catch (_) { return ''; } };
  const setKey = (k) => { try { localStorage.setItem(KEY, k); } catch (_) {} };
  const show = (v) => ['loading', 'fatal', 'formView', 'doneView', 'songView'].forEach((x) => $(x).classList.toggle('hidden', x !== v));
  const req = (url, opts = {}) => fetch(url, { method: opts.method || 'GET', headers: { 'Content-Type': 'application/json', 'x-idea': getKey() },
    body: opts.body ? JSON.stringify(opts.body) : undefined }).then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok) { const e = new Error(d.error || 'Something went wrong'); e.status = r.status; throw e; } return d; },
    () => { throw new Error('No connection. Check your signal and try again.'); });

  const ta = $('idea');
  function counter() { const n = clen(ta.value); const c = document.querySelector('.counter[data-for="idea"]'); c.textContent = `${n} / 160`; c.classList.toggle('near', n > 140 && n <= 160); c.classList.toggle('over', n > 160); }
  ta.addEventListener('input', counter); counter();
  function renderVibes(list) {
    $('vibes').innerHTML = list.map((v) => `<button type="button" class="vibe" role="radio" aria-checked="${v === vibe}" data-v="${esc(v)}">${esc(v)}</button>`).join('');
  }
  $('vibes').addEventListener('click', (e) => { const b = e.target.closest('.vibe'); if (!b) return; vibe = vibe === b.dataset.v ? '' : b.dataset.v; renderVibes(state.vibes); });

  function render() {
    const s = state;
    $('badgeText').textContent = 'Team ' + s.team.number + (s.team.name ? ' · ' + s.team.name : ''); $('badge').classList.remove('hidden');
    $('teamLine').textContent = 'Team ' + s.team.number + ' — Add your little piece of madness.';
    document.title = `Team ${s.team.number} · Let’s Make a Song`;
    if (s.song) {
      $('sTitle').textContent = s.song.title; $('sConcept').textContent = s.song.concept || '';
      $('sExpl').textContent = s.song.explanation || ''; $('sExpl').parentElement.classList.toggle('hidden', !s.song.explanation);
      $('sListen').classList.toggle('hidden', !s.song.live); $('sSoon').classList.toggle('hidden', s.song.live);
      return show('songView');
    }
    if (editing && s.team.open) return show('formView');
    if (s.mine) {
      $('myIdea').textContent = '“' + s.mine.idea + '” — ' + s.mine.name;
      $('myVibe').textContent = s.mine.vibe ? '♪ ' + s.mine.vibe : '';
      $('editBtn').classList.toggle('hidden', !s.team.open); $('closedMsg').classList.toggle('hidden', s.team.open);
      return show('doneView');
    }
    if (!s.team.open) { $('fatalMsg').textContent = 'Ideas for this team are closed — the AI is composing your song!'; $('fatal').querySelector('h2').textContent = 'Ideas closed'; return show('fatal'); }
    $('cancelEdit').classList.add('hidden'); $('submitBtn').textContent = 'Submit My Idea';
    show('formView');
  }
  async function load(first) {
    try { state = await req('/api/t/' + encodeURIComponent(token)); if (first) renderVibes(state.vibes); if (first || !editing) render(); }
    catch (e) { if (first || e.status === 404) { $('fatalMsg').textContent = e.message; show('fatal'); } }
  }
  $('form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const body = { name: $('name').value.trim(), idea: ta.value.trim(), vibe };
    const m = $('formMsg'); m.classList.add('hidden');
    let err = !body.name ? 'Please tell us your name.' : !body.idea ? 'Please give us an idea!' : clen(body.idea) > 160 ? 'Your idea is over 160 characters — keep it short and sweet.' : '';
    if (err) { m.textContent = err; m.classList.remove('hidden'); return; }
    const btn = $('submitBtn'); btn.disabled = true; const label = btn.textContent; btn.textContent = 'Sending…';
    try {
      const r = state.mine ? await req(`/api/t/${encodeURIComponent(token)}/ideas/mine`, { method: 'PUT', body }) : await req(`/api/t/${encodeURIComponent(token)}/ideas`, { method: 'POST', body });
      if (r.key) setKey(r.key);
      $('doneTitle').textContent = state.mine ? 'Idea updated!' : 'Thank you!';
      state.mine = r.mine; editing = false; render(); window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { m.textContent = e.message; m.classList.remove('hidden'); if (e.status === 423) { state.team.open = false; } }
    finally { btn.disabled = false; btn.textContent = label; }
  });
  $('editBtn').addEventListener('click', () => {
    editing = true; $('name').value = state.mine.name; ta.value = state.mine.idea; vibe = state.mine.vibe || ''; renderVibes(state.vibes); counter();
    $('cancelEdit').classList.remove('hidden'); $('submitBtn').textContent = 'Update My Idea'; show('formView');
  });
  $('cancelEdit').addEventListener('click', () => { editing = false; render(); });
  load(true);
  setInterval(() => { if (!document.hidden) load(false); }, 15000);
})();
