import json,gzip,sys,re
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
sys.path.insert(0,'.')
from aa import font,adv,PITCH
ROOT=Path('/Users/rikihernandez/ascii-art-archive')
rows=[json.loads(l) for l in open(ROOT/'collections/aahub-mlt/index.jsonl')]
def lib(sub):
    r=[x for x in rows if x['path'].endswith(sub)][0]
    return r, json.load(gzip.open(ROOT/r['stored']))['aa']
def text_of(a): return a if isinstance(a,str) else (a.get('value') or a.get('aa') or a.get('text') or '')
def render_aa(t):
    ls=t.split('\n'); w=int(max(adv(l) for l in ls))+8; h=len(ls)*PITCH+8
    im=Image.new('L',(w,h),255); d=ImageDraw.Draw(im)
    for i,l in enumerate(ls): d.text((4,4+i*PITCH),l,font=font,fill=0)
    return im
def candidates(aa, rmin=14, rmax=42, wmin=260):
    out=[]
    for i,a in enumerate(aa):
        t=text_of(a).strip('\n')
        ls=t.split('\n')
        if not (rmin<=len(ls)<=rmax): continue
        if max(adv(l) for l in ls)<wmin: continue
        # skip pieces dominated by kana/kanji text lines (captions)
        out.append((i,t))
    return out
def sheet(items, label, out, cols=6, th=260):
    n=len(items); r=(n+cols-1)//cols
    S=Image.new('L',(cols*th,r*(th+16)),255); d=ImageDraw.Draw(S)
    for k,(i,t) in enumerate(items):
        im=render_aa(t); im.thumbnail((th-6,th-6),Image.LANCZOS)
        x=(k%cols)*th; y=(k//cols)*(th+16); S.paste(im,(x+3,y+16)); d.text((x+3,y+2),f'{label}[{i}]',fill=0)
    S.save(out,quality=85)
if __name__=='__main__':
    sub,tag=sys.argv[1],sys.argv[2]
    r,aa=lib(sub); c=candidates(aa)
    print(sub,len(aa),'->',len(c))
    for s in range(0,len(c),36):
        sheet(c[s:s+36],tag,f'/private/tmp/claude-501/-Users-rikihernandez/5591bff3-64a4-4eda-ad29-a402158ce2b9/scratchpad/refs/{tag}-{s//36:02d}.jpg')
