import json,pathlib
root=pathlib.Path(__file__).resolve().parent
v=json.loads((root/'validation.json').read_text())
validation=f'<p>獨立 Python 數值積分與封閉解：<b>{v["cases"]} 個案例、{v["combinations"]} 組因素載重、{v["assertions"]} 項斷言全部通過</b>。剪力最大誤差 {v["max_shear_error_tf"]:.2e} tf，彎矩最大誤差 {v["max_moment_error_tfm"]:.2e} tf·m。另有鏡像、邊界、異常輸入及桌機／手機介面測試。詳見套件內驗算紀錄。</p>'
ui=(root/'ui.js').read_text().replace("'/*VALIDATION*/'",json.dumps(validation,ensure_ascii=False))
html=(root/'template.html').read_text().replace('/*ENGINE*/',(root/'engine.js').read_text()).replace('/*UI*/',ui)
assert '</script>' not in (root/'engine.js').read_text()
(root/'index.html').write_text(html)
print('Built index.html:',len(html.encode()),'bytes')
