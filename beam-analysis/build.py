from pathlib import Path
import json,re

root = Path(__file__).resolve().parent
text = (root / 'shell.html').read_text(encoding='utf-8')
for marker, filename in [('STYLES','styles.css'),('CORE','beam-core.js'),('PARAMETERS','parameters.js'),('APP','app.js')]:
    source = (root / filename).read_text(encoding='utf-8')
    if filename.endswith('.js') and re.search(r'</script', source, re.I):
        raise SystemExit(f'Unsafe closing script tag in {filename}')
    text = text.replace(f'<!--{marker}-->', source)
media_data = json.loads((root / 'tutorial-media.json').read_text(encoding='utf-8')) if (root / 'tutorial-media.json').exists() else {"video":""}
media = json.dumps(media_data,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')
text = text.replace('<!--TUTORIAL-->', media)
(root / 'index.html').write_text(text, encoding='utf-8')
print(f'Built standalone index.html ({len(text.encode("utf-8")):,} bytes)')
