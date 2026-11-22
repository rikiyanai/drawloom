"""Constructive underdrawing per angle, from the editor's own solve (export.json) over the Drawloom line drawing.
Every angle is rescaled so the head is the size of the front (612 px frame), which is the AA's 1:1 pixel frame."""
import json, base64, io, re
from PIL import Image, ImageDraw, ImageChops, ImageFilter
import numpy as np
PK = '/Users/rikihernandez/trueff-shallot/.run/face-capture/face-riki-scan/drawloom/'
O = '/private/tmp/claude-501/-Users-rikihernandez/5591bff3-64a4-4eda-ad29-a402158ce2b9/scratchpad/planes-art/'
EX = json.load(open(O + 'export.json')); DATA = json.load(open(O + 'data3d.json'))
SS = 2  # supersample
FEAT = {'eye': (20, 20, 20), 'nose': (20, 20, 20), 'mouth': (20, 20, 20)}
GCOL = {'forehead': (150, 60, 50), 'temple': (150, 90, 60), 'brow': (130, 50, 120), 'socket': (60, 100, 160), 'cheek': (40, 120, 80),
        'chin': (100, 70, 170), 'jaw': (80, 80, 80), 'neck': (120, 50, 150)}
LOOM, CUT, NECK = (70, 120, 200), (20, 140, 115), (140, 70, 190)

UPPER = {'o', 'u1', 'u', 'u2', 'i'}; LOWER = {'o', 'l1', 'l', 'l2', 'i'}
NAMES = json.load(open(O + 'names.json'))
def role(a, b):
    ek = lambda k: k[2:] if k[:2] in ('eL', 'eR') else None
    if a[:2] == b[:2] and a[:2] in ('eL', 'eR'):
        x, y = ek(a), ek(b)
        if x in UPPER and y in UPPER: return (15, 15, 15, 255), 2.2           # upper lid margin, the eye's main line
        if x in LOWER and y in LOWER: return (60, 60, 60, 230), 1.1           # lower lid
        if x.startswith('f') or y.startswith('f'): return (90, 90, 90, 200), 1.0   # lid fold
        return (150, 150, 150, 150), 0.8                                       # bands
    s = {a, b}
    if s <= {'mcL', 'pt', 'mcR'}: return (15, 15, 15, 255), 2.0               # lip parting
    if s <= {'llL', 'ml0', 'ml1', 'llR'} and s & {'ml0', 'ml1'} == s: return (50, 50, 50, 230), 1.4   # under-lip shadow line
    if s <= {'tip0', 'tip1', 'tip2', 'tip3', 'nsL', 'wL0', 'wL1', 'sub', 'wR1', 'wR0', 'nsR'}: return (25, 25, 25, 245), 1.6  # nose base, wings, nostrils
    if s & {'lpL', 'lp0', 'lpR', 'llL', 'll0', 'llR', 'ph0', 'ph1', 'ph2', 'ph3'}: return (150, 140, 150, 140), 0.8   # lip volumes: construction only
    g = NAMES.get(a, {}).get('group', 'jaw')
    return GCOL.get(g, (90, 90, 90)) + (150,), 1.0

def uri(s): return Image.open(io.BytesIO(base64.b64decode(s.split(',', 1)[1]))).convert('RGB')
def pts(s): return [tuple(float(v) for v in p.split(',')) for p in s.split()]

