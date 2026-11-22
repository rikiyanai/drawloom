"""Render candidate row dicts for a region: per candidate, photo-faded overlay + clean, zoomed. Usage: trial.py spec.py out.png x0,y0,x1,y1 zoom"""
import sys, runpy
from PIL import Image
from aa import layout, check
import tracer as T
W, H = 612, 558
spec = runpy.run_path(sys.argv[1]); C = spec['CANDS']
x0, y0, x1, y1 = map(int, sys.argv[3].split(',')); z = int(sys.argv[4])
import os
SH=int(os.environ.get('SHIFT','-6'))
def sh(im):
    o=Image.new('RGB',im.size,'white'); o.paste(im,(0,SH)); return o
ph = sh(Image.open('local/ph612.png').convert('RGB')); cel = Image.open('local/dl-cel-0001.png').convert('RGB')
fade = Image.blend(sh(Image.open('local/dl-line-0001.png').convert('RGB')), Image.new('RGB', ph.size, 'white'), 0.35)
tiles = []
for name, rows in C:
    text = '\n'.join(layout(rows.get(r, [])) for r in range(31))
    bad = check(text)
    a = T.render(text, (W, H), fade, (220, 0, 0)).crop((x0, y0, x1, y1)); b = T.render(text, (W, H)).crop((x0, y0, x1, y1))
    tiles.append((name + (' LAW' if bad else ''), a, b))
w, h = (x1 - x0) * z, (y1 - y0) * z
S = Image.new('RGB', (w * 2 + 10 + (x1-x0)*z, (h + 16) * len(tiles)), 'white')
from PIL import ImageDraw
d = ImageDraw.Draw(S)
phc = sh(Image.open('local/dl-line-0001.png').convert('RGB')).crop((x0, y0, x1, y1)).resize((w, h))
for i, (n, a, b) in enumerate(tiles):
    y = i * (h + 16)
    d.text((2, y + 2), n, fill=(0, 0, 255))  # label band is 16px; image starts at y+16
    S.paste(phc, (0, y + 16)); S.paste(a.resize((w, h), Image.LANCZOS), (w + 5, y + 16)); S.paste(b, (2 * w + 10, y + 16 + (h - (y1-y0)) // 2))
S.save(sys.argv[2])
