from pathlib import Path
import zipfile
p=Path(__file__).parent
vendor=(p.parent/'vendor/docx/docx-9.6.1.iife.js').read_text()
s=(p/'template.html').read_text().replace('@@VENDOR@@',vendor).replace('@@ENGINE@@',(p/'engine.js').read_text())
(p/'index.html').write_text(s)
with zipfile.ZipFile(p/'steel-beam-holes-offline-v1.0.zip','w',zipfile.ZIP_DEFLATED) as z:
 z.write(p/'index.html','index.html');z.write(p/'README.md','README.md');z.write(p/'verification.json','verification.json')
