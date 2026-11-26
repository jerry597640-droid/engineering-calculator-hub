const assert=require('node:assert/strict');const E=require('./engine.js');const G=9.80665;
const p={d:1,db:1,tip:10,head:0,water:2,gp:24,load:200*G,pull:30*G,down:0,fs:2.5,fb:3.5,fu:5,fw:2.5,step:.5,mode:'current',type:'bored',shape:'circle',condition:'normal',safety:'separate'};
const s={name:'砂土',h:12,soil:'sand',method:'spt',gamma:18,sat:20,n:20,su:60,k:.5,delta:20,phi:30,alpha:.5,nq:10,nc:9,ng:0,crit:8,dense:1};
let passed=0;function near(a,b){assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);}function test(name,fn){fn();passed++;console.log('PASS '+name);}
const run=(pp={},ll=[s])=>E.calculate({...p,...pp},ll);const A=Math.PI/4,U=Math.PI;
test('均勻砂土獨立手算：Qs Qb Qa 浮重 拉拔',()=>{const r=run(),qs=20/3*U*10*G,qb=150*A*G,w=A*(24*2+(24-G)*8);near(r.qs,qs);near(r.qb,qb);near(r.gross,qs/2.5+qb/3.5);near(r.weight,w);near(r.net,qs/2.5+qb/3.5-w);near(r.uplift,qs/5+w);});
test('分層 SPT 精確摩擦積分',()=>{const r=run({},[{...s,h:3,n:10},{...s,h:9,n:30}]);near(r.qs,(10/3*3+30/3*7)*U*G);near(r.parts[0].qs,10/3*3*U*G);});
test('鑽掘樁尖上下1D平均，跨層加權',()=>{const r=run({},[{...s,h:9.5,n:10},{...s,h:2.5,n:30}]);near(r.qb,7.5*25*A*G);});
test('打入樁上4D 下1D平均',()=>{const r=run({type:'driven'},[{...s,h:9,n:10},{...s,h:3,n:30}]);near(r.qb,30*18*A*G);});
test('N̄上限50 摩擦上限15',()=>{const r=run({},[{...s,n:100}]);near(r.qb,7.5*50*A*G);near(r.qs,15*U*10*G);});
test('方樁截面與浮重',()=>{const r=run({shape:'square'});near(r.qb,150*G);near(r.qs,20/3*4*10*G);near(r.weight,24*2+(24-G)*8);});
test('水位位於樁頭上方',()=>{const r=run({head:3,water:2});near(r.weight,A*(24-G)*7);near(r.qs,20/3*U*7*G);});
test('參數黏土 αSu 與NcSu',()=>{const r=run({},[{...s,method:'static',soil:'clay'}]);near(r.qs,.5*60*U*10);near(r.qb,9*60*A);});
test('砂土靜力法跨水位精確積分，臨界8m',()=>{const r=run({},[{...s,method:'static'}]);const sig8=18*2+(20-G)*6;const integral=.5*18*2**2+36*6+.5*(20-G)*6**2+sig8*2;near(r.qs,.5*Math.tan(20*Math.PI/180)*integral*U);near(r.qb,sig8*10*A);});
test('靜力砂土不同單位重跨層',()=>{const l=[{...s,h:4,method:'static',crit:0},{...s,h:8,method:'static',crit:0,gamma:19,sat:21}];const r=run({},l);const sig4=36+(20-G)*2;const integral=36+36*2+.5*(20-G)*4+sig4*6+.5*(21-G)*36;near(r.qs,.5*Math.tan(20*Math.PI/180)*integral*U);});
test('原程式典型砂土法解析式',()=>{const r=run({mode:'legacy'},[{...s,method:'typical',dense:0}]);const sig6=36+(20-G)*4;const integral=36+36*4+.5*(20-G)*16+sig6*4;near(r.qs,.3*integral*U);near(r.qb,sig6*25*A);});
test('原詳細法 φ=30° 對應鑽掘Nq=10',()=>{const r=run({mode:'legacy'},[{...s,method:'static'}]);near(r.qb,(36+(20-G)*6)*10*A);});
test('α0 α200 Nc0 Nc4邊界不越界',()=>{near(E.alpha(0),1);near(E.alpha(200),.319);near(E.nc(0),6.3);near(E.nc(4),9);assert.throws(()=>E.alpha(201));});
test('步距不影響樁尖結果',()=>{near(run({step:.05}).qs,run({step:2}).qs);});
test('負摩擦需求扣減',()=>{near(run({down:10*G}).net,run().net-10*G);});
test('擴底自重仍依樁身 拉拔不判合格',()=>{const r=run({db:2});near(r.weight,run().weight);near(r.qb,run().qb*4);assert.equal(r.upliftOK,false);});
test('現行黏土SPT、資料不足、平均範圍黏土 拒絕',()=>{assert.throws(()=>run({},[{...s,soil:'clay'}]));assert.throws(()=>run({},[{...s,h:10}]));assert.throws(()=>run({},[{...s,h:10.5},{...s,soil:'clay',method:'static',h:2}]));});
test('安全係數不足不誤判符合',()=>assert.equal(run({fb:2.5}).fsOK,false));
test('無效深度/數值/選項/土層均拒絕',()=>{for(const v of [{d:0},{tip:501},{water:-1},{head:10},{fs:0},{d:NaN},{mode:'unknown'}])assert.throws(()=>run(v));assert.throws(()=>run({},[]));});
console.log(`${passed} verification groups passed.`);

