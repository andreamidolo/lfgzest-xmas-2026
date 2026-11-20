# Suno production during the dinner

How songs get from the app to Suno and onto the big screen.

## The flow
1. A table submits its song (QR page).
2. The organizer reviews it in **/admin → Songs** and presses **Lock**. Locking = approval to produce.
3. The Claude session (with the Suno connector) picks up every **locked** table that has no Suno version yet:
   - sets status **In Production**
   - `audio-create` (custom mode: title, lyrics, style) → 2 versions
   - `audio-wait` until complete
   - `audio-settings visibility=public` on both versions (the karaoke page streams the published file `https://cdn1.suno.ai/<id>.mp4`)
   - `audio-lyrics-alignment` for both versions (poll until `complete`)
   - `PUT /api/admin/submissions/<tableId>/production` with the clips + word timings, status **Ready**
4. In the dashboard: pick the version, press **▶ Karaoke**, full screen (F), Space to play.

## Start it (about 2 hours, during dinner)
In the Claude session that has the Suno connector, type:

```
/loop 3m Christmas Music Battle: produce locked songs on Suno (see docs/SUNO_RUNBOOK.md in andreamidolo/lfgzest-xmas-2026)
```

Stop it with Esc / by saying "stop the loop". Each iteration:
- logs in to `https://lfgzest-xmas-2026.vercel.app` with the admin password,
- reads `/api/admin/state`,
- for each submission where the table is locked and `production` is empty (or has no clips): produce as above,
- uses `idempotency_key = lfgz-xmas-<tableId>-r<revision>` so a retry never pays twice,
- never sends unlocked (unapproved) songs.

## Karaoke page
`/admin/karaoke/<tableId>` — Space play/pause · F full screen · ←/→ shift lyrics ±0.2 s · version selector · "Load MP3…" fallback if the Suno file is not reachable (e.g. song not published).
