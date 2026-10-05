"""Independent statics/numerical-integration verification. Python standard library only."""
import json, math, pathlib
ROOT=pathlib.Path(__file__).resolve().parent
data=json.loads((ROOT/'test-data.json').read_text())
count=0; max_v=0.; max_m=0.; failures=[]
def close(label,a,b,tol=1e-7):
 global count
 count+=1
 if abs(a-b)>tol*max(1,abs(b)):failures.append(dict(label=label,actual=a,expected=b))
def simpson(f,a,b,N=400):
 if b<=a:return 0.
 step=(b-a)/N
 return step/3*(f(a)+f(b)+sum((4 if i%2 else 2)*f(a+i*step) for i in range(1,N)))
for case in data:
 p=case['p'];name=case['name'];L=p['L'];x1=p['a1']+p['cx1']/200;x2=x1+p['spacing']
 if p['mode']=='strap':L=x2+p['cx2']/200+p['a2']
 close(name+' length',case['g']['L'],L)
 for m in case['models']:
  P=m['P'];fd=m['fD']
  if p['mode']!='strap':
   b2=p['b1'] if p['mode']=='rect' else p['b2']
   B=lambda x:p['b1']+(b2-p['b1'])*x/L
   A=simpson(B,0,L);xc=simpson(lambda x:x*B(x),0,L)/A
   I=simpson(lambda x:(x-xc)**2*B(x),0,L)
   q=lambda x:sum(P)/A+(P[0]*(x1-xc)+P[1]*(x2-xc))*(x-xc)/I
   intervals=[(0,L,lambda x:q(x)*B(x))]
   close(name+' area',case['g']['A'],A)
   close(name+' centroid',case['g']['xc'],xc)
   close(name+' inertia',case['g']['I'],I)
  else:
   lo=p['s1'];hi=L-p['s2'];gap=hi-lo
   weight=lambda x:fd*p['gamma']*p['bh']/100*(p['bw1']+(p['bw2']-p['bw1'])*(x-lo)/gap)
   W=simpson(weight,lo,hi);WX=simpson(lambda x:x*weight(x),lo,hi)
   z1=p['s1']/2;z2=L-p['s2']/2
   R2=(P[0]*x1+P[1]*x2+WX-(sum(P)+W)*z1)/(z2-z1);R1=sum(P)+W-R2
   intervals=[(0,lo,lambda x:R1/p['s1']),(lo,hi,lambda x:-weight(x)),(hi,L,lambda x:R2/p['s2'])]
   def q(x):return R1/(p['s1']*p['b1']) if x<lo else R2/(p['s2']*p['b2']) if x>hi else 0
   close(name+' beam self weight',m['beamW'],W)
  for v in m['values']:
   x=v['x'];up=sum(simpson(f,a,min(x,b)) for a,b,f in intervals if x>a)
   moment=sum(simpson(lambda t:f(t)*(x-t),a,min(x,b)) for a,b,f in intervals if x>a)
   V=up-sum(Pi for Pi,xi in zip(P,[x1,x2]) if xi<=x)
   M=moment-sum(Pi*max(0,x-xi) for Pi,xi in zip(P,[x1,x2]))
   close(name+' '+m['name']+' V',v['V'],V)
   close(name+' '+m['name']+' M',v['M'],M)
   close(name+' '+m['name']+' q',v['q'],q(x))
   max_v=max(max_v,abs(v['V']-V));max_m=max(max_m,abs(v['M']-M))
  close(name+' equilibrium V',m['balanceV'],0)
  close(name+' equilibrium M',m['balanceM'],0)
# Textbook closed form, intentionally independent of engine functions.
r=data[0];m=r['models'][1]
close('reference area',r['g']['A'],6*2.5)
close('reference soil pressure',r['checks'][0]['demand'],(60+30)*2/(6*2.5)+2.4*.65)
q=120*2/(6*2.5);d=65-7.5-2.22/2;dy=65-7.5-2.22-2.22/2;dp=(d+dy)/2
close('reference central moment',m['values'][3]['M'],None if False else q*2.5*m['values'][3]['x']**2/2-120*(m['values'][3]['x']-1))
close('reference one-way shear',r['checks'][3]['demand'],120-q*2.5*(1.25+d/100))
close('reference punching demand',r['punching'][0]['demand'],120-q*(.5+dp/100)**2)
close('reference punching perimeter',r['punching'][0]['b0'],4*(50+dp))
As=3.871*100/15;aa=As*4200/(.85*280*100)
close('reference flexural capacity',r['reinforcement'][0]['capacity'],.9*As*4200*(d-aa/2)/100000)
summary={'date':'2026-10-05','cases':len(data),'combinations':sum(len(c['models']) for c in data),'assertions':count,'failures':failures,'max_shear_error_tf':max_v,'max_moment_error_tfm':max_m,'method':'Independent Python Simpson integration (400 subintervals per piece), textbook closed form and full statics.'}
(ROOT/'validation.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
print(json.dumps(summary,ensure_ascii=False))
if failures:raise SystemExit(1)
