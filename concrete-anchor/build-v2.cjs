const fs=require('node:fs'),path=require('node:path'),dir=__dirname;
let html=fs.readFileSync(path.join(dir,'template.html'),'utf8');
for(const [key,file] of [['TYPE_DIAGRAM_STYLE','type-diagrams.css'],['TYPE_DIAGRAMS','type-diagrams.js']])html=html.replace('/* '+key+' */',()=>fs.readFileSync(path.join(dir,file),'utf8'));
let scriptIndex=0;html=html.replace(/<script[^>]*>[\s\S]*?<\/script>/g,m=>{const i=scriptIndex++;return i===2?'<script>'+fs.readFileSync(path.join(dir,'engine.js'),'utf8')+'</script>':i===3?'<script>'+fs.readFileSync(path.join(dir,'ui.js'),'utf8')+'</script>':m;});
html=html.replace('</ol><h3>驗證材料','<li>後置耐震Vsa缺值阻止完成：通過。</li><li>後置耐震採試驗Vsa與灌漿折減：通過。</li><li>非耐震回歸及負值拒絕：通過。</li></ol><h3>驗證材料');
html=html.replace('25項通過','28項通過').replace('核對日期：2026-10-05','核對日期：2026-10-09').replace('上述檢查','上述檢查及後置耐震Vsa缺值／試驗值／非耐震回歸檢查');
html=html.replace('</head>',`<style>${fs.readFileSync(path.join(dir,'upgrade.css'),'utf8')}</style></head>`);
html=html.replace('</body>',['field-data.js','tutorial-meta.js','upgrade.js'].map(f=>'<script>'+fs.readFileSync(path.join(dir,f),'utf8')+'</script>').join('')+'</body>');
fs.writeFileSync(path.join(dir,'index.html'),html);
const media=path.join(dir,'tutorial');
let offline=html;
if(fs.existsSync(path.join(media,'anchor-tutorial.mp4'))){
 const data=fs.readFileSync(path.join(media,'anchor-tutorial.mp4')),parts=[];
 for(let i=0;i<data.length;i+=262144)parts.push('window.AnchorTutorialChunks.push('+JSON.stringify(data.subarray(i,i+262144).toString('base64'))+');');
 offline=html.replace('</head>','<script data-offline-media>window.AnchorTutorialOffline=true;window.AnchorTutorialChunks=[];'+parts.join('\n')+'</script></head>');
}
fs.mkdirSync(path.join(dir,'../../../deliverables'),{recursive:true});
fs.writeFileSync(path.join(dir,'../../../deliverables/Concrete_Anchor_Offline_v2.html'),offline);
console.log(JSON.stringify({online:Buffer.byteLength(html),offline:Buffer.byteLength(offline)}));
