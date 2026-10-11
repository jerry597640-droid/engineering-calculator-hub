"""Independent method: equilibrium + exact deformation compatibility.
No finite element stiffness, Hermite functions, or JS implementation is reused.
Distributed load deformation is integrated with scipy.quad.
"""
import json
from pathlib import Path
import numpy as np
from scipy.integrate import quad

root = Path(__file__).resolve().parent
fixtures = json.loads((root/'fixtures.json').read_text())
max_errors = dict(reaction=0.0, couple=0.0, deflection_m=0.0, rotation_rad=0.0)
checks = 0

def integral_load(loads, x, order):
    val = 0.0
    factorial = {0:1, 1:1, 2:2, 3:6}[order]
    for l in loads:
        if l['type']=='point':
            if x > l['x']:
                val -= l['value']*(x-l['x'])**order/factorial
        elif l['type']=='moment':
            if x > l['x'] and order>=1:
                val -= l['value']*(x-l['x'])**(order-1)/{1:1,2:1,3:2}[order]
        elif x>l['a']:
            a,b=l['a'],min(x,l['b'])
            def func(t):
                q=l['q0']+(l['q1']-l['q0'])*(t-l['a'])/(l['b']-l['a'])
                return -q*(x-t)**order/factorial
            val += quad(func,a,b,epsabs=1e-10,epsrel=1e-11)[0]
    return val

for case in fixtures:
    m,s=case['model'],case['solution']
    supports=m['supports']
    # Unknown vector: every vertical reaction, every fixed-end couple, y0, theta0.
    variables=[('R',r['x'],i) for i,r in enumerate(supports)]
    variables += [('C',r['x'],i) for i,r in enumerate(supports) if r['type']=='fixed']
    nr=len(variables)
    size=nr+2
    EI=m['E']*m['I']*1e-5
    loads=[]
    for original in m['loads']:
        l=original.copy()
        f=m['factors'][l['group']]
        for key in ['value','q0','q1']:
            if key in l:l[key]*=f
        loads.append(l)
    rows=[];rhs=[]
    # Vertical force and moment equilibrium about global x=0.
    rows.append([1 if t=='R' else 0 for t,x,i in variables]+[0,0])
    rows.append([x if t=='R' else 1 for t,x,i in variables]+[0,0])
    total_force=0;total_moment=0
    for l in loads:
        if l['type']=='point':total_force+=l['value'];total_moment+=l['value']*l['x']
        elif l['type']=='moment':total_moment-=l['value']
        else:
            q=lambda x: l['q0']+(l['q1']-l['q0'])*(x-l['a'])/(l['b']-l['a'])
            total_force+=quad(q,l['a'],l['b'],epsabs=1e-10)[0]
            total_moment+=quad(lambda x:q(x)*x,l['a'],l['b'],epsabs=1e-10)[0]
    rhs += [total_force,total_moment]
    for r in supports:
        x=r['x']
        row=[max(x-xa,0)**3/(6*EI) if t=='R' else -max(x-xa,0)**2/(2*EI) for t,xa,i in variables]
        rows.append(row+[1,x]);rhs.append(-r['settlement']/1000-integral_load(loads,x,3)/EI)
        if r['type']=='fixed':
            row=[max(x-xa,0)**2/(2*EI) if t=='R' else -max(x-xa,0)/EI for t,xa,i in variables]
            rows.append(row+[0,1]);rhs.append(-integral_load(loads,x,2)/EI)
    independent=np.linalg.solve(np.array(rows),np.array(rhs))
    for j,(kind,x,i) in enumerate(variables):
        actual=s['reactions'][i][kind]
        delta=abs(actual-independent[j]);max_errors['reaction' if kind=='R' else 'couple']=max(max_errors['reaction' if kind=='R' else 'couple'],delta)
        np.testing.assert_allclose(actual,independent[j],rtol=2e-8,atol=2e-7);checks+=1
    for station in case['at']:
        x=station['x']
        y=independent[-2]+independent[-1]*x+integral_load(loads,x,3)/EI
        theta=independent[-1]+integral_load(loads,x,2)/EI
        for j,(kind,xa,i) in enumerate(variables):
            t=max(x-xa,0)
            y+=independent[j]*(t**3/6 if kind=='R' else -t**2/2)/EI
            theta+=independent[j]*(t**2/2 if kind=='R' else -t)/EI
        dy=abs(y-station['y']);dt=abs(theta-station['theta'])
        max_errors['deflection_m']=max(max_errors['deflection_m'],dy);max_errors['rotation_rad']=max(max_errors['rotation_rad'],dt)
        np.testing.assert_allclose(station['y'],y,rtol=2e-8,atol=2e-9)
        np.testing.assert_allclose(station['theta'],theta,rtol=2e-8,atol=2e-9);checks+=2

report={'status':'passed','method':'Equilibrium and deformation compatibility; SciPy quadrature; no FEM reuse','cases':len(fixtures),'comparisons':checks,'max_absolute_errors':max_errors}
(root/'independent-validation.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
