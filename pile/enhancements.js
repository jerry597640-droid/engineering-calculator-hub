// Accessible field glossary and the local instructional video.
(function(){
  const glossary=document.querySelector('#parameter-glossary tbody');
  const entries=[];
  document.querySelectorAll('#panel-settings label.field').forEach(label=>{
    const clone=label.cloneNode(true);clone.querySelectorAll('input,select,span').forEach(el=>el.remove());
    entries.push([clone.textContent.trim(),label.querySelector('span')?.textContent||'']);
  });
  for(const [key,[name,unit,help]] of Object.entries(defs))entries.push([`${name} (${key})`,`${unit}；${help}`]);
  entries.push(['SPT N 的定義','以標準貫入試驗後30 cm的貫入擊數為N值；資料取鑽探試驗紀錄。代表層值需由地質設計者判定，拒錘與不完整貫入不可直接視為一般N。'],['有效覆土壓 σ′','土層單位重沿深度累加的總應力，減去孔隙水壓；水位以下使用γsat−γw，單位kPa。'],['極限與容許支承力','Qs、Qb為未除安全係數的極限分量；Qa為除係數後的地盤容許量，淨壓力再扣樁浮重及輸入負摩擦需求。'],['N̄平均範圍','D為樁徑；鑽掘樁在樁尖上、下1D；閉口打入樁在上4D、下1D。按涵蓋土層厚度加權，平均N值上限50。'],['樁體結構輸入（另行設計）','f′c混凝土抗壓強度、fy鋼筋降伏強度、鋼筋面積／配置、保護層、設計軸力彎矩剪力。來源為材料規格、結構分析與施工圖；本版未計算樁身強度。']);
  const search=document.getElementById('parameter-search');
  function filter(){const q=search.value.trim().toLocaleLowerCase();const found=entries.filter(row=>row.join(' ').toLocaleLowerCase().includes(q));glossary.innerHTML=found.map(row=>'<tr>'+row.map(v=>'<td>'+esc(v)+'</td>').join('')+'</tr>').join('');document.getElementById('parameter-count').textContent=`找到 ${found.length} 個項目`;}search.addEventListener('input',filter);filter();
  const video=document.getElementById('tutorial-video');
  const embedded=document.getElementById('tutorial-media');
  if(embedded){const mediaUrl='data:video/mp4;base64,'+JSON.parse(embedded.textContent);video.src=mediaUrl;const link=document.getElementById('download-tutorial');link.href=mediaUrl;link.download='基樁工作台_操作教學.mp4';}
  const chapters=window.PILE_CHAPTERS||[];
  document.getElementById('video-chapters').innerHTML=chapters.map((c,i)=>`<button class="chapter" data-chapter="${i}">${String(i+1).padStart(2,'0')} ${esc(c.title)}</button>`).join('');
  document.querySelectorAll('[data-chapter]').forEach(b=>b.onclick=()=>{video.currentTime=chapters[Number(b.dataset.chapter)].start;video.play().catch(()=>{document.getElementById('video-message').textContent='請點播放按鈕開始教學。';});});
  video.addEventListener('timeupdate',()=>{const i=chapters.findLastIndex(c=>video.currentTime>=c.start);document.querySelectorAll('[data-chapter]').forEach(b=>{b.classList.toggle('active',Number(b.dataset.chapter)===i);b.setAttribute('aria-pressed',String(Number(b.dataset.chapter)===i));});});
  video.addEventListener('error',()=>document.getElementById('video-message').textContent='影片未能載入；請使用含 media 資料夾的完整離線套件，或回到線上版。');
  document.querySelectorAll('[data-tab]').forEach(b=>{b.setAttribute('aria-controls','panel-'+b.dataset.tab);b.addEventListener('click',()=>document.querySelectorAll('[data-tab]').forEach(el=>el.setAttribute('aria-current',el===b?'page':'false')));});
  document.querySelector('[data-tab="settings"]').setAttribute('aria-current','page');
  document.querySelectorAll('input[type="number"]').forEach(el=>el.setAttribute('inputmode','decimal'));
})();
