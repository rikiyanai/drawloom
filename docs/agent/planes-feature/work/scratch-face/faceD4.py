"""D3 = D2 plus the parts called out on D (JAW, FACE, MOUTH): one face edge (hair carries it where it overlaps),
straight drop from the ear, ﾉ turn into a jaw diagonal whose shift grows, narrow rounded chin, neck behind the jaw,
shadow plane under the jaw on the dark side."""
import sys
from aa import layout, check
import importlib.util
spec = importlib.util.spec_from_file_location('D2', 'faceD2.py'); D2 = importlib.util.module_from_spec(spec); spec.loader.exec_module(D2)
R = {r: list(v) for r, v in D2.R.items()}
def sub(r, old, new):
    R[r] = [new if (x, g) == old else (x, g) for x, g in R[r]]
    assert new in R[r], (r, old)
sub(9, (186, '!'), (186, 'ﾘ')); sub(10, (184, 'i'), (184, 'ｲ')); sub(11, (186, '!'), (186, 'ﾘ'))
sub(12, (190, 'i'), (190, 'ﾄ')); sub(12, (406, 'i'), (406, 'ﾘ'))
sub(13, (190, '!'), (190, 'ﾘ')); sub(13, (408, '!'), (408, 'ﾘ'))
sub(14, (412, 'i'), (410, '|'))
sub(15, (194, '!'), (198, '|')); sub(15, (414, '!'), (410, '|'))
sub(16, (196, 'i'), (199, '|')); sub(16, (414, 'i'), (411, '|'))
sub(17, (198, '!'), (200, '|')); sub(17, (414, '!'), (411, '|'))
sub(18, (204, 'ヽ'), (203, 'ヽ')); sub(18, (410, 'i'), (410, '|'))
sub(19, (210, 'ヽ'), (209, 'ヽ')); sub(19, (404, '/'), (398, 'ﾉ'))
R[14] = [(164, 'l'), (172, '|'), (186, 'ﾉ'), (300, 'i'), (410, '|'), (420, '》'), (440, 'ﾘ'), (456, 'l')]
R[15] = [(168, 'ﾘ'), (180, '〈'), (192, 'Yi'), (290, ":.':':'.:"), (410, '|'), (422, '〉'), (444, 'ﾘ'), (452, '}')]
R[16] = [(180, '〈'), (199, '|'), (290, '"'), (322, '"'), (411, '|'), (424, 'ﾉ'), (444, 'ﾘﾉ')]
R[17] = [(186, 'ゞ'), (200, '|'), (411, '|'), (446, 'ﾘ'), (456, 'ﾉ')]
R[18] = [(196, '｀'), (204, 'ヽ'), (266, "_,.-‐''¨￣¨''‐-.,_"), (410, '|'), (448, "'")]
for r, g in [(9, '//'), (10, '/ﾉ'), (11, '//'), (12, '/ﾉ'), (13, '//')]:
    sub(r, (168, '/|'), (168, g))
R[20] = [(216, 'ヽ'), (298, '｀ーー´'), (390, '/')]
R[21] = [(224, 'ヽ'), (372, '／')]
R[22] = [(232, '｀ヽ､__'), (332, "_,.-'´"), (396, '|')]
R[23] = [(232, '|'), (276, '｀ーーー´'), (346, '.:;:'), (396, '|')]
R[24] = [(232, '|'), (290, "':;:'"), (352, ':;:'), (398, '|')]
R[18] = [(x, g) for x, g in R[18] if x < 260 or x > 400] + [(305, 'ー')]
R[19] = [(x, g) for x, g in R[19] if x < 260 or x > 380] + [(268, "'￣￣￣￣￣'")]
R[20] = [(x, g) for x, g in R[20] if x < 260 or x > 380] + [(297, 'ーー')]
def build(n=31):
    return '\n'.join(layout([i for i in R.get(r, []) if i[1]]) for r in range(n))
if __name__ == '__main__':
    t = build(); open('local/D4.txt', 'w').write(t + '\n'); print('law:', check(t) or 'ok')
