"""Surgery frame: Riki's 0007 underdrawing/photo mapped into the base piece's frame (eye-anchored similarity)."""
import sys
from PIL import Image, ImageDraw
from aa import render
from angle_tool import UD, photo
S, EYE_R, EYE_B = 0.71, (344, 231), (215, 128)
W, H = 360, 320
def warp(im):
    # base = S*(riki - EYE_R) + EYE_B  ->  riki = (base - EYE_B)/S + EYE_R
    a = 1 / S; return im.transform((W, H), Image.AFFINE, (a, 0, EYE_R[0] - EYE_B[0] * a, 0, a, EYE_R[1] - EYE_B[1] * a), Image.BICUBIC, fillcolor=(255, 255, 255))
def under(kind='ud', fade=0.3):
    src = Image.open(UD + 'ud-0007.png').convert('RGB') if kind == 'ud' else photo('0007', (517, 624))
    im = warp(src); return Image.blend(im, Image.new('RGB', im.size, 'white'), fade)
def grid(im, k=2):
    im = im.resize((im.width * k, im.height * k), Image.LANCZOS); d = ImageDraw.Draw(im)
    for i in range(H // 17 + 1): d.line([(0, i * 17 * k), (im.width, i * 17 * k)], fill=(170, 190, 255)); d.text((im.width - 20, i * 17 * k + 2), str(i), fill=(60, 60, 220))
    for x in range(0, W, 20): d.line([(x * k, 0), (x * k, 6)], fill=(255, 0, 255)); d.text((x * k + 2, 6), str(x), fill=(255, 0, 255))
    return im
if __name__ == '__main__':
    txt = open(sys.argv[1]).read(); name = sys.argv[2]
    grid(render(txt, underlay=under('ud'), pad=0).crop((0, 0, W, H))).save(f'local/{name}-ud.png')
    a = photo('0007', (517, 624)); ph = warp(a)
    aa = render(txt, pad=0).crop((0, 0, W, H)).convert('RGB')
    s = Image.new('RGB', (W * 2 + 10, H), 'white'); s.paste(ph, (0, 0)); s.paste(aa, (W + 10, 0)); s.resize((s.width * 2, s.height * 2), Image.LANCZOS).save(f'local/{name}-pair.png')
