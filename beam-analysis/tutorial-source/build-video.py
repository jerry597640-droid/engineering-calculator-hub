"""Author deterministic tutorial scenes using the actual beam engine's results."""
from pathlib import Path
import base64, json, re, shutil, html

ROOT=Path(__file__).resolve().parent
PROJECT=ROOT/'composition'
SCENES=PROJECT/'compositions'
SCENES.mkdir(exist_ok=True)
meta=json.loads((ROOT/'audio-meta.json').read_text())
data=json.loads((ROOT/'example-data.json').read_text())
g=data['governing']
e=html.escape
def table(head,rows):
    return '<table><thead><tr>'+''.join('<th>'+e(str(h))+'</th>' for h in head)+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+e(str(v))+'</td>' for v in row)+'</tr>' for row in rows)+'</tbody></table>'
def button(text,id):return '<div class="action" id="'+id+'">'+text+'</div>'
def beam(vehicle=False):
    svg='<svg class="beam" viewBox="0 0 760 220"><path d="M65 120H695" stroke="#12243b" stroke-width="7"/>'
    for i,x in enumerate([65,275,485,695]):
        svg+=f'<path d="M{x} 123l-15 27h30z" fill="#146ca8"/><text x="{x}" y="184" text-anchor="middle">{chr(65+i)} · {i*6} m</text>'
    if vehicle:
        for i,(x,p) in enumerate([(-1.25,80),(2.35,120),(3.65,120)]):
            xx=65+x*35
            color='#078b83' if x>=0 else '#50627a'
            svg+=f'<path d="M{xx} 65v43m-7-10l7 10 7-10" stroke="{color}" fill="none" stroke-width="4"/><text x="{xx}" y="45" text-anchor="middle" fill="{color}">{p}</text>'
    else:
        for x in range(80,695,45):svg+=f'<path d="M{x} 65v43m-6-9l6 9 6-9" stroke="#146ca8" fill="none" stroke-width="3"/>'
        svg+='<text x="380" y="40" text-anchor="middle">q = 10 kN/m</text>'
    return svg+'</svg>'
def envelope_plot():
    rows=data['rows']
    maxv=max(abs(r[k]) for r in rows for k in ['Mmin','Mmax'])
    def path(key):return 'M'+' L'.join(f'{40+r["x"]/18*680:.2f} {120-r[key]/maxv*94:.2f}' for r in rows)
    svg='<svg class="curve" viewBox="0 0 760 250"><path d="M40 120h680M40 20v210" stroke="#b9c7d6" stroke-width="2"/>'
    for k,col in [('Mmax','#efb64e'),('Mmin','#146ca8')]:svg+=f'<path class="draw" d="{path(k)}" fill="none" stroke="{col}" stroke-width="4"/>'
    svg+='<text x="42" y="245">0</text><text x="680" y="245">18 m</text><text x="60" y="35">M · kN·m</text></svg>'
    return svg

