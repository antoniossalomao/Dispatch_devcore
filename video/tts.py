import json,os,urllib.request,sys
key=os.environ['EL']; vid=sys.argv[1] if len(sys.argv)>1 else 'KHmfNHtEjHhLK9eER20w'
for s in json.load(open('roteiro.json')):
    body=json.dumps({"text":s['txt'],"model_id":"eleven_multilingual_v2","language_code":"pt","voice_settings":{"stability":0.5,"similarity_boost":0.8,"style":0.25,"use_speaker_boost":True}}).encode()
    r=urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{vid}?output_format=mp3_44100_128",body,{"xi-api-key":key,"Content-Type":"application/json"})
    try:
        open(f"audio/{s['id']}.mp3","wb").write(urllib.request.urlopen(r,timeout=90).read()); print("ok",s['id'])
    except Exception as e:
        print("ERR",s['id'],getattr(e,'read',lambda:b'')()[:300] or e); break
