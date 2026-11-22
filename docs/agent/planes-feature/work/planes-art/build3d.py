"""3D head planes for the editor.
Canonical space = frame 0001 MediaPipe landmark space (image px, z same scale, smaller z = nearer the camera).
Plane vertices: the user's corrected FRONT positions, lifted onto the landmark surface (z interpolated on the
landmark mesh); cranium points onto a fitted Loomis sphere; neck points onto a fitted neck cylinder.
Per angle: rigid similarity (Umeyama) canonical -> that frame's landmarks, then the frame's crop to page px.
Ships, per angle: the 2x3 projection M, offset c, depth row, view direction, a depth buffer of the real per-frame
landmark mesh + sphere + neck (for occlusion), and every observation the user made (their drags), so the page
triangulates each vertex in 3D from all views and reprojects everywhere."""
import json, base64, io, math, os, importlib.util, numpy as np
from PIL import Image
from scipy.spatial import Delaunay
from scipy.interpolate import LinearNDInterpolator

SP = '/private/tmp/claude-501/-Users-rikihernandez/5591bff3-64a4-4eda-ad29-a402158ce2b9/scratchpad/'
F, O = SP + 'face/', SP + 'planes-art/'
D = '/Users/rikihernandez/trueff-shallot/.run/face-capture/face-riki-scan/drawloom/'
spec = importlib.util.spec_from_file_location('pl', F + 'planes0001.py'); pl = importlib.util.module_from_spec(spec)
cwd = os.getcwd(); os.chdir(F); spec.loader.exec_module(pl); os.chdir(cwd)

def L3(f):
    p = json.load(open(D + f + '/packet.json')); v = p['pose']['vertices']
    return np.array([[q['x'], q['y'], q['z']] for q in v]), p['angles']

def umeyama(X, Y):
    mx, my = X.mean(0), Y.mean(0); Xc, Yc = X - mx, Y - my
    U, S, Vt = np.linalg.svd(Yc.T @ Xc / len(X)); d = np.sign(np.linalg.det(U @ Vt)); Dm = np.diag([1, 1, d])
    R = U @ Dm @ Vt; s = (S * np.diag(Dm)).sum() / ((Xc ** 2).sum() / len(X)); return s, R, my - s * R @ mx

X0, ang0 = L3('0001')
P0 = np.load(F + 'local/lm0001.npy')                      # front landmarks in the 612 page frame
# front page <- MP xy similarity
A = np.c_[X0[:, :2], np.ones(len(X0))]; G, *_ = np.linalg.lstsq(A, P0, rcond=None)
L0, b0 = G[:2].T, G[2]                                      # page = L0 @ xy + b0

def jpg(im, q=80):
    b = io.BytesIO(); im.convert('RGB').save(b, 'JPEG', quality=q, optimize=True); return 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()

# ---------- front vertices (defaults + the user's front corrections) ----------
saved = {f[:4]: (lambda d: d.get('data', d))(json.load(open(O + 'db/planes/' + f))) for f in os.listdir(O + 'db/planes')}
front = {k: np.array(v, float) for k, v in pl.V.items()}
for k, v in saved.get('0001', {}).get('edits', {}).items():
    if k in front: front[k] = np.array(v, float)
iris2d = [(np.array(c, float), r) for c, r, *_ in pl.IRIS]
for j, key in enumerate(['iris0', 'iris1']):
    e = saved.get('0001', {}).get('edits', {})
    if key in e:
        c = np.array(e[key], float); rp = np.array(e.get(key + 'R', [c[0] + iris2d[j][1], c[1]]), float)
        iris2d[j] = (c, float(np.linalg.norm(rp - c)))
L0i = np.linalg.inv(L0)
to_mp = lambda p: L0i @ (np.asarray(p, float) - b0)
s0 = math.sqrt(abs(np.linalg.det(L0)))                     # page px per MP px on the front

