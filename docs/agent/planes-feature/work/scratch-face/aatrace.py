"""Local AAHub-style trace: photo -> person cut-out (BiRefNet) -> manga lines (MangaLineExtraction) -> AA at N rows
(stnk20/DifferentiableAsciiArtRenderer, 18 px rows). usage: aatrace.py <img> <outdir> <rows...> [--lines-in]"""
import os, sys
os.environ['TF_USE_LEGACY_KERAS'] = '1'; os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
import numpy as np, cv2
from pathlib import Path
R = Path.home() / 'DifferentiableAsciiArtRenderer'; M = Path.home() / 'MangaLineExtraction_PyTorch'

def cutout(img):
    import onnxruntime as ort
    s = ort.InferenceSession(str(Path.home() / '.u2net/BiRefNet-portrait-epoch_150.onnx'), providers=['CPUExecutionProvider'])
    x = cv2.resize(cv2.cvtColor(img, cv2.COLOR_BGR2RGB), (1024, 1024)).astype(np.float32) / 255
    x = (x - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]
    o = s.run(None, {s.get_inputs()[0].name: x.transpose(2, 0, 1)[None].astype(np.float32)})[0][0, 0]
    a = cv2.resize(1 / (1 + np.exp(-o)), (img.shape[1], img.shape[0]))[..., None]
    return (img * a + 255 * (1 - a)).astype(np.uint8)

def lines(img):
    import torch; sys.path.insert(0, str(M)); from model_torch import res_skip
    m = res_skip(); m.load_state_dict(torch.load(M / 'erika.pth', map_location='cpu')); m.eval()
    src = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    r, c = int(np.ceil(src.shape[0] / 16)) * 16, int(np.ceil(src.shape[1] / 16)) * 16
    p = np.ones((1, 1, r, c), np.float32) * 255; p[0, 0, :src.shape[0], :src.shape[1]] = src
    with torch.no_grad(): y = m(torch.from_numpy(p)).numpy()[0, 0]
    return np.clip(y, 0, 255)[:src.shape[0], :src.shape[1]].astype(np.uint8)

def to_aa(line_img, rows):
    os.chdir(R); sys.path.insert(0, str(R))
    import tensorflow.keras.backend as K
    from models import build_encoder, hardmax, decide_placement
    import ast
    src = (R / 'predict.py').read_text(encoding='utf-8')
    fn = [n for n in ast.parse(src).body if isinstance(n, ast.FunctionDef) and n.name == 'array2texts'][0]
    ns = {'np': np, 'decide_placement': decide_placement}; exec(compile(ast.Module([fn], []), 'predict.py', 'exec'), ns)
    array2texts = ns['array2texts']
    from param import CHAR_HEIGHT
    h = rows * CHAR_HEIGHT; w = int(round(line_img.shape[1] * h / line_img.shape[0]))
    g = cv2.resize(line_img, (w, h), interpolation=cv2.INTER_AREA)
    ink = (g < int(os.environ.get("AA_THRESH", "230"))).astype(np.float32)          # dark line pixels -> 1 (the model expects ink=1 on 0)
    enc = build_encoder(h, w); enc.load_weights(str(R / 'weights.h5'))
    cand = hardmax(enc(ink[None, ..., None], training=False))
    mask = K.constant(np.load(R / 'mask.npy'))
    return array2texts(cand, mask)[0].replace('\r\n', '\n'), ink

if __name__ == '__main__':
    img_path, out = str(Path(sys.argv[1]).resolve()), Path(sys.argv[2]).resolve(); rows = [int(a) for a in sys.argv[3:] if a.isdigit()]
    out.mkdir(parents=True, exist_ok=True); name = Path(img_path).stem
    img = cv2.imread(str(Path(img_path).resolve()))
    if '--lines-in' in sys.argv: ln = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    else:
        cut = cutout(img); cv2.imwrite(str(out / f'{name}-cutout.png'), cut)
        ln = lines(cut); cv2.imwrite(str(out / f'{name}-lines.png'), ln)
    for r in rows:
        text, ink = to_aa(ln, r)
        (out / f'{name}-{r}rows.txt').write_text(text, encoding='utf-8')
        cv2.imwrite(str(out / f'{name}-{r}rows-input.png'), (255 - 255 * ink).astype(np.uint8))
        print(name, r, 'rows ->', len(text.rstrip('\n').split('\n')), 'lines')
