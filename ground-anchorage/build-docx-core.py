from pathlib import Path
p=Path(__file__).parent
f=p/'index.html';s=f.read_text(encoding='utf8')
start=s.index('/* Offline editable Word reports. Requires vendor/docx/docx-9.6.1.iife.js (MIT). */')
end=s.index("})(typeof globalThis!=='undefined'?globalThis:window);",start)+len("})(typeof globalThis!=='undefined'?globalThis:window);")
core=(p.parent/'shared/calculation-docx.js').read_text(encoding='utf8').rstrip()
f.write_text(s[:start]+core+s[end:],encoding='utf8')
print('Rebuilt DOCX core only; calculation and diagram bytes preserved')
