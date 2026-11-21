"""Planes of the face for capture 0001, drawn over the Drawloom B/W line drawing (612x558 frame).
Vertices: MediaPipe landmarks registered to the drawing (local/lm0001.npy), corrected by eye to the drawn contours."""
import numpy as np
from PIL import Image, ImageDraw
P = np.load('local/lm0001.npy')
L = lambda i: tuple(P[i])
S = 3
# --- vertices (x, y) in the 612 frame ---
V = dict(
 # forehead / temples
 ftL=(240, 113), ftR=(362, 110), trL=(212, 192), trR=(398, 180), tsL=(192, 205), tsR=(411, 193), tlL=(197, 257), tlR=(420, 244),
 # brow ridge
 brL0=(212, 207), brL1=(240, 193), brL2=(280, 192), gl0=(296, 202), gl1=(318, 200), brR1=(332, 190), brR2=(370, 182), brR0=(400, 199),
 nas0=(295, 220), nas1=(318, 219),
 # eye sockets
 soLo=(213, 242), soLlo=(229, 259), soLli=(266, 258), soLi=(286, 238),
 soRo=(399, 228), soRlo=(388, 250), soRli=(350, 252), soRi=(330, 236),
 # nose
 tip0=(299, 262), tip1=(320, 262), tip2=(323, 285), tip3=(297, 285),
 nsL=(283, 293), nsR=(343, 288), wL0=(286, 298), wL1=(292, 303), wR0=(339, 299), wR1=(328, 302), sub=(314, 300),
 # cheeks
 ckL=(222, 290), ckR=(392, 281), hoL=(226, 335), hoR=(398, 322),
 mcL=(271, 346), mcR=(352, 343), nlL=(262, 330), nlR=(356, 328),
 # mouth
 lpL=(300, 325), lp0=(311, 328), lpR=(323, 324), pt=(312, 343), llL=(285, 357), llR=(338, 355), ll0=(312, 359),
 ml0=(295, 370), ml1=(330, 368),
 # chin / jaw
 chL=(274, 395), chR=(352, 389), cbL=(288, 418), cb0=(311, 423), cbR=(338, 415),
 jaL=(233, 395), jaR=(390, 383), eaL=(205, 342), eaR=(411, 333),
 feL=(268, 111), feL1=(262, 191), feR=(338, 110), feR1=(338, 189), skL=(250, 62), skR=(355, 60),
 ph0=(306, 302), ph1=(299, 326), ph2=(322, 301), ph3=(326, 325), zaL=(203, 282), zaR=(410, 272), sjL=(282, 428), sjC=(311, 435), sjR=(340, 426),
 eLo=(229, 239), eLu1=(240, 229), eLu=(257, 225), eLu2=(270, 227), eLi=(281, 236), eLl2=(270, 243), eLl=(255, 245), eLl1=(240, 244),
 eRo=(387, 229), eRu1=(374, 222), eRu=(360, 220), eRu2=(346, 223), eRi=(335, 229), eRl2=(346, 236), eRl=(360, 238), eRl1=(375, 236),
 crL0=(230, 228), crL1=(250, 216), crL2=(277, 225), crR0=(335, 223), crR1=(358, 210), crR2=(393, 219),
 # neck
 nkL=(233, 450), nkR=(394, 445),
)
POLY = [  # open polylines (construction)
 'ftL trL brL0', 'ftR trR brR0', 'ftL ftR', 'trL tsL tlL', 'trR tsR tlR',
 'brL0 brL1 brL2 gl0', 'gl1 brR1 brR2 brR0', 'trL brL1', 'trR brR2', 'gl0 nas0', 'gl1 nas1', 'gl0 gl1',
 'brL0 soLo soLlo soLli soLi nas0', 'brR0 soRo soRlo soRli soRi nas1',
 'nas0 tip0', 'nas1 tip1', 'tip0 tip1 tip2 tip3 tip0', 'soLi nsL wL0 wL1 sub wR1 wR0 nsR soRi', 'tip3 wL1', 'tip2 wR1', 'tip3 nsL', 'tip2 nsR',
 'soLo ckL hoL eaL', 'soRo ckR hoR eaR', 'soLlo ckL', 'soRlo ckR', 'soLli nsL', 'soRli nsR',
 'nsL nlL mcL', 'nsR nlR mcR', 'ckL nlL', 'ckR nlR', 'hoL mcL', 'hoR mcR',
 'sub lp0', 'mcL lpL lp0 lpR mcR', 'mcL pt mcR', 'mcL llL ll0 llR mcR', 'llL ml0 ml1 llR',
 'mcL chL', 'mcR chR', 'ml0 chL', 'ml1 chR', 'chL cbL cb0 cbR chR', 'ml0 cbL', 'ml1 cbR',
 'tlL eaL jaL cbL', 'tlR eaR jaR cbR', 'hoL jaL', 'hoR jaR',
 'jaL nkL', 'jaR nkR',
 'feL feL1', 'feR feR1', 'skL skR', 'skL ftL', 'skR ftR', 'skL tsL', 'skR tsR', 'mcL jaL', 'mcR jaR', 'ph0 ph1', 'ph2 ph3', 'soLo zaL', 'soRo zaR',
 'jaL sjL sjC sjR jaR',
 'eLo eLu1 eLu eLu2 eLi eLl2 eLl eLl1 eLo', 'eRo eRu1 eRu eRu2 eRi eRl2 eRl eRl1 eRo', 'crL0 crL1 crL2', 'crR0 crR1 crR2',
]
EYES = [  # MediaPipe lid rings, drawn as faceted almonds
 [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7, 33],
 [263, 466, 388, 387, 386, 385, 384, 398, 362, 382, 381, 380, 374, 373, 390, 249, 263]]
IRIS = [((256, 235), 12, 226, 245), ((361, 227), 11, 220, 238)]  # centre, radius, upper-lid clip y, lower-lid clip y

def draw(base, out, color=(220, 0, 0)):
    im = Image.open(base).convert('RGB').resize((612 * S, 558 * S), Image.LANCZOS)
    im = Image.blend(im, Image.new('RGB', im.size, 'white'), 0.35)
    d = ImageDraw.Draw(im)
    for pl in POLY:
        pts = [tuple(c * S for c in V[k]) for k in pl.split()]
        d.line(pts, fill=color, width=3)
    for ring in []:
        d.line([tuple(c * S for c in L(i)) for i in ring], fill=color, width=3)
    import math
    for (x, y), r, clip, clip2 in IRIS:   # iris under the upper lid: only the arc below the lid line
        pts = [((x + r * math.cos(a)) * S, (y + r * math.sin(a)) * S) for a in [i * math.pi / 60 for i in range(121)]]
        seg = []
        for p in pts:
            if clip * S <= p[1] <= clip2 * S: seg.append(p)
            elif len(seg) > 1: d.line(seg, fill=color, width=3); seg = []
            else: seg = []
        if len(seg) > 1: d.line(seg, fill=color, width=3)
    im.save(out)
    return im

if __name__ == '__main__':
    im = draw('local/dl-line-0001.png', 'local/planes-0001.png')
    im.crop((150 * S, 90 * S, 470 * S, 470 * S)).resize((960, 1140), Image.LANCZOS).save('local/planes-0001-face.png')
