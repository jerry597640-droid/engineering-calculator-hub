const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const deps='C:/Users/002873/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';const JSZip=require(deps+'/jszip');
const dir=__dirname,hash=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 const oldPath=path.join(dir,'qa-original-offline-kit.zip');
 const old=await JSZip.loadAsync(fs.readFileSync(fs.existsSync(oldPath)?oldPath:path.join(dir,'offline-kit-v1.1.zip'))),zip=new JSZip();
 // Preserve the existing numeric example PDF; replace all program/document sources.
 for(const [name,item]of Object.entries(old.files))if(!item.dir&&name.endsWith('.pdf')&&!name.includes('詳細'))zip.file(name,await item.async('nodebuffer'));
 const files=['README.md','engine.cjs','index.html','verify.cjs','validation-results.json','驗算與操作說明.html','ui.js','template.html','build.cjs','qa-baseline-engine.cjs','verify-trace.cjs','trace-validation.json','browser-validation.json'];
 for(const p of files)zip.file(p,fs.readFileSync(path.join(dir,p)));
 zip.file('ui-validation.json',fs.readFileSync(path.join(dir,'browser-validation.json')));
 for(const p of ['shared/calculation-docx.js','vendor/docx/docx-9.6.1.iife.js','vendor/docx/LICENSE'])zip.file(p,fs.readFileSync(path.join(dir,'..',p)));
 zip.file('矩形基腳_詳細計算範例.pdf',fs.readFileSync(path.join(dir,'qa-print.pdf')));
 zip.file('置中基腳_詳細計算書.docx',fs.readFileSync(path.join(dir,'qa-desktop.docx')));
 const manifest={version:'1.2',baseline:'f347f55ded4dc35aad3647b1c898e7234c646644',built:'2026-10-05',originalChecks:528,traceComparisons:3784,formulaChanged:false,files:[]};
 for(const[name,item]of Object.entries(zip.files)){if(!item.dir){const bytes=await item.async('nodebuffer');manifest.files.push({path:name,bytes:bytes.length,sha256:hash(bytes)})}}
 zip.file('release-manifest.json',JSON.stringify(manifest,null,2));fs.writeFileSync(path.join(dir,'release-manifest.json'),JSON.stringify(manifest,null,2));
 const bytes=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:9}});fs.writeFileSync(path.join(dir,'offline-kit-v1.1.zip'),bytes);
 const verify=await JSZip.loadAsync(bytes);for(const f of manifest.files){const actual=await verify.file(f.path).async('nodebuffer');if(hash(actual)!==f.sha256)throw Error('ZIP mismatch '+f.path)}
 const standalone=path.join(dir,'qa-extracted');fs.mkdirSync(standalone,{recursive:true});for(const[name,item]of Object.entries(verify.files)){if(item.dir)continue;const target=path.join(standalone,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,await item.async('nodebuffer'))}
 console.log({zipBytes:bytes.length,version:manifest.version,files:manifest.files.length,preservedOriginalPdf:!!verify.file('置中基腳_計算範例.pdf'),allSha256Verified:true});
})().catch(e=>{console.error(e);process.exitCode=1});
