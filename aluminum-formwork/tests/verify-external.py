"""Independent elastic-beam oracle; never used by the offline application."""
import json, subprocess, math, hashlib
from pathlib import Path
from importlib.metadata import version
from Pynite import FEModel3D
ROOT=Path(__file__).resolve().parent
assert version('PyniteFEA')=='3.2.0'
cases=json.loads(subprocess.check_output(['node',str(ROOT/'external-cases.cjs')],text=True))
results=[]
for case in cases:
 p=case['input']; expected=case['expected']; model=FEModel3D()
 model.add_material('mat',p['E'],p['E']/2.6,0.3,0)
 model.add_section('sec',100,p['I'],p['I'],100)
 xs=[0]
 for L in p['spanLengths']:xs.append(xs[-1]+L)
 for i,x in enumerate(xs):
  node='N'+str(i);model.add_node(node,x,0,0)
  fixed=(i==0 and p['ends'] in ['fixed','fixed-left']) or (i==len(xs)-1 and p['ends'] in ['fixed','fixed-right'])
  model.def_support(node,True,True,True,True,True,fixed)
 for i,L in enumerate(p['spanLengths']):
  member='M'+str(i);model.add_member(member,'N'+str(i),'N'+str(i+1),'mat','sec')
  if p['q']:model.add_member_dist_load(member,'Fy',-p['q'],-p['q'])
 for point in p.get('points',[]):
  x=point['x'];idx=next((i for i,v in enumerate(xs) if abs(v-x)<1e-8),None)
  if idx is not None:model.add_node_load('N'+str(idx),'FY',-point['P'])
  else:
   i=next(i for i in range(len(xs)-1) if xs[i]<x<xs[i+1])
   model.add_member_pt_load('M'+str(i),'Fy',-point['P'],x-xs[i])
 model.analyze_linear()
 errors={'reaction':0.,'moment':0.,'deflection':0.}
 def check(metric,a,b,scale):
  error=abs(a-b)/max(scale,1e-9);errors[metric]=max(errors[metric],error)
  assert math.isfinite(error) and error<1e-6,(case['name'],metric,a,b,error)
 for i,r in enumerate(expected['reactions']):check('reaction',model.nodes['N'+str(i)].RxnFY['Combo 1'],r['R'],max(abs(v['R']) for v in expected['reactions']))
 for sample in expected['samples']:
  i=sample['span'];x=max(0,min(p['spanLengths'][i],sample['x']-xs[i]));m=model.members['M'+str(i)]
  check('deflection',-m.deflection('dy',x),sample['y'],expected['deflection'])
  check('moment',abs(m.moment('Mz',x)),abs(sample['M']),expected['Mmax'])
 results.append({'name':case['name'],'status':'passed','max_normalized_error':errors,'sample_count':len(expected['samples'])})
report={'engine':'PyniteFEA','version':version('PyniteFEA'),'source':'https://github.com/JWock82/Pynite','license':'MIT','engine_sha256':hashlib.sha256((ROOT.parent/'engine.js').read_bytes()).hexdigest(),'scope':'Linear Euler-Bernoulli beams only; not pressure, material allowable stress, buckling, connections or code certification.','relative_tolerance':1e-6,'count':len(results),'results':results}
(ROOT/'external-validation.json').write_text(json.dumps(report,indent=2)+'\n')
print(f"{len(results)} independent Pynite model comparisons passed.")
