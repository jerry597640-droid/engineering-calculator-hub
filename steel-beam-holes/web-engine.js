/* Unreinforced isolated web openings, AISC DG2 (1990, 2003 revision).
 * Equations 3-6, 3-12, 3-13 and 3-3; ASD bridge per 3.8, not TW 0.66Fy.
 * Units: cm, MPa, tf, tf-m. No reinforcement or composite contribution.
 */
(function(root){'use strict';
const MPATF=98.0665,MPAKSI=6.894757293168;
function calcWeb(p,w){
 for(const k of ['H','B','tw','tf','Fy'])if(!Number.isFinite(p[k])||p[k]<=0)throw Error(k+' 必須為正數');
 for(const k of ['ho','ao','edge'])if(!Number.isFinite(w[k])||w[k]<=0)throw Error(k+' 必須為正數');
 for(const k of ['e','V','M','radius','Z'])if(!Number.isFinite(w[k]))throw Error(k+' 不得空白或非數值');
 if(!['rect','circle'].includes(w.shape)||!['asd','lrfd'].includes(w.design))throw Error('孔形或設計方法無效');
 if(w.radius<0||w.Z<0||p.H<=2*p.tf||p.B<=p.tw)throw Error('尺寸、圓角或斷面模數不合理');
 const fy=p.Fy/MPATF,fyksi=p.Fy/MPAKSI,h=p.H-2*p.tf;
 const circle=w.shape==='circle',height=w.ho,length=circle?w.ho:w.ao;
 const st=(p.H-height)/2-w.e,sb=(p.H-height)/2+w.e;
 if(st<=p.tf||sb<=p.tf)throw Error('孔洞超出腹板淨高或接觸翼板');
 if(!circle&&2*w.radius>Math.min(height,length))throw Error('圓角半徑大於孔洞短邊的一半');
 const hs=circle?.9*height:height,as=circle?.45*height:length;
 const sts=(p.H-hs)/2-w.e,sbs=(p.H-hs)/2+w.e;
 const Zgeom=p.B*p.tf*(p.H-p.tf)+p.tw*h*h/4,Z=w.Z>0?w.Z:Zgeom;
 const Mp=fy*Z/100,Mm=fy*(Z-height*p.tw*(height/4+Math.abs(w.e)))/100;
 if(Mm<=0)throw Error('扣孔後塑性彎矩不為正，超出本模型');
 const tee=s=>{const nu=as/s,alpha=Math.min(1,Math.sqrt(6)/(nu+Math.sqrt(3))),Vp=fy*p.tw*s/Math.sqrt(3);return {s,nu,alpha,Vp,Vm:alpha*Vp}};
 const top=tee(sts),bottom=tee(sbs),Vp=fy*p.tw*p.H/Math.sqrt(3),webSlender=h/p.tw,stocky=webSlender<=420/Math.sqrt(fyksi),Vlimit=(stocky?2/3:.45)*Vp,VmRaw=top.Vm+bottom.Vm,Vm=Math.min(VmRaw,Vlimit);
 const phi=w.design==='lrfd'?.9:1,loadFactor=w.design==='asd'?1.7:1,Vd=loadFactor*Math.abs(w.V),Md=loadFactor*Math.abs(w.M);
 const rm=Md/(phi*Mm),rv=Vd/(phi*Vm),interaction=Math.cbrt(rm**3+rv**3),shearAtM=rm>=1?0:phi*Vm/loadFactor*Math.cbrt(1-rm**3);
 const compNu=w.M>=0?top.nu:bottom.nu,parameter=length/height+6*height/p.H;
 const checks=[
 ['鋼材 Fy ≤ 65 ksi',fyksi<=65,fyksi,65],
 ['受壓翼板 B/(2tf) ≤ 65/√Fy(ksi)',p.B/(2*p.tf)<=65/Math.sqrt(fyksi),p.B/(2*p.tf),65/Math.sqrt(fyksi)],
 ['腹板 h/tw ≤ 520/√Fy(ksi)',webSlender<=520/Math.sqrt(fyksi),webSlender,520/Math.sqrt(fyksi)],
 ['孔高／梁高 ≤ 0.70',height/p.H<=.7,height/p.H,.7],
 ['孔長／孔高限制',length/height<=(stocky?3:2.2),length/height,stocky?3:2.2],
 ['開孔參數 a/h＋6h/H ≤ 5.6',parameter<=5.6,parameter,5.6],
 ['上 T 形肢深度 ≥ 0.15H',st>=.15*p.H,st,.15*p.H],
 ['下 T 形肢深度 ≥ 0.15H',sb>=.15*p.H,sb,.15*p.H],
 ['最大 T 肢長深比 ≤ 12',Math.max(top.nu,bottom.nu)<=12,Math.max(top.nu,bottom.nu),12],
 ['孔邊至最近支承 ≥ H',w.edge>=p.H,w.edge,p.H]
 ];
 if(!circle)checks.push(['孔角半徑 ≥ max(2tw,1.5875cm)',w.radius>=Math.max(2*p.tw,1.5875),w.radius,Math.max(2*p.tw,1.5875)]);
 const reasons=[];if(checks.some(c=>!c[1]))reasons.push('幾何／材料適用條件不符');
 if(!w.braced)reasons.push('須確認受壓翼板具充分側向支撐');
 if(!w.conditions)reasons.push('須確認單一無補強孔、無同區翼板孔及集中載重干擾');
 if(compNu>4&&!w.teeVerified)reasons.push('受壓 T 肢長深比 > 4，須另核軸壓穩定');
 return {fy,fyksi,h,height,length,hs,as,st,sb,Zgeom,Z,Mp,Mm,top,bottom,Vp,webSlender,stocky,Vlimit,VmRaw,Vm,phi,loadFactor,Vd,Md,rm,rv,interaction,shearAtM,Vallow:phi*Vm/loadFactor,Mallow:phi*Mm/loadFactor,parameter,checks,reasons,applicable:reasons.length===0,capacityPass:interaction<=1,pass:reasons.length===0&&interaction<=1};
}
if(typeof module!=='undefined')module.exports={calcWeb};else root.WebHoles={calcWeb};
})(typeof window==='undefined'?this:window);
