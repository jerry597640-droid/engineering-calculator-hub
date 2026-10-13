from pathlib import Path
import json,re,hashlib

root = Path(__file__).resolve().parent
text = (root / 'shell.html').read_text(encoding='utf-8')
for marker, filename in [('STYLES','styles.css'),('CORE','beam-core.js'),('SECTION_LIBRARY','section-library.js'),('PARAMETERS','parameters.js'),('APP','app.js')]:
    source = (root / filename).read_text(encoding='utf-8')
    if filename.endswith('.js') and re.search(r'</script', source, re.I):
        raise SystemExit(f'Unsafe closing script tag in {filename}')
    text = text.replace(f'<!--{marker}-->', source)
section_bytes = (root.parent / 'steel-sections' / 'section-data.json').read_bytes()
section_packet = {'meta': {'version': '1.2.1', 'sha256': hashlib.sha256(section_bytes).hexdigest(), 'sourcePath': 'steel-sections/section-data.json'}, 'data': json.loads(section_bytes)}
section_json = json.dumps(section_packet,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')
text = text.replace('<!--SECTIONS-->', section_json)
media_data = json.loads((root / 'tutorial-media.json').read_text(encoding='utf-8')) if (root / 'tutorial-media.json').exists() else {"video":""}
media = json.dumps(media_data,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')
text = text.replace('<!--TUTORIAL-->', media)
(root / 'index.html').write_text(text, encoding='utf-8')
print(f'Built standalone index.html ({len(text.encode("utf-8")):,} bytes)')
