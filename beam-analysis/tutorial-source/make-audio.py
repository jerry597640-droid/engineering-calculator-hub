"""Generate the requested Taiwan Mandarin narration and measured chapter timings."""
import asyncio, json, os, ssl, subprocess
from pathlib import Path
import edge_tts
import edge_tts.communicate as edge_communicate
import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / 'composition' / 'assets'
ASSETS.mkdir(parents=True, exist_ok=True)
SCRIPT = json.loads((ROOT / 'narration.json').read_text())
VOICE = 'zh-TW-HsiaoChenNeural'
# Use the trusted system certificate bundle, including the managed network CA.
edge_communicate._SSL_CTX = ssl.create_default_context(cafile='/etc/ssl/certs/ca-certificates.crt')

async def generate():
    gate = asyncio.Semaphore(3)
    async def line(chapter, number, text):
        path = ASSETS / f'{chapter}-{number}.mp3'
        if not path.exists() or path.stat().st_size < 1000:
            async with gate:
                await edge_tts.Communicate(text, VOICE, rate='-8%', proxy=os.environ.get('HTTPS_PROXY'), connect_timeout=20, receive_timeout=45).save(str(path))
        wav = path.with_suffix('.wav')
        subprocess.run(['ffmpeg','-v','error','-y','-i',str(path),'-ac','1','-ar','24000',str(wav)],check=True)
        samples, rate = sf.read(wav)
        assert rate == 24000 and np.max(np.abs(samples)) > .01
        return samples
    return await asyncio.gather(*(line(c['id'],i,t) for c in SCRIPT for i,t in enumerate(c['lines'])))

samples = asyncio.run(generate())
assembled, chapters, captions = [], [], []
cursor, n = 0., 0
for chapter in SCRIPT:
    start = cursor
    assembled.append(np.zeros(7200)); cursor += .3
    for text in chapter['lines']:
        audio = samples[n]; n += 1
        duration = len(audio)/24000
        # Short caption units with timing proportional to the measured spoken line.
        phrases = [p.strip() for p in __import__('re').split('(?<=[。；，])',text) if p.strip()]
        weights = sum(len(p) for p in phrases)
        caption_cursor = cursor
        for phrase in phrases:
            d = duration*len(phrase)/weights
            captions.append({'start':caption_cursor,'end':caption_cursor+d,'text':phrase})
            caption_cursor += d
        assembled.extend([audio,np.zeros(9600)])
        cursor += duration+.4
    assembled.append(np.zeros(12000)); cursor += .5
    chapters.append({**chapter,'start':round(start,6),'duration':round(cursor-start,6)})
audio = np.concatenate(assembled)
audio *= .9/max(.9,float(np.max(np.abs(audio))))
sf.write(ASSETS/'narration.wav',audio,24000,subtype='PCM_16')
meta = {'voice':VOICE,'language':'zh-TW','provider':'Microsoft Edge TTS','duration':len(audio)/24000,'chapters':chapters,'captions':captions,'captionTiming':'Measured line durations; phrase timings proportional to spoken text length'}
(ROOT/'audio-meta.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2))
print(json.dumps({'voice':VOICE,'duration':meta['duration'],'chapters':len(chapters),'captionCues':len(captions)}))
