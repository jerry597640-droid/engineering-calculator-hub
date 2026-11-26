// Form1.vb USD formulas; dead is additional load, slab self-weight is added automatically.
const BARS={3:[0.7133,71.3],4:[1.267,127],5:[1.986,198],6:[2.865,285],7:[3.871,387],8:[5.067,507],9:[6.469,647],10:[8.143,814],11:[10.1,1010]};
const DEFAULT={short:4,long:6,h:15,cover:3,fc:210,fy:2800,dead:.44,live:.2,dsl:0,dss:0,bar:3,spacing:[20,20,20,20,20,20]};
const cut=(x,n)=>Math.floor(x*10**n)/10**n;
function calculate(p){
  for(const k of ['short','long','h','cover','fc','fy','dead','live','dsl','dss','bar']) if(!Number.isFinite(p[k])) throw Error('請填入完整的有效數值。');
  if(p.short<=0||p.long<=0||p.short>p.long)throw Error('請設定 0 < 短跨 S ≤ 長跨 L；邊界條件不會隨輸入自動交換。');
  if(p.h<=0||p.cover<0||p.cover>=p.h||p.fc<=0||p.fy<=0||p.dead<0||p.live<0)throw Error('板厚與強度須大於零，保護層須小於板厚，載重不得為負值。');
  if(![0,1,2].includes(p.dsl)||![0,1,2].includes(p.dss)||!BARS[p.bar])throw Error('邊界或鋼筋號數無效。');
  if(!Array.isArray(p.spacing)||p.spacing.length!==6||p.spacing.some(s=>!Number.isFinite(s)||s<=0))throw Error('六處實配間距皆須大於零。');
  const {short:S,long:L,h,cover,fc,fy,dead,live,dsl,dss,bar}=p,d=h-cover,r=S/L,one=r<.5,selfWeight=h/100*2.4,totalDead=selfWeight+dead,wu=1.2*totalDead+1.6*live;
  if(d/100>=S)throw Error('有效深度已達短跨，超出本樓板模型適用幾何範圍。');
  const index=one?null:Math.max(1,Math.min(26,Math.floor(Math.floor(r*100)/2)-24));
  let c;
  if(one)c=dsl===2?[0,.033,.125,0,0,0]:dsl===0?[.11,0,.063,0,0,0]:[.11,.033,.08999999,0,0,0];
  else if(dsl+dss===0)c=[TABLE[1][index]/1000,0,TABLE[2][index]/1000,TABLE[1][26]/1000,0,TABLE[2][26]/1000];
  else if(dsl+dss===4)c=[0,TABLE[12][index]/1000,TABLE[13][index]/1000,0,TABLE[12][26]/1000,TABLE[13][26]/1000];
  else {const i=3+(dsl+dss-1)*3;c=[dsl===2?0:TABLE[i][index]/1000,dsl===0?0:TABLE[i+1][index]/1000,TABLE[i+2][index]/1000,dss===2?0:TABLE[i][26]/1000,dss===0?0:TABLE[i+1][26]/1000,TABLE[i+2][26]/1000];}
  const rho=fy<4200?.002:.0018,amin=rho*100*h,m1=fy/fc/.8499999;
  const rows=c.map((coef,i)=>{
    const mu=cut(coef*S*S*wu,3),m2=mu*1000/d**2/.9000001,disc=1-2*m2*m1/fy;
    const flex=disc<0?null:(1-Math.sqrt(disc))/m1*100*d;
    const req=one&&i>=3?amin:flex===null?null:flex>0?Math.max(flex,amin):0;
    const maxSpacing=one&&i>=3?45:cut(2*h,1);
    const suggested=req===null?null:req===0?null:Math.min(cut(BARS[bar][1]/req,1),maxSpacing);
    const provided=BARS[bar][0]*100/p.spacing[i];
    const active=req!==0;
    const pass=req!==null&&(!active||(provided>=req&&p.spacing[i]<=maxSpacing));
    return {coef,mu,disc,flex,req,maxSpacing,suggested,provided,spacing:p.spacing[i],active,pass};
  });
  const bts=((2-dsl)*L+(2-dss)*S)/(S+L)/2;
  const hmin=cut(one?S*100/[28,24,20][dsl]:Math.min(L*(800+.0712*fy)*100/(36000+5000*L/S*(1+bts)),L*(800+.0712*fy)*100/36000),2);
  const V=one?wu*(S/2-d/100)*L*(dsl===1?1.15:1):wu*((S-d/100)*(L-d/100)/2-(S-d/100)**2/4);
  const vu=cut(V/L/d*10/.8499999,2),vc=cut(.53*Math.sqrt(fc),2);
  const warnings=[];
  if(index===19&&dsl+dss===1&&dsl!==0)warnings.push('本次使用原表 S(4,19)=15，鄰欄為 26 與 25，疑似異常，已保留原值，請確認係數來源。');
  if(index===18&&dsl+dss===4)warnings.push('本次使用原表 S(13,18)=64，前後欄為 63 與 60，已保留原值。');
  if(fy>4200)warnings.push('fy > 4200：原碼最後覆寫最小配筋率為 0.0018，本版依實際執行結果。');
  return {p,d,r,one,index,selfWeight,totalDead,wu,amin,rho,bts,hmin,V,vu,vc,rows,warnings,thicknessPass:h>=hmin,shearPass:vu<=vc,pass:h>=hmin&&vu<=vc&&rows.every(x=>x.pass)};
}
