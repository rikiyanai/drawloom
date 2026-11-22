"""Capture 0001, front: line drawing traced on the 612 px photo (coordinates read off gridded zooms + landmark mesh),
then an anime cel pass (flat value planes) under the same lines. Strokes carry a weight profile (w0 -> w1 along the
stroke) so the weight hierarchy is in the drawing: hair/brows/lids darkest, mouth parting + shadow-side jaw next,
lit side thin and broken."""
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFilter

W, H, Z = 612, 558, 4                       # page px (31 rows x 18), supersample


def spline(pts, n=24):
    p = np.array(pts, float)
    if len(p) < 3: return p
    p = np.vstack([p[0], p, p[-1]]); out = []
    for i in range(1, len(p) - 2):
        p0, p1, p2, p3 = p[i - 1], p[i], p[i + 1], p[i + 2]
        for t in np.linspace(0, 1, n, endpoint=False):
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(p[-2]); return np.array(out)


def stroke(d, pts, w0, w1=None, wm=None, gaps=()):
    """Tapered stroke: width w0 at start, wm at middle (optional), w1 at end. gaps = (t0,t1) ranges left unpainted."""
    w1 = w0 if w1 is None else w1
    c = spline(pts); L = np.r_[0, np.cumsum(np.hypot(*np.diff(c, axis=0).T))]; L /= max(L[-1], 1e-6)
    for (x, y), t in zip(c, L):
        if any(a <= t <= b for a, b in gaps): continue
        w = (w0 + (wm - w0) * t * 2 if t < .5 else wm + (w1 - wm) * (t - .5) * 2) if wm is not None else w0 + (w1 - w0) * t
        r = max(w, .35) * Z / 2
        d.ellipse([x * Z - r, y * Z - r, x * Z + r, y * Z + r], fill=0)


def fill(d, pts, v=0, smooth=True):
    c = spline(pts + [pts[0]]) if smooth else np.array(pts, float)
    d.polygon([(x * Z, y * Z) for x, y in c], fill=v)


# ---- traced geometry (612 px page) ----
HAIR_OUT = [(176, 278), (168, 250), (163, 200), (163, 152), (178, 122), (198, 104), (220, 84), (240, 68), (262, 60), (290, 56),
            (317, 55), (340, 60), (363, 72), (383, 87), (400, 103), (417, 123), (433, 150), (449, 182), (462, 210), (469, 236),
            (468, 270), (467, 296), (464, 318), (458, 336), (452, 322), (447, 334), (440, 318), (434, 328), (430, 306)]
FLY = [[(236, 72), (226, 62), (214, 58)], [(252, 62), (246, 52), (236, 46)], [(268, 58), (266, 49)]]
HAIRLINE = [(197, 252), (196, 214), (198, 182), (204, 150), (220, 118), (240, 107), (262, 103), (290, 105), (317, 111), (337, 123),
            (357, 141), (377, 163), (391, 181), (403, 200), (413, 218), (417, 258)]
# hanging locks on the right, ending in points behind the ear
LOCKS_R = [[(398, 120), (424, 168), (440, 214), (447, 262), (448, 300), (447, 334)],
           [(414, 150), (436, 200), (452, 250), (457, 300), (458, 336)],
           [(418, 200), (428, 240), (434, 290), (434, 328)],
           [(380, 96), (412, 150), (430, 214), (432, 262)]]
STRANDS = [[(296, 62), (334, 86), (366, 118), (392, 160), (406, 196)],           # fringe sweeping right
           [(318, 60), (356, 82), (390, 116), (416, 160)],
           [(276, 66), (300, 82), (330, 104), (352, 132)],
           [(262, 64), (232, 84), (210, 112), (196, 150)],                    # left side falling down
           [(246, 70), (210, 96), (186, 132), (176, 180), (174, 236)],
           [(230, 86), (204, 122), (190, 170), (186, 226), (184, 268)]]
