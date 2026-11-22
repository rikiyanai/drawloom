import sys
from refsheet import lib, text_of, render_aa
from PIL import Image, ImageDraw, ImageFont
F=ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc',22)
LIBS={'musician':'実在人物パロディ歌手・ミュージシャン','actorJP':'実在人物パロディ俳優・女優01（日本の俳優・女優）','actorWW':'実在人物パロディ俳優・女優02（外国の俳優・女優）'}
cache={}
def piece(tag,i):
    if tag not in cache: cache[tag]=lib(LIBS[tag])[1]
    return text_of(cache[tag][i]).strip('\n')
def board(title, picks, out, cols=3, W=520):
    ims=[]
    for tag,i in picks:
        im=render_aa(piece(tag,i)).convert('RGB'); s=W/max(im.size[0],1)
        if s<1: im=im.resize((W,int(im.size[1]*s)),Image.LANCZOS)
        ims.append((f'{tag}[{i}]',im))
    rows=[ims[k:k+cols] for k in range(0,len(ims),cols)]
    H=60+sum(max(i.size[1] for _,i in r)+40 for r in rows)
    B=Image.new('RGB',(cols*(W+20)+20,H),'white'); d=ImageDraw.Draw(B); d.text((20,16),title,font=F,fill='black'); y=60
    for r in rows:
        for c,(lab,im) in enumerate(r):
            x=20+c*(W+20); d.text((x,y),lab,font=F,fill=(180,0,0)); B.paste(im,(x,y+30))
        y+=max(i.size[1] for _,i in r)+40
    B.save(out,quality=90); print(out,B.size)
GROUPS={
 'front':('Front (capture 0001/0004): swept or long hair, male, line-led',[('musician',123),('musician',322),('musician',390),('actorWW',57),('actorWW',176),('actorWW',170),('actorJP',116),('actorJP',5),('musician',61)]),
 'threequarter':('Three-quarter (capture 0007 / 0028): turned head, jaw and far eye',[('musician',85),('musician',19),('musician',511),('actorWW',121),('actorWW',124),('actorWW',252),('actorJP',299),('actorJP',300),('actorJP',196)]),
 'tiedback':('Hair tied back / ponytail, three-quarter (all your side views show the bun)',[('actorWW',130),('actorWW',134),('actorWW',135),('musician',530),('actorJP',163),('actorJP',216)]),
 'profile':('Profile (capture 0010 / 0025) and near-profile',[('musician',6),('musician',233),('musician',478),('actorWW',138),('actorWW',247),('musician',433)]),
}
for k,(t,p) in GROUPS.items(): board(t,p,f'/private/tmp/claude-501/-Users-rikihernandez/5591bff3-64a4-4eda-ad29-a402158ce2b9/scratchpad/refs/board-{k}.jpg')
