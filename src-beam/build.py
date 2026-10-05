import json,pathlib
root=pathlib.Path(__file__).parent
s=(root/'template.html').read_text().replace('/* ENGINE */',(root/'engine.js').read_text())
s=s.replace('<script id="verification-data" type="application/json">[]</script>','<script id="verification-data" type="application/json">'+(root/'verification.json').read_text()+'</script>')
(root/'index.html').write_text(s)
