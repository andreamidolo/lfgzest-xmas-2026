// LFG+Zest Christmas Dinner 2026 — Music Challenge
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const QRCode = require('qrcode');
const { init, findDbUrl, dbEnvKeys } = require('./db');

const LIMITS = { title: 120, concept: 400, lyrics: 3000, style: 1000, explanation: 1500, name: 60, guestName: 40, idea: 160 };
const VIBES = ['Funky & danceable', 'Retro & classy', 'Pop & catchy', 'Soulful & bluesy', 'Surprise me!'];
const STATUSES = ['Draft', 'Approved', 'In Production', 'Ready', 'Played'];
const LIVE = ['Ready', 'Played'];
const DEFAULT_TABLES = Number(process.env.DEFAULT_TABLES || 6);
const DEFAULT_CAPACITY = Number(process.env.DEFAULT_CAPACITY || 6);

const IS_PROD = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || (IS_PROD ? null : 'zest2026');
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.createHash('sha256').update('lfgz-xmas|' + (ADMIN_PASSWORD || '')).digest('hex');
const SESSION_HOURS = 24 * 14;

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);
app.use(express.json({ limit: '32kb' }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

// DB ready (lazy, works for serverless too)
let dbPromise = null;
async function db() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const d = await init();
      const { rows } = await d.query('SELECT COUNT(*)::int AS n FROM event_tables');
      if (rows[0].n === 0) {
        for (let i = 1; i <= DEFAULT_TABLES; i++) {
          await d.query('INSERT INTO event_tables (number, name, capacity, token) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',
            [i, '', DEFAULT_CAPACITY, newToken()]);
        }
      }
      return d;
    })().catch((e) => { dbPromise = null; throw e; });
  }
  return dbPromise;
}
const q = async (text, params) => (await db()).query(text, params);

function newToken() { return crypto.randomBytes(18).toString('base64url'); }

// ---------- helpers ----------
const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
  console.error(e);
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
});
function bad(res, msg, code = 400) { return res.status(code).json({ error: msg }); }
function str(v) { return typeof v === 'string' ? v.replace(/\r\n/g, '\n').trim() : ''; }
function charLen(s) { return Array.from(s).length; }

function baseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/+$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return `${req.protocol}://${req.get('host')}`;
}

