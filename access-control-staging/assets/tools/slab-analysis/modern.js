/* Taiwan 112/113 code: bounded nonprestressed, normal-weight slab strip checks. */
const SlabModern=(()=>{
 const Es=2040000;
 function section(p){
  for(const k of ['h','d','fc','fy','as','spacing','mu','vu'])if(!Number.isFinite(p[k]))throw Error('斷面複核欄位請填入完整數值。');
  if(!(p.h>0&&p.d>0&&p.d<p.h&&p.fc>=175&&p.fc<=700&&p.fy>0&&p.fy<=5600&&p.as>0&&p.spacing>0&&p.mu>=0&&p.vu>=0))throw Error('本模組限 175≤f′c≤700、0<fy≤5600 kgf/cm²、0<d<h，鋼筋及間距須大於零，需求須非負。');
  const b=100,beta=Math.max(.65,Math.min(.85,.85-.05*(p.fc-280)/70)),ey=p.fy/Es;
  // Solve C=T with steel stress capped by yield; never presume yielding.
  let lo=1e-8,hi=p.d;
  for(let i=0;i<100;i++){const c=(lo+hi)/2,et=.003*(p.d-c)/c,fs=Math.min(p.fy,Es*et);if(.85*p.fc*b*beta*c>p.as*fs)hi=c;else lo=c;}
  const c=(lo+hi)/2,a=beta*c,et=.003*(p.d-c)/c,fs=Math.min(p.fy,Es*et),phi=et>=ey+.003?.9:et<=ey?.65:.65+.25*(et-ey)/.003;
  const mn=p.as*fs*(p.d-a/2)/100000,capacity=phi*mn,tension=et>=ey+.003,amin=.0018*b*p.h;
  const rho=p.as/(b*p.d),lambdaS=Math.min(1,Math.sqrt(2/(1+p.d/25))),vcRaw=2.12*lambdaS*Math.cbrt(rho)*Math.sqrt(p.fc),vcLimit=1.33*Math.sqrt(p.fc),vc=Math.max(0,Math.min(vcRaw,vcLimit)),Vc=vc*b*p.d/1000,phiVc=.75*Vc;
  const smax=Math.min(p.system==='one'?3*p.h:2*p.h,45),flexPass=tension&&capacity>=p.mu,minPass=p.as>=amin,spacingPass=p.spacing<=smax,shearPass=phiVc>=p.vu;
  return {...p,b,beta,ey,c,a,et,fs,phi,mn,capacity,tension,amin,rho,lambdaS,vcRaw,vcLimit,vc,Vc,phiVc,smax,flexPass,minPass,spacingPass,shearPass,pass:flexPass&&minPass&&spacingPass&&shearPass};
 }
 return {section};
})();
if(typeof module!=='undefined')module.exports=SlabModern;
