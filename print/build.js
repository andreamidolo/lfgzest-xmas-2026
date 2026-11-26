// Printables for the LFG+Zest Christmas Dinner 2026 (27.11.2026, Ristorante Arbostora, Morcote).
//   node print/build.js   (needs `npm i` for qrcode + the preinstalled Playwright/Chromium)
// Output in print/: draw tickets (one per guest) and table tent cards, light + dark, PDF + PNG previews.
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

// ---- draw tickets: 64 x 90 mm unfolded (fold to 64 x 45), 3 x 3 per A4, duplex flip on long edge --
const TW = 64, TH = 90, COLS = 3, ROWS = 3, GX = (210 - COLS * TW) / 2, GY = (297 - ROWS * TH) / 2;

function ticketCSS(t, dark) {
  return `
.grid { position: absolute; left: ${GX}mm; top: ${GY}mm; width: ${COLS * TW}mm; height: ${ROWS * TH}mm; display: grid; grid-template-columns: repeat(${COLS}, ${TW}mm); grid-template-rows: repeat(${ROWS}, ${TH}mm); }
${dark ? `.bleed { position: absolute; left: ${GX - 2}mm; top: ${GY - 2}mm; width: ${COLS * TW + 4}mm; height: ${ROWS * TH + 4}mm; background: #082A33; }` : ''}
.t { position: relative; width: ${TW}mm; height: ${TH}mm; background: ${t.card}; overflow: hidden; }
.t.empty { background: transparent; }
.half { position: absolute; left: 0; width: 100%; height: 45mm; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.half.top { top: 0; } .half.bot { top: 45mm; }
.half.flip { transform: rotate(180deg); }
.frame { position: absolute; inset: 3.2mm; border: .25mm solid ${t.frame}; border-radius: 1.4mm; opacity: ${dark ? '.7' : '.9'}; }
.frame2 { position: absolute; inset: 4.4mm; border: .15mm solid ${t.frame}; border-radius: 1mm; opacity: .35; }
.t .logos { display: flex; gap: 2.4mm; align-items: center; justify-content: center; }
.t .logos .logo { width: 10mm; height: 10mm; }
.t .title { font-family: 'Playfair Display', serif; font-style: italic; font-weight: 500; font-size: 13.5pt; line-height: 1.05; color: ${t.gold}; margin-top: 2.2mm; }
.t .year { font-size: 5.6pt; margin-top: 1.2mm; color: ${t.ink2}; letter-spacing: .3em; font-weight: 700; }
.t .garland { width: 30mm; margin-top: .6mm; }
.t .verse { font-family: 'Playfair Display', serif; font-style: italic; font-size: 7.6pt; line-height: 1.35; color: ${t.ink2}; margin-top: 2mm; }
.t .star { width: 5.5mm; height: 5.5mm; }
.t .lbl { font-size: 5.8pt; }
.t .num { font-family: 'Playfair Display', serif; font-weight: 500; font-size: 64pt; line-height: .9; color: ${t.gold}; margin-top: 1mm; }
.t .sub { font-family: 'Playfair Display', serif; font-style: italic; font-size: 7.4pt; color: ${t.ink2}; margin-top: 1.6mm; }
.t .qrrow { display: flex; align-items: center; gap: 3mm; text-align: left; padding: 0 7mm; }
.t .qr { width: 21mm; height: 21mm; padding: ${dark ? '1.2mm' : '0'}; flex: none; }
.t .cta { font-family: 'Playfair Display', serif; font-style: italic; font-size: 9pt; line-height: 1.15; color: ${t.gold}; }
.t .cta2 { font-size: 5.8pt; line-height: 1.35; color: ${t.ink2}; margin-top: 1.4mm; }
.foldline { position: absolute; left: 7mm; right: 7mm; top: 45mm; border-top: .2mm dashed ${t.frame}; opacity: .35; }
`;
}

function ticketFront(t, i) {
  return `<div class="t"><div class="frame"></div><div class="frame2"></div>
    <div class="half top"><div class="logos">${logo(t, LOGO_ZEST, 'z')}${logo(t, LOGO_LFA, 'a')}</div>
      <div class="title">Christmas Dinner</div><div class="eyebrow year">2026 · Morcote</div>${garland('f' + i)}</div>
    <div class="half bot flip">${star(t.goldSoft)}<div class="verse">Un’ampolla e un bigliettino,<br>la sorte sceglie il tavolino!</div></div>
    <div class="foldline"></div></div>`;
}
function ticketBack(t, table, qrSvg) {
  return `<div class="t"><div class="frame"></div>
    <div class="half top"><div class="eyebrow lbl">Il tuo tavolo</div><div class="num">${table}</div><div class="sub">Il posto, poi, lo scegli tu.</div></div>
    <div class="half bot"><div class="qrrow"><div class="qr">${qrSvg}</div>
      <div><div class="cta">Registrati e lascia la tua idea</div><div class="cta2">Inquadra il QR e scegli il tuo nome: la tua pagina con tavolo, menu e canzone.</div></div></div></div>
    <div class="foldline"></div></div>`;
}

function cropMarks() {
  const m = [];
  const L = 5; // mark length mm
  for (let c = 0; c <= COLS; c++) {
    const x = GX + c * TW;
    m.push(`<div class="mark" style="left:${x - .1}mm;top:${GY - 2 - L}mm;width:.2mm;height:${L}mm"></div>`);
    m.push(`<div class="mark" style="left:${x - .1}mm;top:${GY + ROWS * TH + 2}mm;width:.2mm;height:${L}mm"></div>`);
  }
  for (let r = 0; r <= ROWS; r++) {
    const y = GY + r * TH;
    m.push(`<div class="mark" style="top:${y - .1}mm;left:${GX - 2 - L}mm;height:.2mm;width:${L}mm"></div>`);
    m.push(`<div class="mark" style="top:${y - .1}mm;left:${GX + COLS * TW + 2}mm;height:.2mm;width:${L}mm"></div>`);
    if (r < ROWS) { // fold ticks (dashed look: two short segments)
      const f = y + TH / 2;
      for (const x0 of [GX - 2 - L, GX + COLS * TW + 2]) m.push(`<div class="mark" style="top:${f - .1}mm;left:${x0}mm;height:.2mm;width:1.6mm"></div><div class="mark" style="top:${f - .1}mm;left:${x0 + 3.4}mm;height:.2mm;width:1.6mm"></div>`);
    }
  }
  return m.join('');
}

function ticketsHTML(themeName, qrSvg) {
  const t = THEMES[themeName], dark = themeName === 'scuro';
  const list = TABLES.flatMap((tb) => Array(tb.seats).fill(tb.n));
  const per = COLS * ROWS, pages = [];
  for (let s = 0; s < list.length; s += per) {
    const chunk = list.slice(s, s + per);
    const cells = Array.from({ length: per }, (_, k) => chunk[k]);
    const front = cells.map((n, k) => (n ? ticketFront(t, s + k) : '<div class="t empty"></div>')).join('');
    // back side mirrored left<->right (duplex, flip on long edge)
    const back = Array.from({ length: per }, (_, k) => { const r = Math.floor(k / COLS), c = COLS - 1 - (k % COLS); return cells[r * COLS + c]; })
      .map((n) => (n ? ticketBack(t, n, qrSvg) : '<div class="t empty"></div>')).join('');
    const bleed = (cells2) => (dark ? `<div class="bleed" style="height:${Math.ceil(cells2.filter(Boolean).length / COLS) * TH + 4}mm"></div>` : '');
    pages.push(`<section class="page">${bleed(cells)}${cropMarks()}<div class="grid">${front}</div></section>`);
    pages.push(`<section class="page">${bleed(cells)}<div class="grid">${back}</div></section>`);
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
    ${garland(id)}<div class="foot">Christmas Dinner 2026 · LFG+Zest</div></div>`;
}
function tentsHTML(themeName, qrSvg) {
  const t = THEMES[themeName], dark = themeName === 'scuro';
  // each tent page is followed by a blank page, so the whole file can go through a duplex print job
  const pages = TABLES.map((tb) => `<section class="page">${tentFace(t, tb.n, qrSvg, 'top', 'a' + tb.n)}${tentFace(t, tb.n, qrSvg, 'bot', 'b' + tb.n)}<div class="fold" style="left:0"></div><div class="fold" style="right:0"></div></section><section class="page"></section>`);
  return { css: tentCSS(t, dark), body: pages.join('') };
}

function doc(theme, css, body) {
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>LFG+Zest Christmas Dinner 2026 · ${theme}</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Mulish:wght@400;600;700;800&display=block" rel="stylesheet">
<style>${css}</style></head><body>${body}</body></html>`;
}

(async () => {
  const qrFor = (dark) => QRCode.toString(SONG_URL, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark, light: '#00000000' } });
  const qr = await qrFor(THEMES[THEME].qrDark);
  const tk = ticketsHTML(THEME, qr), tn = tentsHTML(THEME, qr);
  const html = doc(THEME, CSS(THEMES[THEME]) + tk.css + tn.css, tk.body + tn.body);
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
