// Printables for the LFG Holding Christmas Dinner 2026 (27.11.2026, Ristorante Arbostora, Morcote).
//   node print/build.js   (needs `npm i` for qrcode + the preinstalled Playwright/Chromium)
// Output: print/stampa-cena-natale-2026.pdf = name tickets for the draw (one per guest) + table tent cards with the guest-site QR.
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const { chromium } = require('playwright');

// ---- event data -----------------------------------------------------------------------------
// Three real tables (seats): 17 + 9 + 12 = 38 guests (39 on the menu list, Giada cancelled).
const TABLES = [{ n: 1, seats: 17 }, { n: 2, seats: 9 }, { n: 3, seats: 12 }];
const THEME = 'chiaro'; // 'chiaro' (white paper, light on ink) or 'scuro' (full teal)
const SONG_URL = // guest site: pick your name, personal page (table, menu), leave your input
  'https://lfgzest-xmas-2026.vercel.app/sing/ot4-xIs7J_bnHwx5sjkR1BQj';

const OUT = __dirname;
const BRAND = path.join(__dirname, '..', 'public', 'brand');
const b64 = (f) => 'data:image/png;base64,' + fs.readFileSync(path.join(BRAND, f)).toString('base64');
const LOGO_ZEST = b64('lfg-zest-white.png');
const LOGO_LFA = b64('lfa-white.png');

const THEMES = {
  chiaro: { paper: '#FFFFFF', card: '#FFFFFF', ink: '#103A44', ink2: '#4E6A70', gold: '#A9822F', goldSoft: '#D5B26A', frame: '#D5B26A', logo: '#0E6E80', qrDark: '#0B4B57', qrBox: 'transparent', mark: '#8A94A6' },
  scuro:  { paper: '#FFFFFF', card: 'linear-gradient(180deg,#0B3440 0%,#082A33 55%,#051E25 100%)', ink: '#EEF3F2', ink2: '#B9C9CC', gold: '#F3E6C8', goldSoft: '#D5B26A', frame: '#D5B26A', logo: null, qrDark: '#082A33', qrBox: '#FFFFFF', mark: '#8A94A6' },
};

// Fir garland with red berries and a gold star (same drawing as garlandSVG in public/common.js).
function garland(id) {
  let up = '', down = '';
  for (let x = 18; x < 300; x += 6) { const l = 10 + (x % 9); up += `M${x} 40 q3 ${-l * 0.5} 8 ${-l} `; down += `M${x} 40 q3 ${l * 0.5} 8 ${l} `; }
  const berries = [[70, 46], [78, 50], [74, 38], [232, 46], [240, 50], [236, 38], [118, 34], [196, 52]]
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.2" fill="#B4232F"/><circle cx="${x - 1.3}" cy="${y - 1.4}" r="1.2" fill="#FFB3B8" opacity=".7"/>`).join('');
  return `<svg class="garland" viewBox="0 0 320 80" aria-hidden="true"><defs><linearGradient id="g${id}" x1="0" x2="1"><stop offset="0" stop-color="#2E8296" stop-opacity="0"/><stop offset=".15" stop-color="#2F7A64"/><stop offset=".85" stop-color="#2F7A64"/><stop offset="1" stop-color="#2E8296" stop-opacity="0"/></linearGradient></defs>
    <path d="M10 40 C 90 32, 230 48, 310 40" stroke="#5C4A2A" stroke-width="1.5" fill="none"/>
    <path d="${up}" stroke="url(#g${id})" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <path d="${down}" stroke="url(#g${id})" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".85"/>${berries}
    <g transform="translate(160 40)"><path d="M0 -15 L4 -4 L15 -4 L6 3 L9 14 L0 7 L-9 14 L-6 3 L-15 -4 L-4 -4 Z" fill="#D5B26A" stroke="#F3E6C8" stroke-width=".6"/></g></svg>`;
}
const star = (c) => `<svg class="star" viewBox="-16 -16 32 32"><path d="M0 -15 L4 -4 L15 -4 L6 3 L9 14 L0 7 L-9 14 L-6 3 L-15 -4 L-4 -4 Z" fill="${c}"/></svg>`;
const logo = (t, src, cls) => t.logo
  ? `<span class="logo ${cls}" style="-webkit-mask-image:url(${src});mask-image:url(${src});background:${t.logo}"></span>`
  : `<img class="logo ${cls}" src="${src}" alt="">`;

