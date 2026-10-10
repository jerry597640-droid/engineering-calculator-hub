/* RC Corbel Workbench v1.2.0 — TW 112 / errata 113. kgf, cm. */
(function(root){'use strict';
const BARS={D10:{d:.953,a:.7133},D13:{d:1.27,a:1.267},D16:{d:1.588,a:1.986},D19:{d:1.905,a:2.865},D22:{d:2.223,a:3.871},D25:{d:2.54,a:5.067},D29:{d:2.865,a:6.469},D32:{d:3.226,a:8.143},D36:{d:3.581,a:10.07}};
const DEFAULT={project:'RC 托架示範案',member:'C1－托架',kind:'corbel',fc:280,fy:4200,concrete:'normal',interface:'mono',bw:40,h:50,htip:30,L:40,av:20,cover:4,agg:2,bl:20,bb:30,xAnchor:35,Vu:60,Nu:12,nMode:'direct',nCombine:'envelope',Rs:40,muPad:.1,mainBar:'D25',mainN:4,hoopBar:'D10',hoopN:6,front:false,support:false,bearing:false,durability:false};
const EPS=1e-8,PHI=.75,ES=2040000;
function flexural(As,p,d){
 const beta=Math.max(.65,.85-.05*Math.max(0,p.fc-280)/70);
 if(As<=0)return {Mn:0,c:0,a:0,eps:0,fs:0,beta};
 let lo=1e-10,hi=d;const iterations=[];
 for(let i=0;i<100;i++){const c=(lo+hi)/2,a=beta*c,eps=.003*(d-c)/c,fs=Math.min(p.fy,ES*eps);iterations.push({iteration:i+1,lo,hi,c,a,eps,fs,C:.85*p.fc*p.bw*a,T:As*fs,branch:.85*p.fc*p.bw*a>As*fs?'hi=c':'lo=c'});if(.85*p.fc*p.bw*a>As*fs)hi=c;else lo=c;}
 const c=(lo+hi)/2,a=beta*c,eps=.003*(d-c)/c,fs=Math.min(p.fy,ES*eps);
 return {Mn:As*fs*(d-a/2),c,a,eps,fs,beta,iterations};
}
function calculate(input){
 const p={...DEFAULT,...input},errors=[];
 const pos=['fc','fy','bw','h','htip','L','av','cover','agg','bl','bb','xAnchor','Vu'];
 for(const k of pos)if(typeof p[k]!=='number'||!Number.isFinite(p[k])||p[k]<=0)errors.push(k+' 必須為正數');
 for(const k of ['Nu','Rs','muPad'])if(typeof p[k]!=='number'||!Number.isFinite(p[k])||p[k]<0)errors.push(k+' 不得為負值');
 for(const k of ['mainN','hoopN'])if(!Number.isInteger(p[k])||p[k]<(k==='mainN'?2:1)||p[k]>100)errors.push(k+' 必須為有效整數（主筋 2～100、箍筋 1～100）');
 for(const k of ['mainBar','hoopBar'])if(!BARS[p[k]])errors.push('鋼筋號數無效');
 for(const [k,v]of Object.entries({kind:['corbel','bracket'],concrete:['normal','sand','all'],interface:['mono','rough','smooth'],nMode:['direct','pad','tested'],nCombine:['envelope','sum']}))if(!v.includes(p[k]))errors.push(k+' 選項無效');
 if(p.fc<175||p.fc>700)errors.push('本版材料範圍：f′c＝175～700 kgf/cm²');
 if(p.fy<2800||p.fy>4200)errors.push('本版主筋與箍筋同級，fy＝2800～4200 kgf/cm²（剪力摩擦上限）');
 if(p.htip>p.h)errors.push('本版支承面深度不得小於外端深度');
 if(p.muPad>1)errors.push('支承墊試驗摩擦係數須在 0～1');
 if(p.nMode!=='direct'&&p.Rs<=0)errors.push('支承墊模式須輸入正的持續載重反力');
 if(p.xAnchor>p.L-p.cover)errors.push('錨定內側位置超出端部保護層界線');
 if(errors.length)return {valid:false,errors,p};
 const bm=BARS[p.mainBar],bh=BARS[p.hoopBar],d=p.h-p.cover-bh.d-bm.d/2;
 if(d<=0||p.bw<=2*(p.cover+bh.d)+bm.d||p.htip<=p.cover+bh.d)errors.push('尺寸不足以容納保護層及鋼筋');
 if(p.av-p.bl/2<0||p.av+p.bl/2>p.L||p.bb>p.bw)errors.push('承壓面必須完整位於托架頂面');
 if(errors.length)return {valid:false,errors,p};
 const lambda=p.concrete==='normal'?1:p.concrete==='sand'?.85:.75,mu={mono:1.4,rough:1,smooth:.6}[p.interface]*lambda;
 const Vu=p.Vu*1000,Npad=p.nMode==='direct'?0:1.6*(p.nMode==='pad'?.2:Math.min(.2,p.muPad))*p.Rs*1000;
 const Nuc=p.nMode!=='direct'&&p.nCombine==='sum'?p.Nu*1000+Npad:Math.max(p.Nu*1000,Npad);
 const ratio=p.av/d,Mu=Vu*p.av+Nuc*(p.h-d),An=Nuc/(PHI*p.fy),Avf=Vu/(PHI*mu*p.fy),Amin=.04*p.fc/p.fy*p.bw*d;
 const disc=d*d-2*Mu/(PHI*.85*p.fc*p.bw),beta=Math.max(.65,.85-.05*Math.max(0,p.fc-280)/70),aBal=beta*d*.003/(.003+p.fy/ES),AsBal=.85*p.fc*p.bw*aBal/p.fy;
 const Af=disc>=0?2*Mu/(PHI*p.fy*(d+Math.sqrt(disc))):Infinity;
 const reqYield=Number.isFinite(Af)&&Af<=AsBal+EPS,AscReq=reqYield?Math.max(Af+An,2*Avf/3+An,Amin):Infinity;
 const Asc=p.mainN*bm.a,Ah=p.hoopN*2*bh.a,AhReq=.5*Math.max(0,Asc-An),flex=flexural(Math.max(0,Asc-An),p,d);
 const capTerms=p.concrete==='normal'?[.2*p.fc,33.6+.08*p.fc,112]:[(.2-.07*ratio)*p.fc,56-20*ratio];
 const vDim=Math.min(...capTerms)*p.bw*d;
 const sfTerms=p.concrete==='normal'&&p.interface!=='smooth'?[.2*p.fc,33.6+.08*p.fc,112]:[.2*p.fc,56];
 const vInterface=Math.min(...sfTerms)*p.bw*d;
 const vSteel=mu*p.fy*Math.max(0,Asc+Ah-An),vCap=PHI*Math.min(vDim,vInterface,vSteel);
 const bCap=.65*.85*p.fc*p.bl*p.bb; // no confinement enhancement: k=1
 const hOuter=p.h+(p.htip-p.h)*(p.av+p.bl/2)/p.L;
 const clear=(p.bw-2*(p.cover+bh.d)-p.mainN*bm.d)/(p.mainN-1),clearMin=Math.max(2.5,bm.d,4*p.agg/3),pitch=(2*d/3)/p.hoopN;
 const checks=[];const check=(name,ok,demand,capacity,unit,ref,note='')=>checks.push({name,ok,demand,capacity,unit,ref,note});
 check('剪跨比 aᵥ/d',ratio<=1+EPS,ratio,1,'','16.5.1.1');
 check('水平拉力 Nuc ≤ Vu',Nuc<=Vu+EPS,Nuc/1000,Vu/1000,'tf','16.5.1.1');
 check('承壓面外緣深度',hOuter+EPS>=.5*d,.5*d,hOuter,'cm','16.5.2.2');
 check('承壓面與端部錨定位置',p.xAnchor+EPS>=p.av+p.bl/2,p.av+p.bl/2,p.xAnchor,'cm','16.5.2.3');
 check('混凝土尺寸剪力上限',PHI*vDim+EPS>=Vu,Vu/1000,PHI*vDim/1000,'tf','16.5.2.4／16.5.2.5');
 check('主拉力筋 Asc',Asc+EPS>=AscReq,AscReq,Asc,'cm²','16.5.5.1');
 check('閉合箍筋 Ah',Ah+EPS>=AhReq,AhReq,Ah,'cm²','16.5.5.2','依實配 Asc 計算；每道閉合箍計入 2 肢');
 check('剪力摩擦強度',vCap+EPS>=Vu,Vu/1000,vCap/1000,'tf','22.9、16.5.4.4');
 check('撓曲強度（扣除 An 後）',reqYield&&PHI*flex.Mn+EPS>=Mu,Mu/100000,PHI*flex.Mn/100000,'tf·m','16.5.4.5、22.2','先保留抵抗 Nuc 的 An，再計算撓曲鋼筋');
 check('托架混凝土局部承壓',bCap+EPS>=Vu,Vu/1000,bCap/1000,'tf','22.8、表21.2.1(d)','採 φb＝0.65、A₂/A₁ 增益＝1；被支承構材與墊材另確認');
 check('單排主筋淨間距',clear+EPS>=clearMin,clearMin,clear,'cm','25.2.1');
 const layerClear=Math.min(pitch-bh.d,pitch-(bm.d+bh.d)/2),layerMin=Math.max(2.5,4*p.agg/3);
 check('閉合箍筋層間淨距',layerClear+EPS>=layerMin,layerMin,layerClear,'cm','25.2.2','檢查主筋到首道箍及箍筋間；另保守考慮4/3骨材粒徑');
 const applicable=ratio<=1+EPS&&Nuc<=Vu+EPS,passed=applicable&&checks.every(c=>c.ok),details=['front','support','bearing','durability'].every(k=>p[k]===true);
 return {valid:true,p,errors:[],d,lambda,mu,Vu,Nuc,Mu,An,Avf,Amin,Af,reqYield,AscReq,Asc,Ah,AhReq,flex,vDim,vInterface,vSteel,vCap,bCap,hOuter,clear,clearMin,pitch,layerClear,layerMin,beta,AsBal,capTerms,sfTerms,checks,applicable,passed,details,traceScalars:{ratio,disc,aBal,NucInput:p.Nu*1000,NucPad:p.nMode==='direct'?0:1.6*(p.nMode==='pad'?.2:Math.min(.2,p.muPad))*p.Rs*1000},status:!applicable?'超出方法適用範圍':!passed?'有項目未通過':!details?'數值通過・細部待確認':'數值通過・細部已確認'};
}
const api={BARS,DEFAULT,PHI,ES,calculate,flexural};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.CorbelEngine=api;
})(typeof window!=='undefined'?window:globalThis);


