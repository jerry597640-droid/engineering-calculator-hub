import assert from 'node:assert/strict';
import {unitSystem,displayNumber} from './units.js';
const near=(n,w)=>assert.ok(Math.abs(n-w)<1e-10*Math.max(1,Math.abs(w)),`${n} differs from ${w}`);
for(const force of ['kN','kgf','tf'])for(const length of ['m','cm'])for(const mass of ['kg','t'])for(const deflection of ['mm','cm','m']){
  const u=unitSystem({force,length,mass,deflection});
  for(const dimension of ['m','kN','kN/m','kN·m','kg/m','m⁴','mm','GPa'])near(u.base(dimension,u.show(dimension,-3.157)), -3.157);
}
const kgcm=unitSystem({force:'kgf',length:'cm',mass:'kg',deflection:'m'});
near(kgcm.show('kN',9.80665),1000);near(kgcm.show('kN·m',9.80665),100000);near(kgcm.show('kN/m',9.80665),10);
near(kgcm.show('m⁴',.0008),80000);near(kgcm.show('kg/m',800),8);near(kgcm.base('GPa',2100000),205.93965);
assert.equal(kgcm.label('GPa'),'kgf/cm²');assert.equal(displayNumber(kgcm.show('mm',1)), '0.001');
const ton=unitSystem({force:'tf',length:'m',mass:'t'});near(ton.show('kN',9.80665),1);near(ton.show('kg/m',800),.8);
assert.equal(unitSystem({force:'invalid'}).label('kN'),'kN');console.log('Validated 36 unit configurations and engineering reference values.');
