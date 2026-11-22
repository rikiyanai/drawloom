"""Three-quarter from the planes: hand contour/hair layer + plane value patterns + form-turn strokes + feature strokes from the plane edges."""
import sys, planes2aa as Q
from aa import adv
from angle_tool import out
import importlib, a0007
H = {r: list(v) for r, v in a0007.R.items()}
# drop the symbol words: eyes, nose base, mouth parting come from the plane edges now
WORDS = {",ｨ'ﾞﾆf,ﾜ'ｧ､", "{ ｨ''ﾃ'ｧ", "｀ー-'", "(_,､_ﾉ`ー'", "-‐ー‐-､_", "ー"}
for r in H: H[r] = [(x, g) for x, g in H[r] if g not in WORDS]
P, _, _ = Q.build('0007', skip=lambda k: k.startswith(('ft', 'fe', 'ts', 'tl', 'za', 'ea', 'ja', 'nk', 'sj')), turns=False, feats=True,
                  pattern={1: ('.', 22), 2: (':', 13), 3: (';', 9)})
R = {}
for r in set(H) | set(P):
    hand = H.get(r, []); occ = [(x - 3, x + adv(g) + 3) for x, g in hand]
    R[r] = hand + [(x, g) for x, g in P.get(r, []) if not any(a < x + adv(g) and x < b for a, b in occ)]
if __name__ == '__main__':
    out(R, '0007', sys.argv[1] if len(sys.argv) > 1 else 'pl-m', 37)
