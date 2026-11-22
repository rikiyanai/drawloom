"""Front Medium on Studio's true 17 px rows: D6's accepted outline and hair re-seated from its 18 px authoring rows
(row r -> round(r*18/17), two gap rows interpolated), then eyes and mouth rebuilt on the reviewed front planes:
male-lip construction (split parting, short top mark, under-lip line) from the operator's preferred version."""
import os, sys
import faceD6 as D
from angle_tool import out
R = {}
for r, runs in D.R.items():
    R[round(r * 18 / 17)] = list(runs)
# gap rows (no 18 px row lands here): continue the hair sides and the shoulder/neck strokes
R[9] = [(158, '|'), (169, '/|'), (188, '!'), (354, '＼'), (369, 'ヽヽヽヽ'), (434, 'ヽ')]
R[27] = [(152, '_,..-‐'), (196, "''´"), (228, '|'), (393, '|'), (425, "｀''‐-..,_")]
EYES = os.environ.get('EYES', 'V5')
def eyes(v):
    for r in (12, 13, 14):
        R[r] = [(x, g) for x, g in R.get(r, []) if not 215 < x < 395]
    if v == 'V1':   # D's own words, re-seated
        R[12] += [(225, '.::;=＝=;､'), (330, '.:;=＝=;;､')]; R[13] += [(231, "ｨ''弋ﾂ'ｧ"), (338, "ｨ''弋ﾂ'ｧ")]
    elif v == 'V2':  # light crease, heavy lid with the iris hanging from it, light lower lid
        R[12] += [(236, ',.-‐‐-､'), (342, ',.-‐‐-､')]; R[13] += [(226, 'ｨ=ﾆ弋ﾂﾆｧ'), (334, 'ｨ=ﾆ弋ﾂﾆｧ')]; R[14] += [(236, '｀ー-‐´'), (344, '｀ー-‐´')]
    elif v == 'V3':  # lash shadow over a word eye, light lower lid
        R[12] += [(225, '.::;=＝=;､'), (330, '.:;=＝=;;､')]; R[13] += [(228, "ｨ' 弋ﾂ 'ｧ"), (336, "ｨ' 弋ﾂ 'ｧ")]; R[14] += [(238, '｀ー‐´'), (346, '｀ー‐´')]
    elif v == 'V5':  # lid + iris word, light lower lid, no crease (the crease closed the eye into goggles)
        R[13] += [(226, 'ｨ=弋ﾂ=ｧ'), (332, 'ｨ=弋ﾂ=ｧ')]; R[14] += [(236, '｀ー‐´'), (342, '｀ー‐´')]
    elif v == 'V4':  # crease + lid on one word, iris as the dark centre
        R[12] += [(232, '_,.-‐-､_'), (338, '_,.-‐-､_')]; R[13] += [(226, "ｨ'´f,ﾜ`ヽ"), (334, "ｨ'´f,ﾜ`ヽ")]; R[14] += [(238, '｀ｰ-‐´'), (346, '｀ｰ-‐´')]
eyes(EYES)
# mouth: rows 19-22 rebuilt on the planes (top mark at the upper-lip centre, split parting corner to corner, under-lip line)
for r in (19, 20, 21, 22):
    R[r] = [(x, g) for x, g in R.get(r, []) if not 255 < x < 370]
R[19] += [(302, 'ー')]
R[20] += [(268, '-￣￣‐￣￣-')]
R[22] += [(296, '-‐ー')]
if __name__ == '__main__':
    out(R, '0001', sys.argv[1] if len(sys.argv) > 1 else f'front17-{EYES}', 33)
