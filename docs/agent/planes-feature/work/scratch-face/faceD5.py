"""D5 = D's text; only the operator's callouts changed: eye placement, nose placement, face outline fitted to the
line drawing (jaw, chin, neck), chin-area dot clusters removed, mouth per the male-lip sketch (parting + top mark + under-lip line)."""
import os, sys
from aa import layout, check
import importlib.util
spec = importlib.util.spec_from_file_location('Dm', 'author0001-D.py'); Dm = importlib.util.module_from_spec(spec); spec.loader.exec_module(Dm)
R = {r: list(v) for r, v in Dm.R.items()}
def put(r, keep, new):
    R[r] = [(x, g) for x, g in R[r] if keep(x)] + new
EYES = os.environ.get('EYES', 'B1')
L_LID, L_EYE, R_LID, R_EYE = '.::;=＝=;､', "ｨ''弋ﾂ'ｧ", '.:;=＝=;;､', "ｨ''弋ﾂ'ｧ"
put(12, lambda x: not 220 < x < 390, [])
put(13, lambda x: not 220 < x < 390, [])
if EYES == 'B0':   # D rows, left eye moved 5 px onto the line-drawing eye
    R[12] += [(225, L_LID), (330, R_LID)]; R[13] += [(231, L_EYE), (338, R_EYE)]
elif EYES == 'B1': # right eye one row up onto its iris (it sits higher than the left in the photo)
    R[11] += [(330, R_LID)]; R[12] += [(225, L_LID), (338, R_EYE)]; R[13] += [(231, L_EYE)]
elif EYES == 'B2': # both eyes one row up
    R[11] += [(225, L_LID), (330, R_LID)]; R[12] += [(231, L_EYE), (338, R_EYE)]
R[11] = [(x, g) for x, g in R[11] if g != ',.-‐' or EYES != 'B2']
R[13] += [(288, 'i')]
put(14, lambda x: x != 300, [(287, 'i')])
put(16, lambda x: not 280 < x < 340, [(292, '"'), (327, '"')])
put(18, lambda x: not 260 < x < 400, [(305, 'ー')])
put(19, lambda x: not 260 < x < 400, [(268, "'￣￣￣￣￣'")])
put(20, lambda x: False, [(214, 'ヽ'), (297, 'ーー'), (399, '/')])
R[21] = [(222, 'ヽ'), (376, '／')]
R[22] = [(232, '｀ｰ-､_'), (350, "_,.-'´")]
R[23] = [(233, '|'), (284, "｀ｰ-､__,.-'´"), (391, '|')]
R[24] = [(232, '|'), (392, '|')]
def build(n=31):
    return '\n'.join(layout([i for i in R.get(r, []) if i[1]]) for r in range(n))
if __name__ == '__main__':
    t = build(); out = sys.argv[1] if len(sys.argv) > 1 else 'local/D5.txt'
    open(out, 'w').write(t + '\n'); print(EYES, 'law:', check(t) or 'ok')