contents=[
('建立三跨連續梁','先用可照填範例，找出最不利車位',f'<div class="split"><div class="card"><h2>連續梁快速設定</h2>{table(["跨數","第1跨","第2跨","第3跨"],[[3,"6 m","6 m","6 m"]])}{button("套用連續梁配置","model-apply")}<p>總長 18 m · 4 個支承</p></div><div class="card"><h2>梁模型與作用載重</h2>{beam()}<div class="pair"><span>E = 200000 MPa</span><span>I = 8000 cm⁴</span></div><p class="note">資料來源：結構圖、材料規範、斷面表</p></div></div>'),
('輸入載重，圖形即時更新','集中力、線載重、彎矩可同時設定',f'<div class="split"><div class="card"><h2>03 靜態載重</h2>{table(["分布載重欄位","輸入"],[["分類","D 靜載重"],["起點 a / 終點 b","0 / 18 m"],["q₀ / q₁","10 / 10 kN/m"]])}<div class="actions"><span>＋ 集中力</span><span>＋ 分布載重</span><span>＋ 彎矩</span></div></div><div class="card"><div class="state">即時分析已更新</div>{beam()}<h2>支承反力 R（kN）</h2>{table(["A","B","C","D"],[[24,66,66,24]])}<p class="note">向下力為正；逆時針彎矩為正</p></div></div>'),
('車軸填累計偏距','先確認整軸重，再分配到本梁',f'<div class="split"><div class="card"><h2>02 車軸與累計偏距</h2>{table(["車軸","整軸重量","累計偏距"],[[1,"80 kN","0 m"],[2,"120 kN","3.6 m"],[3,"120 kN","4.9 m"]])}<p>距前軸：3.6 m、1.3 m</p></div><div class="card"><h2>01 車輛與分配</h2>{table(["欄位","示範值"],[["啟用車行載重","開啟"],["梁分配係數 η",1],["衝擊加成 IM",0]])}<div class="formula">本梁軸力 = P × η × (1＋IM)</div><p class="note">自訂示範車；正式工程須依適用設計車與分配分析填入</p></div></div>'),
('計算包絡，再看控制車位','包絡極值與目前車位各有明確標示',f'<div class="envelope-layout"><div class="card compact"><div class="scan"><span>掃描步距 0.1 m → 半步 0.05 m</span>{button("計算車行包絡＋加密檢查","envelope-run")}</div><div class="controls"><div class="control selected" id="envelope-control"><small>控制正彎矩</small><strong>{g["Mplus"]["result"]["value"]:.3f} kN·m</strong><span>x = 2.350 m · x₀ = −1.250 m</span></div><div class="control"><small>控制負彎矩絕對值</small><strong>{g["Mminus"]["result"]["value"]:.3f} kN·m</strong><span>x = 12 m · x₀ = 10.2 m</span></div><div class="control"><small>控制剪力絕對值</small><strong>{g["Vabs"]["result"]["value"]:.3f} kN</strong><span>x = 6 m · x₀ = 1.05 m</span></div></div></div><div class="plot-split"><div class="card compact"><h2>分析組合彎矩包絡</h2>{envelope_plot()}<div class="pair"><span class="upper">金色：最大值</span><span>藍色：最小值</span></div></div><div class="card compact"><h2>目前車位 x₀ = −1.250 m</h2>{beam(True)}<p class="note">梁上僅有2軸；第一軸仍在梁外</p></div></div></div>'),
('依設計基準比對容量','分析結果須接續本工程的構材設計',f'<div class="split"><div class="card"><h2>容量與撓度檢核</h2>{table(["需要填入","資料來源"],[["正／負彎矩容量","構材設計計算書"],["剪力容量","φVn 或 ASD 容許V"],["容量／撓度來源","版本、條文、圖號"]])}<div class="pending">分析完成 · 檢核資料待補</div></div><div class="card"><h2>本工程規範參照</h2><p>混凝土：112年版／113年勘誤</p><p>鋼結構：ASD 或極限設計</p><p>公路橋梁：設計車、衝擊、橫向分配</p><div class="formula">ASD：容量比使用需求</div><div class="formula">RC／LRFD：比因數化需求</div><p class="note">規範選項只記錄依據；不自動產生容量</p></div></div>'),
('查詢定義，保留專案與影片','輸入來源、單位與範例都在程式內',f'<div class="split"><div class="card"><h2>欄位旁的 ?</h2><div class="definition"><h3>衝擊加成 IM</h3><p>0.30 表示增加30%，放大係數1.30。</p><p>資料來源：適用橋梁規範或專案規定。</p><p>示範值0僅供練習。</p></div><p>操作說明 → 搜尋參數／影片章節</p></div><div class="card"><h2>保存與離線使用</h2>{button("匯出專案 JSON","save-project")}{button("下載離線版 ZIP","save-offline")}<div class="save-flow"><span>解壓</span><b>→</b><span>開啟 index.html</span></div><p class="note">離線計算、參數查詢、操作影片皆可使用</p></div></div>')
]
css='''
html,body{margin:0;width:100%;height:100%;background:#f3f6fa;color:#12243b;font-family:BeamUI;font-weight:400}*{box-sizing:border-box}#beam-tutorial{position:relative;width:100%;height:100%;overflow:hidden}.clip[data-composition-src]{position:absolute;inset:0;width:100%;height:100%}.frame{width:100%;height:100%;display:flex;flex-direction:column;padding:28px 38px 88px;background:#f3f6fa}.topline{display:flex;justify-content:space-between;align-items:center;font-size:22px;background:#12243b;color:#f3f6fa;padding:12px 20px;border-radius:10px}.step{color:#efb64e;font-weight:700}h1{font-size:47px;line-height:1.18;margin:22px 0 9px;font-weight:700}h2{font-size:25px;margin:0 0 15px}h3{font-size:27px;margin:0 0 12px}.subtitle{font-size:25px;color:#50627a;margin:0 0 22px}.split{display:grid;grid-template-columns:1fr 1.18fr;gap:20px;flex:1;min-height:0}.card{background:#fcfdff;border:2px solid #cbd6e3;padding:22px;border-radius:14px;min-width:0}table{border-collapse:collapse;width:100%;font-size:24px;font-variant-numeric:tabular-nums}th{background:#e7eef5;font-size:22px;text-align:left}th,td{padding:12px 10px;border-bottom:1px solid #cbd6e3}.action{display:block;padding:13px 20px;margin-top:18px;background:#efb64e;color:#12243b;border-radius:9px;font-size:24px;font-weight:700;text-align:center}.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:25px}.actions span{font-size:20px;border:2px solid #cbd6e3;border-radius:9px;padding:9px}.beam{width:100%;height:215px}.beam text{font-family:BeamUI;font-size:25px;fill:#12243b}p{font-size:23px;line-height:1.5;margin:14px 0}.pair{display:flex;justify-content:space-between;gap:12px;font-size:23px;font-variant-numeric:tabular-nums}.note{font-size:22px;color:#50627a}.formula{background:#e7eef5;border-radius:8px;padding:13px;margin:16px 0;font-size:24px}.state{display:inline-block;font-size:23px;color:#075f5a;background:#dbefea;padding:7px 12px;border-radius:7px}.envelope-layout{display:flex;flex-direction:column;gap:16px}.compact{padding:16px}.scan{display:flex;justify-content:space-between;align-items:center;font-size:23px;gap:15px}.scan .action{font-size:21px;margin:0;padding:10px 16px}.controls{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:15px}.control{padding:12px;background:#e7eef5;border:2px solid #cbd6e3;border-radius:10px}.control.selected{border-color:#078b83;background:#dbefea}.control small{font-size:20px;display:block}.control strong{display:block;font-size:27px;margin:7px 0;font-variant-numeric:tabular-nums}.control span{font-size:18px}.plot-split{display:grid;grid-template-columns:1.08fr 1fr;gap:16px}.curve{width:100%;height:210px}.curve text{font-family:BeamUI;font-size:24px;fill:#12243b}.plot-split .beam{height:210px}.plot-split h2{margin:0}.plot-split p{margin:0;font-size:21px}.upper{color:#79570e}.pending{padding:17px;background:#f8eccf;font-size:25px;margin-top:25px;border-radius:10px}.definition{background:#e7eef5;padding:20px;border-radius:10px}.save-flow{display:flex;align-items:center;gap:15px;margin-top:24px;font-size:25px}.caption{position:absolute;left:38px;right:38px;bottom:14px;height:62px;display:flex;align-items:center;justify-content:center;background:#12243b;color:#fcfdff;padding:9px 18px;border-radius:9px;text-align:center;font-size:27px;line-height:1.45}.caption-text{max-width:1150px}.source-note{font-size:18px}
'''
css+='''
#loads-surface .beam{height:140px}#loads-surface .card h2{margin:10px 0 6px}#loads-surface .card:nth-child(2) th,#loads-surface .card:nth-child(2) td{padding:6px 10px}#loads-surface .card:nth-child(2) p{margin:10px 0}
#vehicle-surface th,#vehicle-surface td{padding:8px 9px;font-size:22px}#vehicle-surface h2{margin-bottom:10px}#vehicle-surface .formula{margin:10px 0;padding:10px;font-size:23px}#vehicle-surface .note{font-size:20px;line-height:1.4;margin:10px 0}
#envelope-surface h1{font-size:40px;margin:14px 0 8px}#envelope-surface .subtitle{font-size:22px;margin-bottom:12px}#envelope-surface .envelope-layout{gap:12px}#envelope-surface .compact{padding:12px}#envelope-surface .scan{font-size:21px}#envelope-surface .scan .action{font-size:20px;padding:8px 12px}#envelope-surface .controls{gap:10px;margin-top:10px}#envelope-surface .control{padding:9px}#envelope-surface .control strong{font-size:25px;margin:4px 0}#envelope-surface .control small{font-size:19px}#envelope-surface .curve{height:150px}#envelope-surface .plot-split .beam{height:150px}#envelope-surface .plot-split h2{font-size:23px}#envelope-surface .plot-split p{font-size:20px}#envelope-surface .pair{font-size:21px}
'''
alltext=''.join(a+b+c for a,b,c in contents)+''.join(c['text'] for c in meta['captions'])+'梁受力分析工作台縮編操作導覽自訂示範1/6ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.%−→＋·₀⁺⁻⁴ηφ'
needed=set(map(ord,alltext))
faces=[]
fontroot=ROOT/'node_modules'/'@fontsource'/'noto-sans-tc'
for block in re.findall(r'@font-face\s*\{.*?\}',(fontroot/'400.css').read_text(),re.S):
    codes=set()
    for lo,hi in re.findall(r'U\+([0-9a-fA-F]+)(?:-([0-9a-fA-F]+))?',block):codes.update(range(int(lo,16),int(hi or lo,16)+1))
    if not codes.intersection(needed):continue
    src=re.search(r'url\(([^)]+\.woff2)\)',block).group(1)
    raw=(fontroot/src).read_bytes()
    block=re.sub(r'  src:.*?;',"  src: url(data:font/woff2;base64,"+base64.b64encode(raw).decode()+") format('woff2');",block)
    block=block.replace("'Noto Sans TC'","BeamUI").replace('font-display: swap','font-display: block')
    faces.append(block)
