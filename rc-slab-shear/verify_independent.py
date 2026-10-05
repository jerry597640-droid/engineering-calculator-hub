import math,json
from pathlib import Path
# Independent calculations: directly use code equations in kgf/cm native units.
def one(h=20,fc=280,b=100,As=1.267*100/15,d=20-2-1.27/2,Nu=0,lam=1,Dextra=.3,L=.3,span=4,eligible=True,support='simple'):
 S=min(math.sqrt(fc),26.5);ls=min(1,math.sqrt(50/(25+d)));rho=As/(b*d)
 sig=min(Nu*1000/(6*b*h),.05*fc)
 Vc=max(0,min((2.12*ls*lam*rho**(1/3)*S+sig)*b*d,1.33*lam*S*b*d))
 qu=max(1.4*(h/100*2.4+Dextra),1.2*(h/100*2.4+Dextra)+1.6*L)
 demand=qu*b/100*(span/(2 if support=='simple' else 1)-(d/100 if eligible else 0))
 return dict(d=d,As=As,ls=ls,Vc=Vc,capacity=.75*Vc/1000,demand=demand)
def punch(h=25,dx=22,dy=20.4,cx=40,cy=40,Vu=45,Mx=0,My=0,pos='interior',fc=280,Ru=None,qu=1.56,stress=None):
 d=(dx+dy)/2;S=min(math.sqrt(fc),26.5);ls=min(1,math.sqrt(50/(25+d)))
 a=cx+d if pos=='interior' else cx+d/2;b=cy+d/2 if pos=='corner' else cy+d
 b0=2*(a+b) if pos=='interior' else 2*a+b if pos=='edge' else a+b
 alpha={'interior':40,'edge':30,'corner':20}[pos];beta=max(cx,cy)/min(cx,cy)
 v1=1.06*ls*S;v2=.53*(1+2/beta)*ls*S;v3=.265*(2+alpha*d/b0)*ls*S;vc=min(v1,v2,v3)
 net=Vu if Ru is None else Ru-qu*a*b/10000
 Jy=d*a**3/6+a*d**3/6+d*b*a*a/2;Jx=d*b**3/6+b*d**3/6+d*a*b*b/2
 gx=1-1/(1+2/3*math.sqrt(b/a));gy=1-1/(1+2/3*math.sqrt(a/b))
 v=net*1000/(b0*d)+gx*abs(Mx)*100000*b/2/Jx+gy*abs(My)*100000*a/2/Jy
 return dict(d=d,ls=ls,b0=b0,vc=vc,capacity=.75*vc,demand=v if stress is None else stress,net=net,Jx=Jx,Jy=Jy)
cases=[]
def add(name,mode,state,expected=None,error=False):cases.append(dict(name=name,mode=mode,state=state,expected=expected or {},error=error))
add('A 簡支樓版','one',{},one())
add('A 支承面不折減','one',{'eligible':False},one(eligible=False))
add('懸臂樓版','one',{'support':'cantilever'},one(support='cantilever'))
add('厚版尺寸效應','one',{'h':60,'dmode':'manual','dmanual':55,'asmode':'manual','Asmanual':20},one(h=60,d=55,As=20))
add('軸壓貢獻上限','one',{'Nu':1000},one(Nu=1000))
add('軸拉使 Vc 取零','one',{'Nu':-200},one(Nu=-200))
add('高強混凝土開根號上限','one',{'fc':1000},one(fc=1000))
add('B 內柱沖切','punch',{'h':25,'dx':22,'dy':20.4},punch())
add('內柱雙軸彎矩','punch',{'h':25,'dx':22,'dy':20.4,'Mx':12,'My':-8},punch(Mx=12,My=-8))
add('矩形長柱 β 控制','punch',{'h':25,'dx':22,'dy':20.4,'cy':160},punch(cy=160))
add('大支承面周界控制','punch',{'h':25,'dx':22,'dy':20.4,'cx':300,'cy':300},punch(cx=300,cy=300))
add('厚版沖切尺寸效應','punch',{'h':60,'dx':55,'dy':53},punch(h=60,dx=55,dy=53))
add('邊柱完整 vu 輸入','punch',{'h':25,'dx':22,'dy':20.4,'position':'edge','stressmode':'direct','vmax':18},punch(pos='edge',stress=18))
add('角柱完整 vu 輸入','punch',{'h':25,'dx':22,'dy':20.4,'position':'corner','stressmode':'direct','vmax':24},punch(pos='corner',stress=24))
add('同組合 Ru 與 qu','punch',{'h':25,'dx':22,'dy':20.4,'punchmode':'reaction','Ru':46,'pqu':1.2},punch(Ru=46,qu=1.2))
add('零間距停止','one',{'spacing':0},error=True)
add('d 大於 h 停止','one',{'dmode':'manual','dmanual':25},error=True)
add('缺少邊柱完整應力停止','punch',{'position':'edge'},error=True)
add('特殊幾何停止','punch',{'special':True},error=True)
add('反力不足停止','punch',{'punchmode':'reaction','Ru':0},error=True)
add('最大應力小於平均停止','punch',{'stressmode':'direct','vmax':.01},error=True)
p=Path(__file__).resolve().parent
import re
s=re.sub(r'const BENCHMARKS=.*?; // generated independently below', 'const BENCHMARKS='+json.dumps(cases,ensure_ascii=False,separators=(',',':'))+'; // generated independently below', p.joinpath('index.html').read_text())
p.joinpath('index.html').write_text(s)
p.joinpath('verification.json').write_text(json.dumps(cases,ensure_ascii=False,indent=2))
print(json.dumps({'A':one(),'B':punch(),'moment':punch(Mx=12,My=-8),'tests':len(cases)},indent=2))
