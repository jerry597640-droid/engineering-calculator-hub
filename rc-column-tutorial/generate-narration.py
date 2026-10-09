"""Reproducible Mandarin tutorial narration and official sentence timestamps.

The environment CA is added to edge-tts's verified SSL context. No TLS bypass.
This source sends only this authored tutorial text to Microsoft Edge TTS.
"""
from __future__ import annotations
import asyncio
import json
import pathlib
import subprocess
import re
import wave
import edge_tts
import edge_tts.communicate
import edge_tts.voices

ROOT = pathlib.Path(__file__).resolve().parent
VOICE = 'zh-TW-HsiaoChenNeural'
RATE = '+2%'
GAP = .5
for module in [edge_tts.communicate, edge_tts.voices]:
    ca = pathlib.Path('/usr/local/share/ca-certificates/nebula-dns.crt')
    if ca.exists():
        module._SSL_CTX.load_verify_locations(str(ca))

def probe(path):
    r = subprocess.run(['ffprobe','-v','error','-show_entries','format=duration',
                        '-of','json',str(path)],capture_output=True,text=True,check=True)
    return float(json.loads(r.stdout)['format']['duration'])

def decode_verified(source,destination):
    pending=destination.with_suffix('.pending.wav')
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(source),'-af','volume=3dB','-ar','48000','-ac','1',str(pending)],check=True)
    with wave.open(str(pending)) as w:
        frames=w.getnframes(); samples=w.getnchannels()*w.getsampwidth()
        data=w.readframes(frames)
        if len(data)!=frames*samples:raise ValueError('Incomplete PCM samples')
    pending.replace(destination)

def clock(s, comma=False):
    ms=round(s*1000); hours,ms=divmod(ms,3600000);minutes,ms=divmod(ms,60000);seconds,ms=divmod(ms,1000)
    return f'{hours:02}:{minutes:02}:{seconds:02}{"," if comma else "."}{ms:03}'

def normalize(text):
    return re.sub(r'[\s，。；：、！!?？「」,.\-]', '', text)

async def generate_one(index,chapter):
    path=ROOT/'audio'/f'{index:02}.mp3'
    spoken=''.join(s['spoken'] for s in chapter['sentences'])
    meta_path=ROOT/'audio'/f'{index:02}.timestamps.json'
    if not path.exists() or not meta_path.exists() or path.stat().st_size<1000:
        for attempt in range(3):
            metadata=[]
            try:
                communicate=edge_tts.Communicate(spoken,voice=VOICE,rate=RATE,boundary='SentenceBoundary')
                pending=path.with_suffix('.pending.mp3')
                with pending.open('wb') as f:
                    async for chunk in communicate.stream():
                        if chunk['type']=='audio':f.write(chunk['data'])
                        elif chunk['type']=='SentenceBoundary':metadata.append(chunk)
                if not metadata or pending.stat().st_size<1000:raise ValueError('Missing audio or official timestamps')
                official_end=(metadata[-1]['offset']+metadata[-1]['duration'])/1e7
                if probe(pending)+.08<official_end:raise ValueError('Audio ended before final sentence timestamp')
                pending.replace(path)
                meta_pending=meta_path.with_suffix('.pending.json')
                meta_pending.write_text(json.dumps(metadata,ensure_ascii=False,indent=2))
                meta_pending.replace(meta_path)
                break
            except Exception as e:
                print(f'{chapter["id"]}: retry {attempt+1}, {type(e).__name__}',flush=True)
                if attempt==2:raise
                await asyncio.sleep(1)
    metadata=json.loads(meta_path.read_text())
    mp3_duration=probe(path)
    pcm=ROOT/'audio'/f'{index:02}.wav'
    decode_verified(path,pcm)
    duration=probe(pcm)
    authored=chapter['sentences']
    # Service punctuation may split a sentence into extra entries. Match the
    # official spoken string to the authored sentence and merge only these parts.
    cues=[]; offset=0
    for s in authored:
        target=normalize(s['spoken']); chunks=[]; matched=''
        while offset<len(metadata) and len(matched)<len(target):
            chunk=metadata[offset];offset+=1;chunks.append(chunk);matched+=normalize(chunk['text'])
        if matched!=target:raise ValueError(f'Timestamp text mismatch in {chapter["id"]}: {matched!r} != {target!r}')
        start=chunks[0]['offset']/1e7
        end=(chunks[-1]['offset']+chunks[-1]['duration'])/1e7
        cues.append({'start':round(start,4),'end':round(end,4),'text':s['text'],'spoken':s['spoken']})
    if offset!=len(metadata):raise ValueError('Unmatched timestamp entries')
    for i in range(len(cues)-1):
        if cues[i]['end']>cues[i+1]['start']:
            cues[i]['officialEnd']=cues[i]['end']
            cues[i]['end']=cues[i+1]['start']
    if cues and cues[-1]['end']>duration:
        cues[-1]['officialEnd']=cues[-1]['end']
        cues[-1]['end']=duration
    print(chapter['id'],round(duration,3),'seconds',flush=True)
    return {'id':chapter['id'],'title':chapter['title'],'text':''.join(s['text'] for s in authored),
            'spoken':spoken,'duration':duration,'encodedDuration':mp3_duration,'audio':f'audio/{index:02}.mp3','cues':cues,
            'officialTimestamps':f'audio/{index:02}.timestamps.json'}

