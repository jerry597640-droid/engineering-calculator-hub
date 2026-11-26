// Fixed arithmetic regression for the migrated pilot; it is not a design-code approval.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html=await readFile(new URL('./assets/tools/rebar/index.html',import.meta.url),'utf8');
const start=html.indexOf('const bars=['),end=html.indexOf('if(typeof module!==',start);
assert.ok(start>=0 && end>start,'pilot calculation engine not found');
const box={module:{exports:{}}};
vm.runInNewContext(html.slice(start,end)+'\nmodule.exports={calculate};',box,{timeout:1000});
const calculate=box.module.exports.calculate;
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} differs from ${expected}`);
const input={mode:'forward',fyR:2800,fyW:5000,thickness:15,minMode:'auto',rho:0.0018,
  rX:0,rY:0,rsX:100,rsY:150,dX:9,dY:9,wsX:150,wsY:200};

test('pilot preserves a fixed rebar-to-wire-mesh arithmetic case',()=>{
  const r=calculate(input);near(r.min,2.268);near(r.axes[0].source,7.133);
  near(r.axes[0].required,3.99448);near(r.axes[0].provided,4.241150082346221);
  near(r.axes[1].required,2.662986666666667);near(r.axes[1].provided,3.1808625617596658);
  assert.equal(r.ok,true);
});
test('pilot rejects insufficient X-direction wire area',()=>{
  const r=calculate({...input,wsX:300});assert.equal(r.axes[0].ok,false);assert.equal(r.axes[1].ok,true);assert.equal(r.ok,false);
});
