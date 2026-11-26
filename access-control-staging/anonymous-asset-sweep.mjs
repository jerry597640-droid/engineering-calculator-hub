// Test-only sweep: no credentials are sent and no permissions are changed.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=dirname(fileURLToPath(import.meta.url));
const manifest=JSON.parse(await readFile(join(root,'migration-manifest.json'),'utf8'));
const site='https://engineering-tools-access-staging.jerry597640.workers.dev';
async function sampleFile(directory,prefix=''){
  const entries=await readdir(directory,{withFileTypes:true});
  for(const e of entries){
    const rel=prefix?prefix+'/'+e.name:e.name;
    if(!/^[a-zA-Z0-9._/-]+$/.test(rel))continue;
    if(e.isDirectory()){
      const found=await sampleFile(join(directory,e.name),rel);
      if(found)return found;
    }else if(e.isFile() && /\.(?:js|css|svg|png|jpg|mp4)$/i.test(e.name))return rel;
  }
  return null;
}
const paths=[];
for(const tool of manifest.tools){
  if(!/^[a-z0-9][a-z0-9-]{0,79}$/.test(tool.id))throw Error('invalid tool ID');
  paths.push('/tools/'+tool.id+'/');
  const sample=await sampleFile(join(root,'assets','tools',tool.id));
  if(sample)paths.push('/tools/'+tool.id+'/'+sample);
}
for(let i=0;i<paths.length;i+=8){
  await Promise.all(paths.slice(i,i+8).map(async path=>{
    const r=await fetch(site+path,{redirect:'manual',signal:AbortSignal.timeout(20000)});
    assert.equal(r.status,401,'anonymous resource was not denied: '+path);
    assert.match(r.headers.get('cache-control')||'',/no-store/i);
  }));
}
for(const path of ['/assets/tools/rebar/index.html','/assets/tools/rc-slab-auto-design/index.html']){
  const r=await fetch(site+path,{redirect:'manual',signal:AbortSignal.timeout(20000)});
  assert.equal(r.status,404,'asset binding exposed directly: '+path);
}
console.log('PASS: anonymous requests denied for '+manifest.tools.length+' tools and '+paths.length+' entry/asset paths.');
