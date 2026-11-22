"""Fork I: map Riki 0007 (ud frame) into the art[340] base frame by a similarity fit on near eye, nose tip, chin."""
import sys, numpy as np
from PIL import Image, ImageDraw
from aa import render
from angle_tool import UD, photo
W, H = 400, 420
def sim(src, dst):
    src, dst = np.array(src, float), np.array(dst, float); ms, md = src.mean(0), dst.mean(0)
    A, B = src - ms, dst - md; zs = A[:, 0] + 1j * A[:, 1]; zd = B[:, 0] + 1j * B[:, 1]
    a = (np.conj(zs) @ zd) / (np.conj(zs) @ zs); return a, md - (a * (ms[0] + 1j * ms[1])).real, md - (a * (ms[0] + 1j * ms[1])).imag
FIT = None
def set_fit(src, dst):
    global FIT
    src, dst = np.array(src, float), np.array(dst, float); ms, md = src.mean(0), dst.mean(0)
    zs = (src - ms) @ [1, 1j]; zd = (dst - md) @ [1, 1j]
    a = (np.conj(zs) @ zd) / (np.conj(zs) @ zs); FIT = (a, ms, md); return abs(a)
def fwd(p):
    a, ms, md = FIT; z = a * ((p[0] - ms[0]) + 1j * (p[1] - ms[1])); return (md[0] + z.real, md[1] + z.imag)
def warp(im, size=(W, H)):
    a, ms, md = FIT; ai = 1 / a
    # src = ai*(dst-md)+ms ; affine coeffs for PIL (maps output -> input)
    c, s = ai.real, ai.imag
    return im.transform(size, Image.AFFINE, (c, -s, ms[0] - c * md[0] + s * md[1], s, c, ms[1] - s * md[0] - c * md[1]), Image.BICUBIC, fillcolor=(255, 255, 255))
def grid(im, k=2):
    im = im.resize((im.width * k, im.height * k), Image.LANCZOS); d = ImageDraw.Draw(im)
    for i in range(im.height // (17 * k) + 1): d.line([(0, i * 17 * k), (im.width, i * 17 * k)], fill=(170, 190, 255)); d.text((im.width - 20, i * 17 * k + 2), str(i), fill=(60, 60, 220))
    for x in range(0, im.width // k, 20): d.line([(x * k, 0), (x * k, 6)], fill=(255, 0, 255)); d.text((x * k + 2, 6), str(x), fill=(255, 0, 255))
    return im
