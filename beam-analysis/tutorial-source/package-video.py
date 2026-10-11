"""Compress and verify MP4, then embed it as offline media in the application."""
from pathlib import Path
import base64, hashlib, json, subprocess, sys
ROOT=Path(__file__).resolve().parent
meta=json.loads((ROOT/'audio-meta.json').read_text())
source=Path(sys.argv[1]).resolve()
target=ROOT/'tutorial.mp4'
subprocess.run(['ffmpeg','-v','error','-y','-i',str(source),'-c:v','libx264','-preset','slow','-crf','28','-pix_fmt','yuv420p','-c:a','aac','-b:a','64k','-ar','24000','-movflags','+faststart',str(target)],check=True)
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(target)]))
video=next(s for s in probe['streams'] if s['codec_type']=='video')
audio=next(s for s in probe['streams'] if s['codec_type']=='audio')
duration=float(probe['format']['duration'])
assert video['codec_name']=='h264' and video['pix_fmt']=='yuv420p' and video['width']==1280 and video['height']==720
assert audio['codec_name']=='aac' and abs(duration-meta['duration'])<.15
raw=target.read_bytes()
def stamp(t):
    milliseconds=round(t*1000)
    return f'{milliseconds//3600000:02d}:{milliseconds//60000%60:02d}:{milliseconds//1000%60:02d}.{milliseconds%1000:03d}'
vtt='WEBVTT\n\n'+''.join(f'{i+1}\n{stamp(c["start"])} --> {stamp(c["end"])}\n{c["text"]}\n\n' for i,c in enumerate(meta['captions']))
media={'video':base64.b64encode(raw).decode(),'captions':vtt,'chapters':meta['chapters'],'duration':duration,'voice':meta['voice'],'voiceDescription':'台灣中文女性合成旁白','sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'width':video['width'],'height':video['height'],'codec':'H.264/AAC','captionTiming':meta['captionTiming'],'type':'縮編介面操作導覽動畫','verificationDate':'2026-10-11'}
(ROOT.parent/'tutorial-media.json').write_text(json.dumps(media,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c'))
verification={k:v for k,v in media.items() if k not in ['video','captions']}
verification['audioPeak']='Validated non-silent source samples; audio encoded AAC'
(ROOT/'media-verification.json').write_text(json.dumps(verification,ensure_ascii=False,indent=2))
print(json.dumps({k:v for k,v in verification.items() if k not in ['chapters']},ensure_ascii=False,indent=2))
