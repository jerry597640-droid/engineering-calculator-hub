const bars=[['#3',.7133],['#4',1.267],['#5',1.986],['#6',2.865],['#7',3.871],['#8',5.067],['#9',6.469],['#10',8.143],['#11',10.07],['#12',12.19],['#14',14.52]];
const diameters=[2.65,3.2,4,4.5,5,5.5,6,6.5,7,7.5,8,8.5,9,9.5,10,11,12,13,14,15,16];
const pairs=[[50,50],[75,75],[75,100],[75,150],[75,200],[75,250],[75,300],[100,100],[100,150],[100,200],[100,250],[100,300],[150,150],[150,200],[150,250],[150,300],[200,200],[200,250],[200,300],[250,250],[250,300],[300,300]];
let mode='forward',customSpecs=[],current=null,choices=[],toastTimer;
const f=(n,d=4)=>Number(n).toLocaleString('en-US',{maximumFractionDigits:d,minimumFractionDigits:0});
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const wireArea=d=>Math.PI*(d/20)**2;
function calculate(p){
 const fw=p.mode==='forward',fySource=fw?p.fyR:p.fyW,fyTarget=fw?p.fyW:p.fyR;
 const rho=p.minMode==='custom'?p.rho:fw?Math.max(.0018*4200/p.fyW,.0014):p.fyR<4200?.002:p.fyR===4200?.0018:Math.max(.0018*4200/p.fyR,.0014);
 const minLeft=rho*100,min=minLeft*p.thickness;
 const axes=['X','Y'].map(k=>{const ar=bars[p['r'+k]][1],aw=wireArea(p['d'+k]);const fromArea=fw?ar:aw,toArea=fw?aw:ar,fromSpacing=p[(fw?'rs':'ws')+k],toSpacing=p[(fw?'ws':'rs')+k];const sourceNumerator=fromArea*1000,source=sourceNumerator/fromSpacing,force=source*fySource,equivalent=force/fyTarget,required=Math.max(equivalent,min),targetNumerator=toArea*1000,provided=targetNumerator/toSpacing;return{k,fromArea,toArea,fromSpacing,toSpacing,source,equivalent,required,provided,maxSpacing:targetNumerator/required,ratio:provided/required,ok:provided>=required,control:min>equivalent?'最小配筋':'等值鋼量',trace:{ar,aw,wireRadiusCm:p['d'+k]/20,wireRadiusSquared:(p['d'+k]/20)**2,sourceNumerator,force,targetNumerator}};});
 return{rho,min,axes,fySource,fyTarget,ok:axes.every(a=>a.ok),trace:{input:{...p},minLeft,fw,rhoBranch:p.minMode==='custom'?'custom':fw?'wire':p.fyR<4200?'rebar-low':p.fyR===4200?'rebar-equal':'rebar-high'}};
}
function allowedPairs(p){if(p.dX!==p.dY||!diameters.includes(p.dX))return pairs;const d=p.dX;return d<=3.2?pairs.slice(0,17):d<=8?pairs:d<=12?pairs.slice(1):pairs.slice(7);}
function candidates(p,r){return allowedPairs(p).filter(([x,y])=>wireArea(p.dX)*1000/x>=r.axes[0].required&&wireArea(p.dY)*1000/y>=r.axes[1].required).map(([x,y])=>({x,y,ax:wireArea(p.dX)*1000/x,ay:wireArea(p.dY)*1000/y})).sort((a,b)=>(a.ax+a.ay)-(b.ax+b.ay));}

if(typeof module!=="undefined")module.exports={bars,diameters,pairs,wireArea,calculate,allowedPairs,candidates};
