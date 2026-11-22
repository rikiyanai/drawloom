"""Front Medium R: D's frame (cap, outline, neck, collar) kept; face features re-traced from the Drawloom line drawing.
Env overrides let one row be swapped while judging."""
import os, sys
from aa import layout, check
import importlib.util
spec = importlib.util.spec_from_file_location('Dm', 'author0001-D.py'); Dm = importlib.util.module_from_spec(spec); spec.loader.exec_module(Dm)
R = {r: list(v) for r, v in Dm.R.items()}
IRIS = os.environ.get('IRIS', 'ﾃ')
R.update({
 10: [(156, '|'), (168, '/|'), (184, 'i'), (212, '_,.-ｰ==ｰ‐-､'), (330, ',.-‐ｰ==ｰ-､_'), (396, 'ヽヽヽヽ'), (446, 'l')],
 11: [(158, '!'), (168, '/|'), (186, '!'), (240, os.environ.get('CR', '.-‐‐-.')), (352, os.environ.get('CR', '.-‐‐-.')), (408, 'ヽヽ'), (448, '|')],
 12: [(160, 'l'), (168, '/|'), (190, 'i'), (220, os.environ.get('LID', '_,.ｨ=ﾆ=ｰ‐-､_')), (330, os.environ.get('LID', '_,.ｨ=ﾆ=ｰ‐-､_')), (406, 'i'), (418, 'ﾘﾘ'), (452, 'l')],
 13: [(160, '|'), (168, '/|'), (190, '!'), (228, 'ヽ､'), (250, IRIS), (270, '_ﾉ'), (286, 'i'), (340, 'ヽ､'), (360, IRIS), (380, '_ﾉ'), (408, '!'), (420, 'ﾘﾘ'), (454, '|')],
 14: [(164, 'l'), (172, '|'), (180, '〈'), (192, 'Yi'), (285, '|'), (412, 'i'), (420, '》'), (440, 'ﾘ'), (456, 'l')],
 15: [(168, 'ﾘ'), (180, '〈'), (194, '!'), (278, '('), (344, ')'), (414, '!'), (422, '〉'), (444, 'ﾘ'), (452, '}')],
 16: [(176, 'ゞ'), (196, 'i'), (280, 'ヽ'), (292, 'ｰ'), (320, 'ｰ'), (338, 'ﾉ'), (414, 'i'), (424, 'ﾉ'), (444, 'ﾘﾉ')],
 17: [(184, '｀'), (198, '!'), (303, "'"), (320, "'"), (414, '!')],
 18: [(204, 'ヽ'), (264, ",.-‐'´￣￣｀'‐-.,"), (410, 'i')],
 19: [(210, 'ヽ'), (268, '｀￣￣￣￣￣´'), (404, '/')],
 20: [(218, '＼'), (296, '‐ー‐'), (396, '/')],
})
def build(n=31):
    return '\n'.join(layout([i for i in R.get(r, []) if i[1]]) for r in range(n))
if __name__ == '__main__':
    t = build(); out = sys.argv[1] if len(sys.argv) > 1 else 'local/R.txt'
    open(out, 'w').write(t + '\n'); print('law:', check(t) or 'ok')
