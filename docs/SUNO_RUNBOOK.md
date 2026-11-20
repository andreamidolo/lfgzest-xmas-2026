# Let's Make a Song — runbook for the dinner

## The format
3 teams · one QR per team · individual ideas (max 160 chars, ~30 s per person) · 3 songs composed by AI.

1. **Aperitivo** — each guest scans their team's QR and adds: name, a small idea (a memory, a situation, a line), optionally a music vibe.
   Nobody has to contribute; no counters are shown to guests.
2. **After ~5 minutes** — organizer presses **Close ideas** (per team or "Close all ideas").
3. **Generate song** — organizer presses it per team. The producer loop (Claude) composes the proposal.
4. **Review** — edit any field, or **Regenerate**. Then **Approve & produce**.
5. **Suno** — the loop produces 2 versions, publishes them, fetches the word timings.
6. **Pick a version → set status Ready** — the song appears in the shared **Karaoke** (`/karaoke`) and the team page reveals the title + "What we did with your ideas".

## Start the loop (≈2 hours)
In the Claude session that has the Suno connector:

```
/loop 2m Let's Make a Song: run one pass of docs/SUNO_RUNBOOK.md in andreamidolo/lfgzest-xmas-2026
```

### One pass
Log in: `POST https://lfgzest-xmas-2026.vercel.app/api/admin/login {"password": ...}` (cookie), then `GET /api/admin/queue`.

**A. For each item in `generate`** — act as composer/music editor and `PUT /api/admin/teams/<teamId>/proposal` with
`{"source":"ai", title, concept, lyrics, style, explanation}`:
- Read all ideas; pick the ones that work best together and find the most interesting common thread. Do not try to use every idea or merge every requested genre.
- Music: one main genre, at most one secondary, one small extra influence. Memorable chorus, cheerful and pleasant. No aggressive combinations, no abrupt genre switches. Weigh the guests' vibes; "Surprise me!" = free choice.
- `style`: Suno style prompt, ≤ 1000 characters (genre, BPM, instruments, vocal, mood).
- `lyrics`: English, for a song of ~75–90 s: [Verse] / [Pre-Chorus] / [Chorus] / [Verse] / [Chorus] / [Outro], short lines, the hook repeated.
- `concept`: one sentence. `explanation`: 3–5 sentences naming contributors by first name and saying what became of their idea (shown to the team after approval).
- If `previousTitle` is set this is a **regeneration**: write a clearly different take.

**B. For each item in `produce`** (approved, not yet produced):
1. `PATCH /api/admin/submissions/<teamId> {"status":"In Production"}`
2. Suno `audio-create` custom mode (`title`, `lyrics`, `style`, `duration` 90), `idempotency_key = lfgz-xmas-<teamId>-r<revision>`
3. `audio-wait` both clip ids until `complete`
4. `audio-settings visibility=public` on both (the karaoke streams `https://cdn1.suno.ai/<id>.mp4`, reachable only when published)
5. `audio-lyrics-alignment` on both, poll until `complete`
6. `PUT /api/admin/submissions/<teamId>/production` with `clips: [{id, title, duration, image, audioUrl: "https://cdn1.suno.ai/<id>.mp4", alignment: words}]`
   (status stays In Production: the organizer listens, picks the version and sets **Ready**.)

Never generate for a team that was not requested, never produce a song that is not Approved.

## Karaoke
- Shared: `/karaoke` (everyone) and `/karaoke/<team>` (big screen, words highlighted in time).
- Organizer preview: `/admin/karaoke/<teamId>` (any status).
- Keys: Space play/pause · F full screen · ←/→ shift lyrics ±0.2 s.
