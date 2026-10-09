from pathlib import Path
import json,html
root=Path(__file__).parent
r=json.loads((root/'validation-results.json').read_text(encoding='utf-8'))
rows=''.join('<tr><td>'+html.escape(x['name'])+'</td><td>'+f"{x['expected']:.5f}"+'</td><td>'+f"{x['actual']:.5f}"+'</td><td>'+f"{x['errorPercent']:.5f}%"+'</td></tr>' for x in r['benchmarkComparisons'][:13])
validation='<p><strong>8 組驗證項目通過</strong>｜19項數值對照。公開案例最大相對差異 '+f"{max(x['errorPercent'] for x in r['benchmarkComparisons'][:13]):.5f}"+'%。120角度與720角度在5種受力情況比較，D/C差異小於0.3%。</p><div class="table-wrap"><table><thead><tr><th>案例／數值</th><th>公開值</th><th>本核心</th><th>差異</th></tr></thead><tbody>'+rows+'</tbody></table></div><p>單向軸力單位kip、彎矩kip·ft；雙向為未折減名義強度。測試涵蓋剪力、軸壓超限、無效輸入、長細篩選、對稱性與配筋搜尋。外部案例於主筋與壓力塊交界的面積扣除方式及原文約整造成小幅差異。</p>'
custom=json.loads((root/'custom-validation.json').read_text(encoding='utf-8'))
validation+='<p><strong>v1.3 實際座標模式：'+str(len(custom['checks']))+' 組檢核通過</strong>。均勻配置轉座標後數值相同；另驗證混合筋徑、非對稱鏡射、逐筋手算、偏心純拉端點、實際單向切片、重疊越界、箍筋與方向收斂。這些為程式驗證，不表示所有工程條件皆已完成設計。</p>'
drag=json.loads((root/'drag-validation.json').read_text(encoding='utf-8')) if (root/'drag-validation.json').exists() else None
if drag:validation+='<p><strong>v1.3 圖面拖曳：'+str(len(drag['checks']))+' 組測試通過</strong>。涵蓋實際滑鼠與觸控、座標吸附、側撐確認失效、整排展開、200根配置、邊界、重疊、復原及取消、鍵盤、離線保存與手機版面。</p>'
layers=json.loads((root/'layers-validation.json').read_text(encoding='utf-8')) if (root/'layers-validation.json').exists() else None
layerui=json.loads((root/'layers-ui-validation.json').read_text(encoding='utf-8')) if (root/'layers-ui-validation.json').exists() else None
if layers:validation+='<p><strong>v1.3 多層配置：'+str(len(layers["checks"]))+' 組數值檢核通過</strong>。驗證2～6層尺寸、根數、面積、混合筋徑、人工座標容量等價、軸壓手算、淨距不足、200根上限與方向收斂。</p>'
if layerui:validation+='<p><strong>多層操作：'+str(len(layerui["checks"]))+' 組測試通過</strong>。包含模板草稿與座標區分、拖曳、JSON及離線重開、Word報表、錯誤處理與320～1440px手機／桌面版面。</p>'
audit=json.loads((root/'audit-validation.json').read_text(encoding='utf-8')) if (root/'audit-validation.json').exists() else None
auditui=json.loads((root/'audit-ui-validation.json').read_text(encoding='utf-8')) if (root/'audit-ui-validation.json').exists() else None
if audit:validation+='<p><strong>v1.3.1 逐步明細：'+str(len(audit["checks"]))+' 組數值檢核通過</strong>。逐根淨力及兩方向力矩加總回復核心值，半圓占用面積與形心修正獨立公式、包絡插值及純軸力／耐震分支均驗證。</p>'
if auditui:validation+='<p><strong>逐步明細操作：'+str(len(auditui["checks"]))+' 組測試通過</strong>。逐筋表格顯示加總與核心一致、全部載重組合報表匯出、手機／桌面明細無全頁水平溢出。</p>'
surface=json.loads((root/'surface-validation.json').read_text(encoding='utf-8')) if (root/'surface-validation.json').exists() else None
surfaceui=json.loads((root/'surface-ui-validation.json').read_text(encoding='utf-8')) if (root/'surface-ui-validation.json').exists() else None
if surface:validation+='<p><strong>v1.4 3D曲面：'+str(len(surface["checks"]))+'組數值檢核通過</strong>。固定軸力輪廓與原核心一致；驗證軸力上下限、對稱容量、非對稱純拉形心偏心、多層及分段取消。</p>'
if surfaceui:validation+='<p><strong>3D操作：'+str(len(surfaceui["checks"]))+'組測試通過</strong>。實際滑鼠與手機單指／雙指、載重點選、視角、PNG、無效輸入、最新條件重建、離線與原生DOCX相容。</p>'
surfacepro=json.loads((root/'surface-pro-validation.json').read_text(encoding='utf-8')) if (root/'surface-pro-validation.json').exists() else None
surfaceproui=json.loads((root/'surface-pro-ui-validation.json').read_text(encoding='utf-8')) if (root/'surface-pro-ui-validation.json').exists() else None
if surfacepro:validation+='<p><strong>v1.5 PRO 精確切片：'+str(len(surfacepro["checks"]))+'組數值檢核通過</strong>。任意P直接120方向求解與原核心一致；軸力超界不截斷，純拉偏心、多層混合配筋與取消／未收斂處理通過。</p>'
if surfaceproui:validation+='<p><strong>專業版操作：'+str(len(surfaceproui["checks"]))+'組測試通過</strong>。平移、最大化、讀值、自由切片、連續輸入取消、手機觸控、2000px圖形匯出、離線及原生DOCX相容，零外部資源與零JavaScript錯誤。</p>'
# Embed tutorial timings, captions, official review and the full parameter dictionary.
chapter_path=root/'tutorial-chapters.json'
tutorial=json.loads(chapter_path.read_text(encoding='utf-8')) if chapter_path.exists() else {'title':'RC柱操作教學','chapters':[]}
vtt_path=root/'assets/tutorial-zh-TW.vtt'
if vtt_path.exists():
    import re
    def vtt_seconds(stamp):
        parts=[float(x) for x in stamp.replace(',', '.').split(':')]
        return sum(v*60**i for i,v in enumerate(reversed(parts)))
    cues=[]
    for block in re.split(r'\n\s*\n',vtt_path.read_text(encoding='utf-8').replace('\r','')):
        lines=block.strip().splitlines()
        timed=next((i for i,line in enumerate(lines) if '-->' in line),None)
        if timed is not None:
            a,b=lines[timed].split('-->',1)
            cues.append({'start':vtt_seconds(a.strip()),'end':vtt_seconds(b.strip().split()[0]),'text':'\n'.join(lines[timed+1:])})
    tutorial['cues']=cues
