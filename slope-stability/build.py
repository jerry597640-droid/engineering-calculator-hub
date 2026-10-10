from pathlib import Path
root=Path(__file__).parent
s=(root/'template.html').read_text()
for token,name in [('STYLE','style.css'),('ENGINE','engine.js'),('DOCX','docx-report.js'),('APP','app.js')]:
    s=s.replace('@'+token,(root/name).read_text())
(root/'index.html').write_text(s)
print(f'Built {len(s.encode())} bytes')
