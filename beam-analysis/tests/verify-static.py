from html.parser import HTMLParser
from pathlib import Path
from collections import Counter
import base64,hashlib,json,re,subprocess
root=Path(__file__).resolve().parent.parent
html=(root/'index.html').read_text(encoding='utf-8')
class Parser(HTMLParser):
    def __init__(self):super().__init__();self.ids=[];self.resources=[];self.viewport=False;self.links=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if 'id' in a:self.ids.append(a['id'])
        if tag=='meta' and a.get('name')=='viewport':self.viewport='width=device-width' in a.get('content','')
        if (tag=='script' and 'src'in a)or(tag=='link' and a.get('rel')=='stylesheet')or(tag in ['img','iframe','video','audio'] and 'src'in a):self.resources.append((tag,a))
        if tag=='a':self.links.append(a.get('href',''))
p=Parser();p.feed(html)
assert p.viewport
assert not [k for k,n in Counter(p.ids).items() if n>1]
assert not p.resources, 'Offline build must contain no resource dependencies'
assert not re.search(r'<!--(?:CORE|PARAMETERS|APP|STYLES|TUTORIAL)-->',html)
for script in ['app.js','beam-core.js','parameters.js']:subprocess.run(['node','--check',str(root/script)],check=True)
media=json.loads(re.search(r'<script id="tutorial-media" type="application/json">(.*?)</script>',html,re.S).group(1))
video=base64.b64decode(media['video'],validate=True)
assert video[4:8]==b'ftyp' and len(video)==media['bytes']
assert hashlib.sha256(video).hexdigest()==media['sha256']
assert media['voice']=='zh-TW-HsiaoChenNeural' and len(media['chapters'])==6
assert media['captions'].startswith('WEBVTT') and 0<media['duration']<600
assert media['width']==1280 and media['height']==720 and media['codec']=='H.264/AAC'
assert all(0<=c['start']<media['duration'] and c['lines'] for c in media['chapters'])
source=(root/'app.js').read_text()
declared=set(p.ids)|set(re.findall(r'\bid="([A-Za-z][A-Za-z0-9_-]*)"',source))
references=set(re.findall(r"\$\('([A-Za-z][A-Za-z0-9_-]*)'\)",source))
assert not references-declared, references-declared
for x in ['run-analysis','save-project','import-project','offline-download','force-unit','beam-diagram','plot-V','plot-M','plot-y','help-view','calculation-view']:assert x in declared
assert '@media(max-width:720px)' in html
assert 'min-height:44px' in html
assert 'fontScale' in source and 'non-scaling-stroke' in source
assert 'touch-action:none' in html
assert not re.search(r'\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(',source)
assert 'https://jerry597640-droid.github.io/engineering-calculator-hub/' in p.links
before=(root/'index.html').read_bytes()
subprocess.run(['python',str(root/'build.py')],check=True)
assert before==(root/'index.html').read_bytes(), 'Build must be reproducible'
result={'status':'passed','bytes':len(before),'sha256':hashlib.sha256(before).hexdigest(),'external_runtime_resources':0,'unique_element_ids':len(p.ids),'responsive_css':True,'touch_controls':True,'real_browser_layout_verified':False}
(root/'tests'/'static-validation.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result,indent=2))