# landmark surface depth
zint = LinearNDInterpolator(X0[:, :2], X0[:, 2])
# head axes from landmarks: right (viewer right), up, back (away from camera)
RT = X0[454] - X0[234]; RT /= np.linalg.norm(RT)
UP = X0[10] - X0[152]; UP -= RT * (UP @ RT); UP /= np.linalg.norm(UP); UP = -UP if UP[1] > 0 else UP   # image y grows downward
BK = np.cross(RT, UP); BK = BK if BK[2] > 0 else -BK
# Loomis ball grounded on proportion: radius = brow-to-nose-base along the head's up axis; centre at brow height,
# on the midline, one radius behind the glabella (ball front = brow). Measured: R matches half the temple width.
SR = float(abs((X0[9] - X0[2]) @ UP))
SC = X0[9] + BK * SR
# neck cylinder: axis on the midline under the ball centre, leaning forward going down; radius from the drawn neck sides
jawL, jawR, chin, earL, earR = X0[172], X0[397], X0[152], X0[234], X0[454]
nkw = np.linalg.norm(to_mp(front['nkR']) - to_mp(front['nkL']))
NR = nkw / 2
jaw_h = float(((jawL + jawR) / 2 - SC) @ (-UP))
NC0 = SC + (-UP) * jaw_h + BK * (0.05 * SR)
ndir = -UP * math.cos(math.radians(18)) + BK * math.sin(math.radians(18)); ndir /= np.linalg.norm(ndir)

def sphere_front(m):
    # point on the front half of the ball at image xy m (canonical image axes; camera looks along +z)
    d2 = SR ** 2 - (m[0] - SC[0]) ** 2 - (m[1] - SC[1]) ** 2
    return SC[2] - math.sqrt(max(d2, 0.0))

def neck_front(m):
    t = (m[1] - NC0[1]) / ndir[1]; c = NC0 + t * ndir; dx = m[0] - c[0]
    return c[2] - math.sqrt(max(NR ** 2 - dx ** 2, 0.0))

def lift(key, p):
    m = to_mp(p); zi = zint(m[0], m[1]); z = float(zi) if np.isfinite(zi) else np.nan
    if key.startswith('nk'):
        z = neck_front(m)
    elif key.startswith('sj'):
        z = float(chin[2]) + 0.5 * (neck_front(m) - float(chin[2]))
    elif not np.isfinite(z):
        z = sphere_front(m)
    return np.array([m[0], m[1], z])

V3 = {k: lift(k, p) for k, p in front.items()}
IRIS3 = []
for (c, r) in iris2d:
    m = to_mp(c); z = float(zint(m[0], m[1]))
    IRIS3.append({'c': [m[0], m[1], z - 2.0], 'r': r / s0})

# Loomis / neck primitives in canonical space
LOOM = {
    'sphC': SC.tolist(), 'sphR': SR, 'right': RT.tolist(), 'up': UP.tolist(), 'back': BK.tolist(),
    'cutK': 0.62,                                            # side-plane cut at 62% of the radius
    'brow': X0[9].tolist(), 'noseBase': X0[2].tolist(), 'chin': X0[152].tolist(), 'hair': X0[10].tolist(),
    'neckC': NC0.tolist(), 'neckDir': ndir.tolist(), 'neckR': NR, 'neckLen': 1.25 * SR,
    'mastoidL': (earL - UP * 0.35 * SR + BK * 0.2 * SR).tolist(), 'mastoidR': (earR - UP * 0.35 * SR + BK * 0.2 * SR).tolist(),
}
LOOM['templeHalf'] = float(np.linalg.norm(X0[356] - X0[127])) / 2
LOOM['pit'] = (NC0 + ndir * LOOM['neckLen'] - BK * NR).tolist()
MIDLINE = [10, 151, 9, 8, 168, 6, 197, 195, 5, 4, 1, 2, 164, 0, 13, 14, 17, 18, 200, 199, 175, 152]
JAW = [234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361, 323, 454]


# construction points (same names as the 2D editor, so the user's drags map one to one); 3D defaults from the ball and neck
rc = SR * math.sqrt(1 - LOOM['cutK'] ** 2)
CV = {'sphC': SC, 'sphR': SC + UP * SR, 'lmTop': SC + UP * SR, 'lmBrow': X0[9], 'lmNose': X0[2], 'lmChin': X0[152],
      'lmEarL': X0[234], 'lmEarR': X0[454], 'lmJawL': X0[172], 'lmJawR': X0[397],
      'nkL0': NC0 - RT * NR, 'nkR0': NC0 + RT * NR, 'nkL1': NC0 + ndir * LOOM['neckLen'] - RT * NR, 'nkR1': NC0 + ndir * LOOM['neckLen'] + RT * NR,
      'nkPit': np.array(LOOM['pit']), 'mastoidL': np.array(LOOM['mastoidL']), 'mastoidR': np.array(LOOM['mastoidR'])}