const CSS = (t) => `
@page { size: A4 portrait; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { background: ${t.paper}; }
body { font-family: 'Mulish', sans-serif; color: ${t.ink}; }
.page { width: 210mm; height: 297mm; position: relative; overflow: hidden; page-break-after: always; background: ${t.paper}; }
.page:last-child { page-break-after: auto; }
.logo { display: inline-block; -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; object-fit: contain; }
.serif { font-family: 'Playfair Display', Georgia, serif; }
.eyebrow { font-family: 'Mulish', sans-serif; font-weight: 800; letter-spacing: .22em; text-transform: uppercase; color: ${t.goldSoft === t.gold ? t.gold : t.gold}; }
.garland { display: block; }
.mark { position: absolute; background: ${t.mark}; }
.qr { background: ${t.qrBox}; border-radius: 1.6mm; }
.qr svg { display: block; width: 100%; height: 100%; }
`;

// ---- name tickets for the draw: one per guest, 64 x 38 mm, 3 x 7 per A4, single-sided, no QR ----
// 38 guests from the menu list "Scelte piatti per partecipante" (Giada cancelled).
// Guests (nicknames as shown in the app) + menu choice, exported from the live app: print/guests.json
const GUESTS_DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'guests.json'), 'utf8'));
const GUESTS = GUESTS_DATA.map((g) => g.name);
const TW = 64, TH = 38, COLS = 3, ROWS = 7, GX = (210 - COLS * TW) / 2, GY = (297 - ROWS * TH) / 2;

function ticketCSS(t, dark) {
  return `
.grid { position: absolute; left: ${GX}mm; top: ${GY}mm; width: ${COLS * TW}mm; display: grid; grid-template-columns: repeat(${COLS}, ${TW}mm); grid-auto-rows: ${TH}mm; }
.t { position: relative; width: ${TW}mm; height: ${TH}mm; background: ${t.card}; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.t .frame { position: absolute; inset: 2.6mm; border: .25mm solid ${t.frame}; border-radius: 1.4mm; opacity: ${dark ? '.7' : '.9'}; }
.t .frame2 { position: absolute; inset: 3.6mm; border: .15mm solid ${t.frame}; border-radius: 1mm; opacity: .35; }
.t .top { display: flex; align-items: center; gap: 1.6mm; }
.t .top .logo { width: 6.2mm; height: 6.2mm; }
.t .ev { font-size: 5.4pt; letter-spacing: .24em; margin-left: 1mm; }
.t .name { font-family: 'Playfair Display', serif; font-weight: 600; font-size: 13pt; line-height: 1.1; color: ${t.ink}; margin-top: 2.4mm; padding: 0 6mm; }
.t .name.long { font-size: 11.5pt; }
.t .garland { width: 26mm; margin-top: 1.2mm; }
`;
}
function ticket(t, name, i) {
  return `<div class="t"><div class="frame"></div><div class="frame2"></div>
    <div class="top">${logo(t, LOGO_ZEST, 'z')}${logo(t, LOGO_LFA, 'a')}<span class="eyebrow ev">Christmas Dinner 2026</span></div>
    <div class="name${name.length > 14 ? ' long' : ''}">${name}</div>${garland('n' + i)}</div>`;
}
function cropMarks(rows) {
  const m = [], L = 5;
  for (let c = 0; c <= COLS; c++) {
    const x = GX + c * TW;
    m.push(`<div class="mark" style="left:${x - .1}mm;top:${GY - 2 - L}mm;width:.2mm;height:${L}mm"></div>`);
    m.push(`<div class="mark" style="left:${x - .1}mm;top:${GY + rows * TH + 2}mm;width:.2mm;height:${L}mm"></div>`);
  }
  for (let r = 0; r <= rows; r++) {
    const y = GY + r * TH;
    m.push(`<div class="mark" style="top:${y - .1}mm;left:${GX - 2 - L}mm;height:.2mm;width:${L}mm"></div>`);
    m.push(`<div class="mark" style="top:${y - .1}mm;left:${GX + COLS * TW + 2}mm;height:.2mm;width:${L}mm"></div>`);
  }
  return m.join('');
}
function ticketsHTML(themeName) {
  const t = THEMES[themeName], dark = themeName === 'scuro';
  const per = COLS * ROWS, pages = [];
  for (let s = 0; s < GUESTS.length; s += per) {
    const chunk = GUESTS.slice(s, s + per), rows = Math.ceil(chunk.length / COLS);
    pages.push(`<section class="page">${cropMarks(rows)}<div class="grid">${chunk.map((n, k) => ticket(t, n, s + k)).join('')}</div></section>`);
  }
  return { css: ticketCSS(t, dark), body: pages.join('') };
}

