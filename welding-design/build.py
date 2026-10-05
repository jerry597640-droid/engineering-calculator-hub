from pathlib import Path
p=Path(__file__).resolve().parent
html=(p/'template.html').read_text(encoding='utf-8')
sources=['engine.js','units.js','legacy-data.js','app.js']
for i,f in enumerate(sources):
 html=html.replace('__SOURCE_'+str(i)+'__',(p/f).read_text(encoding='utf-8'))
html=html.replace('__DOCX__',(p.parent/'vendor/docx/docx-9.6.1.iife.js').read_text(encoding='utf-8')).replace('__REPORT__',(p.parent/'shared/calculation-docx.js').read_text(encoding='utf-8')).replace('__LEGACY_ENGINE__',(p/'legacy-engine.js').read_text(encoding='utf-8')).replace('__TRACE__',(p/'trace.js').read_text(encoding='utf-8'))
(p/'index.html').write_text(html,encoding='utf-8')
