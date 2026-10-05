from pathlib import Path
import json
p=Path(__file__).resolve().parent/'unit-converter'
if not p.exists():p=Path(__file__).resolve().parent
s=(p/'template.html').read_text(encoding='utf8')
for key,name in [('CATALOG','catalog.json'),('AUDIT','original-audit.json'),('ENGINE','engine.js'),('APP','app.js'),('DOCXVENDOR','../vendor/docx/docx-9.6.1.iife.js'),('DOCX','../shared/calculation-docx.js')]:
 text=(p/name).read_text(encoding='utf8')
 if name.endswith('.json'):text=json.dumps(json.loads(text),ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')
 s=s.replace('@@'+key+'@@',text)
(p/'index.html').write_text(s,encoding='utf8')
print(len(s.encode()),'bytes')