// ---------- admin session ----------
function sign(payload) { return crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url'); }
function makeSession() { const exp = String(Date.now() + SESSION_HOURS * 3600e3); return exp + '.' + sign(exp); }
function validSession(tok) {
  if (!tok || typeof tok !== 'string') return false;
  const [exp, sig] = tok.split('.');
  if (!exp || !sig) return false;
  const good = sign(exp);
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return false;
  return Number(exp) > Date.now();
}
function readCookie(req, name) {
  const h = req.headers.cookie || '';
  for (const part of h.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}
function requireAdmin(req, res, next) {
  if (validSession(readCookie(req, 'xmas_admin'))) return next();
  return bad(res, 'Please sign in as organizer.', 401);
}
const attempts = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const a = (attempts.get(ip) || []).filter((t) => now - t < 10 * 60e3);
  attempts.set(ip, a);
  return a.length >= 10;
}

// ---------- guest API (scoped strictly to one team token) ----------
async function tableByToken(token) {
  if (typeof token !== 'string' || token.length < 16 || token.length > 64) return null;
  const { rows } = await q('SELECT id, number, name, locked FROM event_tables WHERE token = $1', [token]);
  return rows[0] || null;
}
const parseProd = (p) => (typeof p === 'string' ? JSON.parse(p) : p || null);
function pubIdea(c) { return c && { id: c.id, name: c.name, idea: c.idea, vibe: c.vibe, participantId: c.participant_id, updatedAt: c.updated_at }; }
async function myIdea(req, tableId) {
  const h = String(req.get('x-idea') || ''); const [id, tok] = h.split('.');
  if (!id || !tok) return null;
  const { rows } = await q('SELECT * FROM contributions WHERE id=$1 AND table_id=$2', [parseInt(id, 10) || 0, tableId]);
  const c = rows[0];
  if (!c || c.edit_token.length !== tok.length || !crypto.timingSafeEqual(Buffer.from(c.edit_token), Buffer.from(tok))) return null;
  return c;
}
async function readIdea(b, tableId) {
  const d = { name: str(b.name), idea: str(b.idea), vibe: VIBES.includes(b.vibe) ? b.vibe : '', participantId: null };
  const pid = parseInt(b.participantId, 10);
  if (pid) { // a team member picked their own name
    const { rows } = await q('SELECT id, name FROM participants WHERE id=$1 AND table_id=$2', [pid, tableId]);
    if (rows[0]) { d.participantId = rows[0].id; d.name = rows[0].name; }
  }
  if (!d.name) return { err: 'Please tell us your name.' };
  if (!d.idea) return { err: 'Please give us an idea — a memory, a situation or a funny line.' };
  if (!d.participantId && charLen(d.name) > LIMITS.guestName) return { err: `Name is too long (max ${LIMITS.guestName} characters).` };
  if (charLen(d.idea) > LIMITS.idea) return { err: `Your idea is too long (max ${LIMITS.idea} characters).` };
  return { d };
}

app.get('/api/t/:token', wrap(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const t = await tableByToken(req.params.token);
  if (!t) return bad(res, 'This team link is not valid. Please scan your team\'s QR code again.', 404);
  const mine = await myIdea(req, t.id);
  const { rows } = await q('SELECT title, concept, explanation, status FROM submissions WHERE table_id=$1', [t.id]);
  const s = rows[0];
  // The song is revealed to the team only once the organizer has approved it.
  const song = s && s.status !== 'Draft' ? { title: s.title, concept: s.concept, explanation: s.explanation, live: LIVE.includes(s.status) } : null;
  const { rows: members } = await q('SELECT id, name FROM participants WHERE table_id=$1 ORDER BY lower(name)', [t.id]);
  res.json({ team: { number: t.number, name: t.name, open: !t.locked }, members, mine: pubIdea(mine), song, vibes: VIBES, limits: { name: LIMITS.guestName, idea: LIMITS.idea } });
}));

app.post('/api/t/:token/ideas', wrap(async (req, res) => {
  const t = await tableByToken(req.params.token);
  if (!t) return bad(res, 'This team link is not valid.', 404);
  if (t.locked) return bad(res, 'Ideas for this team are closed — the AI is already composing!', 423);
  const { d, err } = await readIdea(req.body || {}, t.id); if (err) return bad(res, err);
  const { rows: cnt } = await q('SELECT COUNT(*)::int AS n FROM contributions WHERE table_id=$1', [t.id]);
  if (cnt[0].n >= 80) return bad(res, 'This team already has plenty of ideas!', 429);
  const tok = newToken();
  const { rows } = await q('INSERT INTO contributions (table_id, name, idea, vibe, edit_token, participant_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [t.id, d.name, d.idea, d.vibe, tok, d.participantId]);
  res.json({ ok: true, mine: pubIdea(rows[0]), key: `${rows[0].id}.${tok}` });
}));

app.put('/api/t/:token/ideas/mine', wrap(async (req, res) => {
  const t = await tableByToken(req.params.token);
  if (!t) return bad(res, 'This team link is not valid.', 404);
  if (t.locked) return bad(res, 'Ideas for this team are closed — the AI is already composing!', 423);
  const c = await myIdea(req, t.id); if (!c) return bad(res, 'We could not find your idea on this device.', 404);
  const { d, err } = await readIdea(req.body || {}, t.id); if (err) return bad(res, err);
  const { rows } = await q('UPDATE contributions SET name=$2, idea=$3, vibe=$4, participant_id=$5, updated_at=now() WHERE id=$1 RETURNING *', [c.id, d.name, d.idea, d.vibe, d.participantId]);
  res.json({ ok: true, mine: pubIdea(rows[0]) });
}));

// ---------- public shared karaoke (only songs the organizer marked Ready/Played) ----------
app.get('/api/karaoke', wrap(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const { rows } = await q(`SELECT t.number, t.name AS team_name, s.* FROM submissions s JOIN event_tables t ON t.id = s.table_id
    WHERE s.status = ANY($1) ORDER BY t.number`, [LIVE]);
  const songs = rows.map((r) => {
    const p = parseProd(r.production) || { clips: [] };
    const c = p.clips.find((x) => x.id === p.selected) || p.clips[0];
    return { team: r.number, teamName: r.team_name, title: r.title, concept: r.concept, explanation: r.explanation, lyrics: r.lyrics,
      clip: c ? { id: c.id, image: c.image, duration: c.duration, audioUrl: c.audioUrl || `https://cdn1.suno.ai/${c.id}.mp4`, alignment: c.alignment || null } : null };
  }).filter((x) => x.clip);
  res.json({ songs });
}));