EAR_L = [(184, 276), (181, 292), (183, 312), (187, 330), (192, 344), (198, 353), (206, 351)]
EAR_L_IN = [(191, 290), (194, 314), (199, 336)]
EAR_R = [(416, 262), (428, 262), (434, 276), (434, 300), (430, 321), (424, 336), (415, 343), (404, 344)]
EAR_R_IN = [(424, 282), (426, 304), (421, 324)]
JAW_L = [(204, 344), (206, 353), (213, 366), (221, 377), (229, 386), (236, 393)]          # ear -> jaw angle (lit side)
UNDER_L = [(236, 393), (252, 401), (270, 410), (286, 417), (302, 421)]                  # jaw underside over the neck
JAW_R = [(406, 344), (402, 356), (398, 368), (393, 380), (386, 390)]                      # shadow side
UNDER_R = [(386, 390), (371, 396), (356, 403), (341, 412), (328, 419)]
CHIN = [(296, 420), (306, 423), (316, 424), (326, 421), (334, 416)]
NECK_L = [(234, 396), (232, 418), (229, 434), (220, 445)]
NECK_R = [(388, 392), (394, 412), (398, 430), (412, 446)]
SHOULDER_L = [(218, 446), (190, 456), (150, 467), (110, 482), (68, 502), (36, 525), (14, 552)]
SHOULDER_R = [(414, 447), (442, 458), (480, 472), (520, 490), (556, 508), (590, 530), (610, 548)]
COLLAR_IN = [(222, 448), (227, 478), (243, 503), (272, 517), (300, 522), (340, 521), (369, 512), (389, 495), (399, 470), (403, 448)]
COLLAR_OUT = [(192, 458), (200, 498), (233, 529), (278, 553), (320, 558)]
COLLAR_OUT_R = [(320, 558), (360, 553), (400, 534), (430, 500), (444, 462)]
CORD_L = [(221, 440), (220, 480), (222, 520), (228, 558)]
CORD_L2 = [(222, 458), (238, 486), (258, 504), (270, 512)]
CORD_R = [(404, 434), (402, 470), (398, 510), (390, 558)]
# cheekbone turn + hollow (form lines, thin)
CHEEK_L = [(214, 292), (219, 310), (226, 328)]
CHEEK_R = [(398, 286), (394, 306), (388, 326)]
# brows: filled wedges, thick inner end, tail thinning down (traced from the gridded zoom)
BROW_L = [(207, 211), (214, 199), (230, 190), (254, 184), (283, 182), (285, 195), (260, 196), (238, 200), (220, 206)]
BROW_R = [(323, 184), (350, 178), (377, 178), (394, 184), (406, 194), (413, 208), (405, 205), (393, 196), (376, 191), (350, 192), (325, 197)]
# eyes from the landmark mesh
EYE_L_UP = [(231, 239), (234, 238), (237, 235), (240, 232), (245, 229), (253, 227), (261, 227), (270, 229.5), (277, 233), (280, 236)]
EYE_L_LO = [(236, 240), (241, 241.7), (246.5, 242.6), (254.3, 242.4), (262.5, 240.8), (270.5, 238.7), (276.6, 237.4)]
EYE_R_UP = [(337, 232.6), (339.7, 229.3), (345.3, 225), (353.6, 221.5), (362, 220.4), (370, 221.6), (375.6, 224.3), (379, 227), (384, 230)]
EYE_R_LO = [(340.5, 233.5), (346, 234.2), (353.7, 235.2), (362, 235.7), (369.6, 235), (374.7, 233.8), (378, 232)]
CREASE_L = [(238, 226), (248, 220), (262, 219), (274, 223)]
CREASE_R = [(344, 217), (356, 213), (370, 213), (380, 218)]
UNDER_EYE_L = [(244, 249), (256, 251), (268, 248)]
UNDER_EYE_R = [(350, 243), (362, 245), (373, 242)]
IRIS = [((255.5, 233.5), 9.5), ((359.5, 227.5), 9.5)]
# nose: bridge shadow on the right side, tip, wings, nostrils
BRIDGE = [(318, 214), (321, 236), (325, 258), (331, 276)]
WING_L = [(287, 280), (280, 288), (279, 296), (284, 302), (292, 302)]
WING_R = [(336, 279), (343, 287), (344, 295), (340, 301), (332, 302)]
TIP = [(299, 299), (306, 302), (313, 303), (320, 301), (326, 298)]
NOSTRIL_L = [(291, 293), (297, 289), (304, 292), (302, 296), (295, 297)]
NOSTRIL_R = [(321, 291), (327, 288), (334, 291), (332, 295), (324, 296)]
TIP_BALL = [(296, 292), (301, 282), (311, 278), (321, 281), (327, 291)]
PHILTRUM = [[(306, 305), (304, 315), (303, 324)], [(320, 305), (322, 315), (324, 323)]]
# mouth from the mesh: cupid's-bow cap, dark parting, lighter lower lip, shadow under it, corners into the cheek
LIP_UP = [(274, 346), (278, 341), (283, 336), (291, 330), (302, 324.5), (308, 325.5), (313, 326.5), (318, 325), (324, 323), (336, 328), (344, 333), (349, 338), (352, 343)]
PARTING = [(271, 347), (278, 345), (283, 343.2), (289, 341.7), (296, 339.8), (305, 339), (314, 339), (323, 338.4), (331, 338.6), (337, 339.6), (343, 340.8), (349, 342), (355, 344)]
LIP_LO = [(284, 351), (293, 354), (303, 356), (314, 356.5), (326, 355), (336, 352), (344, 348)]
LIP_SHADOW = [(298, 362), (314, 364), (330, 362)]
CORNER_L = [(268, 343), (271, 347), (270, 351)]
CORNER_R = [(357, 340), (355, 344), (357, 348)]


