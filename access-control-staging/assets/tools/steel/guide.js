'use strict';
(()=>{
 for(const guide of document.querySelectorAll('.operation-guide')){
  const input=guide.querySelector('.guide-search');if(!input)continue;
  const groups=[...guide.querySelectorAll('section')].filter(s=>s.querySelector('.guide-table'));
  const initial=new Map([...guide.querySelectorAll('details')].map(d=>[d,d.open]));
  input.addEventListener('input',()=>{
   const q=input.value.trim().toLocaleLowerCase();let matches=0;
   for(const section of groups){let visible=0;const heading=section.querySelector('summary,h2')?.textContent.toLocaleLowerCase()||'';
    for(const row of section.querySelectorAll('tbody tr')){row.hidden=!!q&&!heading.includes(q)&&!row.textContent.toLocaleLowerCase().includes(q);if(!row.hidden){visible++;matches++;}}
    section.hidden=visible===0;const details=section.querySelector('details');if(details)details.open=q?visible>0:initial.get(details);
   }
   guide.querySelector('#guide-search-result').textContent=q?`找到 ${matches} 筆欄位說明。`:'輸入關鍵字可篩選下方欄位說明。';
  });
 }
})();

