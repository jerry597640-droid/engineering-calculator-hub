const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),WeldDrag=require('./drag.js'),WeldEngine=require('./engine.js');
assert.deepEqual(WeldDrag.move([0,0,0,30],'end',4,5,.1),[0,0,4,35]);
assert.deepEqual(WeldDrag.move([0,0,0,30],'line',4.04,5.06,.1),[4,5.1,4,35.1]);
const diagonal=[.13,.27,8.81,4.12],m=WeldDrag.move(diagonal,'line',3.14,-7.83,.5);assert(Math.abs(Math.hypot(m[2]-m[0],m[3]-m[1])-Math.hypot(diagonal[2]-diagonal[0],diagonal[3]-diagonal[1]))<1e-9);
let rows=[[0,0,0,30],[20,0,20,30]],calls=0;
const nodes={diagram:{innerHTML:'',addEventListener(t,fn){this[t]=fn},setPointerCapture(){},hasPointerCapture(){return false},getScreenCTM(){return{inverse(){return{}}}}},'drag-step':{value:'.1'},'drag-info':{},'undo-drag':{},circle:{value:'0'},L:{value:'30'}};
nodes.seg={get rows(){return rows.map(a=>({querySelectorAll(){return a.map((v,i)=>({get value(){return a[i]},set value(x){a[i]=x}}));}}));}};
const $=id=>nodes[id]??={};const app=fs.readFileSync(require('path').join(__dirname,'app.js'),'utf8');const ctx=vm.createContext({$,WeldDrag,dragSession:null,diagramView:{scale:10},undoGeometry:null,DOMPoint:class{constructor(x,y){this.x=x;this.y=y}matrixTransform(){return this}},data:()=>rows.map(a=>a.slice()),row(t,a){rows.push(a)},fmt:v=>v.toFixed(2),calculate(){calls++},restoreGeometry(g){rows=g.seg.map(a=>a.slice());calls++}});
// Execute actual handler code; restore uses test state to verify undo/cancel semantics.
const start=app.indexOf("function diagramPoint(e)");vm.runInContext(app.slice(start),ctx);ctx.geometrySnapshot=()=>({seg:rows.map(a=>a.slice()),circle:Number(nodes.circle.value)});
const ev=(x,y,mode='end')=>({button:0,pointerId:1,clientX:x,clientY:y,preventDefault(){},target:{closest(){return{dataset:{seg:'0',mode}}}}});
nodes.diagram.pointerdown(ev(65,290));nodes.diagram.pointermove(ev(105,240));assert.deepEqual(rows[0],[0,0,4,35]);assert(calls>0);nodes.diagram.pointerup(ev(105,240));assert.equal(nodes['undo-drag'].disabled,false);nodes['undo-drag'].onclick();assert.deepEqual(rows[0],[0,0,0,30]);
nodes.diagram.pointerdown(ev(65,290,'line'));nodes.diagram.pointermove(ev(95,250,'line'));assert.deepEqual(rows[0],[3,4,3,34]);nodes.diagram.pointercancel(ev(95,250));assert.deepEqual(rows[0],[0,0,0,30]);
const s={basis:'TW',method:'ASD',F:70,w:6,t1:12,t2:12,endLoaded:true,seg:rows,loads:[[25,15,0,0,-10,0,0,0,0]]};const old=WeldEngine.analyze(s);rows[0]=WeldDrag.move(rows[0],'end',0,10);assert.notEqual(WeldEngine.analyze(s).ratio,old.ratio);assert.throws(()=>WeldEngine.analyze({...s,seg:[[0,0,0,0]]}));
console.log('Endpoint resize, rigid translation, snap, Y direction, pointer cancel, undo, live strength update, invalid geometry: PASS');
