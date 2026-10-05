import pathlib
root=pathlib.Path(__file__).parent
s=(root/'template.html').read_text(encoding='utf8').replace('/* ENGINE */',(root/'engine.js').read_text(encoding='utf8'))
s=s.replace('<script id="verification-data" type="application/json">[]</script>','<script id="verification-data" type="application/json">'+(root/'verification.json').read_text(encoding='utf8')+'</script>')
v=(root/'../vendor/docx/docx-9.6.1.iife.js').read_text(encoding='utf8').replace('</script','<\\/script')
d=(root/'../shared/calculation-docx.js').read_text(encoding='utf8').replace('</script','<\\/script')
a=(root/'report-addon.js').read_text(encoding='utf8')
x=s.rsplit('</body>',1);s=x[0]+'<script>'+v+'</script><script>'+d+'</script><script>'+a+'</script></body>'+x[1]
(root/'index.html').write_text(s,encoding='utf8')
print('built',len(s.encode()))
