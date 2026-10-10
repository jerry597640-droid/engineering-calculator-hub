from pathlib import Path
import argparse
p=Path(__file__).parent
args=argparse.ArgumentParser();args.add_argument('--with-video',action='store_true');args.add_argument('--output',default='index.html');opts=args.parse_args()
html=(p/'interface.html').read_text(encoding='utf-8')
shared=p.parent
vendor=shared/'vendor'/'docx'/'docx-9.6.1.iife.js'
if not vendor.exists():vendor=p/'vendor'/'docx'/'docx-9.6.1.iife.js'
core=shared/'shared'/'calculation-docx.js'
if not core.exists():core=p/'shared'/'calculation-docx.js'
docx=vendor.read_text(encoding='utf-8')+'\n'+core.read_text(encoding='utf-8')
for marker,name in [('ENGINE','engine.js'),('UI','ui.js'),('EXTENSIONS','extensions.js')]:html=html.replace('/* '+marker+'_PLACEHOLDER */',(p/name).read_text(encoding='utf-8').replace('</script','<\\/script'))
html=html.replace('/* DOCX_PLACEHOLDER */',docx.replace('</script','<\\/script'))
html=html.replace('/* TUTORIAL_PLACEHOLDER */',(p/'media'/'tutorial-data.js').read_text(encoding='utf-8') if opts.with_video else '// Video is loaded on demand; offline export embeds it.')
(p/opts.output).write_text(html,encoding='utf-8')
print('Built',opts.output)
