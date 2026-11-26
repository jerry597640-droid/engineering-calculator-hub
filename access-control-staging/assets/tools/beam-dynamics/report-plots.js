import {sectionOutline,evaluateSection} from './section-geometry.js';
// The print drawings have a fixed physical layout independent of the on-screen panes.
const width = 960;
const ink = '#213840';
const grid = '#d7e1e3';
const green = '#176b63';
const orange = '#a45316';

function graphic(height) {
  const canvas = document.createElement('canvas');
  canvas.width = width * 2;
  canvas.height = height * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('無法建立計算報告圖表。');
  ctx.scale(2, 2);
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, width, height);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  return {canvas, ctx};
}

function line(ctx, points, color, weight = 2, dash = []) {
  if (!points.length) return;
  ctx.save();
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = weight;
  ctx.setLineDash(dash);
  ctx.moveTo(...points[0]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(...points[i]);
  ctx.stroke();
  ctx.restore();
}

function label(ctx, value, x, y, align = 'left', size = 19, color = ink) {
  ctx.font = size + 'px "Noto Sans CJK TC","Microsoft JhengHei",sans-serif';
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(value, x, y);
}

function num(value) {
  if (!value) return '0';
  if (Math.abs(value) >= 1e6 || Math.abs(value) < 0.001) return value.toExponential(2);
  return String(Number(value.toPrecision(4)));
}

async function figure(canvas, title, description) {
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(bytes => bytes ? resolve(bytes) : reject(new Error('無法輸出圖表 PNG。')), 'image/png');
  });
  return {type: 'figure', title, description, png: new Uint8Array(await blob.arrayBuffer())};
}

function arrow(ctx, x1, y1, x2, y2, color, weight = 2.5, head = 8) {
  const angle = Math.atan2(y2-y1, x2-x1);
  line(ctx, [[x1,y1], [x2,y2]], color, weight);
  line(ctx, [[x2-head*Math.cos(angle-0.45), y2-head*Math.sin(angle-0.45)],
    [x2,y2], [x2-head*Math.cos(angle+0.45), y2-head*Math.sin(angle+0.45)]], color, weight);
}

function drawSupport(ctx, x, y, type, last) {
  if (type === 'free') {
    ctx.fillStyle = ink; ctx.fillRect(x-3, y-3, 6, 6);
    return;
  }
  if (type === 'fixed') {
    const side = last ? 1 : -1;
    line(ctx, [[x,y-18],[x,y+19]], ink, 3);
    for (let i=-17; i<18; i+=7) line(ctx, [[x,y+i],[x+side*8,y+i+6]], ink);
    return;
  }
  line(ctx, [[x,y+2],[x-12,y+20],[x+12,y+20],[x,y+2]], ink, 2.5);
  if (type === 'roller') {
    for (const dx of [-7,7]) {
      ctx.beginPath(); ctx.strokeStyle = ink; ctx.lineWidth = 2;
      ctx.arc(x+dx, y+24, 3, 0, 2*Math.PI); ctx.stroke();
    }
  }
  const ground = y+(type === 'roller' ? 30 : 23);
  line(ctx, [[x-15,ground],[x+15,ground]], ink);
}

function drawLineLoad(ctx, X, load, baseline, max, color) {
  const a = X(load.a), b = X(load.b);
  if (!(b > a) || !max) return;
  const top = w => baseline-38*w/max;
  line(ctx, [[a,top(load.w1)], [b,top(load.w2)]], color);
  const divisions = Math.max(1, Math.min(16, Math.round((b-a)/45)));
  for (let i=0; i<=divisions; i++) {
    const fraction=i/divisions, w=load.w1+(load.w2-load.w1)*fraction, px=a+(b-a)*fraction;
    if (Math.abs(top(w)-baseline)>2) arrow(ctx,px,top(w),px,baseline,color,1.8,Math.min(7, Math.abs(top(w)-baseline)/2));
  }
}

function drawMoment(ctx, x, y, p) {
  // Increasing canvas angles are clockwise. Positive applied moments rotate CCW.
  if (p === 0) return;
  const radius=15, direction=p>0?-1:1, start=0.65;
  const end=start+direction*Math.PI*1.55, previous=end-direction*0.2;
  ctx.beginPath(); ctx.strokeStyle=green; ctx.lineWidth=2.5;
  ctx.arc(x,y,radius,start,end,direction<0); ctx.stroke();
  arrow(ctx,x+radius*Math.cos(previous),y+radius*Math.sin(previous),x+radius*Math.cos(end),y+radius*Math.sin(end),green,2.5,7);
}

