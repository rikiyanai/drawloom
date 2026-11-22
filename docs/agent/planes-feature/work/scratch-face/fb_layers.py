"""Fork B: Drawloom layers of 0007 warped into the ud-0007 frame (head at the front's scale, 17 px rows)."""
import json, base64, io, numpy as np
from PIL import Image, ImageDraw, ImageFilter
PA = '/private/tmp/claude-501/-Users-rikihernandez/5591bff3-64a4-4eda-ad29-a402158ce2b9/scratchpad/planes-art/'
PK = '/Users/rikihernandez/trueff-shallot/.run/face-capture/face-riki-scan/drawloom/0007/packet.json'
EX = {e['id']: e for e in json.load(open(PA + 'export.json'))}
DATA = json.load(open(PA + 'data3d.json')); an = [a for a in DATA['angles'] if a['id'] == '0007'][0]
f = EX['0001']['scale'] / EX['0007']['scale']
W, H = round(an['w'] * f), round(an['h'] * f)
pk = json.load(open(PK))
def layer(lid):
    l = next(x for x in pk['layers'] if x['id'] == lid)
    im = Image.open(io.BytesIO(base64.b64decode(l['png'].split(',', 1)[1]))).convert('RGBA'); bg = Image.new('RGBA', im.size, 'white'); bg.alpha_composite(im)
    A = np.array(an['img2page'])[:, :2] * f; b = np.array(an['img2page'])[:, 2] * f; Ai = np.linalg.inv(A); bi = -Ai @ b
    return bg.convert('RGB').transform((W, H), Image.AFFINE, (Ai[0, 0], Ai[0, 1], bi[0], Ai[1, 0], Ai[1, 1], bi[1]), Image.BICUBIC, fillcolor=(255, 255, 255))
if __name__ == '__main__':
    for lid in ('photo', 'edges', 'notan', 'doveline'):
        layer(lid).save(f'local/fb-{lid}.png')
    print(W, H)
