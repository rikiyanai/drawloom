import sys
from aa import adv
from angle_tool import out
import a0007, breaks
H = {r: list(v) for r, v in a0007.R.items()}
B = breaks.chains('0007', [['soLo', 'ckL', 'hoL'], ['nsL', 'nlL', 'mcL'], ['ml0', 'chL', 'cbL'], ['soLlo', 'soLli'], ['mcL', 'jaL']])
R = {}
for r in set(H) | set(B):
    items = list(H.get(r, [])); occ = [(x - 4, x + adv(g) + 4) for x, g in items]
    for x, g in sorted(B.get(r, [])):
        if not any(a < x + adv(g) and x < b for a, b in occ): items.append((x, g)); occ.append((x - 3, x + adv(g) + 3))
    R[r] = items
if __name__ == '__main__':
    out(R, '0007', sys.argv[1] if len(sys.argv) > 1 else 'tqp', 37)
