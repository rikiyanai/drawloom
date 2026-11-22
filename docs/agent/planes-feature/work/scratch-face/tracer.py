"""Contour-true glyph tracing for one capture frame.
Contours are measured, not drawn by eye: person silhouette (cut-out), hair mass edge (dark pixels in the cut-out),
jaw/cheek and features from the MediaPipe landmarks, neck/collar/ears from the manga line image. Each contour is
split into row bands (18 px rows, Saitamaar 16 px); each band piece gets a glyph by its angle and in-row height, placed
so the glyph's own ink centre sits on the contour. Then fit is measured: contour coverage and ink precision."""
import json, sys
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont
from aa import frame, FEATURES, adv, spaces_for, check, FONT

F = ImageFont.truetype(FONT, 16); ROW = 18

_ink = {}
def ink(g):
    if g not in _ink:
        w = max(1, int(adv(g))) + 4; im = Image.new('L', (w, ROW), 0); ImageDraw.Draw(im).text((0, 0), g, font=F, fill=255)
        a = np.asarray(im) > 80; cols = np.where(a.any(0))[0]; rows = np.where(a.any(1))[0]
        _ink[g] = ((cols.min() + cols.max()) / 2 if len(cols) else adv(g) / 2, (rows.min() + rows.max()) / 2 if len(rows) else 9)
    return _ink[g]

_alt = {}
def pick(dx, dy, ymid, curv, key=None, prio=0):
    """dx,dy: piece direction (screen, y down); ymid: piece centre height inside its row (0..ROW)."""
    ang = np.degrees(np.arctan2(abs(dy), abs(dx) + 1e-6))
    down_right = (dx * dy) > 0
    if prio >= 5:
        heavy = prio in (6, 7)
        if ang < 22:
            if ymid < 6: return 'ﾆ' if heavy else '￣'
            if ymid < 12: return '=' if heavy else 'ｰ'
            return '_'
        if ang < 45: return '`' if down_right else '´'
        if ang < 75: return 'ヽ' if down_right else 'ﾉ'
        return 'i'
    if ang < 22:
        if ymid < 6: return '￣'
        if ymid < 12: return 'ｰ'
        return '_'
    if ang < 40: return 'ヽ' if down_right else 'ノ'
    if ang < 68: return '＼' if down_right else '／'
    if ang < 80: return 'ヽ' if down_right else 'ﾉ' if False else ('ﾍ' if False else ('l' if down_right else 'ｌ'))
    if abs(curv) > 0.05: return '{' if curv > 0 else '}'
    n = _alt.get(key, 0); _alt[key] = n + 1
    return ('i', 'l', '|')[n % 3]

def resample(pts, step=1.5):
    pts = np.asarray(pts, float)
    if len(pts) < 2: return pts
    seg = np.r_[0, np.cumsum(np.hypot(*np.diff(pts, axis=0).T))]
    t = np.arange(0, seg[-1], step)
    return np.c_[np.interp(t, seg, pts[:, 0]), np.interp(t, seg, pts[:, 1])]

def run_glyphs(x0, x1, ymid, down_right, prio, enter_up=False, leave_up=False, enter_down=False, leave_down=False):
    """Glyphs that cover [x0, x1] continuously inside one row: the run is spelled across its whole width, so a
    shallow line reads as one stroke, not dashes. Returns [(pen, glyph)]."""
    width = x1 - x0
    if ymid < 6: unit = '￣'
    elif ymid < 12: unit = '=' if prio in (6, 7) else 'ｰ'
    else: unit = '_'
    # turned ends where the curve leaves the row: a bowl bottom `ー--´, a cap top ,..､
    pre = ('`' if enter_up else '') if unit != '￣' else (',' if enter_down else '')
    suf = ('´' if leave_up else '') if unit != '￣' else ('､' if leave_down else '')
    inner = width - adv(pre) - adv(suf)
    n = max(1, int(round(inner / adv(unit))))
    return [(x0 + (width - n * adv(unit) - adv(pre) - adv(suf)) / 2, pre + unit * n + suf)]


