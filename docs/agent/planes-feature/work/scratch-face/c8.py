"""Version C8: fork B's image trace, fixed per the independent review (hair outline + quiet diagonal fill, separate ear and bun,
heavy jaw, lid-weighted eyes, straight nose bridge, dark parting) - every position read off the photo grid."""
import sys
from parse_aa import parse
from angle_tool import out
from aa import adv
R = parse(open('local/forkB-13.txt').read())
def setr(r, keep, new): R[r] = [(x, g) for x, g in R.get(r, []) if keep(x)] + new
# hair, rows 6-15: bold outer edge + inner edge kept, interior = quiet ':' field with 2 diagonal lock lines sweeping down-left
SPAN = {6: (187, 226), 7: (171, 236), 8: (158, 232), 9: (147, 227), 10: (140, 228), 11: (133, 229), 12: (131, 226), 13: (130, 225), 14: (129, 222), 15: (131, 220)}
for r, (a, b) in SPAN.items():
    keep = [(x, g) for x, g in R.get(r, []) if x > b + 4 or (r == 6 and x >= 224)]
    edge_l = [(a - 2, '/' if r <= 10 else '|')]
    edge_r = [(b, '|' if r >= 9 else '/')]
    fill, x, k = [], a + 9 + (r * 3) % 6, 0
    while x < b - 10:          # strand groups (3-4 slashes) with a paper gap, phase shifted per row so the groups run diagonally
        n = 3 + (r + k) % 2; run = '/' * n
        while x + adv(run) > b - 4 and len(run) > 1: run = run[:-1]
        fill.append((x, run)); x += adv(run) + adv(' ') + 2; k += 1
    R[r] = keep + edge_l + edge_r + fill
# hair behind the ear and the ear itself (rim, inner fold, lobe), rows 16-19
setr(16, lambda x: x > 300, [(128, '|'), (140, ':/:'), (178, ',ｨ⌒ヽ')])
setr(17, lambda x: x > 300, [(133, '|'), (144, ':/'), (172, '{'), (190, '('), (210, '|')])
setr(18, lambda x: x > 300, [(138, 'ヽ'), (150, ':'), (174, 'ヽ'), (190, 'ヽ'), (208, '|')])
setr(19, lambda x: x > 300, [(146, 'ヽ'), (182, 'ヽ､_ﾉ')])
# bun: a compact dark knot lower and behind the ear, tied at the nape
setr(20, lambda x: x > 300, [(146, ',ｨ⌒ヽ'), (176, ',ｨ⌒ヽ'), (214, '|')])
setr(21, lambda x: x > 300, [(134, '('), (146, '/// //'), (194, '}'), (216, 'ヽ')])
setr(22, lambda x: x > 300, [(138, 'ヽ'), (152, '/ //'), (186, 'ﾉ'), (226, 'ヽ')])
setr(23, lambda x: x > 300, [(152, "｀ー‐´"), (236, '＼')])
# jaw: one committed heavy line from under the lobe to the chin corner; chin front
setr(24, lambda x: x > 460, [(184, 'ゞ'), (262, '｀ヽ､＿＿＿＿＿＿,,.ノ')])
setr(22, lambda x: x < 300 or x > 440, [(400, ':;:'), (430, ')')])
setr(23, lambda x: x < 300, [(431, '}')])
# under the jaw and down the front of the neck: a shadow band
setr(25, lambda x: x < 290 or x > 372, [(x, ';' if (x // 8) % 2 else ':') for x in range(296, 368, 8)])
setr(26, lambda x: not 340 < x < 372, [(x, ':') for x in range(344, 368, 8)])
# eyes: socket shadow under the brow, heavy lid with the iris hanging from it, light lower lid; far eye heavier lid
setr(12, lambda x: not 300 < x < 430, [(306, ',.:;::;:.､'), (400, 'ヽ')])
setr(13, lambda x: not 290 < x < 445, [(302, 'ｨ=ﾆ弋ﾂ=ｧ､'), (410, 'ヽ'), (420, 'ｨ=ﾃｧ')])
setr(14, lambda x: not 300 < x < 445, [(320, "｀ｰ-‐'"), (422, 'ヽ')])
setr(15, lambda x: not 360 < x < 445, [(431, 'ヽ')])
# nose: tip breaks past the far cheek; wing + nostril
setr(16, lambda x: x < 300, [(380, ',ｨ⌒'), (437, '〉')])
setr(17, lambda x: x < 300, [(374, "(_,ゞ､___,ﾉ")])
# mouth: top mark, dark parting corner to corner, under-lip line
setr(19, lambda x: x < 300, [(412, 'ー'), (436, ')')])
setr(20, lambda x: x < 300, [(374, "､_,.-‐ﾆﾆ=‐'")])
setr(21, lambda x: x < 300, [(404, 'ーー'), (432, ')')])
if __name__ == '__main__':
    out(R, '0007', sys.argv[1] if len(sys.argv) > 1 else 'c8', 34)
