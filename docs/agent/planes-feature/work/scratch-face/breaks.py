"""Selected plane breaks from the user's planes, spelled as light interior strokes (form turns, not a wireframe)."""
import math, planes2aa as Q
from aa import adv
P = 17
def light_segment(p0, p1):
    (x0, y0), (x1, y1) = p0, p1
    if y1 < y0: (x0, y0), (x1, y1) = (x1, y1), (x0, y0)
    dx, dy = x1 - x0, y1 - y0; out = []
    for r in range(int(y0 // P), int(y1 // P) + 1):
        ya, yb = max(y0, r * P), min(y1, (r + 1) * P)
        if yb < ya: continue
        xa, xb = (sorted((x0, x1)) if dy < 1e-6 else sorted((x0 + dx * (ya - y0) / dy, x0 + dx * (yb - y0) / dy)))
        fr = ((ya + yb) / 2 - r * P) / P; w = xb - xa; h = yb - ya
        ang = math.degrees(math.atan2(h, max(w, 1e-6)))
        if ang < 25 and w >= 6:
            g = "'" if fr < 0.3 else '-' if fr < 0.7 else '.'
            g2 = {"'": "''", '-': '‐-', '.': '..'}[g]; n = max(1, round(w / (adv(g2) + 5)))
            out.append((r, xa, (g2 + ' ') * (n - 1) + g2))
        elif ang > 70: out.append((r, (xa + xb) / 2 - 1.5, 'i' if fr > 0.3 else "'"))
        else:
            g = ('ヽ' if ang > 50 else '､') if dx > 0 else ('/' if ang > 50 else "'´")
            out.append((r, (xa + xb) / 2 - adv(g) / 2, g))
    return out
def chains(aid, chains):
    V, faces = Q.scene(aid); R = {}
    for ch in chains:
        for a, b in zip(ch, ch[1:]):
            if a in V and b in V and V[a][2] and V[b][2]:
                for r, x, g in light_segment(V[a][:2], V[b][:2]): R.setdefault(r, []).append((x, g))
    return R
