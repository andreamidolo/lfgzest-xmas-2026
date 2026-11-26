/* "La vostra idea è già lanciata" — LFG+Zest Christmas Dinner 2026, opening film.
   Deterministic: everything on screen is a pure function of the song time t (seconds).
   window.seek(t) draws one frame (used by render.js); without ?render the page plays live with the audio.
   Camera language: sheets placed in 3D space, the camera glides from one to the next (cubic-bezier(.65,0,.35,1)). */
(function () {
  'use strict';
  const W = 1920, H = 1080, DUR = 145.56;
  const BRAND = '../../public/brand/';
  const GOLD = '#D5B26A', GOLD_HI = '#EBCB86', CHAMP = '#F3E6C8', BERRY = '#B4232F';

  // ---------- math ----------
  const cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, p) => a + (b - a) * p;
  const E = (p) => { p = cl(p); return p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }; // ≈ cubic-bezier(.65,0,.35,1)
  const EO = (p) => { p = cl(p); return 1 - Math.pow(1 - p, 3); };
  const EB = (p) => { p = cl(p); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); }; // back-out
  const pr = (t, a, b) => cl((t - a) / (b - a));
  const ep = (t, a, b) => E(pr(t, a, b));
  const eo = (t, a, b) => EO(pr(t, a, b));
  const eb = (t, a, b) => EB(pr(t, a, b));
  const win = (t, a, b, fi = .5, fo = .5) => Math.min(eo(t, a, a + fi), 1 - ep(t, b - fo, b)); // fade in/out window
  function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; for (let i = 0; i < 6; i++) { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; } return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  const $ = (root, k) => root.querySelector(`[data-k="${k}"]`);
  const $$ = (root, k) => [...root.querySelectorAll(`[data-k="${k}"]`)];
  const st = (el, o, tf) => { if (!el) return; if (o !== undefined && o !== null) el.style.opacity = o; if (tf !== undefined) el.style.transform = tf; };
  const vis = (el, o) => { el.style.opacity = o; el.style.visibility = o <= 0.001 ? 'hidden' : 'visible'; };
  function letters(text, cls = '') { return [...text].map((c) => `<span class="ch ${cls}" data-k="ch">${c === ' ' ? ' ' : c}</span>`).join(''); }
  function animLetters(root, k, t, t0, dur = .9, stagger = .035) {
    const box = $(root, k); if (!box) return;
    $$(box, 'ch').forEach((c, i) => {
      const p = eo(t, t0 + i * stagger, t0 + i * stagger + dur);
      c.style.opacity = cl(p * 1.4);
      c.style.transform = `translate3d(0,${(1 - p) * 40}px,${(1 - p) * -380}px) rotateX(${(1 - p) * 75}deg)`;
    });
  }

  // ---------- SVG library ----------
  const SVG = {
    garland(w = 900) {
      let up = '', down = '';
      for (let x = 18; x < 300; x += 6) { const l = 10 + (x % 9); up += `M${x} 40 q3 ${-l * .5} 8 ${-l} `; down += `M${x} 40 q3 ${l * .5} 8 ${l} `; }
      const berries = [[70, 46], [78, 50], [74, 38], [232, 46], [240, 50], [236, 38], [118, 34], [196, 52]]
        .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.2" fill="#B4232F"/><circle cx="${x - 1.3}" cy="${y - 1.4}" r="1.2" fill="#FFB3B8" opacity=".7"/>`).join('');
      return `<svg width="${w}" height="${w / 4}" viewBox="0 0 320 80"><defs><linearGradient id="gg${w}" x1="0" x2="1"><stop offset="0" stop-color="#2E8296" stop-opacity="0"/><stop offset=".15" stop-color="#2F7A64"/><stop offset=".85" stop-color="#2F7A64"/><stop offset="1" stop-color="#2E8296" stop-opacity="0"/></linearGradient></defs>
      <path d="M10 40 C 90 32, 230 48, 310 40" stroke="#5C4A2A" stroke-width="1.5" fill="none"/><path d="${up}" stroke="url(#gg${w})" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      <path d="${down}" stroke="url(#gg${w})" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".85"/>${berries}
      <g transform="translate(160 40)"><path d="M0 -15 L4 -4 L15 -4 L6 3 L9 14 L0 7 L-9 14 L-6 3 L-15 -4 L-4 -4 Z" fill="#D5B26A" stroke="#F3E6C8" stroke-width=".6"/></g></svg>`;
    },
    jar(w = 260) { // glass ampolla with folded tickets inside
      const r = rng(7); let tk = '';
      for (let i = 0; i < 16; i++) {
        const x = 70 + r() * 120, y = 205 + r() * 105, a = r() * 180 - 90, c = r() < .2 ? '#D5B26A' : (r() < .2 ? '#B4232F' : '#F3E6C8');
        tk += `<rect data-k="jt" x="${x - 17}" y="${y - 10}" width="34" height="20" rx="3" fill="${c}" opacity=".92" transform="rotate(${a} ${x} ${y})"/>`;
      }
      return `<svg width="${w}" height="${w * 330 / 260}" viewBox="0 0 260 330">
      <defs><linearGradient id="jg" x1="0" x2="1"><stop offset="0" stop-color="#F3E6C8" stop-opacity=".30"/><stop offset=".25" stop-color="#F3E6C8" stop-opacity=".06"/><stop offset=".8" stop-color="#55B6E6" stop-opacity=".05"/><stop offset="1" stop-color="#F3E6C8" stop-opacity=".22"/></linearGradient>
      <radialGradient id="jglow" cx=".5" cy=".7" r=".6"><stop offset="0" stop-color="#EBCB86" stop-opacity=".55"/><stop offset="1" stop-color="#EBCB86" stop-opacity="0"/></radialGradient></defs>
      <ellipse cx="130" cy="250" rx="125" ry="85" fill="url(#jglow)"/>
      ${tk}
      <path d="M92 40 L92 78 C40 100 22 150 22 210 C22 280 60 320 130 320 C200 320 238 280 238 210 C238 150 220 100 168 78 L168 40 Z" fill="url(#jg)" stroke="#F3E6C8" stroke-opacity=".75" stroke-width="3"/>
      <path d="M48 160 C42 200 46 250 70 285" stroke="#fff" stroke-opacity=".55" stroke-width="6" fill="none" stroke-linecap="round"/>
      <rect x="84" y="14" width="92" height="34" rx="8" fill="#8A6230" stroke="#D5B26A" stroke-width="2"/>
      <path d="M86 58 Q130 70 174 58" stroke="#B4232F" stroke-width="7" fill="none"/>
      <circle cx="130" cy="66" r="9" fill="#D5B26A"/></svg>`;
    },
    gift(c1, c2, w = 300) {
      return `<svg width="${w}" height="${w * .8}" viewBox="0 0 300 240"><defs><linearGradient id="gb${c1.slice(1)}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
      <rect x="20" y="10" width="260" height="225" rx="10" fill="url(#gb${c1.slice(1)})" stroke="#F3E6C8" stroke-opacity=".25" stroke-width="2"/>
      <rect x="132" y="10" width="36" height="225" fill="#D5B26A"/><rect x="132" y="10" width="10" height="225" fill="#F3E6C8" opacity=".35"/></svg>`;
    },
    lid(w = 330) {
      return `<svg width="${w}" height="${w * 150 / 330}" viewBox="0 0 330 150"><rect x="5" y="80" width="320" height="62" rx="10" fill="#9B1B27" stroke="#F3E6C8" stroke-opacity=".3" stroke-width="2"/>
      <rect x="147" y="80" width="36" height="62" fill="#D5B26A"/>
      <path d="M165 82 C120 20 70 30 95 70 C105 86 140 84 165 82 Z" fill="#D5B26A" stroke="#F3E6C8" stroke-width="2"/>
      <path d="M165 82 C210 20 260 30 235 70 C225 86 190 84 165 82 Z" fill="#D5B26A" stroke="#F3E6C8" stroke-width="2"/><circle cx="165" cy="82" r="13" fill="#EBCB86"/></svg>`;
    },
    grill(w = 520) {
      return `<svg width="${w}" height="${w * 460 / 520}" viewBox="0 0 520 460">
      <g data-k="flames">
        <path data-k="fl" d="M180 230 C150 170 200 140 190 80 C240 120 250 170 230 230 Z" fill="#E7B55B"/>
        <path data-k="fl" d="M250 230 C215 150 280 120 262 40 C330 100 330 170 300 230 Z" fill="#D5B26A"/>
        <path data-k="fl" d="M320 230 C300 175 345 150 340 95 C385 140 385 190 365 230 Z" fill="#E7B55B"/>
        <path data-k="fl" d="M215 232 C205 195 235 180 232 140 C262 170 265 205 255 232 Z" fill="#B4232F" opacity=".85"/>
        <path data-k="fl" d="M290 232 C280 200 305 185 305 150 C335 180 335 210 325 232 Z" fill="#B4232F" opacity=".85"/>
      </g>
      <path d="M90 235 L430 235 C430 330 360 375 260 375 C160 375 90 330 90 235 Z" fill="#0E6E80" stroke="#F3E6C8" stroke-opacity=".5" stroke-width="3"/>
      <path d="M115 255 C130 320 190 350 260 352" stroke="#55B6E6" stroke-opacity=".5" stroke-width="6" fill="none" stroke-linecap="round"/>
      <g stroke="#D5B26A" stroke-width="4">${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<line x1="${110 + i * 43}" y1="228" x2="${110 + i * 43}" y2="238"/>`).join('')}<line x1="80" y1="233" x2="440" y2="233"/></g>
      <g stroke="#8299A0" stroke-width="7" stroke-linecap="round"><line x1="170" y1="360" x2="130" y2="450"/><line x1="350" y1="360" x2="390" y2="450"/><line x1="260" y1="375" x2="260" y2="450"/></g>
      <circle cx="260" cy="300" r="10" fill="#D5B26A"/></svg>`;
    },
    sun(w = 300) {
      let rays = ''; for (let i = 0; i < 16; i++) { const a = i * 22.5; rays += `<rect x="146" y="6" width="8" height="${i % 2 ? 40 : 56}" rx="4" fill="#EBCB86" transform="rotate(${a} 150 150)"/>`; }
      return `<svg width="${w}" height="${w}" viewBox="0 0 300 300"><defs><radialGradient id="sg"><stop offset="0" stop-color="#FFF1C9"/><stop offset=".7" stop-color="#EBCB86"/><stop offset="1" stop-color="#D5B26A"/></radialGradient></defs>
      <g data-k="rays">${rays}</g><circle cx="150" cy="150" r="78" fill="url(#sg)"/></svg>`;
    },
    note(w = 60, c = GOLD) {
      return `<svg width="${w}" height="${w * 1.4}" viewBox="0 0 40 56"><ellipse cx="13" cy="45" rx="11" ry="8" transform="rotate(-22 13 45)" fill="${c}"/><rect x="21.5" y="5" width="3.6" height="40" fill="${c}"/><path d="M25 5 C31 11 39 13 36 26 C34 19 30 16 25 15 Z" fill="${c}"/></svg>`;
    },
    trophy(w = 140) {
      return `<svg width="${w}" height="${w * 1.15}" viewBox="0 0 140 160"><defs><linearGradient id="tg" x1="0" x2="1"><stop offset="0" stop-color="#B0852F"/><stop offset=".45" stop-color="#F7DE9C"/><stop offset="1" stop-color="#B0852F"/></linearGradient></defs>
      <path d="M30 10 H110 V50 C110 80 92 98 70 98 C48 98 30 80 30 50 Z" fill="url(#tg)"/><path d="M30 22 H10 C10 50 22 62 36 64" stroke="#D5B26A" stroke-width="7" fill="none"/><path d="M110 22 H130 C130 50 118 62 104 64" stroke="#D5B26A" stroke-width="7" fill="none"/>
      <rect x="62" y="96" width="16" height="26" fill="#D5B26A"/><rect x="38" y="120" width="64" height="16" rx="3" fill="url(#tg)"/><rect x="28" y="136" width="84" height="18" rx="3" fill="#8A6230"/>
      <path d="M52 26 C50 50 56 66 66 74" stroke="#fff" stroke-opacity=".6" stroke-width="6" fill="none" stroke-linecap="round"/></svg>`;
    },
  };

  // LFG+Zest and LFA, same weight, side by side (with gold light sweep layers)
  function logoPair(sz, sweepKey) {
    const one = (f, x) => `<div class="abs p3" data-k="lg" style="left:${x}px;top:0;width:${sz}px;height:${sz}px"><img src="${BRAND}${f}" style="width:${sz}px;height:${sz}px;filter:drop-shadow(0 0 30px rgba(213,178,106,.45))">
      <div class="abs" data-k="${sweepKey}" style="inset:0;-webkit-mask:url(${BRAND}${f}) center/contain no-repeat;background:linear-gradient(105deg,transparent 38%,rgba(255,236,190,1) 50%,transparent 62%);background-size:300% 100%"></div></div>`;
    const gap = sz * .35, w = sz * 2 + gap;
    return `<div class="abs p3" style="left:${(700 - w) / 2}px;top:0;width:${w}px;height:${sz}px">${one('lfg-zest-white.png', 0)}
      <div class="abs" style="left:${sz + gap / 2 - 1}px;top:${sz * .12}px;width:2px;height:${sz * .76}px;background:linear-gradient(transparent,rgba(213,178,106,.8),transparent)"></div>${one('lfa-white.png', sz + gap)}</div>`;
  }

  // QR-like pattern (stylised, not a real code)
  function qrSVG(size, fill) {
    const n = 25, m = size / n, r = rng(42); let s = '';
    const finder = (x, y) => (x >= 0 && x < 7 && y >= 0 && y < 7) ? ((x === 0 || x === 6 || y === 0 || y === 6) || (x >= 2 && x <= 4 && y >= 2 && y <= 4)) : null;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      let on = finder(x, y); if (on === null) on = finder(x - 18, y); if (on === null) on = finder(x, y - 18);
      if (on === null) { if ((x === 7 || y === 7 || (x === 17 && y < 8) || (y === 17 && x < 8))) on = false; else on = r() < .5; }
      if (on) s += `<rect x="${x * m + .6}" y="${y * m + .6}" width="${m - 1.2}" height="${m - 1.2}" rx="${m * .18}"/>`;
    }
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="${fill}">${s}</svg>`;
  }

  // ---------- lyrics ----------
  const LY = window.LYRICS || [];
  const CHORUS = [[57.5, 74.25], [91.7, 108.45]];
  const inChorus = (t) => CHORUS.some(([a, b]) => t >= a && t < b);
  // split long lines into readable chunks
  const CHUNKS = [];
  LY.forEach((ln) => {
    let cur = [], len = 0;
    const push = () => { if (cur.length) CHUNKS.push(cur); cur = []; len = 0; };
    ln.w.forEach((w, i) => {
      cur.push(w); len += w[0].length + 1;
      const punct = /[,.:;!?…]$/.test(w[0]);
      const nxt = ln.w[i + 1];
      if ((punct && len > 16) || len > 40 || (nxt && len + nxt[0].length > 44)) push();
    });
    push();
  });
  CHUNKS.forEach((c, i) => {
    c.s = c[0][1]; const last = c[c.length - 1];
    const nx = CHUNKS[i + 1];
    c.end = last[2];
    c.hide = Math.min(nx ? nx[0][1] - .08 : 1e9, last[2] + 1.6);
    c.show = c.s - .28;
  });
  // fix show times so a chunk appears right after the previous one hides
  const subline = () => document.getElementById('subline');
  let subCur = -1;
  function wordPaint(span, w, t, dim = .42) {
    const [, s, e] = w;
    if (t < s) { span.style.backgroundImage = `linear-gradient(90deg,rgba(243,230,200,${dim}),rgba(243,230,200,${dim}))`; span.style.filter = 'none'; span.style.transform = ''; return; }
    if (t >= e + .12) { span.style.backgroundImage = `linear-gradient(90deg,${CHAMP},${CHAMP})`; span.style.filter = 'none'; span.style.transform = ''; return; }
    const p = cl((t - s) / Math.max(.08, e - s)) * 100;
    span.style.backgroundImage = `linear-gradient(90deg,${GOLD_HI} 0%,${GOLD} ${p}%,rgba(243,230,200,${dim}) ${Math.min(100, p + 4)}%)`;
    span.style.filter = 'drop-shadow(0 0 16px rgba(213,178,106,.65))';
    span.style.transform = 'translateY(-3px) scale(1.04)';
  }
  function drawSubs(t) {
    const el = subline();
    const near = !inChorus(t) && CHUNKS.some((c) => t > c.show - .6 && t < c.hide + .8);
    const bandEl = document.getElementById('subs');
    const bd = Math.max(0, ...CHUNKS.map((c) => Math.min(eo(t, c.show - .6, c.show), 1 - eo(t, c.hide + .2, c.hide + .8))));
    bandEl.style.backgroundImage = `linear-gradient(to top,rgba(2,14,18,${.88 * (near ? bd : 0)}) 0%,rgba(2,14,18,${.62 * (near ? bd : 0)}) 45%,rgba(2,14,18,0) 100%)`;
    let idx = -1;
    if (!inChorus(t)) for (let i = 0; i < CHUNKS.length; i++) { const c = CHUNKS[i]; if (t >= c.show && t < c.hide) { idx = i; break; } }
    if (idx !== subCur) {
      subCur = idx;
      el.innerHTML = idx < 0 ? '' : CHUNKS[idx].map((w) => `<span class="sw">${w[0]}</span>`).join(' ');
    }
    if (idx < 0) return;
    const c = CHUNKS[idx];
    const a = Math.min(eo(t, c.show, c.show + .22), 1 - eo(t, c.hide - .2, c.hide));
    el.style.opacity = a; el.style.transform = `translateY(${(1 - a) * 14}px)`;
    [...el.children].forEach((sp, i) => wordPaint(sp, c[i], t));
  }

  // big karaoke title for the choruses
  function bigLyricsHTML(lines) {
    return lines.map((ln, li) => `<div class="abs p3 center-x" data-k="bl" data-i="${li}" style="top:0;font:italic 500 116px/1.12 var(--serif);padding:0 120px;white-space:normal">${ln.w.map((w) => `<span class="sw p3" data-k="bw" style="padding:0 .02em">${w[0]}</span>`).join(' ')}</div>`).join('');
  }
  function bigLyrics(root, lines, t, top = 560) {
    $$(root, 'bl').forEach((el, li) => {
      const ln = lines[li], nx = lines[li + 1];
      const tin = ln.w[0][1] - .45, tout = nx ? nx.w[0][1] - .35 : ln.w[ln.w.length - 1][2] + 1.4;
      const a = Math.min(eo(t, tin, tin + .5), 1 - ep(t, tout, tout + .5));
      vis(el, a);
      if (a <= 0) return;
      const back = ep(t, tout, tout + .5);
      el.style.transform = `translate3d(0,${top - el.offsetHeight / 2 - back * 80}px,${-back * 500}px)`;
      [...el.querySelectorAll('[data-k="bw"]')].forEach((sp, i) => {
        const w = ln.w[i]; const p = eb(t, w[1] - .3, w[1] + .25);
        wordPaint(sp, w, t, .30);
        sp.style.transform = `translate3d(0,${(1 - p) * 30}px,${(1 - p) * -260}px) rotateX(${(1 - p) * 60}deg)` + (t >= w[1] && t < w[2] + .12 ? ' scale(1.05)' : '');
        sp.style.opacity = cl(.25 + p);
      });
    });
  }
  const linesIn = (a, b) => LY.filter((l) => l.w[0][1] >= a && l.w[0][1] < b);

  // ---------- scenes ----------
  const B = [0, 4.45, 12.15, 16.5, 31.05, 37.8, 41.5, 50.35, 57.55, 74.2, 79.75, 83.45, 91.75, 108.35, 112.05, DUR];
  const S = [];
  const scene = (o) => { S.push(o); return o; };
  const lay = (i, o) => Object.assign({ x: i * 2600, y: 0, z: 0, rx: 0, ry: 0, rz: 0 }, o);

  // 0 · Benvenuti
  scene({
    pose: lay(0, {}), frame: false,
    html: `<div class="abs" data-k="halo" style="left:660px;top:60px;width:600px;height:600px;border-radius:50%;background:radial-gradient(circle,rgba(235,203,134,.45),rgba(213,178,106,.12) 45%,transparent 70%)"></div>
      <div class="abs p3" data-k="logo" style="left:610px;top:190px;width:700px;height:300px">
        ${logoPair(260, 'sweep')}</div>
      <div class="abs eyebrow center-x" data-k="eb" style="top:110px">Cena di Natale · 2026</div>
      <div class="abs disp center-x" data-k="t1" style="top:540px;font-size:58px">Signore e signori,</div>
      <div class="abs disp center-x glow p3" data-k="t2" style="top:615px;font:italic 500 170px/1.05 var(--serif);color:var(--gold)">${letters('Benvenuti!')}</div>
      <div class="abs" data-k="gar" style="left:510px;top:805px">${SVG.garland(900)}</div>`,
    update(r, t) {
      const z = lerp(-2600, 0, ep(t, .2, 2.3));
      st($(r, 'logo'), cl(pr(t, .2, 1.2)), `translateZ(${z}px) rotateY(${lerp(38, 0, ep(t, .2, 2.4))}deg)`);
      $$(r, 'sweep').forEach((sw, i) => { sw.style.backgroundPosition = `${lerp(130, -30, ep(t, 2.0 + i * .25, 3.1 + i * .25))}% 0`; });
      st($(r, 'halo'), cl(pr(t, 1.2, 2.4)) * (.75 + .25 * Math.sin(t * 2.2)), `scale(${lerp(.4, 1, eo(t, 1.2, 3))})`);
      st($(r, 'eb'), eo(t, 1.3, 2.3), `translateY(${(1 - eo(t, 1.3, 2.3)) * 16}px)`); $(r, 'eb').style.letterSpacing = `${lerp(.7, .34, eo(t, 1.3, 2.6))}em`;
      st($(r, 't1'), eo(t, 1.5, 2.3), `translateY(${(1 - eo(t, 1.5, 2.3)) * 20}px)`);
      animLetters(r, 't2', t, 2.85, .8, .045);
      const g = eo(t, 3.3, 4.2); st($(r, 'gar'), g, `scaleX(${lerp(.3, 1, g)})`);
    },
    bursts: [{ t: 3.05, x: 960, y: 700, n: 70, sp: 520 }],
  });

  // 1 · Grigliata estiva
  scene({
    pose: lay(1, { y: -300, z: -600, ry: -16 }), frame: true,
    html: `<div class="abs eyebrow" data-k="eb" style="left:200px;top:150px">Una sorpresa</div>
      <div class="abs p3" data-k="cal" style="left:240px;top:250px;width:470px;height:520px">
        <div class="abs card" data-k="calback" style="inset:0;overflow:hidden">
          <div style="height:110px;background:linear-gradient(90deg,#0E6E80,#2E8296);display:flex;align-items:center;justify-content:center" class="eyebrow"><span style="color:#F3E6C8">Prossimo incontro</span></div>
          <div class="abs" data-k="sunsm" style="left:115px;top:140px">${SVG.sun(240)}</div>
          <div class="abs disp center-x" style="left:0;width:470px;top:385px;font:italic 500 92px/1 var(--serif);color:var(--gold)">Estate</div></div>
        <div class="abs p3" data-k="page" style="inset:0;transform-origin:50% 0;backface-visibility:hidden">
          <div class="abs card" style="inset:0;overflow:hidden;backface-visibility:hidden">
            <div style="height:110px;background:linear-gradient(90deg,#83021A,#B4232F);display:flex;align-items:center;justify-content:center" class="eyebrow"><span style="color:#F3E6C8">Prossimo incontro</span></div>
            <div class="abs disp" style="left:0;width:470px;text-align:center;top:250px;font:italic 500 96px/1 var(--serif)">Dicembre</div>
            <div class="abs" data-k="strike" style="left:50px;top:300px;height:8px;width:370px;background:var(--gold);border-radius:4px;transform-origin:0 50%;box-shadow:0 0 18px rgba(213,178,106,.8)"></div></div></div></div>
      <div class="abs disp glow p3" data-k="tt" style="left:870px;top:170px;font:italic 500 112px/1 var(--serif);color:var(--gold)">${letters('Grigliata estiva')}</div>
      <div class="abs eyebrow" data-k="ann" style="left:880px;top:315px;color:var(--champagne)">annuale · tutti insieme</div>
      <div class="abs" data-k="sun" style="left:1250px;top:330px">${SVG.sun(340)}</div>
      <div class="abs p3" data-k="grill" style="left:1010px;top:380px">${SVG.grill(560)}</div>`,
    update(r, t) {
      st($(r, 'eb'), eo(t, 4.55, 5.3));
      const cal = eo(t, 4.6, 5.8); st($(r, 'cal'), cal, `translateZ(${(1 - cal) * -900}px) rotateY(${(1 - cal) * -30 + 8}deg) rotateX(4deg)`);
      $(r, 'strike').style.transform = `scaleX(${eo(t, 7.0, 7.6)})`;
      const flip = ep(t, 8.55, 9.45); $(r, 'page').style.transform = `rotateX(${flip * -178}deg)`; $(r, 'page').style.opacity = flip > .52 ? 0 : 1;
      $(r, 'calback').style.opacity = flip > .3 ? 1 : 0;
      $(r, 'sunsm').style.transform = `rotate(${t * 20}deg)`;
      animLetters(r, 'tt', t, 9.35, .8, .03);
      st($(r, 'ann'), eo(t, 10.5, 11.3), `translateY(${(1 - eo(t, 10.5, 11.3)) * 14}px)`);
      const g = eb(t, 9.6, 10.6); st($(r, 'grill'), cl(pr(t, 9.6, 10)), `translate3d(0,${(1 - g) * 260}px,${(1 - g) * -300}px)`);
      const s = eo(t, 9.9, 11.6); st($(r, 'sun'), s * .9, `translateY(${(1 - s) * 240}px) scale(${.7 + .3 * s})`);
      const rays = r.querySelectorAll('[data-k="rays"]'); rays.forEach((x) => x.setAttribute('transform', `rotate(${t * 14} 150 150)`));
      $$(r, 'fl').forEach((f, i) => { const k = .85 + .15 * Math.sin(t * 13 + i * 1.9) + .07 * Math.sin(t * 29 + i); f.setAttribute('transform', `translate(0 230) scale(1 ${k * g}) translate(0 -230)`); });
    },
    bursts: [{ t: 10.2, x: 1290, y: 560, n: 50, sp: 380, up: true, warm: true }],
  });

  // 2 · Due sorprese
  scene({
    pose: lay(2, { y: 200, z: 200, ry: 12 }), frame: true,
    html: `<div class="abs disp center-x glow p3" data-k="q" style="top:120px;font-size:120px">${letters('E stasera?')}</div>
      <div class="abs" data-k="rays1" style="left:410px;top:230px;width:420px;height:420px;border-radius:50%;background:radial-gradient(circle,rgba(255,236,190,.85),rgba(213,178,106,.25) 40%,transparent 70%)"></div>
      <div class="abs" data-k="rays2" style="left:1090px;top:230px;width:420px;height:420px;border-radius:50%;background:radial-gradient(circle,rgba(255,236,190,.85),rgba(213,178,106,.25) 40%,transparent 70%)"></div>
      ${[0, 1].map((i) => `<div class="abs p3" data-k="gift" style="left:${470 + i * 680}px;top:360px;width:300px;height:330px">
         <div class="abs" style="left:0;top:90px">${SVG.gift(i ? '#0E6E80' : '#B4232F', i ? '#083F4A' : '#83021A', 300)}</div>
         <div class="abs" data-k="lid" style="left:-15px;top:30px">${SVG.lid(330)}</div>
         <div class="abs" style="left:95px;top:200px;width:110px;height:110px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#F7DE9C,#B0852F);border:3px solid #F3E6C8;box-shadow:0 10px 30px rgba(0,0,0,.5);font:italic 700 78px/104px var(--serif);color:#3a0710;text-align:center">${i + 1}</div></div>`).join('')}
      <div class="abs disp center-x glow p3" data-k="ds" style="top:740px;font:italic 500 110px/1 var(--serif);color:var(--gold)">${letters('Due sorprese!')}</div>`,
    update(r, t) {
      animLetters(r, 'q', t, 12.25, .8, .04);
      $$(r, 'gift').forEach((g, i) => {
        const t0 = 14.05 + i * .38, p = eb(t, t0, t0 + .7);
        const push = i === 0 ? ep(t, 16.6, 18.4) : 0;
        st(g, cl(pr(t, t0, t0 + .2)), `translate3d(0,${(1 - p) * -700}px,${(1 - p) * 300 + push * 260}px) rotateZ(${(1 - p) * (i ? 18 : -18) + Math.sin(t * 2 + i) * 2}deg) rotateY(${i ? -8 : 8}deg)`);
        const l = eo(t, 15.5 + i * .35, 16.2 + i * .35);
        $(g, 'lid').style.transform = `translate(${l * (i ? 40 : -40)}px,${-l * 140}px) rotate(${l * (i ? 16 : -16)}deg)`;
        st($(r, 'rays' + (i + 1)), l * (.8 + .2 * Math.sin(t * 5)), `scale(${.5 + l * .8})`);
      });
      animLetters(r, 'ds', t, 14.1, .8, .035);
    },
    bursts: [{ t: 15.6, x: 620, y: 430, n: 60, sp: 450 }, { t: 15.95, x: 1300, y: 430, n: 60, sp: 450 }],
  });

  // 3 · I nomi → piegati nell'ampolla → la sorte sceglie il tavolo
  const TABLES = [[640, 380, 165, 18], [1060, 380, 100, 9], [1405, 380, 122, 12]]; // x, y, radius, seats
  const JAR = [175, 600], JW = 270, JH = JW * 330 / 260;
  const JTOP = [JAR[0], JAR[1] - .469 * JH * .9, .883 * JH * .9];
  const TK_A = 1;
  const NAMES9 = ['Siro', 'Enrico', 'Walter', 'Michele', 'Emanuele', 'Morys', 'Gianluca', 'Paolo', 'Edoardo'];
  const MOUTH = [250, 470]; // ampolla mouth, sheet coords (camera at rest)
  const shaking = (t) => (t > 20.0 && t < 20.9) || (t > 27.0 && t < 30.6);
  scene({
    pose: lay(3, { y: -200, z: -400, ry: -10, rx: 3 }), frame: true,
    html: `<div class="abs eyebrow" data-k="eb" style="left:200px;top:130px">Sorpresa n. 1</div>
      <div class="abs disp" data-k="t0" style="left:200px;top:175px;font-size:84px">Tutti i nomi <em>in gioco</em></div>
      <div class="abs disp" data-k="t1" style="left:200px;top:175px;font-size:84px">L’ampolla <em>della sorte</em></div>
      <div class="abs disp" data-k="t2" style="left:200px;top:175px;font-size:78px">Anche i <em>CEO</em>, gli <em>azionisti</em> e il <em>CdA</em></div>
      <div class="abs eyebrow" data-k="t2s" style="left:205px;top:285px;color:var(--champagne)">Per una sera, il tavolo lo sceglie la sorte</div>
      <div class="abs p3" data-k="floor" style="left:160px;top:330px;width:1600px;height:760px;transform:rotateX(60deg);transform-origin:50% 40%">
        ${TABLES.map(([x, y, rad, n], i) => `<div class="abs p3" data-k="tbl" style="left:${x - rad}px;top:${y - rad}px;width:${rad * 2}px;height:${rad * 2}px"><div class="abs table" data-k="tb" style="inset:0;flex-direction:column;gap:6px;font-size:${rad > 120 ? 96 : 80}px">${i + 1}<span style="font:800 ${rad > 120 ? 24 : 20}px/1 var(--sans);letter-spacing:.14em;color:var(--gold);font-style:normal">${n} POSTI</span></div>
           ${[...Array(n)].map((_, j) => { const a = j / n * Math.PI * 2 - Math.PI / 2; return `<div class="abs chair" data-k="chair" style="left:${rad + Math.cos(a) * (rad + 34) - 17}px;top:${rad + Math.sin(a) * (rad + 34) - 17}px"></div>`; }).join('')}</div>`).join('')}
        <div class="abs p3" data-k="jar" style="left:${JAR[0] - JW / 2}px;top:${JAR[1] - JH}px;width:${JW}px;height:${JH}px;transform-origin:50% 100%">${SVG.jar(JW)}</div>
        <div class="abs ticket" data-k="tkA" style="left:0;top:0">2</div>
        ${[...Array(6)].map(() => `<div class="abs ticket" data-k="tkM" style="left:0;top:0">?</div>`).join('')}
      </div>
      ${NAMES9.map((n) => `<div class="abs p3" data-k="nm" style="left:0;top:0;width:300px;height:110px">
          <div class="abs" data-k="nmc" style="inset:0;border-radius:10px;background:linear-gradient(160deg,#FBF4E2,#E9D9B4);border:3px dashed rgba(176,133,47,.8);box-shadow:0 18px 36px -12px rgba(0,0,0,.7);transform-origin:50% 0"></div>
          <div class="abs" data-k="nmt" style="left:0;width:300px;top:0;text-align:center;font:italic 600 58px/110px var(--serif);color:#8A6230">${n}</div></div>`).join('')}`,
    update(r, t) {
      st($(r, 'eb'), eo(t, 16.5, 17.2));
      st($(r, 't0'), win(t, 16.6, 18.55, .6, .3), `translateY(${(1 - eo(t, 16.6, 17.3)) * 20}px)`);
      const t1 = win(t, 18.55, 26.9, .5, .4), t2 = eo(t, 27.0, 27.7);
      st($(r, 't1'), t1, `translateY(${(1 - eo(t, 18.55, 19.1)) * 20}px)`);
      st($(r, 't2'), t2, `translateY(${(1 - t2) * 20}px)`); st($(r, 't2s'), eo(t, 27.8, 28.5));
      // the nine names: readable, then folded and dropped into the ampolla
      $$(r, 'nm').forEach((el, k) => {
        const col = k % 3, row = Math.floor(k / 3);
        const gx = 420 + col * 380, gy = 340 + row * 160;
        const a = eb(t, 16.6 + k * .09, 17.3 + k * .09);
        const tf = 18.7 + k * .11, fold = ep(t, tf, tf + .35), q = ep(t, tf + .35, tf + 1.0);
        const x = lerp(gx, MOUTH[0] - 150, q), y = lerp(gy, MOUTH[1] - 55, q) - Math.sin(q * Math.PI) * 160;
        const o = cl(a * 1.4) * (1 - pr(t, tf + .82, tf + 1.0));
        vis(el, o);
        if (o <= 0) return;
        el.style.transform = `translate3d(${x}px,${y + Math.sin(t * 1.5 + k) * 5 * (1 - fold)}px,${(1 - a) * -500 + q * 150}px) rotateY(${(1 - a) * 80}deg) rotateZ(${(k % 2 ? 3 : -3) * (1 - q) + q * 300}deg) scale(${lerp(1, .22, q)})`;
        $(el, 'nmc').style.transform = `scaleY(${1 - .5 * fold}) rotateX(${fold * 55}deg)`;
        $(el, 'nmt').style.opacity = 1 - cl(fold * 1.6);
      });
      const fl = eo(t, 18.2, 19.6); st($(r, 'floor'), fl, `translateZ(${150 - (1 - fl) * 400}px) rotateX(${lerp(75, 60, fl)}deg) scale(.86)`);
      const j = eb(t, 18.5, 19.25), sh = shaking(t) ? 1 : 0;
      $(r, 'jar').style.transform = `translateZ(${(1 - j) * -200}px) rotateX(-60deg) scale(${.9 * j}) rotateZ(${Math.sin(t * 15) * 4 * sh}deg) translateY(${-Math.abs(Math.sin(t * 15)) * 8 * sh}px)`;
      $(r, 'jar').style.filter = `drop-shadow(0 0 ${20 + 30 * eo(t, 19.6, 20.6)}px rgba(235,203,134,${.25 + .35 * sh}))`;
      r.querySelectorAll('[data-k="jt"]').forEach((p, i) => {
        const x = 70 + (i * 37) % 120, y = 220 + (i * 23) % 90;
        const spin = sh ? t * (200 + i * 15) : i * 40, dx = sh ? Math.sin(t * 9 + i) * 26 : 0, dy = sh ? Math.cos(t * 11 + i * 2) * 22 : 0;
        p.setAttribute('transform', `translate(${dx} ${dy}) rotate(${spin} ${x} ${y})`);
        p.setAttribute('opacity', (.85 * eo(t, 19.0, 20.4)).toFixed(3));
      });
      $$(r, 'tbl').forEach((tb, i) => {
        const a = eb(t, 20.3 + i * .14, 21.1 + i * .14); tb.style.opacity = cl(a * 1.3); tb.style.transform = `translateZ(${(1 - a) * 160}px) scale(${.6 + .4 * a})`;
        const lit = i === TK_A ? eo(t, 22.3, 22.7) : 0;
        const tbe = $(tb, 'tb'); tbe.style.boxShadow = lit ? `0 0 ${60 * lit}px ${12 * lit}px rgba(235,203,134,${.75 * lit}), inset 0 0 40px rgba(235,203,134,${.4 * lit})` : 'none';
        tbe.style.borderColor = lit ? GOLD_HI : ''; tbe.style.color = lit ? GOLD_HI : '';
        $$(tb, 'chair').forEach((c, k) => {
          const ca = eo(t, 22.6 + i * .25 + k * .03, 23.0 + i * .25 + k * .03); c.style.opacity = ca; c.style.transform = `scale(${ca})`;
          const pr0 = rng(i * 31 + k * 7 + 3)(); const fill = eo(t, 24.7 + pr0 * 2, 25.0 + pr0 * 2);
          const col = pr0 < .3 ? '#55B6E6' : pr0 < .55 ? '#D5B26A' : pr0 < .7 ? '#B4232F' : '#6FC2A8';
          c.style.background = fill ? col : ''; c.style.borderColor = fill ? CHAMP : ''; c.style.boxShadow = fill ? `0 0 14px ${col}` : '';
        });
      });
      flyTicket($(r, 'tkA'), t, 20.8, 21.25, 22.3, [TABLES[TK_A][0], TABLES[TK_A][1] + TABLES[TK_A][2] * .62], 0);
      // folded tickets jumping out of the shaken ampolla, ready to be drawn
      $$(r, 'tkM').forEach((el, k) => {
        const a0 = eo(t, 27.3 + k * .14, 27.9 + k * .14) * (1 - eo(t, 30.4, 30.9));
        if (a0 <= 0) { el.style.opacity = 0; return; }
        const ang = k / 6 * Math.PI * 2 + t * 2.4 + Math.sin(t * 1.3 + k) * .3;
        const rad = 170 * a0, x = JTOP[0] + 30 + Math.cos(ang) * rad, y = JTOP[1] + Math.sin(ang) * rad * .35;
        const z = JTOP[2] - 230 + a0 * 50 + Math.abs(Math.sin(t * 5 + k * 1.7)) * 40 + Math.sin(ang) * 20;
        el.style.opacity = cl(a0 * 1.3);
        el.style.transform = `translate3d(${x - 55}px,${y - 33}px,${z}px) rotateX(-60deg) rotateZ(${t * 120 + k * 60}deg) scale(.85)`;
      });
    },
    bursts: [{ t: 19.4, x: 260, y: 470, n: 50, sp: 360 }, { t: 22.35, x: 1190, y: 640, n: 60, sp: 420 }],
  });
  function flyTicket(el, t, tUp, tGo, tLand, [tx, ty], seed) {
    if (t < tUp) { el.style.opacity = 0; return; }
    el.style.opacity = 1;
    const up = eo(t, tUp, tUp + .7);
    let x = JTOP[0], y = JTOP[1], z = JTOP[2] - 60 + up * 110, stand = -60, spin = Math.sin(t * 4 + seed) * 8, sc = .7 + .5 * up;
    if (t >= tGo) {
      const p = ep(t, tGo, tLand);
      x = lerp(JTOP[0], tx, p); y = lerp(JTOP[1], ty, p);
      z = lerp(JTOP[2] + 50, 6, p) + Math.sin(p * Math.PI) * 90;
      stand = lerp(-60, 0, eo(t, tLand - .5, tLand)); spin = p * 720 + (seed ? 8 : -10); sc = lerp(1.2, 1.25, p);
    }
    el.style.transform = `translate3d(${x - 55}px,${y - 33}px,${z}px) rotateX(${stand}deg) rotateZ(${spin}deg) scale(${sc})`;
  }

  // 4 · ¡Bienvenida!
  const NAMES = [['Naimo', 'Bienvenido', 32.6], ['Sandra', 'Bienvenida', 33.15], ['Matteo', 'Futuro compañero', 35.85]];
  scene({
    pose: lay(4, { y: 300, z: 0, ry: 14 }), frame: true,
    html: `<svg class="abs" data-k="ribbon" style="left:80px;top:120px" width="1760" height="260" viewBox="0 0 1760 260"><defs><linearGradient id="rbg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#B4232F"/><stop offset="1" stop-color="#83021A"/></linearGradient></defs>
        <path data-k="rb" fill="url(#rbg)" opacity=".55"/><path data-k="rbe1" fill="none" stroke="#D5B26A" stroke-width="5"/><path data-k="rbe2" fill="none" stroke="#D5B26A" stroke-width="5"/></svg>
      <div class="abs disp center-x glow p3" data-k="tt" style="top:165px;font:italic 500 120px/1 var(--serif);color:var(--champagne)">${letters('¡Bienvenida especial!')}</div>
      ${NAMES.map(([n, c], i) => `<div class="abs card namecard p3" data-k="nc" style="left:${310 + i * 450}px;top:470px"><div class="eyebrow" style="font-size:20px">${c}</div><div class="n">${n}</div></div>`).join('')}`,
    update(r, t) {
      // waving ribbon
      const pts = (off) => { const a = []; for (let x = 0; x <= 1760; x += 40) a.push([x, 130 + off + Math.sin(x / 210 + t * 2.4) * 26 + Math.sin(x / 90 + t * 1.3) * 6]); return a; };
      const P = (a) => a.map(([x, y], i) => (i ? 'L' : 'M') + x + ' ' + y.toFixed(1)).join(' ');
      const tp = pts(-70), bt = pts(70);
      $(r, 'rb').setAttribute('d', P(tp) + ' ' + P(bt.slice().reverse()).replace(/^M/, 'L') + ' Z'); $(r, 'rbe1').setAttribute('d', P(tp)); $(r, 'rbe2').setAttribute('d', P(bt));
      const rb = eo(t, 31.0, 32.0); st($(r, 'ribbon'), rb, `scaleX(${lerp(.2, 1, rb)})`);
      animLetters(r, 'tt', t, 31.2, .8, .03);
      $$(r, 'nc').forEach((c, i) => {
        const p = eb(t, NAMES[i][2] - .2, NAMES[i][2] + .6);
        st(c, cl(p * 1.5), `translateZ(${(1 - p) * -500}px) rotateY(${(1 - p) * 90 + (i - 1) * -8}deg) translateY(${Math.sin(t * 1.6 + i) * 8}px)`);
      });
    },
    bursts: [{ t: 36.4, x: 1410, y: 560, n: 90, sp: 600, confetti: true }],
  });

  // 5 · QR code sul tavolo
  scene({
    pose: lay(5, { y: -250, z: -500, ry: -12 }), frame: true,
    html: `<div class="abs disp glow p3" data-k="tt" style="left:200px;top:300px;font:italic 500 118px/1 var(--serif);color:var(--gold)">${letters('Tocca a voi!')}</div>
      <div class="abs disp" data-k="s1" style="left:205px;top:470px;font-size:56px">Su ogni tavolo</div>
      <div class="abs disp" data-k="s2" style="left:205px;top:545px;font-size:56px">c’è un <em>QR code</em></div>
      <div class="abs p3" data-k="tent" style="left:1120px;top:150px;width:560px;height:720px">
        <div class="abs card" style="inset:0;display:flex;flex-direction:column;align-items:center;padding-top:44px">
          <div class="eyebrow" style="font-size:20px">Tavolo 2</div>
          <div class="disp" style="font:italic 500 50px/1.1 var(--serif);margin-top:14px">Scrivi la tua <em>canzone</em></div>
          <div class="abs" style="left:100px;top:210px;width:360px;height:360px;border-radius:16px;background:rgba(5,30,37,.8)">
            <div class="abs" style="left:20px;top:20px;opacity:.22">${qrSVG(320, '#F3E6C8')}</div>
            <div class="abs" data-k="qrg" style="left:20px;top:20px;-webkit-mask-image:linear-gradient(135deg,#000 45%,transparent 55%);-webkit-mask-size:300% 300%">${qrSVG(320, '#EBCB86')}</div>
            <div class="abs" data-k="scan" style="left:6px;width:348px;height:4px;background:#EBCB86;box-shadow:0 0 24px 6px rgba(235,203,134,.7);border-radius:2px"></div></div>
          <div class="abs eyebrow" style="left:0;width:560px;text-align:center;top:620px;font-size:16px;color:var(--text-2)">Christmas Music Battle</div></div></div>`,
    update(r, t) {
      animLetters(r, 'tt', t, 37.9, .8, .04);
      st($(r, 's1'), eo(t, 39.2, 39.9), `translateY(${(1 - eo(t, 39.2, 39.9)) * 18}px)`);
      st($(r, 's2'), eo(t, 40.2, 40.9), `translateY(${(1 - eo(t, 40.2, 40.9)) * 18}px)`);
      const c = eb(t, 38.0, 39.2);
      st($(r, 'tent'), cl(c * 1.4), `translateZ(${(1 - c) * -700}px) rotateY(${-20 + (1 - c) * -40 + Math.sin(t) * 3}deg) rotateX(${8 + Math.sin(t * .8) * 2}deg)`);
      $(r, 'qrg').style.webkitMaskPosition = `${lerp(100, 0, ep(t, 40.3, 41.3))}% ${lerp(100, 0, ep(t, 40.3, 41.3))}%`;
      const sc = pr(t, 40.6, 41.6); st($(r, 'scan'), sc > 0 && sc < 1 ? 1 : 0, `translateY(${20 + Math.abs(Math.sin(sc * Math.PI * 1.5)) * 320}px)`);
    },
    bursts: [{ t: 40.6, x: 1400, y: 520, n: 50, sp: 380 }],
  });

  // 6 · Telefono: nome, storia, stile
  const STORY = 'La notte in cui la renna del capo si perse sul lago di Lugano…';
  const STYLES = ['Pop', 'Blues', 'Serenata', 'Swing', 'Rock', 'Lirica'];
  scene({
    pose: lay(6, { y: 150, z: -100, ry: 10 }), frame: true,
    html: `${[['1', 'Scansiona il QR', 41.6], ['2', 'Scegli il tuo nome', 43.1], ['3', 'Una storia', 45.6], ['4', 'Uno stile musicale', 48.6]].map(([n, s, tt], i) =>
        `<div class="abs" data-k="step" data-t="${tt}" style="left:200px;top:${215 + i * 140}px;display:flex;align-items:center;gap:30px">
          <div style="width:86px;height:86px;border-radius:50%;border:2px solid var(--gold);display:flex;align-items:center;justify-content:center;font:italic 600 50px/1 var(--serif);color:var(--gold)">${n}</div>
          <div class="disp" style="font-size:58px">${s}</div></div>`).join('')}
      <div class="abs p3" data-k="phone" style="left:1180px;top:110px;width:420px;height:820px;border-radius:56px;background:#0a1a1f;padding:16px;box-shadow:0 60px 100px -40px rgba(0,0,0,.9),0 0 0 2px rgba(213,178,106,.4)">
        <div style="position:relative;width:100%;height:100%;border-radius:42px;overflow:hidden;background:linear-gradient(180deg,#0C3540,#051E25);padding:34px 26px">
          <div style="display:flex;justify-content:center;align-items:center;gap:18px"><img src="${BRAND}lfg-zest-white.png" style="width:70px;height:70px"><span style="width:1px;height:46px;background:rgba(213,178,106,.6)"></span><img src="${BRAND}lfa-white.png" style="width:70px;height:70px"></div>
          <div class="eyebrow" style="font-size:13px;text-align:center;margin-top:12px">Christmas Music Battle</div>
          <div class="disp" style="font:italic 500 40px/1.1 var(--serif);text-align:center;margin-top:10px;color:var(--champagne)">Scrivi la tua <em>canzone!</em></div>
          <div class="flabel">Il tuo nome</div><div class="field" data-k="name" style="display:flex;justify-content:space-between"><span data-k="nv">Scegli…</span><span style="color:var(--gold)">▾</span></div>
          <div class="flabel">La tua storia</div><div class="field" style="height:150px"><span data-k="story"></span><span data-k="caret" style="color:var(--gold)">|</span></div>
          <div class="flabel">Stile musicale</div><div>${STYLES.map((s) => `<span class="chip" data-k="chip">${s}</span>`).join('')}</div>
          <div data-k="send" style="margin-top:12px;border-radius:14px;background:linear-gradient(90deg,#B0852F,#D5B26A);color:#1a1206;font:800 22px/56px var(--sans);text-align:center;letter-spacing:.12em">INVIA ✦</div>
        </div></div>`,
    update(r, t) {
      $$(r, 'step').forEach((s) => { const t0 = +s.dataset.t, p = eo(t, t0, t0 + .6); st(s, p, `translateX(${(1 - p) * -60}px)`); });
      const ph = eb(t, 41.4, 42.6);
      st($(r, 'phone'), cl(ph * 1.5), `translate3d(0,${(1 - ph) * 300 + Math.sin(t * 1.2) * 10}px,${(1 - ph) * -600}px) rotateY(${-16 + Math.sin(t * .7) * 4}deg) rotateX(${5 + Math.sin(t * .5) * 2}deg)`);
      const nm = t > 43.85; $(r, 'nv').textContent = nm ? 'Mario Rossi' : 'Scegli…'; $(r, 'nv').style.color = nm ? '#F3E6C8' : '#8299A0';
      $(r, 'name').style.borderColor = (t > 43.4 && t < 44.6) ? GOLD : '';
      const n = Math.floor(STORY.length * pr(t, 45.7, 48.3)); $(r, 'story').textContent = STORY.slice(0, n);
      $(r, 'caret').style.opacity = (t > 45.5 && t < 49 && Math.floor(t * 3) % 2 === 0) ? 1 : 0;
      $$(r, 'chip').forEach((c, i) => { c.classList.toggle('on', i === 2 && t > 49.4); });
      $(r, 'send').style.boxShadow = t > 50.05 ? `0 0 ${40 * eo(t, 50.05, 50.4)}px rgba(235,203,134,.8)` : 'none';
    },
    bursts: [{ t: 50.1, x: 1390, y: 860, n: 40, sp: 340 }],
  });

  // 7 · L'AI trasforma poche parole in una canzone
  const AIW = ['una storia', 'emozione', 'pop', 'blues', 'serenata', 'Natale', 'gli amici', 'una risata', 'il capo', 'la cena', 'un ricordo', 'sorpresa'];
  scene({
    pose: lay(7, { y: -300, z: -600, ry: -14 }), frame: true,
    html: `<div class="abs disp center-x" data-k="t1" style="top:120px;font-size:80px">Bastano <em>poche parole</em></div>
      <div class="abs disp center-x" data-k="t2" style="top:120px;font-size:80px">…alla canzone ci pensa <em>l’AI</em></div>
      <div class="abs" data-k="ring" style="left:960px;top:540px">${[...Array(72)].map((_, i) => `<div class="abs" data-k="bar" style="left:-4px;top:0;width:8px;height:60px;border-radius:4px;background:linear-gradient(${GOLD_HI},${GOLD});transform-origin:4px 0;transform:rotate(${i * 5}deg) translateY(200px)"></div>`).join('')}</div>
      <div class="abs" data-k="orb" style="left:760px;top:340px;width:400px;height:400px;border-radius:50%;
        background:radial-gradient(circle at 42% 38%,#FFF4D6 0%,#EBCB86 18%,rgba(213,178,106,.55) 38%,rgba(85,182,230,.25) 58%,transparent 72%)"></div>
      <svg class="abs" data-k="orbits" style="left:710px;top:290px" width="500" height="500" viewBox="0 0 500 500" fill="none" stroke="#F3E6C8" stroke-opacity=".5">
        <circle cx="250" cy="250" r="170" stroke-dasharray="4 14" stroke-width="3"/><circle cx="250" cy="250" r="215" stroke-dasharray="60 30 6 30" stroke-width="2" stroke="#55B6E6"/></svg>
      <div class="abs disp center-x" data-k="ai" style="top:465px;font:italic 600 130px/1 var(--serif);color:#1d1405;text-shadow:0 0 30px rgba(255,244,214,.8)">AI</div>
      ${AIW.map((w) => `<div class="abs disp" data-k="w" style="left:0;top:0;font:italic 500 50px/1 var(--serif)">${w}</div>`).join('')}
      ${[...Array(14)].map((_, i) => `<div class="abs" data-k="nt" style="left:930px;top:500px">${SVG.note(56, i % 3 ? GOLD : CHAMP)}</div>`).join('')}`,
    update(r, t) {
      st($(r, 't1'), win(t, 50.45, 53.0, .6, .4)); st($(r, 't2'), eo(t, 53.0, 53.6));
      const absorb = ep(t, 52.2, 55.2);
      const o = eb(t, 50.4, 51.4), pulse = 1 + .05 * Math.sin(t * 6) + absorb * .25 + .2 * Math.exp(-Math.pow((t - 55.3) * 4, 2));
      st($(r, 'orb'), o, `scale(${o * pulse})`); st($(r, 'ai'), o, `scale(${o * (1 + absorb * .15)})`);
      st($(r, 'orbits'), o * .9, `rotate(${t * 25}deg) scale(${o})`);
      const rr = rng(11);
      $$(r, 'w').forEach((el, i) => {
        const a0 = i / AIW.length * Math.PI * 2 + .3, rad = 560 + rr() * 140;
        const ta = 50.5 + i * .09, tb = 52.3 + i * .2, p = ep(t, tb, tb + 1.1);
        const ang = a0 + p * 2.2 + t * .08, R = rad * (1 - p);
        const x = 960 + Math.cos(ang) * R * 1.35, y = 590 + Math.sin(ang) * R * .5;
        const a = eo(t, ta, ta + .6) * (1 - pr(t, tb + .8, tb + 1.1));
        st(el, a, `translate3d(${x - el.offsetWidth / 2}px,${y - 25}px,${(1 - eo(t, ta, ta + .8)) * -400}px) scale(${1 - p * .7})`);
      });
      const ring = eo(t, 54.9, 55.6);
      $$(r, 'bar').forEach((b, i) => { const h = 20 + 70 * Math.abs(Math.sin(i * .7 + t * 5.3) * Math.sin(i * .23 + t * 2.1)); b.style.opacity = ring; b.style.transform = `rotate(${i * 5 + t * 6}deg) translateY(${215 + ring * 20}px) scaleY(${ring * h / 60})`; });
      $$(r, 'nt').forEach((n, i) => {
        const t0 = 55.2 + i * .16, age = t - t0; if (age < 0) { n.style.opacity = 0; return; }
        const a = i * 2.4, d = 120 + age * 330;
        st(n, cl(1 - age / 2.3) * cl(age * 4), `translate(${Math.cos(a) * d * 1.3}px,${Math.sin(a) * d * .8 - age * 40}px) rotate(${Math.sin(age * 3 + i) * 20}deg) scale(${.6 + age * .3})`);
      });
    },
    bursts: [{ t: 55.3, x: 960, y: 540, n: 110, sp: 700 }],
  });

  // 8 · Chorus
  const CH1 = linesIn(57, 74.3);
  scene({
    pose: lay(8, { y: 0, z: -200, rx: -4 }), frame: false,
    html: `<div class="abs" data-k="vinyl" style="left:510px;top:90px;width:900px;height:900px;border-radius:50%;opacity:.0;
        background:repeating-radial-gradient(circle,rgba(243,230,200,.07) 0 2px,transparent 2px 9px),radial-gradient(circle,rgba(213,178,106,.14) 0 12%,rgba(8,42,51,.0) 12.5%)"></div>
      <div class="abs eyebrow center-x" data-k="eb" style="top:150px">LFG+Zest · Christmas Music Battle</div>
      <div class="abs" data-k="gar1" style="left:510px;top:180px">${SVG.garland(900)}</div>
      ${[...Array(18)].map((_, i) => `<div class="abs" data-k="fn" style="left:0;top:0">${SVG.note(40 + (i % 3) * 14, i % 4 ? 'rgba(213,178,106,.55)' : 'rgba(243,230,200,.45)')}</div>`).join('')}
      <div class="abs p3" style="left:0;top:0;width:1920px;height:1080px">${bigLyricsHTML(CH1)}</div>`,
    update(r, t) {
      st($(r, 'vinyl'), .9 * eo(t, 57.6, 59), `rotate(${t * 30}deg) scale(${.9 + .03 * Math.sin(t * 7.5)})`);
      st($(r, 'eb'), eo(t, 57.7, 58.6)); st($(r, 'gar1'), eo(t, 58, 59));
      $$(r, 'fn').forEach((n, i) => {
        const rr = rng(i * 13 + 5), x0 = rr() * 1920, sp = 60 + rr() * 80, ph = rr() * 20;
        const y = 1100 - ((t * sp + ph * 60) % 1250); st(n, eo(t, 57.6, 59) * .9, `translate(${x0 + Math.sin(t + i) * 40}px,${y}px) rotate(${Math.sin(t * 1.5 + i) * 25}deg)`);
      });
      bigLyrics(r, CH1, t, 590);
    },
    bursts: [{ t: 58.0, x: 960, y: 560, n: 80, sp: 640 }, { t: 72.5, x: 1450, y: 300, n: 140, sp: 820 }],
  });

  // 9 · Ognuno la sua canzone → 3 finaliste
  const FIN = [8, 15, 3];
  scene({
    pose: lay(9, { y: 300, z: -500, ry: 14 }), frame: true,
    html: `<div class="abs disp center-x" data-k="t1" style="top:110px;font-size:80px">Ognuno la <em>sua canzone</em></div>
      <div class="abs disp center-x" data-k="t2" style="top:110px;font-size:80px">L’AI sceglie <em>le tre finaliste</em></div>
      <div class="abs p3" style="left:0;top:0">${[...Array(24)].map((_, i) => `<div class="abs songcard p3" data-k="sc" style="left:0;top:0"><div class="vinyl"></div><div class="l">Canzone ${i + 1}</div>
        <div class="abs" data-k="tr" style="left:47px;top:-150px;opacity:0">${SVG.trophy(96)}</div><div class="abs disp" data-k="rk" style="left:0;width:190px;text-align:center;top:-56px;opacity:0;font:italic 600 54px/1 var(--serif);color:var(--gold)"></div></div>`).join('')}</div>`,
    update(r, t) {
      st($(r, 't1'), win(t, 74.3, 77.5, .6, .4)); st($(r, 't2'), eo(t, 77.55, 78.2));
      const sel = ep(t, 77.5, 78.5);
      $$(r, 'sc').forEach((c, i) => {
        const col = i % 8, row = Math.floor(i / 8);
        const gx = 220 + col * 210, gy = 300 + row * 215, ang = (col - 3.5) * -7;
        const t0 = 74.35 + (col + row) * .1, a = eb(t, t0, t0 + .7);
        const fi = FIN.indexOf(i);
        let x = gx, y = gy, z = (1 - a) * -1200 - Math.abs(col - 3.5) * 40, ry = ang, s = 1, o = cl(a * 1.4);
        if (fi >= 0) { x = lerp(gx, 560 + fi * 400, sel); y = lerp(gy, 520, sel); z = lerp(z, 200, sel); ry = lerp(ang, 0, sel); s = lerp(1, 1.45, sel); }
        else { o *= lerp(1, .12, sel); z -= sel * 300; }
        c.style.opacity = o; c.style.transform = `translate3d(${x}px,${y + Math.sin(t * 1.4 + i) * 6}px,${z}px) rotateY(${ry}deg) scale(${s})`;
        c.style.boxShadow = fi >= 0 && sel > 0 ? `0 0 ${60 * sel}px rgba(235,203,134,${.55 * sel})` : '';
        if (fi >= 0) { const tp = eb(t, 78.0 + fi * .15, 78.6 + fi * .15); st($(c, 'tr'), tp, `translateY(${(1 - tp) * 40}px) scale(${tp})`); }
      });
    },
    bursts: [{ t: 78.3, x: 960, y: 560, n: 90, sp: 640 }],
  });

  // 10 · Applausometro
  scene({
    pose: lay(10, { y: -200, z: 0, ry: -12 }), frame: true,
    html: `<div class="abs disp center-x" data-k="tt" style="top:115px;font-size:80px">Votiamo <em>a colpi di applausi</em></div>
      <svg class="abs" style="left:460px;top:170px" width="1000" height="560" viewBox="0 0 1000 560">
        <defs><linearGradient id="ag" x1="0" x2="1"><stop offset="0" stop-color="#2E8296"/><stop offset=".55" stop-color="#D5B26A"/><stop offset="1" stop-color="#F7DE9C"/></linearGradient></defs>
        <path d="M110 500 A390 390 0 0 1 890 500" stroke="rgba(243,230,200,.12)" stroke-width="64" fill="none" stroke-linecap="round"/>
        <path data-k="arc" d="M110 500 A390 390 0 0 1 890 500" stroke="url(#ag)" stroke-width="64" fill="none" stroke-linecap="round" pathLength="100" stroke-dasharray="0 100"/>
        ${[...Array(11)].map((_, i) => { const a = Math.PI * (1 - i / 10); return `<line x1="${500 + Math.cos(a) * 320}" y1="${500 - Math.sin(a) * 320}" x2="${500 + Math.cos(a) * 345}" y2="${500 - Math.sin(a) * 345}" stroke="#F3E6C8" stroke-opacity=".5" stroke-width="4"/>`; }).join('')}
        <g data-k="needle"><line x1="500" y1="500" x2="500" y2="190" stroke="#F3E6C8" stroke-width="8" stroke-linecap="round"/><circle cx="500" cy="500" r="26" fill="#D5B26A"/></g></svg>
      <div class="abs disp center-x" data-k="val" style="top:700px;font:italic 600 120px/1 var(--serif);color:var(--gold)">0</div>
      <div class="abs eyebrow center-x" style="top:212px">Applausometro</div>
      ${[...Array(10)].map((_, i) => `<div class="abs disp" data-k="clap" style="left:0;top:0;font:800 30px/1 var(--sans);letter-spacing:.2em;color:var(--champagne)">CLAP!</div>`).join('')}`,
    update(r, t) {
      st($(r, 'tt'), eo(t, 79.4, 80.1));
      let v = ep(t, 80.3, 82.95); v = cl(v + .035 * Math.sin(t * 23) * (1 - v) * (v > 0 ? 1 : 0));
      $(r, 'arc').setAttribute('stroke-dasharray', `${v * 100} 100`);
      $(r, 'needle').setAttribute('transform', `rotate(${-90 + v * 180} 500 500)`);
      $(r, 'val').textContent = Math.round(v * 100);
      $(r, 'val').style.textShadow = v > .98 ? `0 0 ${50 * eo(t, 82.9, 83.3)}px rgba(235,203,134,.9)` : 'none';
      $$(r, 'clap').forEach((c, i) => {
        const t0 = 80.4 + i * .25, age = t - t0, a = Math.PI * (.12 + (i * .37) % .76);
        if (age < 0 || age > 1.2) { c.style.opacity = 0; return; }
        st(c, cl(1 - age / 1.2) * cl(age * 6), `translate(${960 + Math.cos(a) * (420 + age * 90) - 60}px,${670 - Math.sin(a) * (360 + age * 70)}px) rotate(${(i % 2 ? 1 : -1) * 12}deg) scale(${.8 + age * .5})`);
      });
    },
    bursts: [{ t: 82.95, x: 960, y: 420, n: 130, sp: 760, confetti: true }],
  });

  // 11 · Buono da 100 franchi
  scene({
    pose: lay(11, { y: 200, z: -400, ry: 10 }), frame: true,
    html: `<div class="abs disp center-x" data-k="tt" style="top:110px;font-size:86px">In <em>palio</em></div>
      <div class="abs p3" data-k="v" style="left:510px;top:270px;width:900px;height:500px">
        <div class="abs" style="inset:0;border-radius:28px;overflow:hidden;background:linear-gradient(125deg,#B0852F 0%,#F7DE9C 28%,#D5B26A 50%,#F3E6C8 70%,#B0852F 100%);box-shadow:0 60px 110px -40px rgba(0,0,0,.9)">
          <div class="abs" style="inset:22px;border:3px dashed rgba(90,6,18,.45);border-radius:18px"></div>
          <div class="abs eyebrow" style="left:70px;top:70px;color:#5A0612">Buono regalo</div>
          <div class="abs" style="left:66px;top:118px;font:italic 600 190px/1 var(--serif);color:#2a1a06"><span style="font:800 70px/1 var(--sans);letter-spacing:.06em;vertical-align:60px;margin-right:16px">CHF</span><span data-k="num">0</span></div>
          <div class="abs" style="left:72px;top:385px;font:700 24px/1.3 var(--sans);color:#4b3410">Per la canzone vincitrice · Christmas Music Battle</div>
          <img class="abs" src="${BRAND}lfg-zest-white.png" style="right:200px;top:56px;width:110px;height:110px;filter:brightness(.25) sepia(1)"><img class="abs" src="${BRAND}lfa-white.png" style="right:66px;top:56px;width:110px;height:110px;filter:brightness(.25) sepia(1)">
          <div class="abs" data-k="shine" style="inset:0;background:linear-gradient(110deg,transparent 35%,rgba(255,255,255,.75) 50%,transparent 65%);background-size:300% 100%"></div></div></div>`,
    update(r, t) {
      st($(r, 'tt'), eo(t, 83.5, 84.2));
      const p = ep(t, 83.55, 85.0);
      st($(r, 'v'), cl(p * 2), `translateZ(${(1 - p) * -1600}px) rotateY(${(1 - p) * -80 + Math.sin(t * .8) * 7}deg) rotateX(${Math.sin(t * .6) * 5 + 3}deg) rotateZ(${(1 - p) * -12}deg)`);
      $(r, 'num').textContent = Math.round(100 * eo(t, 85.8, 86.9));
      $(r, 'shine').style.backgroundPosition = `${lerp(130, -30, pr((t - 85.0) % 3.2, 0, 1.1))}% 0`;
    },
    bursts: [{ t: 87.0, x: 960, y: 520, n: 130, sp: 760, confetti: true }, { t: 89.6, x: 600, y: 400, n: 60, sp: 500 }, { t: 90.4, x: 1320, y: 420, n: 60, sp: 500 }],
  });

  // 12 · Final chorus: albero di luci
  const CH2 = linesIn(91.5, 108.4);
  const TREE_N = 150;
  scene({
    pose: lay(12, { y: -150, z: -200, ry: -6 }), frame: false,
    html: `<svg class="abs" data-k="tree" style="left:560px;top:40px" width="800" height="960" viewBox="0 0 800 960">
        <path d="M400 70 L110 900 L690 900 Z" fill="rgba(30,90,76,.18)" stroke="rgba(213,178,106,.18)" stroke-width="2"/>
        <g data-k="lights">${[...Array(TREE_N)].map(() => '<circle data-k="li" r="6" fill="#EBCB86"/>').join('')}</g>
        <g data-k="star" transform="translate(400 70)"><path d="M0 -46 L12 -12 L46 -12 L18 9 L28 44 L0 22 L-28 44 L-18 9 L-46 -12 L-12 -12 Z" fill="#F7DE9C" stroke="#fff" stroke-width="2"/></g></svg>
            <div class="abs p3" style="left:0;top:0;width:1920px;height:1080px">${bigLyricsHTML(CH2)}</div>`,
    update(r, t) {
      const lis = $$(r, 'li');
      lis.forEach((c, k) => {
        const s = k / TREE_N, y = 880 - s * 790, hw = 290 * (1 - s) + 6, ang = s * Math.PI * 2 * 7 + t * .6;
        const x = 400 + Math.sin(ang) * hw, front = (Math.cos(ang) + 1) / 2;
        const on = eo(t, 91.9 + s * 3, 92.3 + s * 3);
        const tw = .45 + .55 * Math.max(0, Math.sin(t * 3.1 + k * 1.7));
        c.setAttribute('cx', x.toFixed(1)); c.setAttribute('cy', y.toFixed(1)); c.setAttribute('r', (3 + front * 6).toFixed(1));
        c.setAttribute('opacity', (on * (.25 + front * .75) * tw).toFixed(3));
        c.setAttribute('fill', k % 9 === 0 ? '#B4232F' : k % 5 === 0 ? '#55B6E6' : '#EBCB86');
      });
      const sp = eb(t, 94.8, 95.8); $(r, 'star').setAttribute('transform', `translate(400 70) scale(${sp}) rotate(${(1 - sp) * 180 + Math.sin(t * 2) * 5})`);
      st($(r, 'tree'), .62);
      bigLyrics(r, CH2, t, 600);
    },
    bursts: [{ t: 95.0, x: 960, y: 110, n: 90, sp: 560 }, ...[99.9, 101.4, 103.1, 104.6, 106.0, 107.4].map((tt, i) => ({ t: tt, x: [430, 1490, 640, 1280, 380, 1540][i], y: [260, 230, 190, 280, 220, 200][i], n: 110, sp: 520, firework: true }))],
  });

  // 13 · Outro: con chi ci tocca cenare?
  scene({
    pose: lay(13, { y: 250, z: -500, ry: 12 }), frame: true,
    html: `<div class="abs disp center-x" data-k="t1" style="top:120px;font:italic 500 100px/1 var(--serif);color:var(--champagne)">Ma prima…</div>
      <div class="abs p3" data-k="jarw" style="left:820px;top:300px;width:280px;height:356px">${SVG.jar(280)}</div>
      ${[...Array(12)].map((_, i) => `<div class="abs ticket p3" data-k="ot" style="left:905px;top:450px">${i % 3 + 1}</div>`).join('')}
      <div class="abs disp center-x" data-k="t2" style="top:720px;font:italic 500 96px/1 var(--serif);color:var(--gold)">con chi ci tocca cenare?</div>`,
    update(r, t) {
      st($(r, 't1'), eo(t, 108.5, 109.2), `translateY(${(1 - eo(t, 108.5, 109.2)) * 20}px)`);
      st($(r, 't2'), eo(t, 110.0, 110.7), `translateY(${(1 - eo(t, 110.0, 110.7)) * 20}px)`);
      const j = eb(t, 108.3, 109.3); st($(r, 'jarw'), cl(j * 1.5), `translateZ(${(1 - j) * -600}px) scale(${j}) rotateZ(${Math.sin(t * 12) * (t > 109.2 ? 4 : 0)}deg)`);
      $$(r, 'ot').forEach((o, i) => {
        const p = eo(t, 108.8 + i * .06, 109.8 + i * .06), a = i / 12 * Math.PI * 2 + t * 1.6;
        st(o, p, `translate3d(${Math.cos(a) * 420 * p}px,${Math.sin(a * 2) * 40 - 30}px,${Math.sin(a) * 420 * p}px) rotateY(${-a * 57.3 + 90}deg) rotateZ(${Math.sin(t * 3 + i) * 15}deg)`);
      });
    },
  });

  // 14 · Finale: loghi + Buon Natale
  scene({
    pose: lay(14, {}), frame: false,
    html: `<div class="abs" data-k="halo" style="left:560px;top:-100px;width:800px;height:800px;border-radius:50%;background:radial-gradient(circle,rgba(235,203,134,.38),rgba(213,178,106,.10) 45%,transparent 70%)"></div>
      <div class="abs p3" data-k="lock" style="left:0;top:0;width:1920px;height:1080px;transform-origin:960px 300px">
        <div class="abs p3" data-k="lz" style="left:610px;top:110px;width:700px;height:300px">${logoPair(290, 'sweep')}</div>
        <div class="abs" data-k="rule" style="left:560px;top:450px;width:800px;height:2px;background:linear-gradient(90deg,transparent,#D5B26A,transparent)"></div>
        <div class="abs p3" data-k="lh" style="left:820px;top:485px;width:280px;height:82px"><img src="${BRAND}lfg-holding-white.png" style="width:280px;height:82px"></div></div>
      <div class="abs disp center-x glow p3" data-k="bn" style="top:600px;font:italic 500 190px/1 var(--serif);color:var(--gold)">${letters('Buon Natale!')}</div>
      <div class="abs" data-k="gar" style="left:660px;top:775px">${SVG.garland(600)}</div>
      <div class="abs eyebrow center-x" data-k="info" style="top:1005px;font-size:26px;color:var(--champagne)">27 novembre 2026 · Ristorante Arbostora · Morcote</div>
      <div class="abs disp center-x" data-k="ser" style="top:930px;font:italic 400 56px/1 var(--serif);color:var(--champagne)">Buona serata a tutti</div>`,
    update(r, t) {
      const z = ep(t, 111.9, 114.2);
      st($(r, 'lz'), cl(pr(t, 112, 112.8)), `translateZ(${(1 - z) * -2600}px) rotateY(${(1 - z) * -40}deg)`);
      $$(r, 'sweep').forEach((sw, i) => { sw.style.backgroundPosition = `${lerp(130, -30, ep(t, 113.9 + i * .3, 115.1 + i * .3))}% 0`; });
      st($(r, 'halo'), eo(t, 112.5, 114.5) * (.8 + .2 * Math.sin(t * 1.7)));
      const ru = eo(t, 115.2, 116.4); st($(r, 'rule'), ru, `scaleX(${ru})`);
      const h = eb(t, 116.4, 117.6);
      st($(r, 'lh'), cl(h * 1.4), `translateZ(${(1 - h) * -900}px) rotateX(${(1 - h) * 60}deg)`);
      // logos lockup rises and shrinks, then "Buon Natale"
      const up = ep(t, 122.6, 124.6);
      $(r, 'lock').style.transform = `translateY(${-up * 70}px) scale(${1 - up * .34})`;
      animLetters(r, 'bn', t, 123.9, .9, .05);
      const g = eo(t, 125.4, 126.6); st($(r, 'gar'), g, `scaleX(${lerp(.3, 1, g)})`);
      st($(r, 'ser'), eo(t, 127.2, 128.2), `translateY(${(1 - eo(t, 127.2, 128.2)) * 16}px)`);
      st($(r, 'info'), eo(t, 128.6, 129.6) * .9);
      // slow breathing of the whole lockup
      $(r, 'bn').style.transform = `translateY(${Math.sin(t * .8) * 4}px)`;
    },
    bursts: [{ t: 114.2, x: 960, y: 260, n: 120, sp: 640 }, { t: 124.2, x: 960, y: 690, n: 140, sp: 820 }, { t: 132.0, x: 520, y: 300, n: 100, sp: 520, firework: true }, { t: 134.2, x: 1400, y: 280, n: 100, sp: 520, firework: true }, { t: 137.0, x: 760, y: 220, n: 100, sp: 520, firework: true }, { t: 139.4, x: 1180, y: 240, n: 110, sp: 560, firework: true }],
  });

  S.forEach((s, i) => { s.t0 = B[i]; s.t1 = B[i + 1]; });
  const BURSTS = S.flatMap((s) => s.bursts || []).map((b, i) => Object.assign({ seed: i * 97 + 13 }, b));

  // ---------- build DOM ----------
  const world = document.getElementById('world');
  S.forEach((s, i) => {
    const el = document.createElement('div'); el.className = 'sheet'; el.dataset.i = i;
    el.innerHTML = (s.frame ? '<div class="frame"></div>' : '') + s.html;
    const p = s.pose;
    el.style.transform = `translate3d(${p.x}px,${p.y}px,${p.z}px) rotateY(${p.ry}deg) rotateX(${p.rx}deg) rotateZ(${p.rz}deg)`;
    world.appendChild(el); s.el = el;
  });

  // ---------- camera ----------
  const TD = 1.5; // transition duration
  function scenePose(i, t) {
    const s = S[i], p = s.pose, lt = pr(t, s.t0, s.t1);
    const c = Object.assign({}, p);
    c.z += lerp(70, -50, lt);             // slow push-in
    c.x += Math.sin(t * .23 + i) * 26; c.y += Math.cos(t * .19 + i) * 14;
    c.ry += Math.sin(t * .17 + i * 2) * 1.6; c.rx += Math.cos(t * .21 + i) * .8;
    return c;
  }
  function camera(t) {
    let i = S.findIndex((s) => t >= s.t0 && t < s.t1); if (i < 0) i = S.length - 1;
    let c = scenePose(i, t);
    // transition into scene i (centered slightly before its start)
    const tc = S[i].t0 - .15;
    if (i > 0 && t < tc + TD / 2) {
      const p = E(pr(t, tc - TD / 2, tc + TD / 2)), a = scenePose(i - 1, t), b = c;
      c = {}; for (const k of ['x', 'y', 'z', 'rx', 'ry', 'rz']) c[k] = lerp(a[k], b[k], p);
      c.z += Math.sin(p * Math.PI) * 650; c.rz += Math.sin(p * Math.PI) * (i % 2 ? 2 : -2);
    } else if (i < S.length - 1 && t > S[i + 1].t0 - .15 - TD / 2) {
      const p = E(pr(t, S[i + 1].t0 - .15 - TD / 2, S[i + 1].t0 - .15 + TD / 2)), b = scenePose(i + 1, t);
      const a = c; c = {}; for (const k of ['x', 'y', 'z', 'rx', 'ry', 'rz']) c[k] = lerp(a[k], b[k], p);
      c.z += Math.sin(p * Math.PI) * 650; c.rz += Math.sin(p * Math.PI) * (i % 2 ? -2 : 2);
    }
    // opening fly-in and closing pull-back
    c.z += lerp(2400, 0, ep(t, 0, 2.2));
    c.z += ep(t, 128, 145.5) * 260;
    return c;
  }

  // ---------- background canvas ----------
  const bg = document.getElementById('bg').getContext('2d');
  const fx = document.getElementById('fx').getContext('2d');
  const SNOW = [...Array(170)].map((_, i) => { const r = rng(i * 7 + 1); return { x: r() * W, y: r() * H, s: .6 + r() * 2.6, v: 25 + r() * 55, d: r() * 6.28, w: 10 + r() * 30 }; });
  const BOKEH = [...Array(26)].map((_, i) => { const r = rng(i * 31 + 9); return { x: r() * W * 1.4 - W * .2, y: r() * H, r: 40 + r() * 140, c: r() < .65 ? [213, 178, 106] : (r() < .5 ? [85, 182, 230] : [180, 35, 47]), a: .05 + r() * .11, depth: .2 + r() * .8, ph: r() * 6.28 }; });
  function drawBG(t, cam) {
    const g = bg.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#082A33'); g.addColorStop(1, '#041A20');
    bg.fillStyle = g; bg.fillRect(0, 0, W, H);
    let rg = bg.createRadialGradient(W / 2, -80, 0, W / 2, -80, 900); rg.addColorStop(0, 'rgba(213,178,106,.20)'); rg.addColorStop(1, 'rgba(213,178,106,0)'); bg.fillStyle = rg; bg.fillRect(0, 0, W, H);
    rg = bg.createRadialGradient(W, H, 0, W, H, 900); rg.addColorStop(0, 'rgba(14,110,128,.32)'); rg.addColorStop(1, 'rgba(14,110,128,0)'); bg.fillStyle = rg; bg.fillRect(0, 0, W, H);
    bg.globalCompositeOperation = 'lighter';
    for (const b of BOKEH) {
      const px = ((b.x - cam.x * .035 * b.depth) % (W * 1.4) + W * 1.4) % (W * 1.4) - W * .2, py = b.y - cam.y * .03 * b.depth + Math.sin(t * .3 + b.ph) * 20;
      const a = b.a * (.75 + .25 * Math.sin(t * .9 + b.ph));
      const gr = bg.createRadialGradient(px, py, 0, px, py, b.r);
      gr.addColorStop(0, `rgba(${b.c},${a})`); gr.addColorStop(.6, `rgba(${b.c},${a * .6})`); gr.addColorStop(1, `rgba(${b.c},0)`);
      bg.fillStyle = gr; bg.beginPath(); bg.arc(px, py, b.r, 0, 6.283); bg.fill();
    }
    const dens = .55 + .45 * ep(t, 112, 120);
    for (let i = 0; i < SNOW.length * dens; i++) {
      const s = SNOW[i];
      const y = ((s.y + t * s.v) % (H + 20) + H + 20) % (H + 20) - 10;
      const x = ((s.x + Math.sin(t * .6 + s.d) * s.w - cam.x * .02 * s.s / 3) % W + W) % W;
      bg.fillStyle = `rgba(243,230,200,${.25 + s.s * .16})`; bg.beginPath(); bg.arc(x, y, s.s, 0, 6.283); bg.fill();
    }
    bg.globalCompositeOperation = 'source-over';
  }
  // ---------- particle bursts (analytic, stateless) ----------
  const FG = [...Array(16)].map((_, i) => { const r = rng(i * 53 + 2); return { x: r() * W, y: r() * H, s: 3 + r() * 5, v: 60 + r() * 60, d: r() * 6.28 }; });
  function drawFX(t) {
    fx.clearRect(0, 0, W, H);
    fx.globalCompositeOperation = 'lighter';
    for (const b of BURSTS) {
      const age = t - b.t, life = b.firework ? 2.2 : 1.9; if (age < 0 || age > life) continue;
      const r = rng(b.seed);
      for (let k = 0; k < b.n; k++) {
        const ang = r() * Math.PI * 2, sp = b.sp * (b.firework ? (.75 + r() * .25) : (.25 + r() * .75)), sz = 1.5 + r() * 3.2, pal = r(), dl = r() * .15;
        const a2 = age - dl; if (a2 < 0) continue;
        const k1 = 2.2, dist = sp * (1 - Math.exp(-k1 * a2)) / k1;
        let x = b.x + Math.cos(ang) * dist, y = b.y + Math.sin(ang) * dist * (b.up ? .5 : 1) + (b.confetti ? 160 : 60) * a2 * a2 - (b.up ? 220 * a2 : 0);
        const fade = Math.pow(1 - a2 / life, 1.6);
        let col = pal < .6 ? '235,203,134' : pal < .85 ? '243,230,200' : (b.warm || b.confetti ? '180,35,47' : '85,182,230');
        if (b.confetti && pal > .4 && pal < .6) col = '85,182,230';
        if (b.confetti) {
          fx.save(); fx.translate(x, y); fx.rotate(a2 * 6 + k); fx.fillStyle = `rgba(${col},${fade})`; fx.fillRect(-sz * 1.6, -sz * .6, sz * 3.2, sz * 1.2); fx.restore();
        } else {
          const tw = .6 + .4 * Math.sin(a2 * 20 + k);
          fx.fillStyle = `rgba(${col},${fade * .25})`; fx.beginPath(); fx.arc(x, y, sz * 3.2, 0, 6.283); fx.fill();
          fx.fillStyle = `rgba(${col},${fade * tw})`; fx.beginPath(); fx.arc(x, y, sz, 0, 6.283); fx.fill();
          if (b.firework) { // short trail
            const d2 = sp * (1 - Math.exp(-k1 * Math.max(0, a2 - .08))) / k1;
            fx.strokeStyle = `rgba(${col},${fade * .5})`; fx.lineWidth = sz * .8; fx.beginPath();
            fx.moveTo(b.x + Math.cos(ang) * d2, b.y + Math.sin(ang) * d2 + 60 * (a2 - .08) * (a2 - .08)); fx.lineTo(x, y); fx.stroke();
          }
        }
      }
    }
    // shooting star: "la vostra idea è già lanciata!"
    if (t > 69.6 && t < 73.6) {
      const P = (u) => { u = cl(u); return [lerp(150, 1500, u), 900 - Math.sin(u * Math.PI * .62) * 640 - u * 60]; };
      const u = ep(t, 69.7, 72.5);
      for (let k = 0; k < 60; k++) {
        const uu = u - k * .006; if (uu < 0) break; const [x, y] = P(uu); const a = (1 - k / 60) * (1 - pr(t, 72.6, 73.6));
        fx.fillStyle = `rgba(235,203,134,${a * .5})`; fx.beginPath(); fx.arc(x, y, 16 * (1 - k / 60) + 2, 0, 6.283); fx.fill();
      }
      const [hx, hy] = P(u), ha = 1 - pr(t, 72.6, 73.4);
      const gr = fx.createRadialGradient(hx, hy, 0, hx, hy, 90); gr.addColorStop(0, `rgba(255,248,225,${ha})`); gr.addColorStop(.3, `rgba(235,203,134,${ha * .6})`); gr.addColorStop(1, 'rgba(235,203,134,0)');
      fx.fillStyle = gr; fx.beginPath(); fx.arc(hx, hy, 90, 0, 6.283); fx.fill();
    }
    // a few big soft foreground flakes for depth
    for (const f of FG) {
      const y = ((f.y + t * f.v) % (H + 60) + H + 60) % (H + 60) - 30, x = (f.x + Math.sin(t * .4 + f.d) * 40 + W) % W;
      const gr = fx.createRadialGradient(x, y, 0, x, y, f.s * 4); gr.addColorStop(0, 'rgba(243,230,200,.22)'); gr.addColorStop(1, 'rgba(243,230,200,0)');
      fx.fillStyle = gr; fx.beginPath(); fx.arc(x, y, f.s * 4, 0, 6.283); fx.fill();
    }
    fx.globalCompositeOperation = 'source-over';
  }

  // ---------- frame ----------
  function seek(t) {
    t = cl(t, 0, DUR);
    const c = camera(t);
    world.style.transform = `rotateZ(${-c.rz}deg) rotateX(${-c.rx}deg) rotateY(${-c.ry}deg) translate3d(${-c.x}px,${-c.y}px,${-c.z}px)`;
    S.forEach((s) => {
      const on = t > s.t0 - TD - .3 && t < s.t1 + TD + .3;
      if (on !== s.on) { s.el.style.display = on ? 'block' : 'none'; s.on = on; }
      if (on) s.update(s.el, t);
    });
    drawBG(t, c); drawFX(t); drawSubs(t);
    document.getElementById('fade').style.opacity = Math.max(1 - eo(t, 0, .9), ep(t, 142.6, 145.4));
  }
  window.seek = seek; window.DURATION = DUR;

  // ---------- boot ----------
  const imgs = [...document.images].map((im) => im.complete ? Promise.resolve() : new Promise((res) => { im.onload = im.onerror = res; }));
  window.READY = Promise.all([document.fonts.ready, ...imgs, ...['400 20px "Playfair Display"', 'italic 500 20px "Playfair Display"', 'italic 600 20px "Playfair Display"', '800 20px Mulish', '700 20px Mulish', '400 20px Mulish'].map((f) => document.fonts.load(f))])
    .then(() => { seek(0); return true; });
  const q = new URLSearchParams(location.search);
  if (!q.has('render')) {
    // live mode: click to play with audio; ?t=SECONDS to start elsewhere
    const audio = new Audio('../assets/la-vostra-idea-e-gia-lanciata.m4a');
    const t0 = +(q.get('t') || 0);
    const fit = () => { const s = Math.min(innerWidth / W, innerHeight / H); document.body.style.transform = `translate(${(innerWidth - W * s) / 2}px,${(innerHeight - H * s) / 2}px) scale(${s})`; document.body.style.transformOrigin = '0 0'; };
    addEventListener('resize', fit); fit();
    window.READY.then(() => seek(t0));
    addEventListener('click', () => { if (audio.paused) { audio.currentTime = t0 || audio.currentTime; audio.play(); } else audio.pause(); });
    const loop = () => { if (!audio.paused) seek(audio.currentTime); requestAnimationFrame(loop); }; loop();
  }
})();
