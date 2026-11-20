# LFG+Zest Christmas Dinner 2026 — Music Challenge

Friday 27 November 2026 · Ristorante Arbostora, Morcote

Node.js (Express) + PostgreSQL. Design: LFG Holding system (deep teal, Playfair Display + Mulish) with a Christmas layer; logos for LFG+Zest, LFA and LFG Holding are in `public/brand/`.

## Pages
| URL | Who | What |
|---|---|---|
| `/` | everyone | Event landing page |
| `/t/<token>` | one representative per table (QR) | Song form → confirmation → edit until locked |
| `/admin` | organizer (password) | Songs (live, Copy Lyrics / Style / All, status, lock), Seating (manual), Tables & QR |
| `/admin/print-qr` | organizer | All QR cards, 4 per A4 page — print or save as PDF |

## Run locally
```bash
npm install
npm start          # http://localhost:3000 — admin password "zest2026" (dev only)
```
With no `DATABASE_URL`, the app uses an embedded Postgres (PGlite) under `./data/`.

## Publish (Vercel + Neon, free)
1. In Vercel: **Add New → Project** → import this GitHub repo (no build settings needed).
2. Environment variable: `ADMIN_PASSWORD` (optionally `PUBLIC_BASE_URL` = the final https URL; otherwise the `*.vercel.app` production URL is used automatically).
3. **Storage → Create Database → Neon (Free) → Connect to project.** This sets `DATABASE_URL` / `POSTGRES_URL`; tables are created on first request.
4. **Deployments → Redeploy.**
5. Open `https://<your-app>.vercel.app/admin`, sign in, and check that the URLs in **Tables & QR** use the public domain before printing.

Any Node host with Postgres works too (Render, Railway, Fly, Supabase): `npm start`, same variables.

## On the night — checklist
- Before dinner: enter guests (Seating → paste names), test one QR with your phone, then delete that test song.
- Draw: as paper cards are drawn, assign each guest to a table and seat.
- Songs arrive live in **Songs** (refreshes every 4 s). Use **Copy Style** → Suno "Style of Music", **Copy Lyrics** → Suno "Lyrics".
- When a song goes into Suno: set status **In Production** and **Lock** the table. Then **Ready** → **Played**.

## Security
- Admin: password → HMAC-signed HttpOnly cookie (SameSite=Strict, 14 days), login rate-limited.
- Guests: each table has a random 144-bit token in its link; the API only reads/writes that table's song and never returns other tables' data. **New link** in Tables & QR invalidates an old QR.
- Limits (1,000 characters for lyrics and style) are enforced in the browser and on the server; locking is checked atomically on the server.
- No random seating, voting, leaderboards, payments or Suno integration, as requested.