// ---- table tent cards: A4 portrait folded in half (two 210 x 148.5 faces) -----------------------
function tentCSS(t, dark) {
  return `
.face { position: absolute; left: 0; width: 210mm; height: 148.5mm; background: ${t.card}; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.face.top { top: 0; transform: rotate(180deg); } .face.bot { top: 148.5mm; }
.face .frame { position: absolute; inset: 9mm; border: .35mm solid ${t.frame}; border-radius: 2.4mm; opacity: ${dark ? '.75' : '.9'}; }
.face .frame2 { position: absolute; inset: 11mm; border: .2mm solid ${t.frame}; border-radius: 1.8mm; opacity: .35; }
.face .logos { display: flex; gap: 6mm; align-items: center; } .face .logos .logo { width: 17mm; height: 17mm; }
.face .row { display: flex; align-items: center; gap: 14mm; margin-top: 5mm; }
.face .lbl { font-size: 9pt; text-align: center; letter-spacing: .3em; }
.face .num { font-family: 'Playfair Display', serif; font-weight: 500; font-size: 150pt; line-height: .74; margin-top: 1mm; color: ${t.gold}; text-align: center; }
.face .qrcol { width: 52mm; text-align: center; }
.face .qr { width: 40mm; height: 40mm; margin: 0 auto; padding: ${dark ? '2mm' : '0'}; }
.face .cta { font-family: 'Playfair Display', serif; font-style: italic; font-size: 13pt; line-height: 1.15; color: ${t.gold}; margin-top: 3mm; }
.face .cta2 { font-size: 7.4pt; line-height: 1.4; color: ${t.ink2}; margin-top: 1.4mm; }
.face .garland { width: 74mm; margin-top: 3mm; }
.face .foot { font-family: 'Playfair Display', serif; font-style: italic; font-size: 10pt; color: ${t.ink2}; margin-top: 1mm; }
.fold { position: absolute; top: 148.4mm; height: .2mm; width: 6mm; background: ${t.mark}; }
`;
}
function tentFace(t, n, qrSvg, pos, id) {
  return `<div class="face ${pos}"><div class="frame"></div><div class="frame2"></div>
    <div class="logos">${logo(t, LOGO_ZEST, 'z')}${logo(t, LOGO_LFA, 'a')}</div>
    <div class="row"><div><div class="eyebrow lbl">Tavolo</div><div class="num">${n}</div></div>
      <div class="qrcol"><div class="qr">${qrSvg}</div><div class="cta">Registrati e lascia<br>la tua idea!</div><div class="cta2">Inquadra il QR e scegli il tuo nome:<br>tavolo, menu e la tua canzone.</div></div></div>
    ${garland(id)}<div class="foot">Christmas Dinner 2026 · LFG Holding</div></div>`;
}
function tentsHTML(themeName, qrSvg) {
  const t = THEMES[themeName], dark = themeName === 'scuro';
  const pages = TABLES.map((tb) => `<section class="page">${tentFace(t, tb.n, qrSvg, 'top', 'a' + tb.n)}${tentFace(t, tb.n, qrSvg, 'bot', 'b' + tb.n)}<div class="fold" style="left:0"></div><div class="fold" style="right:0"></div></section>`);
  return { css: tentCSS(t, dark), body: pages.join('') };
}

