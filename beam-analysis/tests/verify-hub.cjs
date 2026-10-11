/* Verify the real hub migration without changing users' saved tools. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
const seed=JSON.parse(html.match(/<script id="seed-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const addon=seed.find(t=>t.id==='beam-analysis');
assert.equal(addon.url,'https://jerry597640-droid.github.io/engineering-calculator-hub/beam-analysis/');
assert.equal(seed.filter(t=>t.id==='beam-analysis').length,1);
for(const script of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g))if(!script[1].includes('application/json'))new vm.Script(script[2]);
const code=html.match(/\/\/ beam-analysis migration begin([\s\S]*?)\/\/ beam-analysis migration end/)[1];
const custom={id:'custom-one',name:'我的自訂名稱',url:'https://example.test/tool',favorite:true};
const saved=new Map();
function run(initial,blocked=false){const ctx={SEED:seed,tools:structuredClone(initial),KEY:'test-key',startupWarning:'',structuredClone,localStorage:{getItem(k){if(blocked)throw Error('blocked');return saved.get(k)||null;},setItem(k,v){if(blocked)throw Error('blocked');saved.set(k,v);}}};vm.runInNewContext(code,ctx);return ctx;}
let out=run([custom]);assert.deepEqual(out.tools[0],custom);assert.equal(out.tools[1].id,'beam-analysis');assert.equal(JSON.parse(saved.get('test-key')).tools.length,2);
out=run(out.tools);assert.equal(out.tools.length,2);
out=run([custom]);assert.equal(out.tools.length,1,'intentional removal after migration is preserved');
saved.clear();out=run([custom,{...addon,url:addon.url.slice(0,-1),name:'已修改的名稱',favorite:true}]);assert.equal(out.tools.length,2);assert.equal(out.tools[1].name,'已修改的名稱');assert.equal(out.tools[1].favorite,true);
out=run([custom],true);assert.equal(out.tools.length,2);assert.match(out.startupWarning,/保存/);assert.deepEqual(out.tools[0],custom);
saved.clear();out=run(seed);assert.equal(out.tools.length,seed.length);
console.log('PASS: hub seed, script syntax, migration, custom names/favorites, duplicate URLs, intentional removal and blocked storage.');
