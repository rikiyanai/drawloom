import json,base64,io,math,numpy as np
from PIL import Image, ImageDraw
d=json.load(open('data3d.json')); V={k:np.array(v) for k,v in d['verts'].items()}
COL={'forehead':(200,60,40),'temple':(150,80,40),'brow':(160,40,140),'socket':(40,120,200),'eye':(0,90,220),'nose':(220,120,0),'cheek':(30,150,90),'mouth':(210,40,80),'chin':(120,60,200),'jaw':(80,80,80),'neck':(120,0,160)}
tiles=[]
for a in d['angles']:
    M,c,dr,d0=np.array(a['M']),np.array(a['c']),np.array(a['drow']),a['d0']
    z=a['zb']; q=np.frombuffer(base64.b64decode(z['data']),'<u2').reshape(z['h'],z['w']).astype(float); zb=np.where(q==65535,np.inf,z['lo']+q/65534*(z['hi']-z['lo']))
    pj=lambda X:M@X+c; dp=lambda X:dr@X+d0
    eps=0.08*d['loomis']['sphR']*a['scale']
    def vis(X):
        p=pj(X); i,j=int(p[1]//z['k']),int(p[0]//z['k'])
        if not(0<=i<z['h'] and 0<=j<z['w']) or not np.isfinite(zb[i,j]): return True
        return dp(X)<=zb[i,j]+eps
    im=Image.open(io.BytesIO(base64.b64decode(a['photo'].split(',')[1]))).convert('RGB')
    im=Image.blend(im,Image.new('RGB',im.size,'white'),0.4); S=2; im=im.resize((im.width*S,im.height*S)); D=ImageDraw.Draw(im)
    for pl in d['poly']:
        g=d['names'][pl[0]]['group']
        for u,v in zip(pl,pl[1:]):
            for t in np.linspace(0,1,12)[:-1]:
                X1=V[u]+(V[v]-V[u])*t; X2=V[u]+(V[v]-V[u])*(t+1/11)
                if vis((X1+X2)/2): D.line([tuple(pj(X1)*S),tuple(pj(X2)*S)],fill=COL.get(g,(200,0,0)),width=2)
    for ir,eye in zip(d['iris'],d['irisEye']):
        C=np.array(ir['c']);r=ir['r']
        if not vis(C): continue
        D.line([tuple(pj(C+r*np.array([math.cos(t),math.sin(t),0]))*S) for t in np.linspace(0,2*math.pi,48)],fill=(0,60,200),width=2)
    Lm=d['loomis']; SC=np.array(Lm['sphC']); R=Lm['sphR']; view=np.array(a['view'])
    # sphere silhouette: circle radius R*scale around projected centre
    cp=pj(SC); rp=R*a['scale']; D.ellipse([(cp[0]-rp)*S,(cp[1]-rp)*S,(cp[0]+rp)*S,(cp[1]+rp)*S],outline=(0,120,255),width=2)
    RT,UP,BK=np.array(Lm['right']),np.array(Lm['up']),np.array(Lm['back'])
    rings=[]
    for sgn in (-1,1):
        k=Lm['cutK']; cc=SC+RT*sgn*k*R; rr=R*math.sqrt(1-k*k)
        rings.append([cc+rr*(UP*math.cos(t)+BK*math.sin(t)) for t in np.linspace(0,2*math.pi,72)])
    rings.append([SC+R*(RT*math.cos(t)+BK*math.sin(t)) for t in np.linspace(0,2*math.pi,96)])   # brow line
    rings.append([SC+R*(UP*math.cos(t)+BK*math.sin(t)) for t in np.linspace(0,2*math.pi,96)])   # centre line
    for pts in rings:
        for X1,X2 in zip(pts,pts[1:]):
            nrm=(X1-SC)/np.linalg.norm(X1-SC); front=nrm@view<0
            if front: D.line([tuple(pj(X1)*S),tuple(pj(X2)*S)],fill=(0,160,120),width=2)
    nc=np.array(Lm['neckC']); nd=np.array(Lm['neckDir']); nr=Lm['neckR']; L=Lm['neckLen']
    # cylinder silhouette: directions perpendicular to axis and view
    sdir=np.cross(nd,view); sdir/=np.linalg.norm(sdir)
    for sg in(-1,1): D.line([tuple(pj(nc+sg*nr*sdir)*S),tuple(pj(nc+nd*L+sg*nr*sdir)*S)],fill=(150,0,200),width=2)
    for ms in ('mastoidL','mastoidR'):
        Xm=np.array(Lm[ms]); Xp=np.array(Lm['pit'])
        if vis(Xm) or True: D.line([tuple(pj(Xm)*S),tuple(pj(Xp)*S)],fill=(200,0,200),width=2)
    tiles.append(im.resize((500,int(500*im.height/im.width))))
W=Image.new('RGB',(2010,max(t.height for t in tiles)),'white')
for i,t in enumerate(tiles): W.paste(t,(i*503,0))
W.save('preview3d.png')