// ---------- admin auth ----------
app.post('/api/admin/login', wrap(async (req, res) => {
  if (!ADMIN_PASSWORD) return bad(res, 'ADMIN_PASSWORD is not configured on the server.', 503);
  const ip = req.ip || 'x';
  if (rateLimited(ip)) return bad(res, 'Too many attempts. Please wait a few minutes.', 429);
  const pw = String((req.body || {}).password || '');
  const a = crypto.createHash('sha256').update(pw).digest();
  const bb = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest();
  if (!crypto.timingSafeEqual(a, bb)) {
    attempts.get(ip).push(Date.now());
    return bad(res, 'Incorrect password.', 401);
  }
  const secure = req.secure ? '; Secure' : '';
  res.setHeader('Set-Cookie', `xmas_admin=${makeSession()}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_HOURS * 3600}${secure}`);
  res.json({ ok: true });
}));
app.post('/api/admin/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'xmas_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
  res.json({ ok: true });
});
app.get('/api/admin/me', (req, res) => res.json({ admin: validSession(readCookie(req, 'xmas_admin')) }));

app.use('/api/admin', requireAdmin, (req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

function subOut(r) {
  return { tableId: r.table_id, title: r.title, concept: r.concept, lyrics: r.lyrics, style: r.style, explanation: r.explanation,
    status: r.status, revision: r.revision, createdAt: r.created_at, updatedAt: r.updated_at, generatedAt: r.generated_at,
    approvedAt: r.approved_at, production: parseProd(r.production) };
}
// ---------- admin: state ----------
app.get('/api/admin/state', wrap(async (req, res) => {
  const [t, p, s, c] = await Promise.all([
    q('SELECT id, number, name, capacity, token, locked, gen_requested_at, applause_score, applause_peak, applause_at FROM event_tables ORDER BY number'),
    q('SELECT id, name, table_id, seat FROM participants ORDER BY lower(name)'),
    q('SELECT * FROM submissions'),
    q('SELECT id, table_id, participant_id, name, idea, vibe, created_at, updated_at FROM contributions ORDER BY created_at'),
  ]);
  const base = baseUrl(req);
  const tables = t.rows.map((r) => ({ ...r, url: `${base}/t/${r.token}` }));
  const subs = s.rows.map(subOut);
  res.json({ baseUrl: base, tables, participants: p.rows, submissions: subs, contributions: c.rows, statuses: STATUSES, vibes: VIBES, limits: LIMITS });
}));

// ---------- admin: tables ----------
app.post('/api/admin/tables', wrap(async (req, res) => {
  const { rows } = await q('SELECT COALESCE(MAX(number),0)+1 AS n FROM event_tables');
  const cap = Math.min(Math.max(parseInt((req.body || {}).capacity, 10) || DEFAULT_CAPACITY, 1), 40);
  await q('INSERT INTO event_tables (number, name, capacity, token) VALUES ($1,$2,$3,$4)', [rows[0].n, '', cap, newToken()]);
  res.json({ ok: true });
}));
app.patch('/api/admin/tables/:id', wrap(async (req, res) => {
  const id = parseInt(req.params.id, 10); const b = req.body || {};
  if ('name' in b) {
    const name = str(b.name);
    if (charLen(name) > 60) return bad(res, 'Table name is too long (max 60).');
    await q('UPDATE event_tables SET name=$2 WHERE id=$1', [id, name]);
  }
  if ('capacity' in b) {
    const c = parseInt(b.capacity, 10);
    if (!(c >= 1 && c <= 40)) return bad(res, 'Capacity must be between 1 and 40.');
    await q('UPDATE event_tables SET capacity=$2 WHERE id=$1', [id, c]);
  }
  if ('locked' in b) await q('UPDATE event_tables SET locked=$2 WHERE id=$1', [id, !!b.locked]);
  res.json({ ok: true });
}));
app.post('/api/admin/tables/:id/regenerate', wrap(async (req, res) => {
  await q('UPDATE event_tables SET token=$2 WHERE id=$1', [parseInt(req.params.id, 10), newToken()]);
  res.json({ ok: true });
}));
app.delete('/api/admin/tables/:id', wrap(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  await q('UPDATE participants SET table_id=NULL, seat=NULL WHERE table_id=$1', [id]);
  await q('DELETE FROM event_tables WHERE id=$1', [id]);
  res.json({ ok: true });
}));
app.post('/api/admin/lock-all', wrap(async (req, res) => {
  await q('UPDATE event_tables SET locked=$1', [!!(req.body || {}).locked]);
  res.json({ ok: true });
}));

// ---------- admin: participants (manual seating only — no random draw) ----------
async function checkSeat(id, tableId, seat) {
  if (tableId == null || seat == null) return null;
  const { rows: t } = await q('SELECT capacity FROM event_tables WHERE id=$1', [tableId]);
  if (!t[0]) return 'Table not found.';
  if (seat < 1 || seat > Math.max(t[0].capacity, 40)) return 'Invalid seat number.';
  const { rows } = await q('SELECT name FROM participants WHERE table_id=$1 AND seat=$2 AND id<>$3', [tableId, seat, id || 0]);
  return rows[0] ? `Seat ${seat} is already taken by ${rows[0].name}.` : null;
}
app.post('/api/admin/participants', wrap(async (req, res) => {
  // Body: { entries: [{name, table?, seat?}] } — table is the TABLE NUMBER
  const entries = Array.isArray((req.body || {}).entries) ? req.body.entries.slice(0, 500) : [];
  const { rows: tabs } = await q('SELECT id, number FROM event_tables');
  const byNum = new Map(tabs.map((t) => [t.number, t.id]));
  let added = 0; const warnings = [];
  for (const e of entries) {
    const name = str(e.name);
    if (!name) continue;
    if (charLen(name) > LIMITS.name) { warnings.push(`Skipped (too long): ${name.slice(0, 30)}…`); continue; }
    let tableId = null; let seat = null;
    const tn = parseInt(e.table, 10);
    if (tn) { tableId = byNum.get(tn) ?? null; if (!tableId) warnings.push(`${name}: table ${tn} does not exist — left unassigned.`); }
    const sn = parseInt(e.seat, 10);
    if (tableId && sn) {
      const err = await checkSeat(0, tableId, sn);
      if (err) warnings.push(`${name}: ${err} Seat left empty.`); else seat = sn;
    }
    await q('INSERT INTO participants (name, table_id, seat) VALUES ($1,$2,$3)', [name, tableId, seat]);
    added++;
  }
  res.json({ ok: true, added, warnings });
}));
app.patch('/api/admin/participants/:id', wrap(async (req, res) => {
  const id = parseInt(req.params.id, 10); const b = req.body || {};
  const { rows } = await q('SELECT * FROM participants WHERE id=$1', [id]);
  if (!rows[0]) return bad(res, 'Participant not found.', 404);
  const cur = rows[0];
  const name = 'name' in b ? str(b.name) : cur.name;
  if (!name) return bad(res, 'Name cannot be empty.');
  if (charLen(name) > LIMITS.name) return bad(res, 'Name is too long.');
  const tableId = 'table_id' in b ? (b.table_id ? parseInt(b.table_id, 10) : null) : cur.table_id;
  let seat = 'seat' in b ? (b.seat ? parseInt(b.seat, 10) : null) : cur.seat;
  if (tableId == null) seat = null;
  if ('table_id' in b && !('seat' in b) && tableId !== cur.table_id) seat = null;
  const err = await checkSeat(id, tableId, seat);
  if (err) return bad(res, err, 409);
  await q('UPDATE participants SET name=$2, table_id=$3, seat=$4 WHERE id=$1', [id, name, tableId, seat]);
  res.json({ ok: true });
}));
app.delete('/api/admin/participants/:id', wrap(async (req, res) => {
  await q('DELETE FROM participants WHERE id=$1', [parseInt(req.params.id, 10)]);
  res.json({ ok: true });
}));

// ---------- admin: submissions ----------
app.patch('/api/admin/submissions/:tableId', wrap(async (req, res) => {
  const status = (req.body || {}).status;
  if (!STATUSES.includes(status)) return bad(res, 'Unknown status.');
  await q(`UPDATE submissions SET status=$2${status === 'Approved' ? ', approved_at=COALESCE(approved_at, now())' : ''} WHERE table_id=$1`, [parseInt(req.params.tableId, 10), status]);
  res.json({ ok: true });
}));
// Ask the composer (Claude, via the organizer's loop) to write / rewrite the team's song.
app.post('/api/admin/teams/:id/generate', wrap(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { rows } = await q('SELECT COUNT(*)::int AS n FROM contributions WHERE table_id=$1', [id]);
  if (!rows[0].n) return bad(res, 'This team has no ideas yet.');
  await q('UPDATE event_tables SET gen_requested_at=now() WHERE id=$1', [id]);
  res.json({ ok: true });
}));
app.post('/api/admin/teams/:id/cancel-generate', wrap(async (req, res) => {
  await q('UPDATE event_tables SET gen_requested_at=NULL WHERE id=$1', [parseInt(req.params.id, 10)]);
  res.json({ ok: true });
}));
// Write the proposal. source "ai" = the composer's draft (resets to Draft); otherwise an organizer edit.
app.put('/api/admin/teams/:id/proposal', wrap(async (req, res) => {
  const id = parseInt(req.params.id, 10); const b = req.body || {};
  const d = { title: str(b.title), concept: str(b.concept), lyrics: str(b.lyrics), style: str(b.style), explanation: str(b.explanation) };
  if (!d.title || !d.lyrics || !d.style) return bad(res, 'Title, lyrics and style are required.');
  for (const k of Object.keys(d)) if (charLen(d[k]) > LIMITS[k]) return bad(res, `${k} is too long (max ${LIMITS[k]} characters).`);
  const ai = b.source === 'ai';
  const { rows } = await q(
    `INSERT INTO submissions AS cur (table_id, title, concept, lyrics, style, explanation, status, theme, generated_at)
       VALUES ($1,$2,$3,$4,$5,$6,'Draft','',${ai ? 'now()' : 'NULL'})
     ON CONFLICT (table_id) DO UPDATE SET title=EXCLUDED.title, concept=EXCLUDED.concept, lyrics=EXCLUDED.lyrics,
       style=EXCLUDED.style, explanation=EXCLUDED.explanation, updated_at=now(), revision=cur.revision+1
       ${ai ? ", generated_at=now(), status='Draft', approved_at=NULL, production=NULL" : ''}
     RETURNING *`, [id, d.title, d.concept, d.lyrics, d.style, d.explanation]);
  if (ai) await q('UPDATE event_tables SET gen_requested_at=NULL WHERE id=$1', [id]);
  res.json({ ok: true, submission: subOut(rows[0]) });
}));
// Work queue for the composer/producer loop.
app.get('/api/admin/queue', wrap(async (req, res) => {
  const [t, s, c] = await Promise.all([
    q('SELECT id, number, name, locked, gen_requested_at FROM event_tables ORDER BY number'),
    q('SELECT * FROM submissions'), q('SELECT table_id, name, idea, vibe FROM contributions ORDER BY created_at')]);
  const subs = new Map(s.rows.map((r) => [r.table_id, r]));
  const generate = t.rows.filter((x) => x.gen_requested_at).map((x) => {
    const prev = subs.get(x.id);
    return { teamId: x.id, team: x.number, teamName: x.name,
      previousTitle: prev ? prev.title : null,
      ideas: c.rows.filter((i) => i.table_id === x.id).map((i) => ({ name: i.name, idea: i.idea, vibe: i.vibe || null })) };
  });
  const produce = t.rows.map((x) => subs.get(x.id)).filter((r) => r && r.status === 'Approved' && !(parseProd(r.production) || {}).clips?.length)
    .map((r) => ({ teamId: r.table_id, team: t.rows.find((x) => x.id === r.table_id).number, revision: r.revision, title: r.title, lyrics: r.lyrics, style: r.style }));
  res.json({ generate, produce });
}));
// Applause meter: only the resulting score is stored, never audio.
app.put('/api/admin/teams/:id/applause', wrap(async (req, res) => {
  const b = req.body || {}; const id = parseInt(req.params.id, 10);
  if (b.score === null) { await q('UPDATE event_tables SET applause_score=NULL, applause_peak=NULL, applause_at=NULL WHERE id=$1', [id]); return res.json({ ok: true }); }
  const score = Number(b.score), peak = Number(b.peak);
  if (!(score >= 0 && score <= 100)) return bad(res, 'Invalid score.');
  await q('UPDATE event_tables SET applause_score=$2, applause_peak=$3, applause_at=now() WHERE id=$1', [id, Math.round(score * 10) / 10, peak >= 0 && peak <= 100 ? Math.round(peak * 10) / 10 : null]);
  res.json({ ok: true });
}));
app.delete('/api/admin/applause', wrap(async (req, res) => {
  await q('UPDATE event_tables SET applause_score=NULL, applause_peak=NULL, applause_at=NULL');
  res.json({ ok: true });
}));
app.delete('/api/admin/contributions/:id', wrap(async (req, res) => {
  await q('DELETE FROM contributions WHERE id=$1', [parseInt(req.params.id, 10)]);
  res.json({ ok: true });
}));
// Suno production results (written by the organizer's agent during the dinner).
// Body: { clips: [{ id, title, duration, image, songUrl, alignment: [{word,start_s,end_s}] }], selected?, status? }
function cleanClip(c) {
  const id = String(c.id || '').replace(/[^a-z0-9-]/gi, '').slice(0, 64);
  if (!id) return null;
  const words = Array.isArray(c.alignment) ? c.alignment.slice(0, 3000).map((w) => ({
    w: String(w.word ?? w.w ?? '').slice(0, 80), s: Number(w.start_s ?? w.s) || 0, e: Number(w.end_s ?? w.e) || 0 })) : null;
  return { id, title: String(c.title || '').slice(0, 200), duration: Number(c.duration) || null,
    image: /^https:\/\/[\w.-]+\.suno\.ai\//.test(c.image || '') ? c.image : null,
    songUrl: `https://suno.com/song/${id}`, audioUrl: typeof c.audioUrl === 'string' && /^https:\/\//.test(c.audioUrl) ? c.audioUrl.slice(0, 500) : null,
    alignment: words };
}
app.put('/api/admin/submissions/:tableId/production', wrap(async (req, res) => {
  const b = req.body || {};
  const tableId = parseInt(req.params.tableId, 10);
  const { rows } = await q('SELECT production FROM submissions WHERE table_id=$1', [tableId]);
  if (!rows[0]) return bad(res, 'No submission for this table.', 404);
  const cur = (typeof rows[0].production === 'string' ? JSON.parse(rows[0].production) : rows[0].production) || { clips: [] };
  if (Array.isArray(b.clips)) {
    const byId = new Map(cur.clips.map((c) => [c.id, c]));
    for (const c of b.clips.slice(0, 6)) { const cc = cleanClip(c); if (cc) byId.set(cc.id, { ...byId.get(cc.id), ...Object.fromEntries(Object.entries(cc).filter(([, v]) => v != null)) }); }
    cur.clips = [...byId.values()].slice(-6);
  }
  if (b.selected !== undefined) cur.selected = cur.clips.some((c) => c.id === b.selected) ? b.selected : cur.selected;
  if (!cur.selected && cur.clips[0]) cur.selected = cur.clips[0].id;
  cur.updatedAt = new Date().toISOString();
  await q('UPDATE submissions SET production=$2 WHERE table_id=$1', [tableId, JSON.stringify(cur)]);
  if (b.status && STATUSES.includes(b.status)) await q('UPDATE submissions SET status=$2 WHERE table_id=$1', [tableId, b.status]);
  res.json({ ok: true, production: cur });
}));
app.delete('/api/admin/submissions/:tableId', wrap(async (req, res) => {
  await q('DELETE FROM submissions WHERE table_id=$1', [parseInt(req.params.tableId, 10)]);
  res.json({ ok: true });
}));

