"""Option A: the planes drawn as the form - every visible plane edge as a light stroke, shadow planes (by their 3D normal) as dot fields,
over the hand hair/contour/feature layer."""
import sys, numpy as np, planes2aa as Q, breaks
from PIL import Image, ImageDraw
from aa import adv
from angle_tool import out, UD
import a0007
V, faces = Q.scene('0007'); W, H = Image.open(UD + 'ud-0007.png').size
hand = {r: list(v) for r, v in a0007.R.items()}
skip = lambda k: k.startswith(('ft', 'fe', 'ts', 'nk', 'sj', 'eL', 'eR'))
seen, B = set(), {}
for ks, c, n in faces:
    for a, b in zip(ks, ks[1:] + ks[:1]):
        e = tuple(sorted((a, b)))
        if e in seen or skip(a) or skip(b) or not (V[a][2] and V[b][2]): continue
        seen.add(e)
        for r, x, g in breaks.light_segment(V[a][:2], V[b][:2]): B.setdefault(r, []).append((x, g))
vm = Image.new('L', (W, H), 0); d = ImageDraw.Draw(vm)
for ks, c, n in sorted(faces, key=lambda f: f[1]): d.polygon([V[k][:2] for k in ks], fill=c)
vm = np.array(vm)
for r in range(H // 17):
    y = r * 17 + 9
    for x in range(0, W, 12):
        c = vm[y, x]
        if c >= 2 and (x // 12 + r) % (2 if c == 2 else 1) == 0: B.setdefault(r, []).append((x, ':' if c == 2 else ';'))
R = {}
for r in set(hand) | set(B):
    items = list(hand.get(r, [])); occ = [(x - 4, x + adv(g) + 4) for x, g in items]
    for x, g in sorted(B.get(r, [])):
        if not any(a < x + adv(g) and x < b for a, b in occ): items.append((x, g)); occ.append((x - 2, x + adv(g) + 2))
    R[r] = items
if __name__ == '__main__':
    out(R, '0007', sys.argv[1] if len(sys.argv) > 1 else 'tqA', 37)
