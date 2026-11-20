// Database layer: PostgreSQL in production (DATABASE_URL), embedded PGlite for local preview.
const path = require('path');

let impl = null;

// Accept DATABASE_URL / POSTGRES_URL, or any *_URL variable holding a postgres:// URL
// (Vercel storage integrations may add a custom prefix, e.g. STORAGE_URL).
function findDbUrl() {
  const env = process.env;
  const isPg = (v) => typeof v === 'string' && /^postgres(ql)?:\/\//.test(v);
  for (const k of ['DATABASE_URL', 'POSTGRES_URL']) if (isPg(env[k])) return env[k];
  const keys = Object.keys(env).filter((k) => isPg(env[k]));
  const pick = keys.find((k) => /_URL$/.test(k) && !/UNPOOLED|NON_POOLING|NO_SSL/.test(k)) || keys[0];
  return pick ? env[pick] : null;
}
function dbEnvKeys() {
  return Object.keys(process.env).filter((k) => /^postgres(ql)?:\/\//.test(process.env[k] || '')).sort();
}

async function init() {
  if (impl) return impl;
  const DB_URL = findDbUrl();
  if (DB_URL) {
    const { Pool } = require('pg');
    const url = DB_URL;
    const local = /localhost|127\.0\.0\.1/.test(url);
    const pool = new Pool({
      connectionString: url,
      ssl: local ? false : { rejectUnauthorized: false },
      max: process.env.VERCEL ? 3 : 10,
    });
    impl = { query: (text, params) => pool.query(text, params), kind: 'postgres' };
  } else {
    if (process.env.VERCEL) {
      throw new Error('DATABASE_URL (or POSTGRES_URL) is required in production (serverless has no persistent disk).');
    }
    const { PGlite } = require('@electric-sql/pglite');
    const dir = process.env.PGLITE_DIR || path.join(__dirname, 'data', 'pglite');
    require('fs').mkdirSync(dir, { recursive: true });
    const db = new PGlite(dir);
    await db.waitReady;
    impl = { query: (text, params) => db.query(text, params), kind: 'pglite' };
  }
  await migrate(impl);
  return impl;
}

async function migrate(db) {
  const stmts = [
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
  for (const s of stmts) await db.query(s);
}

module.exports = { init, findDbUrl, dbEnvKeys };
