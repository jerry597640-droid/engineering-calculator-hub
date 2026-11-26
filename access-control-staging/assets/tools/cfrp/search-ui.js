$('find-layers').onclick=()=>{try{
 const p=params();calculate(p);const steps=[];searchTrace={mode:lastMode,steps};
 const live=$('long-live').checked?1:.75,dead=lastMode==='flex'?p.MD:lastMode==='shear'?p.VD:p.PD,L=lastMode==='flex'?p.ML:lastMode==='shear'?p.VL:p.PL,loss=1.1*dead+live*L,base=CFRP[lastMode](p,0);
 steps.push({title:'層數搜尋損失前置條件',formula:'未補強容量≥1.1D+λL',substitution:`${base.capacity} ≥ 1.1×${dead}+${live}×${L}`,result:base.capacity>=loss?'通過':'未通過',unit:units[lastMode],condition:'不通過時不搜尋，增加FRP層數無法解決損失情境',source:'原層數搜尋條件'});
 if(base.capacity<loss){$('search-result').textContent='未補強容量不足 CFRP 損失情境；增加層數無法解決此項，需其他補強方案。';searchTrace.selectedSnapshot=JSON.stringify(p);render();return;}
 if(lastMode!=='column'&&(p.pull<1.4||p.fc*CFRP.K<17)){steps.push({title:'搜尋基材門檻',formula:'pull≥1.4且fc≥17MPa',substitution:`pull=${p.pull}；fc=${p.fc*CFRP.K}`,result:'未通過',condition:'未執行候選搜尋',source:'原工具門檻'});$('search-result').textContent='請先取得符合門檻的基材強度與拉拔結果，再搜尋可採用層數。';searchTrace.selectedSnapshot=JSON.stringify(p);render();return;}
 let found=null;for(let n=0;n<=200;n++){const r=CFRP[lastMode](p,n),ok=r.ratio<=1&&(lastMode!=='shear'||(r.reinforcementOK&&r.spacingOK&&r.minimumOK))&&(lastMode!=='column'||((n===0||r.eligible)&&r.fcc>=p.target));
 steps.push({title:`真實搜尋候選 n=${n}`,formula:'容量需求比≤1，且滿足本模組配置與強度条件',substitution:`容量=${r.capacity}；需求比=${r.ratio}；${lastMode==='shear'?`上限=${r.reinforcementOK},間距=${r.spacingOK},最小筋=${r.minimumOK}`:lastMode==='column'?`eligible=${r.eligible},fcc=${r.fcc}≥${p.target}`:r.mode}\n本候選實際計算：\n${traceText(r.trace)}`,result:ok?'滿足，停止搜尋':'未滿足，繼續',unit:units[lastMode],condition:'由0逐層至200，遇首個满足停止；沒有跳過候選',source:'同引擎實際候選結果'});if(ok){found=n;break;}}
 if(found===null){searchTrace.selectedSnapshot=JSON.stringify(p);$('search-result').textContent='0–200 層內沒有滿足本版條件的方案；需調整配置或採其他補強。';render();return;}
 $('common_n').value=found;searchTrace.selectedSnapshot=JSON.stringify({...p,n:found});render();$('search-result').textContent=`本版已算條件的最少層數：${found} 層。尚待錨定、服務性與完整規範確認。`;
 }catch(e){toast(e.message);}};
