# Christmas Music Battle — runbook (individual songs)

## The format
- One QR for everyone (`/sing/<token>`, printed from **Songs → Print / save QR poster**).
- Each guest writes: name (picked from the guest list), optional title, lyrics (≤ 1500 chars), style in their own words (≤ 400 chars, optional), and **the language of the song: Italiano, English (North American), Español (Latin American) or Schwiizerdütsch (Swiss German)** (required).
- They can edit for **3 minutes**; then the composer polishes it and it is produced on Suno automatically. The finished song appears on their phone.
- **Effort Score (0–100)**: lyrics length 45 · structure 5 · own style 15 · title 5 (computed by the app) + care & originality 30 (judged by the composer).
- Organizer: **Suggest top 3 by Effort Score** → adjust with ★ → the 3 finalists go to the Karaoke final and the **Applause Meter**.

## The loop (every 2 minutes, in the Claude session with the Suno connector)
```
/loop 2m Let's Make a Song: run one pass of docs/SUNO_RUNBOOK.md in andreamidolo/lfgzest-xmas-2026
```

### One pass
Log in: `POST https://lfgzest-xmas-2026.vercel.app/api/admin/login {"password": ...}` (cookie jar), then `GET /api/admin/queue2`.

**A. compose** — for each entry, `PUT /api/admin/entries/<id>/composed` with
`{songTitle, songLyrics, songStyle, aiNote, effortAi (0–30), effortNote}`:
- **Language:** write `songLyrics` (and the title, unless they gave one) in the entry's `language`: Italiano; English = North American (US spelling and idioms, add "American English vocals" to the style); Español = Latin American (neutral LatAm Spanish, "Latin American Spanish vocals"); Schwiizerdütsch = Swiss German dialect (Zürich-style spelling, e.g. "Wienacht", "mir sind", "chunnt"; add "Swiss German dialect vocals" to the style). If the guest wrote in another language, translate and adapt their lines into the chosen one, keeping their images and jokes; add the language to `songStyle` too (e.g. "Italian lyrics").
- **Refine, don't rewrite.** Keep the guest's words. Long lyrics: only add section tags ([Verse]/[Chorus]…), fix obvious typos, maybe repeat their best line as the chorus. Short lyrics (a few lines): expand into a ~75–90 s song built around their lines and theme, in the chosen language.
- Title: theirs if given, else invent one from their words.
- `songStyle` ≤ 1000 chars: start from their style text; make it Suno-ready (genre, BPM, instruments, vocal, mood). One main genre, max one secondary + a small influence; cheerful, catchy, no aggressive mixes. No style given → choose one that fits the lyrics, festive.
- Keep it fun but tasteful (no cruelty, nothing offensive about colleagues); soften if needed and say so in `aiNote`.
- `aiNote`: one friendly sentence for the guest on what you did (shown with their song).
- `effortAi` 0–30 for care & originality (inside jokes, imagery, rhyme, a real story = high; one generic line = low). `effortNote`: a few words why (organizer only).

**B. produce** — for each entry in `produce` (status Composed):
1. `PATCH /api/admin/entries/<id> {"status":"In Production"}`
2. Suno `audio-create` custom mode: title, lyrics, style, `duration` 90, `idempotency_key = lfgz-xmas-e<id>-<updatedAt-ish or attempt>`. Start all of them before waiting.
3. `audio-wait` with all clip ids until complete.
4. `audio-settings visibility=public` on both versions (the karaoke streams `https://cdn1.suno.ai/<id>.mp4`, reachable only when published).
5. Word timings (`audio-lyrics-alignment`) are only needed for the **3 finalists** (big-screen karaoke). Regular songs show plain lyrics. Fetch them when the finalists are chosen and `PUT .../production` with `clips: [{id, alignment}]` for the selected version.
6. `PUT /api/admin/entries/<id>/production` with `clips: [{id, title, duration, image, audioUrl, alignment}]` and `"status":"Ready"`.
On a Suno error: status `Error` and continue with the others.

Never produce hidden entries; never re-produce Ready ones unless the organizer pressed **Redo**.

## Final
- Finalists stay hidden (Karaoke + guests' phones) until the organizer presses **Reveal the final** (Songs → The final) or asks in chat (`PATCH /api/admin/event {"finalRevealed": true}`). After the reveal, the Karaoke shows the 🏆 section and, for the logged-in organizer only, the **👏 Applause Meter** button (also on each finalist's big-screen page).
- Measured on 27.11 (test): Suno ≈ 10 s to streaming, ≈ 30 s to complete; word timings ≈ 2 min after that. A guest's song reaches their phone ≈ 3 min (edit window) + ≤ 2 min (loop) + ≈ 1 min.
- Karaoke: `/karaoke` (finalists first) and `/karaoke/<id>` (big screen, words in time). Organizer preview `/admin/karaoke/<id>`.
- Applause Meter: `/admin/applause` — measures the 3 finalists, reveals the winner.

## Live final (big screen + every phone)
- Organizer phone: `/admin/live` → 🎙 Enable microphone → per finalist **▶ Play** (all screens show the song with synced lyrics + English translation; the big screen `/final?screen=1` plays the audio — click "enable sound" once) → **👏 Applause** (3-2-1 + 7 s, the phone measures, the bar rises live on every screen, score saved) → **📊 Scores** → **🏆 Winner**.
- Guests follow on `/final` (linked from the Karaoke after the reveal); phones are muted, only the big screen plays.
- When the 3 finalists are chosen, for each one: fetch word timings of the selected version, write a line-by-line **English translation** of `songLyrics` (one entry per sung line, section tags excluded) and, for non-English songs, produce an **English version** on Suno (singable English lyrics, same style + "English vocals"), publish it, then `PUT /api/admin/entries/<id>/english {translation: [...], english: {id, title, duration, image, audioUrl, lyrics}}`.