function axisX(ctx, X, end, y, convert, axisTitle) {
  line(ctx,[[X(0),y],[X(end),y]],ink,1.3);
  for (let i=0;i<=4;i++) {
    const v=end*i/4, px=X(v);
    line(ctx,[[px,y],[px,y+5]],ink,1.4);
    label(ctx,num(convert(v)),px,y+20,'center',18);
  }
  label(ctx,axisTitle,(X(0)+X(end))/2,y+44,'center',18);
}

async function modelDrawing(model, frame, units) {
  const {canvas,ctx}=graphic(268), X=x=>73+(width-146)*x/model.L, beamY=152;
  label(ctx, '靜態載重', 90, 17, 'left', 18, green);
  line(ctx,[[54,17],[79,17]],green,3);
  const timeDependent = model.c.mode !== 'static';
  if (timeDependent) {
    label(ctx,'車輛軸重',256,17,'left',18,orange);
    line(ctx,[[219,17],[244,17]],orange,3);
    label(ctx,'t = '+num(frame.t)+' s',width-65,17,'right',18);
  }
  const spanLoads = model.c.selfWeight ? model.c.spans.map((s,i)=>({
    type:'line', a:model.ss[i], b:model.ss[i+1], w1:s.mass*0.00980665, w2:s.mass*0.00980665
  })) : [];
  const lineLoads=[...model.c.loads.filter(l=>l.type==='line'),...spanLoads];
  const maxIntensity=Math.max(0,...lineLoads.flatMap(l=>[Math.abs(l.w1),Math.abs(l.w2)]));
  for (const l of lineLoads) drawLineLoad(ctx,X,l,85,maxIntensity,green);
  for (const l of frame.result.load.loads) {
    if (l.type==='point' && l.p) {
      const down=l.p>0, low=beamY-6, high=down?90:beamY-61;
      arrow(ctx,X(l.x),down?high:low,X(l.x),down?low:high,l.vehicle?orange:green,l.vehicle?3.7:2.8,9);
    } else if (l.type==='moment') drawMoment(ctx,X(l.x),beamY-20,l.p);
  }
  line(ctx,[[X(0),beamY],[X(model.L),beamY]],ink,5);
  const groups=[];
  model.ss.forEach((x,i)=>{
    const px=X(x);
    drawSupport(ctx,px,beamY,model.c.supports[i],i===model.ss.length-1);
    const previous=groups.at(-1);
    const name=String.fromCharCode(65+i);
    if (previous && px-previous.last<31) {
      previous.names.push(name);previous.last=px;
    } else groups.push({first:px,last:px,names:[name]});
  });
  groups.forEach(g=>label(ctx,g.names.join('/'),(g.first+g.last)/2,195,'center',18));
  axisX(ctx,X,model.L,212,v=>units.show('m',v),'梁座標 x ('+units.label('m')+')');
  return figure(canvas,'梁模型與載重配置','支承位置依梁座標繪製。箭頭顯示載重方向，弧形箭頭表示集中彎矩。載重數值列於輸入資料表。');
}

function responseDrawing(series, bounds, config) {
  const {ctx,canvas}=graphic(266);
  const left=124, right=55, top=44, bottom=198;
  let magnitude = 0;
  for (const values of [series,...bounds]) {
    for (const p of values) magnitude=Math.max(magnitude,Math.abs(p[1]));
  }
  // A zero-only diagram needs a finite display scale.
  if (!magnitude) magnitude=1;
  const X=v=>left+(width-left-right)*v/config.end;
  const Y=v=>(top+bottom)/2 + (config.down ? 1 : -1)*v/magnitude*(bottom-top)/2;
  label(ctx,config.quantity+' ('+config.yUnit+')',left,17,'left',19);
  if (bounds.length) {
    line(ctx,[[width-355,17],[width-329,17]],config.color,3);
    label(ctx,'目前步',width-320,17,'left',17);
    line(ctx,[[width-231,17],[width-202,17]],'#526970',2.4,[7,5]);
    label(ctx,'取樣包絡',width-192,17,'left',17);
  }
  for(const v of [-magnitude,0,magnitude]){
    const y=Y(v);
    line(ctx,[[left,y],[width-right,y]],v===0?'#708486':grid,v===0?1.7:1.2);
    label(ctx,num(v),left-10,y,'right',18);
  }
  if(bounds.length){
    const low=bounds[0].map(([x,y])=>[X(x),Y(y)]);
    const high=bounds[1].map(([x,y])=>[X(x),Y(y)]);
    if (low.length && high.length) {
      ctx.beginPath();ctx.moveTo(...low[0]);
      for (let i=1;i<low.length;i++)ctx.lineTo(...low[i]);
      for (let i=high.length-1;i>=0;i--)ctx.lineTo(...high[i]);
      ctx.closePath();ctx.fillStyle='#eaf0f1';ctx.fill();
      line(ctx,[[left,Y(0)],[width-right,Y(0)]],'#708486',1.3);
      line(ctx,low,'#526970',1.9,[7,5]);line(ctx,high,'#526970',1.9,[7,5]);
    }
  }
  line(ctx,series.map(([x,y])=>[X(x),Y(y)]),config.color,3.5);
  if(config.mark) {
    const [x,y]=config.mark;
    ctx.beginPath();ctx.fillStyle='white';ctx.strokeStyle=config.color;ctx.lineWidth=3;
    ctx.arc(X(x),Y(y),4.8,0,Math.PI*2);ctx.fill();ctx.stroke();
  }
  axisX(ctx,X,config.end,212,config.convertX,config.xTitle);
  return canvas;
}

