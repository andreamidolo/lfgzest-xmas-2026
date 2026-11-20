require('./db').loadLocalEnv();
const app = require('./app');
const { findDbUrl } = require('./db');
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`LFG+Zest Christmas Music Challenge running on http://localhost:${port}`);
  const u = findDbUrl();
  console.log('Database: ' + (u ? 'Postgres @ ' + new URL(u).hostname : 'embedded PGlite (./data)'));
  if (!process.env.ADMIN_PASSWORD) console.log('⚠  Using default dev admin password "zest2026" — set ADMIN_PASSWORD in production.');
});