for side, sg in (('L', -1), ('R', 1)):
    Cc = SC + RT * sg * LOOM['cutK'] * SR
    CV['cut%sC' % side] = Cc; CV['cut%sB' % side] = Cc + UP * rc; CV['cut%sA' % side] = Cc - BK * rc
# ---------- surface for occlusion: landmark Delaunay ----------
TRI = Delaunay(X0[:, :2]).simplices

# ---------- proportion check (measured on the corrected front, MP px) ----------
def mp(k): return V3[k]
eyeL_w = np.linalg.norm(V3['eLo'][:2] - V3['eLi'][:2]); eyeR_w = np.linalg.norm(V3['eRo'][:2] - V3['eRi'][:2])
inner = np.linalg.norm(V3['eLi'][:2] - V3['eRi'][:2])
hair_y = float((V3['ftL'][1] + V3['ftR'][1]) / 2); brow_y = float((V3['gl0'][1] + V3['gl1'][1]) / 2)
base_y = float(V3['sub'][1]); chin_y = float(V3['cb0'][1])
face_w = np.linalg.norm(X0[234][:2] - X0[454][:2]); mouth_w = np.linalg.norm(V3['mcL'][:2] - V3['mcR'][:2])
pup = [np.array(i['c'][:2]) for i in IRIS3]
PROP = {
    'thirds_px': [round(brow_y - hair_y, 1), round(base_y - brow_y, 1), round(chin_y - base_y, 1)],
    'eye_widths': [round(float(eyeL_w), 1), round(float(eyeR_w), 1)], 'inner_gap': round(float(inner), 1),
    'face_width_ear_to_ear': round(float(face_w), 1), 'face_width_in_eyes': round(float(face_w / ((eyeL_w + eyeR_w) / 2)), 2),
    'mouth_width': round(float(mouth_w), 1), 'pupil_gap': round(float(np.linalg.norm(pup[0] - pup[1])), 1),
    'eye_line_from_crown_ratio': None,
}
PROP_Y = {'hairline': hair_y, 'brow': brow_y, 'noseBase': base_y, 'chin': chin_y, 'eyes': float((pup[0][1] + pup[1][1]) / 2)}
PROP_X = {'eyeLo': float(V3['eLo'][0]), 'eyeLi': float(V3['eLi'][0]), 'eyeRi': float(V3['eRi'][0]), 'eyeRo': float(V3['eRo'][0]),
          'pupilL': float(pup[0][0]), 'pupilR': float(pup[1][0])}

def prop_lines():
    out = {}
    xs = np.linspace(X0[:, 0].min() + 8, X0[:, 0].max() - 8, 40)
    for name, y in PROP_Y.items():
        pts = [[float(x), y, float(zint(x, y))] for x in xs if np.isfinite(zint(x, y))]
        out['h_' + name] = pts
    ys = np.linspace(hair_y, chin_y, 30)
    for name, x in PROP_X.items():
        out['v_' + name] = [[x, float(y), float(zint(x, y))] for y in ys if np.isfinite(zint(x, y))]
    return out

