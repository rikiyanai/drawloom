"""Glyphs from the planes. For one angle:
- every visible plane gets a value from its 3D normal against the key light (same light as the editor's shading);
- a plane's value picks a bounded pattern (lit = open paper, half = sparse dots, shadow = colons, deep = dense);
- a plane edge is drawn as a stroke only where the form turns (the two planes on either side differ in value),
  on the mesh outline, and on the feature edges (lids, nose base, lip parting);
- strokes are spelled row by row from the edge's angle and its height inside the row.
Returns {row: [(x, glyphs)]} in the underdrawing frame (head at the front's scale, 17 px rows)."""
import json, math, numpy as np
from aa import adv
PA = '/private/tmp/claude-501/-Users-rikihernandez/5591bff3-64a4-4eda-ad29-a402158ce2b9/scratchpad/planes-art/'
EX = {e['id']: e for e in json.load(open(PA + 'export.json'))}
DATA = json.load(open(PA + 'data3d.json'))
NAMES = json.load(open(PA + 'names.json'))
F0 = EX['0001']['scale']
L = DATA['loomis']; RT, UP, BK = (np.array(L[k]) for k in ('right', 'up', 'back'))
LIGHT = -0.45 * RT + 0.55 * UP - 0.7 * BK; LIGHT /= np.linalg.norm(LIGHT)
P = 17
FEATURE = lambda a, b: (a[:2] in ('eL', 'eR') and b[:2] == a[:2] and not (a[2] in 'fg' or b[2] in 'fg')) \
    or {a, b} <= {'mcL', 'pt', 'mcR'} \
    or {a, b} <= {'tip0', 'tip1', 'tip2', 'tip3', 'nsL', 'wL0', 'wL1', 'sub', 'wR1', 'wR0', 'nsR'}
PATTERN = {1: ('.', 26), 2: (':', 18), 3: (';', 12)}   # value class -> (glyph, lattice step px)

def value_class(s):
    return 0 if s > 0.62 else 1 if s > 0.45 else 2 if s > 0.28 else 3

def scene(aid):
    ex = EX[aid]; f = F0 / ex['scale']
    V = {k: (v[0] * f, v[1] * f, v[2]) for k, v in ex['V'].items()}
    view = np.array(ex['view'])
    faces = []
    for fc in ex['faces']:
        ks, n = fc['keys'], np.array(fc['n'])
        if any(k not in V for k in ks) or n @ view > 0 or sum(not V[k][2] for k in ks) * 2 > len(ks): continue
        faces.append((ks, value_class(max(0.0, n @ LIGHT)), n))
    return V, faces

def edge_faces(faces):
    m = {}
    for i, (ks, c, n) in enumerate(faces):
        for a, b in zip(ks, ks[1:] + ks[:1]):
            m.setdefault(tuple(sorted((a, b))), []).append(i)
    return m

def spell_segment(p0, p1, heavy=False):
    """Row-by-row glyphs for one straight stroke."""
    (x0, y0), (x1, y1) = p0, p1
    out = []
    if y1 < y0: (x0, y0), (x1, y1) = (x1, y1), (x0, y0)
    dx, dy = x1 - x0, y1 - y0
    for r in range(int(y0 // P), int(y1 // P) + 1):
        ya, yb = max(y0, r * P), min(y1, (r + 1) * P)
        if yb < ya: continue
        if dy < 1e-6: xa, xb = sorted((x0, x1))
        else:
            xa, xb = sorted((x0 + dx * (ya - y0) / dy, x0 + dx * (yb - y0) / dy))
        ym = (ya + yb) / 2; fr = (ym - r * P) / P; w = xb - xa; h = yb - ya
        ang = math.degrees(math.atan2(h, max(w, 1e-6)))      # 0 = flat, 90 = vertical
        if ang < 22 and w >= 5:                                # flat: weight by height in the row
            g = ('ﾆ' if heavy else '￣') if fr < 0.35 else ('ー' if heavy else '-') if fr < 0.65 else ('＿' if heavy else '_')
            n = max(1, round(w / adv(g))); out.append((r, xa, g * n))
        elif ang > 72:
            out.append((r, (xa + xb) / 2 - 2, '|' if heavy else 'i'))
        else:
            down_right = (dx > 0)
            if ang > 52: g = 'ヽ' if down_right else '/'
            else: g = '＼' if down_right else '／'
            out.append((r, (xa + xb) / 2 - adv(g) / 2, g))
    return out

def poly_rows(pts, y):
    xs = []
    for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]):
        if (y0 <= y < y1) or (y1 <= y < y0): xs.append(x0 + (y - y0) * (x1 - x0) / (y1 - y0))
    xs.sort(); return list(zip(xs[0::2], xs[1::2]))

def build(aid, skip=lambda k: False, turns=True, feats=True, pattern=None):
    V, faces = scene(aid)
    ef = edge_faces(faces)
    strokes = []
    for (a, b), idx in ef.items():
        if skip(a) or skip(b): continue
        feat = FEATURE(a, b)
        turn = len(idx) == 1 or (len(idx) == 2 and abs(faces[idx[0]][1] - faces[idx[1]][1]) >= 2)
        if not ((feat and feats) or (turn and turns)): continue
        strokes += spell_segment(V[a][:2], V[b][:2], heavy=feat)
    R = {}
    for r, x, g in strokes: R.setdefault(r, []).append((x, g))
    # patterns: bounded per plane, on a shared lattice so neighbouring planes of one value read as one field
    for ks, c, n in faces:
        if c == 0 or any(skip(k) for k in ks): continue
        g, step = (pattern or PATTERN)[c]
        pts = [V[k][:2] for k in ks]
        for r in range(int(min(p[1] for p in pts) // P), int(max(p[1] for p in pts) // P) + 1):
            for xa, xb in poly_rows(pts, r * P + P * 0.55):
                off = (r * 7) % step
                x = math.ceil((xa + 4 - off) / step) * step + off
                while x < xb - 4:
                    R.setdefault(r, []).append((x, g)); x += step
    # resolve overlaps inside a row: strokes win over pattern dots
    for r, items in R.items():
        items.sort(key=lambda t: (t[0], t[1] in ('.', ':', ';')))
        keep, pen = [], -99
        for x, g in items:
            if x < pen - 1:
                if g in ('.', ':', ';'): continue
                if keep and keep[-1][1] in ('.', ':', ';'): keep.pop()
                elif x < pen - 4: continue
            keep.append((x, g)); pen = x + adv(g)
        R[r] = keep
    return R, V, faces
