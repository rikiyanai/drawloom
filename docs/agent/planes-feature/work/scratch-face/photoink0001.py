"""Capture 0001, front: line drawing taken from the photo's own edges (XDoG ink at 2x, so each feature keeps its real
shape), plus the figure silhouette; then a cel pass: edge-preserving smoothing, flat value planes quantized from the
photo (hair/brows darkest, shadow plane, core shadow, paper)."""
import sys
import numpy as np, cv2
from PIL import Image

W, H, S2 = 612, 558, 2
SIG, K, TAU, EPS, PHI = [float(v) for v in (sys.argv[1:6] if len(sys.argv) > 5 else (1.1, 1.6, 0.985, 0.0, 120))]


def load():
    ph = Image.open('local/riki-0001-cutout.png').convert('RGB').resize((W * S2, W * S2), Image.LANCZOS).crop((0, 0, W * S2, H * S2))
    a = np.array(ph).astype(np.float32)
    fig = cv2.morphologyEx((a.min(2) < 236).astype(np.uint8), cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))
    return ph, a, fig


def xdog(lum):
    g1 = cv2.GaussianBlur(lum, (0, 0), SIG * S2); g2 = cv2.GaussianBlur(lum, (0, 0), SIG * K * S2)
    d = (g1 - TAU * g2) / 255.0
    e = np.where(d >= EPS, 1.0, 1.0 + np.tanh(PHI * (d - EPS)))
    return np.clip(e, 0, 1)


def hair_mask():
    from linedraw0001 import HAIR_OUT, HAIRLINE, spline
    pts = HAIR_OUT + [(417, 258)] + HAIRLINE[::-1]
    m = np.zeros((H * S2, W * S2), np.uint8)
    cv2.fillPoly(m, [np.int32(spline(pts + [pts[0]], 8) * S2)], 1)
    return m


def ink():
    ph, a, fig = load()
    lum = cv2.bilateralFilter(a.mean(2), 9, 30, 5)
    e = xdog(lum)
    inner = cv2.erode(fig, np.ones((5 * S2, 5 * S2), np.uint8))
    e[inner == 0] = 1.0                                                 # cutout halo would double the outline
    sil = cv2.morphologyEx(fig, cv2.MORPH_GRADIENT, np.ones((2 * S2 + 1, 2 * S2 + 1), np.uint8))
    e = np.minimum(e, 1 - sil)                                          # one silhouette contour
    hair = hair_mask()
    hi = cv2.erode(hair, np.ones((4 * S2, 4 * S2), np.uint8)) > 0
    e[hi] = np.where(e[hi] < .15, e[hi], 1.0)                           # hair interior: only the strongest strands
    m = (e < .5).astype(np.uint8)                                       # drop specks
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, connectivity=8)
    small = np.isin(lab, [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] < 18 * S2])
    e[small] = 1.0
    return Image.fromarray((e * 255).astype(np.uint8)).resize((W, H), Image.LANCZOS), a, fig


def cel(a, fig):
    sm = a.copy()
    for _ in range(4): sm = cv2.bilateralFilter(sm, 9, 24, 7)
    lum = cv2.GaussianBlur(sm.mean(2), (0, 0), 2.0 * S2)
    out = np.full(lum.shape, 255, np.float32)
    out[(lum < 168) & (fig > 0)] = 205
    out[(lum < 118) & (fig > 0)] = 150
    hair = hair_mask() > 0
    out[(lum < 62) & (fig > 0) & hair] = 45                           # hair mass
    out[(lum < 48) & (fig > 0) & ~hair] = 45                           # pupils, brows, nostrils, lip parting only
    out = cv2.medianBlur(out.astype(np.uint8), 2 * 4 * S2 + 1)       # flat planes, no texture
    return Image.fromarray(out).resize((W, H), Image.LANCZOS)


if __name__ == '__main__':
    L, a, fig = ink()
    C = cel(a, fig)
    tag = sys.argv[6] if len(sys.argv) > 6 else ''
    L.save(f'local/ink-0001{tag}.png')
    shaded = Image.fromarray(np.minimum(np.array(C), np.array(L)))
    shaded.save(f'local/inkcel-0001{tag}.png')
    ph = Image.open('local/riki-0001-cutout.png').convert('RGB').resize((W, W), Image.LANCZOS).crop((0, 0, W, H))
    S = Image.new('RGB', (W * 3 + 20, H), 'white')
    S.paste(ph, (0, 0)); S.paste(L.convert('RGB'), (W + 10, 0)); S.paste(shaded.convert('RGB'), (2 * W + 20, 0))
    S.save(f'local/ink-cel-0001{tag}.png'); print('ok')
