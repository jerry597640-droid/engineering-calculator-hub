// Independent hand-substitution checks using published kgf/cm² coefficients.
const assert=require('assert'),F=require('./engine.js');let total=0;
function near(actual,expected,label){assert(Math.abs(actual-expected)<1e-8*Math.max(1,Math.abs(expected)),label);total++;}
const r=F.calc(F.defaults),fc=280,fy=4200,As=3.871*100/15;
const dx=65-7.5-2.22/2,dy=65-7.5-2.22-2.22/2,dp=(dx+dy)/2;
for(const s of r.shear){const rho=As/(100*s.d);near(s.capacity,.75*Math.min(2.12*Math.cbrt(rho),1.33)*Math.sqrt(fc)*s.b*s.d/1000,s.name);}
for(const p of r.punching){const b0=4*(50+dp),coefficient=Math.min(1.06,.53*(1+2),.265*(2+40*dp/b0));near(p.capacity,.75*coefficient*Math.sqrt(fc)*b0*dp/1000,p.name);}
for(const s of r.reinforcement){const a=As*fy/(.85*fc*100);near(s.capacity,.9*As*fy*(s.d-a/2)/100000,s.name);near(s.Asmin,.0018*100*65,s.name+' minimum');near(s.eps,.003*(s.d-a/.85)/(a/.85),s.name+' strain');}
const reduced=F.calc({...F.defaults,cx1:40,cy1:140,cx2:40,cy2:140,b1:3,h:50});
for(const p of reduced.punching){const coefficient=Math.min(1.06,.53*(1+2/3.5),.265*(2+40*p.d/p.b0));near(p.capacity,.75*coefficient*Math.sqrt(fc)*p.b0*p.d/1000,'large beta');}
console.log(total+' independent strength substitution assertions passed');
