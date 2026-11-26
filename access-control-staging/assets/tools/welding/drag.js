const WeldDrag={
 move(segment,mode,dx,dy,step=0){
  const round=v=>Math.round(v*1e6)/1e6;
  const snap=v=>round(step>0?Math.round(v/step)*step:v);
  const a=segment.slice();
  if(mode==='line'){dx=snap(dx);dy=snap(dy);return a.map((v,i)=>round(v+(i%2?dy:dx)));}
  const k=mode==='start'?0:2;a[k]=snap(a[k]+dx);a[k+1]=snap(a[k+1]+dy);return a;
 }
};
if(typeof module!=='undefined')module.exports=WeldDrag;
