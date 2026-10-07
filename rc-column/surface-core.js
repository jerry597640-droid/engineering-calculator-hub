/* Fixed design-axial-load contours using the existing RC strain-compatibility engine. */
const RCSurface=(()=>{
 function key(s,levels,angles){return JSON.stringify([s.b,s.h,s.fc,s.fy,s.Es,s.betaOverride??null,s.layout||'uniform',s.layout==='custom'?s.customBars.map(r=>[r.bar,r.n,r.x1,r.y1,r.x2,r.y2]):[s.cover,s.tie,s.bar,s.nx,s.ny],levels,angles]);}
 function* generate(R,s,{levels=28,angles=60}={}){
  const errors=R.validate(s);if(errors.length)throw Error(errors.join('；'));
  if(!Number.isInteger(levels)||levels<4||levels>80||!Number.isInteger(angles)||angles<12||angles>180)throw Error('3D取樣設定超出範圍');
  const g=R.geometry(s),P0=(.85*s.fc*(g.Ag-g.Ast)+s.fy*g.Ast)/1000,Pmax=.52*P0,Tmax=.9*s.fy*g.Ast/1000;
  const pole={P:-Tmax,mx:-.9*s.fy*g.Ast*g.cy/100000,my:-.9*s.fy*g.Ast*g.cx/100000,phi:.9,theta:0},rings=[];
  for(let j=0;j<=levels;j++){
   const P=j===0?-Tmax:j===levels?Pmax:-Tmax+(Pmax+Tmax)*j/levels,ring=[];
   for(let i=0;i<angles;i++){
    if(j===0)ring.push({...pole,theta:2*Math.PI*i/angles});
    else{const v=R.capacityAtP(s,g,2*Math.PI*i/angles,P);if(!v||![v.mx,v.my,v.dp].every(Number.isFinite))throw Error('3D容量邊界求解未收斂；停止繪圖以避免顯示不完整曲面');ring.push({P,mx:v.mx,my:v.my,phi:v.phi,theta:v.theta});}
    if(i%6===5)yield {progress:(j*angles+i+1)/((levels+1)*angles),complete:false};
   }
   rings.push(ring);
  }
  return {rings,P0,Pmax,Tmax,pole,levels,angles,key:key(s,levels,angles),points:rings.flat().length};
 }
 function build(R,s,options){const job=generate(R,s,options);let q;do{q=job.next()}while(!q.done);return q.value;}
 return {key,generate,build};
})();
if(typeof module!=='undefined')module.exports=RCSurface;
