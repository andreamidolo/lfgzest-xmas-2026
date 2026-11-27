// Render the film frame-by-frame with Playwright + ffmpeg.
// usage: node video/render.js [--from 0] [--to 145.56] [--workers 4] [--out video/out/file.mp4] [--fps 30]
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), { spawn, execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const FPS = +arg('fps', 30), FROM = +arg('from', 0), TO = +arg('to', 145.56), WORKERS = +arg('workers', 4);
const OUT = path.resolve(arg('out', path.join(ROOT, 'video/out/la-vostra-idea-e-gia-lanciata.mp4')));
const TMP = path.resolve(arg('tmp', path.join(require('os').tmpdir(), 'xmas-render')));
fs.mkdirSync(TMP, { recursive: true }); fs.mkdirSync(path.dirname(OUT), { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.woff2': 'font/woff2', '.m4a': 'audio/mp4', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const LANG = arg('lang', '');
  const url = `http://127.0.0.1:${server.address().port}/video/src/index.html?render=1${LANG ? '&lang=' + LANG : ''}`;
  const f0 = Math.round(FROM * FPS), f1 = Math.round(TO * FPS), total = f1 - f0;
  const per = Math.ceil(total / WORKERS);
  const browser = await chromium.launch({ args: ['--disable-gpu-vsync', '--font-render-hinting=none'] });
  const t0 = Date.now(); let done = 0;
  const segs = await Promise.all([...Array(WORKERS)].map(async (_, w) => {
    const a = f0 + w * per, b = Math.min(f1, a + per); if (a >= b) return null;
    const seg = path.join(TMP, `seg${w}.mp4`);
    const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS), seg], { stdio: ['pipe', 'inherit', 'inherit'] });
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => console.error('pageerror', e.message));
    await page.goto(url); await page.evaluate(() => window.READY);
    for (let f = a; f < b; f++) {
      await page.evaluate((t) => window.seek(t), f / FPS);
      const buf = await page.screenshot({ type: 'jpeg', quality: 93 });
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
      if (++done % 150 === 0) { const el = (Date.now() - t0) / 1000; console.log(`${done}/${total} frames · ${el.toFixed(0)}s · eta ${(el / done * (total - done)).toFixed(0)}s`); }
    }
    ff.stdin.end(); await new Promise((r) => ff.on('close', r)); await page.close();
    return seg;
  }));
  await browser.close(); server.close();
  const list = path.join(TMP, 'list.txt'); fs.writeFileSync(list, segs.filter(Boolean).map((s) => `file '${s}'`).join('\n'));
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-ss', String(FROM), '-t', String(TO - FROM), '-i', path.join(ROOT, 'video/assets/la-vostra-idea-e-gia-lanciata.m4a'),
    '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-shortest', '-movflags', '+faststart', OUT], { stdio: 'inherit' });
  console.log('wrote', OUT, `in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
})().catch((e) => { console.error(e); process.exit(1); });