def place(polys):
    """polys: list of (priority, polyline). Per row band, each contour crossing becomes one run:
    steep crossings one glyph by angle/curvature, shallow crossings a continuous run across their width,
    with the end glyphs turning into the neighbouring rows. Returns per-row items [(pen_x, glyph, prio, x)]."""
    rows = {}
    for prio, poly in polys:
        p = resample(poly)
        if len(p) < 4: continue
        r = (p[:, 1] // ROW).astype(int)
        i = 0
        while i < len(p):
            j = i
            while j + 1 < len(p) and r[j + 1] == r[i]: j += 1
            seg = p[i:j + 1]; row = r[i]
            xs = seg[:, 0]; x0, x1 = xs.min(), xs.max(); width = x1 - x0
            dx, dy = seg[-1] - seg[0]
            ymid = seg[:, 1].mean() - row * ROW
            k0, k1 = max(0, i - 8), min(len(p) - 1, j + 8)
            v0, v1 = p[i] - p[k0], p[k1] - p[j]
            curv = (np.cross(v0, v1) / (np.hypot(*v0) * np.hypot(*v1) + 1e-6)) if k0 < i and k1 > j else 0
            if width < 9:
                g = pick(dx if abs(dx) > 0.5 else (p[k1] - p[k0])[0], dy if abs(dy) > 0.5 else (p[k1] - p[k0])[1],
                         ymid, curv, (id(poly), int(xs.mean() // 40)), prio)
                cx, _ = ink(g); rows.setdefault(row, []).append((xs.mean() - cx, g, prio, xs.mean()))
            else:
                ang = np.degrees(np.arctan2(abs(dy), width + 1e-6)); down_right = dx * dy > 0
                if ang < 25 or width > 30:
                    # which neighbouring rows the curve comes from and goes to, at the run's left and right ends
                    left_i, right_i = (i, j) if seg[0, 0] <= seg[-1, 0] else (j, i)
                    def side(k, step):
                        kk = min(max(k + step, 0), len(p) - 1); return r[kk] - row
                    lr = side(left_i, -8 if left_i == i else 8); rr = side(right_i, 8 if right_i == j else -8)
                    for pen, g in run_glyphs(x0, x1, ymid, down_right, prio, enter_up=lr < 0, leave_up=rr < 0,
                                             enter_down=lr > 0, leave_down=rr > 0):
                        rows.setdefault(row, []).append((pen, g, prio, (x0 + x1) / 2))
                else:   # a diagonal crossing one row: one slant glyph per 16 px of width
                    unit = ('＼' if ang > 45 else 'ヽ') if down_right else ('／' if ang > 45 else 'ノ')
                    n = max(1, int(round(width / adv(unit))))
                    rows.setdefault(row, []).append((x0 + (width - n * adv(unit)) / 2, unit * n, prio, (x0 + x1) / 2))
            i = j + 1
    return rows

def merge(items):
    out = []; H = ('￣', 'ｰ', '_', '=', 'ﾆ')
    for it in sorted(items, key=lambda t: t[0]):
        if out and it[1] in H and out[-1][1][-1:] == it[1] and it[2] == out[-1][2] and it[0] - (out[-1][0] + adv(out[-1][1])) < 6:
            pen, g, prio, cx = out[-1]; n = max(1, round((it[0] + adv(it[1]) - pen) / adv(it[1])))
            out[-1] = (pen, it[1] * n, prio, cx)
        else: out.append(it)
    return out

def resolve(items):
    items = merge(items)
    """Drop overlaps (higher priority first) and lay the row out at measured x."""
    kept = []
    for pen, g, prio, cx in sorted(items, key=lambda t: (-t[2], t[0])):
        w = adv(g)
        if any(not (pen + w <= k[0] - 1 or pen >= k[0] + adv(k[1]) + 1) for k in kept): continue
        if pen < 0: continue
        kept.append((pen, g, prio, cx))
    kept.sort()
    out, x = '', 0.0
    for pen, g, *_ in kept:
        gap = pen - x
        if gap > 0:
            sp = spaces_for(gap, out == ''); out += sp; x += adv(sp)
        out += g; x += adv(g)
    return out

def render(text, size, under=None, color=(0, 0, 0)):
    im = under.copy() if under is not None else Image.new('RGB', size, 'white'); d = ImageDraw.Draw(im)
    for i, r in enumerate(text.split('\n')): d.text((0, i * ROW), r, font=F, fill=color)
    return im

def contours_for(n, box, W):
    photo, lm, _ = frame(n); s = W / (box[2] - box[0])
    P = lambda k: ((lm[k][0] - box[0]) * s, (lm[k][1] - box[1]) * s)
    cut = cv2.resize(cv2.imread(f'local/all/riki-{n:04d}-cutout.png' if n != 1 else 'local/riki-0001-cutout.png'), (W, W))
    lines = cv2.resize(cv2.imread(f'local/all/riki-{n:04d}-lines.png' if n != 1 else 'local/riki-0001-lines.png', 0), (W, W))
    fg = (np.abs(cut.astype(int) - 255).sum(2) > 40).astype(np.uint8)
    fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    lum = cv2.cvtColor(cut, cv2.COLOR_BGR2GRAY)
    hair = ((lum < 80) & (fg > 0)).astype(np.uint8)
    hair = cv2.morphologyEx(cv2.morphologyEx(hair, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8)), cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))
    polys = []
    def add(prio, mask, min_len=60):
        cs, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        for c in cs:
            c = c[:, 0, :].astype(float)
            if len(c) < min_len: continue
            # drop parts on the image border (crop edges are not contours)
            keep = (c[:, 0] > 2) & (c[:, 0] < W - 3) & (c[:, 1] > 2) & (c[:, 1] < W - 3)
            for seg in np.split(c, np.where(~keep)[0]):
                seg = seg[(seg[:, 0] > 2) & (seg[:, 0] < W - 3) & (seg[:, 1] > 2) & (seg[:, 1] < W - 3)]
                if len(seg) > 20: polys.append((prio, cv2.GaussianBlur(seg.reshape(-1, 1, 2), (1, 9), 0).reshape(-1, 2)))
    n_, lab, st, _ = cv2.connectedComponentsWithStats(hair)
    hair = np.isin(lab, [k for k in range(1, n_) if st[k, cv2.CC_STAT_AREA] > 4000]).astype(np.uint8)
    add(9, fg)                      # silhouette: hair top, ears, face profile, shoulders (outranks feature words)
    face = np.zeros((W, W), np.uint8); cv2.fillPoly(face, [np.int32([P(k) for k in FEATURES['oval']])], 1)
    face = cv2.erode(face, np.ones((25, 25), np.uint8))
    hair[face > 0] = 0
    add(3, hair, 120)               # hair mass edge: hairline, locks over cheeks
    ov = FEATURES['oval']; i0, i1 = ov.index(454), len(ov)
    jaw = [P(k) for k in ov[ov.index(454):ov.index(234) + 1]]
    polys.append((4, np.array(jaw)))
    for name, prio in [('browL', 6), ('browR', 6), ('eyeL_up', 7), ('eyeR_up', 7), ('eyeL_lo', 5), ('eyeR_lo', 5),
                       ('lipU', 6), ('lipM', 7), ('lipL', 5)]:
        polys.append((prio, np.array([P(k) for k in FEATURES[name]])))
    polys.append((6, np.array([P(k) for k in [129, 64, 98, 97, 2, 326, 327, 294, 358]])))
    chin_y = P(152)[1]
    ln = (lines < 170).astype(np.uint8); ln[: int(chin_y) - 10] = 0; ln &= fg
    n_, lab, st, _ = cv2.connectedComponentsWithStats(ln)
    ln = np.isin(lab, [k for k in range(1, n_) if max(st[k, cv2.CC_STAT_WIDTH], st[k, cv2.CC_STAT_HEIGHT]) > 60]).astype(np.uint8)
    add(1, cv2.dilate(ln, np.ones((3, 3), np.uint8)), 120)   # neck, collar, necklace below the chin
    iris = [(8, P(468)), (8, P(473))]
    return polys, iris, fg, cut

def trace(n, box, W=612):
    polys, iris, fg, cut = contours_for(n, box, W)
    rows = place(polys)
    for prio, (x, y) in iris:
        g = '●' if False else '◯'
        g = '弋'
        rows.setdefault(int(y // ROW), []).append((x - ink(g)[0], g, prio, x))
    nrows = W // ROW
    text = '\n'.join(resolve(rows.get(i, [])) for i in range(nrows))
    return text, polys, cut

def score(text, polys, W):
    im = np.asarray(render(text, (W, W)).convert('L')) < 128
    dist_to_ink = cv2.distanceTransform((~im).astype(np.uint8), cv2.DIST_L2, 3)
    cmask = np.zeros((W, W), np.uint8)
    for _, p in polys: cv2.polylines(cmask, [np.int32(resample(p)).reshape(-1, 1, 2)], False, 1, 1)
    dist_to_contour = cv2.distanceTransform((1 - cmask).astype(np.uint8), cv2.DIST_L2, 3)
    pts = np.concatenate([resample(p) for _, p in polys]).astype(int); pts = pts[(pts[:, 0] < W) & (pts[:, 1] < W) & (pts.min(1) >= 0)]
    cov = float((dist_to_ink[pts[:, 1], pts[:, 0]] <= 5).mean())
    prec = float((dist_to_contour[im] <= 5).mean()) if im.any() else 0
    return cov, prec, cmask

if __name__ == '__main__':
    n = int(sys.argv[1]); box = tuple(json.loads(sys.argv[2])); W = 612
    text, polys, cut = trace(n, box, W)
    open(f'local/trace-{n:04d}.txt', 'w').write(text)
    cov, prec, cmask = score(text, polys, W)
    print('law:', check(text) or 'ok', f'coverage {cov:.2f}  precision {prec:.2f}')
    under = Image.fromarray(cv2.cvtColor(cut, cv2.COLOR_BGR2RGB)); under = Image.blend(under, Image.new('RGB', under.size, 'white'), 0.5)
    ov = under.copy(); d = ImageDraw.Draw(ov)
    for _, p in polys: d.line([tuple(q) for q in resample(p)], fill=(0, 170, 0), width=1)
    ov = render(text, (W, W), ov, (220, 0, 0))
    clean = render(text, (W, W))
    S = Image.new('RGB', (W * 3 + 20, W), 'white'); S.paste(Image.fromarray(cv2.cvtColor(cut, cv2.COLOR_BGR2RGB)), (0, 0)); S.paste(ov, (W + 10, 0)); S.paste(clean, (2 * W + 20, 0))
    S.save(f'local/trace-{n:04d}.png')


def gaps(text, polys, W, tol=5):
    """Continuity check: per contour, share of its length farther than tol px from ink, and its longest uncovered run."""
    im = np.asarray(render(text, (W, W)).convert('L')) < 128
    d = cv2.distanceTransform((~im).astype(np.uint8), cv2.DIST_L2, 3)
    worst, total, miss = [], 0, 0
    for prio, p in polys:
        q = resample(p).astype(int); q = q[(q[:, 0] >= 0) & (q[:, 0] < W) & (q[:, 1] >= 0) & (q[:, 1] < W)]
        if len(q) < 10: continue
        off = d[q[:, 1], q[:, 0]] > tol
        run = best = 0
        for o in off:
            run = run + 1 if o else 0; best = max(best, run)
        total += len(q); miss += off.sum(); worst.append((best * 1.5, prio))
    worst.sort(reverse=True)
    return miss / max(total, 1), worst[:5]
