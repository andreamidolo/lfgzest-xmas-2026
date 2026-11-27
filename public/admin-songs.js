// v4 — individual songs dashboard
(function () {
  const $ = (id) => document.getElementById(id);
  let V = null, sig = '', open = new Set();
  const playing = () => [...document.querySelectorAll('#tab-songs audio')].some((a) => !a.paused);
  const stLabel = { Received: 'Waiting', Composed: 'Composed', 'In Production': 'In the studio', Ready: 'Ready', Error: 'Error' };
  async function act(url, method, body, msg) { try { await api(url, { method, body }); if (msg) toast(msg); await load(true); return true; } catch (e) { toast(e.message, true); return false; } }

  async function load(force) {
    if (!document.getElementById('appView') || document.getElementById('appView').classList.contains('hidden')) return;
    try { V = await api('/api/admin/v4'); } catch (e) { return; }
    const s = JSON.stringify(V);
    if (!force && (s === sig || playing())) return; sig = s;
    render();
  }
  const clip = (e) => { const p = e.production; if (!p || !p.clips || !p.clips.length) return null; return p.clips.find((c) => c.id === p.selected) || p.clips[0]; };
  const audioUrl = (c) => c.audioUrl || `https://cdn1.suno.ai/${c.id}.mp4`;
  function render() {
    const ev = V.event, es = V.entries;
    $('openBtn').textContent = ev.open ? '🔓 Submissions open · Close' : '🔒 Submissions closed · Reopen';
    $('openBtn').classList.toggle('btn-gold', !ev.open);
    if ($('evUrl').textContent !== ev.url) { $('evUrl').textContent = ev.url; $('evOpen').href = ev.url; $('evQr').src = '/api/admin/event/qr.png?v=' + ev.token.slice(0, 6); }
    const cnt = (f) => es.filter(f).length;
    const stats = [['Songs', es.length], ['Ready', cnt((e) => e.status === 'Ready')], ['In studio', cnt((e) => ['Composed', 'In Production'].includes(e.status))],
      ['Waiting', cnt((e) => e.status === 'Received')], ['Finalists', cnt((e) => e.finalist) + '/3'], ['Guests', V.participants.length ? `${new Set(es.map((e) => e.participantId).filter(Boolean)).size}/${V.participants.length}` : '–']];
    $('evStats').innerHTML = stats.map(([l, v]) => `<div><b>${v}</b><span>${l}</span></div>`).join('');
    const fins = es.filter((e) => e.finalist);
    $('fslots').innerHTML = [0, 1, 2].map((i) => { const e = fins[i]; if (!e) return `<div class="fslot"><span class="tiny">Finalist ${i + 1} — pick with ★ below or use “Suggest top 3”</span></div>`;
      const c = clip(e); return `<div class="fslot on">${c && c.image ? `<img src="${esc(c.image)}" alt="">` : ''}<div><b>${esc(e.songTitle || e.title || 'Untitled')}</b><span class="tiny">${esc(e.name)} · Effort ${e.effort.total}</span>
        <div class="row2" style="margin-top:6px"><a class="btn btn-sm" href="/admin/karaoke/${e.id}" target="_blank" rel="noopener">▶ Karaoke</a><button class="btn btn-sm btn-ghost" data-unfin="${e.id}">Remove</button></div></div></div>`; }).join('');
    const list = [...es].sort($('sortBy').value === 'new' ? (a, b) => b.id - a.id : (a, b) => b.effort.total - a.effort.total || a.id - b.id);
    $('entries').innerHTML = list.map((e) => {
      const c = clip(e); const p = e.effort.parts;
      return `<div class="ent ${e.hidden ? 'hid' : ''} ${e.finalist ? 'fin' : ''} ${open.has(e.id) ? 'open' : ''}" data-e="${e.id}">
        <div class="ent-row" data-toggle>
          ${c && c.image ? `<img src="${esc(c.image)}" alt="">` : '<div class="ph">♪</div>'}
          <div class="t"><b>${esc(e.songTitle || e.title || 'Untitled')}</b><small>${esc(e.name)}${e.language ? ' · ' + ({ it: '🇮🇹', en: '🇬🇧', es: '🇪🇸' })[e.language] : ''} · ${new Date(e.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}${e.hidden ? ' · hidden' : ''}</small></div>
          <div class="score" title="Lyrics ${p.lyrics}/45 · Structure ${p.structure}/5 · Style ${p.style}/15 · Title ${p.title}/5 · AI ${p.ai == null ? '–' : p.ai}/30"><b>${e.effort.total}</b><span>EFFORT</span></div>
          <div class="ent-acts">
            <span class="status-pill st-${e.status.replace(/\s/g, '-')}">${stLabel[e.status] || e.status}</span>
            ${c && e.status === 'Ready' ? `<audio controls preload="none" src="${esc(audioUrl(c))}" style="height:32px;max-width:220px"></audio>` : ''}
            ${e.status === 'Ready' && !e.hidden ? `<button class="btn btn-sm ${e.finalist ? 'btn-gold' : ''}" data-fin="${e.id}" title="Finalist">${e.finalist ? '★ Finalist' : '☆ Final'}</button>` : ''}
          </div>
        </div>
        <div class="ent-det">
          <div><span class="eyebrow">What ${esc(e.name)} wrote</span>${e.title ? `<p class="tiny" style="margin:4px 0 0">Title: ${esc(e.title)}</p>` : ''}<pre>${esc(e.lyrics)}</pre>${e.style ? `<p class="tiny" style="margin:8px 0 0">Style: ${esc(e.style)}</p>` : ''}${e.language ? `<p class="tiny" style="margin:4px 0 0">Language: ${({ it: '🇮🇹 Italiano', en: '🇬🇧 English', es: '🇪🇸 Español' })[e.language] || e.language}</p>` : ''}</div>
          <div><span class="eyebrow">Sent to Suno</span>${e.songLyrics ? `<pre>${esc(e.songLyrics)}</pre><p class="tiny" style="margin:8px 0 0">Style: ${esc(e.songStyle || '')}</p>` : '<p class="tiny">Not composed yet.</p>'}</div>
          <div class="full breakdown">Effort ${e.effort.total}/100 — lyrics ${p.lyrics}/45 · structure ${p.structure}/5 · own style ${p.style}/15 · title ${p.title}/5 · care & originality (AI) ${p.ai == null ? 'pending' : p.ai + '/30'}${e.effortNote ? ' — ' + esc(e.effortNote) : ''}${e.aiNote ? `<br>AI note: ${esc(e.aiNote)}` : ''}</div>
          <div class="full row2">
            ${c ? `<a class="btn btn-sm" href="/admin/karaoke/${e.id}" target="_blank" rel="noopener">▶ Karaoke preview</a><a class="btn btn-sm" href="https://suno.com/song/${esc(c.id)}" target="_blank" rel="noopener">Suno ↗</a>` : ''}
            <button class="btn btn-sm" data-hide="${e.id}">${e.hidden ? 'Show again' : 'Hide'}</button>
            <button class="btn btn-sm" data-redo="${e.id}">↻ Redo song</button>
            <button class="btn btn-sm btn-ghost btn-danger" data-del="${e.id}">Delete</button>
          </div>
        </div></div>`;
    }).join('') || '<p class="muted">No songs yet — share the QR!</p>';
  }
  document.addEventListener('click', (ev) => {
    const t = ev.target; if (!t.closest('#tab-songs')) return;
    const g = (a) => t.closest(`[${a}]`); let b;
    if ((b = g('data-fin'))) { const id = +b.dataset.fin; const e = V.entries.find((x) => x.id === id); return act(`/api/admin/entries/${id}`, 'PATCH', { finalist: !e.finalist }, e.finalist ? 'Removed from the final' : '★ Added to the final'); }
    if ((b = g('data-unfin'))) return act(`/api/admin/entries/${b.dataset.unfin}`, 'PATCH', { finalist: false }, 'Removed from the final');
    if ((b = g('data-hide'))) { const id = +b.dataset.hide; const e = V.entries.find((x) => x.id === id); return act(`/api/admin/entries/${id}`, 'PATCH', { hidden: !e.hidden }, e.hidden ? 'Visible again' : 'Hidden'); }
    if ((b = g('data-redo'))) return confirm('Compose and produce this song again (uses Suno credits)?') && act(`/api/admin/entries/${b.dataset.redo}/redo`, 'POST', undefined, 'Queued again');
    if ((b = g('data-del'))) return confirm('Delete this song for good?') && act(`/api/admin/entries/${b.dataset.del}`, 'DELETE', undefined, 'Deleted');
    if (t.closest('audio, button, a')) return;
    if ((b = g('data-toggle'))) { const id = +b.closest('[data-e]').dataset.e; open.has(id) ? open.delete(id) : open.add(id); b.closest('.ent').classList.toggle('open'); }
  });
  $('openBtn').addEventListener('click', () => act('/api/admin/event', 'PATCH', { open: !V.event.open }, V.event.open ? 'Submissions closed' : 'Submissions open'));
  $('autoFinal').addEventListener('click', () => confirm('Replace the finalists with the top 3 finished songs by Effort Score?') && act('/api/admin/entries/finalists/auto', 'POST', undefined, 'Top 3 selected — check and adjust'));
  $('evCopy').addEventListener('click', () => copyText(V.event.url, 'Link'));
  $('evRegen').addEventListener('click', () => confirm('Create a new link? The old QR stops working.') && act('/api/admin/event/regenerate', 'POST', undefined, 'New link — reprint the QR'));
  $('sortBy').addEventListener('change', () => render());
  setInterval(() => { if (!document.hidden) load(false); }, 4000);
  const obs = new MutationObserver(() => load(true)); obs.observe(document.getElementById('appView'), { attributes: true, attributeFilter: ['class'] });
  load(true);
})();
