const assert=require('node:assert/strict');
const F=require('./engine.js');
let count=0;
function check(name,f){f();count++;console.log('PASS '+name)}
function near(a,b,tol=1e-7){assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} != ${b}`)}
check('Uniform pressure: N/A',()=>{let p=F.pressure(4,3,120,0,0);near(p.qmax,10);near(p.qmin,10);near(p.area,12)});
check('Full contact: exact biaxial elastic formula',()=>{let p=F.pressure(4,3,120,24,-12);near(p.qmax,10+6*24/(3*16)+6*12/(4*9));near(p.qmin,10-6*24/(3*16)-6*12/(4*9));assert.ok(p.full)});
check('Uniaxial lift-off: analytical triangular contact',()=>{let N=100,L=4,B=3,e=1,a=3*(L/2-e),p=F.pressure(L,B,N,N*e,0);near(p.area,a*B);near(p.qmax,2*N/(a*B));near(p.qmin,0)});
check('Biaxial triangular corner contact: barycentric centroid',()=>{let L=4,B=3,N=100,eX=1.4,eY=.8,ax=4*(L/2-eX),ay=4*(B/2-eY),A=ax*ay/2,p=F.pressure(L,B,N,N*eX,N*eY);near(p.area,A);near(p.qmax,3*N/A)});
check('Mirror signs preserve area and peak pressure',()=>{let a=F.pressure(4,3,100,140,80),b=F.pressure(4,3,100,-140,-80);near(a.area,b.area);near(a.qmax,b.qmax);near(a.F[1],-b.F[1]);near(a.F[2],-b.F[2])});
check('Near overturning: eccentricity 1.95 m',()=>{let p=F.pressure(4,4,100,195,0);near(p.area,.6);near(p.qmax,1000/3)});
check('No finite contact when resultant outside base',()=>{assert.throws(()=>F.pressure(4,4,100,201,0));assert.throws(()=>F.pressure(4,4,-1,0,0))});
check('Old weight correction includes thickness',()=>{let r=F.calculate(F.defaults);near(r.wc,2.4*4.1*4.1*.85);near(r.dx,76.23);near(r.dy,73.69)});
check('Centric footing: independent hand integration of M and V',()=>{let r=F.calculate(F.defaults),c=r.results[1],q=c.p.qmax-1.2*(2.4*.85+.91*.65+.5),ax=(4.1-.75)/2,ay=(4.1-.3)/2;near(c.sides[0].M,q*4.1*ax*ax/2);near(c.sides[2].M,q*4.1*ay*ay/2);near(c.sides[0].Vu,q*4.1*(ax-.7623));near(c.sides[2].Vu,q*4.1*(ay-.7369))});
check('Punching subtracts internal reaction, kgf conversion',()=>{let r=F.calculate(F.defaults),c=r.results[1],p=c.punch,q=c.p.qmax-1.2*(2.4*.85+.91*.65+.5),area=(.75+p.d)*(.3+p.d);near(p.V,q*(4.1*4.1-area));near(p.vmax,p.V/(p.bo*p.d)/10);near(p.capacity,.75*.53*(1+2/2.5)*Math.sqrt(210))});
check('No-stirrup shear follows 22.5.5.1(c), not old 0.53',()=>{let r=F.calculate(F.defaults),s=r.results[1].sides[2],rho=r.Asy/(410*r.dy),capacity=.75*2.12*Math.cbrt(rho)*Math.sqrt(210)*410*r.dy/1000;near(s.shearCap,capacity);assert.equal(r.status,'NG')});
check('Thickness-adjusted example passes listed checks',()=>{let r=F.calculate({...F.defaults,h:100,fc:280,gammaS:1.8,qa:30});assert.equal(r.status,'PASS');near(r.results[1].shearRatio,.7875812477864891);near(r.results[1].punch.ratio,.6238087669593497)});
check('Groundwater: gross effective force + net hydrostatic force balance',()=>{let r=F.calculate({...F.defaults,zw:0,gammaSat:2});assert.equal(r.errors.length,0);near(r.U,1.5*4.1*4.1);r.results.forEach(c=>assert.ok(c.netBalance<1e-8))});
check('Load pairing: minimum N is not mixed with maximum moment',()=>{let d=JSON.parse(JSON.stringify(F.defaults));d.cases.push({...d.cases[1],name:'low N',N:20,My:150});let r=F.calculate(d);assert.ok(r.results.at(-1).p.qmax!==r.results[1].p.qmax);near(r.results.at(-1).Sx,150)});
check('Moment/eccentricity signs match right-hand axes',()=>{let d=JSON.parse(JSON.stringify(F.defaults));d.ex=.1;d.ey=.2;d.cases[1].Mx=30;d.cases[1].My=-40;let r=F.calculate(d),c=r.results[1],soil=(.91*.65+.5),k=434+1.2*r.wp-1.2*soil*r.Ac;near(c.Sx,-40+k*.1);near(c.Sy,-30+k*.2)});
check('Toe resisting / overturning moments include uplift',()=>{let d=JSON.parse(JSON.stringify(F.defaults));d.cases[0].My=100;let r=F.calculate(d);near(r.results[0].fsOTx,r.results[0].Ntotal*4.1/2/100)});
check('Edge critical perimeter never reports interior punching PASS',()=>{let d={...F.defaults,ex:1.6,cx:.75};let r=F.calculate(d);assert.equal(r.results[1].punch.interior,false);assert.notEqual(r.status,'PASS')});
check('Input protections: cover, column boundary, paired case types',()=>{assert.ok(F.calculate({...F.defaults,cover:1}).errors.length);assert.ok(F.calculate({...F.defaults,ex:3}).errors.length);assert.ok(F.calculate({...F.defaults,cases:[]}).errors.length)});
check('Partial contact adds size effect, equilibrium intact',()=>{let d=JSON.parse(JSON.stringify(F.defaults));d.cases[1].My=700;let r=F.calculate(d),c=r.results[1];assert.ok(!c.p.full);assert.ok(c.sides[0].lambda<1);assert.ok(c.netBalance<1e-8)});
check('Rectangular short-direction distribution 13.3.3.3',()=>{let r=F.calculate({...F.defaults,L:5,B:4});near(r.distFactor,2*1.25/2.25);assert.equal(r.short,'y')});
console.log(`Verified ${count} engineering test groups.`);

