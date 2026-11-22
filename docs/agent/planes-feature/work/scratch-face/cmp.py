import sys
from PIL import Image
import tracer as T
W,H=612,558
txt=open(sys.argv[1]).read()
ph=Image.open('local/ph612.png').convert('RGB')
wh=Image.new('RGB',(W,H),'white')
line=Image.blend(Image.open('local/dl-line-0001.png').convert('RGB'),wh,0.55)
cel=Image.blend(Image.open('local/dl-cel-0001.png').convert('RGB'),wh,0.55)
x0,y0,x1,y1=map(int,sys.argv[3].split(',')); z=float(sys.argv[4])
ims=[ph,T.render(txt,(W,H)),T.render(txt,(W,H),line,(220,0,0)),T.render(txt,(W,H),cel,(220,0,0))]
ims=[i.crop((x0,y0,x1,y1)).resize((int((x1-x0)*z),int((y1-y0)*z)),Image.LANCZOS) for i in ims]
S=Image.new('RGB',(sum(i.width for i in ims)+30,ims[0].height),'white');x=0
for i in ims: S.paste(i,(x,0)); x+=i.width+10
S.save(sys.argv[2])
