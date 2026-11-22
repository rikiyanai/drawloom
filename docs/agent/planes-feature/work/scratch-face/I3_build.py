"""Fork I, round 3: heavier nose silhouette with sharp tip and tucked nostril, continuous jaw-to-chin, slanted neck lines, cords omitted."""
import os, sys
os.environ.setdefault('EYE', 'E1')
import I2_build
from angle_tool import build
from aa import check, render
R = {r: list(v) for r, v in I2_build.R.items()}
def setr(r, keep, new): R[r] = [(x, g) for x, g in R.get(r, []) if keep(x)] + new
NOSE = os.environ.get('NOSE', 'N1')
# near eye without the trailing tick so the bridge has room; far eye just beyond the bridge
setr(9, lambda x: x < 220, [(232, 'ｨ=ﾆ二(ソﾆｧ')])
N = {
 'N1': {8: [(296, 'ヽ')], 9: [(308, 'ヽ'), (322, "ﾃ'")], 10: [(308, '＼')], 11: [(314, '＼')], 12: [(320, '＼')], 13: [(290, 'ゞ､__ノ')]},
 'N2': {8: [(296, 'ヽ')], 9: [(308, 'ヽ'), (322, "ﾃ'")], 10: [(306, 'ヽヽ')], 11: [(312, 'ヽヽ')], 12: [(318, 'ヽヽ')], 13: [(290, 'ゞ､__ノ')]},
 'N3': {8: [(296, 'ヽ')], 9: [(308, 'ヽ'), (322, "ﾃ'")], 10: [(310, '＼')], 11: [(316, '＼')], 12: [(322, '＼')], 13: [(292, "ゞ､_,ﾉ")]},
}[NOSE]
for r, new in N.items(): setr(r, lambda x: (x < 280 and not (r == 8 and x > 270)) or (r == 8 and x >= 326), new)
# lips: parting behind the tip, short under-lip mark; chin: one turn from the jaw underside into the chin front
setr(16, lambda x: x < 270, [(288, 'ー'), (310, 'l')])
setr(17, lambda x: x < 160, [(168, "｀ヽ､"), (306, '}')])
setr(18, lambda x: x < 110, [(118, '＼'), (196, "｀ー-､_____ノ")])
# neck: back line slants down from the bun, front line starts under the chin turn
setr(17, lambda x: x >= 160, [(110, '＼')])
R[19] = [(126, '＼'), (282, '|')]
R[20] = [(134, '＼'), (284, '|')]
R[21] = [(40, "_,.-‐''"), (142, 'ヽ､'), (286, '|'), (302, '｀ヽ､_')]
R[22] = [(0, ",.-‐''´"), (160, "｀ヽ､"), (258, '_,ｨ'), (350, "｀ヽ､")]
R[23] = [(190, "｀'ー-‐''´")]
R[24] = []
if __name__ == '__main__':
    name = sys.argv[1] if len(sys.argv) > 1 else 'I-12'
    t = build(R, 24); print(name, 'law', check(t) or 'ok'); open(f'local/{name}.txt', 'w').write(t + '\n')
    import surgI as S, I_fit
    from PIL import Image
    ph = Image.open('local/fb-photo.png').convert('RGB')
    aa_ = render(t, pad=0).crop((0, 0, S.W, S.H)).convert('RGB'); p = S.warp(ph)
    s = Image.new('RGB', (S.W * 2 + 10, S.H), 'white'); s.paste(p, (0, 0)); s.paste(aa_, (S.W + 10, 0)); s.save(f'local/{name}-pair.png')
    s.resize((s.width * 2, s.height * 2), Image.LANCZOS).save(f'local/{name}-pair2x.png')
