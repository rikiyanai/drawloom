"""Build data for the planes editor: per angle images (JPEG data URIs), plane vertices, polylines, irises, Loomis + neck."""
import json, base64, io, math, importlib.util, numpy as np
from PIL import Image
from scipy.spatial import Delaunay
F = 'face/'; O = 'planes-art/'
spec = importlib.util.spec_from_file_location('pl', F + 'planes0001.py'); pl = importlib.util.module_from_spec(spec)
import os; cwd = os.getcwd(); os.chdir(F); spec.loader.exec_module(pl); os.chdir(cwd)
P0 = np.load(F + 'local/lm0001.npy')
V0 = {k: np.array(v, float) for k, v in pl.V.items()}
POLY = [p.split() for p in pl.POLY]
IRIS0 = [{'c': np.array(c, float), 'r': r} for c, r, *_ in pl.IRIS]
IRIS_EYE = [['eLo', 'eLu1', 'eLu', 'eLu2', 'eLi', 'eLl2', 'eLl', 'eLl1'], ['eRo', 'eRu1', 'eRu', 'eRu2', 'eRi', 'eRl2', 'eRl', 'eRl1']]
tri = Delaunay(P0)
cent = P0[tri.simplices].mean(1)

def bary(p):
    s = tri.find_simplex(p)
    if s < 0: s = int(np.argmin(((cent - p) ** 2).sum(1)))
    idx = tri.simplices[s]; A = P0[idx]
    T = np.array([[A[0, 0] - A[2, 0], A[1, 0] - A[2, 0]], [A[0, 1] - A[2, 1], A[1, 1] - A[2, 1]]])
    l12 = np.linalg.solve(T, p - A[2]); w = np.array([l12[0], l12[1], 1 - l12.sum()])
    return idx, w
BARY = {k: bary(v) for k, v in V0.items()}
IBARY = [bary(i['c']) for i in IRIS0]

def jpg(im, q=82):
    b = io.BytesIO(); im.convert('RGB').save(b, 'JPEG', quality=q, optimize=True); return 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()

def loomis(L, yaw):
    g, n, ch, top = L[9], L[2], L[152], L[10]
    up = (g - ch); up /= np.linalg.norm(up); rt = np.array([-up[1], up[0]])
    if rt[0] < 0: rt = -rt
    R = float(np.linalg.norm(g - n)) * 1.02
    mid = (L[127] + L[356]) / 2; t = float(np.dot(g - mid, up)); c = mid + up * t
    rc = 0.66 * R; sy = abs(math.sin(math.radians(yaw)))
    back = -rt if yaw > 0 else rt
    c = c + back * R * 0.45 * sy; R *= 1 + 0.2 * sy
    out = {'sphC': c, 'sphR': c + up * R}
    for side, li in (('L', 127), ('R', 356)):
        e = L[li] + up * float(np.dot(g - L[li], up))
        out[f'cut{side}C'] = e; out[f'cut{side}A'] = e + rt * rc * max(0.12, sy if (side == 'L') == (yaw > 0) else 0.12 + 0.3 * sy); out[f'cut{side}B'] = e + up * rc
    down = -up
    out.update({'lmTop': c + up * R, 'lmBrow': g, 'lmNose': n, 'lmChin': ch,
                'lmJawL': L[172], 'lmJawR': L[397], 'lmEarL': L[234], 'lmEarR': L[454],
                'nkL0': L[172] + down * 0.12 * R, 'nkL1': L[172] + down * 1.25 * R, 'nkR0': L[397] + down * 0.12 * R, 'nkR1': L[397] + down * 1.25 * R,
                'nkPit': ch + down * 1.15 * R})
    return out
LOOMIS_POLY = [['lmTop', 'lmBrow', 'lmNose', 'lmChin'], ['cutLC', 'lmBrow', 'cutRC'], ['lmEarL', 'lmNose', 'lmEarR'],
               ['lmEarL', 'lmJawL', 'lmChin', 'lmJawR', 'lmEarR'], ['nkL0', 'nkL1'], ['nkR0', 'nkR1'], ['nkL1', 'nkPit', 'nkR1']]

angles = []
def angle(aid, label, yaw, L, photo, line, verts=None, iris=None):
    if verts is None:
        verts = {k: (L[i] * w[:, None]).sum(0) for k, (i, w) in BARY.items()}
        s = np.linalg.norm(L[33] - L[133]) / np.linalg.norm(P0[33] - P0[133])
        iris = [{'c': (L[i] * w[:, None]).sum(0), 'r': ir['r'] * s} for (i, w), ir in zip(IBARY, IRIS0)]
    lo = loomis(L, yaw)
    r2 = lambda p: [round(float(p[0]), 1), round(float(p[1]), 1)]
    angles.append(dict(id=aid, label=label, yaw=round(yaw, 1), w=photo.width, h=photo.height, photo=jpg(photo), line=jpg(line),
        verts={k: r2(v) for k, v in verts.items()}, iris=[{'key': f'iris{j}', 'c': r2(i['c']), 'r': round(float(i['r']), 1), 'eye': IRIS_EYE[j]} for j, i in enumerate(iris)],
        loomis={k: r2(v) for k, v in lo.items()}))

# front: the hand-corrected 612x558 frame
angle('0001', 'Front', 1.2, P0, Image.open(F + 'local/ph612.png'), Image.open(F + 'local/dl-line-0001.png'),
      verts=V0, iris=IRIS0)
D = '/Users/rikihernandez/trueff-shallot/.run/face-capture/face-riki-scan/drawloom/'
for aid, label in (('0004', 'Slight turn'), ('0007', 'Three-quarter'), ('0010', 'Near profile')):
    p = json.load(open(D + aid + '/packet.json'))
    L = np.load(O + f'lm{aid}.npy')
    def lay(k):
        im = Image.open(O + f'{aid}-{k}.png').convert('RGBA'); bg = Image.new('RGBA', im.size, 'white'); bg.alpha_composite(im); return bg.convert('RGB')
    lo, hi = L.min(0), L.max(0); wh = hi - lo
    sy = math.sin(math.radians(abs(p['angles']['yaw'])))
    box = [int(max(0, lo[0] - (0.35 + 0.9 * sy) * wh[0])), int(max(0, lo[1] - 0.55 * wh[1])), int(min(1024, hi[0] + 0.3 * wh[0])), int(min(1820, hi[1] + 0.75 * wh[1]))]
    sc = 612 / (box[2] - box[0])
    def prep(im): return im.crop(box).resize((612, round((box[3] - box[1]) * sc)), Image.LANCZOS)
    Lc = (L - np.array(box[:2])) * sc
    angle(aid, label, p['angles']['yaw'], Lc, prep(lay('photo')), prep(lay('edges')))
SIDE = {k: ('R' if v[0] > 337 else 'L' if v[0] < 287 else 'C') for k, v in V0.items()}
d = dict(side=SIDE, poly=POLY, loomisPoly=LOOMIS_POLY, angles=angles)
s = json.dumps(d, ensure_ascii=False); open(O + 'data.json', 'w').write(s); print(len(s) // 1024, 'KB', [a['id'] for a in angles])
