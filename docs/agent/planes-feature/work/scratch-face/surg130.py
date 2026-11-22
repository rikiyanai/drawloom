"""Base + surgery: AAHub 実在人物パロディ俳優・女優02（外国の俳優・女優） aa[130] (foreign actors) reshaped onto Riki's 0007
three-quarter in the base's own frame (Riki mapped by the near eye, scale 0.71). Base glyph passages kept where they fit;
moved or re-spelt where Riki's planes/photo put the feature elsewhere."""
import sys
from parse_aa import parse
from aa import adv
from angle_tool import build
from surg import grid, under, warp
from aa import render
from angle_tool import photo
from PIL import Image
B = parse(open('../corpus/base-actWW130.txt').read())
def colons(a, b):
    """the base's own hair tone: an unbroken ':' run filling a..b"""
    n = max(0, int((b - a) // adv(':'))); return [(a, ':' * n)] if n else []
R = {}
def tone(a, b, k=0):
    """darker hair mass: alternating ':;' (the base's colon tone, one step denser)"""
    out, x = '', a
    while x + adv(':') <= b: out += ':' if (len(out) + k) % 2 else ';'; x += adv(':')
    return [(a, out)] if out else []
# hair: rounded crown, darker mass, soft inner edge, loose strands falling onto the far forehead
R[0] = [(150, ",.-‐''￣￣￣￣''‐-.,")]
R[1] = [(116, '／'), *tone(128, 244), (246, '｀ヽ､')]
R[2] = [(98, '／'), *tone(110, 150, 1), (150, '_,.-‐-.,_'), (198, 'ﾞヽ'), *tone(212, 256, 1), (258, 'ヽ')]
R[3] = [(84, '/'), *tone(94, 134), (134, 'ﾉ'), (232, 'ヽ'), (244, 'ヽ'), *tone(256, 264), (266, 'i')]
R[4] = [(70, '/'), *tone(80, 126, 1), (128, 'ﾘ'), (240, 'ヽ'), (258, 'ヽ'), (274, '!')]
R[5] = [(62, '/'), *tone(72, 124), (128, '!'), (248, "'"), (270, 'ﾚﾞ')]
R[6] = [(58, '|'), *tone(68, 122, 1), (126, 'ﾘ'), (180, 'ｨ=ﾆ三ﾆ=‐､'), (258, 'ｨﾆ=､')]
# eyes: near eye = clear lid with the iris hanging from it, looking right; far eye small, partly behind the bridge
R[7] = [(58, '|'), *tone(68, 120), (124, 'l'), (188, 'ｨ=弋ﾂ=ｧ､'), (254, 'ヽ'), (266, 'ｨz='), (290, 'l')]
R[8] = [(58, '|'), *tone(68, 112, 1), (120, 'ﾉ'), (198, "｀ー‐'"), (262, 'ヽ'), (276, "ﾞ'"), (289, '{')]
# nose: one long bridge (rows 6-8 above) to a pointed tip that breaks past the cheek; small wing and nostril
R[9] = [(60, '|'), *tone(68, 82), (84, ',ｨ⌒ヽ'), (252, ',ｨ'), (272, 'ヽ'), (286, '〉')]
R[10] = [(62, '|'), *tone(70, 78, 1), (80, '{'), (92, '('), (110, '}'), (248, "ゝ､__ﾉ"), (287, 'i')]
R[11] = [(64, '|'), *tone(72, 80), (82, 'ヽ'), (94, 'Y'), (108, '|'), (264, 'ー'), (284, ')')]
# mouth, chin; jaw: diagonal from under the ear to a narrow chin
R[12] = [(66, 'ヽ'), *tone(78, 92, 1), (94, 'ﾉ'), (120, '|'), (139, '｀、'), (238, "､_,.-‐=‐'"), (284, ')')]
R[13] = [(58, '(⌒'), *tone(80, 104), (106, 'ヽ'), (118, '|'), (160, 'ヽ､'), (258, 'ーー'), (282, ')')]
R[14] = [(56, '{'), *tone(66, 104, 1), (106, '}'), (122, '|'), (184, "｀ー-､__"), (240, '_,ノ')]
R[15] = [(62, "ゝ､__,ﾉ"), (128, '|'), (252, '|')]
# neck slanting back, crew collar and shoulders
R[16] = [(132, '|'), (250, '|')]
R[17] = [(134, 'ヽ'), (248, '|')]
R[18] = [(40, "_,.-‐''"), (118, '´'), (140, 'ヽ'), (246, '|'), (262, '｀ヽ､_')]
R[19] = [(0, ",.-‐''´"), (150, 'ヽ､'), (232, ',.ｨ'), (300, '｀ヽ､')]
R[20] = [(166, "｀'ー-‐''´")]
if __name__ == '__main__':
    name = sys.argv[1] if len(sys.argv) > 1 else 's1'
    t = build(R, 21); from aa import check; print(name, 'law', check(t) or 'ok')
    open(f'local/{name}.txt', 'w').write(t + '\n')
    W, H = 360, 360
    ph = warp(photo('0007', (517, 624))); aa_ = render(t, pad=0).crop((0, 0, 360, 320)).convert('RGB')
    s = Image.new('RGB', (730, 320), 'white'); s.paste(ph, (0, 0)); s.paste(aa_, (370, 0)); s.resize((1460, 640), Image.LANCZOS).save(f'local/{name}-pair.png')
    grid(render(t, underlay=under('ud'), pad=0).crop((0, 0, 360, 320))).save(f'local/{name}-ud.png')
