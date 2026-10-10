#!/usr/bin/env python3
"""Repair v1.2 loading failure UX without altering catalog or geometry formulas."""
from pathlib import Path
import argparse,base64,hashlib,html,json,re,subprocess,zipfile
VERSION='1.2.1'
BASE_SHA='f5699979d896c56d1b2328b93fcd73e93774e040'
HOME='https://jerry597640-droid.github.io/engineering-calculator-hub/'
LIVE=HOME+'steel-sections/'
SCRIPT_RE=re.compile(r'<script\b([^>]*)>([\s\S]*?)</script>',re.I)
def safejson(v):
    return json.dumps(v,ensure_ascii=False).replace('<','\\u003c').replace('>','\\u003e').replace('&','\\u0026').replace('%','\\u0025')
def n(v):
    if v is None:return '—'
    return f'{v:,.4f}'.rstrip('0').rstrip('.') if isinstance(v,(float,int)) else str(v)
def static_markup(data):
    rows=data['catalog']+data['examples'];groups=[]
    for ty in ['C','H','I','U','L','RHS','SHS','CHS','T']:
        rs=[r for r in rows if r['type']==ty];cells=[]
        for r in rs:
            cells.append('<tr data-static-id="'+html.escape(r['id'])+'"><th scope="row">'+html.escape(r['name'])+'</th>'+''.join('<td>'+n(r.get(k))+'</td>' for k in ['A','W','Ix','Iy','Sx','Sy','rx','ry'])+'<td>'+('東和型錄' if r['mode']=='catalog' else '理論示例')+'</td></tr>')
        cols=['斷面名稱（mm）','A cm²','W kg/m','Ix cm⁴','Iy cm⁴','Sx cm³','Sy cm³','rx cm','ry cm','性質']
        note='本類為理論幾何示例，非已確認的鋼廠供貨型錄。' if ty not in ['H','I','U'] else '原廠表列值；請另確認材質、供貨及製造公差。'
        groups.append('<details class="static-group" id="static-'+ty+'"'+(' open' if ty=='C' else '')+'><summary>'+html.escape(data['types'][ty])+f' · {len(rs)} 筆</summary><p>規格名稱固定為 mm；表格可左右滑動。'+note+'</p><div class="static-scroll"><table><thead><tr>'+''.join('<th scope="col">'+c+'</th>' for c in cols)+'</tr></thead><tbody>'+''.join(cells)+'</tbody></table></div></details>')
    return '<section id="steel-reader" aria-labelledby="reader-title"><header class="reader-hero"><span class="reader-tag">台灣型鋼斷面資料庫 v1.2.1</span><h1 id="reader-title">資料已內建，不必等待載入</h1><p><b>129 筆資料 · 98 筆型錄＋31 筆理論示例</b></p><p>此閱讀模式不需要 JavaScript。展開下方型式即可查看完整資料；互動搜尋與自訂計算僅在程式成功啟動後提供。</p><div class="reader-links"><a href="'+LIVE+'?v=1.2.1" target="_blank" rel="noopener noreferrer">開啟線上互動版 ↗</a><a href="'+HOME+'" target="_blank" rel="noopener noreferrer">回到工程工具 ↗</a></div><p class="reader-small">iPhone 請用 Safari 開啟上方網址，不要將 HTML 檔案預覽當作互動網頁。檔案預覽是否執行程式由開啟它的 App 決定。</p></header><div id="steel-boot-message" class="reader-alert" role="status"><b>目前為資料閱讀模式，互動程式尚未啟動。</b><p>若持續看到此提示，可能是檔案預覽禁止程式，或程式啟動失敗；不是資料庫仍在下載。下方 129 筆內建資料仍可閱讀。</p></div><noscript><p class="reader-alert">目前未執行 JavaScript，因此保留完整資料閱讀模式；搜尋與自訂計算無法在此預覽環境中運作。</p></noscript><details id="steel-diagnostic" hidden><summary>啟動診斷</summary><pre id="steel-diagnostic-text"></pre></details><div class="reader-titlebar"><h2>完整斷面資料表</h2><span>資料版本沿用 v1.2，未新增原廠型錄</span></div>'+''.join(groups)+'<aside class="reader-notes"><h2>欄位與限制</h2><p>A：斷面積；W：每公尺質量；Ix／Iy：重心軸二次面積矩；Sx／Sy：彈性斷面模數；rx／ry：迴轉半徑。名稱中的尺寸為 mm。理論示例忽略圓角與製造細節，不可冒充原廠型錄。</p><p>本修正版只修正啟動、資料顯示與下載可靠性；没有新增強度、挫屈、耐震或有效斷面設計功能，也没有將舊型錄改標成最新規範。</p><p>型錄來源：<a href="https://www.tunghosteel.com/Files/papp/400/%E5%9E%8B%E9%8B%BC%E5%9E%8B%E9%8C%84%E8%A1%A8%282021.04.12%29%282%29.pdf" target="_blank" rel="noopener noreferrer">東和鋼鐵 2021.04.12 型錄</a>；理論資料來自原工具的幾何公式。</p></aside><button id="steel-resume" class="reader-button" hidden>返回互動查詢</button></section>'
