"""Front portrait pass 2: measured contours (tracer.py) plus the selection the Eminem reference shows:
features as words on the landmarks, nose and lip shadow as dots, dark hair as a bounded lock-stroke field,
occluding contours (jaw over neck, hair over forehead) kept as lines."""
import sys, json
import numpy as np, cv2
from PIL import Image, ImageDraw
import tracer as T
from aa import frame, FEATURES, adv

W, ROW = 612, T.ROW
import os
W = int(os.environ.get('PORTRAIT_W', 612))
SIZE = 'xs' if W <= 250 else 'small' if W <= 400 else 'medium' if W <= 700 else 'large'
# feature spellings per size: smaller sizes keep the read with fewer glyphs (identity first: eyes, brows, mouth)
VOC = {'xs':     dict(lid=None, eye='ｨ', brow=None, nose='.', mouth='‐', lip=None, under=None),
       'small':  dict(lid=None, eye="ｨfﾃ", brow='short', nose=': .', mouth='_,..-', lip=None, under=None),
       'medium': dict(lid='.::;;=＝=;;､', eye="ｨ''f,ﾜ'ｧ", brow='full', nose=":.':':'.:", mouth='_,,,､..---', lip='..,,..', under='`ー‐'),
       'large':  dict(lid='.::;;==＝==;;､', eye="ｨ''f,ﾞﾜ'ｧ", brow='full', nose=":.':':':'.:", mouth='_,,,､..-----', lip='..,,,..', under='`ーー‐')}[SIZE]
YAW = {1: 1.2, 7: 39.0, 10: 61.4, 28: -30.0}


def landmarks(n, box):
    _, lm, _ = frame(n); s = W / (box[2] - box[0])
    return lambda k: np.array(((lm[k][0] - box[0]) * s, (lm[k][1] - box[1]) * s))


