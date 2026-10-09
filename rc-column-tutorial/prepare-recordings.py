import json
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parent
chapters = json.loads((root / 'audio/chapters.json').read_text())
selection = set(sys.argv[1:])
for i, c in enumerate(chapters):
    n = f'{i+1:02d}'
    src = root / 'recordings' / (n + '.webm')
    dest = src.with_suffix('.mp4')
    if not src.is_file() or (selection and n not in selection): continue
    target = c['end'] - c['start'] + (0.35 if i < len(chapters) - 1 else 0)
    if dest.exists() and dest.stat().st_mtime >= src.stat().st_mtime: continue
    subprocess.run(['ffmpeg','-y','-v','error','-i',str(src),'-vf','fps=24,tpad=stop_mode=clone:stop_duration=1',
                    '-t',str(target),'-an','-c:v','libx264','-preset','veryfast','-crf','18','-pix_fmt','yuv420p',
                    '-movflags','+faststart',str(dest)],check=True)
    info = json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration,size','-of','json',str(dest)]))
    assert abs(float(info['format']['duration']) - target) < .05
    print(json.dumps({'chapter': n, 'target':target, **info['format']}), flush=True)