review_path=root/'regulation-review-20261009.json'
regulation=json.loads(review_path.read_text(encoding='utf-8')) if review_path.exists() else {}
parameter_path=root/'parameter-review-20261009.json'
parameters=json.loads(parameter_path.read_text(encoding='utf-8')).get('parameters',[]) if parameter_path.exists() else []
param_ranges={'name':'可辨識柱位的文字；不同樓層／斷面應分開編號','mode':'一般箍筋柱／特殊抗彎矩構架柱，須依核定結構系統選取','b':'20～200 cm','h':'20～200 cm','environment':'室內／暴露大氣／直接澆置接土／海水與腐蝕環境','cover':'4～15 cm；室內≥4、大氣保守≥5、直接接土≥7.5、海水／腐蝕≥10；另核耐久與防火','agg':'0.5～4 cm','fc':'210～700 kgf/cm²；特殊抗彎矩構架≥280','fy':'一般2800～5600 kgf/cm²；本版耐震模式只支援4200、5000、5600','fyt':'2800～5600 kgf/cm²；剪力採計一般上限4200、耐震上限5600；圍束依核定材料及條文','Es':'1,900,000～2,150,000 kgf/cm²','layout':'均勻每邊根數／實際位置與數量／2～6層周邊主筋','bar':'本版D10～D36清單（9種）；柱主筋尺寸仍須通過細則檢核','nx':'2～12整數；上下每邊各含角筋','ny':'2～12整數；左右每邊各含角筋','tie':'本版D10、D13、D16；須另通過箍筋尺寸檢核','s':'3～60 cm；輸入範圍不等於符合一般／耐震最大間距','tieLegsX':'2～30整數；只計平行X方向有效肢','tieLegsY':'2～30整數；只計平行Y方向有效肢','dX':'1～b cm，且不得超出核心對兩側最外筋核定上界；須另核受拉筋形心','dY':'1～h cm，且不得超出核心對兩側最外筋核定上界；須另核受拉筋形心','hx':'1～100 cm；高軸壓耐震另限≤20、其餘指定範圍≤35','nl':'4≤nₗ≤總主筋數，整數；只計核心周邊有效側撐筋，內層不自動計入','supported':'完成詳圖核對才勾選；拖曳／主筋與箍筋相關輸入更動會取消','L':'50～1500 cm','frame':'有側移支撐／無側移支撐，依分析支承條件','kx':'0.3～3.0','ky':'0.3～3.0','ratioX':'−1～+1；單曲率負、雙曲率正；由核定分析求取','ratioY':'−1～+1；單曲率負、雙曲率正；由核定分析求取','second':'僅確認輸入內力已含外部二階分析結果；不由本程式放大','loads.name':'每一列同一組合、同一斷面的名稱；最多30組','loads.P':'有限數值；壓縮正、拉力負；是否超出容量由檢核判定','loads.Mx':'有限數值，可正可負；正值壓縮Y正側','loads.My':'有限數值，可正可負；正值壓縮X正側','loads.Vx':'有限數值，可正可負；容量檢核取絕對值，bw=h、d=dX','loads.Vy':'有限數值，可正可負；容量檢核取絕對值，bw=b、d=dY','customBars.bar':'每列從本版D10～D36清單（9種）選；全部主筋共用核定fy及Es','customBars.n':'每列1～50整數；總4～200根、最多200列；不支援束筋','customBars.x1':'有限cm數值；左下原點，X向右；主筋須位於箍內且淨距足夠','customBars.y1':'有限cm數值；左下原點，Y向上；主筋須位於箍內且淨距足夠','customBars.x2':'N≥2必填；與起點含兩端等分，不可同座標重疊','customBars.y2':'N≥2必填；N=1時只使用起點','customBars.layer':'1～6整數，來源分組標籤，拖曳後不保證仍為矩形周邊','layerCount':'2～6整數','layerConfig.bar':'每層從本版D10～D36清單（9種）選，支援層間不同筋徑','layerConfig.nx':'2～12整數，上下每邊含角筋','layerConfig.ny':'2～12整數，左右每邊含角筋','layerConfig.clear':'0.1～30 cm設定範圍；產生後仍須逐對符合柱主筋最小淨距','dragSnap':'自由0.01 cm、吸附0.1／0.5／1 cm','pm3dSliceP':'實際曲面軸拉下限～最大設計軸壓；超界不截斷，顯示不可用','pm3dQuality':'標準29層×60方向／精細45層×120方向；自由P切片採120方向'}
param_examples={'name':'C1','mode':'一般箍筋柱','b':'60 cm；圖說600 mm先除10','h':'60 cm','environment':'室內、不接觸土壤','cover':'4 cm；D13箍、D25主筋中心偏距=4+1.27+2.54/2=6.54 cm','agg':'20 mm→2 cm','fc':'280 kgf/cm²','fy':'4,200 kgf/cm²','fyt':'4,200 kgf/cm²','Es':'2,040,000 kgf/cm²','layout':'每邊根數→60×60，12-D25','bar':'D25：直徑2.54 cm、單根面積5.067 cm²','nx':'4；上下各4根含角筋','ny':'4；左右各4根含角筋，合計2×4+2×4−4=12根','tie':'D13：直徑1.27 cm','s':'10 cm；D13@10','tieLegsX':'4肢；依箍／繫筋詳圖確認','tieLegsY':'4肢；依箍／繫筋詳圖確認','dX':'規則範例53.46 cm；不規則須由受拉筋形心核定','dY':'規則範例53.46 cm','hx':'15.64 cm；60×60、12-D25均勻配置的側撐中心距','nl':'缺省4；若詳圖核定8根核心周邊有效側撐筋，輸入8→kn=8/(8−2)=1.3333','supported':'核對12根的有效側撐、肢數、hx及有效深度後才勾選','L':'300 cm','frame':'有側向位移支撐','kx':'1.0','ky':'1.0','ratioX':'−1.0；依同組合曲率及M1/M2核定','ratioY':'−1.0','second':'長細超限時，完成外部二階分析並替換內力後再確認','loads.name':'U1 · 重力組合','loads.P':'U1：+300 tf，為壓縮','loads.Mx':'U1：+20 tf·m','loads.My':'U1：+10 tf·m；U2：−18 tf·m','loads.Vx':'U1：15 tf','loads.Vy':'U1：15 tf','customBars.bar':'D25','customBars.n':'4：起點至終點等分4根，包含兩端','customBars.x1':'6.54 cm','customBars.y1':'6.54 cm','customBars.x2':'53.46 cm','customBars.y2':'6.54 cm；形成下排4-D25','customBars.layer':'L2為來源第2層，仍以實際座標計算','layerCount':'2層：60×60、共24-D25；3層範例改80×80、36-D25','layerConfig.bar':'各層D25','layerConfig.nx':'4','layerConfig.ny':'4','layerConfig.clear':'4 cm；第2層中心偏距=6.54+2.54+4=13.08 cm','dragSnap':'0.5 cm吸附；精確位置可直接輸入表格','pm3dSliceP':'U1=300 tf；自訂150 tf只探查切片，不改載重','pm3dQuality':'教學用標準取樣；報告圖可切精細後匯出PNG'}
for item in parameters:
    item['range']=param_ranges.get(item['id'],'依工程核定資料及本版選項輸入')
    item['example']=param_examples.get(item['id'],'參照程式內教學範例')
