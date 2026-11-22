"""Three-quarter: hand contour/feature layer (tq-h) + tone from the planes.
Each visible plane's value comes from its 3D normal against the key light; the value map is sampled on a
fixed lattice per row so shadow planes become bounded dot fields whose edges are the plane edges."""
import sys, numpy as np, planes2aa as Q
from PIL import Image, ImageDraw
from aa import adv
from angle_tool import out, UD
import a0007
aid = sys.argv[2] if len(sys.argv) > 2 else '0007'
V, faces = Q.scene(aid)
W, H = Image.open(UD + f'ud-{aid}.png').size
# each plane's value = the photo's own light on that plane (mean luminance inside it, relative to the face)
from angle_tool import photo
ph = np.array(photo(aid, (W, H)).convert('L'), float)
means = []
for ks, c, n in faces:
    m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).polygon([V[k][:2] for k in ks], fill=255); m = np.array(m) > 0
    means.append(ph[m].mean() if m.sum() > 20 else None)
med = np.median([v for v in means if v is not None])
vm = Image.new('L', (W, H), 0); d = ImageDraw.Draw(vm)
for (ks, c, n), mu in zip(faces, means):
    if mu is None: continue
    cls = 0 if mu > 0.9 * med else 1 if mu > 0.8 * med else 2 if mu > 0.68 * med else 3
    d.polygon([V[k][:2] for k in ks], fill=cls)
vm = np.array(vm)
GL = {1: None, 2: (':', 14), 3: (';', 10)}
hand = {r: list(v) for r, v in a0007.R.items()}
R = {}
for r in range(H // 17 + 1):
    items = list(hand.get(r, [])); occ = [(x - 4, x + adv(g) + 4) for x, g in items]
    for yy in (r * 17 + 9,):
        if yy >= H: continue
        x = 0
        while x < W:
            c = int(vm[yy, int(x)])
            if GL.get(c):
                g, step = GL[c]
                lx = (x // step) * step + ((r * 5) % step)
                if lx >= x and not any(a < lx + adv(g) and lx < b for a, b in occ) and vm[yy, min(W - 1, int(lx))] == c:
                    items.append((lx, g)); occ.append((lx - 3, lx + adv(g) + 3))
                x = lx + step if lx >= x else x + 1
            else:
                x += 2
    R[r] = items
if __name__ == '__main__':
    out(R, aid, sys.argv[1] if len(sys.argv) > 1 else 'tone7', 37)
