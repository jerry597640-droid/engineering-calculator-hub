from pathlib import Path
import re
folder=Path(__file__).parent
engine=(folder/'engine.cjs').read_text(encoding='utf-8')
if 'const trace=[]' not in engine:
    engine=engine.replace("const loadTf=p.load*(p.loadUnit==='kgf'?0.001:p.loadUnit==='kN'?1/9.80665:1);","const loadFactor=p.loadUnit==='kgf'?0.001:p.loadUnit==='kN'?1/9.80665:1;const loadTf=p.load*loadFactor;")
    engine=engine.replace('if(p.fhwa&&ultimate!==null)steel=Math.min(steel,0.6*ultimate);','const steelRaw=steel,steelLimit=ultimate!==null?0.6*ultimate:null;\n if(p.fhwa&&ultimate!==null)steel=Math.min(steel,steelLimit);')
    engine=engine.replace('const checks=[];','const spacingMin=Math.max(4*p.D,150);const lockLoad=p.lockFactor*T,testLoad=p.testFactor*T,lockLimit=ultimate!==null?0.7*ultimate:null,testLimit=ultimate!==null?0.8*ultimate:null;\n const checks=[];')
    engine=engine.replace('p.spacing>=Math.max(4*p.D,150)','p.spacing>=spacingMin').replace('p.lockFactor*T<=0.7*ultimate+1e-10','lockLoad<=lockLimit+1e-10').replace('p.testFactor*T<=0.8*ultimate+1e-10','testLoad<=testLimit+1e-10')
    position=engine.index(' return {errors:[],T,H,V')
    values=""" const checkValues={steel:`${T} ≤ ${steel}+1e-10 tf`,ground:`${T} ≤ ${caps[1]}+1e-10 tf`,grout:`${T} ≤ ${caps[2]}+1e-10 tf`,inclination:`${p.theta} > 10°`,spacing:`${p.spacing} ≥ ${spacingMin} cm`,free:`${p.Lf}+1e-9 ≥ ${requiredLf} cm`,length:`${p.La} ≥ 300 cm`,factors:`[${p.fsSteel},${p.fsGround},${p.fsBond}] ≥ [${floor}]`,lock:`${lockLoad} ≤ ${lockLimit}+1e-10 tf`,test:`${testLoad} ≤ ${testLimit}+1e-10 tf`};
"""
    engine=engine[:position]+values+(folder/'trace-block.txt').read_text(encoding='utf-8')+'\n'+engine[position:]
    engine=engine.replace('return {errors:[],T,H,V','return {errors:[],trace,inputSnapshot:JSON.stringify(p),T,H,V')
    (folder/'engine.cjs').write_text(engine,encoding='utf-8')
html=(folder/'index.html').read_text(encoding='utf-8')
if '<!-- editable-docx -->' not in html:
    html=re.sub(r'<script>\(function\(root\)\{.*?</script>',lambda m:'<script>'+engine+'</script>',html,count=1,flags=re.S)
    vendor=(folder.parent/'vendor/docx/docx-9.6.1.iife.js').read_text(encoding='utf-8').replace('</script','<\\/script')
    exporter=(folder.parent/'shared/calculation-docx.js').read_text(encoding='utf-8')
    html=html.replace('</script><script>const FIELD_META','</script><!-- editable-docx --><script>'+vendor+'</script><script>'+exporter+'</script><script>const FIELD_META',1)
    html=html.replace('<button id="download-report">','<button id="download-docx">匯出可編輯 Word</button><button id="download-report">',1)
    html=html.replace("$('print').disabled=true;","$('download-docx').disabled=true;$('print').disabled=true;",1).replace("$('print').disabled=false;","$('download-docx').disabled=false;$('print').disabled=false;",1)
    html=html.replace("function buildReport(p,r){$('view-report').innerHTML=reportHTML(p,r)}","function buildReport(p,r){$('view-report').innerHTML=reportHTML(p,r)+traceHTML(r)}")
    html=html.replace("function download(name,content,type){",(folder/'report-ui.js').read_text(encoding='utf-8')+'\nfunction download(name,content,type){',1)
    html=html.replace("$('download-report').onclick=", "$('download-docx').onclick=async()=>{try{update();if(result.errors.length||result.inputSnapshot!==JSON.stringify(read()))throw Error('請重新完成有效計算');const report=makeWordReport(current,result);await CalculationDocx.download(report,'地錨_詳細計算.docx');toast('已匯出可編輯 Word')}catch(e){toast(e.message)}};\n$('download-report').onclick=",1)
    html=html.replace("reportHTML(current,result)+'</main>","reportHTML(current,result)+traceHTML(result)+'</main>")
    html=html.replace('</style></head>','.trace-step{padding:12px 0;border-bottom:1px solid #d9e2ec}.trace-step p{overflow-wrap:anywhere;line-height:1.7;margin:6px 0}.trace-heading{margin-top:24px}</style></head>',1)
    (folder/'index.html').write_text(html,encoding='utf-8')
print('assembled inline engine, trace and offline DOCX')
