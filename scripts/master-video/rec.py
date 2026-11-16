import subprocess,time,os,signal,sys
# Run from the repository root: python3 scripts/master-video/rec.py
S=os.path.abspath(".qa/master")
os.makedirs(S,exist_ok=True)
FLOW=os.path.abspath("scripts/master-video/master.yaml")
U="D433B7C5-5DD9-4BA6-82CB-19EA3E0CB8BA"
subprocess.run(["xcrun","simctl","status_bar",U,"override","--time","9:41","--dataNetwork","wifi","--wifiMode","active","--wifiBars","3","--cellularMode","active","--cellularBars","4","--batteryState","charged","--batteryLevel","100"])
rec=subprocess.Popen(["xcrun","simctl","io",U,"recordVideo","--codec=h264","--force",S+"/raw.mp4"],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
start=None
for line in rec.stdout:
    if "Recording started" in line:
        start=time.time(); break
open(S+"/start.txt","w").write(str(start)); print("rec start",start)
env=dict(os.environ,SIMULATOR_UDID=U,PATH="/opt/homebrew/opt/openjdk@21/bin:"+os.path.expanduser("~/.maestro/bin")+":/opt/homebrew/bin:"+os.environ["PATH"],JAVA_HOME="/opt/homebrew/opt/openjdk@21")
r=subprocess.run(["npm","run","-s","test:ios","--",FLOW],env=env,stdout=open(S+"/flow.log","w"),stderr=subprocess.STDOUT)
print("flow exit",r.returncode); time.sleep(1)
rec.send_signal(signal.SIGINT); rec.wait()
subprocess.run(["xcrun","simctl","status_bar",U,"clear"])
