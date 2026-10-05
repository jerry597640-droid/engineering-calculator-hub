'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');const {convert,parseValue}=require('./engine');const data=JSON.parse(fs.readFileSync(__dirname+'/catalog.json'));
const find=(c,u)=>{const d=data.find(x=>x.id===c);assert(d,c);const unit=d.units.find(x=>x.id===u);assert(unit,c+' '+u);return unit;};
// Independently recorded standard examples and published NIST values (not generated from catalog).
const fixtures=[
 ['length',1,'in','cm',2.54],['length',1,'ft','m',.3048],['length',1,'nmi','m',1852],['length',1,'台尺','cm',30.303030303030303],
 ['area',1,'ft²','m²',.09290304],['area',30,'坪','m²',99.17355371900826],['area',1,'acre','m²',4046.8564224],
 ['volume',1,'gal (US liquid)','L',3.785411784],['volume',1,'gal (UK)','L',4.54609],['volume',1,'bbl (oil，42 US gal)','L',158.987294928],
 ['weightDensity',2.4,'tf/m³','kN/m³',23.53596],['mass',1,'kg','g',1000],['mass',1,'kg','t',.001],['mass',1,'lb','kg',.45359237],['mass',1,'hg','kg',.1],['mass',1,'ct','kg',.0002],
 ['force',1,'kgf','N',9.80665],['force',1,'tf','kN',9.80665],['force',1,'lbf','N',4.4482216152605],
 ['pressure',280,'kgf/cm²','MPa',27.45862],['pressure',1,'psi','Pa',6894.757293168361],['pressure',1,'tf/m²','kPa',9.80665],['pressure',1,'N/mm²','MPa',1],['pressure',1,'tf/mm²','MPa',9806.65],
 ['moment',1,'tf·m','kgf·cm',100000],['moment',1,'lbf·ft','N·m',1.3558179483314004],
 ['density',1,'g/cm³','kg/m³',1000],['density',1,'lb/ft³','kg/m³',16.01846337396014],
 ['lineLoad',1,'kgf/cm','N/m',980.665],['lineLoad',1,'tf/m','kgf/cm',10],
 ['power',1,'hp (mechanical)','W',745.6998715822702],['power',1,'PS','W',735.49875],['power',1,'RT (US refrigeration)','kW',3.5168528420667],
 ['energy',1,'kWh','MJ',3.6],['energy',1,'cal (IT)','J',4.1868],['energy',1,'cal (th)','J',4.184],['energy',1,'L·atm','J',101.325],['energy',1,'gf·cm','J',.0000980665],
 ['specificHeat',1,'Btu (IT)/(lb·°F)','J/(kg·K)',4186.8],['specificHeat',1,'kJ/(kg·K)','J/(kg·K)',1000],
 ['angle',1,'°','″',3600],['angle',180,'°','rad',Math.PI],
 ['speed',1,'m/s','ft/min',196.8503937007874],['speed',1,'m/s','km/h',3.6],
 ['time',1,'h','min',60],['time',1,'month (30 d)','d',30],
 ['heatCapacity',1,'kJ/K','J/K',1000],['heatCapacity',1,'Btu (IT)/°F','J/K',1899.100534716],
 ['heatFlux',1,'Btu (IT)/(h·ft²)','W/m²',3.154590745063048],['heatTransfer',1,'Btu (IT)/(h·ft²·°F)','W/(m²·K)',5.678263341113487],
 ['radiation',1,'W/(m²·K⁴)','W/(cm²·K⁴)',.0001],['conductivity',1,'Btu (IT)·in/(h·ft²·°F)','W/(m·K)',.144227888864874],
 ['volumeFlow',1,'m³/s','L/min',60000],['volumeFlow',1,'bbl (oil)/s','L/s',158.987294928],
 ['massFlow',1,'kg/s','kg/h',3600],['specificVolume',1,'m³/kg','L/kg',1000],
 ['massInertia',1,'kg·m²','g·cm²',10000000],['massInertia',1,'kg·m²','g·m²',1000],['massInertia',1,'kg·m²','lb·m²',2.2046226218487757],
 ['temperature',0,'°C','°F',32],['temperature',100,'°C','°F',212],['temperature',-40,'°C','°F',-40],['temperature',0,'°C','K',273.15],['temperature',-459.67,'°F','K',0],
 ['temperatureDelta',10,'Δ°C','Δ°F',18]
];
function close(a,b,msg){assert(Math.abs(a-b)<=Math.max(1,Math.abs(b))*2e-12,`${msg}: got ${a}, expected ${b}`)}
for(const [c,x,f,t,y] of fixtures)close(convert(x,find(c,f),find(c,t),c==='temperature'),y,`${c} ${x}${f} -> ${t}`);
let roundTrips=0;
for(const c of data){assert(c.units.length);assert.equal(new Set(c.units.map(u=>u.id)).size,c.units.length);for(const a of c.units){assert(a.factor>0&&Number.isFinite(a.factor));for(const b of c.units){const x=c.id==='temperature'?300:1.23456789;const y=convert(x,a,b,c.id==='temperature');close(convert(y,b,a,c.id==='temperature'),x,`roundtrip ${c.id} ${a.id} ${b.id}`);roundTrips++;}}for(const raw of ['0','-1','2.4e3','.5','+3','1e-20'])assert(Number.isFinite(parseValue(raw)));}
for(const raw of ['',' ','NaN','Infinity','1e309','1,000','2 kg','1+2','0x10','1.2.3'])assert.throws(()=>parseValue(raw));
for(const [unit,n] of [['°C',-273.1500000001],['°F',-459.6700000001],['K',-1e-11],['°R',-1e-11]])assert.throws(()=>convert(n,find('temperature',unit),find('temperature','K'),true));
assert.throws(()=>convert(1e308,find('mass','Gg'),find('mass','ng')));assert.throws(()=>convert(1e-320,find('length','nm'),find('length','m')));
const audit=JSON.parse(fs.readFileSync(__dirname+'/original-audit.json'));assert.equal(audit.length,545);assert.equal(audit.filter(x=>x.status==='保留待確認').length,44);
const result={date:'2026-10-05',categories:data.length,units:data.reduce((n,c)=>n+c.units.length,0),standardFixtures:fixtures.length,roundTrips,originalRows:audit.length,pendingRows:44,status:'PASS'};fs.writeFileSync(__dirname+'/validation.json',JSON.stringify(result,null,2));console.log(result);
