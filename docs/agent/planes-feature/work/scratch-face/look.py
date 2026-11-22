"""Judge sheet for a TXT: photo | AA over faded cel underlay (red) | AA alone. Optional zoom crop."""
import sys
from PIL import Image, ImageDraw
import tracer as T
W, H = 612, 558
txt = open(sys.argv[1]).read().rstrip('\n')
out = sys.argv[2]
ph = Image.open('local/riki-0001-cutout.png').convert('RGB').resize((W, W), Image.LANCZOS).crop((0, 0, W, H))
cel = Image.open('local/dl-line-0001.png').convert('RGB')
under = Image.blend(cel, Image.new('RGB', cel.size, 'white'), 0.55)
d = ImageDraw.Draw(under)
for x in range(0, W, 20): d.line([(x, 0), (x, 4)], fill=(0, 120, 255)); d.text((x + 1, 4), str(x // 20), fill=(0, 120, 255)) if x % 100 == 0 else None
for r in range(H // 18): d.line([(0, r * 18), (6, r * 18)], fill=(0, 120, 255)); d.text((0, r * 18 + 2), str(r), fill=(0, 160, 255))
ov = T.render(txt, (W, H), under, (220, 0, 0)); clean = T.render(txt, (W, H))
if len(sys.argv) > 3:
    x0, y0, x1, y1 = map(int, sys.argv[3].split(',')); z = float(sys.argv[4]) if len(sys.argv) > 4 else 2
    ims = [i.crop((x0, y0, x1, y1)).resize((int((x1 - x0) * z), int((y1 - y0) * z)), Image.LANCZOS) for i in (ph, ov, clean)]
else:
    ims = [ph, ov, clean]
S = Image.new('RGB', (sum(i.width for i in ims) + 20, ims[0].height), 'white'); x = 0
for i in ims: S.paste(i, (x, 0)); x += i.width + 10
S.save(out)
