"""Gridded zoom of a fork-B layer (optionally with AA text overlaid in red)."""
import sys
from PIL import Image, ImageDraw
from aa import render, PITCH
def view(lid, box, k=2, out='local/fbv.png', text=None, fade=0.0):
    im = Image.open(f'local/fb-{lid}.png').convert('RGB')
    if fade: im = Image.blend(im, Image.new('RGB', im.size, 'white'), fade)
    d = ImageDraw.Draw(im)
    for i in range(im.height // PITCH + 1): d.line([(0, i * PITCH), (im.width, i * PITCH)], fill=(150, 180, 255))
    if text is not None: im = render(text, underlay=im, pad=0)
    c = im.crop(box).resize(((box[2] - box[0]) * k, (box[3] - box[1]) * k), Image.LANCZOS); d = ImageDraw.Draw(c)
    for x in range((box[0] // 20 + 1) * 20, box[2], 20):
        X = (x - box[0]) * k; d.line([(X, 0), (X, 8)], fill=(255, 0, 255), width=2); d.text((X + 2, 8), str(x), fill=(200, 0, 200))
    for r in range(box[1] // PITCH, box[3] // PITCH + 1):
        Y = (r * PITCH - box[1]) * k
        if Y >= 0: d.text((2, Y + 2), str(r), fill=(0, 0, 255))
    c.save(out); return c
