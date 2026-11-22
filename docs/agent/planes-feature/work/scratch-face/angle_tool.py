"""Shared harness for the turned-angle portraits: R = {row: [(x_px, glyphs)]} on the underdrawing frame
(head at the front's scale, Saitamaar 16 px, 17 px rows). Writes TXT, overlay-on-underdrawing and photo/AA pairs."""
import sys
from PIL import Image, ImageDraw
from aa import layout, check, render, side_by_side, PITCH
UD = '/private/tmp/claude-501/-Users-rikihernandez/5591bff3-64a4-4eda-ad29-a402158ce2b9/scratchpad/planes-art/'

def build(R, n):
    return '\n'.join(layout([i for i in R.get(r, []) if i[1]]) for r in range(n))

def grid_under(aid, dark=0.0):
    ud = Image.open(UD + f'ud-{aid}.png').convert('RGB')
    if dark: ud = Image.blend(ud, Image.new('RGB', ud.size, 'white'), dark)
    d = ImageDraw.Draw(ud)
    for i in range(ud.height // PITCH + 1):
        d.line([(0, i * PITCH), (ud.width, i * PITCH)], fill=(200, 215, 255))
        d.text((2, i * PITCH + 2), str(i), fill=(120, 140, 220))
    return ud

def photo(aid, size):
    sh = Image.open(UD + f'ud-sheet-{aid}.png'); w = (sh.width - 12) // 2
    return sh.crop((0, 0, w, sh.height)).resize(size)

def out(R, aid, name, n=None):
    ud = Image.open(UD + f'ud-{aid}.png')
    n = n or ud.height // PITCH + 1
    t = build(R, n)
    bad = check(t)
    open(f'local/{name}.txt', 'w').write(t + '\n')
    ov = render(t, underlay=grid_under(aid, 0.25), pad=0)
    ov.save(f'local/{name}-over.png')
    alone = render(t, pad=0).crop((0, 0, ud.width, ud.height))
    side_by_side(photo(aid, ud.size), alone).save(f'local/{name}-pair.png')
    print(name, 'law:', bad or 'ok', 'rows', n)
    return t

def zoom(aid, box, k=2, name=None, text=None):
    """Crop of the gridded underdrawing (optionally with AA text in red) at k x, with x ticks every 20 px."""
    from PIL import ImageDraw
    base = grid_under(aid, 0.25)
    if text is not None:
        base = render(text, underlay=base, pad=0)
    im = base.crop(box).resize(((box[2] - box[0]) * k, (box[3] - box[1]) * k), Image.LANCZOS)
    d = ImageDraw.Draw(im)
    for x in range((box[0] // 20 + 1) * 20, box[2], 20):
        X = (x - box[0]) * k; d.line([(X, 0), (X, 8)], fill=(255, 0, 255), width=2); d.text((X + 2, 8), str(x), fill=(200, 0, 200))
    im.save(name or f'local/zoom-{aid}.png'); return im
