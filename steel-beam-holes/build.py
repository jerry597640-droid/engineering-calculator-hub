from pathlib import Path
import zipfile
p=Path(__file__).parent
vendor=(p.parent/'vendor/docx/docx-9.6.1.iife.js').read_text()
s=(p/'template.html').read_text().replace('@@VENDOR@@',vendor).replace('@@ENGINE@@',(p/'engine.js').read_text()).replace('@@WEBENGINE@@',(p/'web-engine.js').read_text()).replace('@@ADDON@@',(p/'addon.js').read_text()).replace('@@TUTORIAL@@',(p/'video-panel.html').read_text()).replace('@@POSITIONGUIDE@@',(p/'position-guide.html').read_text()).replace('@@POSITIONTEST@@',(p/'position-validation.html').read_text()).replace('@@WEBGUIDE@@',(p/'web-guide.html').read_text()).replace('@@WEBTEST@@',(p/'web-validation.html').read_text())
(p/'index.html').write_text(s)
with zipfile.ZipFile(p/'steel-beam-holes-offline-v1.3.zip','w',zipfile.ZIP_DEFLATED) as z:
 z.write(p/'index.html','index.html');z.write(p/'README.md','README.md');z.write(p.parent/'vendor/docx/LICENSE','docx-LICENSE.txt');z.write(p/'verification.json','verification.json');z.write(p/'web-verification.json','web-verification.json');z.write(p/'compact-verification.json','compact-verification.json')

 for name in ['position-verification.json','media-verification.json']:
  if (p/name).exists():z.write(p/name,name)
 for name in ['tutorial.mp4','tutorial-poster.jpg','tutorial.vtt']:
  if (p/'media'/name).exists():z.write(p/'media'/name,'media/'+name)
