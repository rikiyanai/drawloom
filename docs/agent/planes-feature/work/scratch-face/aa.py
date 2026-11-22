"""Portrait tracing helpers: Saitamaar 16 px / 17 px rows, photo underlay, x-targeted row layout."""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps, ImageFilter

FONT = '/Users/rikihernandez/trueff-shallot/assets/font/Saitamaar.ttf'
SCAN = Path('/Users/rikihernandez/trueff-shallot/.run/face-capture/face-riki-scan/drawloom')
SIZE, PITCH = 16, 17
font = ImageFont.truetype(FONT, SIZE)
FULL, HALF = '　', ' '


def adv(s):
    return font.getlength(s)


def frame(n):
    d = SCAN / f'{n:04d}'
    photo = Image.open(d / 'layers/photo.png').convert('RGB')
    pose = json.load(open(d / 'pose.json'))
    lm = [(v['x'], v['y']) for v in pose['pose']['vertices']] if pose.get('pose') else None
    return photo, lm, pose.get('angles')


def guide(n, box, width_px, layers=('photo',), fade=0.55):
    """Crop box (x0,y0,x1,y1) of frame n scaled to width_px; returns (image, scale, box)."""
    d = SCAN / f'{n:04d}' / 'layers'
    x0, y0, x1, y1 = box
    s = width_px / (x1 - x0)
    out = None
    for name in layers:
        im = Image.open(d / f'{name}.png').convert('RGBA')
        bg = Image.new('RGBA', im.size, 'white'); bg.alpha_composite(im); im = bg.convert('RGB')
        im = im.crop(box).resize((round((x1 - x0) * s), round((y1 - y0) * s)), Image.LANCZOS)
        out = im if out is None else Image.blend(out, im, 0.5)
    out = Image.blend(out, Image.new('RGB', out.size, 'white'), fade)
    return out, s


def to_px(pt, box, s):
    return ((pt[0] - box[0]) * s, (pt[1] - box[1]) * s)


def spaces_for(gap, line_start):
    """Space run whose width is closest to gap px without two adjacent half spaces or a leading half space."""
    best, best_err = '', abs(gap)
    a = 0
    while 11 * a <= gap + 11:
        for b in range(0, a + 2):
            if line_start and b and a == 0:
                continue
            w = adv(FULL) * a + adv(HALF) * b
            err = abs(gap - w)
            if err < best_err:
                best_err, best = err, (a, b)
        a += 1
    if not best:
        return ''
    a, b = best
    # interleave: half spaces never adjacent, never first on a line
    parts = []
    for i in range(a):
        parts.append(FULL)
        if b and (i > 0 or not line_start or True):
            parts.append(HALF); b -= 1
    if b:  # one half left (b<=a+1): place after the last full or alone if allowed
        parts.append(HALF)
    s = ''.join(parts)
    while '  ' in s:
        s = s.replace('  ', ' ')
    if line_start and s.startswith(' '):
        s = s[1:]
    return s


def layout(items):
    """items: list of (x_px, glyphs) sorted by x; returns the row text placing each run at its x."""
    out, pen = '', 0.0
    for x, g in sorted(items, key=lambda t: t[0]):
        gap = x - pen
        if gap > 2:
            sp = spaces_for(gap, out == '')
            out += sp; pen += adv(sp)
        out += g; pen += adv(g)
    return out


def check(text):
    bad = []
    for i, row in enumerate(text.split('\n')):
        if row.startswith(' '):
            bad.append((i, 'leading half space'))
        if '  ' in row:
            bad.append((i, 'adjacent half spaces'))
    return bad


def render(text, underlay=None, pad=8, grid=False):
    rows = text.split('\n')
    w = max([adv(r) for r in rows] + [underlay.size[0] if underlay else 0]) + 2 * pad
    h = max(len(rows) * PITCH, underlay.size[1] if underlay else 0) + 2 * pad
    im = Image.new('RGB', (int(w), int(h)), 'white')
    if underlay:
        im.paste(underlay, (pad, pad))
    d = ImageDraw.Draw(im)
    if grid:
        for i in range(len(rows) + 1):
            d.line([(0, pad + i * PITCH), (w, pad + i * PITCH)], fill=(225, 225, 255))
    for i, r in enumerate(rows):
        d.text((pad, pad + i * PITCH), r, font=font, fill=(200, 0, 0) if underlay else 'black')
    return im


def side_by_side(*ims, gap=12):
    w = sum(i.size[0] for i in ims) + gap * (len(ims) - 1); h = max(i.size[1] for i in ims)
    out = Image.new('RGB', (w, h), 'white'); x = 0
    for i in ims:
        out.paste(i, (x, 0)); x += i.size[0] + gap
    return out


FEATURES = {
 'browL': [70, 63, 105, 66, 107], 'browR': [336, 296, 334, 293, 300],
 'eyeL_up': [33, 246, 161, 160, 159, 158, 157, 173, 133], 'eyeL_lo': [33, 7, 163, 144, 145, 153, 154, 155, 133],
 'eyeR_up': [362, 398, 384, 385, 386, 387, 388, 466, 263], 'eyeR_lo': [362, 382, 381, 380, 374, 373, 390, 249, 263],
 'irisL': [468, 469, 470, 471, 472], 'irisR': [473, 474, 475, 476, 477],
 'nose': [168, 6, 197, 195, 5, 4, 1, 2, 98, 327, 64, 294, 129, 358],
 'lipU': [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291], 'lipM': [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308],
 'lipL': [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291],
 'oval': [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109],
}


def feature_rows(lm, box, s, rows):
    """Per text row: feature points (name, x px) that fall in that row band."""
    out = {i: [] for i in range(rows)}
    for name, idx in FEATURES.items():
        for k in idx:
            x, y = to_px(lm[k], box, s)
            r = int(y // PITCH)
            if 0 <= r < rows:
                out[r].append((name, round(x)))
    return out


def ruler(img, step=20):
    d = ImageDraw.Draw(img)
    for i in range(0, img.size[1], PITCH):
        d.line([(0, i), (img.size[0], i)], fill=(150, 180, 255))
    for x in range(0, img.size[0], step):
        d.line([(x, 0), (x, 5)], fill=(255, 0, 0))
        if x % (step * 2) == 0:
            d.text((x + 1, 5), str(x), fill=(255, 0, 0))
    return img
