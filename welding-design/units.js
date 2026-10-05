// UI loads are converted to canonical tf / tf·m before analysis or export.
const WeldUnits={
 output(unit){
  if(unit==='kgf')return{force:9.80665,moment:9806.65,line:9.80665,stress:0.0980665,forceUnit:'kg',momentUnit:'kg·m',lineUnit:'kg/mm',stressUnit:'kg/cm²'};
  if(unit==='tf')return{force:9806.65,moment:9806650,line:9806.65,stress:98.0665,forceUnit:'tf',momentUnit:'tf·m',lineUnit:'tf/mm',stressUnit:'tf/cm²'};
  if(unit==='N')return{force:1,moment:1,line:1,stress:1,forceUnit:'N',momentUnit:'N·mm',lineUnit:'N/mm',stressUnit:'MPa'};
  throw Error('結果單位無效');
 },
 factor(unit){if(unit==='tf')return 1;if(unit==='kgf')return 1000;throw Error('載重單位無效');},
 convertLoads(loads,from,to){const f=this.factor(to)/this.factor(from);return loads.map(a=>a.map((v,i)=>i<3?v:v*f));},
 restore(s){const unit=s.forceUnit||'tf',display=s.displayUnit||'tf';this.factor(unit);this.factor(display);this.output(s.outputUnit||'kgf');return{...s,forceUnit:'tf',displayUnit:display,loads:this.convertLoads(s.loads,unit,'tf')};}
};
if(typeof module!=='undefined')module.exports=WeldUnits;