async function sectionDrawing(span,index,units) {
  const outline=sectionOutline(span.section);
  if(!outline)return null;
  const section=span.section,properties=evaluateSection(section);
  const {canvas,ctx}=graphic(215);
  const W=outline.width,H=outline.height,k=Math.min(230/W,155/H),cx=200-W*k/2,baseline=182;
  ctx.save();ctx.translate(cx,baseline);ctx.scale(k,-k);
  ctx.fillStyle='#cae1de';ctx.strokeStyle=green;ctx.lineWidth=2/k;
  const path=new Path2D(outline.path);ctx.fill(path,'evenodd');ctx.stroke(path);ctx.restore();
  const y=baseline-k*properties.cz,x=cx+k*properties.cy,axisV=section.axis==='v';
  line(ctx,[[cx-18,y],[cx+W*k+18,y]],axisV?grid:orange,2,[7,4]);
  line(ctx,[[x,baseline+8],[x,baseline-H*k-8]],axisV?orange:grid,2,[7,4]);
  label(ctx,section.name,410,52,'left',21);
  label(ctx,axisV?'採用垂直形心軸 Iᵥ':'採用水平形心軸 Iₕ',410,94,'left',19,orange);
  label(ctx,'I = '+num(units.show('m⁴',span.I))+' '+units.label('m⁴'),410,131);
  label(ctx,'A = '+num(properties.A*units.show('m',1)**2)+' '+units.label('m')+'²',410,163);
  return figure(canvas,'第 '+(index+1)+' 跨斷面','依公稱尺寸繪製，橘色虛線為分析採用的彎曲軸。');
}

export async function reportFigures(model, analysis, index, units, x, options={}) {
  const frame=analysis.frames[index], blocks=[await modelDrawing(model,frame,units)];
  for(const [i,span] of model.c.spans.entries())if(span.section&&!options.component){
    const drawing=await sectionDrawing(span,i,units);if(drawing)blocks.push(drawing);
  }
  const specs=[
    ['M','彎矩','kN·m',green,'正彎矩向下繪製，代表下緣受拉。'],
    ['V','剪力','kN','#28558a','正剪力向上繪製。集中力及支承位置可能有剪力跳躍。'],
    ['D','撓度','mm','#714e86','向上位移為正，曲線縱向採獨立比例。'],
  ];
  const envelope=analysis.envelope?.rows;
  const coordinateUnit=units.label('m'), convertX=v=>units.show('m',v);
  for (const [key,quantity,unit,color,description] of specs.filter(spec=>!options.component||spec[0]===options.component)) {
    const series=frame.result.points.map(p=>[p.x,units.show(unit,p[key])]);
    const bounds=envelope ? ['min','max'].map(s=>envelope.map(p=>[p.x,units.show(unit,p[key+s])])) : [];
    const canvas=responseDrawing(series,bounds,{quantity,yUnit:units.label(unit),down:key==='M',color,
      end:model.L,convertX,xTitle:'梁座標 x ('+coordinateUnit+')'});
    const currentStep = envelope ? ' 選定時間 t = '+num(frame.t)+' s。虛線顯示各取樣斷面的全程最大與最小值。' : '';
    blocks.push(await figure(canvas,quantity+'圖',description+currentStep));
  }
  if (!options.component && model.c.mode!=='static' && Number.isFinite(x) && x>=0 && x<=model.L) {
    for(const [key,name,unit,color] of specs){
    const series=analysis.frames.map(f=>[f.t,units.show(unit,f.result.at(x,x===model.L?-1:1)[key])]);
    const end=series.at(-1)[0], section='x = '+num(convertX(x))+' '+coordinateUnit;
    if(end>0){
      const canvas=responseDrawing(series,[],{quantity:key,yUnit:units.label(unit),down:false,color,
        end,convertX:v=>v,xTitle:'時間 t (s)',mark:series[index]});
      blocks.push(await figure(canvas,'查詢斷面'+name+'歷程',section+(x===model.L?'，採梁端內側值。':'，採斷面右側值。')+'正值向上繪製，圓點標出選定時間 t = '+num(frame.t)+' s。'));
    }
  }
  }
  return blocks;
}