def json_inline(value):
    return json.dumps(value,ensure_ascii=False).replace('<','\\u003c')
def parameter_card(item):
    e=lambda x:html.escape(str(x))
    fields=[('適用模式',item.get('applies','')),('定義／方向',item['definition']),('單位',item['unit']),('允許／合理範圍',item['range']),('資料來源',item['source']),('可照填範例',item['example']),('核對重點',item.get('commonMisuse',''))]
    return '<article class="parameter-entry" id="parameter-'+e(item['id'])+'"><h3>'+e(item['label'])+' <span class="audit-meta">'+e(item['id'])+'</span></h3><dl class="parameter-facts">'+''.join('<dt>'+e(k)+'</dt><dd>'+e(v)+'</dd>' for k,v in fields)+'</dl></article>'
parameter_static=''.join(parameter_card(p) for p in parameters)
regulation_static='<table><thead><tr><th>規範項目／條文</th><th>實作判讀</th><th>適用限制</th></tr></thead><tbody>'+''.join('<tr><td>'+html.escape(x['topic'])+'<br>'+html.escape('、'.join(x.get('clauses',[])))+'</td><td><strong>'+html.escape(x['status'])+'</strong><br>'+html.escape(x['implementation'])+'</td><td>'+html.escape(x.get('limitation',''))+'</td></tr>' for x in regulation.get('items',[]))+'</tbody></table>'
tutorialui=json.loads((root/'tutorial-ui-validation.json').read_text(encoding='utf-8')) if (root/'tutorial-ui-validation.json').exists() else None
regverify=json.loads((root/'regulation-validation.json').read_text(encoding='utf-8')) if (root/'regulation-validation.json').exists() else None
regression16=json.loads((root/'regression-v16-validation.json').read_text(encoding='utf-8')) if (root/'regression-v16-validation.json').exists() else None
if regverify:validation+='<p><strong>v1.6 現行規範修正：'+str(len(regverify['checks']))+'組數值檢核通過</strong>。核心周邊有效側撐nₗ、耐震剪力折減0.60、海水／腐蝕性保護層10cm及舊專案缺省均驗證；一般模式既有數值維持，未宣稱完整耐震設計。</p>'
if regression16:validation+='<p><strong>v1.6 報告與專案：'+str(len(regression16['checks']))+'組回歸檢核通過</strong>。耐震高軸力nₗ與折減因數、原生DOCX逐字表、JSON與離線重開及無效nₗ拒絕一致。</p>'
if tutorialui:validation+='<p><strong>v1.6 影片、參數與工作流程：'+str(len(tutorialui['checks']))+'組操作檢核通過</strong>。包含章節、旁白與字幕控制、參數解釋、手機版面、單檔離線與原生DOCX相容。</p>'
s=(root/'page.html').read_text(encoding='utf-8').replace('/*DOCX_VENDOR*/',(root.parent/'vendor/docx/docx-9.6.1.iife.js').read_text(encoding='utf-8').replace('</script','<\\/script')).replace('/*DOCX_CORE*/',(root.parent/'shared/calculation-docx.js').read_text(encoding='utf-8')).replace('/*CORE*/',(root/'core.js').read_text(encoding='utf-8')).replace('/*SURFACE_CORE*/',(root/'surface-core.js').read_text(encoding='utf-8')).replace('/*SURFACE_UI*/',(root/'surface-ui.js').read_text(encoding='utf-8')).replace('/*AUDIT_UI*/',(root/'audit-ui.js').read_text(encoding='utf-8')).replace('/*LAYERS_UI*/',(root/'layers-ui.js').read_text(encoding='utf-8')).replace('/*DRAG_UI*/',(root/'drag-ui.js').read_text(encoding='utf-8')).replace('/*TUTORIAL_DATA*/',json_inline(tutorial)).replace('/*PARAMETER_DATA*/',json_inline(parameters)).replace('/*REGULATION_REVIEW*/',json_inline(regulation)).replace('/*TUTORIAL_UI*/',(root/'tutorial-ui.js').read_text(encoding='utf-8')).replace("'/*VALIDATION*/'",json.dumps(validation,ensure_ascii=False))
import re
s=re.sub(r'<div id="codeBasisTable" class="table-wrap">.*?</div>','<div id="codeBasisTable" class="table-wrap">'+regulation_static+'</div>',s,flags=re.S)
s=s.replace('<div id="parameterEntries"></div>','<div id="parameterEntries">'+parameter_static+'</div>')
assert all(x not in s for x in ['/*SURFACE_CORE*/','/*SURFACE_UI*/','/*CORE*/','/*AUDIT_UI*/','/*DRAG_UI*/','/*LAYERS_UI*/','/*VALIDATION*/','/*TUTORIAL_DATA*/','/*TUTORIAL_UI*/','/*PARAMETER_DATA*/','/*REGULATION_REVIEW*/'])
(root/'dist').mkdir(exist_ok=True)
(root/'dist/index.html').write_text(s,encoding='utf-8')
import shutil
if (root/'assets').exists():
    shutil.copytree(root/'assets',root/'dist/assets',dirs_exist_ok=True)
