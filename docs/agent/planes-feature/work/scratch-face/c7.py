"""Version C of the three-quarter: fork A's plane construction (hair mass, shadow fields, placements) with the
features re-weighted against the photo and denser plane-bounded shadow where the photo is darkest."""
import os, sys
from parse_aa import parse
from angle_tool import out
R = parse(open('local/forkA-9.txt').read())
def setr(r, keep, new): R[r] = [(x, g) for x, g in R.get(r, []) if keep(x)] + new
EYE = os.environ.get('EYE', 'E5')
EYES = {
 'E0': {12: [(302, '_,.-‐-､')], 13: [(309, ',ｨ=ﾆﾃﾂ=ｧ､')], 14: [(318, "｀ー-‐'")]},
 'E1': {12: [(304, ',.ｨ=ﾆ二ﾆ=､')], 13: [(306, "ｨ'´弋ﾂ:ﾉ ")], 14: [(320, "｀ｰ‐-'")]},
 'E2': {12: [(300, '_,.ｨ=ﾆ三ﾆ=､')], 13: [(310, "ヽ 弋::ﾂ'")], 14: [(322, "｀ー‐'")]},
 'E3': {12: [(304, ',.-ｨ≠ﾆﾆ=､')], 13: [(308, "ｲ'´弋ｿ`ヽ")], 14: [(322, "｀ー-‐'")]},
 'E5': {12: [(310, ',.-‐‐-､')], 13: [(304, "ｨ=ﾆ三ﾃﾂﾆ=､")], 14: [(324, "｀ー‐'")]},
 'E4': {12: [(306, ',.-‐‐-､')], 13: [(300, "ｨ=ﾆ三ﾃﾂﾆ=､")], 14: [(322, "｀ー‐'")]},
}
for r, runs in EYES[EYE].items(): setr(r, lambda x: not 280 < x < 380, runs)
# nose: darker nostril and wing on the plane points (wing nsL 383, nostril wL0-wL1 396-412, tip 425-443)
setr(16, lambda x: not 370 < x < 430, [(378, ',ｨ⌒ヽ')])
setr(17, lambda x: not 370 < x < 432, [(374, "(_,ゞ､_ﾉ")])
# mouth: male-lip construction on the planes (parting mcL 378 -> pt 421; top mark over the lip centre; under-lip shadow)
setr(19, lambda x: not 390 < x < 440, [(412, 'ー')])
setr(20, lambda x: not 370 < x < 440, [(376, "､_,.-‐ﾆﾆ=‐'")])
setr(21, lambda x: not 400 < x < 432, [(404, ';:;:;')])
# under the jaw and the front of the neck: the darkest plane in the photo, denser and hugging the jaw edge
setr(25, lambda x: x >= 389, [(x, ';' if (x // 8) % 2 else ':') for x in range(292, 384, 8)])
setr(26, lambda x: not 340 < x < 384, [(x, ':') for x in range(344, 380, 8)])
setr(27, lambda x: not 340 < x < 382, [(x, '.') for x in range(348, 378, 10)])
# nose: tip silhouette breaks past the far cheek; wing and nostril close under it
setr(16, lambda x: not 370 < x < 445, [(378, ',ｨ⌒'), (434, '〉')])
setr(17, lambda x: not 368 < x < 445, [(372, "(_,ゞ､___,ﾉ")])
HAIR = os.environ.get('HAIR', 'H0')
if HAIR != 'H0':
    import numpy as np
    from PIL import Image
    from aa import adv
    m = np.array(Image.open('/private/tmp/claude-501/-Users-rikihernandez/5591bff3-64a4-4eda-ad29-a402158ce2b9/scratchpad/planes-art/mask-hair-0007.png')) > 127
    def spans(y):
        xs = np.where(m[min(y, m.shape[0] - 1)])[0]; out = []
        if len(xs):
            st = pv = xs[0]
            for x in xs[1:]:
                if x > pv + 3: out.append((st, pv)); st = x
                pv = x
            out.append((st, pv))
        return [(a, b) for a, b in out if b - a > 10]
    for r in range(3, 26):
        sp = spans(r * 17 + 9)
        if not sp: continue
        lo, hi = sp[0][0], sp[-1][1]
        keep = [(x, g) for x, g in R.get(r, []) if not (lo - 4 <= x <= hi + 2) or x > 280 and r >= 11]
        fill = []
        for a, b in sp:
            if r >= 11 and a > 280: continue
            if HAIR == 'H1':      # bounded colon field, line edges kept from the silhouette glyphs at both ends
                x = a + 9
                while x < b - 8: fill.append((x, '::')); x += adv('::') + adv(' ')
            else:                 # locks: direction by region, short groups with paper between, density from the mask width
                g = 'ﾉ' if r <= 4 else ('/' if r <= 15 else 'ﾉ')
                x = a + 9 + (r * 5) % 7; k = 0
                while x < b - 8:
                    n = 2 + (r + k) % 3; run = g * n
                    if x + adv(run) > b - 6: run = g; 
                    fill.append((x, run)); x += adv(run) + adv(' ') + 3; k += 1
        # silhouette edge glyphs from the existing drawing (first and last glyph on the row inside the span)
        edge = [(x, g[0]) for x, g in R.get(r, []) if lo - 4 <= x <= lo + 10] + [(x, g) for x, g in R.get(r, []) if hi - 14 <= x <= hi + 2 and len(g) <= 3]
        R[r] = keep + edge + fill
if __name__ == '__main__':
    out(R, '0007', sys.argv[1] if len(sys.argv) > 1 else 'c7', 37)