// ---- dish choices: one list per guest + totals per dish (for the restaurant) -------------------
const COURSES = ['Antipasto', 'Primo', 'Secondo'];
function menuCSS(t) {
  return `
.mp { padding: 16mm 15mm 12mm; }
.mp .head { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: .4mm solid ${t.frame}; padding-bottom: 3mm; }
.mp .head .logos { display: flex; gap: 2.4mm; } .mp .head .logo { width: 11mm; height: 11mm; }
.mp h1 { font-family: 'Playfair Display', serif; font-weight: 500; font-size: 22pt; color: ${t.ink}; line-height: 1; }
.mp h1 em { color: ${t.gold}; }
.mp .sub { font-size: 8pt; color: ${t.ink2}; margin-top: 1.6mm; }
.mp table { width: 100%; border-collapse: collapse; margin-top: 3mm; font-size: 8.2pt; }
.mp th { text-align: left; font-size: 6.6pt; letter-spacing: .2em; text-transform: uppercase; color: ${t.gold}; font-weight: 800; padding: 1.6mm 2mm; border-bottom: .3mm solid ${t.frame}; }
.mp td { padding: .75mm 2mm; line-height: 1.25; border-bottom: .15mm solid #E3E8EF; vertical-align: top; color: ${t.ink}; }
.mp td.n { font-family: 'Playfair Display', serif; font-weight: 600; font-size: 9.6pt; white-space: nowrap; }
.mp td.no { color: ${t.ink2}; width: 7mm; font-variant-numeric: tabular-nums; }
.mp tr:nth-child(even) td { background: #F7F9FA; }
.mp .dessert { margin-top: 3mm; font-size: 8.4pt; color: ${t.ink2}; } .mp .dessert b { color: ${t.ink}; }
.mp .tot { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6mm; margin-top: 8mm; }
.mp .tot h2 { font-size: 7pt; letter-spacing: .22em; text-transform: uppercase; color: ${t.gold}; font-weight: 800; border-bottom: .3mm solid ${t.frame}; padding-bottom: 1.6mm; }
.mp .tot .it { display: flex; justify-content: space-between; gap: 3mm; padding: 2mm 0; border-bottom: .15mm solid #E3E8EF; font-size: 10pt; }
.mp .tot .it b { font-family: 'Playfair Display', serif; font-size: 16pt; color: ${t.gold}; line-height: 1; }
.mp .who { font-size: 7.4pt; color: ${t.ink2}; margin-top: .6mm; line-height: 1.35; }
.mp .foot { position: absolute; left: 15mm; right: 15mm; bottom: 9mm; display: flex; justify-content: space-between; font-size: 7pt; color: ${t.ink2}; }
`;
}
function menuHTML(themeName) {
  const t = THEMES[themeName];
  const rows = GUESTS_DATA.map((g) => ({ ...g, c: g.menu.split(' · ') }));
  const dessert = (rows.find((r) => r.c[3]) || { c: [] }).c[3] || '';
  const head = (title, sub) => `<div class="head"><div><h1>${title}</h1><div class="sub">${sub}</div></div><div class="logos">${logo(t, LOGO_ZEST, 'z')}${logo(t, LOGO_LFA, 'a')}</div></div>`;
  const foot = (p) => `<div class="foot"><span>LFG Holding Christmas Dinner 2026 · Ristorante Arbostora, Morcote · 27.11.2026</span><span>${p}</span></div>`;
  const list = `<section class="page mp">${head('Scelte <em>piatti</em>', `${rows.length} ospiti · in ordine alfabetico (nomi come nell'app)`)}
    <table><thead><tr><th></th><th>Ospite</th>${COURSES.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>
    ${rows.map((r, i) => `<tr><td class="no">${i + 1}</td><td class="n">${r.name}</td><td>${r.c[0] || ''}</td><td>${r.c[1] || ''}</td><td>${r.c[2] || ''}</td></tr>`).join('')}
    </tbody></table>${dessert ? `<div class="dessert"><b>Dessert per tutti</b> — ${dessert.replace(/^Dessert:\s*/, '')}</div>` : ''}${foot('Scelte piatti · 1/2')}</section>`;
  const totals = COURSES.map((course, k) => {
    const m = new Map(); rows.forEach((r) => { const d = r.c[k]; if (!d) return; if (!m.has(d)) m.set(d, []); m.get(d).push(r.name); });
    return `<div><h2>${course}</h2>${[...m.entries()].sort((a, b) => b[1].length - a[1].length).map(([d, who]) => `<div class="it"><div>${d}<div class="who">${who.join(', ')}</div></div><b>${who.length}</b></div>`).join('')}</div>`;
  }).join('');
  const sum = `<section class="page mp">${head('Riepilogo <em>cucina</em>', 'Quante porzioni per piatto, e chi le ha scelte')}<div class="tot">${totals}</div>
    ${dessert ? `<div class="dessert" style="margin-top:8mm"><b>Dessert</b> — ${dessert.replace(/^Dessert:\s*/, '')} · <b>${rows.length}</b></div>` : ''}${foot('Scelte piatti · 2/2')}</section>`;
  return { css: menuCSS(t), body: list + sum };
}

function doc(theme, css, body) {
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>LFG Holding Christmas Dinner 2026 · ${theme}</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Mulish:wght@400;600;700;800&display=block" rel="stylesheet">
<style>${css}</style></head><body>${body}</body></html>`;
}

(async () => {
  const qrFor = (dark) => QRCode.toString(SONG_URL, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark, light: '#00000000' } });
  const qr = await qrFor(THEMES[THEME].qrDark);
  const tk = ticketsHTML(THEME), tn = tentsHTML(THEME, qr), mn = menuHTML(THEME);
  const html = doc(THEME, CSS(THEMES[THEME]) + tk.css + tn.css + mn.css, tk.body + tn.body + mn.body);
  const name = 'stampa-cena-natale-2026';
  const htmlPath = path.join(OUT, 'src', name + '.html');
  fs.mkdirSync(path.dirname(htmlPath), { recursive: true });
  fs.writeFileSync(htmlPath, html);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + htmlPath, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: path.join(OUT, name + '.pdf'), preferCSSPageSize: true, printBackground: true });
  console.log('PDF', name);
  await browser.close();
})();