async def main():
    source=json.loads((ROOT/'narration-source.json').read_text())
    # Two simultaneous streams keep service load modest and avoid long sessions.
    gate=asyncio.Semaphore(2)
    async def guarded(index,c):
        async with gate:return await generate_one(index,c)
    chapters=await asyncio.gather(*(guarded(i,c) for i,c in enumerate(source,1)))
    start=0.;flat=[]
    for i,c in enumerate(chapters):
        c['start']=round(start,4);c['audioEnd']=round(start+c['duration'],4)
        c['end']=round(start+c['duration']+(GAP if i<len(chapters)-1 else 0),4)
        for cue in c['cues']:
            flat.append({'chapter':c['id'],'text':cue['text'],'spoken':cue['spoken'],
                         'start':round(start+cue['start'],4),'end':round(start+cue['end'],4)})
        start=c['end']
    (ROOT/'audio'/'chapters.json').write_text(json.dumps(chapters,ensure_ascii=False,indent=2))
    (ROOT/'transcript.json').write_text(json.dumps({'voice':VOICE,'locale':'zh-TW','rate':RATE,
        'timingSource':'Microsoft Edge TTS official SentenceBoundary offsets (100 ns units)',
        'duration':start,'gap':GAP,'mixGainDb':3,'chapters':chapters,'segments':flat},ensure_ascii=False,indent=2))
    (ROOT/'narration.txt').write_text('\n\n'.join(c['spoken'] for c in chapters)+'\n')
    content=['# RC 柱配筋工作台：操作影片旁白','',
             f'聲線：{VOICE}；速度：{RATE}；語言：台灣中文。',
             '章間留白0.5秒；字幕以官方SentenceBoundary時間戳為準；服務句界有重疊時截至下句開始，確保每次只有一句可見。',
             '旁白將3D讀作「三維」、D25讀作「迪二十五」，並以中文說明單位及匯出功能。',
             '影片是操作教學，不宣稱涵蓋所有規範檢核或取得認證。','',
             '## 章節與實際時間','', '|章節|開始|結束|旁白秒數|','|---|---:|---:|---:|']
    for c in chapters:content.append(f'|{c["title"]}|{c["start"]:.3f}|{c["end"]:.3f}|{c["duration"]:.3f}|')
    for c in chapters:content.extend(['',f'## {c["title"]}','',c['text'],'','實際TTS文字：'+c['spoken']])
    (ROOT/'SCRIPT.md').write_text('\n'.join(content)+'\n')
    vtt=['WEBVTT',''];srt=[]
    for i,s in enumerate(flat,1):
        vtt.extend([f'{clock(s["start"])} --> {clock(s["end"])}',s['text'],''])
        srt.extend([str(i),f'{clock(s["start"],True)} --> {clock(s["end"],True)}',s['text'],''])
    (ROOT/'captions.vtt').write_text('\n'.join(vtt))
    (ROOT/'captions.srt').write_text('\n'.join(srt))
    # Decode to PCM before concatenation to avoid MP3 encoder-delay accumulation.
    silence=ROOT/'audio'/'gap.wav'
    subprocess.run(['ffmpeg','-v','error','-y','-f','lavfi','-i','anullsrc=r=48000:cl=mono',
                    '-t',str(GAP),str(silence)],check=True)
    concat=[]
    for i,c in enumerate(chapters,1):
        pcm=ROOT/'audio'/f'{i:02}.wav'
        decode_verified(ROOT/c['audio'],pcm)
        concat.append("file '"+str(pcm)+"'")
        if i<len(chapters):concat.append("file '"+str(silence)+"'")
    listing=ROOT/'audio'/'concat.txt';listing.write_text('\n'.join(concat))
    pending_wav=ROOT/'narration.pending.wav'
    subprocess.run(['ffmpeg','-v','error','-y','-f','concat','-safe','0','-i',str(listing),
                    '-c:a','pcm_s16le',str(pending_wav)],check=True)
    with wave.open(str(pending_wav)) as w:
        frames=w.getnframes(); expected=frames*w.getnchannels()*w.getsampwidth()
        if len(w.readframes(frames))!=expected:raise ValueError('Incomplete merged PCM samples')
        actual=frames/w.getframerate()
    if abs(actual-start)>.005:raise ValueError('Merged duration differs from chapter timeline')
    pending_wav.replace(ROOT/'narration.wav')
    pending_mp3=ROOT/'narration.pending.mp3'
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(ROOT/'narration.wav'),'-c:a','libmp3lame',
                    '-b:a','128k',str(pending_mp3)],check=True)
    pending_mp3.replace(ROOT/'narration.mp3')
    print('Total timeline',round(start,3),'WAV duration',probe(ROOT/'narration.wav'),flush=True)

if __name__=='__main__':asyncio.run(main())