# ---------- per angle ----------
angles = []
def add_angle(aid, label, photo, line, Lf, bf, Yf):
    s, R, t = umeyama(X0, Yf)
    M = Lf @ (s * R)[:2, :]; c = Lf @ t[:2] + bf
    sc = math.sqrt(abs(np.linalg.det(Lf)))
    drow = sc * s * R[2, :]; d0 = sc * t[2]
    view = (R.T @ np.array([0, 0, 1.0]))                      # camera direction in canonical space
    resid = np.linalg.norm((s * (R @ X0.T).T + t) - Yf, axis=1)
    w, h = photo.size; k = 3
    # occlusion surface: use THIS frame's own landmarks (real surface), mapped into page/depth
    Pf = (Lf @ Yf[:, :2].T).T + bf; Zf = Yf[:, 2] * sc
    W, H = w // k, h // k; zbuf = np.full((H, W), np.inf, np.float32)
    for tt in TRI:
        a, b, cc = Pf[tt] / k; za, zb_, zc = Zf[tt]
        xmin, xmax = int(max(0, math.floor(min(a[0], b[0], cc[0])))), int(min(W - 1, math.ceil(max(a[0], b[0], cc[0]))))
        ymin, ymax = int(max(0, math.floor(min(a[1], b[1], cc[1])))), int(min(H - 1, math.ceil(max(a[1], b[1], cc[1]))))
        if xmin > xmax or ymin > ymax: continue
        den = (b[1] - cc[1]) * (a[0] - cc[0]) + (cc[0] - b[0]) * (a[1] - cc[1])
        if abs(den) < 1e-9: continue
        gx, gy = np.meshgrid(np.arange(xmin, xmax + 1) + .5, np.arange(ymin, ymax + 1) + .5)
        l1 = ((b[1] - cc[1]) * (gx - cc[0]) + (cc[0] - b[0]) * (gy - cc[1])) / den
        l2 = ((cc[1] - a[1]) * (gx - cc[0]) + (a[0] - cc[0]) * (gy - cc[1])) / den
        l3 = 1 - l1 - l2; m = (l1 >= -0.02) & (l2 >= -0.02) & (l3 >= -0.02)
        sub = zbuf[ymin:ymax + 1, xmin:xmax + 1]; np.minimum(sub, np.where(m, l1 * za + l2 * zb_ + l3 * zc, np.inf).astype(np.float32), out=sub)
    Cp = M @ SC + c; Cz = SC @ drow + d0; Rp = SR * s * sc
    gx, gy = np.meshgrid(np.arange(W) * k + k / 2, np.arange(H) * k + k / 2)
    d2 = Rp ** 2 - (gx - Cp[0]) ** 2 - (gy - Cp[1]) ** 2
    zs = np.where(d2 > 0, Cz - np.sqrt(np.maximum(d2, 0)), np.inf).astype(np.float32)
    zbuf = np.where(np.isfinite(zbuf), zbuf, zs)
    fin = np.isfinite(zbuf); lo_, hi_ = float(zbuf[fin].min()), float(zbuf[fin].max())
    q = np.where(fin, np.clip((zbuf - lo_) / (hi_ - lo_) * 65534, 0, 65534), 65535).astype('<u2')
    ed = saved.get(aid, {}).get('edits', {}); obs = {}
    pj = lambda X3: (M @ np.asarray(X3, float) + c)
    for kk, v in ed.items():
        k2 = {'eLc': 'soLi', 'eRc': 'soRi'}.get(kk, kk)
        if k2 != kk and k2 in ed: continue                            # merged corner: the user's own soLi/soRi drag wins
        if k2 in V3 or k2 in CV or k2 in ('iris0', 'iris1', 'iris0R', 'iris1R'): obs[k2] = [round(float(v[0]), 1), round(float(v[1]), 1)]
        else: print('UNMAPPED', aid, kk)
    for sd in 'LR':                                                   # side-plane width handle: ellipse is symmetric, keep the 3D-consistent end
        A_, C_ = 'cut%sA' % sd, 'cut%sC' % sd
        if A_ in obs:
            cpin = np.array(obs.get(C_, pj(CV[C_]))); p = np.array(obs[A_]); qq = 2 * cpin - p; t = pj(CV[A_])
            if np.linalg.norm(qq - t) < np.linalg.norm(p - t): obs[A_] = [round(float(qq[0]), 1), round(float(qq[1]), 1)]
    angles.append(dict(id=aid, label=label, yaw=round(float(ang0['yaw'] if aid == '0001' else json.load(open(D + aid + '/packet.json'))['angles']['yaw']), 1),
        w=w, h=h, photo=jpg(photo), line=jpg(line),
        M=M.round(5).tolist(), c=c.round(3).tolist(), drow=drow.round(5).tolist(), d0=round(float(d0), 3), view=view.round(5).tolist(),
        scale=round(float(s * sc), 5), fitResidualMedian=round(float(np.median(resid)), 2),
        zb=dict(k=k, w=W, h=H, lo=lo_, hi=hi_, data=base64.b64encode(q.tobytes()).decode()),
        img2page=np.c_[Lf, bf].round(6).tolist(), seed=obs, notes=saved.get(aid, {}).get('notes', '')))

