import sys
from PIL import Image, ImageDraw
src, out = sys.argv[1], sys.argv[2]; x0, y0, x1, y1 = map(int, sys.argv[3].split(',')); z = int(sys.argv[4])
im = Image.open(src).convert('RGB').crop((x0, y0, x1, y1)); im = im.resize((im.width * z, im.height * z), Image.LANCZOS)
d = ImageDraw.Draw(im)
for y in range((y0 // 18) * 18, y1, 18):
    if y >= y0: d.line([(0, (y - y0) * z), (im.width, (y - y0) * z)], fill=(0, 150, 255)); d.text((2, (y - y0) * z + 2), f'r{y // 18}', fill=(0, 90, 255))
for x in range((x0 // 10) * 10, x1, 10):
    if x >= x0: d.line([((x - x0) * z, 0), ((x - x0) * z, 8 if x % 50 else 20)], fill=(255, 0, 160)); d.text(((x - x0) * z + 2, 10), str(x), fill=(255, 0, 160)) if x % 50 == 0 else None
im.save(out)
