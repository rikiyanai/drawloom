"""Text AA -> {row: [(x_px, run)]} using Saitamaar advances (runs split at spaces)."""
from aa import adv
def parse(text):
    R = {}
    for r, line in enumerate(text.split('\n')):
        x, cur, cx = 0.0, '', None
        for ch in line:
            if ch in ' 　':
                if cur: R.setdefault(r, []).append((cx, cur)); cur = ''
                x += adv(ch)
            else:
                if not cur: cx = x
                cur += ch; x += adv(ch)
        if cur: R.setdefault(r, []).append((cx, cur))
    return R