Y0, _ = L3('0001')
add_angle('0001', 'Front', Image.open(F + 'local/ph612.png'), Image.open(F + 'local/dl-line-0001.png'), L0, b0, Y0)
for aid, label in (('0004', 'Slight turn'), ('0007', 'Three-quarter'), ('0010', 'Near profile')):
    Yf, an = L3(aid)
    def lay(kk):
        im = Image.open(O + f'{aid}-{kk}.png').convert('RGBA'); bg = Image.new('RGBA', im.size, 'white'); bg.alpha_composite(im); return bg.convert('RGB')
    L2 = Yf[:, :2]; lo, hi = L2.min(0), L2.max(0); wh = hi - lo; sy = math.sin(math.radians(abs(an['yaw'])))
    box = [int(max(0, lo[0] - (0.35 + 0.9 * sy) * wh[0])), int(max(0, lo[1] - 0.55 * wh[1])), int(min(1024, hi[0] + 0.3 * wh[0])), int(min(1820, hi[1] + 0.75 * wh[1]))]
    sc = 612 / (box[2] - box[0])
    prep = lambda im: im.crop(box).resize((612, round((box[3] - box[1]) * sc)), Image.LANCZOS)
    add_angle(aid, label, prep(lay('photo')), prep(lay('edges')), np.eye(2) * sc, -np.array(box[:2], float) * sc, Yf)

NAMES = json.load(open(O + 'names.json'))
# ---------- plane faces: regions of the planar edge graph on the corrected front ----------
EDG = set()
for line in pl.POLY:
    ks = line.split()
    for a_, b_ in zip(ks, ks[1:]):
        if a_ != b_: EDG.add(tuple(sorted((a_, b_))))
nbr = {}
for a_, b_ in EDG: nbr.setdefault(a_, []).append(b_); nbr.setdefault(b_, []).append(a_)
FP = {k: np.asarray(v, float) for k, v in front.items()}
angle_of = lambda a_, b_: math.atan2(FP[b_][1] - FP[a_][1], FP[b_][0] - FP[a_][0])
for k in nbr: nbr[k].sort(key=lambda b_: angle_of(k, b_))
used, FACES = set(), []
for a_, b_ in list(EDG) + [(b_, a_) for a_, b_ in EDG]:
    if (a_, b_) in used: continue
    cyc, u, v = [a_], a_, b_
    while (u, v) not in used:
        used.add((u, v)); cyc.append(v)
        lst = nbr[v]; i = lst.index(u); w = lst[(i - 1) % len(lst)]   # next edge clockwise from the reverse edge
        u, v = v, w
        if len(cyc) > 60: break
    cyc = cyc[:-1] if cyc[-1] == cyc[0] else cyc
    pts = np.array([FP[k] for k in cyc]); x, y = pts[:, 0], pts[:, 1]
    area = 0.5 * (np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1)))
    FACES.append((cyc, area))
sgn = np.sign(sum(a for _, a in FACES if abs(a) < 20000) or 1)
outer = max(FACES, key=lambda f: abs(f[1]))
FACES = [c for c, a in FACES if (c, a) is not outer and np.sign(a) == sgn and abs(a) > 4 and len(c) >= 3]
print('faces', len(FACES))
data = dict(verts={k: [round(float(x), 2) for x in v] for k, v in V3.items()}, cverts={k: [round(float(x), 2) for x in v] for k, v in CV.items()}, iris=IRIS3, irisEye=[
    ['eLo', 'eLu1', 'eLu', 'eLu2', 'eLi', 'eLl2', 'eLl', 'eLl1'], ['eRo', 'eRu1', 'eRu', 'eRu2', 'eRi', 'eRl2', 'eRl', 'eRl1']],
    poly=[p.split() for p in pl.POLY], faces=FACES, loomis=LOOM, midline=X0[MIDLINE].round(2).tolist(), jaw=X0[JAW].round(2).tolist(),
    propLines={k: np.round(v, 2).tolist() for k, v in prop_lines().items()}, prop=PROP, names=NAMES, angles=angles)
s = json.dumps(data, ensure_ascii=False); open(O + 'data3d.json', 'w').write(s)
print(len(s) // 1024, 'KB'); print('ball', SC.round(1), round(SR, 1), 'temple half-width', round(float(np.linalg.norm(X0[356]-X0[127]))/2, 1), 'neckR', round(NR, 1)); print('PROP', PROP)
for a in angles: print(a['id'], a['yaw'], 'fit resid', a['fitResidualMedian'], 'pins', len(a['seed']), 'of', len(saved.get(a['id'], {}).get('edits', {})))
