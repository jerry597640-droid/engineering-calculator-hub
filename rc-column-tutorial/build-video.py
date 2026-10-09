"""Build a deterministic HyperFrames tutorial from real recordings and voice cues."""
import html
import json
from pathlib import Path

root = Path(__file__).resolve().parent
chapters = json.loads((root / 'audio/chapters.json').read_text())
duration = chapters[-1]['end']
cues = []
for chapter in chapters:
    for cue in chapter['cues']:
        cues.append({k: round(chapter['start'] + cue[k], 4) for k in ['start', 'end']} | {'text': cue['text']})
for i, cue in enumerate(cues[:-1]):
    cue['end'] = min(cue['end'], cues[i + 1]['start'])

app_data = {'title': 'RC 柱專業版操作教學', 'version': '1.6 PRO', 'duration': duration,
            'chapters': [{k: c[k] for k in ['id', 'title', 'start', 'end', 'text']} for c in chapters], 'cues': cues}
(root.parent / 'rc-column/tutorial-chapters.json').write_text(json.dumps(app_data, ensure_ascii=False, indent=2))

def stamp(seconds):
    ms = round(seconds * 1000)
    return f'{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d}.{ms % 1000:03d}'

(root / 'tutorial-zh-TW.vtt').write_text('WEBVTT\n\n' + '\n\n'.join(
    f'{i+1}\n{stamp(c["start"])} --> {stamp(c["end"])}\n{c["text"]}' for i, c in enumerate(cues)) + '\n')

scenes, media = [], []
for i, c in enumerate(chapters):
    n = f'{i + 1:02d}'
    scenes.append(f'''<section id="scene-{n}" class="scene" style="z-index:{i+1};opacity:{1 if i==0 else 0}">
      <div class="scene-content">
        <header><span class="chapter-number">{n}</span><h1>{html.escape(c['title'])}</h1><span class="edition"><span>v1.6 PRO</span><span>操作示範</span></span></header>
        <div class="screen-frame"><video id="video-{n}" class="clip" src="recordings/{n}.mp4" data-start="{c['start']}" data-duration="{c['end']-c['start'] + (0.35 if i < len(chapters)-1 else 0)}" data-track-index="{i%2}" muted playsinline></video></div>
        <div class="caption-space"></div>
      </div></section>''')

media = [f'<audio id="narration" class="clip" src="narration.wav" data-start="0" data-duration="{duration}" data-track-index="2" data-volume="1"></audio>']

captions = '\n'.join(f'<div id="caption-{i}" class="caption"><span>{html.escape(c["text"])}</span></div>' for i,c in enumerate(cues))
timeline = []
for i, c in enumerate(chapters):
    n, t = f'{i+1:02d}', c['start']
    if i:
        old = f'{i:02d}'
        timeline += [f'tl.to("#scene-{old}", {{opacity:0,duration:.35,ease:"power2.inOut"}}, {t});',
                     f'tl.fromTo("#scene-{n}", {{opacity:0}}, {{opacity:1,duration:.35,ease:"power2.inOut"}}, {t});',
                     f'tl.set("#scene-{old}", {{opacity:0,visibility:"hidden"}}, {t+.35});']
    timeline += [f'tl.from("#scene-{n} h1", {{y:18,opacity:0,duration:.5,ease:"power3.out",immediateRender:false}}, {t+.15});',
                 f'tl.from("#scene-{n} .chapter-number", {{scale:.85,opacity:0,duration:.4,ease:"back.out(1.3)",immediateRender:false}}, {t+.1});',
                 f'tl.from("#scene-{n} .edition", {{x:15,opacity:0,duration:.45,ease:"sine.out",immediateRender:false}}, {t+.25});',
                 f'tl.from("#scene-{n} .screen-frame", {{y:12,opacity:0,duration:.4,ease:"power2.out",immediateRender:false}}, {t+.1});']
