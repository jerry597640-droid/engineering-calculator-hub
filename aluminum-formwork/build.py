from pathlib import Path
import re
root=Path(__file__).resolve().parent
html=(root/'template.html').read_text()
for marker,name in [('STYLE','style.css'),('ENGINE','engine.js'),('APP','app.js')]:
    text=(root/name).read_text()
    if marker!='STYLE':
        text=re.sub(r'</script',r'<\\/script',text,flags=re.I)
    html=html.replace('/*__'+marker+'__*/',text)
assert '/*__' not in html
(root/'index.html').write_text(html)
(root/'dist').mkdir(exist_ok=True)
(root/'dist'/'index.html').write_text(html)
print('Built self-contained HTML:',len(html.encode()),'bytes')
