(function () {
  'use strict';
  document.querySelectorAll('#mobile-preview').forEach(node => node.remove());
  const analysis = document.getElementById('analysis');
  const layout = analysis.querySelector('.layout');
  const source = document.getElementById('drawing');
  const viewer = analysis.querySelector('.result-grid > .panel');
  viewer.classList.add('viewer-panel');
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
    if (analysis.hidden || window.innerWidth <= 820) return;
    const top = Math.max(16, layout.getBoundingClientRect().top);
    const height = Math.max(280, window.innerHeight - top - 20);
    document.documentElement.style.setProperty('--src-pane-height', height + 'px');
  }
  function scheduleResize() {
    if (!pending) { pending = true; requestAnimationFrame(resizePanes); }
  }
  window.addEventListener('resize', scheduleResize);
  window.addEventListener('scroll', scheduleResize, {passive: true});
  new MutationObserver(scheduleResize).observe(analysis, {attributes: true, attributeFilter: ['hidden']});
  new ResizeObserver(scheduleResize).observe(document.querySelector('.summary'));
  sync();
  scheduleResize();
})();
