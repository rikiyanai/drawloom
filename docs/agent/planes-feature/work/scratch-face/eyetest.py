import sys, json
from PIL import Image
import tracer as T
from aa import layout
W,H=612,558
ph=Image.open('local/ph612.png').convert('RGB')
line=Image.blend(Image.open('local/dl-line-0001.png').convert('RGB'),Image.new('RGB',(W,H),'white'),0.55)
V=json.load(open(sys.argv[1])); box=tuple(map(int,sys.argv[3].split(','))); z=float(sys.argv[4])
sz=(int((box[2]-box[0])*z),int((box[3]-box[1])*z))
tiles=[ph.crop(box).resize(sz)]
for k,v in V.items():
    t='\n'.join(layout([tuple(i) for i in v.get(str(r),[])]) for r in range(31))
    tiles+= [T.render(t,(W,H)).crop(box).resize(sz), T.render(t,(W,H),line,(220,0,0)).crop(box).resize(sz)]
n=len(tiles); cols=3
S=Image.new('RGB',(cols*(sz[0]+8),((n+cols-1)//cols)*(sz[1]+8)),'white')
for i,t in enumerate(tiles): S.paste(t,((i%cols)*(sz[0]+8),(i//cols)*(sz[1]+8)))
S.save(sys.argv[2])
