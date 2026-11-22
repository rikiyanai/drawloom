"""Fork P: base + surgery on AAHub 実在人物パロディ芸術家・学者 aa[340] (key 73497010c044991ebe9483dd655e4c89), reshaped onto
Riki's 0007 planes mapped into the base frame at Medium scale (S=1.0, near eye -> (230,198)).
Base passages are moved whole (dx px, dy rows) or trimmed from the middle so their head and end glyphs survive."""
import os, sys
os.environ.setdefault('S', '1.0'); os.environ.setdefault('EY', '198'); os.environ.setdefault('EX', '230')
from parse_aa import parse
from aa import adv, check
from angle_tool import build
B = parse(open('../corpus/base-art340.txt').read())
R = {}
def put(r, x, g):
    if g: R.setdefault(r, []).append((x, g))
def base(r, i):
    return B[r][i]
def mv(r, i, dx, dy, right=None, keep_end=2, keep_head=3):
    """move base run (r,i) by dx px and dy rows; if right is given, trim middle glyphs until it ends at or before right"""
    x, g = B[r][i]; x += dx
    while right is not None and x + adv(g) > right and len(g) > keep_head + keep_end + 1:
        g = g[:keep_head] + g[keep_head + 1:]
    put(r + dy, x, g)
V = int(os.environ.get('VAR', '1'))
# ---- hair cap: base rows 1-3 down one row, left 60 (crown and hairline arc)
put(2, 119, "_.ィ≦三ミヾくヽ'ﾐﾄ､")
mv(2, 0, -60, 1, right=212)
for i in (1, 2, 3, 5): mv(2, i, -66, 1)
put(3, 238, 'ﾐ|ﾘ')
mv(3, 0, -62, 1)
mv(3, 1, -64, 1); mv(3, 2, -64, 1)
# far-side hair (front hairline over the far temple)
mv(4, 1, -66, 1); mv(4, 2, -76, 1)
mv(5, 1, -62, 1)
mv(6, 1, -60, 1); mv(7, 1, -64, 1)
# ---- swept lock runs (base rows 4-8), down one row, left 60, trimmed to Riki's hairline (lock-end glyphs kept)
RIGHT = {5: 150, 6: 140, 7: 128, 8: 124, 9: 122}
for r in (4, 5, 6, 7, 8):
    x, g = B[r][0]
    mv(r, 0, -60, 1, right=RIGHT[r + 1])
# back of the head below the locks: base ear-side lock ends (row 9 first run) + the base hair-fall grammar, behind the ear
mv(9, 0, -52, 1)
put(11, 12, "/∨//∧､"); put(11, 62, "ﾐ≦三彡"); put(12, 12, "'/∨//∧V"); put(12, 66, "≦二彡"); put(13, 14, "'//∨/∧∨")
# ---- ear: base ear block (rows 9-12, the 'rイ「}' / '7ﾉ ヾ{' / '乂|(' construction) moved down 4 rows onto Riki's ear
put(13, 74, ',ｨ⌒ヽ'); put(14, 68, '{'); put(14, 84, '(ﾊ'); put(14, 112, '}')
put(15, 72, 'ヽ'); put(15, 88, 'ヽｿ'); put(15, 112, '|'); put(16, 84, "ゝ､_ﾉ")
put(14, 18, "'//∨∧"); put(15, 20, "/∨/∧V"); put(16, 26, "'/∨∧"); put(17, 32, "∨/∧"); put(18, 44, "∨∧")
# ---- bun: base hair-fall bundles shortened into a knot behind the ear at the nape, closed with the base's '>イ{'
put(19, 18, ",ｨ≦⌒⌒ヽ")
put(20, 8, "{"); put(20, 20, "//∧ﾐ彡"); put(20, 86, "}")
put(21, 4, "{"); put(21, 16, "'/∨//∧"); put(21, 88, "}")
put(22, 16, "ゞ==‐-‐ﾉ")
put(23, 22, "/ﾉ")
# ---- near eye: base lid/iris construction, down one row, left 18
put(9, 184, 'ｨ=ﾆ三三ﾆ=‐-､'); put(9, 294, 'ｨﾆ=､')
EYE = os.environ.get('EYE', 'E')
NE = {  # near eye at Riki's size: lash/crease row 10, lid + iris row 11, lower lid row 12 (base spellings compacted)
 'A': [(10, 200, ',.ｨ=ﾆ=､'), (11, 194, 'j!爪(ソヾ´'), (12, 206, 'ヾ¨¨´')],
 'B': [(10, 202, '_,.-‐-､'), (11, 196, 'ｨ=爪(ソ=ｧ'), (12, 208, '｀¨¨´')],
 'C': [(10, 198, ',ｨ=ﾆﾐk､'), (11, 200, 'j!爪(ソ´'), (12, 208, 'ヾ¨¨´')],
 'E': [(10, 196, '＿＿｀ヾﾐk､'), (11, 196, 'j!爪(ソ｀ヾ´'), (12, 200, 'ヾ ｀¨¨´ﾉ')],
 'D': [(10, 204, '＿'), (10, 222, '｀ヾﾐk､'), (11, 196, 'j!爪(ソ｀ヾ´'), (12, 210, '｀¨¨´ﾉ')],
}
for r, x, g in NE[EYE]: put(r, x, g)
# ---- far eye: base 'r≦二｢}' / '{ｨ｡ﾃく/' moved left onto Riki's far eye
FE = os.environ.get('FE', '1')
if FE == '0': mv(10, 6, -22, 0); mv(11, 5, -22, 0)
elif FE == '1': put(10, 296, 'r≦｢}'); put(11, 296, "{ﾃく/")       # base far-eye spelling, narrowed (foreshortened)
elif FE == '2': put(10, 296, 'r=ﾆ}'); put(11, 300, "ﾃ'く/")
# ---- nose: bridge down the plane from nasion to tip, tip breaks past the far cheek; wing + nostril
put(12, 290, '＼'); put(13, 254, '!'); put(13, 306, '＼'); put(14, 258, "'"); put(14, 322, '〉')
put(15, 260, ",ｨ⌒ゝ､__ﾉ")
# far cheek behind the nose (base contour, moved left)

