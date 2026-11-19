// A cross section has an interior face at each end and two faces elsewhere.
export function sectionFaces(result,x,L){
  return {
    left:x>0?result.at(x,-1):null,
    right:x<L?result.at(x,1):null
  };
}
export function snapStation(x,L,tolerance,stations){
  const clamped=Math.min(L,Math.max(0,x));
  let target=clamped,best=Infinity;
  for(const station of stations){
    const gap=Math.abs(station-clamped);
    if(station>=0&&station<=L&&gap<=tolerance&&gap<best){target=station;best=gap;}
  }
  return target;
}
const quantities={M:'kN·m',V:'kN',D:'mm'},titles={M:'彎矩',V:'剪力',D:'撓度'};
const symbol={M:'M',V:'V',D:'δ'};
const ns='http://www.w3.org/2000/svg';
function svgNode(name,attrs){
  const n=document.createElementNS(ns,name);
  for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);
  return n;
}

export function installSectionCursor({getState,quantity,numberOf,labelOf,readX,writeX,stop}){
  const beam=document.getElementById('beamWrap'),query=document.getElementById('queryX'),summary=document.getElementById('queryResult');
  const plots=Object.entries({M:'momentChart',V:'shearChart',D:'deflectionChart'}).map(([key,id])=>{
    const host=document.getElementById(id),bar=document.createElement('div');
    bar.className='section-scrubber';
    bar.innerHTML='<div class="section-cursor-info"><span class="section-location"></span><strong class="section-value"></strong></div><input type="range" min="0" max="10000" step="1" aria-label="'+titles[key]+'圖斷面位置"><div class="section-envelope" hidden></div>';
    host.after(bar);
    return {key,host,range:bar.querySelector('input'),location:bar.querySelector('.section-location'),value:bar.querySelector('.section-value'),envelope:bar.querySelector('.section-envelope')};
  });
  let job=null,timer=0;
  function cancelJob(){clearTimeout(timer);job=null;}
  function displayFaces(faces,key){
    const unit=quantities[key],digits=key==='D'?3:2;
    if(!faces.left||!faces.right)return quantity((faces.left||faces.right)[key],unit,digits);
    const a=numberOf(faces.left[key],unit,digits),b=numberOf(faces.right[key],unit,digits);
    return a===b?quantity(faces.right[key],unit,digits):'左 '+a+' ／ 右 '+quantity(faces.right[key],unit,digits);
  }
  function location(x,model){
    const i=model.ss.findIndex(s=>Math.abs(x-s)<1e-9);
    if(i>=0)return String.fromCharCode(65+i)+(model.c.supports[i]==='free'?' 節點':' 支點');
    return '第 '+model.ss.findIndex(s=>s>x)+' 跨';
  }
  function svgCursor(svg,x,L,faces,key){
    if(!svg||!svg.hasAttribute('data-plot-left'))return;
    const {plotLeft,plotRight,plotZero,plotScale}=svg.dataset;
    const pixel=Number(plotLeft)+(Number(plotRight)-Number(plotLeft))*x/L;
    let cursor=svg.querySelector('.section-guide');
    if(!cursor){
      cursor=svgNode('g',{class:'section-guide','pointer-events':'none','aria-hidden':'true'});
      if(key){
        cursor.append(svgNode('line',{y1:Number(svg.dataset.plotTop??18),y2:Number(svg.dataset.plotBottom??162)}),svgNode('circle',{r:4}),svgNode('circle',{r:3}));
      }else{
        cursor.append(svgNode('line',{y1:106,y2:148}),svgNode('path',{d:'M-4 103h8l-4 6z'}));
      }
      svg.append(cursor);
    }
    cursor.removeAttribute('display');cursor.setAttribute('transform','translate('+pixel+' '+(key?0:Number(svg.dataset.beamOffset||0))+')');
    if(key){
      const values=[faces.left,faces.right],dots=cursor.querySelectorAll('circle');
      values.forEach((face,i)=>{
        if(face){dots[i].removeAttribute('display');dots[i].setAttribute('cy',Number(plotZero)+Number(plotScale)*face[key]);}
        else dots[i].setAttribute('display','none');
      });
    }
  }
  function envelopeText(bounds,key){
    const dim=quantities[key],d=key==='D'?3:2;
    const interval=s=>numberOf(s[key][0],dim,d)+' ～ '+numberOf(s[key][1],dim,d);
    const left=bounds.left&&interval(bounds.left),right=bounds.right&&interval(bounds.right);
    const unit=labelOf(dim);
    return '全程包絡　'+(left&&right&&left!==right?'左 '+left+' ／ 右 '+right:(left||right))+' '+unit;
  }
  function updateEnvelopes(state,x){
    const show=state.model.c.mode!=='static'&&state.showEnvelope;
    for(const p of plots)p.envelope.hidden=!show;
    if(!show){cancelJob();return;}
    if(job?.analysis===state.analysis&&job.x===x){
      if(job.bounds)for(const p of plots)p.envelope.textContent=envelopeText(job.bounds,p.key);
      return;
    }
    cancelJob();
    const active=job={analysis:state.analysis,x,bounds:null};
    for(const p of plots)p.envelope.textContent='計算此斷面的全程包絡…';
    const limits=()=>({M:[Infinity,-Infinity],V:[Infinity,-Infinity],D:[Infinity,-Infinity]});
    const bounds={left:x>0?limits():null,right:x<state.model.L?limits():null};
    let i=0;
    function chunk(){
      if(job!==active)return;
      const frames=state.analysis.frames,start=performance.now();
      do{
        const faces=sectionFaces(frames[i++].result,x,state.model.L);
        for(const side of ['left','right'])if(faces[side])for(const k of Object.keys(quantities)){
          const value=faces[side][k],pair=bounds[side][k];
          pair[0]=Math.min(pair[0],value);pair[1]=Math.max(pair[1],value);
        }
      }while(i<frames.length&&performance.now()-start<7);
      if(i<frames.length){timer=setTimeout(chunk,0);return;}
      active.bounds=bounds;
      for(const p of plots)p.envelope.textContent=envelopeText(bounds,p.key);
    }
    timer=setTimeout(chunk,90);
  }
  function clear(){
    cancelJob();summary.textContent='';
    for(const p of plots){p.location.textContent='';p.value.textContent='';p.envelope.hidden=true;}
    document.querySelectorAll('.section-guide').forEach(g=>g.setAttribute('display','none'));
  }
  function refresh(){
    const state=getState();let x=readX();
    if(!state.current||state.dirty){clear();return;}
    const {model,current}=state,L=model.L;
    if(Number.isFinite(x)){const node=model.ss.find(v=>Math.abs(v-x)<=2e-13*Math.max(1,L));if(node!==undefined)x=node;}
    if(!Number.isFinite(x)||x<0||x>L){clear();summary.textContent='請輸入梁長範圍內的座標。';return;}
    const faces=sectionFaces(current,x,L),station=quantity(x,'m',3),place=location(x,model);
    const frame=state.analysis.frames[state.frameIndex];
    const mode=model.c.mode==='static'?'靜力':model.c.mode==='moving'?'車頭 x = '+quantity(model.c.direction===1?frame.front:L-frame.front,'m'):'t = '+frame.t.toFixed(3)+' s';
    summary.textContent=mode+' · '+place+'　'+Object.keys(quantities).map(k=>symbol[k]+' = '+displayFaces(faces,k)).join('　');
    svgCursor(beam.querySelector('svg'),x,L,faces);
    for(const p of plots){
      const svg=p.host.querySelector('svg');
      // The SVG can have letterboxing. Align the native thumb centres with its actual plot axis.
      if(svg&&svg!==p.sizedSvg&&p.host.clientWidth){
        const m=svg.getScreenCTM(),a=Number(svg.dataset.plotLeft),b=Number(svg.dataset.plotRight);
        if(m&&m.a>0){
          const start=m.a*a+m.e-p.location.parentElement.getBoundingClientRect().left;
          p.range.style.marginLeft=(start-8)+'px';p.range.style.width=(m.a*(b-a)+16)+'px';
          p.sizedSvg=svg;
        }
      }
      p.range.value=String(Math.round(x/L*10000));
      p.range.setAttribute('aria-valuetext',station+'，'+place+'，'+titles[p.key]+displayFaces(faces,p.key));
      p.location.textContent='x = '+station+' · '+place;
      p.value.textContent=(model.c.mode==='static'?'':mode+' · ')+symbol[p.key]+' = '+displayFaces(faces,p.key);
      svgCursor(p.host.querySelector('svg'),x,L,faces,p.key);
    }
    updateEnvelopes(state,x);
  }
  function choose(x,tolerance=0){
    const state=getState();if(state.dirty||state.busy||!state.current)return;
    const {model,current}=state;
    const stations=[...model.ss];
    if(tolerance)for(const l of current.load.loads){
      if(l.type==='line'){stations.push(l.a,l.b);}else stations.push(l.x);
    }
    const value=snapStation(x,model.L,Math.min(tolerance,model.L*.007),stations);
    writeX(value);refresh();
  }
  for(const p of plots){
    let pointer=null;
    const move=e=>{
      const state=getState(),svg=p.host.querySelector('svg');
      if(!svg||!state.model)return;
      const matrix=svg.getScreenCTM();if(!matrix)return;
      const point=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());
      const a=Number(svg.dataset.plotLeft),width=Number(svg.dataset.plotRight)-a;
      if(!(width>0))return;
      choose((point.x-a)/width*state.model.L,5/Math.abs(matrix.a)/width*state.model.L);
    };
    p.host.addEventListener('pointerdown',e=>{
      const state=getState();if(pointer!==null||!e.isPrimary||e.button!==0||state.dirty||state.busy)return;
      stop();pointer=e.pointerId;p.host.setPointerCapture(pointer);move(e);
    });
    p.host.addEventListener('pointermove',e=>{if(e.pointerId===pointer)move(e);});
    p.host.addEventListener('pointerup',e=>{if(e.pointerId===pointer){move(e);pointer=null;}});
    for(const type of ['lostpointercapture','pointercancel'])p.host.addEventListener(type,()=>{pointer=null;});
    let rangeTouch=false;
    p.range.addEventListener('pointerdown',()=>{stop();rangeTouch=true;});
    for(const type of ['pointerup','pointercancel','blur','keydown'])p.range.addEventListener(type,()=>{rangeTouch=false;});
    p.range.addEventListener('input',()=>{
      const state=getState();if(!state.model)return;
      stop();choose(Number(p.range.value)/10000*state.model.L,rangeTouch?state.model.L*5/Math.max(1,p.range.clientWidth-16):0);
    });
  }
  query.addEventListener('input',()=>{stop();refresh();});
  return {refresh,clear};
}


