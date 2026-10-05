from pathlib import Path
p=Path(__file__).parent
s=(p/'index.html').read_text()
a=s.index('/* ENGINE_START */');b=s.index('/* ENGINE_END */')+len('/* ENGINE_END */')
s=s[:a]+'/* ENGINE_START */\n'+(p/'engine.js').read_text()+'\n/* ENGINE_END */'+s[b:]
a=s.index('/* UI_START */');b=s.index('/* UI_END */')+len('/* UI_END */')
s=s[:a]+'/* UI_START */\n'+(p/'ui.js').read_text()+'\n/* UI_END */'+s[b:]
(p/'index.html').write_text(s)
