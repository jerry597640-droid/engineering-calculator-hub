import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { prepare, rewriteLinks, shouldCopy, suspendOfflineDownloads } from './prepare-migration-assets.mjs';

const manifest={tools:[
  {id:'welding',kind:'hub',source:'welding-design'},
  {id:'steel-beam',kind:'hub',source:'steel-beam'},
  {id:'seismic',kind:'external',source:'seismic-force-calculator'}
]};
test('public tool links map to separately authorized tool paths',()=>{
  const html='<a href="https://jerry597640-droid.github.io/engineering-calculator-hub/">home</a><a href="https://jerry597640-droid.github.io/engineering-calculator-hub/welding-design/">w</a><a href="https://jerry597640-droid.github.io/seismic-force-calculator/?x=1">s</a>';
  const out=rewriteLinks(html,manifest.tools);assert.match(out,/href="\/"/);assert.match(out,/href="\/tools\/welding\/"/);assert.match(out,/href="\/tools\/seismic\/\?x=1"/);
});
test('runtime filter excludes offline bundles, tests, and hidden directories',()=>{
  for(const p of ['offline.html','x-offline.zip','tests/app.js','.git/config','data/verification.json'])assert.equal(shouldCopy(p),false,p);
  for(const p of ['index.html','app.js','media/tutorial.mp4','vendor/license.txt'])assert.equal(shouldCopy(p),true,p);
});
test('declared extra asset destinations pass the runtime filter',async()=>{
  const actual=JSON.parse(await readFile(new URL('./migration-manifest.json',import.meta.url),'utf8'));
  for(const t of actual.tools)for(const a of t.extra_assets||[])assert.equal(shouldCopy(a.dest),true,t.id+': '+a.dest);
});
test('staging disables offline downloads without rewriting embedded scripts or normal exports',()=>{
  const source='<a id="pkg" href="./bundle-offline.zip" download>下載離線套件</a><button id="offline">下載單檔 HTML</button><a href="media/tutorial.mp4" download>下載影片</a><script>const text=\'<a href="./offline.zip">example</a>\';</script>';
  const out=suspendOfflineDownloads(source);
  assert.match(out,/<a id="pkg" aria-disabled="true"/);assert.match(out,/<button id="offline" disabled/);
  assert.match(out,/<a href="media\/tutorial\.mp4" download>下載影片<\/a>/);
  assert.match(out,/<script>const text='<a href="\.\/offline\.zip">example<\/a>';<\/script>/);
});
test('migration copies only candidate assets into bounded tool paths',async()=>{
  const base=resolve(tmpdir()),dir=await mkdtemp(join(base,'ech-migration-'));assert.ok(resolve(dir).startsWith(base+sep));
  const repo=join(dir,'repo'),stage=join(repo,'access-control-staging'),ext=join(repo,'.migration-sources');
  try{
    for(const p of ['welding-design','steel-beam','access-control-staging','.migration-sources/seismic'])await mkdir(join(repo,p),{recursive:true});
    await writeFile(join(repo,'welding-design/index.html'),'<a href="https://jerry597640-droid.github.io/engineering-calculator-hub/steel-beam/">beam</a>');
    await writeFile(join(repo,'welding-design/offline.html'),'must not copy');await mkdir(join(repo,'welding-design/tests'));
    await writeFile(join(repo,'welding-design/tests/secret.js'),'must not copy');
    await writeFile(join(repo,'steel-beam/index.html'),'steel');await writeFile(join(ext,'seismic/index.html'),'seismic');
    const out=await prepare({repoRoot:repo,stageRoot:stage,manifest});assert.equal(out.length,3);
    assert.match(await readFile(join(stage,'assets/tools/welding/index.html'),'utf8'),/href="\/tools\/steel-beam\/"/);
    assert.equal(await stat(join(stage,'assets/tools/welding/offline.html')).catch(()=>null),null);
    await assert.rejects(prepare({repoRoot:repo,stageRoot:stage,manifest:{tools:[{id:'x',kind:'hub',source:'../outside'}]}}),/unsafe path/);
  }finally{await rm(dir,{recursive:true,force:true})}
});
test('shared source assets stay inside the authorized tool and entry references are updated',async()=>{
  const dir=await mkdtemp(join(resolve(tmpdir()),'ech-shared-assets-'));
  const repo=join(dir,'repo'),stage=join(repo,'access-control-staging');
  const m={tools:[{id:'rc-example',kind:'hub',source:'rc-example',
    extra_assets:[{source:'icon.svg',dest:'icon.svg'}],
    replacements:[{file:'index.html',from:'../icon.svg',to:'./icon.svg'}]},
    {id:'concrete',kind:'hub',source:'concrete.html',
      extra_assets:[{source:'concrete-media/video.mp4',dest:'concrete-media/video.mp4'}]}]};
  try{
    await mkdir(join(repo,'rc-example'),{recursive:true});await mkdir(join(repo,'concrete-media'));
    await mkdir(stage,{recursive:true});
    await writeFile(join(repo,'rc-example/index.html'),'<link href="../icon.svg">');
    await writeFile(join(repo,'icon.svg'),'<svg/>');await writeFile(join(repo,'concrete.html'),'<body>ok</body>');
    await writeFile(join(repo,'concrete-media/video.mp4'),Buffer.from([0,1,2,3]));
    await prepare({repoRoot:repo,stageRoot:stage,manifest:m});
    assert.match(await readFile(join(stage,'assets/tools/rc-example/index.html'),'utf8'),/href="\.\/icon\.svg"/);
    assert.equal(await readFile(join(stage,'assets/tools/rc-example/icon.svg'),'utf8'),'<svg/>');
    assert.deepEqual(await readFile(join(stage,'assets/tools/concrete/concrete-media/video.mp4')),Buffer.from([0,1,2,3]));
    const bad={tools:[{id:'bad',kind:'hub',source:'rc-example',extra_assets:[{source:'../secret.txt',dest:'file.txt'}]}]};
    await assert.rejects(prepare({repoRoot:repo,stageRoot:stage,manifest:bad}),/unsafe path/);
  }finally{await rm(dir,{recursive:true,force:true})}
});
