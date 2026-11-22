"""Fork I, round 2: I_build (base + surgery on art[340]) with the coordinator's fixes: confident nose bridge, calm almond eye,
straight heavy brow, steeper jaw, single back-of-neck line, longer neck + cords, 3-row ear, flatter crown."""
import os, sys
import I_build
from angle_tool import build
from aa import check, render
R = {r: list(v) for r, v in I_build.R.items()}
def setr(r, keep, new): R[r] = [(x, g) for x, g in R.get(r, []) if keep(x)] + new
# crown one row flatter: drop the top cap row, the cap joins the first lock row
R[1] = []
R[2] = [(150, ",.ィ≦三ミヾくヽ'ﾐﾄ､､"), (284, 'ヽ､')]
# brow: his heavy near-straight bar
setr(7, lambda x: x < 210, [(214, 'ｨ=ﾆ三ﾆ=‐-､'), (310, '≦ﾆ､')])
# near eye: level heavy lid with the iris hanging from it toward the right, short light lower lid
EYE = os.environ.get('EYE', 'E1')
E = {'E1': {8: [], 9: [(232, 'ｨ=ﾆ二(ソﾆｧ､')], 10: [(250, "｀ー‐'")]},
     'E2': {8: [(240, '＿＿＿＿')], 9: [(232, "ｲ'  (ソ ｀ヽ")], 10: [(250, "｀ー‐'")]},
     'E3': {8: [(238, '_,.-‐-､_')], 9: [(230, 'ｨ=ﾆ二ｨ(ｿﾆ=､')], 10: [(252, "｀ｰ-‐'")]}}[EYE]
for r, new in E.items(): setr(r, lambda x: x < 210 or x > 300, new)
# nose: one bridge line from the brow down to the tip, clean turn, small nostril; far eye small behind the bridge
setr(8, lambda x: x < 300 and not (236 <= x <= 300 and E[8] == []) or x >= 330, [(298, 'ヽ')])
setr(9, lambda x: x < 300, [(304, 'ヽ'), (316, 'ｨﾃ'), (334, '/')])
setr(10, lambda x: x < 300, [(310, 'ヽ')])
setr(11, lambda x: x < 160, [(316, 'ヽ')])
setr(12, lambda x: x < 160, [(322, 'ヽ')])
setr(13, lambda x: x < 160, [(288, '(_'), (302, 'っ'), (316, '_,ﾉ')])
# ear: rim, inner fold, lobe
setr(11, lambda x: x < 108 or x > 160, [(112, ',ｨ⌒ヽ')])
setr(12, lambda x: x < 108 or x > 160, [(110, '{'), (126, 'ﾉ'), (146, '}')])
setr(13, lambda x: x < 108 or x > 160, [(114, 'ゝ､_,ﾉ')])
setr(14, lambda x: not 120 <= x <= 150, [])
# jaw: angle under the lobe at the mouth row, steep, then a short underside to a narrow chin
setr(15, lambda x: not 140 <= x <= 160, [(150, '|')])
setr(16, lambda x: not 160 <= x <= 200, [(156, 'ヽ')])
setr(17, lambda x: not 100 <= x <= 300, [(114, '|'), (168, "｀ヽ､"), (306, '/')])
setr(18, lambda x: False, [(116, '|'), (200, "｀ー-､___ノ")])
# neck: one back line, longer front, collar lower, cords
R[19] = [(119, '|'), (285, '|')]
R[20] = [(122, '|'), (286, '|')]
R[21] = [(40, "_,.-‐''"), (124, 'ヽ'), (287, '|'), (302, '｀ヽ､_')]
R[22] = [(0, ",.-‐''´"), (140, "｀ヽ､"), (258, '_,ｨ'), (350, "｀ヽ､")]
R[23] = [(160, 'ヽ'), (184, "｀'ー-‐''´"), (264, '|')]
R[24] = [(168, 'ヽ'), (266, '|')]
if __name__ == '__main__':
    name = sys.argv[1] if len(sys.argv) > 1 else 'I-9'
    t = build(R, 25); print(name, 'law', check(t) or 'ok'); open(f'local/{name}.txt', 'w').write(t + '\n')
    import surgI as S, I_fit
    from PIL import Image
    ed = Image.open('local/fb-edges.png').convert('RGB'); ph = Image.open('local/fb-photo.png').convert('RGB')
    und = Image.blend(S.warp(ed), Image.new('RGB', (S.W, S.H + 20), 'white').crop((0, 0, S.W, S.H)), 0.35)
    S.grid(render(t, underlay=und, pad=0).crop((0, 0, S.W, S.H))).save(f'local/{name}-over.png')
    aa_ = render(t, pad=0).crop((0, 0, S.W, S.H)).convert('RGB'); p = S.warp(ph)
    s = Image.new('RGB', (S.W * 2 + 10, S.H), 'white'); s.paste(p, (0, 0)); s.paste(aa_, (S.W + 10, 0)); s.save(f'local/{name}-pair.png')
    s.resize((s.width * 2, s.height * 2), Image.LANCZOS).save(f'local/{name}-pair2x.png')
