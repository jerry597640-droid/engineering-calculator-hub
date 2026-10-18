(function () {
  'use strict';
  document.querySelectorAll('#mobile-preview').forEach(node => node.remove());
  const analysis = document.getElementById('analysis');
  analysis.querySelectorAll('[data-diagram-pin]').forEach(node => node.remove());
  let pinned = analysis.dataset.diagramPinned !== 'false';
  if (!('diagramPinned' in analysis.dataset)) {
    try { pinned = localStorage.getItem('src-beam-diagram-pinned') !== 'false'; } catch {}
  }
  const layout = analysis.querySelector('.layout');
  const source = document.getElementById('drawing');
  const results = analysis.querySelector('.results');
  const resultGrid = results.querySelector('.result-grid');
  const viewer = results.querySelector('.viewer-panel') || resultGrid.querySelector('.panel');
  viewer.classList.add('viewer-panel');
  resultGrid.before(viewer);
  const heading = viewer.querySelector('.panel-title');
  if (!heading.querySelector('.viewer-heading')) {
    const group = document.createElement('div');
    group.className = 'viewer-heading';
    group.append(...heading.children);
    heading.append(group);
  }
  function pinButton() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'diagram-pin no-print';
    button.dataset.diagramPin = '';
    button.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M9 3h6m-5 0v6l-4 4v2h12v-2l-4-4V3m-2 12v7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="diagram-pin-label"></span>';
    return button;
  }
  heading.append(pinButton());
  const data = document.getElementById('diagram-data');
  if (!document.getElementById('diagram-info-panel')) {
    const dataPanel = document.createElement('section');
    dataPanel.id = 'diagram-info-panel';
    dataPanel.className = 'panel';
    dataPanel.innerHTML = '<div class="panel-title"><h2>斷面計算數值</h2><small>對應目前彎矩方向</small></div><div class="panel-body"></div>';
    dataPanel.querySelector('.panel-body').append(data);
    resultGrid.insertBefore(dataPanel, resultGrid.lastElementChild);
  }
  const preview = document.createElement('section');
  preview.id = 'mobile-preview';
  preview.className = 'mobile-preview panel no-print';
  preview.setAttribute('aria-label', '輸入時即時斷面預覽');
  preview.innerHTML = '<div class="mobile-preview-head"><b>即時斷面</b><button id="preview-direction" type="button">正彎矩 · 切換</button><button id="preview-expand" type="button">放大</button></div><svg id="preview-drawing" role="img" aria-label="與目前輸入同步的 SRC 梁斷面"></svg><p class="mobile-preview-empty" hidden>輸入資料待修正，修正後會恢復斷面。</p>';
  layout.before(preview);
  preview.querySelector('.mobile-preview-head').append(pinButton());
  const target = document.getElementById('preview-drawing');
  function sync() {
    const mobileResults = layout.classList.contains('mobile-results');
    preview.hidden = mobileResults;
    target.setAttribute('viewBox', source.getAttribute('viewBox'));
    target.innerHTML = source.innerHTML;
    preview.querySelector('.mobile-preview-empty').hidden = !!source.innerHTML.trim();
    const negative = direction === 'negative';
    document.getElementById('preview-direction').textContent = (negative ? '負彎矩' : '正彎矩') + ' · 切換';
    document.getElementById('preview-direction').setAttribute('aria-label', '切換至' + (negative ? '正彎矩' : '負彎矩'));
  }
  document.getElementById('preview-direction').onclick = () => {
    document.querySelector('[data-direction="' + (direction === 'negative' ? 'positive' : 'negative') + '"]').click();
  };
  document.getElementById('preview-expand').onclick = () => {
    document.getElementById('mobile-results').click();
    analysis.scrollIntoView({block: 'start'});
  };
  new MutationObserver(sync).observe(source, {childList: true, attributes: true});
  new MutationObserver(sync).observe(layout, {attributes: true, attributeFilter: ['class']});
  let pending = false;
  function applyPin(save) {
    analysis.classList.toggle('diagram-unpinned', !pinned);
    analysis.dataset.diagramPinned = String(pinned);
    analysis.querySelectorAll('[data-diagram-pin]').forEach(button => {
      button.setAttribute('aria-pressed', String(pinned));
      button.setAttribute('aria-label', pinned ? '取消釘選右側圖形' : '釘選右側圖形');
      button.title = pinned ? '目前已釘選；按下後讓圖形隨頁面捲動' : '目前未釘選；按下後固定顯示圖形';
      button.querySelector('.diagram-pin-label').textContent = pinned ? '取消釘選' : '釘選圖形';
    });
    if (save) {
      try { localStorage.setItem('src-beam-diagram-pinned', String(pinned)); } catch {}
    }
    scheduleResize();
  }
  analysis.addEventListener('click', event => {
    const button = event.target.closest('[data-diagram-pin]');
    if (!button) return;
    pinned = !pinned;
    applyPin(true);
    if (pinned) {
      const anchor = window.innerWidth > 820 ? layout : analysis;
      requestAnimationFrame(() => { anchor.scrollIntoView({block: 'start'}); scheduleResize(); });
    }
  });
  function resizePanes() {
    pending = false;
    if (analysis.hidden || !pinned) return;
    const top = Math.max(16, layout.getBoundingClientRect().top);
    if (window.innerWidth > 820) {
      const height = Math.max(480, window.innerHeight - top - 20);
      document.documentElement.style.setProperty('--src-pane-height', height + 'px');
    } else {
      const viewHeight = window.visualViewport?.height || window.innerHeight;
      document.documentElement.style.setProperty('--src-mobile-view-height', viewHeight + 'px');
      const height = Math.max(110, viewHeight - top - 16);
      document.documentElement.style.setProperty('--src-mobile-input-height', height + 'px');
    }
  }
  function scheduleResize() {
    if (!pending) { pending = true; requestAnimationFrame(resizePanes); }
  }
  window.addEventListener('resize', scheduleResize);
  window.addEventListener('scroll', scheduleResize, {passive: true});
  window.visualViewport?.addEventListener('resize', scheduleResize);
  layout.querySelector('.inputs').addEventListener('focusin', () => {
    requestAnimationFrame(() => {
      if (!pinned) return;
      if (window.innerWidth > 820) {
        const rect = layout.getBoundingClientRect();
        if (rect.top > 24 || rect.top < 0) window.scrollBy(0, rect.top - 16);
      } else {
        const rect = preview.getBoundingClientRect();
        const viewHeight = window.visualViewport?.height || window.innerHeight;
        if (rect.top < 0 || rect.bottom > viewHeight) analysis.scrollIntoView({block: 'start'});
      }
      scheduleResize();
    });
  });
  new MutationObserver(scheduleResize).observe(analysis, {attributes: true, attributeFilter: ['hidden']});
  new ResizeObserver(scheduleResize).observe(document.querySelector('.summary'));
  new ResizeObserver(scheduleResize).observe(preview);
  sync();
  applyPin(false);
  scheduleResize();
})();
