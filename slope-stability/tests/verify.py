"""Independent numeric checks. Python/scipy used only for development validation."""
import json, math, subprocess
from pathlib import Path
import numpy as np
from scipy.optimize import brentq
ROOT=Path(__file__).resolve().parents[1]
script=r'''
const fs=require('fs'),C=require('./engine.js');
const m=JSON.parse(fs.readFileSync('example-project.json')).model;
const basic=C.run(m),normal=basic.results[0].best.circle;
const runs=[basic];
const fine=structuredClone(m);fine.slices=120;fine.density=20;runs.push(C.run(fine));
const fixed=structuredClone(m);fixed.mode='manual';fixed.circle=normal;
runs.push(C.run(fixed));
const layers=structuredClone(fixed);layers.layers=[{name:'上層',bottom:4,c:8,phi:28,gamma:18,sat:20},{name:'下層',bottom:-20,c:22,phi:32,gamma:19,sat:21}];runs.push(C.run(layers));
const line=structuredClone(fixed);line.waterMode='line';line.waterLine=m.ground.map(p=>[p[0],p[1]-4]);line.rainLine=m.ground; runs.push(C.run(line));
const translated=structuredClone(fixed);translated.ground=translated.ground.map(p=>[p[0]+1000,p[1]+1000]);translated.circle.cx+=1000;translated.circle.cy+=1000;translated.layers.forEach(l=>l.bottom+=1000);translated.qa+=1000;translated.qb+=1000;runs.push(C.run(translated));
const ordinary=structuredClone(fixed);ordinary.method='ordinary';runs.push(C.run(ordinary));
const zero=structuredClone(fixed);zero.waterMode='dry';zero.layers.forEach(l=>{l.c=0;l.phi=0;});runs.push(C.run(zero));
const noeq=structuredClone(fixed);noeq.kh=noeq.kv=0;runs.push(C.run(noeq));
const dry=structuredClone(fixed);dry.waterMode='dry';runs.push(C.run(dry));
const q=structuredClone(dry);q.q=0;runs.push(C.run(q));
const invalid=[];for(const update of [a=>a.layers[0].sat=1,a=>a.ground.reverse(),a=>a.q=-1,a=>a.kh=NaN,a=>a.slices=0,a=>{a.profile='custom';a.customSource='';}]){const a=structuredClone(m);update(a);try{C.run(a);invalid.push(false);}catch{invalid.push(true);}}
const none=structuredClone(fixed);none.circle={cx:200,cy:200,r:1};const nor=C.run(none);
console.log(JSON.stringify({runs,bench:C.benchmarks(),invalid,none:nor}));
'''
data=json.loads(subprocess.check_output(['node','-e',script],cwd=ROOT,text=True))
checks=[]
def check(name,ok,detail):
    checks.append({'name':name,'pass':bool(ok),'detail':detail})
# Scalar root solving differs from JS fixed-point iteration.
maxerr=0
for run in data['runs'][:7]+data['runs'][8:]:
    for result in run['results']:
        b=result['best']; ss=b['rows']; kh=run['model']['kh'] if result['scenario']=='seismic' else 0; kv=b['kv']; D=sum(((1-kv)*s['W']+s['Q'])*math.sin(s['alpha'])+kh*s['W']*(b['circle']['cy']-s['yg'])/b['circle']['r'] for s in ss)
        if run['model']['method']=='ordinary':
            F=sum(s['c']*s['l']+(((1-kv)*s['W']+s['Q'])*math.cos(s['alpha'])-kh*s['W']*math.sin(s['alpha'])-s['u']*s['l'])*math.tan(math.radians(s['phi'])) for s in ss)/D
        else:
            def func(F):
                return sum((s['c']*s['b']+((1-kv)*s['W']+s['Q']-s['u']*s['b'])*math.tan(math.radians(s['phi'])))/(math.cos(s['alpha'])+math.sin(s['alpha'])*math.tan(math.radians(s['phi']))/F) for s in ss)-F*D
            samples=np.geomspace(.1,20,500);roots=[]
            for a,z in zip(samples[:-1],samples[1:]):
                if min(math.cos(s['alpha'])+math.sin(s['alpha'])*math.tan(math.radians(s['phi']))/a for s in ss)<.2:continue
                if func(a)*func(z)<0:roots.append(brentq(func,a,z,xtol=1e-13))
            assert roots
            F=min(roots,key=lambda z:abs(z-b['fs']))
        maxerr=max(maxerr,abs(F-b['fs']))
