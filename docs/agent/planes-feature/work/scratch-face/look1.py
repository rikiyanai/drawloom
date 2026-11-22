import sys
from PIL import Image
import tracer as T
W,H=612,558
wh=Image.new('RGB',(W,H),'white')
ph=Image.open('local/ph612.png').convert('RGB')
cel=Image.blend(Image.open('local/dl-cel-0001.png').convert('RGB'),wh,0.5)
b=tuple(map(int,sys.argv[3].split(','))) if len(sys.argv)>3 else (140,20,480,460)
z=float(sys.argv[4]) if len(sys.argv)>4 else 1
ts=[open(f).read() for f in sys.argv[1].split(',')]
ims=[ph]+[T.render(t,(W,H)) for t in ts]+[T.render(ts[-1],(W,H),cel,(220,0,0))]
sz=(int((b[2]-b[0])*z),int((b[3]-b[1])*z))
ims=[i.crop(b).resize(sz,Image.LANCZOS) for i in ims]
S=Image.new('RGB',(len(ims)*(sz[0]+10),sz[1]),'white')
for k,im in enumerate(ims): S.paste(im,(k*(sz[0]+10),0))
S.save(sys.argv[2])
