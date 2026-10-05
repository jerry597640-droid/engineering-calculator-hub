"""Independent slice-integration benchmark: no reuse of JS functions."""
import math,json
h=80.;b=50.;fc=280.;fy=4200.;Es=2100000.;A=8.143
ys=[8,8,14,14,66,66,72,72];step=.001
areas=[0.];moments=[0.]
for j in range(int(h/step)):
 y=(j+.5)*step; width=b
 if 15<=y<16.6 or 63.4<=y<65:width-=20
 elif 16.6<=y<63.4:width-=1
 radius=math.sqrt(A/math.pi)
 for yb in ys:
  if abs(y-yb)<radius:width-=2*math.sqrt(radius*radius-(y-yb)**2)
 areas.append(areas[-1]+width*step);moments.append(moments[-1]+width*y*step)
def interp(vals,a):
 n=min(len(vals)-2,int(a/step));u=a/step-n;return vals[n]*(1-u)+vals[n+1]*u
def state(c):
 a=.85*c; forces=[A*max(-fy,min(fy,Es*.003*(c-y)/c)) for y in ys]
 return .85*fc*interp(areas,a)+sum(forces),(.85*fc*interp(moments,a)+sum(F*y for F,y in zip(forces,ys)))
lo=1e-4;hi=80
for k in range(80):
 c=(lo+hi)/2
 if state(c)[0]>0:hi=c
 else:lo=c
c=(lo+hi)/2;Mr=abs(state(c)[1])/1e5
# Analytic separate geometry and shear calculations.
Z=2*(20*1.6)*24.2+2*(1*23.4)*11.7
Ms=Z*3500/1e5;Mn=Ms+Mr;d=69
Vs=.6*3500*(1*50)/1000;Vc=.53*math.sqrt(280)*50*d/1000
Vr=2.534*2800*d/15/1000;fr=.8*2.534*2800*d/15/1000+28*(50-20)*d/1000
ref={'c':c,'Mr':Mr,'Ms':Ms,'capacity':.9*Mn,'Z':Z,'Vs':Vs,'Vc':Vc,'Vr':Vr,'friction':fr,'alpha':Ms/Mn,'rcShearCapacity':.75*min(Vr+Vc,fr)}
open('src-beam/independent-reference.json','w').write(json.dumps(ref,indent=2))
print(json.dumps(ref,indent=2))
