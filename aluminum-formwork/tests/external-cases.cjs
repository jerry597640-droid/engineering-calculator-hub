const A=require('../engine.js');
const cases=[];
for(const name of ['wall','column','smallBeam','largeBeam','beamSide','largeBeamSide','largeBeamSide55','slab','slab20','hydro']){
 for(const m of A.calculate(A.preset(name)).members){
  const input={spanLengths:m.lengths,E:m.E,I:m.I,ends:m.ends,q:m.loadMode==='uniform'?m.q:0,points:m.loadMode==='uniform'?[]:m.points};
  cases.push({name:name+'/'+m.id,input,expected:A.beam(input)});
 }
}
for(const ends of ['simple','fixed','fixed-left','fixed-right']){
 const input={spanLengths:[550,400,350],E:70000,I:15600,q:4.69,ends};
 cases.push({name:'unequal/'+ends,input,expected:A.beam(input)});
}
console.log(JSON.stringify(cases));
