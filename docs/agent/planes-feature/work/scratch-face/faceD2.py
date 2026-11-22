"""D2 = D with small repairs only: moustache dots and slot mouth -> soft upper-lip outline + one parting line;
lopsided nostril dot -> two matched nostril marks; hair locks continue past the right ear toward the jaw."""
import sys
from aa import layout, check
import importlib.util
spec = importlib.util.spec_from_file_location('Dm', 'author0001-D.py'); Dm = importlib.util.module_from_spec(spec); spec.loader.exec_module(Dm)
R = {r: list(v) for r, v in Dm.R.items()}
R[16] = [(176, 'ゞ'), (196, 'i'), (290, '"'), (322, '"'), (414, 'i'), (424, 'ﾉ'), (444, 'ﾘﾉ')]
R[17] = [(184, '｀'), (198, '!'), (414, '!'), (446, 'ﾘ'), (456, 'ﾉ')]
R[18] = [(204, 'ヽ'), (266, "_,.-‐''¨￣¨''‐-.,_"), (410, 'i'), (448, "'")]
R[19] = [(210, 'ヽ'), (270, '｀￣￣￣￣￣´'), (404, '/')]
def build(n=31):
    return '\n'.join(layout([i for i in R.get(r, []) if i[1]]) for r in range(n))
if __name__ == '__main__':
    t = build(); open('local/D2.txt', 'w').write(t + '\n'); print('law:', check(t) or 'ok')