# ---- mouth: male lips (top mark, parting, under-lip line), behind the nose tip
put(16, 316, 'l'); put(17, 300, 'ー')
put(18, 262, "､_,.-‐ﾆ=‐'")
put(19, 290, 'ーー')
# ---- chin and jaw (jaw from under the ear to the chin), base tone grammar for the under-jaw shadow
CUE = os.environ.get('CUE', '2')
if CUE == '1': put(17, 164, "'"); put(18, 168, '!')
elif CUE == '2': put(18, 162, 'ヽ')
put(17, 102, 'l'); put(18, 104, 'ヽ'); put(19, 112, '＼'); put(20, 128, '＼'); put(20, 314, ')')
put(21, 144, '＼'); put(21, 306, 'ﾉ')
put(22, 160, "｀ｰ-､_____________,,..-‐''´")
put(23, 168, '::::::::::::::::'); put(23, 282, '|')
put(24, 160, 'ヽ'); put(24, 178, '::::::::'); put(24, 276, '|')
# ---- neck (back line slants down from the bun, front line from under the chin), crew collar, shoulders
put(24, 96, 'ヽ'); put(25, 104, 'ヽ'); put(26, 112, 'ヽ'); put(27, 120, 'ヽ'); put(28, 126, 'ヽ'); put(29, 134, 'ヽ'); put(30, 140, 'ヽ')
put(29, 282, 'i'); put(30, 286, 'i')
put(25, 154, 'ヽ'); put(25, 270, 'l'); put(26, 150, '|'); put(26, 266, '|'); put(27, 150, '|'); put(27, 262, '|')
put(28, 30, "_,.-‐''´"); put(28, 150, 'ヽ､'); put(28, 262, ',ノ'); put(28, 280, "｀''‐-.,_")
put(29, 0, ",.-'´"); put(29, 168, "｀ヽ､__,.-‐'´"); put(29, 352, "｀''‐.,")
if __name__ == '__main__':
    name = sys.argv[1] if len(sys.argv) > 1 else 'P-1'
    t = build(R, 32); print(name, 'law', check(t) or 'ok'); open(f'local/{name}.txt', 'w').write(t + '\n')
    import surgP
    from aa import render
    surgP.grid(render(t, underlay=surgP.under('ud'), pad=0).crop((0, 0, surgP.W, surgP.H))).save(f'local/{name}-ud.png')
    surgP.pair(t).save(f'local/{name}-pair.png')
