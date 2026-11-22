import sys, fb, fa_build as A
from aa import render
from angle_tool import photo
from PIL import Image, ImageDraw
def variants(base_keys, key, opts, box, k, name):
    ph = photo('0007', (517, 624)); w, h = box[2] - box[0], box[3] - box[1]
    tiles = [ph.crop(box).resize((w * k, h * k), Image.LANCZOS)]
    for o in opts:
        F = dict(fb.FEAT); F[key] = o
        lay = [it for kk in base_keys for it in F[kk]]
        R = A.compose([lay, A.shirt()])
        t = '\n'.join(A.layout_row(R.get(r, [])) for r in range(37)) if hasattr(A, 'layout_row') else None
        from angle_tool import build
        t = build(R, 37)
        im = render(t, underlay=Image.blend(ph, Image.new('RGB', ph.size, 'white'), 0.55), pad=0).crop(box).resize((w * k, h * k), Image.LANCZOS)
        tiles.append(im)
    s = Image.new('RGB', (len(tiles) * (w * k + 8), h * k), 'white')
    for i, t in enumerate(tiles): s.paste(t, (i * (w * k + 8), 0))
    s.save(name)
