// Database layer.
// - Production / Neon: node-postgres (`pg`). App traffic uses the POOLED url (DATABASE_URL, PgBouncer);
//   schema migrations use the DIRECT url (DATABASE_URL_UNPOOLED). On Vercel the pool is registered
//   with attachDatabasePool so Fluid compute closes idle connections before a function suspends.
// - DB_DRIVER=neon-http: Neon serverless driver over HTTPS, for runtimes that cannot open TCP 5432.
// - Local preview without a database URL: embedded PGlite under ./data.
const path = require('path');
const fs = require('fs');

let impl = null;

// All app tables live in a dedicated schema, so the app can share a database safely.
const SCHEMA = (process.env.DB_SCHEMA || 'xmas2026').replace(/[^a-z0-9_]/gi, '');
const qualify = (sql) => sql.replace(/(^|[^.\w])(event_tables|participants|submissions)\b/g, `$1${SCHEMA}.$2`);

const isPg = (v) => typeof v === 'string' && /^postgres(ql)?:\/\//.test(v);
// Pooled URL for app queries. Accepts DATABASE_URL / POSTGRES_URL, or any prefixed *_URL a
// storage integration may add (e.g. STORAGE_URL).
function findDbUrl() {
  const env = process.env;
  for (const k of ['DATABASE_URL', 'POSTGRES_URL']) if (isPg(env[k])) return env[k];
  const keys = Object.keys(env).filter((k) => isPg(env[k]));
  const pick = keys.find((k) => /_URL$/.test(k) && !/UNPOOLED|NON_POOLING|NO_SSL/.test(k)) || keys[0];
  return pick ? env[pick] : null;
}
// Direct (non-pooled) URL for migrations; falls back to the pooled one.
function findDirectUrl() {
  const env = process.env;
  for (const k of ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING']) if (isPg(env[k])) return env[k];
  const k = Object.keys(env).find((x) => /UNPOOLED|NON_POOLING/.test(x) && isPg(env[x]));
  return k ? env[k] : findDbUrl();
}
function dbEnvKeys() {
  return Object.keys(process.env).filter((k) => isPg(process.env[k])).sort();
}
function sslFor(url) {
  return /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: true };
}

// Load .env.local / .env for local runs (Vercel injects env vars itself).
function loadLocalEnv(dir = __dirname) {
  for (const f of ['.env.local', '.env']) {
    const p = path.join(dir, f);
    if (fs.existsSync(p) && typeof process.loadEnvFile === 'function') { try { process.loadEnvFile(p); } catch (_) {} }
  }
}

const MIGRATIONS = [
  `CREATE SCHEMA IF NOT EXISTS ${SCHEMA}`,
  `CREATE TABLE IF NOT EXISTS event_tables (
     id SERIAL PRIMARY KEY,
     number INTEGER NOT NULL UNIQUE,
     name TEXT NOT NULL DEFAULT '',
     capacity INTEGER NOT NULL DEFAULT 6,
     token TEXT NOT NULL UNIQUE,
     locked BOOLEAN NOT NULL DEFAULT FALSE,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS participants (
     id SERIAL PRIMARY KEY,
     name TEXT NOT NULL,
     table_id INTEGER REFERENCES event_tables(id) ON DELETE SET NULL,
     seat INTEGER,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS submissions (
     table_id INTEGER PRIMARY KEY REFERENCES event_tables(id) ON DELETE CASCADE,
     title TEXT NOT NULL,
     theme TEXT NOT NULL DEFAULT '',
     lyrics TEXT NOT NULL,
     style TEXT NOT NULL,
     status TEXT NOT NULL DEFAULT 'Submitted',
     revision INTEGER NOT NULL DEFAULT 1,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
];

// Run migrations over a DIRECT connection (never through PgBouncer).
async function migratePostgres(url = findDirectUrl()) {
  if (process.env.DB_DRIVER === 'neon-http') {
    const sql = require('@neondatabase/serverless').neon(url);
    for (const s of MIGRATIONS) await sql.query(qualify(s));
    return;
  }
  const { Client } = require('pg');
  const client = new Client({ connectionString: url, ssl: sslFor(url) });
  await client.connect();
  try { for (const s of MIGRATIONS) await client.query(qualify(s)); }
  finally { await client.end(); }
}

async function init() {
  if (impl) return impl;
  const url = findDbUrl();
  if (url && process.env.DB_DRIVER === 'neon-http') {
    // Optional: Neon serverless driver over HTTPS (port 443). Each query is one HTTP round trip;
    // the app runs single statements only, so no transactions are needed.
    const sql = require('@neondatabase/serverless').neon(url, { fullResults: true });
    impl = { query: async (text, params) => { const r = await sql.query(qualify(text), params || []); return { rows: r.rows }; }, kind: 'neon-http' };
    const { rows } = await impl.query(`SELECT to_regclass('${SCHEMA}.submissions') AS t`);
    if (!rows[0].t) await migratePostgres();
  } else if (url) {
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: url, ssl: sslFor(url), max: process.env.VERCEL ? 5 : 10, idleTimeoutMillis: 5000 });
    if (process.env.VERCEL) {
      try { require('@vercel/functions').attachDatabasePool(pool); } catch (_) {}
    }
    impl = { query: (text, params) => pool.query(qualify(text), params), kind: 'postgres', pool };
    // Normally `npm run build` has migrated already; this is a safety net for a fresh database.
    const { rows } = await impl.query(`SELECT to_regclass('${SCHEMA}.submissions') AS t`);
    if (!rows[0].t) await migratePostgres();
  } else {
    if (process.env.VERCEL) {
      throw new Error('DATABASE_URL (or POSTGRES_URL) is required in production (serverless has no persistent disk).');
    }
    const { PGlite } = require('@electric-sql/pglite');
    const dir = process.env.PGLITE_DIR || path.join(__dirname, 'data', 'pglite');
    fs.mkdirSync(dir, { recursive: true });
    const db = new PGlite(dir);
    await db.waitReady;
    impl = { query: (text, params) => db.query(qualify(text), params), kind: 'pglite' };
    for (const s of MIGRATIONS) await impl.query(s);
  }
  return impl;
}

module.exports = { init, findDbUrl, findDirectUrl, dbEnvKeys, migratePostgres, loadLocalEnv, SCHEMA };