# Separate printable manual, with the same authoritative input guide.
guide=s.split('<section id="guidePanel"')[1].split('</section>')[0]
guide='<section '+guide.split('>',1)[1]
# Use the rendered guide fragment, never copy the app scripts into the manual.
content=s[s.index('<section id="guidePanel"'):s.index('</section>',s.index('<section id="guidePanel"'))+10].replace('class="guide hidden"','class="guide"')
content=content.replace('<div id="parameterEntries"></div>','<div id="parameterEntries">'+parameter_static+'</div>')
content=content.replace('<span id="parameterCount" class="audit-meta"></span>','<span class="audit-meta">'+str(len(parameters))+'項參數</span>')
content=content.replace('<div id="validationSummary" class="notice">驗算結果由隨附驗證紀錄提供。</div>','<div class="notice">'+validation+'</div>')
import re
content=re.sub(r'<button[^>]*>.*?</button>','',content)
content=re.sub(r'<div class="parameter-search">.*?</div>','',content,flags=re.S)
css=s.split('<style>')[1].split('</style>')[0]
manual='<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RC柱操作說明</title><style>'+css+' body{padding:24px}.guide{margin:auto} details{break-inside:avoid}</style><h1 style="max-width:1100px;margin:0 auto 20px">RC 柱配筋工作台 — 操作說明 v1.6 PRO</h1>'+content+'</html>'
(root/'dist/manual.html').write_text(manual,encoding='utf-8')
md='# RC 柱數值驗證 v1.3\n\n查核日期：2026-10-05。\n\n| 項目 | 公開值 | 本核心 | 相對差異 % |\n|---|---:|---:|---:|\n'
for x in r['benchmarkComparisons']:md+=f"|{x['name']}|{x['expected']:.8f}|{x['actual']:.8f}|{x['errorPercent']:.8f}|\n"
md+='\n驗證項目：\n\n'+'\n'.join('- '+x for x in r['checks'])+'\n\n'+'\n'.join(r['notes'])+'\n\n來源與可照輸入範例均見程式內「操作說明」。執行 `node verify.cjs` 重新產生紀錄；`python3 build.py` 重建單一 HTML。\n'
md+='\n## 實際座標模式\n\n'+'\n'.join('- '+x for x in custom['checks'])+'\n\n'+'\n'.join(custom['notes'])+'\n\n執行 `node custom-verify.cjs` 更新紀錄。\n'
if drag:md+='\n## 圖面拖曳\n\n'+'\n'.join('- '+x for x in drag['checks'])+'\n\n實際滑鼠與CDP觸控事件驗證，計算結果與更新後座標一致，圖形操作使用同一強度核心。\n'
if layers:md+='\n## 多層數值驗證\n\n'+'\n'.join('- '+x for x in layers['checks'])+'\n\n'+json.dumps(layers['numbers'],ensure_ascii=False,indent=2)+'\n\n執行 `node layers-verify.cjs` 更新紀錄。\n'
if layerui:md+='\n## 多層操作驗證\n\n'+'\n'.join('- '+x for x in layerui['checks'])+'\n'
if audit:md+='\n## 詳細計算核算\n\n'+'\n'.join('- '+x for x in audit['checks'])+'\n'
if auditui:md+='\n## 詳細計算操作\n\n'+'\n'.join('- '+x for x in auditui['checks'])+'\n'
if surface:md+='\n## 3D曲面數值驗證 2026-10-07\n\n'+'\n'.join('- '+x for x in surface['checks'])+'\n'
if surfaceui:md+='\n## 3D介面操作驗證\n\n'+'\n'.join('- '+x for x in surfaceui['checks'])+'\n'
if surfacepro:md+='\n## 專業版精確切片 2026-10-07\n\n'+'\n'.join('- '+x for x in surfacepro['checks'])+'\n\n'+json.dumps(surfacepro['numbers'],ensure_ascii=False,indent=2)+'\n'
if regverify:md+='\n## v1.6 現行規範修正驗證\n\n'+'\n'.join('- '+x for x in regverify['checks'])+'\n'
if regression16:md+='\n## v1.6 高軸壓與報告回歸\n\n'+'\n'.join('- '+x for x in regression16['checks'])+'\n'
if tutorialui:md+='\n## v1.6 影片與參數操作驗證\n\n'+'\n'.join('- '+x for x in tutorialui['checks'])+'\n'
if surfaceproui:md+='\n## 專業版操作驗證\n\n'+'\n'.join('- '+x for x in surfaceproui['checks'])+'\n'
(root/'VALIDATION.md').write_text(md,encoding='utf-8')
print('built',len(s.encode()),'bytes')

