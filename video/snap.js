// quick stills: node video/snap.js 3 10 20 ...  -> scratch dir
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'); const OUTD = process.env.SNAP_DIR || '/tmp';
const server = http.createServer((q, s) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (!fs.existsSync(f)) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.html') ? 'text/html' : f.endsWith('.png') ? 'image/png' : 'font/woff2' }); fs.createReadStream(f).pipe(s); });
(async () => { await new Promise((r) => server.listen(0, r)); const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', (e) => console.error('pageerror', e.message)); p.on('console', (m) => m.type() === 'error' && console.error(m.text()));
  await p.goto(`http://127.0.0.1:${server.address().port}/video/src/index.html?render=1${process.env.LANG_Q ? '&lang=' + process.env.LANG_Q : ''}`); await p.evaluate(() => window.READY);
  for (const t of process.argv.slice(2)) { const s = Date.now(); await p.evaluate((t) => seek(+t), t); await p.screenshot({ path: `${OUTD}/snap-${t}.jpg`, type: 'jpeg', quality: 80 }); console.log(t, Date.now() - s, 'ms'); }
  await b.close(); server.close(); })();
