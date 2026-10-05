"""Build canonical self-contained CFRP page; no QA baselines or parent repo required."""
from pathlib import Path
p=Path(__file__).resolve().parent
s=(p/'source-template.html').read_text(encoding='utf8')
for marker,name in [('ENGINE','engine.js'),('DOCXVENDOR','vendor/docx/docx-9.6.1.iife.js'),('DOCX','shared/calculation-docx.js')]:
    token='@@'+marker+'@@'
    if s.count(token)!=1:raise ValueError('Expected exactly one source marker: '+token)
    content=(p/name).read_text(encoding='utf8')
    if marker=='DOCXVENDOR':content=content.replace('</script','<\\/script')
    s=s.replace(token,content)
(p/'index.html').write_text(s,encoding='utf8')
print('Built canonical CFRP source-template/engine/vendor/shared')