def line_layer():
    im = Image.new('L', (W * Z, H * Z), 255); d = ImageDraw.Draw(im)
    stroke(d, HAIR_OUT, 1.6, 2.6, 3.2)
    for f in FLY: stroke(d, f, .8, .2)
    stroke(d, HAIRLINE, 2.4, 2.4, 1.6)
    for s in LOCKS_R: stroke(d, s, 1.8, .5)
    for s in STRANDS: stroke(d, s, 1.4, .4)
    stroke(d, EAR_L, 1.0, 1.4); stroke(d, EAR_L_IN, .7, .4)
    stroke(d, EAR_R, 1.6, 2.0); stroke(d, EAR_R_IN, 1.0, .5)
    stroke(d, JAW_L, .8, 1.4, gaps=((.15, .35),))                         # lit side: thin, broken
    stroke(d, UNDER_L, 1.6, 2.2)
    stroke(d, JAW_R, 2.0, 2.4)                                            # shadow side heavier
    stroke(d, UNDER_R, 2.4, 2.2)
    stroke(d, CHIN, 1.2, 1.4, .8)
    stroke(d, NECK_L, 1.0, .9); stroke(d, NECK_R, 1.8, 1.4)
    stroke(d, SHOULDER_L, 1.0, .7, gaps=((.55, .7),)); stroke(d, SHOULDER_R, 1.6, 1.0)
    stroke(d, COLLAR_IN, 1.4, 1.8, 1.0); stroke(d, COLLAR_OUT, .9, .7); stroke(d, COLLAR_OUT_R, .7, 1.2)
    for s in (CORD_L, CORD_R): stroke(d, s, 1.6, 1.4)
    stroke(d, CORD_L2, 1.4, .8)
    stroke(d, CHEEK_L, .3, .6, .3); stroke(d, CHEEK_R, .6, 1.0, .5)
    fill(d, BROW_L); fill(d, BROW_R)
    stroke(d, EYE_L_UP, 1.2, 2.2, 3.0); stroke(d, EYE_R_UP, 1.4, 2.2, 3.0)
    stroke(d, EYE_L_LO, .4, .6, .9); stroke(d, EYE_R_LO, .5, .7, 1.0)
    stroke(d, CREASE_L, .4, .6, 1.0); stroke(d, CREASE_R, .5, .7, 1.1)
    stroke(d, UNDER_EYE_L, .2, .2, .5); stroke(d, UNDER_EYE_R, .3, .3, .6)
    for ((cx, cy), r), up, lo in zip(IRIS, (EYE_L_UP, EYE_R_UP), (EYE_L_LO, EYE_R_LO)):
        m = Image.new('L', im.size, 0); md = ImageDraw.Draw(m)
        md.polygon([(x * Z, y * Z) for x, y in np.vstack([spline(up), spline(lo)[::-1]])], fill=255)
        ir = Image.new('L', im.size, 0); idr = ImageDraw.Draw(ir)
        idr.ellipse([(cx - r) * Z, (cy - r) * Z, (cx + r) * Z, (cy + r) * Z], fill=255)
        q = 2.0; idr.ellipse([(cx + 3 - q) * Z, (cy - 2 - q) * Z, (cx + 3 + q) * Z, (cy - 2 + q) * Z], fill=0)
        im.paste(0, mask=Image.fromarray(np.minimum(np.array(m), np.array(ir))))
    stroke(d, BRIDGE, .4, 1.2, .9)
    stroke(d, WING_L, .7, .9); stroke(d, WING_R, 1.2, 1.4)
    stroke(d, TIP, .5, .5, 1.0); stroke(d, TIP_BALL, .2, .5, .2)
    fill(d, NOSTRIL_L); fill(d, NOSTRIL_R)
    for s in PHILTRUM: stroke(d, s, .3, .5, .3)
    stroke(d, LIP_UP, .6, .6, 1.3)
    stroke(d, PARTING, 1.6, 2.0, 2.6)
    stroke(d, LIP_LO, .3, .5, .8)
    stroke(d, LIP_SHADOW, .4, .4, 1.2)
    stroke(d, CORNER_L, .5, .5, 1.2); stroke(d, CORNER_R, .6, .6, 1.4)
    return im


