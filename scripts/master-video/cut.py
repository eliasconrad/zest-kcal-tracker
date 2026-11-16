# python3 scripts/master-video/cut.py <maestro run folder> 20 0.3
import subprocess,numpy as np,re,glob,json,bisect,sys,datetime,os
S=os.path.abspath(".qa/master")
D=sys.argv[1]; FF="/opt/homebrew/bin/ffmpeg"
start=float(open(S+"/start.txt").read())
log=open(glob.glob(D+"/xctest_runner_*.log")[0],errors="ignore").read()
taps=[]
for m in re.finditer(r"(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d\.\d+)\+\d{4} \S+ Tapping ([\d.]+), ([\d.]+)",log):
    t=datetime.datetime.strptime(m.group(1),"%Y-%m-%d %H:%M:%S.%f").timestamp()
    taps.append((t-start,float(m.group(2)),float(m.group(3))))
c=json.load(open(glob.glob(D+"/*/commands.json")[0]))
times=[(x['metadata']['timestamp']/1000-start,x) for x in c]
first=[t for t,x in times if 'Snap it' in str(x['command'])][0]
last=times[-1][0]+times[-1][1]['metadata'].get('duration',0)/1000
print("first",round(first,1),"last",round(last,1),"taps",len(taps),"firsttap",round(taps[0][0],1))
A=int((first-1.0)*30); Z=int((last-0.3)*30)
W=120;H=261
raw=subprocess.check_output([FF,"-v","error","-i",S+"/raw.mp4","-vf",f"fps=30,scale={W}:{H}","-f","rawvideo","-pix_fmt","gray","-"])
n=len(raw)//(W*H); fr=np.frombuffer(raw,dtype=np.uint8).reshape(n,H,W).astype(np.int16)
Z=min(Z,n-1)
# Begin on the first bright frame: the app is open, the phone is about to slide in.
dark=[i for i in range(0,int(taps[0][0]*30)) if fr[i].mean()<50]
A=next(i for i in range(dark[-1],n) if fr[i].mean()>200)
print("start",round(A/30,2))
m=np.abs(fr[1:]-fr[:-1]).mean(axis=(1,2)); moving=m>float(sys.argv[3])
HOLD=int(sys.argv[2]) if len(sys.argv)>2 else 20
tapf=[int(t*30) for t,_,_ in taps]
keep=[];still=0
for i in range(A,Z+1):
    if i>A and moving[i-1]: still=0;keep.append(i)
    else:
        still+=1
        # A finger lands: show the frames right before it, so the mark has time to appear.
        near=any(0<=f-i<=8 for f in tapf)
        if still<=HOLD or near: keep.append(i)
print("raw frames",Z-A,"kept",len(keep),"seconds",round(len(keep)/30,1))
if "--dry" in sys.argv: sys.exit()
OW=1206;OH=2622;PT=OW/402
marks=[(bisect.bisect_left(keep,f),x*PT,y*PT) for f,(t,x,y) in zip(tapf,taps)]
R=42.0
def touch(f,pos):
    for at,cx,cy in marks:
        d=pos-at
        if d<-7 or d>9: continue
        a=(d+7)/5 if d<-2 else (1 if d<=3 else (9-d)/6)
        scale=1-0.1*min(1,(d+7)/5) if d<=3 else 0.9+0.25*(d-3)/6
        r=R*scale
        x0,x1=max(0,int(cx-r-6)),min(OW,int(cx+r+6)); y0,y1=max(0,int(cy-r-6)),min(OH,int(cy+r+6))
        yy,xx=np.mgrid[y0:y1,x0:x1]
        dist=np.hypot(xx-cx,yy-cy)
        fill=np.clip(r-dist+.5,0,1)[...,None]*0.2*a
        ring=np.clip(2.6-np.abs(dist-r+1.6),0,1)[...,None]*0.6*a
        p=f[y0:y1,x0:x1].astype(np.float32)
        p=p*(1-fill)+np.array([37,39,32],dtype=np.float32)*fill
        p=p*(1-ring)+np.array([255,255,255],dtype=np.float32)*ring
        f[y0:y1,x0:x1]=p.astype(np.uint8)
dec=subprocess.Popen([FF,"-v","error","-i",S+"/raw.mp4","-vf",f"fps=30,scale={OW}:{OH}","-f","rawvideo","-pix_fmt","rgb24","-"],stdout=subprocess.PIPE)
enc=subprocess.Popen([FF,"-y","-v","error","-f","rawvideo","-pix_fmt","rgb24","-s",f"{OW}x{OH}","-r","30","-i","-","-an","-vf","scale=out_color_matrix=bt709:out_range=tv,format=yuv420p","-c:v","libx264","-profile:v","high","-crf","20","-preset","medium","-color_primaries","bt709","-color_trc","bt709","-colorspace","bt709","-color_range","tv","-tag:v","avc1","-movflags","+faststart",S+"/zest-master.mp4"],stdin=subprocess.PIPE)
ks=set(keep);out=0;need=OW*OH*3
last_frame=None
for i in range(Z+1):
    b=dec.stdout.read(need)
    if len(b)<need: break
    if i not in ks: continue
    f=np.frombuffer(b,dtype=np.uint8).reshape(OH,OW,3).copy()
    touch(f,out)
    enc.stdin.write(f.tobytes());out+=1;last_frame=f
for j in range(45):
    enc.stdin.write(last_frame.tobytes());out+=1
enc.stdin.close();enc.wait();dec.kill()
print("seconds",round(out/30,1))