def word(rows, x_center, y, text, prio=9):
    """Place a glyph word with its ink centred on x_center in the row containing y."""
    w = adv(text); r = int(y // ROW)
    rows.setdefault(r, []).append((x_center - w / 2, text, prio, x_center))


def hair_field(cut, fg, P, rows):
    """Dark hair as lock strokes following the hair's local direction, every other slot, staggered by row."""
    lum = cv2.cvtColor(cut, cv2.COLOR_BGR2GRAY).astype(np.float32)
    hair = ((lum < 80) & (fg > 0)).astype(np.uint8)
    hair = cv2.morphologyEx(cv2.morphologyEx(hair, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8)), cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))
    face = np.zeros((W, W), np.uint8); cv2.fillPoly(face, [np.int32([P(k) for k in FEATURES['oval']])], 1)
    hair[cv2.erode(face, np.ones((9, 9), np.uint8)) > 0] = 0      # locks may overlap the cheek edge
    inner = cv2.erode(hair, np.ones((5, 5), np.uint8))          # keep paper inside the hair edge
    g = cv2.GaussianBlur(lum, (0, 0), 2)
    gx, gy = cv2.Sobel(g, cv2.CV_32F, 1, 0), cv2.Sobel(g, cv2.CV_32F, 0, 1)
    jxx, jyy, jxy = [cv2.GaussianBlur(v, (0, 0), 9) for v in (gx * gx, gy * gy, gx * gy)]
    for r in range(W // ROW):
        y = r * ROW + ROW // 2
        for x in range(8 + (r % 2) * 11, W - 8, 26 if SIZE in ('medium', 'large') else 30):
            if not inner[y, x]: continue
            # only where strands actually show: an oriented texture (coherent structure tensor), not flat dark mass
            tr = jxx[y, x] + jyy[y, x]; det = jxx[y, x] * jyy[y, x] - jxy[y, x] ** 2
            coh = np.sqrt(max(tr * tr - 4 * det, 0)) / (tr + 1e-6)
            if coh < 0.45 or tr < 40: continue
            # strand direction is perpendicular to the dominant gradient
            ang = 0.5 * np.degrees(np.arctan2(2 * jxy[y, x], jxx[y, x] - jyy[y, x])) + 90
            a = ((ang + 90) % 180) - 90                        # -90..90, 0 = horizontal, + = rising to the right
            if abs(a) > 70: gl = 'ﾘ' if (r + x // 22) % 2 else 'ｌ'
            elif a > 35: gl = '/'
            elif a > 10: gl = 'ﾉ'
            elif a < -35: gl = 'ヽ'
            elif a < -10: gl = '､'
            else: gl = 'ｰ'
            rows.setdefault(r, []).append((x - adv(gl) / 2, gl, 1, x))
    return hair


def trace2(n, box):
    polys, iris, fg, cut = T.contours_for(n, box, W)
    P = landmarks(n, box)
    # features become words below; drop their contour polylines (prio 5..7 except brows)
    feat = [p for p in polys if p[0] in (5, 6, 7)]
    keep = [p for p in polys if p[0] not in (5, 6, 7)]
    rows = T.place(keep)
    yaw = json.load(open(f'{T.__file__.rsplit("/", 1)[0]}/../../../../../../Users/rikihernandez/trueff-shallot/.run/face-capture/face-riki-scan/drawloom/{n:04d}/pose.json'))['angles']['yaw'] if False else YAW.get(n, 0)
    # brows: one weighted run each, thick end at the inner brow, taper at the tail (actorWW[57] ｲ_ﾆ≧ヾ, musician[390] .::;;=＝=)
    for idx, inner_left in (((FEATURES['browL'], False), (FEATURES['browR'], True)) if VOC['brow'] else ()):
        pts = np.array([P(k) for k in idx]); x0, x1 = pts[:, 0].min(), pts[:, 0].max(); y = pts[:, 1].mean()
        n_eq = max(1, int((x1 - x0 - 24) / adv('='))) if VOC['brow'] == 'full' else 1
        w = (',ｨ' + 'ﾆ' * max(1, n_eq // 2) + '=' * (n_eq - n_eq // 2) + 'ヽ') if not inner_left else (',ｨ' + '=' * (n_eq - n_eq // 2) + 'ﾆ' * max(1, n_eq // 2) + 'ヽ')
        word(rows, (x0 + x1) / 2, y, w, prio=8)
    # eyes: upper lid run spanning the eye corners, eye word on the iris
    for (o, i), iris_k, heavy in [((33, 133), 468, False), ((362, 263), 473, True)]:
        a, b, c = P(o), P(i), P(iris_k)
        if abs(b[0] - a[0]) < 18: continue          # the far eye at a strong turn: lid only would crowd; drawn by contour
        if YAW.get(n, 0) > 30 and iris_k == 468: heavy = True
        r_eye = int(c[1] // ROW)                       # the iris row carries the eye word, the row above the lid
        if YAW.get(n, 0) > 50:                         # profile eye (musician[6] '(〇`>', history[312] '<ｶ'>')
            word(rows, c[0] + 4 * W / 612, r_eye * ROW + ROW / 2, "ﾞ<ﾂ" if SIZE in ('medium', 'large') else '<', prio=8); continue
        if VOC['lid']: word(rows, (a[0] + b[0]) / 2, (r_eye - 1) * ROW + ROW / 2, VOC['lid'] if not heavy else ',' + VOC['lid'][1:])
        word(rows, c[0], r_eye * ROW + ROW / 2, VOC['eye'])
    # nose: shadowed tip as a dot cluster, nostrils as dots, one shadow-side stroke on the darker side
    tip, base = P(4), P(2)
    if YAW.get(n, 0) <= 50: word(rows, tip[0] - 10 * W / 612, tip[1] + 2, VOC['nose'], prio=8)
    if SIZE in ('medium', 'large'): word(rows, P(98)[0], base[1], '，.', prio=8); word(rows, P(327)[0], base[1], '・', prio=8)
    lum = cv2.cvtColor(cut, cv2.COLOR_BGR2GRAY)
    left, right = P(129), P(358)
    darker = None if SIZE == 'xs' else left if lum[int(left[1]), int(left[0])] < lum[int(right[1]), int(right[0])] else right
    if darker is not None: word(rows, darker[0], darker[1] - 10 * W / 612, 'ﾉ' if darker is left else 'ヽ', prio=8)
    # mouth: upper lip as dots, mouth line heavier toward the shadowed corner, lower lip shadow short run
    m0, m1 = P(61), P(291)
    if YAW.get(n, 0) > 50:
        word(rows, min(m0[0], m1[0]) + 6, P(13)[1], '‐-', prio=8)
    else:
        if VOC['lip']: word(rows, (m0[0] + m1[0]) / 2, P(0)[1] + 2, VOC['lip'], prio=8)
        word(rows, (m0[0] + m1[0]) / 2, P(13)[1], VOC['mouth'], prio=8)
        if VOC['under']: word(rows, P(17)[0], P(17)[1] + 6, VOC['under'], prio=7)
    # chin over neck: a short occluding run under the chin
    if SIZE != 'xs': word(rows, P(152)[0], P(152)[1] + 10 * W / 612, '､__,', prio=6)
    hair_field(cut, fg, P, rows)
    text = '\n'.join(T.resolve(rows.get(i, [])) for i in range(W // ROW))
    return text, keep + feat, cut


if __name__ == '__main__':
    n = int(sys.argv[1]); box = tuple(json.loads(sys.argv[2]))
    text, polys, cut = trace2(n, box)
    open(f'local/trace2-{n:04d}-{SIZE}.txt', 'w').write(text); open(f'local/trace2-{n:04d}.txt', 'w').write(text)
    print('law:', T.check(text) or 'ok')
    rgb = Image.fromarray(cv2.cvtColor(cut, cv2.COLOR_BGR2RGB))
    ov = Image.blend(rgb, Image.new('RGB', rgb.size, 'white'), 0.5)
    ov = T.render(text, (W, W), ov, (220, 0, 0)); clean = T.render(text, (W, W))
    S = Image.new('RGB', (W * 3 + 20, W), 'white'); S.paste(rgb, (0, 0)); S.paste(ov, (W + 10, 0)); S.paste(clean, (2 * W + 20, 0))
    S.save(f'local/trace2-{n:04d}-{SIZE}.png')
