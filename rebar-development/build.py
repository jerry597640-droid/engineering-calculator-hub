"""Build canonical source-first UI and offline reports."""
from pathlib import Path
p=Path(__file__).parent
s=(p/'template.html').read_text(encoding='utf8')
for marker,name in [('ENGINE','engine.js'),('UI','ui.js')]:
    a=s.index('/* '+marker+'_START */')+len('/* '+marker+'_START */')
    b=s.index('/* '+marker+'_END */')
    s=s[:a]+'\n'+(p/name).read_text(encoding='utf8')+'\n'+s[b:]
for key,name in [('DOCXVENDOR','../vendor/docx/docx-9.6.1.iife.js'),('DOCX','../shared/calculation-docx.js'),('TRACE','trace-addon.js')]:
    s=s.replace('@@'+key+'@@',(p/name).read_text(encoding='utf8'))
(p/'index.html').write_text(s,encoding='utf8')
print(len(s.encode('utf8')),'bytes')