// ---------- admin: QR + exports ----------
app.get('/api/admin/qr/:id.png', wrap(async (req, res) => {
  const { rows } = await q('SELECT number, token FROM event_tables WHERE id=$1', [parseInt(req.params.id, 10)]);
  if (!rows[0]) return res.status(404).end();
  const url = `${baseUrl(req)}/t/${rows[0].token}`;
  const buf = await QRCode.toBuffer(url, { width: 720, margin: 2, errorCorrectionLevel: 'M',
    color: { dark: '#0B2E37', light: '#FFFFFF' } });
  res.setHeader('Content-Type', 'image/png');
  if (req.query.download) res.setHeader('Content-Disposition', `attachment; filename="LFG-Zest-Xmas-Table-${rows[0].number}-QR.png"`);
  res.send(buf);
}));
function csvCell(v) { const s = v == null ? '' : String(v); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
app.get('/api/admin/export/seating.csv', wrap(async (req, res) => {
  const { rows } = await q(`SELECT t.number, t.name AS tname, p.seat, p.name FROM participants p
    LEFT JOIN event_tables t ON t.id = p.table_id ORDER BY t.number NULLS LAST, p.seat NULLS LAST, lower(p.name)`);
  const lines = ['Table,Table name,Seat,Guest', ...rows.map((r) => [r.number ?? 'Unassigned', r.tname, r.seat, r.name].map(csvCell).join(','))];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="LFG-Zest-Xmas-2026-Seating.csv"');
  res.send('﻿' + lines.join('\n'));
}));
app.get('/api/admin/export/songs.csv', wrap(async (req, res) => {
  const { rows } = await q(`SELECT t.number, s.* FROM submissions s JOIN event_tables t ON t.id = s.table_id ORDER BY t.number`);
  const lines = ['Team,Title,Concept,Lyrics,Style,Explanation,Status,Created,Last updated',
    ...rows.map((r) => [r.number, r.title, r.concept, r.lyrics, r.style, r.explanation, r.status,
      new Date(r.created_at).toISOString(), new Date(r.updated_at).toISOString()].map(csvCell).join(','))];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="LFG-Zest-Xmas-2026-Songs.csv"');
  res.send('﻿' + lines.join('\n'));
}));

app.use('/api', (req, res) => bad(res, 'Not found', 404));

// ---------- pages ----------
const pub = path.join(__dirname, 'public');
app.use(express.static(pub, { index: false, maxAge: IS_PROD ? '1h' : 0 }));
const page = (f) => (req, res) => { res.setHeader('Cache-Control', 'no-store'); res.sendFile(path.join(pub, f)); };
app.get('/', page('index.html'));
app.get('/t/:token', page('table.html'));
app.get('/admin', page('admin.html'));
app.get('/admin/print-qr', page('print-qr.html'));
app.get('/admin/board', page('board.html'));
app.get('/admin/applause', page('applause.html'));
app.get('/admin/karaoke/:tableId', page('karaoke.html'));
app.get('/karaoke', page('karaoke-list.html'));
app.get('/karaoke/:team', page('karaoke.html'));
app.get('/health', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const hasDb = !!findDbUrl();
  try { await q('SELECT 1'); res.json({ ok: true, database: true, adminPasswordSet: !!process.env.ADMIN_PASSWORD }); }
  catch (e) {
    const msg = String(e && e.message || e).replace(/postgres(ql)?:\/\/[^\s]+/gi, '[url]').slice(0, 200);
    res.status(500).json({ ok: false, databaseUrlSet: hasDb, dbVarNames: dbEnvKeys(), adminPasswordSet: !!process.env.ADMIN_PASSWORD, error: msg, code: e && e.code });
  }
});
app.use((req, res) => res.status(404).sendFile(path.join(pub, 'index.html')));

module.exports = app;
