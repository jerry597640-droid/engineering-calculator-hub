const cards = new Map();
const pinKey = 'beamlab-pinned-charts-v1';
let pins = [];
let activeResult = 'moment';
let repaint;
let scheduled = 0;
function schedulePaint() {
  cancelAnimationFrame(scheduled);
  scheduled = requestAnimationFrame(() => repaint?.());
}
export function selectView(view, scroll = false) {
  document.body.dataset.view = view;
  document.querySelectorAll('[data-view-button]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.viewButton === view));
  });
  if (scroll && matchMedia('(max-width: 1023px)').matches) window.scrollTo(0, 0);
  schedulePaint();
}
export function arrangePins() {
  const panel = document.querySelector('#pinnedPanel');
  const target = document.querySelector('#pinnedCards');
  for (const [key, {card, home, button, title}] of cards) {
    const pinned = pins.includes(key);
    button.textContent = pinned ? '已釘選' : '釘選';
    button.setAttribute('aria-pressed',String(pinned));
    button.setAttribute('aria-label',`${pinned ? '取消釘選' : '釘選'}${title}`);
    if (!pinned && card.parentNode === target) home.after(card);
  }
  for (const key of pins) target.append(cards.get(key).card);
  const hasHistory = !cards.get('history').card.hidden;
  document.querySelector('[data-result="history"]').hidden = !hasHistory;
  if (!hasHistory && activeResult === 'history') activeResult = 'moment';
  for (const [key,{card}] of cards) {
    card.classList.toggle('inactive-result', key !== 'beam' && !pins.includes(key) && activeResult !== 'all' && activeResult !== key);
  }
  for (const btn of document.querySelectorAll('[data-result]')) {
    btn.setAttribute('aria-pressed',String(activeResult === btn.dataset.result));
  }
  panel.hidden = !pins.some(key => !cards.get(key).card.hidden);
}
export function installWorkspace(draw) {
  repaint = draw;
  installQuickTools();
  for (const [key, selector, title] of [
    ['beam','.modelcard','梁模型'], ['moment','#momentChart','彎矩圖'],
    ['shear','#shearChart','剪力圖'], ['deflection','#deflectionChart','撓度圖'],
    ['reactions','.reactions','支承反力'], ['history','#historyPanel','反應歷時'],
  ]) {
    const card = document.querySelector(selector).closest('.card');
    card.dataset.pinCard = key;
    const home = document.createComment(`home: ${key}`);
    card.before(home);
    const button = document.createElement('button');
    button.className = 'pin-button';
    card.querySelector('.cardhead').append(button);
    button.onclick = () => {
      pins = pins.includes(key) ? pins.filter(pin => pin !== key) : [...pins, key];
      try {localStorage.setItem(pinKey,JSON.stringify(pins));} catch {}
      arrangePins();
      button.focus({preventScroll:true});
      button.scrollIntoView({block:'nearest'});
      schedulePaint();
    };
    cards.set(key, {card, home, button, title});
  }
  try {
    const stored = JSON.parse(localStorage.getItem(pinKey));
    if (Array.isArray(stored)) pins = [...new Set(stored)].filter(key=>cards.has(key));
  } catch {}
  arrangePins();
  document.querySelectorAll('[data-view-button]').forEach(button => {
    button.onclick = () => selectView(button.dataset.viewButton, true);
  });
  selectView('results');
  let width = window.innerWidth;
  window.addEventListener('resize', () => {
    if (width === window.innerWidth) return;
    width = window.innerWidth;
    schedulePaint();
  });
  for (const btn of document.querySelectorAll('[data-result]')) {
    btn.onclick = () => {
      activeResult = btn.dataset.result;
      arrangePins();
      schedulePaint();
      if (pins.includes(activeResult)) cards.get(activeResult).card.scrollIntoView({block:'nearest'});
    };
  }
}

function installQuickTools() {
  const commands = [
    ['geometry','梁與支承','M2 8h20M5 8v3l-3 5h6l-3-5m14-3v3l-3 5h6l-3-5M2 19h6m8 0h6','edit'],
    ['loads','靜態載重','M3 19h18M6 3v11m-3-3 3 3 3-3m8-8v11m-3-3 3 3 3-3','edit'],
    ['vehicle','車輛軸重','M2 15V6h12v9H2m12-6h4l4 5v2h-3m-5 0h-4M8 17a2 2 0 1 1-4 0 2 2 0 1 1 4 0m11 0a2 2 0 1 1-4 0 2 2 0 1 1 4 0','edit'],
    ['moment','彎矩圖','M2 6h20M3 6q9 20 18 0','result'],
    ['shear','剪力圖','M2 12h20M3 12V5h9v14h9v-7','result'],
    ['deflection','撓度圖','M2 8h3m3 0h3m3 0h3m3 0h2M2 8q10 17 20 0','result'],
    ['reactions','支承反力','M3 6h18M6 20V9m-3 3 3-3 3 3m9 8V9m-3 3 3-3 3 3','result'],
    ['unitsBtn','單位設定','M3 17 17 3l4 4L7 21zM7 13l2 2m2-6 2 2m2-6 2 2','action'],
    ['runBtn','計算分析','M7 4v16l12-8z','action'],
    ['exchangeBtn','匯出分析模型','M3 15v6h18v-6M12 16V3m-4 4 4-4 4 4','action'],
    ['reportBtn','計算報告','M5 3h10l4 4v14H5zM14 3v5h5M8 12h8m-8 4h6','action'],
    ['saveBtn','儲存模型','M4 3h13l3 3v15H4zm3 0v7h9V3M8 20v-7h8v7','action']
  ];
  const storeKey = 'beamlab-quick-tools-v1';
  const ids = commands.map(command => command[0]);
  let selected = ['geometry','loads','vehicle'];
  try {
    const saved = JSON.parse(localStorage.getItem(storeKey));
    if (Array.isArray(saved)) selected = [...new Set(saved)].filter(id => ids.includes(id));
  } catch {}
  const bar = document.getElementById('quickItems');
  const choices = document.getElementById('toolChoices');
  const dialog = document.getElementById('toolsDialog');
  function drawBar() {
    bar.replaceChildren();
    for (const key of selected) {
      const [id, label, path, type] = commands.find(command => command[0] === key);
      const button = document.createElement('button');
      button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"></path></svg><span>${label}</span>`;
      button.onclick = () => {
        if (type === 'action') return document.getElementById(id).click();
        const edit = type === 'edit';
        selectView(edit ? 'settings' : 'results', true);
        const tab = document.querySelector(edit ? `[data-tab="${id}"]` : `[data-result="${id}"]`);
        tab.click();
        const target = edit ? tab : cards.get(id).card;
        target.scrollIntoView({block:'nearest'});
        tab.focus({preventScroll:true});
      };
      bar.append(button);
    }
  }
  for (const [id,label] of commands) {
    const choice = document.createElement('label');
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = selected.includes(id);
    check.onchange = () => {
      selected = check.checked ? [...selected,id] : selected.filter(key=>key!==id);
      try {localStorage.setItem(storeKey,JSON.stringify(selected));} catch {}
      drawBar();
    };
    choice.append(check,document.createTextNode(label));
    choices.append(choice);
  }
  document.getElementById('customTools').onclick = () => dialog.showModal();
  document.getElementById('closeTools').onclick = () => dialog.close();
  dialog.addEventListener('click', e => {if (e.target === dialog) dialog.close();});
  drawBar();
}
