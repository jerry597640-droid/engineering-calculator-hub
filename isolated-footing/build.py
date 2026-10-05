from pathlib import Path
p=Path(__file__).parent
html=(p/'interface.html').read_text()
html=html.replace('/* ENGINE_PLACEHOLDER */',(p/'engine.js').read_text()).replace('/* UI_PLACEHOLDER */',(p/'ui.js').read_text())
(p/'index.html').write_text(html)
