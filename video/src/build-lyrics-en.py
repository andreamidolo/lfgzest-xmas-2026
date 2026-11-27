# English karaoke lyrics: each VTT cue takes the timing of the matching Italian sung line
# (first word start -> last word end, from src/lyrics.js); words are spread by length.
import json, re
it = json.loads(open('src/lyrics.js').read().split('=', 1)[1].strip().rstrip(';'))
cues = [c.strip().split('\n') for c in open('assets/la-vostra-idea-e-gia-lanciata.en.vtt').read().split('\n\n')[1:]]
texts = [' '.join(l for l in c if '-->' not in l and not l.strip().isdigit()) for c in cues if any('-->' in l for l in c)]
assert len(texts) == len(it), (len(texts), len(it))
out = []
for ln, txt in zip(it, texts):
    iw = [list(w) for w in ln['w']]
    iw[-1][2] = min(iw[-1][2], iw[-1][1] + .9)   # last token may carry the next line's punctuation time
    # Italian timing curve: fraction of characters sung -> time (keeps the spoken pauses)
    L = [len(w[0]) + 1 for w in iw]; T = sum(L); pts = [(0.0, iw[0][1])]; c = 0
    for w, l in zip(iw, L):
        pts.append((c / T, w[1])); c += l; pts.append((c / T, w[2]))
    def at(f):
        for (f0, t0), (f1, t1) in zip(pts, pts[1:]):
            if f <= f1: return t0 if f1 == f0 else t0 + (t1 - t0) * (f - f0) / (f1 - f0)
        return pts[-1][1]
    s, e = iw[0][1], iw[-1][2]
    words = txt.split()
    wts = [len(w) + 1 for w in words]; tot = sum(wts); acc = 0; ws = []
    for w, k in zip(words, wts):
        a = at(acc / tot); acc += k; b = at(acc / tot)
        ws.append([w, round(a, 3), round(max(b, a + .08), 3)])
    out.append({'s': round(s, 3), 'e': round(e, 3), 'w': ws})
open('src/lyrics.en.js', 'w').write('window.LYRICS_EN = ' + json.dumps(out, ensure_ascii=False) + ';\n')
for l in out: print(f"{l['s']:7.2f}-{l['e']:7.2f} " + ' '.join(w[0] for w in l['w']))
