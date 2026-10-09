"""Render the reviewed tutorial layout with FFmpeg when browser frame capture stalls.

Real UI footage, title entrances, chapter dissolves, narration and optional subtitles
share the same final chapter clock as the HyperFrames composition and web player.
"""
from pathlib import Path
import json
import subprocess

root = Path(__file__).resolve().parent
chapters = json.loads((root/'audio/chapters.json').read_text())
duration = chapters[-1]['end']
font = '/usr/local/share/fonts/tutorial/SourceHanSansTC-Regular.otf'
mono = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'
out = root/'studio/renders/RC-column-tutorial-v1.6.mp4'
out.parent.mkdir(parents=True, exist_ok=True)
graph=[]
args=['ffmpeg','-y','-v','warning','-stats','-filter_complex_threads','2']
for i,c in enumerate(chapters):
    n=f'{i+1:02d}'
    args += ['-threads','1','-i',str(root/f'recordings/{n}.mp4')]
    title=root/f'studio/assets/title-{n}.txt'
    title.write_text(c['title'])
    seconds=c['end']-c['start']+(.35 if i<len(chapters)-1 else 0)
    alpha="if(lt(t,0.1),0,min(1,(t-0.1)/0.4))"
    graph.append(f"[{i}:v]fps=24,tpad=stop_mode=clone:stop_duration=1,trim=duration={seconds},setpts=PTS-STARTPTS,scale=1520:855:flags=lanczos,format=yuv420p,pad=1920:1080:200:98:color=0x112136,setsar=1,drawbox=x=114:y=16:w=2:h=64:color=0xf4b449:t=fill,drawtext=fontfile={mono}:text='{n}':fontsize=46:fontcolor=0xf4b449:x=38:y=20:alpha='{alpha}',drawtext=fontfile={font}:textfile={title}:fontsize=60:fontcolor=white:borderw=0.6:bordercolor=white:x=140:y=18:alpha='{alpha}',drawtext=fontfile={font}:text='v1.6 PRO':fontsize=24:fontcolor=white:x=1750:y=18,drawtext=fontfile={font}:text='操作示範':fontsize=24:fontcolor=white:x=1750:y=52[v{i}]")
    if i:
        left='v0' if i==1 else f'x{i-1}'
        graph.append(f'[{left}][v{i}]xfade=transition=fade:duration=0.35:offset={c["start"]}[x{i}]')
graph.append(f'[x{len(chapters)-1}]trim=duration={duration},format=yuv420p,drawbox=x=0:y=1075:w=1920:h=5:color=0x1d334f:t=fill,drawbox=x=0:y=1075:w=1920:h=5:color=0xf4b449:t=fill:enable=0[v]')
graph_path=root/'studio/software-filter.txt'
graph_path.write_text(';\n'.join(graph))
args += ['-i',str(root/'narration.wav'),'-i',str(root/'captions.srt'),
         '-filter_complex_script',str(graph_path),'-map','[v]','-map','8:a:0','-map','9:s:0',
         '-c:v','libx264','-preset','veryfast','-crf','23','-threads','4','-g','24','-keyint_min','24',
         '-c:a','aac','-b:a','96k','-c:s','mov_text','-metadata:s:s:0','language=zho',
         '-metadata:s:s:0','title=繁體中文字幕','-disposition:s:0','0','-t',str(duration),
         '-movflags','+faststart',str(out)]
print('Rendering 8 real UI chapters with crossfades, narrated audio and optional Chinese subtitles',flush=True)
subprocess.run(args,check=True)
print(json.dumps({'output':str(out),'bytes':out.stat().st_size,'duration':duration}),flush=True)
