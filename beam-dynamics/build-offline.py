"""Build a self-contained BeamLab HTML using native browser import maps (no packages)."""
import argparse
import base64
import json
from pathlib import Path
import re

root = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
modules = {path.name: path.read_text(encoding='utf-8') for path in sorted(root.glob('*.js'))}
imports = {}
pattern = re.compile(r'''(?P<prefix>\bfrom\s+|\bimport\s*\(\s*)(?P<quote>['"])(?P<path>\./[^'"]+)(?P=quote)''')

def rewrite(match):
    name = match['path'][2:].split('?', 1)[0]
    if name not in modules:
        raise ValueError(f'Unknown offline module: {name}')
    return match['prefix'] + match['quote'] + 'beamlab/' + name + match['quote']

for name, source in modules.items():
    encoded = base64.b64encode(pattern.sub(rewrite, source).encode()).decode()
    imports['beamlab/' + name] = 'data:text/javascript;base64,' + encoded

html = (root / 'index.html').read_text(encoding='utf-8')
script, count = re.subn(r'<script type="module" src="\./app\.js[^\"]*"></script>',
    '<script type="importmap">' + json.dumps({'imports': imports}, ensure_ascii=False) +
    '</script><script type="module">import "beamlab/app.js";</script>', html)
if count != 1:
    raise ValueError('Expected exactly one app entry point')
html = script.replace('<link rel="manifest" href="./manifest.webmanifest">', '')
for name, mime in [('icon.svg', 'image/svg+xml'), ('icon-180.png', 'image/png')]:
    data = base64.b64encode((root / name).read_bytes()).decode()
    html = html.replace('href="./' + name + '"', 'href="data:' + mime + ';base64,' + data + '"')
html = html.replace('<title>梁析 BeamLab｜多跨梁與移動載重</title>', '<title>梁析 BeamLab v1.13.0｜離線版</title>')
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(html, encoding='utf-8')
print(f'Built {args.output.name}: {len(modules)} embedded modules, {args.output.stat().st_size} bytes')