shutil.copyfile(ROOT/'node_modules'/'gsap'/'dist'/'gsap.min.js',PROJECT/'assets'/'gsap.min.js')
shutil.copyfile(fontroot/'LICENSE',PROJECT/'FONT-LICENSE.txt')
slots=[]
story=[]
for i,(chapter,(title,subtitle,content)) in enumerate(zip(meta['chapters'],contents)):
    sid=chapter['id']
    duration=chapter['duration']
    motion=f'''const tl=gsap.timeline({{paused:true}});
tl.fromTo('#{sid}-surface',{{x:32,opacity:0}},{{x:0,opacity:1,duration:.42,ease:'power2.out'}},0);
tl.fromTo('#{sid}-title',{{y:15,opacity:0}},{{y:0,opacity:1,duration:.5,ease:'power3.out'}},.12);
'''
    target={'model':'model-apply','envelope':'envelope-control','save':'save-offline'}.get(sid)
    if target:motion+=f"tl.fromTo('#{target}',{{scale:1}},{{scale:.97,duration:.16,ease:'none'}},4);tl.fromTo('#{target}',{{scale:.97}},{{scale:1,duration:.45,ease:'back.out(1.4)',immediateRender:false}},4.16);\n"
    if sid=='envelope':motion+="document.querySelectorAll('#envelope-root .draw').forEach(p=>{const n=p.getTotalLength();p.style.strokeDasharray=String(n);p.style.strokeDashoffset=String(n);tl.fromTo(p,{strokeDashoffset:n},{strokeDashoffset:0,duration:1.2,ease:'none'},1);});\n"
    motion+=f"window.__timelines['{sid}']=tl;"
    source=f'<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"></head><body><template><style>#{sid}-root{{position:absolute;inset:0;width:100%;height:100%}}</style><div id="{sid}-root" data-composition-id="{sid}" data-width="1280" data-height="720" data-duration="{duration}"><div id="{sid}-surface" class="frame"><div class="topline"><span>梁受力分析工作台</span><span class="step">{i+1:02d} / 06 · {chapter["title"]}</span></div><h1 id="{sid}-title">{title}</h1><p class="subtitle">{subtitle}</p>{content}</div></div><script>{motion}</script></template></body></html>'
    (SCENES/f'{sid}.html').write_text(source)
    slots.append(f'<div id="slot-{sid}" class="clip" data-composition-id="{sid}" data-composition-src="compositions/{sid}.html" data-start="{chapter["start"]}" data-duration="{duration}" data-width="1280" data-height="720" data-track-index="1"></div>')
    story.append(f'## Frame {i+1}\nstatus: animated\nsrc: compositions/{sid}.html\nmotion: control-target-sync / press-release-spring / svg-path-draw\n{title}：{subtitle}。數字與標籤取自梁分析工作台；進場後保留閱讀時間。\n')
