(function(root){'use strict';
// TW ASD 4.5 / Table 4.5-1, strong-axis bending without axial force.
// These are gross-section compactness limits shared by rolled and welded I beams.
function compactness(p){
 for(const k of ['H','B','tw','tf','Fy'])if(!Number.isFinite(p[k])||p[k]<=0)throw Error(k+' 必須大於 0');
 if(p.H<=2*p.tf||p.B<=p.tw)throw Error('翼板／腹板尺寸不合理');
 const fy=p.Fy/98.0665,b=p.B/2,h=p.H-2*p.tf,flange=b/p.tf,web=h/p.tw,flangeLimit=17/Math.sqrt(fy),webLimit=170/Math.sqrt(fy);
 const flangePass=flange<=flangeLimit,webPass=web<=webLimit;
 return {fy,b,h,flange,web,flangeLimit,webLimit,flangeRatio:flange/flangeLimit,webRatio:web/webLimit,flangePass,webPass,compact:flangePass&&webPass,materialPass:fy<=4.55,lc:Math.min(20*p.B/Math.sqrt(fy),1400*p.B*p.tf/(p.H*fy))};
}
function section(p,ut,ub){const {H,B,tw,tf}=p,h=H-2*tf;const parts=[[B-ut,tf,H-tf/2],[tw,h,H/2],[B-ub,tf,tf/2]];let A=0,Q=0;for(const [b,t,y]of parts){A+=b*t;Q+=b*t*y}const y=Q/A;let I=0;for(const [b,t,z]of parts)I+=b*t*t*t/12+b*t*(z-y)**2;return {A,y,I,St:I/(H-y),Sb:I/y};}
function calc(p){for(const k of ['H','B','tw','tf','Fy','d','Lb'])if(!Number.isFinite(p[k])||p[k]<=0)throw Error(k+' 必須大於 0');for(const k of ['nt','nb'])if(!Number.isInteger(p[k])||p[k]<0||p[k]>20)throw Error('孔數須為 0–20 整數');if(!Number.isFinite(p.M)||!Number.isFinite(p.add)||p.add<0||p.add>5)throw Error('彎矩或孔徑增量不正確');if(p.H<=2*p.tf||p.B<=p.tw)throw Error('翼板／腹板尺寸不合理');const dh=(p.d+p.add)/10,ut=p.nt*dh,ub=p.nb*dh;if(Math.max(ut,ub)>=p.B-p.tw)throw Error('孔洞扣除總寬過大，無法維持完整腹板連接');const fy=p.Fy/98.0665,h=p.H-2*p.tf,g=section(p,0,0),n=section(p,ut,ub),e=section(p,Math.max(0,ut-.15*p.B),Math.max(0,ub-.15*p.B));const classification=compactness(p),lc=classification.lc,compact=classification.compact;
// Automatic 7.2.1 is deliberately gated. Longer unbraced members require verified external Fb.
const auto=compact&&classification.materialPass&&p.Lb<=lc;let fb=auto?.66*fy:p.Fb/1000;if(!auto&&(!Number.isFinite(fb)||fb<=0||fb>.66*fy))fb=null;const cap=s=>fb===null?null:Math.min(s.St,s.Sb)*fb/100;const m0=cap(g),me=cap(e),mn=cap(n),r=Math.min(n.St,n.Sb)/Math.min(g.St,g.Sb);return {g,n,e,dh,ut,ub,fy,lc,compact,auto,fb,m0,me,mn,r,ratio:mn?Math.abs(p.M)/mn:null,compression:p.M>=0?'上翼板':'下翼板',tension:p.M>=0?'下翼板':'上翼板',scope:!auto?'待覆核：需輸入經另案驗證之容許應力及開孔後穩定性檢核':p.add!==1.5?'實孔徑敏感度分析，非規範預設':((p.M>=0?p.nt:p.nb)>0?'受壓翼板有孔：局部穩定性待另核':'截面彎曲篩檢；接合與其他破壞模式另核')};}
if(typeof module!=='undefined')module.exports={section,calc,compactness};else root.Holes={section,calc,compactness};
})(typeof window==='undefined'?this:window);
