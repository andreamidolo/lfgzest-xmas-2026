const app = require('./app');
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`LFG+Zest Christmas Music Challenge running on http://localhost:${port}`);
  if (!process.env.ADMIN_PASSWORD) console.log('⚠  Using default dev admin password "zest2026" — set ADMIN_PASSWORD in production.');
});
