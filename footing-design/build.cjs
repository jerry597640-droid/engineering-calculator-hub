const fs=require('node:fs'),path=require('node:path');const dir=__dirname;
const text=p=>fs.readFileSync(path.join(dir,p),'utf8');
const script=s=>'<script>'+s.replace(/<\/script/gi,'<\\/script')+'</script>';
const asset=p=>text(fs.existsSync(path.join(dir,p))?p:'../'+p);
const out=text('template.html').replace('<!-- ENGINE -->',script(text('engine.cjs'))).replace('<!-- DOCX -->',script(asset('vendor/docx/docx-9.6.1.iife.js'))+'\n'+script(asset('shared/calculation-docx.js'))).replace('<!-- UI -->',script(text('ui.js')));
fs.writeFileSync(path.join(dir,'index.html'),out);console.log('Built self-contained index.html '+Buffer.byteLength(out)+' bytes');
