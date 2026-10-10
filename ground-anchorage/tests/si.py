# Independent check in N, mm, MPa. Do not call the JS calculation engine.
import math,json
T=63500*9.80665/math.cos(math.radians(20))
ground=math.pi*230*9150*(5*0.0980665)
grout=7*math.pi*12.7*9150*(11*0.0980665)
steel=7*98.7*(19000*0.0980665)*0.6
delta=T*8000/(7*98.7*(1950000*0.0980665))
json.dump({'T_kN':T/1000,'ground_kN':ground/1000,'grout_kN':grout/1000,'steel_kN':steel/1000,'delta_mm':delta},open('tests/si-results.json','w'),indent=2)