def render(ex, an, f, with_line=True, colour=True):
    W, H = round(an['w'] * f), round(an['h'] * f)
    base = Image.new('RGB', (W * SS, H * SS), 'white')
    if with_line:
        ln = uri(an['line']).resize((W * SS, H * SS), Image.LANCZOS)
        base = Image.blend(base, ln, 0.42)
    # value block-in: Drawloom's 3-level notan warped into this page (black = hair and deep shadow, grey = half-tone)
    pk = json.load(open(PK + an['id'] + '/packet.json')); nl = next(l for l in pk['layers'] if l['id'] == 'notan')
    nt = Image.open(io.BytesIO(base64.b64decode(nl['png'].split(',', 1)[1]))).convert('RGBA'); bg = Image.new('RGBA', nt.size, 'white'); bg.alpha_composite(nt)
    A = np.array(an['img2page'])[:, :2] * f * SS; b = np.array(an['img2page'])[:, 2] * f * SS; Ai = np.linalg.inv(A); bi = -Ai @ b
    nt = bg.convert('L').transform(base.size, Image.AFFINE, (Ai[0, 0], Ai[0, 1], bi[0], Ai[1, 0], Ai[1, 1], bi[1]), Image.BILINEAR, fillcolor=255)
    nt = nt.filter(ImageFilter.MedianFilter(7))
    blk = nt.point(lambda v: 255 if v < 64 else 0); mid = nt.point(lambda v: 255 if 64 <= v < 190 else 0)
    # keep only the subject: dark masses touching the Loomis ball (hair, ear shadow), half-tones inside the face hull
    from scipy import ndimage
    from scipy.spatial import ConvexHull
    ball = next(e for e in ex['svg'] if e['tag'] == 'circle' and 'lm' in e['cls'])
    cx, cy, r = (float(ball['a'][k]) * f * SS for k in ('cx', 'cy', 'r'))
    blk = blk.filter(ImageFilter.MinFilter(9)).filter(ImageFilter.MaxFilter(9))   # opening: cut thin hair-to-brow bridges
    bm = np.array(blk) > 0; lab, n = ndimage.label(bm); yy, xx = np.mgrid[:bm.shape[0], :bm.shape[1]]
    near = (xx - cx) ** 2 + (yy - cy) ** 2 < (1.35 * r) ** 2
    keep = np.unique(lab[near & bm]); keep = keep[keep > 0]
    sizes = ndimage.sum(bm, lab, keep); keep = keep[sizes > 400 * SS * SS]
    ph = np.array(uri(an['photo']).resize(base.size).convert('L'))
    bx = cx - (0.4 * r if abs(an["yaw"]) > 20 else 0)                       # turned heads: the bun sits behind the ball
    subj = (xx - bx) ** 2 + ((yy - cy) / 1.15) ** 2 < ((1.62 if abs(an["yaw"]) > 20 else 1.42) * r) ** 2
    if an['id'] == '0001': subj &= ph < 235                                   # front photo is already cut out
    blk = Image.fromarray((np.isin(lab, keep) & subj).astype(np.uint8) * 255).filter(ImageFilter.MedianFilter(5))
    vp = np.array([(v[0] * f * SS, v[1] * f * SS) for k, v in ex['V'].items() if (v[2] and k in DATA['verts']) or k in ('nkPit', 'nkL1', 'nkR1')])
    hull = vp[ConvexHull(vp).vertices]; hm = Image.new('L', base.size, 0); ImageDraw.Draw(hm).polygon([tuple(p) for p in hull], fill=255)
    phl = np.array(uri(an['photo']).resize(base.size).convert('L').filter(ImageFilter.GaussianBlur(3 * SS)), float)
    hmask = np.array(hm) > 0; med = np.median(phl[hmask])
    midA = hmask & (phl < 0.86 * med); deepA = hmask & (phl < 0.66 * med)
    mid = Image.fromarray(midA.astype(np.uint8) * 255).filter(ImageFilter.MedianFilter(9))
    deep = Image.fromarray(deepA.astype(np.uint8) * 255).filter(ImageFilter.MedianFilter(9))
    ez = Image.new('L', base.size, 0); dz = ImageDraw.Draw(ez)
    for side in 'LRM':
        ring = [k for k in ex['V'] if k[:2] in ('mc', 'lp', 'll', 'ml', 'pt')] if side == 'M' else [k for k in ex['V'] if k.startswith('e' + side) or k.startswith('so' + side)]
        P_ = np.array([(ex['V'][k][0] * f * SS, ex['V'][k][1] * f * SS) for k in ring if ex['V'][k][2]])
        if len(P_) >= 3: dz.polygon([tuple(p) for p in P_[ConvexHull(P_).vertices]], fill=255)
    blk = ImageChops.subtract(blk, ez.filter(ImageFilter.MaxFilter(9)))
    # brows: keep them as their own dark shapes with a skin gap to the hair
    bz = Image.new('L', base.size, 0); db_ = ImageDraw.Draw(bz)
    for side in 'LR':
        ks = [k for k in ex['V'] if k.startswith('br' + side) or k == ('gl0' if side == 'L' else 'gl1') or k.startswith('e' + side + 'f')]
        P_ = np.array([(ex['V'][k][0] * f * SS, ex['V'][k][1] * f * SS) for k in ks if ex['V'][k][2]])
        if len(P_) >= 3: db_.polygon([tuple(p) for p in P_[ConvexHull(P_).vertices]], fill=255)
    browA = bz.filter(ImageFilter.MaxFilter(13)); ring_ = bz.filter(ImageFilter.MaxFilter(29))
    blk = ImageChops.add(ImageChops.multiply(blk, browA), ImageChops.subtract(blk, ring_))
    blk.resize((W, H)).save(O + f'mask-hair-{an["id"]}.png'); mid.resize((W, H)).save(O + f'mask-mid-{an["id"]}.png'); deep.resize((W, H)).save(O + f'mask-deep-{an["id"]}.png')
    if with_line:
        base.paste((200, 195, 187), mask=mid.point(lambda v: v * 70 // 255)); base.paste((160, 152, 144), mask=deep.point(lambda v: v * 80 // 255)); base.paste((120, 112, 104), mask=blk.point(lambda v: v * 95 // 255))
        edge = blk.filter(ImageFilter.FIND_EDGES).point(lambda v: 255 if v > 60 else 0).filter(ImageFilter.MaxFilter(3))
        base.paste((45, 40, 36), mask=edge.point(lambda v: v * 200 // 255))
    ov = Image.new('RGBA', base.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    T = lambda ps: [(x * f * SS, y * f * SS) for x, y in ps]
    lw = lambda w: max(1, round(w * SS))
    clips = {}
    for e in ex['svg']:
        if e['parent'] == 'clipPath': clips.setdefault(len(clips), pts(e['pts']))
    ci = 0; cuts = []
    for e in ex['svg']:
        c, tag = e['cls'], e['tag']
        if e['parent'] == 'clipPath': continue
        if 'face' in c: continue
        if 'hid' in c or c.startswith('h') or 'rubber' in c: continue
        if tag == 'circle' and 'lm' in c:
            cx, cy, r = (float(e['a'][k]) * f * SS for k in ('cx', 'cy', 'r'))
            d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=LOOM + (170,), width=lw(1)); continue
        if tag == 'line':
            p = T([(float(e['a']['x1']), float(e['a']['y1'])), (float(e['a']['x2']), float(e['a']['y2']))])
            d.line(p, fill=(NECK if 'nk' in c else LOOM) + (170,), width=lw(1.1)); continue
        if tag != 'polyline': continue
        P = T(pts(e['pts']))
        if 'iris' in c:
            m = Image.new('L', base.size, 0); ImageDraw.Draw(m).polygon(T(clips[ci]), fill=255); ci += 1
            il = Image.new('RGBA', base.size, (0, 0, 0, 0)); di = ImageDraw.Draw(il); di.polygon(P, fill=(35, 30, 28, 215)); di.line(P, fill=(15, 15, 15, 255), width=lw(1.3))
            ov.alpha_composite(Image.composite(il, Image.new('RGBA', base.size, (0, 0, 0, 0)), m)); continue
        if 'cut' in c:
            cuts.append(P); continue
        if 'lm' in c:
            if e['a'].get('stroke-dasharray') and len(P) != 5: continue        # straight chords across the face: dropped
            d.line(P, fill=LOOM + (150,), width=lw(1)); continue
    # side planes: only the one facing the camera on a turned view
    yaw = an['yaw']
    for i, P in enumerate(cuts):
        if abs(yaw) > 10 and i == (1 if yaw > 0 else 0): continue
        d.line(P, fill=CUT + (190,), width=lw(1.1))
    # plane edges and features, by role (straight between the displayed points: pins interpolate linearly)
    V = ex['V']
    def ok(k): return k in V and V[k][2]
    for ka, kb in ex['edges']:
        if not (ok(ka) and ok(kb)): continue
        P = T([V[ka][:2], V[kb][:2]]); col, w = role(ka, kb)
        d.line(P, fill=col, width=lw(w))
    out = base.convert('RGBA'); out.alpha_composite(ov)
    return out.convert('RGB').resize((W, H), Image.LANCZOS)

sheets = []
F0 = EX[0]['scale']
for ex, an in zip(EX, DATA['angles']):
    f = F0 / ex['scale']
    ud = render(ex, an, f); ud.save(O + f'ud-{ex["id"]}.png')
    ph = uri(an['photo']).resize(ud.size, Image.LANCZOS)
    sh = Image.new('RGB', (ud.width * 2 + 12, ud.height), 'white'); sh.paste(ph, (0, 0)); sh.paste(ud, (ud.width + 12, 0)); sh.save(O + f'ud-sheet-{ex["id"]}.png')
    print(ex['id'], 'scale factor', round(f, 3), ud.size)
