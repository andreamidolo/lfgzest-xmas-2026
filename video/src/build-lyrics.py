# Merge Suno sub-word tokens into words + lines -> src/lyrics.js
import json, re, sys
toks = json.load(open('assets/alignment-tokens.json'))
chars = []  # (char, start, end)
for t, s, e in toks:
    for c in t: chars.append((c, s, e))
lines, cur, word = [], [], None
def flush():
    global word
    if word and word['w'].strip():
        cur.append(word)
    word = None
for c, s, e in chars:
    if c == '\n':
        flush()
        if cur: lines.append(cur); cur = []
        continue
    if c == ' ':
        flush(); continue
    if word is None: word = {'w': '', 's': s, 'e': e}
    word['w'] += c; word['e'] = e
flush()
if cur: lines.append(cur)
out = []
for ln in lines:
    out.append({'s': round(ln[0]['s'], 3), 'e': round(ln[-1]['e'], 3),
                'w': [[x['w'], round(x['s'], 3), round(x['e'], 3)] for x in ln]})
open('src/lyrics.js', 'w').write('window.LYRICS = ' + json.dumps(out, ensure_ascii=False) + ';\n')
for l in out: print(f"{l['s']:7.2f}-{l['e']:7.2f}  " + ' '.join(w[0] for w in l['w']))
