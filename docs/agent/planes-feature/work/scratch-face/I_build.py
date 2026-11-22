"""Fork I: base + surgery on AAHub 実在人物パロディ芸術家・学者 aa[340] (key 73497010c044991ebe9483dd655e4c89),
reshaped onto Riki's 0007 photo mapped into the base frame (I_fit: near eye / crown / chin, scale 0.76).
Base passages are reused whole (moved where his features sit elsewhere); only what differs is re-spelt."""
import sys
from parse_aa import parse
from angle_tool import build
from aa import adv, check, render
B = parse(open('../corpus/base-art340.txt').read())
def b(r, i, dx=0):                         # base run i of row r, moved by dx
    x, g = B[r][i]; return (x + dx, g)
R = {}
# --- hair: base crown locks (r0-r4) trimmed to his crown; far-side front strands moved left onto his hairline
R[0] = []
R[1] = [(176, "_.ィ≦三ミヾくヽ'ﾐﾄ､"), (294, '､')]
R[2] = [b(2, 0), b(2, 1), (290, 'ヽ､')]
R[3] = [b(3, 0), b(3, 1)]
R[4] = [b(4, 0, 8), b(4, 1, -6)]
R[5] = [b(5, 0, 10), (296, "｀ﾞ'くﾉ{")]
R[6] = [b(6, 0, 12), (322, 'V}')]
R[7] = [b(7, 0, 14), b(8, 1, -8), (302, 'ｨ≦ﾆ､')]          # near brow from base r8 moved up; far brow from base r10 moved up
R[8] = [b(8, 0, 16), (244, '＿'), (264, "｀ヾﾐk､"), (330, '{')]   # near upper lid (base r9)
R[9] = [(90, 'ｊ{ﾆ{{´'), (126, 'ﾆ彡'), (238, 'ィ‐-(ソ｀ヾく'), (308, 'ｨ｡ﾃ'), (334, '/')]        # base eye passage (base r10), far eye small behind the bridge
R[10] = [(90, '{==}'), (114, 'ﾆ=ミ'), (235, 'ヾ'), (250, "｀¨¨´ﾉ"), (300, '.:ｌ'), (320, 'ヽ')]   # lower lid (base r11), bridge shadow
# --- ear: base ear passage (base r9-r11) moved down two rows onto his ear; hair behind it continues to the bun
R[11] = [(92, 'ﾏ='), (114, 'ｒｲ⌒ヽ'), (290, '.:::'), (322, 'ヽ')]
R[12] = [(92, '{=}'), (112, '|'), (122, '7ﾉ'), (146, '}'), (282, 'ﾉ::/'), (326, '〉')]
R[13] = [(96, '{,'), (112, '乂|('), (146, '|'), (282, '(::{'), (306, "ゞ､_ﾉ")]
# --- bun (base lock grammar, gathered) and ear lobe; mouth on the male-lip construction
R[14] = [(70, ',ｚ≦/∧{'), (126, '｀ｰｧ'), (292, 'ー')]
R[15] = [(70, '{//∧V}'), (150, 'ヽ'), (262, "､_,.-‐ﾆ=‐'")]
R[16] = [(76, 'ゞ==ﾉ'), (168, '＼､'), (284, 'ーー'), (311, '/')]
# --- jaw: one run from under the lobe to the chin; chin front from base r15-16
R[17] = [(112, 'ヽ'), (188, "｀ー-‐-､"), (306, '/')]
R[18] = [(118, 'ヽ'), (176, '. . : : :'), (232, "｀ー-､___ノ")]
# --- long slim neck, crew collar, cord
R[19] = [(124, 'ヽ'), (286, '|')]
R[20] = [(40, "_,.-‐''"), (128, 'ヽ､'), (284, '|'), (300, '｀ヽ､_')]
R[21] = [(0, ",.-‐''´"), (150, "｀ヽ､"), (258, '_,ｨ'), (350, "｀ヽ､")]
R[22] = [(184, "｀'ー-‐''´")]
if __name__ == '__main__':
    name = sys.argv[1] if len(sys.argv) > 1 else 'I-1'
    t = build(R, 23); print(name, 'law', check(t) or 'ok'); open(f'local/{name}.txt', 'w').write(t + '\n')
    import surgI as S, I_fit
    from PIL import Image
    ed = Image.open('local/fb-edges.png').convert('RGB'); ph = Image.open('local/fb-photo.png').convert('RGB')
    und = Image.blend(S.warp(ed), Image.new('RGB', (S.W, S.H), 'white'), 0.35)
    S.grid(render(t, underlay=und, pad=0).crop((0, 0, S.W, S.H))).save(f'local/{name}-over.png')
    aa_ = render(t, pad=0).crop((0, 0, S.W, S.H)).convert('RGB'); p = S.warp(ph)
    s = Image.new('RGB', (S.W * 2 + 10, S.H), 'white'); s.paste(p, (0, 0)); s.paste(aa_, (S.W + 10, 0)); s.save(f'local/{name}-pair.png')
