// `npm run build`: apply the schema over the DIRECT (unpooled) connection.
const path = require('path');
const db = require('../db');
db.loadLocalEnv(path.join(__dirname, '..'));
(async () => {
  if (!db.findDbUrl()) { console.log('No DATABASE_URL set — skipping migrations (local preview uses embedded PGlite).'); return; }
  const direct = db.findDirectUrl();
  const host = new URL(direct).hostname;
  await db.migratePostgres(direct);
  console.log(`Migrations applied to schema "${db.SCHEMA}" on ${host} (${/-pooler/.test(host) ? 'pooled' : 'direct'} connection).`);
})().catch((e) => { console.error('Migration failed:', e.message); process.exit(1); });
