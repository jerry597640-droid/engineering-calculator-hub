import json, math
from pathlib import Path
import numpy as np
BASE=Path(__file__).resolve().parent
cases=json.loads((BASE/'check-cases.json').read_text())
tests=[]
def check(name,want,got,tol=1e-8):
    error=abs(want-got)/max(abs(want),1)
    tests.append(dict(name=name,expected=f'{want:.8f}',actual=f'{got:.8f}；相對差 {error:.3e}',pass_=bool(error<=tol)))
p=cases[0]['p'];r=cases[0]['r'];B,H,hs,bf,tw,tf=[p[k] for k in ['b','h','hs','bf','tw','tf']]
As=2*bf*tf+tw*(hs-2*tf);Ar=sum(v['A'] for v in p['bars']);Ac=B*H-As-Ar
check('鋼骨面積：板塊獨立手算',As,r['g']['As'])
check('混凝土淨面積：扣除鋼骨及主筋',Ac,r['g']['Ac'])
check('強軸慣性矩：平行軸定理',2*(bf*tf**3/12+bf*tf*(hs/2-tf/2)**2)+tw*(hs-2*tf)**3/12,r['g']['Ix'])
check('弱軸慣性矩：板塊幾何',2*tf*bf**3/12+(hs-2*tf)*tw**3/12,r['g']['Iy'])
for a in r['a']['axes']:
    x=a['axis']=='x';I=r['g']['Ix' if x else 'Iy'];Ig=r['g']['Igx' if x else 'Igy'];K=p['Kx' if x else 'Ky']
    reff=math.sqrt(I/As)+(.2 if x else .4)*math.sqrt(Ig/(B*H))
    lam=K*p['L']/(math.pi*reff)*math.sqrt(p['Fy']/p['Es'])
    Pns=(math.exp(-.419*lam**2) if lam<=1.5 else .877/lam**2)*p['Fy']*As/1000
    check(f'{a["axis"]} 軸有效迴轉半徑',reff,a['reff'])
    check(f'{a["axis"]} 軸鋼骨抗壓',Pns,a['Pns'])
    euler=.8*math.pi**2*(15000*math.sqrt(p['fc'])*Ig/5)/(K*p['L'])**2/1000
    check(f'{a["axis"]} 軸 RC Euler 上限',euler,a['euler'])
check('軸力分配：相對剛度獨立公式',p['Pu']*p['Es']*As/(p['Es']*As+.55*15000*math.sqrt(p['fc'])*Ac),r['Pus'])
check('分配軸力守恆',p['Pu'],r['Pus']+r['Purc'])
check('分配強軸彎矩守恆',p['Mx'],r['Mxs']+r['Mxr'])
check('分配弱軸彎矩守恆',p['My'],r['Mys']+r['Myr'])
# Independent area integration: no polygon clipping or circular segment formula from JS.
# Cartesian midpoint grid, 0.02 cm; integrates net concrete in strips to bound memory.
z=r['boundary'];theta=z['angle'];nx,ny=math.cos(theta),math.sin(theta);c=z['c'];beta=max(.65,min(.85,.85-.05*(p['fc']-280)/70));qmax=nx*B/2+ny*H/2; threshold=qmax-beta*c
dx=.02;xx=(np.arange(round(B/dx))+.5)*dx-B/2
A=Qx=Qy=0.
for j in range(round(H/dx)):
    y=-H/2+(j+.5)*dx
    active=(nx*xx+ny*y>=threshold)
    if abs(y)>hs/2-tf and abs(y)<hs/2: active&=(np.abs(xx)>bf/2)
    elif abs(y)<hs/2-tf: active&=(np.abs(xx)>tw/2)
    for bar in p['bars']:
        xb=bar['x']-B/2;yb=H/2-bar['y'];radius=math.sqrt(bar['A']/math.pi)
        if abs(y-yb)<radius:active&=((xx-xb)**2+(y-yb)**2>radius**2)
    A+=np.count_nonzero(active)*dx*dx;Qx+=xx[active].sum()*dx*dx;Qy+=np.count_nonzero(active)*y*dx*dx
P=.85*p['fc']*A;Mx=.85*p['fc']*Qy;My=.85*p['fc']*Qx
for bar in p['bars']:
    x=bar['x']-B/2;y=H/2-bar['y'];eps=.003*(1-(qmax-nx*x-ny*y)/c)
    F=bar['A']*max(-p['fy'],min(p['fy'],p['Es']*eps));P+=F;Mx+=F*y;My+=F*x
check('RC 雙向壓力區：0.02cm 獨立網格積分',A,z['con']['A'],.001)
check('RC 雙向軸力：獨立網格／逐筋力平衡',P/1000,z['P'],.001)
check('RC 雙向 Mx：獨立網格積分',Mx/1e5,z['Mx'],.001)
check('RC 雙向 My：獨立網格積分',My/1e5,z['My'],.001)
check('RC 折減軸力殘差',r['Purc'],.65*z['P'])
check('RC 抗彎邊界方向相容',r['Mxr']/r['Myr'],z['Mx']/z['My'],1e-7)
rr=cases[1]['r']; pp=cases[1]['p']
for i,d in enumerate(rr['demand']):
    ax='x' if i==0 else 'y'; Pe=rr['a']['axes'][i]['Pe'];B1=max(1,pp['Cm'+ax]/(1-pp['Pu']/Pe));B2=1/(1-pp['theta'+ax.upper()]);mu=B1*pp['Mnt'+ax]+B2*pp['Mlt'+ax]
    check(f'一階 {ax} 軸 B1/B2 放大彎矩',mu,d['M'])
for ax in cases[2]['r']['a']['axes']:
    check(f'長柱 {ax["axis"]} RC取Euler控制',ax['euler'],ax['Pnrc'])
beam=json.loads((BASE/'beam-result.json').read_text())
check('梁鋼骨抗彎：Z Fys',(.2*0+20*1.6*(50-1.6)+(50-3.2)**2/4)*3500/1e5,beam['pos']['Ms'])
check('梁鋼骨剪力：0.6Fyw tw hs',.6*3500*1*50/1000,beam['sp']['Vsteel'])
check('梁RC一般剪力：0.53√fc bd + AvFyh d/s',.53*math.sqrt(280)*50*69/1000+2.534*2800*69/15/1000,beam['sp']['normal'])
(BASE/'independent.json').write_text(json.dumps([{**{k:v for k,v in t.items() if k!='pass_'},'pass':t['pass_']} for t in tests],ensure_ascii=False,indent=2))
for t in tests: print(('PASS' if t['pass_'] else 'FAIL'),t['name'],t['actual'])
if not all(t['pass_'] for t in tests):raise SystemExit(1)
