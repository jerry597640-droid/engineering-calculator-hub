(function(root){'use strict';function run(){const E=root.CorbelEngine||(typeof require==='function'?require('./engine.js'):null),out=[],near=(a,b,t=1e-6)=>Math.abs(a-b)<=t,base=E.calculate(E.DEFAULT);function test(name,fn){try{out.push({name,ok:!!fn()});}catch(e){out.push({name,ok:false,error:e.message});}}
 test('手算基準：d＝43.777 cm',()=>near(base.d,43.777));
 test('手算基準：Mu＝12.74676 tf·m',()=>near(base.Mu/100000,12.74676));
 test('手算基準：Af＝9.719681711 cm²',()=>near(base.Af,9.719681711));
 test('手算基準：An＝3.80952381、Avf＝13.605442177 cm²',()=>near(base.An,3.80952381)&&near(base.Avf,13.605442177));
 test('主筋包絡＝13.529205521 cm²',()=>near(base.AscReq,13.529205521));
 test('實配主筋對Ah需求＝8.229238095 cm²',()=>near(base.AhReq,8.229238095));
 test('尺寸剪力上限＝73.54536 tf',()=>near(base.vDim*.75/1000,73.54536));
 test('承壓φb＝0.65：能力92.82 tf',()=>near(base.bCap/1000,92.82));
 test('範例數值通過，未自動完成細部確認',()=>base.passed&&!base.details&&base.status.includes('待確認'));
 test('箍筋不足：4道D10必須NG',()=>!E.calculate({...E.DEFAULT,hoopN:4}).checks.find(c=>c.name==='閉合箍筋 Ah').ok);
 test('主筋加量後Ah需求隨之增加',()=>E.calculate({...E.DEFAULT,mainN:5}).AhReq>base.AhReq);
 test('aᵥ/d＝1允許；大於1則超出方法範圍',()=>{const q={...E.DEFAULT,L:70,xAnchor:60,av:base.d};return E.calculate(q).applicable&&!E.calculate({...q,av:base.d+.001}).applicable;});
 test('Nuc＝Vu允許；大於Vu則超出方法範圍',()=>E.calculate({...E.DEFAULT,Nu:60}).applicable&&!E.calculate({...E.DEFAULT,Nu:60.001}).applicable);
 test('支承墊束制力＝0.32Rs，與外輸入力取大值',()=>near(E.calculate({...E.DEFAULT,nMode:'pad',Rs:40,Nu:0}).Nuc/1000,12.8));
 test('試驗低摩擦支承墊μ＝0.1：束制力6.4 tf',()=>near(E.calculate({...E.DEFAULT,nMode:'tested',muPad:.1,Rs:40,Nu:0}).Nuc/1000,6.4));
 test('試驗摩擦係數超過0.2不增加規範估值',()=>near(E.calculate({...E.DEFAULT,nMode:'tested',muPad:.4,Rs:40,Nu:0}).Nuc/1000,12.8));
 test('粗糙施工縫μ＝1、未粗糙μ＝0.6',()=>near(E.calculate({...E.DEFAULT,interface:'rough'}).mu,1)&&near(E.calculate({...E.DEFAULT,interface:'smooth'}).mu,.6));
 test('未粗糙施工縫強度上限不超過56bw d',()=>near(E.calculate({...E.DEFAULT,fc:560,interface:'smooth'}).vInterface,56*40*base.d));
 test('全輕質：μ＝1.05；尺寸上限61.54536 tf',()=>{const r=E.calculate({...E.DEFAULT,concrete:'all'});return near(r.mu,1.05)&&near(.75*r.vDim/1000,61.54536);});
 test('常重砂輕質λ＝0.85、μ＝1.19',()=>{const r=E.calculate({...E.DEFAULT,concrete:'sand'});return near(r.lambda,.85)&&near(r.mu,1.19);});
 test('承壓外緣超越端部錨定，位置檢核NG',()=>!E.calculate({...E.DEFAULT,xAnchor:29}).checks.find(c=>c.name==='承壓面與端部錨定位置').ok);
 test('低承壓面積10×10 cm必須NG',()=>!E.calculate({...E.DEFAULT,bl:10,bb:10}).checks.find(c=>c.name==='托架混凝土局部承壓').ok);
 test('過高Vu不能靠增加鋼筋突破混凝土上限',()=>!E.calculate({...E.DEFAULT,Vu:150,mainN:8}).checks.find(c=>c.name==='混凝土尺寸剪力上限').ok);
 test('主筋淨距不足必須NG',()=>!E.calculate({...E.DEFAULT,mainN:9}).checks.find(c=>c.name==='單排主筋淨間距').ok);
 test('過量鋼筋時應變相容採未降伏鋼筋應力',()=>{const r=E.calculate({...E.DEFAULT,mainN:30});return r.flex.fs<r.p.fy&&near(.85*r.p.fc*r.p.bw*r.flex.a,(r.Asc-r.An)*r.flex.fs,.001);});
 test('拒絕NaN、負載重、空幾何、非整數筋數與未知選項',()=>[{Vu:NaN},{Nu:-1},{bw:0},{mainN:3.5},{interface:'invalid'},{nMode:'pad',Rs:0},{fy:5600}].every(q=>!E.calculate({...E.DEFAULT,...q}).valid));
 test('彎矩需求超出單筋降伏解時須NG，不能誤判OK',()=>{const r=E.calculate({...E.DEFAULT,Vu:500,Nu:500});return !r.reqYield&&!r.passed;});
 test('四项細部確認為真才列細部已確認',()=>E.calculate({...E.DEFAULT,front:true,support:true,bearing:true,durability:true}).details);
 test('獨立同向外拉力須相加：12 + 12.8＝24.8 tf',()=>near(E.calculate({...E.DEFAULT,nMode:'pad',nCombine:'sum',Nu:12,Rs:40}).Nuc/1000,24.8));
 test('完整水平力取大避免重複束制：max(12,12.8)＝12.8 tf',()=>near(E.calculate({...E.DEFAULT,nMode:'pad',nCombine:'envelope',Nu:12,Rs:40}).Nuc/1000,12.8));
 test('直接模式不相加墊材估值；拒絕未知合併選項',()=>near(E.calculate({...E.DEFAULT,nMode:'direct',nCombine:'sum'}).Nuc/1000,12)&&!E.calculate({...E.DEFAULT,nCombine:'invalid'}).valid);
 return out;}
const api={run};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.CorbelVerification=api;
})(typeof window!=='undefined'?window:globalThis);


