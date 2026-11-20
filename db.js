// Database layer: PostgreSQL in production (DATABASE_URL), embedded PGlite for local preview.
const path = require('path');

let impl = null;

async function init() {
  if (impl) return impl;
  const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;
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

module.exports = { init };
