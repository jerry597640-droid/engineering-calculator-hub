'use strict';
const JointEngine=(()=>{
function analyze(s){
 const positive=(k)=>{if(!Number.isFinite(s[k])||s[k]<=0)throw Error(k+' 必須大於0');return s[k]};
 if(!['CJP','PJP','PLUG','SLOT'].includes(s.type)||!['ASD','LRFD'].includes(s.method)||!['tension','shear'].includes(s.mode))throw Error('形式／設計方法／受力模式無效');
 const t=positive('t'),t2=positive('t2'),F=positive('F')*6.894757293168,lr=s.method==='LRFD';
 if(!Number.isFinite(s.P)||s.P<0)throw Error('需求P請輸入非負公斤力大小');
 if(!Number.isFinite(s.bm)||s.bm<0)throw Error('母材承載必須是非負數字');
 const checks=[],steps=[],check=(name,ok,value)=>checks.push({name,ok,value}),add=(title,formula,value,unit)=>steps.push({title,formula,value,unit});
 let area,te,fd,formula,minThroat=null;
 const groove=s.type==='CJP'||s.type==='PJP';
 if(groove){const L=positive('length')*10;te=s.type==='CJP'?Math.min(t,t2):positive('te');if(te>Math.min(t,t2))throw Error('有效喉厚不可大於較薄板厚；雙面PJP請填不重疊的有效喉厚總和');area=te*L;
  add('有效面積','Aw=te×有效焊長；cm×10→mm',`${te}×${L}=${area}`,'mm²');
  if(s.type==='PJP'){const thick=Math.max(t,t2);minThroat=thick<=6?3:thick<=12?5:thick<=19?6:thick<=38?8:thick<=57?10:thick<=150?12:16;check('PJP最小有效喉厚（較厚板保守包絡）',te>=minThroat,`${te} ≥ ${minThroat} mm`);check('PJP有效喉厚已依接頭/WPS確認',s.qualified===true,'須由詳圖、規範接頭及核定WPS確認，不能直接把槽深當喉厚');}
  if(s.type==='CJP'){check('CJP全滲透與相稱焊材已確認',s.qualified===true,'須有核定接頭/WPS及相稱焊材依據');}
  if(s.type==='CJP'&&s.mode==='tension'){fd=(lr?.9:.6)*positive('Fy')*.0980665;formula=lr?'fd=0.90Fy（本頁僅檢核局部降伏）':'fd=0.60Fy（本頁僅檢核局部降伏）';}
  else{const factor=lr?(s.type==='CJP'||s.mode==='tension'?.48:.45):.3;fd=factor*F;formula=lr?(factor===.48?'fd=0.80×0.60FEXX':'fd=0.75×0.60FEXX'):'fd=0.30FEXX';}
 }else{
  if(s.mode!=='shear')throw Error('塞孔／塞槽焊只提供接觸面平行剪力；不可用來檢核拉力');
  const n=positive('count'),d=positive('diameter'),depth=positive('depth');if(!Number.isInteger(n)||n>10000)throw Error('孔數須為1–10000整數');
  if(depth>t)throw Error('焊厚不得超過開孔板厚');
  const dmin=s.type==='SLOT'||!lr?Math.ceil((t+8)/1.5)*1.5:t+8;
  check('孔徑／槽寬最小值',d>=dmin,`${d} ≥ ${dmin} mm`);check('孔徑／槽寬最大值',d<=2.25*depth,`${d} ≤ 2.25×焊厚=${2.25*depth} mm`);
  check('焊厚最小值',t<=16?Math.abs(depth-t)<1e-8:depth>=Math.max(t/2,16),t<=16?`板厚≤16mm：焊厚=${t} mm`:`焊厚≥max(t/2,16)=${Math.max(t/2,16)} mm`);
  if(s.type==='PLUG'){area=n*Math.PI*d*d/4;add('有效面積','Aw=nπd²/4（接觸面圓孔面積）',`${n}×π×${d}²/4=${area}`,'mm²');if(n>1)check('孔中心間距',positive('pitch')>=4*d,`${s.pitch} ≥ 4d=${4*d} mm`);}
  else{const L=positive('slotLength');if(L<d)throw Error('槽總長必須≥槽寬');area=n*(d*(L-d)+Math.PI*d*d/4);add('有效面積','Aw=n[b(l−b)+πb²/4]（兩端半圓、l含端部）',`${n}×[${d}×(${L}−${d})+π×${d}²/4]=${area}`,'mm²');check('槽總長限制',L<=10*depth,`${L} ≤ 10×焊厚=${10*depth} mm`);if(n>1){check('橫向槽中心間距',positive('pitch')>=4*d,`${s.pitch} ≥ 4b=${4*d} mm`);check('縱向槽中心間距',positive('pitchL')>=2*L,`${s.pitchL} ≥ 2l=${2*L} mm`);}}
  te=depth;fd=(lr?.45:.3)*F;formula=lr?'fd=0.75×0.60FEXX':'fd=0.30FEXX';check('接觸面已熔合／焊厚依WPS確認',s.qualified===true,'本面積僅適用塞孔／塞槽焊，不適用孔內填角焊');
 }
 const capacity=fd*area/9.80665,ratio=s.P/capacity,bmRatio=s.bm>0?s.P/s.bm:null;
 add('可用應力',formula,fd/.0980665,'kgf/cm²');add('局部可用承載','R=fd(MPa)×Aw(mm²)/9.80665',`${fd}×${area}/9.80665=${capacity}`,'kgf');add('利用率','P/R',`${s.P}/${capacity}=${ratio}`,'');
 check('焊道／CJP局部強度',ratio<=1+1e-10,`${ratio.toFixed(3)} ≤ 1.000`);check('母材承載另算並輸入',bmRatio!==null&&bmRatio<=1+1e-10,bmRatio===null?'未提供：本頁不得判為已列項目符合':`${bmRatio.toFixed(3)} ≤ 1.000（採外部母材計算書）`);
 return{...s,area,te,fd,capacity,ratio,bmRatio,minThroat,checks,steps,pass:checks.every(c=>c.ok),source:'台灣ASD／極限設計 §10.2.1–10.2.4、表10.2-3及10.2-5',scope:'同心單一受力均勻分配；母材外部承載資料須涵蓋降伏、斷裂、塊狀剪裂及適用破壞路徑。PJP剪力僅適用平行於焊軸方向；未分析偏心、力矩、拉剪共同作用、疲勞、耐震及施工品質。'};
}
return{analyze};})();
if(typeof module!=='undefined')module.exports=JointEngine;
