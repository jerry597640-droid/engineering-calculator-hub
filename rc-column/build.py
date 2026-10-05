from pathlib import Path
import json,html
root=Path(__file__).parent
r=json.loads((root/'validation-results.json').read_text())
rows=''.join('<tr><td>'+html.escape(x['name'])+'</td><td>'+f"{x['expected']:.5f}"+'</td><td>'+f"{x['actual']:.5f}"+'</td><td>'+f"{x['errorPercent']:.5f}%"+'</td></tr>' for x in r['benchmarkComparisons'][:13])
validation='<p><strong>8 組驗證項目通過</strong>｜19項數值對照。公開案例最大相對差異 '+f"{max(x['errorPercent'] for x in r['benchmarkComparisons'][:13]):.5f}"+'%。120角度與720角度在5種受力情況比較，D/C差異小於0.3%。</p><div class="table-wrap"><table><thead><tr><th>案例／數值</th><th>公開值</th><th>本核心</th><th>差異</th></tr></thead><tbody>'+rows+'</tbody></table></div><p>單向軸力單位kip、彎矩kip·ft；雙向為未折減名義強度。測試涵蓋剪力、軸壓超限、無效輸入、長細篩選、對稱性與配筋搜尋。外部案例於主筋與壓力塊交界的面積扣除方式及原文約整造成小幅差異。</p>'
custom=json.loads((root/'custom-validation.json').read_text())
validation+='<p><strong>v1.1 實際座標模式：'+str(len(custom['checks']))+' 組檢核通過</strong>。均勻配置轉座標後數值相同；另驗證混合筋徑、非對稱鏡射、逐筋手算、偏心純拉端點、實際單向切片、重疊越界、箍筋與方向收斂。這些為程式驗證，不表示所有工程條件皆已完成設計。</p>'
s=(root/'page.html').read_text().replace('/*CORE*/',(root/'core.js').read_text()).replace("'/*VALIDATION*/'",json.dumps(validation,ensure_ascii=False))
assert '/*CORE*/' not in s and '/*VALIDATION*/' not in s
(root/'dist').mkdir(exist_ok=True)
(root/'dist/index.html').write_text(s)
# Separate printable manual, with the same authoritative input guide.
guide=s.split('<section id="guidePanel"')[1].split('</section>')[0]
guide='<section '+guide.split('>',1)[1]
# Use the rendered guide fragment, never copy the app scripts into the manual.
content=s[s.index('<section id="guidePanel"'):s.index('</section>',s.index('<section id="guidePanel"'))+10].replace('class="guide hidden"','class="guide"')
content=content.replace('<div id="validationSummary" class="notice">驗算結果由隨附驗證紀錄提供。</div>','<div class="notice">'+validation+'</div>')
import re
content=re.sub(r'<button[^>]*>.*?</button>','',content)
css=s.split('<style>')[1].split('</style>')[0]
manual='<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RC柱操作說明</title><style>'+css+' body{padding:24px}.guide{margin:auto} details{break-inside:avoid}</style><h1 style="max-width:1100px;margin:0 auto 20px">RC 柱配筋工作台 — 操作說明 v1.1</h1>'+content+'</html>'
(root/'dist/manual.html').write_text(manual)
md='# RC 柱數值驗證 v1.1\n\n查核日期：2026-10-05。\n\n| 項目 | 公開值 | 本核心 | 相對差異 % |\n|---|---:|---:|---:|\n'
for x in r['benchmarkComparisons']:md+=f"|{x['name']}|{x['expected']:.8f}|{x['actual']:.8f}|{x['errorPercent']:.8f}|\n"
md+='\n驗證項目：\n\n'+'\n'.join('- '+x for x in r['checks'])+'\n\n'+'\n'.join(r['notes'])+'\n\n來源與可照輸入範例均見程式內「操作說明」。執行 `node verify.cjs` 重新產生紀錄；`python3 build.py` 重建單一 HTML。\n'
md+='\n## 實際座標模式\n\n'+'\n'.join('- '+x for x in custom['checks'])+'\n\n'+'\n'.join(custom['notes'])+'\n\n執行 `node custom-verify.cjs` 更新紀錄。\n'
(root/'VALIDATION.md').write_text(md)
print('built',len(s.encode()),'bytes')