def masks():
    """Region masks (page px): hair, face (inside hairline/jaw), figure (photo non-white)."""
    def poly(pts):
        m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).polygon([tuple(p) for p in spline(pts + [pts[0]], 8)], fill=255); return np.array(m) > 0
    hair = poly(HAIR_OUT + [(417, 258)] + HAIRLINE[::-1])
    face = poly(HAIRLINE + [(416, 262)] + EAR_R[::-1] + JAW_R + UNDER_R + CHIN[::-1][1:-1][::-1] + UNDER_L[::-1] + JAW_L[::-1] + EAR_L[::-1][1:])
    return hair, face


def cel_layer():
    """Flat value planes from the photo: heavy blur, two thresholds, keep only large shapes (cel planes, not texture)."""
    ph = Image.open('local/riki-0001-cutout.png').convert('RGB').resize((W, W), Image.LANCZOS).crop((0, 0, W, H))
    a = np.array(ph).astype(np.float32); lum = a.mean(2)
    fig = cv2.morphologyEx(((a.min(2) < 236)).astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)) > 0
    g = cv2.GaussianBlur(cv2.bilateralFilter(lum, 9, 40, 9), (0, 0), 5.0)
    hair, face = masks()

    def plane(m, k, min_area):
        m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, np.ones((k, k), np.uint8))
        m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((k, k), np.uint8))
        n, lab, st, _ = cv2.connectedComponentsWithStats(m)
        keep = np.isin(lab, [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] >= min_area])
        return cv2.GaussianBlur(keep.astype(np.float32), (0, 0), 2.5) > .5
    skin = (face | fig) & ~hair
    body = np.zeros_like(skin); body[440:] = True
    shadow = plane(skin & ~body & (g < 158), 9, 300) | plane(skin & body & (g < 150), 15, 1500)
    core = plane(skin & ~body & (g < 112), 7, 60)
    out = np.full((H, W), 255, np.float32)
    out[shadow] = 200; out[core] = 150
    out[plane(hair & fig, 5, 200)] = 50
    return out.astype(np.uint8)


if __name__ == '__main__':
    L = line_layer().resize((W, H), Image.LANCZOS)
    L.save('local/line-0001.png')
    cel = Image.fromarray(cel_layer())
    shaded = Image.fromarray(np.minimum(np.array(cel), np.array(L)))
    shaded.save('local/cel-0001.png')
    ph = Image.open('local/riki-0001-cutout.png').convert('RGB').resize((W, W), Image.LANCZOS).crop((0, 0, W, H))
    S = Image.new('RGB', (W * 3 + 20, H), 'white')
    S.paste(ph, (0, 0)); S.paste(L.convert('RGB'), (W + 10, 0)); S.paste(shaded.convert('RGB'), (2 * W + 20, 0))
    S.save('local/line-cel-0001.png')
    ov = Image.blend(ph, Image.new('RGB', ph.size, 'white'), .45)
    lr = np.array(ov); lr[np.array(L) < 140] = (220, 0, 0); Image.fromarray(lr).save('local/line-over-photo.png')
    print('ok')
