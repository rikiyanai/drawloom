"""Fork A: three-quarter (0007) from the planes. Frame = ud-0007 (517x624, head at the front's scale, 17 px rows).
Layers (priority high -> low): features (hand-spelled from the plane edges), contours (runs along plane/silhouette edges),
tone (bounded fields clipped to plane polygons / hair mass)."""
import sys, math, numpy as np
from PIL import Image, ImageDraw
from aa import adv
import planes2aa as Q
from angle_tool import out
P = 17
V, FACES = Q.scene('0007')
v = lambda k: V[k][:2]

# ---------------- helpers ----------------
def run_line(pts, w=1, light=False):
    """Spell a polyline as per-row runs: shift per row decides vertical / half slash / full slash / flat stair."""
    items = []
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if y1 < y0: (x0, y0), (x1, y1) = (x1, y1), (x0, y0)
        dy = y1 - y0
        for r in range(int(y0 // P), int(math.ceil(y1 / P))):
            ya, yb = max(y0, r * P), min(y1, (r + 1) * P)
            if yb - ya < 3 and dy > 3: continue
            if dy < 1e-6: xa, xb = x0, x1
            else: xa, xb = x0 + (x1 - x0) * (ya - y0) / dy, x0 + (x1 - x0) * (yb - y0) / dy
            s = (xb - xa) * P / max(yb - ya, 1e-6)      # px shift per full row
            fr = ((ya + yb) / 2 - r * P) / P
            lo, hi = min(xa, xb), max(xa, xb)
            if abs(s) <= 3.5:   g = 'i' if light else '|'; items.append((r, (lo + hi) / 2 - adv(g) / 2, g))
            elif abs(s) <= 11:  g = ('ヽ' if s > 0 else '/'); items.append((r, (lo + hi) / 2 - adv(g) / 2, g))
            elif abs(s) <= 22:  g = ('＼' if s > 0 else '／'); items.append((r, (lo + hi) / 2 - adv(g) / 2, g))
            else:
                if hi - lo < 6: continue
                g = ("'" if light else '￣') if fr < 0.3 else ('-' if light else '‐') if fr < 0.62 else ('_' if light else '＿')
                if not light and hi - lo < 16: g = {'￣': '¨', '‐': '-', '＿': '_'}[g]
                n = max(1, round((hi - lo) / adv(g))); items.append((r, lo, g * n))
    return items

def poly_spans(poly, y):
    xs = []
    for (x0, y0), (x1, y1) in zip(poly, poly[1:] + poly[:1]):
        if (y0 <= y < y1) or (y1 <= y < y0): xs.append(x0 + (y - y0) * (x1 - x0) / (y1 - y0))
    xs.sort(); return list(zip(xs[0::2], xs[1::2]))

def tone(poly, g, step, rows=None, inset=3, phase=5):
    """Bounded field: glyph g on a shared lattice (x = step*j + row stagger) inside poly, sampled at row centre."""
    items = []
    ys = [p[1] for p in poly]
    for r in range(int(min(ys) // P), int(max(ys) // P) + 1):
        if rows and r not in rows: continue
        for xa, xb in poly_spans(poly, r * P + P * 0.5):
            off = (r * phase) % step
            x = math.ceil((xa + inset - off) / step) * step + off
            while x + adv(g) < xb - inset:
                items.append((r, x, g)); x += step
    return items

def face_poly(ks): return [v(k) for k in ks]

def compose(layers):
    """layers: list of item lists, highest priority first. An item is dropped where it overlaps (+2 px) ink from an EARLIER layer;
    items of one layer never knock each other out."""
    R = {}
    for items in layers:
        add = {}
        for r, x, g in items:
            occ = R.get(r, [])
            a, b = x, x + adv(g)
            if any(a < q + adv(h) + 2 and q - 2 < b for q, h in occ): continue
            add.setdefault(r, []).append((x, g))
        for r, l in add.items(): R.setdefault(r, []).extend(l)
    return R

# ---------------- hair ----------------
# silhouette (outer) and hairline (inner) from the photo / notan mask spans, image coords
HAIR = [(240, 46), (275, 39), (322, 41), (362, 48), (392, 58), (414, 72), (428, 98), (436, 132), (440, 168), (436, 186),
        (428, 176), (420, 150), (408, 118), (392, 100), (360, 92), (300, 90), (262, 94), (248, 105), (236, 125), (230, 150),
        (228, 200), (226, 240), (222, 262), (205, 272), (180, 276), (162, 284), (158, 310), (162, 340), (166, 352),
        (190, 356), (214, 352), (222, 372), (220, 410), (212, 432), (196, 440), (176, 432), (150, 418), (134, 400),
        (138, 375), (150, 352), (142, 330), (136, 290), (130, 250), (130, 215), (136, 185), (146, 160), (160, 135),
        (180, 108), (205, 82), (225, 60)]
OUT_TOP = [(225, 60), (240, 46), (275, 39), (322, 41), (362, 48), (392, 58), (414, 72), (428, 98), (436, 132), (440, 168), (438, 186)]
OUT_LEFT = [(225, 60), (205, 82), (180, 108), (160, 135), (146, 160), (136, 185), (130, 215), (130, 250), (136, 290), (142, 330), (150, 352)]
BUN = [(150, 352), (138, 375), (134, 400), (150, 418), (176, 432), (196, 440), (212, 432), (220, 410), (222, 372), (214, 352)]
INNER = [(428, 176), (420, 150), (408, 118), (392, 100), (360, 92), (300, 90), (262, 94), (248, 105), (236, 125), (230, 150), (228, 200), (226, 240), (222, 262)]
def flow(x, y):
    if y > 345:   # bun: strands gathered into the knot
        return 'ﾉ'
    if x > 380: return 'ヽ' if y < 150 else '|'
    return '/'

def flow_old(x, y):
    """Strand direction of the hair at (x, y): crown sweeps back-down-left, the front strip falls down-right along the far temple,
    the near side hangs down to the bun, the bun turns."""
    if y > 350: return 'ﾐ' if (x // 16 + y // 17) % 2 else '彡'
    if x > 380: return 'ヽ' if y < 150 else '|'
    if y < 120: return '/'
    if y < 230: return '/' if x < 200 else 'ﾉ'
    return '|'
def hair_items(field=':', step=14):
    items = []
    for r in range(1, 27):
        y = r * P + P * 0.5
        for xa, xb in poly_spans(HAIR, y):
            x = xa + 3; k = 0
            off = (r * 5) % step
            while x < xb - 4:
                lx = math.ceil((x - off) / step) * step + off
                g = flow(lx, y)
                if lx + adv(g) > xb - 3: break
                n = int((lx - x - 1) // adv(field))
                if n > 0: items.append((r, x, field * n))
                items.append((r, lx, g)); x = lx + adv(g) + 1
            n = int((xb - 4 - x) // adv(field))
            if n > 0: items.append((r, x, field * n))
    return items

# ---------------- contours ----------------
def contours():
    it = []
    # hair outer silhouette cap (light line on top only; the field carries the rest)
    it += [(2, 236, ",.-‐''￣￣￣''‐-.,")]
    it += run_line(OUT_TOP[5:]) + run_line(OUT_LEFT[1:]) + run_line(BUN) + run_line(INNER, light=True)
    # far face contour: forehead under the hair strip, far brow ridge, far cheekbone
    it += run_line([(440, 186), (446, 214), (447, 238), (444, 254)])
    # nose: far silhouette bridge -> tip -> under tip
    it += run_line([(412, 214), (424, 240), (436, 262), (444, 276)])
    # upper lip and chin silhouette (front profile)
    it += run_line([(432, 306), (438, 322), (443, 336)])
    it += run_line([(441, 352), (430, 366)])
    it += run_line([(431, 372), (437, 392), (436, 410), (420, 424)])
    # jaw: ear lobe -> jaw angle -> chin bottom
    it += run_line([(228, 362), (252, 384), (280, 405)])
    it += [(23, 280, "｀ヽ､"), (24, 300, "｀ｰ-､_"), (24, 352, "＿_,.-‐'")]
    # neck
    it += run_line([(214, 434), (208, 458)])
    it += run_line([(398, 430), (388, 470)])
    return it

# ---------------- features ----------------
def features(eye='A'):
    f = []
    # near brow: thick, straight, heavy at the inner end, tail dropping at the outer end (brL0..brL2, plane edge brow/socket)
    f += [(11, 300, "ｨ=ﾆ三三ﾆ=-､")]
    f += [(12, 293, ",'")]
    # far brow
    f += [(11, 404, "ｨﾆ=､")]
    if eye == 'A':   # near eye: upper lid from outer corner rising to the top then dropping to the inner corner, iris hanging
        f += [(13, 309, ",ｨ'ﾞﾆf,ﾜ'ｧ､")]
        f += [(14, 320, "｀ー-'")]
        f += [(13, 408, "{ ｨ''ﾃ'ｧ")]
    # nose: wing, nostril, tip underside (plane edges nsL-wL0-wL1-sub-tip3/tip2)
    f += [(16, 380, "(")]
    f += [(17, 382, "ゝ､_ﾉ`ｰ'")]
    # mouth: male lips - parting from the corner to the front, short mark above, short line under the lower lip
    f += [(19, 418, "ー")]
    f += [(20, 376, "-‐ｰ=‐-､")]
    f += [(21, 404, "ー")]
    # ear: rim, inner fold, lobe
    f += [(15, 202, "/⌒ヽ")]
    f += [(16, 196, "{"), (16, 214, "{ ⌒")]
    f += [(17, 198, "|"), (17, 216, "|"), (17, 236, "}")]
    f += [(18, 200, "ヽ"), (18, 216, "ヽ ﾉ")]
    f += [(19, 208, "ヽ_ﾉ")]
    return f

# ---------------- shirt (refit from a0007) ----------------
def shirt():
    import a0007
    keep = {}
    for r in range(25, 37):
        for x, g in a0007.R.get(r, []): keep.setdefault(r, []).append((x, g))
    return [(r, x, g) for r, l in keep.items() for x, g in l if not (r <= 27 and 200 < x < 400)]

SKIP_PLANE = lambda ks: any(k.startswith(('eL', 'eR', 'tip', 'wL', 'wR', 'lp', 'pt', 'ft', 'fe', 'sk', 'tr', 'ts')) for k in ks)
PAT = {1: ('.', 20), 2: ('.', 11), 3: (':', 9)}
def in_poly(poly, x, y):
    return any(a <= x <= b for a, b in poly_spans(poly, y))
def plane_tone():
    """Shadow shapes taken from the planes that turn away from the key light (bounded by their plane edges):
    under the jaw (densest), the far eye socket, under the nose, under the lower lip, the far side of the chin."""
    t = []
    t += tone([(250, 388), (280, 408), (330, 421), (385, 433), (402, 430), (398, 446), (330, 447), (262, 430), (232, 404)], ':', 9)
    t += tone([(338, 447), (384, 447), (380, 472), (342, 470)], '.', 12)
    t += tone(face_poly(['soRlo', 'soRo', 'ckR']), ':', 8)
    t += tone(face_poly(['llL', 'll0', 'llR', 'ml1', 'ml0']), '.', 9, phase=3)
    t += tone(face_poly(['ml1', 'chR', 'cbR']), '.', 9, phase=3)
    t += tone(face_poly(['sub', 'wR1', 'wR0', 'nsR', 'nlR', 'mcR', 'lpR', 'lp0']), '.', 11)
    return t
def tone_layer(): return plane_tone()

def build(variant='A', name='forkA-1'):
    R = compose([features(variant), contours(), shirt(), tone_layer(), hair_items()])
    return out(R, '0007', name, 37)

if __name__ == '__main__':
    build(*sys.argv[1:])
