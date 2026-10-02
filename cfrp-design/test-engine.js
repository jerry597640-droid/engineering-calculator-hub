const assert=require('node:assert/strict'),F=require('./engine');
const p={fc:280,fy:4200,Es:2040000,Ef:2350000,ffu:35000,efu:.015,CE:.95,tf:.165,n:3,pull:1.5,b:40,h:60,As:20,d:54,df:60,bf:30,Mu:50,ebi:.0003,dv:50,Av:2.54,ss:20,w:10,sf:15,angle:90,Vu:35,rc:3,Pu:350,target:350,shape:'rect',wrap:'u',ties:'tied'};
const out=[];function close(name,a,b,tol=1e-8){assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),name+': '+a+' / '+b);out.push({name,computed:a,expected:b,tolerance:tol});}
close('kgf/cm² 轉換 MPa',280*F.K,27.45862);
close('舊脫黏式應力單位比值抵消',.41*Math.sqrt(280/(3*.165*2350000)),.41*Math.sqrt((280*F.K)/(3*.165*(2350000*F.K))));
const m=F.material(p),r=F.flex(p);close('抗彎脫黏應變 SI',r.efd,Math.min(.41*Math.sqrt(27.45862/(230456.275*.495)),.9*.95*(35000/2350000)));
close('抗彎力平衡殘差 tf',r.residual,0,1e-7);
close('抗彎鋼筋應變相容',r.es,r.ec*(540-r.c)/r.c);
close('抗彎 CFRP 初始應變扣除',r.ef,r.ec*(600-r.c)/r.c-.0003);
// Independent numerical integration of the concrete stress diagram.
for(const ec of [.0004,.0015,.002,.0028,.003]){let C=0,M=0;const c=100,b=400,fc=28,N=100000;for(let i=0;i<N;i++){const y=(i+.5)*c/N,e=ec*(1-y/c),q=e/.002,s=.85*fc*(q<=1?2*q-q*q:1),f=s*b*c/N;C+=f;M+=f*y;}const a=F.concrete(c,ec,fc,b);close('混凝土數值積分 C，ε='+ec,a.C,C,1e-8);close('混凝土數值積分重心，ε='+ec,a.y,M/C,1e-8);}
const full=F.shear({...p,wrap:'full'});close('完整包覆有效應變',full.ef,.004);close('完整包覆 Vf 手算 tf',full.Vf,(2*.495*100)*230456.275*.004*500/150/F.TF);close('完整包覆容量手算',full.capacity,.75*(full.Vc+full.Vs+.95*full.Vf));const u=F.shear(p);close('U形 Le 獨立手算 cm',u.Le,(23300/Math.pow(.495*230456.275,.58))/10);close('U形 k2',(u.k2),(500-u.Le*10)/500);const short=F.shear({...p,dv:1});close('短貼附貢獻為0',short.Vf,0);
const c0=F.column({...p,n:0});close('未補強柱純軸壓手算 tf',c0.capacity,.8*.65*(.85*280*(c0.Ag-20)+4200*20)/1000);const cc=F.column({...p,b:60,h:60,As:40,n:20});close('柱形狀係數手算',cc.ka,(1-2*540*540/(3*(600*600-(4-Math.PI)*30*30))-4000/(600*600-(4-Math.PI)*30*30))/(1-4000/(600*600-(4-Math.PI)*30*30)));close('低圍束不採強度提升',F.column({...p,n:1}).fcc,280);close('長邊超出範圍不採提升',F.column({...p,b:60,h:100,n:20}).fcc,280);
// Published ACI 440.2R-17 section 16.8 material example: 610 square, rc25, n6 tf.33, E227527, CE .95, efu .0167, As 9861.
const ex=F.column({...p,b:61,h:61,rc:2.5,As:98.61,n:6,tf:.33,Ef:227527/F.K,ffu:3799/F.K,efu:.0167,CE:.95,fc:44.8/F.K});close('ACI16.8 形狀係數 (四捨五入)',ex.ka,.425,.005);close('ACI16.8 需求圍束壓力 MPa (四捨五入)',(56.4-44.8)/(.95*3.3*ex.ka),8.7,.01);close('ACI16.8 需求層數取整',Math.ceil(((56.4-44.8)/(.95*3.3*ex.ka))*Math.hypot(610,610)/(2*227527*.33*.55*.95*.0167)),6);
assert.throws(()=>F.validate({...p,tf:0},'flex'));assert.throws(()=>F.validate({...p,n:2.2},'flex'));assert.throws(()=>F.validate({...p,d:61},'flex'));assert.throws(()=>F.validate({...p,sf:9},'shear'));const capped=F.column({...p,shape:'circle',b:40,h:40,n:100});assert.ok(capped.strainCapped&&capped.fcc<capped.fccMax);out.push({name:'柱混凝土最大應變0.01限制',computed:'已降低強度',expected:'已降低強度',tolerance:0});
out.push({name:'無效輸入：0厚度、小數層數、d超深、條帶重疊',computed:'拒絕',expected:'拒絕',tolerance:0});
console.log(JSON.stringify({passed:out.length,results:out,samples:{flex:r,shear:u,column:cc}},null,2));
