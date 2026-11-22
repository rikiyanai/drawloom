"""Fork B: three-quarter (0007) Medium traced from the IMAGE (Drawloom photo/edges/notan warped into the ud-0007 frame).
Hand strokes from the traced photo contours; tone fields from the photo's own values (hair = bounded colon field with
lock strands; shadows = sparse dot fields; lit skin = open paper)."""
import sys, math, numpy as np
from PIL import Image, ImageFilter
from aa import adv
from angle_tool import out
P = 17
nt = np.array(Image.open('local/fb-notan.png').convert('L').filter(ImageFilter.MedianFilter(5)))
ph = np.array(Image.open('local/fb-photo.png').convert('L').filter(ImageFilter.GaussianBlur(3)), float)
MED = 155.0
H = {}                                   # hand strokes: row -> [(x, glyphs)]
def put(r, x, s): H.setdefault(r, []).append((x, s))

def strand(pts, steep='|', mid_d='/', mid_u='ヽ'):
    """Spell a hair lock polyline row by row with light single glyphs."""
    o = []
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if y1 < y0: (x0, y0), (x1, y1) = (x1, y1), (x0, y0)
        for r in range(int(y0 // P), int(y1 // P) + 1):
            ya, yb = max(y0, r * P), min(y1, (r + 1) * P)
            if yb - ya < 6: continue
            xa = x0 + (x1 - x0) * (ya - y0) / max(y1 - y0, 1e-6); xb = x0 + (x1 - x0) * (yb - y0) / max(y1 - y0, 1e-6)
            ang = math.degrees(math.atan2(yb - ya, abs(xb - xa) + 1e-6)); xm = (xa + xb) / 2
            if ang > 74: g = steep
            elif ang > 40: g = mid_u if xb > xa else mid_d
            else: g = '‐'
            o.append((r, xm - adv(g) / 2, g))
    seen = set(); res = []
    for r, x, g in o:
        if r in seen: continue
        seen.add(r); res.append((r, x, g))
    return res

# ---------------- contours (traced from fb-photo / fb-edges) ----------------
# hair silhouette: crown cap, back (left) flank, front (right) flank
put(3, 228, ",.-‐''￣￣￣￣￣''‐-.､")
for r, x, g in [(4, 209, '／'), (5, 192, '／'), (6, 177, '／'), (7, 163, '／'), (8, 153, '/'), (9, 144, '/'), (10, 138, '/'),
                (11, 133, 'l'), (12, 131, '|'), (13, 130, '|'), (14, 130, '|'), (15, 131, '|'), (16, 133, '|'), (17, 135, 'l'), (18, 139, 'l'), (19, 143, 'ヽ')]:
    put(r, x, g)
for r, x, g in [(4, 384, 'ヽ､'), (5, 398, 'ヽ'), (6, 405, 'ヽ'), (7, 412, 'ヽ'), (8, 418, 'ヽ'), (9, 426, 'i'), (10, 429, '|'), (11, 433, '|'), (12, 436, '!')]:
    put(r, x, g)
# hairline: forehead top arc, temple edge carried by the tone field's own edge
put(6, 262, ",ｨ'´￣￣￣`ヽ､")
for r, x, g in [(7, 370, 'ヽ､'), (8, 388, 'ヽ'), (9, 402, 'ヽ'), (10, 412, 'ヽ')]:
    put(r, x, g)
# brows: near brow heavy, rising to its arch then tapering to the inner end; far brow short behind the bridge
put(11, 286, "ｨ=ﾆ三三三ﾆ=-､")
put(11, 405, "ｨﾆ=､")
# near eye: fold, heavy lid with the iris hanging from it, light lower lid; far eye foreshortened beyond the bridge
put(12, 310, "_,..､")
put(13, 303, ".ｨ''ﾆ弋ﾂ`ヽ")
put(14, 318, "｀ｰ-‐'")
put(12, 397, "ヽ")
put(13, 408, "ヽ"); put(13, 418, "ｨﾃ'ｧ")
put(14, 423, "ヽ")
# nose: bridge silhouette in front of the far cheek, tip, wing and nostril
put(15, 432, "ヽ")
put(16, 380, ",ｨ⌒"); put(16, 437, ")")
put(17, 377, "(_,ゞ､_ﾉ")
# mouth (male lip: parting + short mark above + short under-lip line); profile of lips and chin on the far edge
put(19, 420, "ｰ"); put(19, 434, ")")
put(20, 372, "､__,.-‐ｰ=‐")
put(21, 402, "ーー"); put(21, 432, ")")
put(22, 420, "(")
put(23, 430, ")")
# jaw: from under the ear lobe down to the chin, chin bottom turning up into the chin front
put(22, 226, "|")
put(23, 228, "｀ヽ､_")
put(24, 270, "｀ｰ-､____,,..-‐ｰ‐-..,_ﾉ")
# ear: helix cap, inner fold, lobe; tragus edge in front
put(16, 156, "/⌒ヽ")
put(17, 152, "{"); put(17, 170, "{ ⌒ヽ")
put(18, 152, "|"); put(18, 172, "ヽ ﾉ"); put(18, 210, "|")
put(19, 156, "ヽ"); put(19, 212, "|")
put(20, 186, "ヽ､"); put(20, 214, "|")
put(21, 204, "ヽ_ﾉ")
# neck, collar, cords
for r in (25, 26, 27): put(r, 374, '|')
for r in (23, 24, 25, 26): put(r, 214, '|')
put(27, 186, "_,.-‐'´")
put(28, 120, "_,.-‐''´"); put(28, 378, "｀ヽ､_")
put(29, 70, "_,.-‐''´"); put(29, 420, "￣｀ヽ､_")
put(30, 24, ",.-‐''´"); put(30, 476, "｀ヽ､")
put(31, 2, "/")
put(28, 218, "ヽ"); put(29, 228, "ヽ"); put(30, 238, "ヽ"); put(31, 250, "ヽ"); put(32, 258, "ヽ")
put(28, 240, "ヽ"); put(29, 256, "＼"); put(30, 274, "ヽ､"); put(31, 296, "｀ヽ､_,.-‐'"); put(30, 372, "/")
put(29, 382, "i"); put(30, 386, "i"); put(31, 390, "i"); put(32, 394, "i")

# ---------------- hair: long lock strands with paper between (line-led, like the long-hair references) -------------
def spell(pts, light=False):
    """Row-by-row spelling of a strand: steep parts one glyph per row, shallow parts dash runs at their height in the row."""
    o = []
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if y1 < y0: (x0, y0), (x1, y1) = (x1, y1), (x0, y0)
        for r in range(int(y0 // P), int(y1 // P) + 1):
            ya, yb = max(y0, r * P), min(y1, (r + 1) * P)
            if yb - ya < 3: continue
            xa = x0 + (x1 - x0) * (ya - y0) / max(y1 - y0, 1e-6); xb = x0 + (x1 - x0) * (yb - y0) / max(y1 - y0, 1e-6)
            w = abs(xb - xa); fr = ((ya + yb) / 2 - r * P) / P
            if w < 3: g = '|' if not light else 'i'
            elif w < 6: g = 'l' if not light else 'i'
            elif w < 11: g = '/' if xb < xa else ('ヽ' if w > 8 else '､')
            elif w < 20: g = '／' if xb < xa else 'ヽ'
            else:   # shallow: a stair run whose ink climbs toward the higher end
                up_left = xb < xa
                for run in (["`'´", ".-'´", "_,.-'´", "_,.-‐''´", "_,..-‐''´"] if up_left else ["｀'", "｀'‐.", "｀'‐-.,_", "｀''‐-.,_", "｀''‐-..,_"]):
                    if adv(run) >= w - 4: break
                o.append((r, min(xa, xb), run)); continue
            o.append((r, (xa + xb) / 2 - adv(g) / 2, g))
    return o
Lx = {4: 225, 5: 203, 6: 187, 7: 171, 8: 158, 9: 147, 10: 140, 11: 133, 12: 131, 13: 130, 14: 130, 15: 130}
Ex = {4: 300, 5: 290, 6: 262, 7: 251, 8: 235, 9: 227, 10: 230, 11: 233, 12: 230, 13: 229, 14: 227, 15: 226}
# locks start at the hairline, rise over the crown and fall down the back flank; short locks interleave near the core
Lx = {7: 171, 8: 158, 9: 147, 10: 140, 11: 133, 12: 131, 13: 130, 14: 130, 15: 130}
Ex = {7: 251, 8: 235, 9: 227, 10: 230, 11: 233, 12: 230, 13: 229, 14: 227, 15: 226}
def flank(t, start, last=15, end=None):
    pts = list(start) + [(Lx[r] + t * (Ex[r] - Lx[r]), r * P + 9) for r in range(7, last + 1)]
    return pts + ([end] if end else [])
STRANDS = [
    flank(0.14, [(350, 96), (318, 80), (282, 72), (244, 76), (208, 92), (184, 110)], 15, (142, 300)),   # crosses the crown
    flank(0.34, [(304, 98), (274, 92), (246, 98), (222, 112)], 15, (154, 286)),                         # crosses the crown
    flank(0.54, [(262, 108), (238, 116)], 15),
    flank(0.74, [(252, 118)], 14),
    flank(0.96, [], 12),
]
FRINGE = [[(330, 72), (366, 76), (392, 92), (408, 116), (418, 150), (424, 190)],
          [(362, 96), (390, 116), (406, 146), (416, 186)]]
for pts in STRANDS + FRINGE:
    for r, x, g in spell(pts): put(r, x, g)
# hairline against the temple and forehead: the inner edge of the hair, lock tips where strands end on skin
for r, x, g in [(13, 227, 'ﾘ'), (14, 224, 'ﾉ')]:
    put(r, x, g)
# bun: a knot of looped locks behind the ear, tied under the back of the head
put(19, 158, "ヽ"); put(19, 172, "ﾉ")
put(20, 140, "γ⌒ヽ､ﾉ")
put(21, 128, "(　彡ﾐ　ヽ､")
put(22, 134, "ゝ　ミ彡'ﾉ")
put(23, 142, "乂_ﾉ　/ ﾉ")
put(24, 180, "ゝ_ﾉ")

# ---------------- shadow fields placed on the photo's dark shapes ----------------
SH = {  # row: [(x0, x1, glyph, step)]
 12: [(372, 396, ':', 6)],                     # socket shadow between near brow and inner corner
 13: [(374, 396, '.', 9)],
 14: [(408, 420, '.', 6)],                     # far cheek below the far eye
 15: [(404, 428, '.', 8)],
 17: [(404, 424, ';', 5)],                     # under the nose
 21: [(410, 426, ';', 5)],                     # under the lower lip
 22: [(402, 416, ':', 6)],
 25: [(292, 344, '.', 10)],                    # shadow under the jaw onto the neck
 26: [(354, 368, ':', 8)],                     # neck front shadow plane
 27: [(352, 366, ':', 8)],
 28: [(350, 364, '.', 8)],
}
# ---------------- tone fields from the image ----------------
def runs(mask_row, minw=6):
    xs = np.where(mask_row)[0]
    if not len(xs): return []
    o = []; st = pv = xs[0]
    for x in xs[1:]:
        if x > pv + 3: o.append((st, pv)); st = x
        pv = x
    o.append((st, pv)); return [(a, b) for a, b in o if b - a >= minw]
import os
HAIRTONE = os.environ.get('HAIRTONE', '0') == '1'
FACE_SHADOW_ROWS = range(10, 33)
def tone_rows():
    T = {}
    for r in range(3, 33):
        y = r * P + 9
        hair = nt[y] < 60
        hair[:120] = False
        if r >= 16: hair[150:240] &= (np.arange(150, 240) < 165) if r < 20 else True   # ear is not hair
        if r >= 10: hair[290:398] = False                                                 # brows/eyes are drawn, not hair tone
        if r >= 13: hair[290:] = False
        if r >= 26: hair[:] = False
        if HAIRTONE:
            for a, b in runs(hair):
                T.setdefault(r, []).append((a + 3, b - 3, ':', 6, 1))
    for r, L in SH.items():
        for x0, x1, g, st in L: T.setdefault(r, []).append((x0, x1, g, st, 0))
    return T

def build():
    R = {}
    T = tone_rows()
    for r in set(H) | set(T):
        items = sorted(H.get(r, [])); occ = [(x - 3, x + adv(g) + 3) for x, g in items]
        for x0, x1, g, step, ph_ in T.get(r, []):
            if g == 'HAIR':
                x = x0
                while x < x1:
                    gg = flow(r, x); w = adv(gg)
                    if x + w > x1: break
                    if any(abs(x + w / 2 - c) < 6 for c in CHAN.get(r, [])) or any(a < x + w and x < b for a, b in occ):
                        x += 5; continue
                    items.append((x, gg)); occ.append((x, x + w)); x += w
                continue
            x = math.ceil((x0 - ph_ * (r % 2) * step / 2) / step) * step + ph_ * (r % 2) * step / 2
            while x + adv(g) <= x1:
                if not any(a < x + adv(g) and x < b for a, b in occ):
                    items.append((x, g)); occ.append((x, x + adv(g)) if step == 3 else (x - 1, x + adv(g) + 1))
                x += step
        R[r] = items
    return R

if __name__ == '__main__':
    out(build(), '0007', sys.argv[1] if len(sys.argv) > 1 else 'forkB-13', 34)
