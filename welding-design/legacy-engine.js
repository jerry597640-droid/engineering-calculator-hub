/* Same original cws() computation, now exposes its actual table interpolation. */
const LegacyEngine={analyze(p){
 const {type,L,K,e,pv,ph,F}=p;
 if(![type,L,K,e,pv,ph,F].every(Number.isFinite)||!Number.isInteger(type)||type<1||type>9||![60,70,80,90,100,110].includes(F)||L<=0||K<0||e<0||pv<0||ph<0)throw Error('原查表限九型、有效焊材與正向 Pv、Ph，L > 0，K、e ≥ 0');
 let k=type===2?0:K/L,x=type===6||type===7?K*K/(2*K+L):type===8||type===9?K*K/(2*(K+L)):0,a=(e+([7,9].includes(type)?x:[6,8].includes(type)?-x:0))/L,kk=LEGACY.kk.slice(0,[4,5].includes(type)?11:16),aa=LEGACY.aa;
 if(k<kk[0]||k>kk.at(-1)||a<aa[0]||a>aa.at(-1))throw Error('超出原始查表範圍，已禁止外插。有效 a='+a+'；k='+k);
 const bracket=(arr,v)=>arr.findIndex((x,i)=>i<arr.length-1&&v>=x&&v<=arr[i+1]);
 let i=bracket(aa,a),j=bracket(kk,k),u=(a-aa[i])/(aa[i+1]-aa[i]),v=(k-kk[j])/(kk[j+1]-kk[j]),tab=LEGACY.tables[type-1],C=(1-u)*((1-v)*tab[i][j]+v*tab[i][j+1])+u*((1-v)*tab[i+1][j]+v*tab[i+1][j+1]);if(!(C>0))throw Error('該格係數缺漏');
 let P=Math.hypot(pv,ph)*2.2046,theta=Math.atan2(ph,pv),cmx=.928*(type<=3?2:type<=5?2+2*k:type<=7?1+2*k:1+k),AA=Math.max(1,cmx/C),Ca=C*Math.max(1,AA/(Math.sin(theta)+AA*Math.cos(theta))),C1=({60:.857,70:1,80:1.14,90:1.29,100:1.43,110:1.57})[F],D=P/(Ca*C1*L*.3937)*25.4/16;
 return {p:structuredClone(p),a,k,C,Ca,D,trace:{i,j,u,v,x,P,theta,cmx,AA,C1,corners:[tab[i][j],tab[i][j+1],tab[i+1][j],tab[i+1][j+1]],weights:[(1-u)*(1-v),(1-u)*v,u*(1-v),u*v],aRows:[aa[i],aa[i+1]],kCols:[kk[j],kk[j+1]],kk,aa,tab,denominator:Ca*C1*L*.3937}};
}};
if(typeof module!=='undefined')module.exports=LegacyEngine;
