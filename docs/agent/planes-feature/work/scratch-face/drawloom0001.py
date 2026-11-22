"""Capture 0001, front: line drawing = Drawloom Edge layer, cel shade = Drawloom Notan layer (both from the capture),
cropped to the portrait box, background removed with the cutout's figure mask, lightly cleaned (no redrawing)."""
import numpy as np, cv2
from PIL import Image
D = '/Users/rikihernandez/trueff-shallot/.run/face-capture/face-riki-scan/drawloom/0001/layers/'
BOX, W, H = (103, 433, 915, 1245), 612, 558


def layer(n):
    im = Image.open(D + n + '.png').convert('RGBA'); bg = Image.new('RGBA', im.size, 'white'); bg.alpha_composite(im)
    return np.array(bg.convert('L').crop(BOX).resize((W, W), Image.LANCZOS))[:H].astype(np.float32)


ph = np.array(Image.open('local/riki-0001-cutout.png').convert('RGB').resize((W, W), Image.LANCZOS))[:H].astype(np.float32)
fig = cv2.morphologyEx((ph.min(2) < 236).astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
fig_d = cv2.dilate(fig, np.ones((3, 3), np.uint8)) > 0
edges, notan = layer('edges'), layer('notan')
# line drawing: edge layer inside the figure, contrast pushed so faint texture drops and real contours stay
e = np.clip((edges - 120) / (225 - 120), 0, 1) * 255
e[~fig_d] = 255
m = (e < 128).astype(np.uint8); n, lab, st, _ = cv2.connectedComponentsWithStats(m, connectivity=8)
e[np.isin(lab, [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] < 12])] = 255
line = e.astype(np.uint8)
# cel: notan's three values (paper / mid / dark) inside the figure, speckle removed
from photoink0001 import hair_mask
hair = cv2.resize(hair_mask(), (W, H), interpolation=cv2.INTER_NEAREST) > 0
dark_px = cv2.GaussianBlur(ph.mean(2), (0, 0), 1.0) < 40                   # pupils, brow cores, nostrils, lip parting
q = np.where((notan < 64) & (hair | dark_px), 40, np.where(notan < 192, 175, 255)).astype(np.uint8)
q = cv2.medianBlur(q, 5); q[~fig_d] = 255
cel = np.minimum(q, line)
out = Image.new('RGB', (W * 3 + 20, H), 'white')
for i, a in enumerate((ph.astype(np.uint8), line, cel)):
    out.paste(Image.fromarray(a).convert('RGB'), (i * (W + 10), 0))
Image.fromarray(line).save('local/dl-line-0001.png'); Image.fromarray(cel).save('local/dl-cel-0001.png'); out.save('local/dl-line-cel-0001.png')
print('ok')
