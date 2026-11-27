# Opening video — "La vostra idea è già lanciata"

Song (Suno, id 2d4c5357-9415-4c0e-ab7a-32eababc8280), 2:25, Italian with a Spanish spoken line.
- `assets/la-vostra-idea-e-gia-lanciata.m4a` — audio (opus in mp4) with an embedded timed-lyrics track
- `assets/la-vostra-idea-e-gia-lanciata.srt` — the same lyrics with timings, extracted from the file (sections like [Verse 1] are zero-length markers)
- `assets/alignment-tokens.json` — word-level timing from Suno's lyric alignment (sub-word tokens: `[text, start_s, end_s]`)

Brand assets: `../public/brand/` (LFG+Zest, LFA, LFG Holding logos, white versions), colors/typography in `../public/styles.css`.

## Output
- `out/la-vostra-idea-e-gia-lanciata.mp4` — full film, 1920×1080, 30 fps, H.264 + AAC 256k, 2:25
- `out/anteprima-0-30s.mp4` — first 30 s preview

## How it is made
A single HTML page (`src/index.html` + `src/film.js`) where every pixel is a pure function of the song time `t`
(`window.seek(t)`). Sheets ("fogli") are placed in 3D space with CSS 3D transforms; a camera glides between them
with the `cubic-bezier(.65,0,.35,1)` easing, a slow push-in on each sheet and a pull-back arc during transitions.
Background canvas: night-teal gradient, gold/teal/berry bokeh with parallax, falling champagne snow.
FX canvas: analytic (stateless) particle bursts, fireworks and the shooting star on "lanciata".
Subtitles: karaoke word by word from the Suno alignment (gold fill on the sung word); in the two choruses the lyrics
become the big title in the middle of the screen instead.

```bash
python3 video/src/build-lyrics.py            # alignment-tokens.json -> src/lyrics.js  (run from video/)
node video/render.js                          # full film  -> video/out/la-vostra-idea-e-gia-lanciata.mp4
node video/render.js --from 0 --to 30 --out video/out/anteprima-0-30s.mp4
node video/snap.js 12 40 95                   # stills for quick checks (SNAP_DIR=…)
```
Needs Node + Playwright (Chromium) + ffmpeg. ~7 minutes on 4 cores.

Live mode (backup for the evening): serve the repo root over http (e.g. `npx http-server .`) and open
`/video/src/index.html` full-screen; click to start the song (`?t=57` to start at a given second).

## Storyboard
| Time | Lyric | Sheet |
|---|---|---|
| 0:00–0:04 | Signore e signori, benvenuti! | Camera flies in through gold snow; LFG+Zest and LFA logos side by side rise from depth with a light sweep; "Benvenuti!" in gold italic, garland |
| 0:04–0:12 | Una sorpresa… grigliata estiva annuale | Calendar "Prossimo incontro · 12 mesi": "12 mesi" gets struck out, the page flips to "Estate 2027" with a sun; a grill lights up with flames |
| 0:12–0:18 | E stasera? Due sorprese! | Two gifts (1 and 2) drop in, lids pop with golden light |
| 0:18–0:31 | Ampolla e bigliettino… anche i CEO | On "ampolla" the jar appears and a shower of folded tickets drops in; the jar is shaken and a ticket is drawn onto table 2 of the floor plan with the three real tables (18, 9, 12 seats); the chairs fill; on "anche i CEO": "Nessuno escluso!" and nine name tickets (Siro, Enrico, Walter, Michele, Emanuele, Morys, Gianluca, Paolo, Edoardo) try to run away, then go into the ampolla one by one |
| 0:31–0:38 | ¡Bienvenida especial a Naimo y Sandra… Matteo! | Waving red-gold ribbon, three name cards flip in on each name |
| 0:38–0:41 | E ora tocca a voi: QR code | Table card (Tavolo 2) with a stylised QR that lights up and gets scanned |
| 0:41–0:50 | Scansionatelo, nome, storia, stile | Phone with the app (LFG+Zest and LFA logos): "Chi sei?" name list → personal area "Ciao Michele!" with your menu, your table, your song → story typed, "Serenata" selected, "Invia"; steps on the left: scan the QR, choose your name, your area (menu · table · song), a story and a style |
| 0:50–0:57 | Bastano poche parole… l'AI | Words spiral into a golden AI orb that pulses and emits music notes and an equaliser ring |
| 0:57–1:14 | Chorus | Big karaoke title, rotating record, floating notes; shooting star on "la vostra idea è già lanciata!" |
| 1:14–1:19 | Ognuno riceverà la propria canzone… tre finaliste | Wall of 24 songs; three come forward with trophies |
| 1:19–1:23 | Applausometro | Gauge and needle rising to 100, "CLAP!" bursts, confetti |
| 1:23–1:31 | Buono da cento franchi | Gold voucher "CHF 100" with LFG+Zest and LFA logos spins in, counts up, shine and confetti |
| 1:31–1:48 | Final chorus | Spiral Christmas tree of lights with star, big karaoke title, fireworks |
| 1:48–1:52 | Ma prima… con chi ci tocca cenare? | The ampolla returns with tickets orbiting around it |
| 1:52–2:25 | Instrumental | LFG+Zest and LFA logos side by side, LFG Holding below; "Buon Natale!", "Buona serata a tutti", date and venue; fireworks, fade to black |