caption_slots=[]
for i,c in enumerate(meta['captions']):
    caption_slots.append(f'<div id="caption-{i}" class="clip caption" data-start="{c["start"]:.6f}" data-duration="{c["end"]-c["start"]:.6f}" data-track-index="20"><span class="caption-text">{e(c["text"])}</span></div>')
host=f'<!doctype html><html lang="zh-Hant"><head><meta charset="UTF-8"><script src="assets/gsap.min.js"></script><style>{"".join(faces)}{css}</style></head><body><div id="beam-tutorial" data-composition-id="beam-tutorial" data-width="1280" data-height="720" data-fps="24" data-duration="{meta["duration"]}">{"".join(slots)}{"".join(caption_slots)}<audio id="tutorial-narration" src="assets/narration.wav" data-start="0" data-duration="{meta["duration"]}" data-track-index="30" data-volume="1"></audio></div><script>window.__timelines["beam-tutorial"]=gsap.timeline({{paused:true}});</script></body></html>'
(PROJECT/'index.html').write_text(host)
(PROJECT/'STORYBOARD.md').write_text('# 操作導覽：從三跨模型到包絡與容量資料\n\n'+''.join(story))
print(json.dumps({'duration':meta['duration'],'scenes':len(slots),'embeddedFontSubsets':len(faces),'sourceBytes':len(host.encode())}))
