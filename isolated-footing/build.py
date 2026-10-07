from pathlib import Path
p=Path(__file__).parent
html=(p/'interface.html').read_text(encoding='utf-8')
shared = p.parent
vendor = shared/'vendor'/'docx'/'docx-9.6.1.iife.js'
if not vendor.exists(): vendor = p/'vendor'/'docx'/'docx-9.6.1.iife.js'
core = shared/'shared'/'calculation-docx.js'
if not core.exists(): core = p/'shared'/'calculation-docx.js'
docx = vendor.read_text(encoding='utf-8')+'\n'+core.read_text(encoding='utf-8')
html=html.replace('/* ENGINE_PLACEHOLDER */',(p/'engine.js').read_text(encoding='utf-8')).replace('/* UI_PLACEHOLDER */',(p/'ui.js').read_text(encoding='utf-8')).replace('/* DOCX_PLACEHOLDER */',docx.replace('</script','<\\/script'))
(p/'index.html').write_text(html,encoding='utf-8')