for i, c in enumerate(cues):
    timeline += [f'tl.set("#caption-{i}", {{visibility:"visible"}}, {c["start"]});',
                 f'tl.fromTo("#caption-{i}", {{opacity:0}}, {{opacity:1,duration:.12,ease:"power1.out",immediateRender:false}}, {c["start"]});',
                 f'tl.set("#caption-{i}", {{opacity:0,visibility:"hidden"}}, {c["end"]});']
timeline.append(f'tl.fromTo("#progress", {{scaleX:0}}, {{scaleX:1,duration:{duration},ease:"none"}}, 0);')

document = '''<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=1920,height=1080">
<script src="assets/gsap.min.js"></script><style>
@font-face{font-family:TutorialTC;src:url('capture/assets/fonts/SourceHanSansTC-Regular.otf')}
*{box-sizing:border-box}html,body{margin:0;width:1920px;height:1080px;overflow:hidden;background:#112136;color:#fff;font-family:TutorialTC,sans-serif}
#root{position:relative;width:1920px;height:1080px;overflow:hidden}
.scene{position:absolute;inset:0;background:#112136}
.scene-content{width:100%;height:100%;padding:16px 36px;display:flex;flex-direction:column;gap:12px}
header{height:70px;display:flex;align-items:center;gap:24px;flex:none}h1{margin:0;font-size:60px;font-weight:900;letter-spacing:-.02em;line-height:1.15}
.chapter-number{font:46px 'DejaVu Sans Mono',monospace;color:#f4b449;border-right:2px solid #f4b449;padding-right:24px;font-variant-numeric:tabular-nums}
.edition{margin-left:auto;color:#fff;font-size:24px;line-height:1.4;text-align:right}.edition span{display:block}
.screen-frame{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;background:#edf1f6;border-radius:10px;overflow:hidden;box-shadow:0 6px 18px #0005}
video{width:100%;height:100%;object-fit:contain;display:block}
.caption-space{height:96px;flex:none}
.caption{position:absolute;left:36px;right:36px;bottom:20px;height:96px;display:flex;align-items:center;justify-content:center;z-index:30;opacity:0;visibility:hidden;font-size:38px;line-height:1.3;text-align:center;padding:4px 60px;background:#112136}
.caption span{max-width:1720px}.progress-rail{position:absolute;left:0;right:0;bottom:0;height:5px;background:#1d334f;z-index:50}#progress{width:100%;height:100%;background:#f4b449;transform-origin:left}
</style></head><body>
<div id="root" data-composition-id="main" data-start="0" data-duration="DURATION" data-width="1920" data-height="1080" data-fps="24">
SCENES
CAPTIONS
<div class="progress-rail" data-layout-ignore><div id="progress"></div></div>
MEDIA
</div><script>
window.__timelines=window.__timelines||{};
const tl=gsap.timeline({paused:true});
TIMELINE
window.__timelines.main=tl;
</script></body></html>'''
document = document.replace('DURATION', str(duration)).replace('SCENES', '\n'.join(scenes)).replace('CAPTIONS', captions).replace('MEDIA', '\n'.join(media)).replace('TIMELINE', '\n'.join(timeline))
(root / 'studio/index.html').write_text(document)
story = '# 操作影片分鏡與實測時間\n\n章節起訖依最終語音長度，實際操作錄影與字幕對齊。章節交界採 0.35 秒交叉淡化，保留末尾 0.5 秒停頓。\n\n'
for i,c in enumerate(chapters):
    story += f'## {i+1:02d} {c["title"]} — {c["start"]:.3f}–{c["end"]:.3f}s\n\n- 真實操作錄影：recordings/{i+1:02d}.mp4\n- 台灣中文旁白：audio/{i+1:02d}.mp3；實際音長 {c["duration"]:.3f}s\n- 內容：{c["text"]}\n- 畫面：章節頂列、工程介面操作、獨立字幕區；入口動畫後完整可見，至交叉淡化轉入下一章。\n\n'
(root / 'STORYBOARD.md').write_text(story)
print(json.dumps({'duration': duration, 'chapters': len(chapters), 'cues': len(cues)}, ensure_ascii=False))
