// Shared helpers: decorations, toasts, clipboard, fetch
(function () {
  // Evergreen garland with red berries and a gold star
  window.garlandSVG = function (cls) {
    let up = '', down = '';
    for (let x = 18; x < 300; x += 6) {
      const l = 10 + (x % 9);
      up += `M${x} 40 q${3} ${-l * 0.5} ${8} ${-l} `;
      down += `M${x} 40 q${3} ${l * 0.5} ${8} ${l} `;
    }
    const berries = [[70, 46], [78, 50], [74, 38], [232, 46], [240, 50], [236, 38], [118, 34], [196, 52]]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.2" fill="#B4232F"/><circle cx="${x - 1.3}" cy="${y - 1.4}" r="1.2" fill="#FFB3B8" opacity=".7"/>`).join('');
    return `<svg class="garland ${cls || ''}" viewBox="0 0 320 80" aria-hidden="true">
      <defs><linearGradient id="gg" x1="0" x2="1"><stop offset="0" stop-color="#2E8296" stop-opacity="0"/><stop offset=".15" stop-color="#2F7A64"/><stop offset=".85" stop-color="#2F7A64"/><stop offset="1" stop-color="#2E8296" stop-opacity="0"/></linearGradient></defs>
      <path d="M10 40 C 90 32, 230 48, 310 40" stroke="#5C4A2A" stroke-width="1.5" fill="none"/>
      <path d="${up}" stroke="url(#gg)" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      <path d="${down}" stroke="url(#gg)" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".85"/>
      ${berries}
      <g transform="translate(160 40)"><path d="M0 -15 L4 -4 L15 -4 L6 3 L9 14 L0 7 L-9 14 L-6 3 L-15 -4 L-4 -4 Z" fill="#D5B26A" stroke="#F3E6C8" stroke-width=".6"/></g>
    </svg>`;
  };
  document.querySelectorAll('[data-garland]').forEach((el) => { el.innerHTML = garlandSVG(el.dataset.garland); });

  // Ambient candle-dust / snow
  const amb = document.createElement('div');
  amb.className = 'ambient';
  for (let i = 0; i < 26; i++) {
    const s = document.createElement('i');
    s.style.left = Math.random() * 100 + '%';
    s.style.animationDuration = 9 + Math.random() * 12 + 's';
    s.style.animationDelay = -Math.random() * 20 + 's';
    const z = 1 + Math.random() * 2.5; s.style.width = s.style.height = z + 'px';
    amb.appendChild(s);
  }
  document.body.prepend(amb);

  let tt;
  window.toast = function (text, isErr) {
    let t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = text; t.classList.toggle('err', !!isErr); t.classList.add('show');
    clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2400);
  };

  window.copyText = async function (text, label) {
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
      else {
        const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
      }
      toast((label || 'Text') + ' copied ✓');
    } catch (e) { toast('Copy failed — please select and copy manually', true); }
  };

  window.api = async function (url, opts = {}) {
    const o = { method: opts.method || 'GET', headers: {}, credentials: 'same-origin' };
    if (opts.body !== undefined) { o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(opts.body); }
    let res;
    try { res = await fetch(url, o); } catch (e) { const err = new Error('No connection. Check your signal and try again.'); err.status = 0; throw err; }
    let data = {}; try { data = await res.json(); } catch (_) {}
    if (!res.ok) { const err = new Error(data.error || 'Request failed (' + res.status + ')'); err.status = res.status; throw err; }
    return data;
  };

  // Guest navigation: the same three tabs on Home, My page and Karaoke.
  const navEl = document.getElementById('nav');
  if (navEl) {
    const active = navEl.dataset.active;
    const tab = (id, href, icon, label) => `<a class="navtab ${active === id ? 'on' : ''}" href="${href}" ${active === id ? 'aria-current="page"' : ''}><span>${icon}</span>${label}</a>`;
    navEl.innerHTML = tab('home', '/', '🏠', 'Home') + tab('me', location.pathname.startsWith('/sing/') ? location.pathname : '/me', '✍️', 'My page') + tab('karaoke', '/karaoke', '🎤', 'Karaoke');
  }
  window.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  window.clen = (s) => Array.from(s || '').length;
})();
