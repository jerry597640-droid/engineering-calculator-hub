"""Self-contained private review UI. No network, external scripts, or telemetry."""
from __future__ import annotations

import base64
import io
import json
import os
from pathlib import Path


def write_review(path: Path, manifest: dict, policy: dict) -> None:
    from PIL import Image, ImageOps
    media = []
    for item in manifest.get("inspection", {}).get("media", []):
        entry = {k: item.get(k) for k in ("id", "width", "height", "kind", "locations")}
        preview = item.get("path")
        entry["image"] = None
        if preview and Path(preview).is_file():
            try:
                with Image.open(preview) as image:
                    image = ImageOps.exif_transpose(image).convert("RGB")
                    image.thumbnail((1600, 2200))
                    buf = io.BytesIO()
                    image.save(buf, format="PNG")
                    entry["image"] = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")
            except (OSError, ValueError):
                entry["unsupported_preview"] = True
        media.append(entry)
    data = {"kind": manifest["kind"], "candidates": manifest.get("candidates", []),
            "media": media, "policy": policy,
            "warning_count": len(manifest.get("inspection", {}).get("warnings", []))}
    encoded = json.dumps(data, ensure_ascii=False).replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
    html = HTML.replace("__PRIVATE_DATA__", encoded)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(html)


HTML = r'''<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; form-action 'none'; base-uri 'none'">
<title>工程文件遮蔽 本機檢視</title>
<style>
:root{color-scheme:light;--ink:#19334a;--muted:#5f7183;--line:#dce4ec;--accent:#126e72;--bg:#f1f5f8}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 system-ui,"Microsoft JhengHei",sans-serif}header{background:#112d42;color:white;padding:28px max(20px,calc((100vw - 1200px)/2))}header small{color:#9dd5d0;font-weight:700;letter-spacing:.1em}h1{font-size:27px;margin:6px 0}header p{margin:0;color:#d3dee8}main{max-width:1240px;margin:auto;padding:24px}section{background:white;border:1px solid var(--line);border-radius:12px;padding:24px;margin-bottom:22px}h2{font-size:21px;margin:0 0 12px}.muted{color:var(--muted)}.notice{border-left:4px solid #c68d28;padding:9px 14px;background:#fff8e7;margin:14px 0}button,input,select{font:inherit}button{border:1px solid #b9cbd6;background:white;padding:8px 14px;border-radius:6px;cursor:pointer}button:hover{background:#e8f2f4}.primary{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:700}.primary:hover{background:#0e5559}input[type=text]{border:1px solid #b9cbd6;border-radius:5px;padding:7px;max-width:100%;width:100%}input[type=checkbox]{width:18px;height:18px;vertical-align:middle;accent-color:var(--accent)}table{width:100%;border-collapse:collapse}th,td{text-align:left;vertical-align:top;padding:10px;border-bottom:1px solid var(--line)}th{font-size:14px;color:var(--muted);background:#f7f9fb}th:first-child{width:52px}.value{overflow-wrap:anywhere}.tag{font-size:12px;border-radius:4px;background:#eaf2f5;padding:2px 6px}.review{background:#fff1cb}.tools{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:12px 0}.add{display:grid;grid-template-columns:2fr 1fr auto;gap:10px;margin-top:18px}.gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:20px}.card{border:1px solid var(--line);padding:15px;border-radius:8px}.card h3{font-size:16px;margin:0 0 10px;overflow-wrap:anywhere}.stage{position:relative;background:#e9eef2;border:1px solid var(--line)}.stage img{display:block;width:100%;height:auto}.stage canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none;cursor:crosshair}.small{font-size:13px;color:var(--muted)}.checks label{display:block;margin:12px 0}.footer{position:sticky;bottom:0;background:#fff;border-top:1px solid var(--line);padding:14px 24px;display:flex;gap:20px;justify-content:space-between;align-items:center}.footer p{margin:0}.error{color:#b42318;font-weight:600}#status{font-size:14px}details{margin:10px 0}summary{cursor:pointer}.table-wrap{overflow:auto}@media(max-width:680px){main{padding:12px}section{padding:16px}.gallery{grid-template-columns:1fr}.add{grid-template-columns:1fr}.footer{padding:12px;align-items:stretch;flex-direction:column;gap:7px}h1{font-size:23px}td,th{padding:7px}table{min-width:560px}}
</style></head><body>
<header><small>ENGINEERING DOCUMENT REDACTOR</small><h1>工程文件遮蔽 本機檢視</h1><p>檢查名稱與圖片，選擇遮蔽範圍，再匯出處理設定。</p></header>
<main><div class="notice"><strong>這份檢視含原始名稱及圖片，請留在本機。</strong>頁面不會連線，也不會上傳檔案。規則偵測可能漏掉未標註人名、圖案 Logo 與掃描文字，請逐頁確認。</div>
<section><h2>1 名稱與文字</h2><p class="muted">勾選要移除的項目。未列出的工程名稱、英文縮寫或人名可自行加入；同一名稱的每個出現位置都會處理。</p>
<div class="tools"><button id="selectAll">全部選取</button><button id="selectNone">全部取消</button><span id="termCount" class="small"></span></div>
<div class="table-wrap"><table><thead><tr><th>遮蔽</th><th>原始名稱</th><th>分類與依據</th><th>Word 替代文字</th></tr></thead><tbody id="terms"></tbody></table></div>
<div class="add"><input id="newTerm" type="text" placeholder="新增指定名稱，例如公司英文簡稱" aria-label="新增指定名稱"><input id="newReplacement" type="text" value="[已遮蔽]" aria-label="替代文字"><button id="addTerm">加入</button></div>
</section>
<section><h2>2 Logo 圖片與頁面</h2><p class="muted">拖曳圖片可畫出遮蔽框。PDF 框選涵蓋畫面上的文字、Logo、印章與簽名；Word 可選整張圖或局部遮蔽。工程圖要保留時，請明確標示已檢查。</p>
<div id="gallery" class="gallery"></div><p id="noMedia" hidden>這份文件未找到可預覽的圖片。</p>
</section>
<section class="checks"><h2>3 完成檢查</h2>
<label><input type="checkbox" id="textChecked"> 我已檢查名稱清單，補上需要遮蔽的工程名稱、中英文別名與人名。</label>
<label><input type="checkbox" id="visualChecked"> 我已檢查全部頁面或圖片，包含 Logo、頁首頁尾、印章及簽名。</label>
<p class="small">匯出設定仍包含原始待遮蔽詞，應留在本機。實際輸出將使用新的檔案名稱；原始文件不會被覆寫。PDF 預設重建成頁面影像，保留視覺版面但無可搜尋文字層。</p>
</section></main><div class="footer"><div><p><strong>匯出後交由遮蔽工具執行</strong></p><div id="status">尚未匯出設定</div></div><button class="primary" id="exportPolicy">匯出已檢查的遮蔽設定</button></div>
<script type="application/json" id="private-data">__PRIVATE_DATA__</script>
<script>
'use strict';
const data=JSON.parse(document.getElementById('private-data').textContent);
const terms=[],states=[];const categories={PROJECT:'工程名稱',ORG:'公司／組織',PERSON:'姓名',EMAIL:'電子郵件',TW_MOBILE:'手機',TW_PHONE:'市話',TW_NATIONAL_ID:'身分證',TW_BUSINESS_ID:'統一編號',ADDRESS:'地址',CUSTOM:'自訂'};
function el(tag,text,cls){let n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n}
function updateCount(){document.getElementById('termCount').textContent=`已選 ${terms.filter(t=>t.selected).length} / ${terms.length} 項`}
function addTerm(value,category='CUSTOM',reason='自行指定',selected=true,replacement='[已遮蔽]',confidence='high'){
 if(!value.trim()||terms.some(t=>t.text.toLocaleLowerCase()===value.toLocaleLowerCase()))return;
 let t={text:value,category,selected,replacement},tr=el('tr'),cb=document.createElement('input');cb.type='checkbox';cb.checked=selected;cb.onchange=()=>{t.selected=cb.checked;updateCount()};t.cb=cb;
 let c1=el('td');c1.append(cb);let c2=el('td',value,'value');let c3=el('td');c3.append(el('span',categories[category]||category,'tag'+(confidence==='review'?' review':'')),el('div',reason,'small'));let c4=el('td'),input=document.createElement('input');input.type='text';input.value=replacement;input.oninput=()=>t.replacement=input.value;c4.append(input);tr.append(c1,c2,c3,c4);document.getElementById('terms').append(tr);terms.push(t);updateCount();
}
for(const t of data.policy.terms)addTerm(t.text,t.category,'自訂詞清單',true,t.replacement);
for(const c of data.candidates)addTerm(c.value,c.category,c.reason,c.confidence==='high','[已遮蔽]',c.confidence);
document.getElementById('selectAll').onclick=()=>{terms.forEach(t=>{t.selected=true;t.cb.checked=true});updateCount()};
document.getElementById('selectNone').onclick=()=>{terms.forEach(t=>{t.selected=false;t.cb.checked=false});updateCount()};
document.getElementById('addTerm').onclick=()=>{const v=document.getElementById('newTerm');addTerm(v.value,'CUSTOM','自行指定',true,document.getElementById('newReplacement').value);v.value=''};
function paint(s){const c=s.canvas,ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);if(s.action==='blank'){ctx.fillStyle=s.color==='white'?'rgba(255,255,255,.8)':'rgba(0,0,0,.8)';ctx.fillRect(0,0,c.width,c.height)}const showBoxes=data.kind!=='docx'||s.action==='regions';for(const b of(showBoxes?s.boxes:[])){ctx.fillStyle=s.color==='white'?'rgba(255,255,255,.82)':'rgba(0,0,0,.82)';ctx.fillRect(b[0]*c.width,b[1]*c.height,(b[2]-b[0])*c.width,(b[3]-b[1])*c.height);ctx.strokeStyle='#db5800';ctx.lineWidth=2;ctx.strokeRect(b[0]*c.width,b[1]*c.height,(b[2]-b[0])*c.width,(b[3]-b[1])*c.height)}if(s.drag){const b=s.drag;ctx.strokeStyle='#00a5a8';ctx.lineWidth=3;ctx.strokeRect(b[0]*c.width,b[1]*c.height,(b[2]-b[0])*c.width,(b[3]-b[1])*c.height)}s.count.textContent=data.kind==='docx'&&s.action==='keep'?'保留原圖（不套用遮蔽框）':data.kind==='docx'&&s.action==='blank'?'整張圖片遮蔽':`${s.boxes.length} 個局部遮蔽框`}
data.media.forEach((m,index)=>{
 const s={id:m.id,page:index+1,action:'pending',boxes:[],color:'black',reviewed:false};states.push(s);
 const card=el('div',undefined,'card');card.append(el('h3',data.kind==='docx'?`圖片 ${index+1} · ${m.id}`:`第 ${index+1} 頁`));
 if(m.locations&&m.locations.length)card.append(el('div',m.locations.join(' · '),'small'));
 if(!m.image){card.append(el('p','無法預覽此格式。請先將向量圖片轉成支援的光柵格式，或另行處理原檔。','error'));s.unsupported=true;document.getElementById('gallery').append(card);return;}
 const stage=el('div',undefined,'stage'),img=document.createElement('img'),canvas=document.createElement('canvas');img.src=m.image;img.alt='原始文件預覽，含待檢查資訊';s.canvas=canvas;stage.append(img,canvas);card.append(stage);
 let select=document.createElement('select');for(const [v,label]of(data.kind==='docx'?[['pending','請選擇圖片處理方式'],['keep','保留 已確認是工程圖／非敏感內容'],['blank','整張圖片遮蔽'],['regions','僅遮蔽框選範圍']]:[['pending','此頁尚未確認'],['keep','此頁已檢查 可保留未框選內容']])){let o=document.createElement('option');o.value=v;o.textContent=label;select.append(o)}
 select.onchange=()=>{s.action=select.value;s.reviewed=select.value!=='pending';paint(s)};
 const controls=el('div',undefined,'tools');controls.append(select);let color=document.createElement('select');for(const [v,l]of[['black','黑色遮蔽'],['white','白色清除']]){let o=el('option',l);o.value=v;color.append(o)}color.onchange=()=>{s.color=color.value;paint(s)};controls.append(color);
 const undo=el('button','取消上一個框');undo.onclick=()=>{s.boxes.pop();paint(s)};controls.append(undo);card.append(controls);s.count=el('div','0 個局部遮蔽框','small');card.append(s.count);
 function point(e){let r=canvas.getBoundingClientRect();return[Math.min(1,Math.max(0,(e.clientX-r.left)/r.width)),Math.min(1,Math.max(0,(e.clientY-r.top)/r.height))]}
 canvas.onpointerdown=e=>{if(data.kind==='docx'){s.action='regions';select.value='regions';s.reviewed=true;}canvas.setPointerCapture(e.pointerId);s.start=point(e);s.drag=[...s.start,...s.start];paint(s)};
 canvas.onpointermove=e=>{if(!s.start)return;let q=point(e);s.drag=[s.start[0],s.start[1],q[0],q[1]];paint(s)};
 canvas.onpointerup=e=>{if(!s.start)return;let q=point(e),a=s.start,b=[Math.min(a[0],q[0]),Math.min(a[1],q[1]),Math.max(a[0],q[0]),Math.max(a[1],q[1])];if(b[2]-b[0]>.003&&b[3]-b[1]>.003)s.boxes.push(b.map(x=>+x.toFixed(6)));s.start=null;s.drag=null;paint(s)};
 canvas.onpointercancel=()=>{s.start=null;s.drag=null;paint(s)};
 img.onload=()=>{canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;paint(s)};document.getElementById('gallery').append(card);
});
if(!data.media.length)document.getElementById('noMedia').hidden=false;
document.getElementById('exportPolicy').onclick=()=>{
 const status=document.getElementById('status');status.className='error';
 if(!document.getElementById('textChecked').checked||!document.getElementById('visualChecked').checked){status.textContent='請先完成文字與圖片兩項檢查。';return;}
 if(states.some(s=>s.unsupported||!s.reviewed)){status.textContent='還有圖片／頁面未確認，或包含不支援的圖片格式。';return;}
 if(states.some(s=>s.action==='regions'&&!s.boxes.length)){status.textContent='有圖片選了局部遮蔽，但還沒有畫出範圍。';return;}
 const p=structuredClone(data.policy);p.terms=terms.filter(t=>t.selected).map(t=>({text:t.text,category:t.category,replacement:t.replacement}));p.review={text_checked:true,visual_checked:true};p.media=[];p.regions=[];
 if(data.kind==='docx'){p.media=states.map(s=>s.action==='keep'?{id:s.id,action:'keep',reviewed:true}:s.action==='blank'?{id:s.id,action:'blank',color:s.color}:{id:s.id,action:'regions',regions:s.boxes,color:s.color});}
 else for(const s of states)for(const box of s.boxes)p.regions.push({page:s.page,box,color:s.color,reason:'visual-review'});
 if(!p.terms.length&&!p.regions.length&&!p.media.some(m=>m.action!=='keep')){status.textContent='目前沒有選擇任何遮蔽目標。';return;}
 const blob=new Blob([JSON.stringify(p,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='policy.reviewed.private.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);status.className='';status.textContent='已匯出。請用 apply 指令執行，完成後再檢查輸出文件。';
};
</script></body></html>'''
