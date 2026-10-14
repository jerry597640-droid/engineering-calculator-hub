(function () {
  'use strict';
  document.querySelectorAll('#mobile-preview').forEach(node => node.remove());
  const analysis = document.getElementById('analysis');
  const layout = analysis.querySelector('.layout');
  const source = document.getElementById('drawing');
  const results = analysis.querySelector('.results');
  const resultGrid = results.querySelector('.result-grid');
  const viewer = results.querySelector('.viewer-panel') || resultGrid.querySelector('.panel');
  viewer.classList.add('viewer-panel');
  resultGrid.before(viewer);
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
  const target = preview.querySelector('svg');
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
  function resizePanes() {
    pending = false;
    if (analysis.hidden) return;
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
  scheduleResize();
})();
