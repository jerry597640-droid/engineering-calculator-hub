// Staging migration preparation. It copies only runtime candidates; each tool
// remains disabled until its links, behavior, and authorization are verified.
import { lstat, mkdir, readFile, readdir, rm, writeFile, copyFile } from 'node:fs/promises';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const allowed=new Set(['.html','.js','.mjs','.css','.json','.svg','.png','.jpg','.jpeg','.webp','.gif','.mp4','.mp3','.vtt','.txt','.pdf','.woff','.woff2','.otf','.webmanifest','.docx']);
const textTypes=new Set(['.html','.js','.mjs','.css','.json','.svg','.vtt','.txt','.webmanifest']);
const pilotIds=new Set(['rebar','rc-slab-auto-design']);
const assertInside=(base,name)=>{const root=resolve(base),target=resolve(root,name),r=relative(root,target);if(!r||r==='..'||r.startsWith('..'+sep)||isAbsolute(r))throw Error('unsafe path');return target};
export function shouldCopy(rel){
  const parts=rel.split(/[\\/]/),name=parts.at(-1),ext=extname(name).toLowerCase();
  if(parts.some(p=>!p||p==='.'||p==='..'||p.startsWith('.')||/^(tests?|__tests__|node_modules|tutorial-source)$/i.test(p)))return false;
  if(/offline/i.test(name)||/(?:^|[-_.])(test|spec|validation|verification|template|build)(?:[-_.]|$)/i.test(name))return false;
  return allowed.has(ext);
}
export function rewriteLinks(text,tools){
  for(const scheme of ['https://','http://']){
    const host=scheme+'jerry597640-droid.github.io/';
    const hub=host+'engineering-calculator-hub/';
    const entries=tools.slice().sort((a,b)=>b.source.length-a.source.length);
    for(const t of entries){
      const old=t.kind==='hub'?hub+t.source:host+t.source;
      const dest='/tools/'+t.id+'/';
      if(t.kind==='hub' && t.source.endsWith('.html'))text=text.split(old).join(dest+'index.html');
      else {
        text=text.split(old+'/').join(dest);
        const escaped=old.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
        text=text.replace(new RegExp(escaped+'(?=[^a-zA-Z0-9_./-]|$)','g'),dest);
      }
    }
    text=text.split(hub).join('/');
  }
  return text.split('驗算與操作說明.html').join('manual-zh.html')
    .split('%E9%A9%97%E7%AE%97%E8%88%87%E6%93%8D%E4%BD%9C%E8%AA%AA%E6%98%8E.html').join('manual-zh.html');
}
export async function prepare({repoRoot,stageRoot,manifest,sourceRoot=join(repoRoot,'.migration-sources'),skipPilots=true}){
  const tools=manifest?.tools;if(!Array.isArray(tools))throw Error('invalid manifest');
  const ids=new Set();for(const t of tools){if(!/^[a-z0-9][a-z0-9-]{0,79}$/.test(t.id)||ids.has(t.id)||!['hub','external'].includes(t.kind)||typeof t.source!=='string')throw Error('invalid tool entry');ids.add(t.id)}
  const outputBase=assertInside(stageRoot,'assets/tools');await mkdir(outputBase,{recursive:true});
  const summary=[];
  async function walk(source,dest,rel,tool){
    const st=await lstat(source);if(st.isSymbolicLink())throw Error('symlinks are not allowed');
    if(st.isDirectory()){
      if(rel && !shouldTraverse(rel))return;
      await mkdir(dest,{recursive:true});
      for(const e of await readdir(source))await walk(join(source,e),join(dest,e),rel?rel+'/'+e:e,tool);
      return;
    }
    if(!st.isFile()||!shouldCopy(rel))return;
    if(st.size>25*1024*1024)throw Error('asset exceeds Cloudflare file limit: '+tool.id+'/'+rel);
    let actualDest=dest;if(tool.id==='footing-design' && rel==='驗算與操作說明.html')actualDest=join(dirname(dest),'manual-zh.html');
    await mkdir(dirname(actualDest),{recursive:true});
    if(textTypes.has(extname(rel).toLowerCase())){
      const original=await readFile(source,'utf8');const changed=rewriteLinks(original,tools);
      await writeFile(actualDest,changed,'utf8');
    }else await copyFile(source,actualDest);
    tool.files++;tool.bytes+=st.size;
  }
  for(const t of tools){
    if(skipPilots&&pilotIds.has(t.id))continue;
    const dest=assertInside(outputBase,t.id),source=t.kind==='hub'?assertInside(repoRoot,t.source):assertInside(sourceRoot,t.id);
    await rm(dest,{recursive:true,force:true});await mkdir(dest,{recursive:true});
    const entry={id:t.id,files:0,bytes:0};const st=await lstat(source);
    if(st.isSymbolicLink())throw Error('symlink source not allowed');
    if(st.isFile()){
      if(!t.source.endsWith('.html'))throw Error('unexpected single-file tool');
      const raw=await readFile(source,'utf8');await writeFile(join(dest,'index.html'),rewriteLinks(raw,tools),'utf8');entry.files=1;entry.bytes=st.size;
    }else await walk(source,dest,'',entry);
    for(const extra of t.extra_assets||[]){
      if(t.kind!=='hub'||typeof extra.source!=='string'||typeof extra.dest!=='string'||!shouldCopy(extra.dest))throw Error('invalid extra asset');
      const from=assertInside(repoRoot,extra.source),to=assertInside(dest,extra.dest),info=await lstat(from);
      if(!info.isFile()||info.isSymbolicLink()||info.size>25*1024*1024)throw Error('invalid extra asset source');
      if(await lstat(to).catch(()=>null))throw Error('extra asset would overwrite a file');
      await mkdir(dirname(to),{recursive:true});
      if(textTypes.has(extname(extra.dest).toLowerCase()))await writeFile(to,rewriteLinks(await readFile(from,'utf8'),tools),'utf8');
      else await copyFile(from,to);
      entry.files++;entry.bytes+=info.size;
    }
    for(const change of t.replacements||[]){
      if(typeof change.file!=='string'||typeof change.from!=='string'||!change.from||
         typeof change.to!=='string'||!textTypes.has(extname(change.file).toLowerCase()))throw Error('invalid replacement');
      const target=assertInside(dest,change.file),raw=await readFile(target,'utf8');
      if(raw.split(change.from).length!==2)throw Error('replacement must match exactly once: '+t.id);
      await writeFile(target,raw.replace(change.from,change.to),'utf8');
    }
    const index=await lstat(join(dest,'index.html')).catch(()=>null);if(!index?.isFile())throw Error('missing tool entry: '+t.id);
    summary.push(entry);
  }
  return summary;
}
function shouldTraverse(rel){return !rel.split(/[\\/]/).some(p=>!p||p==='.'||p==='..'||p.startsWith('.')||/^(tests?|__tests__|node_modules|tutorial-source)$/i.test(p))}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const stageRoot=dirname(fileURLToPath(import.meta.url));
  const repoRoot=process.env.ECH_SOURCE_ROOT?resolve(process.env.ECH_SOURCE_ROOT):resolve(stageRoot,'..');
  const sourceRoot=process.env.ECH_EXTERNAL_ROOT?resolve(process.env.ECH_EXTERNAL_ROOT):join(repoRoot,'.migration-sources');
  const manifest=JSON.parse(await readFile(join(stageRoot,'migration-manifest.json'),'utf8'));
  const result=await prepare({repoRoot,stageRoot,manifest,sourceRoot});
  console.log(JSON.stringify({tools:result.length,files:result.reduce((n,x)=>n+x.files,0),bytes:result.reduce((n,x)=>n+x.bytes,0),result}));
}
