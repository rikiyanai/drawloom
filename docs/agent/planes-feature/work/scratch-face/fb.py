"""Fork A, pass 2: three-quarter (0007) re-authored on the planes. Every placement is read off the plane vertices and
the photo in the ud-0007 frame (517x624, 17 px rows). Hair = bounded strand field + silhouette + hairline;
face = open paper on the lit planes, plane-class dot fields on the planes that turn from the light,
lines only on silhouettes, the jaw, and the features (spelled from their plane edges)."""
import sys, math
from aa import adv, render
from angle_tool import out, photo
import fa_build as A
from PIL import Image

def hair(step=12, field=':'):
    items = []
    for r in range(2, 27):
        y = r * 17 + 8.5
        for xa, xb in A.poly_spans(A.HAIR, y):
            x = xa + 4
            off = (r * 5) % step
            while True:
                lx = math.ceil((x - off) / step) * step + off
                g = A.flow(lx, y)
                if lx + adv(g) > xb - 3: break
                n = int((lx - x) // 3)
                if n > 0: items.append((r, x, field * n))
                items.append((r, lx, g)); x = lx + adv(g)
    return items

FEAT = {
 # near brow: heavy straight band, thickest at the middle, tail dropping at the outer end; far brow short and heavy
 'brow': [(11, 292, ",ｨ=ﾆ三三ﾆ=‐-､"), (12, 284, ",'"), (11, 404, "ｨ=ﾆﾆヽ")],
 # near eye: lash line rising from the outer corner, iris hanging from the lid, inner corner; lower lid light
 'eye': [(12, 304, '_,.-‐-､'), (13, 309, ",ｨ=ﾆﾃﾂ=ｧ､"), (14, 318, "｀ー-‐'")],
 # far eye between the bridge and the far cheek
 'feye': [(13, 419, "ｨﾃｧ")],
 # nose: bridge silhouette, tip, columella back to the nostril, ala
 'nose': [(12, 404, "'､"), (13, 412, "ヽ"), (14, 421, "ヽ"), (15, 430, "ヽ"), (16, 437, ")"),
          (16, 377, ",ｨ⌒"), (17, 376, "(　ゝ=- -'´")],
 # mouth (male): upper lip profile, short mark at the upper-lip centre, parting corner to front, under-lip line
 'mouth': [(18, 432, "|"), (19, 403, "_,.-‐'"), (19, 438, "〉"), (20, 374, "､_,.-‐ｰ=‐-'"), (21, 406, "ー‐"), (21, 432, "/")],
 # chin and jaw
 'chin': [(22, 430, "|"), (23, 431, "|"), (24, 300, "｀ｰ-､__"), (24, 352, "＿,.-‐'"), (23, 258, "｀ヽ､"), (22, 228, "＼")],
 # far contour: forehead/temple under the hair strip, far brow ridge, far cheekbone
 'far': [(12, 438, "!")],
 # front lock framing the forehead: a strand band from the crown down to the far brow
 'strip': [(4, 392, "ヽ:ヽ､"), (5, 397, "ヽ:ヽ:ヽ"), (6, 403, "ヽ:ヽ:|"), (7, 409, "ヽ:ヽ|"), (8, 415, "ヽ:|"), (9, 419, "ヽ|:|"), (10, 425, "|:|")],
 'fold': [(18, 368, "(")],
 # ear: helix cap, rim, antihelix fold, concha, tragus, lobe
 'ear': [(16, 160, "/⌒￣ヽ"), (17, 180, "/⌒"), (17, 220, "|"), (18, 178, "{"), (18, 222, "}"),
         (19, 184, "ゝ"), (19, 224, "|"), (20, 166, "ヽ､"), (20, 222, "|"), (21, 188, "｀ー-'")],
 'bunloop': [(21, 126, "(⌒")],
 # hair edges: forehead hairline arch, near temple edge, front strip edge, silhouette
 'hairedge': [(5, 252, ",.-‐''￣￣￣￣''‐-.,"), (2, 232, ",.-‐''￣￣￣￣￣''‐-､"), (3, 384, "｀ヽ､")],
}

def compose(feat, tone_on=True, hair_step=11, field=':'):
    lay = [it for k in feat for it in FEAT[k]] if isinstance(feat, (list, tuple)) else feat
    con = A.run_line(A.OUT_TOP[6:]) + A.run_line(A.OUT_LEFT[1:]) + A.run_line(A.BUN)
    neck = A.run_line([(214, 434), (208, 458)]) + A.run_line([(398, 430), (388, 470)])
    layers = [lay, con, neck, A.shirt()]
    if tone_on: layers.append(A.plane_tone())
    layers.append(hair(hair_step, field))
    return A.compose(layers)

def panel(txt, box, k, name):
    ph = photo('0007', (517, 624)).crop(box)
    aa_ = render(txt, pad=0).crop(box)
    ov = render(txt, underlay=Image.blend(photo('0007', (517, 624)), Image.new('RGB', (517, 624), 'white'), 0.4), pad=0).crop(box)
    w, h = box[2] - box[0], box[3] - box[1]
    s = Image.new('RGB', (3 * w * k + 20, h * k), 'white')
    for i, im in enumerate((ph, aa_, ov)): s.paste(im.resize((w * k, h * k), Image.LANCZOS), (i * (w * k + 10), 0))
    s.save(name)

if __name__ == '__main__':
    name = sys.argv[1] if len(sys.argv) > 1 else 'forkA-4'
    R = compose(list(FEAT))
    t = out(R, '0007', name, 37)
    panel(t, (270, 170, 460, 440), 3, f'local/{name}-face.png')
    panel(t, (110, 20, 470, 470), 1, f'local/{name}-whole.png')
