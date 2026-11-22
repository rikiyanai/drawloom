import sys, planes2aa as Q
from PIL import Image, ImageDraw
from angle_tool import photo, PITCH, UD
from aa import render
def view(box, k, name, text=None, planes=True, base='photo', fade=0.35):
    V, faces = Q.scene('0007')
    W, H = 517, 624
    im = photo('0007', (W, H)) if base == 'photo' else Image.open(UD + 'ud-0007.png').convert('RGB')
    im = Image.blend(im, Image.new('RGB', im.size, 'white'), fade)
    if text is not None: im = render(text, underlay=im, pad=0).crop((0, 0, W, H))
    im = im.resize((W * k, H * k), Image.LANCZOS); d = ImageDraw.Draw(im, 'RGBA')
    if planes:
        col = {0: None, 1: (0, 160, 0, 40), 2: (0, 0, 220, 45), 3: (200, 0, 200, 55)}
        for ks, c, n in faces:
            P = [(V[q][0] * k, V[q][1] * k) for q in ks]
            if col[c]: d.polygon(P, fill=col[c])
            d.line(P + [P[0]], fill=(255, 120, 0, 160), width=1)
    for i in range(H // PITCH + 1):
        d.line([(0, i * PITCH * k), (W * k, i * PITCH * k)], fill=(120, 150, 255, 140)); d.text((box[0] * k + 2, i * PITCH * k + 2), str(i), fill=(0, 0, 255))
    for x in range(0, W, 10):
        d.line([(x * k, box[1] * k), (x * k, box[1] * k + (8 if x % 50 == 0 else 4))], fill=(255, 0, 255)); 
        if x % 50 == 0: d.text((x * k + 2, box[1] * k + 8), str(x), fill=(200, 0, 200))
    im.crop(tuple(v * k for v in box)).save(name)
if __name__ == '__main__':
    view((240, 150, 460, 330), 4, 'local/fa-v1.png')
