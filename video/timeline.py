import json,subprocess
r=json.load(open('roteiro.json'));t=0.0;out=[]
LT={'s0':(1.5,1.0),'s1':(1.4,.7),'s7':(.9,1.2),'s7b':(1.6,1.0),'s8':(1.0,3.4),'s8b':(.8,1.0),'s9':(.6,2.2),'s10':(.55,3.4)}
for s in r:
    d=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',f"audio/{s['id']}.mp3"]))
    lead,tail=LT.get(s['id'],(.55,.7))
    out.append({"id":s['id'],"txt":s['txt'],"start":round(t,3),"voice":round(t+lead,3),"dur":d,"end":round(t+lead+d+tail,3)})
    t=out[-1]['end']
json.dump({"total":round(t,3),"scenes":out},open('timeline.json','w'),ensure_ascii=False,indent=1)
for o in out: print(o['id'],o['start'],o['end'])
print(t)