check('Independent scipy scalar-root and ordinary equations',maxerr<2e-7,{'maxAbsoluteFSerror':maxerr,'cases':30})
# Full-geometry midpoint integration, not JS Gauss sums, including horizontal layers and saturated weight.
weightmax=0;momentmax=0
for ri in [0,3]:
 for result in data['runs'][ri]['results']:
    b=result['best'];m=data['runs'][ri]['model'];c=b['circle'];N=200000;x=c['a']+(np.arange(N)+.5)*(c['b']-c['a'])/N;g=np.interp(x,*np.array(m['ground']).T);base=c['cy']-np.sqrt(c['r']**2-(x-c['cx'])**2);water=g-(m['waterRain'] if result['scenario']=='rain' else m['waterNormal']);W=np.zeros(N);M=np.zeros(N);top=np.full(N,np.inf)
    for l in m['layers']:
        lo=np.maximum(base,l['bottom']);hi=np.minimum(g,top);top[:]=l['bottom'];hi=np.maximum(hi,lo);split=np.minimum(hi,np.maximum(lo,water));dw1=(split-lo)*l['sat'];dw2=(hi-split)*l['gamma'];W+=dw1+dw2;M+=dw1*(split+lo)/2+dw2*(hi+split)/2
    dx=(c['b']-c['a'])/N;Wi=W.sum()*dx;Mi=M.sum()*dx;jsW=sum(s['W'] for s in b['rows']);jsM=sum(s['W']*s['yg'] for s in b['rows']);weightmax=max(weightmax,abs(jsW-Wi)/Wi);momentmax=max(momentmax,abs(jsM-Mi)/max(1,abs(Mi)))
check('Independent 200000-column geometry integration',weightmax<1e-4 and momentmax<1e-4,{'maxWeightRelativeError':weightmax,'maxFirstMomentRelativeError':momentmax})
base=[r['best']['fs'] for r in data['runs'][0]['results']];fine=[r['best']['fs'] for r in data['runs'][1]['results']];changes=[(z-a)/a for a,z in zip(base,fine)]
check('Search and slice refinement',max(abs(x) for x in changes)<.02,{'baseFS':base,'fineFS':fine,'relativeChanges':changes,'fineSlices':120,'fineDensity':20})
f1=[r['best']['fs'] for r in data['runs'][2]['results']];f2=[r['best']['fs'] for r in data['runs'][4]['results']];f3=[r['best']['fs'] for r in data['runs'][5]['results']]
check('Depth and identical piecewise water line',max(abs(a-z) for a,z in zip(f1,f2))<1e-10,{'depth':f1,'line':f2})
check('Coordinate translation invariance',max(abs(a-z) for a,z in zip(f1,f3))<1e-8,{'original':f1,'translated':f3})
check('Zero strength gives FS zero',all(r['best']['fs']==0 for r in data['runs'][7]['results']),{})
check('Zero seismic coefficients equal normal case',abs(data['runs'][8]['results'][0]['best']['fs']-data['runs'][8]['results'][2]['best']['fs'])<1e-12,{})
check('Invalid inputs rejected',all(data['invalid']),{'rejected':sum(data['invalid'])})
check('No intersecting circle produces no result',all(r['best'] is None for r in data['none']['results']),{})
for b in data['bench']:check(b['name'],b['pass'],{k:v for k,v in b.items() if k!='rows'})
check('Current water-soil targets',data['runs'][0]['results'][1]['target']==1.2 and data['runs'][0]['results'][2]['target']==1.1,{})
# Strength and weights consistency across every selected slice.
err=max(abs(sum(p['dW'] for p in s['weightParts'])-s['W']) for run in data['runs'] for r in run['results'] for s in r['best']['rows'])
check('Gauss audit entries sum to slice weight',err<1e-10,{'maxDifferenceKN':err})
foundation=subprocess.check_output(['node','-e',"const C=require('./engine.js'),m=JSON.parse(require('fs').readFileSync('example-project.json')).model;m.profile='foundation-global';console.log(JSON.stringify(C.run(m).results.map(r=>({target:r.target,strict:r.strict}))))"],cwd=ROOT,text=True)
check('Foundation 112 strict comparison',all(r['strict'] for r in json.loads(foundation)),json.loads(foundation))
report={'version':'1.1.0','checked':'2026-10-11','pass':all(c['pass'] for c in checks),'checks':checks,'scope':'Tests validate formulas and selected cases; not universal design certification.'}
(ROOT/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
(ROOT/'verification-detail.json').write_text(json.dumps(data['runs'][0],ensure_ascii=False))
print(json.dumps(report,ensure_ascii=False,indent=2))
if not report['pass']:raise SystemExit(1)