STYLE='''<style id="steel-startup-style">
html:not([data-steel-ready="true"]) .app,html:not([data-steel-ready="true"]) .v11-dock,html:not([data-steel-ready="true"]) #toast{display:none!important}
html[data-steel-ready="true"] #steel-reader{display:none}
#steel-reader{max-width:1180px;margin:auto;padding:22px;color:#19344c;font-family:system-ui,-apple-system,"Noto Sans TC",sans-serif;line-height:1.75}
.reader-hero{padding:26px;border:1px solid #c5d9e9;border-radius:16px;background:#edf5fc}.reader-hero h1{font-size:27px;margin:9px 0}.reader-tag{font-size:13px;letter-spacing:1px}.reader-hero p{margin:10px 0}.reader-links{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0}.reader-links a,.reader-button{padding:10px 15px;border:1px solid #265b83;background:#163b5a;color:#fff;text-decoration:none;border-radius:9px;min-height:46px;display:inline-flex;align-items:center;justify-content:center}.reader-small{font-size:14px}.reader-alert{padding:18px 20px;margin:18px 0;background:#fff6e8;border:1px solid #e4c38a;border-radius:12px}.reader-alert p{margin:6px 0}.reader-titlebar{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin:20px 0}.reader-titlebar span{font-size:13px}.static-group{background:#fff;border:1px solid #c9d9e5;border-radius:12px;margin:12px 0;padding:14px}.static-group>summary{cursor:pointer;padding:8px;min-height:44px;font-size:17px;font-weight:700}.static-group>p{font-size:13px;margin:8px}.static-scroll{overflow:auto;max-width:100%;-webkit-overflow-scrolling:touch}.static-scroll table{width:100%;border-collapse:collapse;white-space:nowrap;font-variant-numeric:tabular-nums;font-size:14px}.static-scroll th,.static-scroll td{padding:10px 12px;border-bottom:1px solid #dbe5ed;text-align:right}.static-scroll th:first-child{text-align:left;position:sticky;left:0;background:#fff;z-index:1}.static-scroll thead th{background:#eff5f9}.static-scroll thead th:first-child{background:#eff5f9}.reader-notes{background:#fff;padding:22px;margin:20px 0;border-radius:12px;border:1px solid #cedde7;font-size:14px}#steel-diagnostic pre{white-space:pre-wrap;overflow-wrap:anywhere}.steel-live-status{margin:10px 0;padding:8px 12px;background:#e7f3ed;border:1px solid #c0dacb;border-radius:8px;font-size:13px}.steel-live-status button{margin-left:8px;min-height:40px;font-size:13px;padding:5px 10px}.reader-button{cursor:pointer}html:not([data-steel-ready="true"]) body{padding-bottom:0!important}
@media(max-width:600px){#steel-reader{padding:12px}.reader-hero{padding:18px}.reader-hero h1{font-size:23px}.reader-links{display:grid;grid-template-columns:1fr}.static-group{padding:8px}.static-scroll table{font-size:13px}.reader-alert{font-size:14px}.reader-notes{padding:16px}}
</style>'''
BOOT=r'''(function(){
'use strict';document.documentElement.removeAttribute('data-steel-ready');
window.STEEL_BOOT={version:'1.2.1',ready:false,errors:[],started:Date.now()};
function report(){var s=window.STEEL_BOOT,m=document.getElementById('steel-boot-message');if(s.ready)return;if(m&&s.errors.length)m.textContent='互動程式啟動失敗。已改用完整資料閱讀模式，並非資料尚在載入。請用 Safari 開啟線上版。';var box=document.getElementById('steel-diagnostic'),out=document.getElementById('steel-diagnostic-text');if(box&&out&&s.errors.length){box.hidden=false;out.textContent='版本 '+s.version+'\n'+s.errors.join('\n');}}
window.addEventListener('error',function(e){if(!window.STEEL_BOOT.ready&&e.message){window.STEEL_BOOT.errors.push(String(e.message).slice(0,250));report();}});window.setTimeout(report,2500);
})();'''
FINISH=r'''(function(){'use strict';var E=function(id){return document.getElementById(id)},boot=window.STEEL_BOOT;
try{
 if(!window.STEEL_V12||CATALOG.length!==98||ESTIMATES.length!==31||!E('tbody').children.length)throw Error('資料或互動模組尚未完整初始化');
 if(boot.errors.length)throw Error('偵測到啟動錯誤，保留閱讀模式');
 var countC=ALL.filter(function(r){return r.type==='C'}).length;
 boot.ready=true;boot.count=ALL.length;boot.catalog=CATALOG.length;boot.examples=ESTIMATES.length;boot.cRows=countC;
 document.documentElement.setAttribute('data-steel-ready','true');
 E('steel-resume').hidden=false;E('steel-resume').onclick=function(){document.documentElement.setAttribute('data-steel-ready','true');window.scrollTo(0,0)};
 var bar=document.createElement('div');bar.id='steel-live-status';bar.className='steel-live-status';bar.innerHTML='<b>v1.2.1 · 互動已啟動 · '+ALL.length+' 筆內建及自訂資料</b> <button id="steel-open-reader">完整資料閱讀模式</button>';
 document.querySelector('.hero').insertAdjacentElement('afterend',bar);
 E('steel-open-reader').onclick=function(){document.documentElement.removeAttribute('data-steel-ready');E('steel-boot-message').textContent='已切換至閱讀模式。129 筆內建資料如下；此模式不含您另存的自訂資料。';window.scrollTo(0,0)};
 var oldRender=renderRows;renderRows=function(){oldRender();if(state.filter==='C'&&state.source==='catalog'&&getRows().length===0){var msg='本版 C 型鋼只有 5 筆理論示例，未收錄原廠 C 型鋼型錄。請將資料性質改為「全部」或「理論估算值」。';E('mobilelist').textContent=msg;E('tbody').innerHTML='<tr><td colspan="8">'+msg+'</td></tr>'}};renderRows();
 var v=E('v11-video');if(v){v.preload='none';v.addEventListener('error',function(){E('v11-media-status').textContent='影片未能載入，但型鋼查詢仍可使用。請確認網路，或使用含影片離線版。'});}
 var online=window.STEEL_MEDIA&&window.STEEL_MEDIA.src.indexOf('data:')!==0;
 if(online&&E('v11-media-status'))E('v11-media-status').textContent='操作影片依需求載入｜台灣女性合成旁白；影片不影響查詢。';
 downloadOffline=function(){
  if(online){var a=document.createElement('a');a.href='steel-sections-v1.2.1-offline.html';a.download='台灣型鋼斷面查詢_v1.2.1_離線版.html';a.click();return;}
  var template=JSON.parse(E('steel-export-template').textContent),scripts=Array.from(document.querySelectorAll('script[data-steel-source]')).map(function(s){return s.outerHTML}).join('\n');
  var q=JSON.stringify(template).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026').replace(/%/g,'\\u0025');
  var clean=template.replace('%%EXPORT_TEMPLATE%%',function(){return q}).replace('%%SOURCE_SCRIPTS%%',function(){return scripts});
  saveFile(clean,'台灣型鋼斷面查詢_v1.2.1_離線版.html','text/html;charset=utf-8');
 };E('downloadOffline').onclick=downloadOffline;
 window.STEEL_FIX_REPORT=function(){return {version:boot.version,ready:boot.ready,total:ALL.length,catalog:CATALOG.length,examples:ESTIMATES.length,cRows:countC,visible:getRows().length,errors:boot.errors.slice(),source:online?'online-lightweight':'offline-embedded'}};
}catch(e){boot.errors.push(String(e.message));boot.ready=false;document.documentElement.removeAttribute('data-steel-ready');E('steel-boot-message').textContent='互動程式啟動未完成，已保留完整資料閱讀模式。請用 Safari 開啟線上版。';E('steel-diagnostic').hidden=false;E('steel-diagnostic-text').textContent=boot.errors.join('\n');}
})();'''
def build(base,out):
    raw=base.read_bytes();sha=hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()
    if sha!=BASE_SHA:raise RuntimeError('Base changed; review before patching: '+sha)
    text=raw.decode('utf-8');scripts=[m.group(2) for m in SCRIPT_RE.finditer(text)]
    if len(scripts)!=5:raise ValueError('Expected five verified v1.2 scripts')
    core=scripts[1].rsplit('wire();',1)[0]
    node="const vm=require('vm');const c={localStorage:{getItem(){return null}},console};vm.createContext(c);vm.runInContext("+json.dumps(scripts[0]+'\n'+core+"\nresult=JSON.stringify({catalog:CATALOG,examples:ESTIMATES,types:TYPES});")+",c);process.stdout.write(c.result);"
    data=json.loads(subprocess.check_output(['node','-e',node],text=True))
    assert len(data['catalog'])==98 and len(data['examples'])==31
    media=re.search(r'data:video/mp4;base64,([A-Za-z0-9+/=]+)',scripts[2]);assert media
    mp4=base64.b64decode(media.group(1))
    old='const ALL=[...CATALOG,...ESTIMATES,...customs]'
    cleaned="customs=customs.filter(r=>r&&typeof r==='object'&&typeof r.id==='string'&&r.id.startsWith('USER-')&&typeof r.name==='string'&&TYPES[r.type]).map(r=>{try{const c=calculate(r);return ['A','W','Ix','Iy','Sx','Sy','rx','ry'].every(k=>Number.isFinite(c[k])&&c[k]>0)?{...c,id:r.id,name:r.name,alias:String(r.alias||r.name),source:'使用者自訂（理論）',nominal:String(r.nominal||'')}:null}catch{return null}}).filter(Boolean);\nconst ALL=[...CATALOG,...ESTIMATES,...customs]"
    assert old in scripts[1];scripts[1]=scripts[1].replace(old,cleaned)
    scripts[3]=scripts[3].replace('preload="metadata"','preload="none"')
    scripts=[s.replace('1.2.0','1.2.1').replace('v1.2 ·','v1.2.1 ·') for s in scripts]
    stripped=SCRIPT_RE.sub('',text).replace('Version 1.2.0','Version 1.2.1').replace('載入中…','互動程式尚未啟動')
    stripped=stripped.replace('</head>',STYLE+'</head>').replace('<body>','<body>'+static_markup(data),1)
    stripped=stripped.replace('</body>','<script id="steel-export-template" type="application/json">%%EXPORT_TEMPLATE%%</script>\n%%SOURCE_SCRIPTS%%\n</body>')
    assert 'id="steel-reader"' in stripped
    out.mkdir(parents=True,exist_ok=True);(out/'media').mkdir(exist_ok=True)
    for online,name in [(False,'steel-sections-v1.2.1-offline.html'),(True,'index.html')]:
        codes=list(scripts)
        if online:codes[2]=re.sub(r'data:video/mp4;base64,[A-Za-z0-9+/=]+','media/tutorial-zh-TW.mp4',codes[2])
        blocks='\n'.join('<script data-steel-source="'+str(i)+'">'+s+'</script>' for i,s in enumerate([BOOT]+codes+[FINISH]))
        final=stripped.replace('%%EXPORT_TEMPLATE%%',safejson(stripped)).replace('%%SOURCE_SCRIPTS%%',blocks)
        (out/name).write_text(final,encoding='utf-8')
    reader='<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>台灣型鋼資料表｜不需 JavaScript</title>'+STYLE+'</head><body>'+static_markup(data)+'</body></html>'
    reader=reader.replace('目前為資料閱讀模式，互動程式尚未啟動。','這是完整資料閱讀版，不含互動搜尋或計算。').replace('若持續看到此提示，可能是檔案預覽禁止程式，或程式啟動失敗；不是資料庫仍在下載。下方 129 筆內建資料仍可閱讀。','可在檔案預覽中展開 9 種型式，直接查看全部 129 筆內建資料。')
    (out/'reference-no-script.html').write_text(reader,encoding='utf-8')
    (out/'section-data.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
    (out/'media/tutorial-zh-TW.mp4').write_bytes(mp4)
    readme='# 台灣型鋼 v1.2.1 — 空白／載入中修正\n\n用 Safari 開啟 '+LIVE+'?v=1.2.1 。附件 HTML 預覽不等同瀏覽器執行環境。當 JavaScript 未執行或啟動失敗時，新版保留 129 筆完整資料閱讀模式，不再空白等待。閱讀模式不能做互動搜尋及自訂計算。\n\n- index.html：輕量版；影片為 media/tutorial-zh-TW.mp4，查詢不依賴影片。\n- steel-sections-v1.2.1-offline.html：完整單檔，包含影片、資料及程式。\n- reference-no-script.html：不需 JavaScript 的完整資料表。\n- section-data.json：98 筆原廠型錄＋31 筆理論示例。\n- verification-v121.json：本次實際測試結果。\n\n本修正不修改型錄數據或幾何公式；C 型鋼只有 5 筆理論示例。不是原廠供貨確認，也不是結構強度認證。原影片保留 v1.2 流程；閱讀模式與啟動提示為新增內容。自訂資料留在目前瀏覽器，請以 JSON 備份。\n'
    (out/'README-v121.md').write_text(readme,encoding='utf-8')
    return data
def package(out):
    with zipfile.ZipFile(out/'steel-sections-v1.2.1-offline.zip','w',zipfile.ZIP_DEFLATED) as z:
        for name in ['index.html','steel-sections-v1.2.1-offline.html','reference-no-script.html','section-data.json','README-v121.md','verification-v121.json','media/tutorial-zh-TW.mp4']:
            if (out/name).exists():z.write(out/name,name)
if __name__=='__main__':
    a=argparse.ArgumentParser();a.add_argument('--base',type=Path,required=True);a.add_argument('--out',type=Path,required=True);args=a.parse_args();build(args.base,args.out);package(args.out)
    print(json.dumps({'version':VERSION,'files':{f.name:f.stat().st_size for f in args.out.glob('*') if f.is_file()}},ensure_ascii=False))
