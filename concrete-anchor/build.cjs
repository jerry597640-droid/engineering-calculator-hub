const fs=require('node:fs'),path=require('node:path');
const here=__dirname;
let html=fs.readFileSync(path.join(here,'template.html'),'utf8');
for(const [key,file] of [['TYPE_DIAGRAM_STYLE','type-diagrams.css'],['TYPE_DIAGRAMS','type-diagrams.js']]){
 const marker='/* '+key+' */';if(!html.includes(marker))throw Error('Missing template marker: '+key);
 html=html.replace(marker,()=>fs.readFileSync(path.join(here,file),'utf8'));
}
fs.writeFileSync(path.join(here,'index.html'),html);
fs.mkdirSync(path.join(here,'../deliverables'),{recursive:true});
fs.writeFileSync(path.join(here,'../deliverables/Concrete_Anchor_Offline_v1.html'),html);
console.log('Built standalone HTML: '+Buffer.byteLength(html)+' bytes.');
