/* PDF 工具箱：處理程序全部在使用者的瀏覽器內執行。 */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const PDFEngine = window.PDFEngine;
  const ZIP = window.JSZip;
  const state = {
    mode: 'split', rule: 'size',
    split: { file: null, bytes: null, doc: null, pages: 0, parts: [], working: false, cancelled: false, loadId: 0 },
    merge: { items: [], loading: false, working: false, result: null, loadId: 0 },
    compress: { source: null, loading: false, working: false, cancelled: false, result: null, loadId: 0 },
  };
  const fmtNumber = (n) => new Intl.NumberFormat('zh-TW').format(n);
  const fmtMB = (n) => `${(n / 1_000_000).toFixed(2)} MB`;
  const shortMB = (n) => `${(n / 1_000_000).toFixed(2)}`;
  const cleanName = (name) => (name || 'PDF文件').replace(/\.pdf$/i, '').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').trim().slice(0, 110) || 'PDF文件';
  const validPDF = (file) => file && (/\.pdf$/i.test(file.name) || file.type === 'application/pdf');
  const nextTick = () => new Promise((resolve) => setTimeout(resolve, 0));

  function alertUser(message) {
    $('app-alert-text').textContent = message;
    $('app-alert').hidden = false;
  }
  $('app-alert-close').addEventListener('click', () => { $('app-alert').hidden = true; });

  function revokeResult(item) {
    if (item?.url) URL.revokeObjectURL(item.url);
  }
  function clearSplitResults() {
    state.split.parts.forEach(revokeResult);
    state.split.parts = [];
    $('split-results').hidden = true;
    $('split-result-list').replaceChildren();
  }
  function clearMergeResults() {
    revokeResult(state.merge.result);
    state.merge.result = null;
    $('merge-results').hidden = true;
  }

  function changeMode(mode) {
    if (!['split', 'merge', 'compress'].includes(mode)) return;
    if (state.split.working || state.merge.working || state.compress.working) return;
    state.mode = mode;
    for (const b of document.querySelectorAll('[data-mode]')) {
      const active = b.dataset.mode === mode;
      b.classList.toggle(b.classList.contains('mode-tab') ? 'selected' : 'active', active);
      if (b.getAttribute('role') === 'tab') {
        b.setAttribute('aria-selected', String(active));
        b.tabIndex = active ? 0 : -1;
      } else if (active) {
        b.setAttribute('aria-current', 'page');
      } else {
        b.removeAttribute('aria-current');
      }
    }
    for (const name of ['split', 'merge', 'compress']) $(name + '-view').hidden = mode !== name;
    const headings = {
      split: ['PDF 分割', '大型 PDF，<span>剛剛好地分割。</span>', '可按檔案容量或頁數分割完整頁面，讓工程圖說、施工計畫與計算書更容易傳送、歸檔。'],
      merge: ['PDF 合併', '多份 PDF，<span>整理成一份。</span>', '依照自訂的文件順序，將封面、主文、圖說與附件整合成一份 PDF。'],
      compress: ['PDF 縮小', '設定容量，<span>讓文件更輕巧。</span>', '先保留文字與向量嘗試縮小，再依您的同意調整影像品質；以實際輸出容量判定是否達標。'],
    };
    $('breadcrumb-current').textContent = headings[mode][0];
    $('hero-title').innerHTML = headings[mode][1];
    $('hero-description').textContent = headings[mode][2];
  }
  document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => changeMode(b.dataset.mode)));

  function setupDropzone(zone, input, handler) {
    zone.addEventListener('click', () => input.click());
    zone.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); input.click(); }
    });
    for (const e of ['dragenter', 'dragover']) zone.addEventListener(e, (event) => { event.preventDefault(); zone.classList.add('dragover'); });
    for (const e of ['dragleave', 'dragend']) zone.addEventListener(e, (event) => { event.preventDefault(); zone.classList.remove('dragover'); });
    zone.addEventListener('drop', (event) => {
      event.preventDefault(); zone.classList.remove('dragover');
      if (event.dataTransfer?.files?.length) handler([...event.dataTransfer.files]);
    });
    input.addEventListener('change', () => {
      if (input.files.length) handler([...input.files]);
      input.value = '';
    });
  }

  const openPDF = (file) => PDFEngine.openPDF(file);
  function readableError(error) {
    const msg = String(error?.message || error || '未知錯誤');
    if (/encrypt|password/i.test(msg)) return 'PDF 受到密碼保護或已加密，請先使用有權限的方式解除保護，再重新匯入。';
    if (/invalid|parse|header|trailer|crossref|object|pdf/i.test(msg)) return '無法解析這份 PDF。請確認檔案沒有損壞，且不是需要密碼的文件。';
    return `處理失敗：${msg.slice(0, 180)}`;
  }

  function splitSettings() {
    if (state.rule === 'size') {
      const value = Number($('split-max-mb').value);
      if (!(value >= 0.1 && value <= 2048)) return null;
      return { rule: 'size', value, limit: Math.round(value * 1_000_000) };
    }
    const value = Number($('split-max-pages').value);
    if (!Number.isSafeInteger(value) || !(value >= 1 && value <= 100000)) return null;
    return { rule: 'pages', value };
  }
  function updateSplitSummary() {
    const s = state.split, rule = splitSettings();
    $('split-metric-file').textContent = s.file ? s.file.name : '尚未選取';
    $('split-metric-pages').textContent = s.file ? `${fmtNumber(s.pages)} 頁` : '—';
    $('split-metric-size').textContent = s.file ? fmtMB(s.file.size) : '—';
    $('split-limit-label').textContent = state.rule === 'size' ? '容量上限' : '每份上限';
    $('split-metric-limit').textContent = !rule ? '設定無效' : rule.rule === 'size' ? `${Number(rule.value).toFixed(2)} MB` : `${fmtNumber(rule.value)} 頁`;
    $('split-start').disabled = !s.file || s.working || !rule;
  }

  async function chooseSplitFile(files) {
    if (state.split.working) return;
    const file = files[0];
    if (!validPDF(file)) { alertUser('請選擇 PDF 檔案（副檔名 .pdf）。'); return; }
    const loadId = ++state.split.loadId;
    clearSplitResults();
    Object.assign(state.split, { file: null, bytes: null, doc: null, pages: 0 });
    $('split-chosen').hidden = true;
    $('split-status').hidden = false;
    setSplitStatus(0, '正在讀取文件…', '辨識頁數並檢查 PDF 結構');
    updateSplitSummary();
    try {
      const parsed = await openPDF(file);
      if (loadId !== state.split.loadId) return;
      if (!parsed.pages) throw new Error('PDF 沒有任何頁面');
      Object.assign(state.split, parsed);
      $('split-name').textContent = file.name;
      $('split-info').textContent = `${fmtNumber(parsed.pages)} 頁 · ${fmtMB(file.size)}`;
      $('split-chosen').hidden = false;
      $('split-status').hidden = true;
      if (file.size > 200_000_000) alertUser('這份 PDF 超過 200 MB。仍可嘗試處理，但大型文件建議使用記憶體充足的桌面瀏覽器。');
    } catch (error) {
      if (loadId !== state.split.loadId) return;
      $('split-status').hidden = true;
      alertUser(readableError(error));
    }
    updateSplitSummary();
  }
  $('split-remove').addEventListener('click', () => {
    if (state.split.working) return;
    ++state.split.loadId;
    clearSplitResults();
    Object.assign(state.split, { file: null, bytes: null, doc: null, pages: 0 });
    $('split-chosen').hidden = true;
    $('split-status').hidden = true;
    updateSplitSummary();
  });
  setupDropzone($('split-dropzone'), $('split-file-input'), chooseSplitFile);

  function setSplitRule(rule) {
    state.rule = rule;
    $('split-size-options').hidden = rule !== 'size';
    $('split-page-options').hidden = rule !== 'pages';
    document.querySelectorAll('.rule-choice').forEach((choice) => choice.classList.toggle('active', choice.querySelector('input').value === rule));
    $('split-rule-explanation').innerHTML = rule === 'size'
      ? 'PDF 會以<strong>完整頁面</strong>分割，無法把單一頁面切成兩份。若某一頁本身超出上限，將獨立輸出並標示提醒。'
      : 'PDF 會依照指定的<strong>每份頁數</strong>分割，最後一份可能較少頁。不同頁面的內容量不同，輸出 MB 不一定相同。';
    clearSplitResults();
    updateSplitSummary();
  }
  document.querySelectorAll('input[name="split-rule"]').forEach((input) => input.addEventListener('change', () => { if (input.checked) setSplitRule(input.value); }));
  for (const [attr, inputId] of [['size', 'split-max-mb'], ['pages', 'split-max-pages']]) {
    const input = $(inputId);
    input.addEventListener('input', () => {
      document.querySelectorAll(`[data-${attr}]`).forEach((b) => b.classList.toggle('active', Number(b.dataset[attr]) === Number(input.value)));
      clearSplitResults(); updateSplitSummary();
    });
    document.querySelectorAll(`[data-${attr}]`).forEach((b) => b.addEventListener('click', () => { input.value = b.dataset[attr]; input.dispatchEvent(new Event('input')); }));
  }

  function setSplitStatus(percent, title, detail) {
    const p = Math.round(Math.min(100, Math.max(0, percent)));
    $('split-status').hidden = false;
    $('split-progress').style.width = `${p}%`;
    $('split-percent').textContent = `${p}%`;
    $('split-status-title').textContent = title;
    $('split-status-detail').textContent = detail;
  }
  function ensureNotCancelled() { if (state.split.cancelled) throw new Error('__CANCELLED__'); }
  const splitOptions = {
    checkCancelled: ensureNotCancelled,
    yieldControl: nextTick,
    onProgress({ percent, first, count, phase }) {
      const title = phase === 'pages' ? '正在依頁數分割…' : phase === 'oversized' ? '偵測到單頁容量過大' : '正在確認實際 PDF 容量…';
      const detail = phase === 'pages' ? `製作第 ${fmtNumber(first)}～${fmtNumber(first + count - 1)} 頁`
        : phase === 'oversized' ? `第 ${fmtNumber(first)} 頁已超出指定上限，將單獨輸出`
        : `從第 ${fmtNumber(first)} 頁開始，測試 ${fmtNumber(count)} 頁的檔案大小`;
      setSplitStatus(percent, title, detail);
    },
  };

  function downloadUrl(url, name) {
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = name;
    document.body.append(anchor); anchor.click(); anchor.remove();
  }
  function addDownloadData(bytes, name) {
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    return { bytes, name, url };
  }
  const addText = (node, tag, text, css = '') => {
    const el = document.createElement(tag);
    if (css) el.className = css;
    el.textContent = text;
    node.appendChild(el);
    return el;
  };

  function showSplitResults(parts, settings) {
    clearSplitResults();
    const rootName = cleanName(state.split.file.name);
    state.split.parts = parts.map((p, i) => {
      const name = `${rootName}_第${String(i + 1).padStart(2, '0')}份_P${String(p.first).padStart(3, '0')}-${String(p.last).padStart(3, '0')}.pdf`;
      return { ...p, ...addDownloadData(p.bytes, name) };
    });
    const oversize = state.split.parts.filter((p) => p.oversized).length;
    $('result-count').textContent = `${fmtNumber(parts.length)} 份`;
    $('result-pages').textContent = `${fmtNumber(state.split.pages)} 頁`;
    const max = Math.max(...parts.map((p) => p.bytes.length));
    $('result-max-size').textContent = fmtMB(max);
    $('split-result-caption').textContent = `${settings.rule === 'size' ? `容量上限 ${settings.value} MB` : `每 ${settings.value} 頁一份`} · ${parts.length} 份輸出` + (oversize ? ` · ${oversize} 份單頁超出上限` : ' · 已完成分割');
    const list = $('split-result-list');
    for (const p of state.split.parts) {
      const row = document.createElement('div'); row.className = 'result-row';
      addText(row, 'span', 'PDF', 'file-icon');
      const detail = document.createElement('div'); detail.className = 'result-text';
      addText(detail, 'strong', p.name);
      addText(detail, 'small', `第 ${fmtNumber(p.first)}～${fmtNumber(p.last)} 頁 · ${fmtNumber(p.last - p.first + 1)} 頁 · ${fmtMB(p.bytes.length)}`);
      if (settings.rule === 'size') {
        const bar = addText(detail, 'div', '', 'bar-chart');
        const fill = document.createElement('div'); fill.style.width = `${Math.min(100, p.bytes.length / settings.limit * 100)}%`; bar.appendChild(fill);
      }
      row.appendChild(detail);
      addText(row, 'span', p.oversized ? '單頁超出上限' : settings.rule === 'size' ? '符合上限' : '已分割', `status-tag${p.oversized ? ' warning' : ''}`);
      const button = addText(row, 'button', '↓ 下載', 'download-one');
      button.type = 'button'; button.addEventListener('click', () => downloadUrl(p.url, p.name));
      list.appendChild(row);
    }
    $('split-results').hidden = false;
    $('split-results').scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (oversize) alertUser(`已完成分割，但有 ${oversize} 份單一頁面超過 ${settings.value} MB。因為 PDF 必須維持完整頁面，這些檔案無法只靠分割達成容量上限。`);
  }
  $('split-start').addEventListener('click', async () => {
    const s = state.split, settings = splitSettings();
    if (!s.file || !settings || s.working) return;
    s.working = true; s.cancelled = false;
    $('split-start').disabled = true; $('split-cancel').hidden = false;
    clearSplitResults();
    setSplitStatus(0, '準備分割文件…', '請稍候，PDF 會在此瀏覽器中處理');
    await nextTick();
    try {
      const parts = settings.rule === 'size'
        ? await PDFEngine.splitBySize(s, settings.limit, splitOptions)
        : await PDFEngine.splitByPages(s, settings.value, splitOptions);
      ensureNotCancelled();
      setSplitStatus(100, '分割完成', `已產生 ${parts.length} 份 PDF`);
      showSplitResults(parts, settings);
    } catch (error) {
      if (error.message === '__CANCELLED__') alertUser('已取消分割，沒有變更原始 PDF。');
      else alertUser(readableError(error));
    } finally {
      s.working = false;
      $('split-cancel').hidden = true;
      $('split-status').hidden = true;
      updateSplitSummary();
    }
  });
  $('split-cancel').addEventListener('click', () => {
    state.split.cancelled = true;
    $('split-cancel').textContent = '正在取消…';
    $('split-cancel').disabled = true;
    const t = setInterval(() => {
      if (!state.split.working) { clearInterval(t); $('split-cancel').disabled = false; $('split-cancel').textContent = '取消分割'; }
    }, 250);
  });
  $('split-download-zip').addEventListener('click', async () => {
    if (!state.split.parts.length) return;
    if (!ZIP) { alertUser('ZIP 元件未能載入，請重新開啟工具。'); return; }
    const btn = $('split-download-zip'), originalText = btn.textContent;
    btn.disabled = true; btn.textContent = '正在製作 ZIP…';
    try {
      const zip = new ZIP();
      for (const p of state.split.parts) zip.file(p.name, p.bytes, { compression: 'STORE' });
      const lines = [
        'PDF 工具箱・分割清單',
        `來源檔案：${state.split.file.name}`,
        `分割規則：${state.rule === 'size' ? $('split-max-mb').value + ' MB 上限' : $('split-max-pages').value + ' 頁 / 份'}`,
        `輸出數量：${state.split.parts.length}`,
        '',
        ...state.split.parts.map((p) => `${p.name}\t第 ${p.first}-${p.last} 頁\t${p.bytes.length} bytes${p.oversized ? '\t單頁超出上限' : ''}`),
      ];
      zip.file('分割清單.txt', '\ufeff' + lines.join('\r\n'));
      const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
      const url = URL.createObjectURL(blob);
      downloadUrl(url, `${cleanName(state.split.file.name)}_分割檔案.zip`);
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) { alertUser('製作 ZIP 失敗，請改用每份 PDF 右側的個別下載按鈕。'); }
    finally { btn.disabled = false; btn.textContent = originalText; }
  });

  function updateMergeSummary() {
    const items = state.merge.items;
    $('merge-metric-count').textContent = `${fmtNumber(items.length)} 份`;
    $('merge-metric-pages').textContent = `${fmtNumber(items.reduce((a, p) => a + p.pages, 0))} 頁`;
    $('merge-metric-size').textContent = fmtMB(items.reduce((a, p) => a + p.file.size, 0));
    $('merge-start').disabled = items.length < 2 || state.merge.loading || state.merge.working || !cleanName($('merge-output-name').value);
    $('merge-queue-count').textContent = `(${items.length})`;
    $('merge-queue-wrap').hidden = items.length === 0;
  }
  function renderMergeQueue() {
    const list = $('merge-queue'); list.replaceChildren();
    state.merge.items.forEach((item, index) => {
      const row = document.createElement('li'); row.className = 'merge-row';
      addText(row, 'span', String(index + 1).padStart(2, '0'), 'queue-order');
      addText(row, 'span', 'PDF', 'file-icon');
      const details = document.createElement('div'); details.className = 'file-details';
      addText(details, 'strong', item.file.name);
      addText(details, 'span', `${fmtNumber(item.pages)} 頁 · ${fmtMB(item.file.size)}`);
      row.appendChild(details);
      const controls = document.createElement('div'); controls.className = 'merge-controls';
      const action = (label, title, disabled, handler) => {
        const b = addText(controls, 'button', label);
        b.type = 'button'; b.title = title; b.setAttribute('aria-label', `${title}：${item.file.name}`);
        b.disabled = disabled || state.merge.working || state.merge.loading;
        b.addEventListener('click', handler);
      };
      action('↑', '上移', index === 0, () => moveMerge(index, -1));
      action('↓', '下移', index === state.merge.items.length - 1, () => moveMerge(index, 1));
      action('×', '移除', false, () => { clearMergeResults(); state.merge.items.splice(index, 1); renderMergeQueue(); });
      row.appendChild(controls); list.appendChild(row);
    });
    updateMergeSummary();
  }
  function moveMerge(index, direction) {
    const arr = state.merge.items, target = index + direction;
    if (target < 0 || target >= arr.length) return;
    [arr[index], arr[target]] = [arr[target], arr[index]];
    clearMergeResults(); renderMergeQueue();
  }
  async function chooseMergeFiles(files) {
    if (state.merge.loading || state.merge.working) return;
    const usable = files.filter(validPDF);
    if (!usable.length) { alertUser('請選擇至少一份 PDF 文件。'); return; }
    if (usable.length < files.length) alertUser('已略過非 PDF 格式的檔案。');
    state.merge.loading = true;
    clearMergeResults(); updateMergeSummary();
    let failures = 0;
    for (const file of usable) {
      try {
        const parsed = await openPDF(file);
        if (!parsed.pages) { ++failures; continue; }
        state.merge.items.push({ ...parsed, id: `item-${++state.merge.loadId}` });
      } catch (error) { ++failures; }
    }
    state.merge.loading = false;
    renderMergeQueue();
    if (failures) alertUser(`有 ${failures} 份 PDF 無法讀取，可能是檔案損壞或受到密碼保護；其餘已成功加入。`);
    if (state.merge.items.reduce((sum, item) => sum + item.file.size, 0) > 200_000_000) alertUser('合併來源超過 200 MB，建議在記憶體充足的桌面瀏覽器處理。');
  }
  setupDropzone($('merge-dropzone'), $('merge-file-input'), chooseMergeFiles);
  $('merge-clear').addEventListener('click', () => { if (state.merge.working || state.merge.loading) return; state.merge.items = []; clearMergeResults(); renderMergeQueue(); });
  $('merge-output-name').addEventListener('input', () => { clearMergeResults(); updateMergeSummary(); });

  function setMergeStatus(percent, detail) {
    const p = Math.round(Math.min(100, Math.max(0, percent)));
    $('merge-status').hidden = false;
    $('merge-progress').style.width = `${p}%`;
    $('merge-percent').textContent = `${p}%`;
    $('merge-status-detail').textContent = detail;
  }
  $('merge-start').addEventListener('click', async () => {
    if (state.merge.working || state.merge.loading || state.merge.items.length < 2) return;
    state.merge.working = true;
    clearMergeResults(); renderMergeQueue();
    setMergeStatus(0, '正在準備合併 PDF…');
    await nextTick();
    try {
      const merged = await PDFEngine.mergePDFs(state.merge.items, {
        yieldControl: nextTick,
        onProgress({ percent, item }) { setMergeStatus(percent, `正在加入 ${item.file.name}（${item.pages} 頁）`); },
      });
      setMergeStatus(94, '正在產生整合後的 PDF…');
      const { bytes, pages: totalPages } = merged;
      const filename = `${cleanName($('merge-output-name').value)}.pdf`;
      state.merge.result = { ...addDownloadData(bytes, filename), pages: totalPages };
      $('merge-result-name').textContent = filename;
      $('merge-result-info').textContent = `${fmtNumber(totalPages)} 頁 · ${fmtMB(bytes.length)} · ${state.merge.items.length} 份文件合併`;
      $('merge-result-caption').textContent = `${state.merge.items.length} 份文件已依指定順序合併，總共 ${fmtNumber(totalPages)} 頁。`;
      $('merge-results').hidden = false;
      setMergeStatus(100, '合併完成');
      $('merge-results').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) { alertUser(readableError(error)); }
    finally { state.merge.working = false; $('merge-status').hidden = true; renderMergeQueue(); }
  });
  $('merge-download').addEventListener('click', () => { if (state.merge.result) downloadUrl(state.merge.result.url, state.merge.result.name); });
  $('merge-to-split').addEventListener('click', async () => {
    const result = state.merge.result;
    if (!result || state.split.working) return;
    changeMode('split');
    await chooseSplitFile([new File([result.bytes], result.name, { type: 'application/pdf' })]);
    $('split-upload').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  function compressSettings() {
    const mb = Number($('compress-max-mb').value);
    const minDpi = Number($('compress-min-dpi').value);
    if (!Number.isFinite(mb) || mb < 0.01 || mb > 2048 || ![48, 72, 96, 150].includes(minDpi)) return null;
    return { limit: Math.round(mb * 1_000_000), mb, minDpi, allowRaster: $('compress-allow-raster').checked };
  }
  function clearCompressResults() {
    revokeResult(state.compress.result); state.compress.result = null;
    $('compress-results').hidden = true;
  }
  function updateCompressSummary() {
    const s = state.compress, settings = compressSettings(), busy = s.working || s.loading;
    $('compress-metric-file').textContent = s.source?.file.name || '尚未選取';
    $('compress-metric-pages').textContent = s.source ? `${fmtNumber(s.source.pages)} 頁` : '—';
    $('compress-metric-size').textContent = s.source ? fmtMB(s.source.bytes.length) : '—';
    $('compress-metric-limit').textContent = settings ? fmtMB(settings.limit) : '設定無效';
    $('compress-start').disabled = busy || !s.source || !settings || !window.PDFCompressor;
    for (const id of ['compress-max-mb', 'compress-min-dpi', 'compress-allow-raster', 'compress-remove', 'compress-file-input']) $(id).disabled = busy;
    $('compress-dropzone').setAttribute('aria-disabled', String(busy));
  }
  function setCompressStatus(percent, detail) {
    const p = Math.round(Math.max(0, Math.min(100, percent)));
    $('compress-status').hidden = false;
    $('compress-percent').textContent = `${p}%`;
    $('compress-progress').style.width = `${p}%`;
    $('compress-status-detail').textContent = detail;
  }
  async function chooseCompressFile(files) {
    const s = state.compress;
    if (s.working || s.loading) return;
    const file = files[0];
    if (!validPDF(file)) { alertUser('請選擇 PDF 檔案（副檔名 .pdf）。'); return; }
    s.loading = true; s.source = null; ++s.loadId;
    clearCompressResults(); $('compress-chosen').hidden = true;
    updateCompressSummary(); setCompressStatus(0, '正在檢查 PDF 頁數與來源容量…');
    try {
      const parsed = await openPDF(file);
      if (!parsed.pages) throw new Error('PDF 沒有任何頁面');
      s.source = parsed;
      $('compress-name').textContent = file.name;
      $('compress-info').textContent = `${fmtNumber(parsed.pages)} 頁 · ${fmtMB(file.size)} · ${fmtNumber(file.size)} bytes`;
      $('compress-chosen').hidden = false;
    } catch (error) { alertUser(readableError(error)); }
    finally { s.loading = false; $('compress-status').hidden = true; updateCompressSummary(); }
  }
  setupDropzone($('compress-dropzone'), $('compress-file-input'), chooseCompressFile);
  $('compress-remove').addEventListener('click', () => {
    if (state.compress.working || state.compress.loading) return;
    state.compress.source = null; clearCompressResults(); $('compress-chosen').hidden = true; updateCompressSummary();
  });
  for (const id of ['compress-max-mb', 'compress-min-dpi', 'compress-allow-raster']) {
    $(id).addEventListener(id === 'compress-max-mb' ? 'input' : 'change', () => {
      clearCompressResults(); $('compress-raster-options').hidden = !$('compress-allow-raster').checked; updateCompressSummary();
    });
  }
  $('compress-start').addEventListener('click', async () => {
    const s = state.compress, settings = compressSettings();
    if (!s.source || !settings || s.working || s.loading || state.split.working || state.merge.working) return;
    s.working = true; s.cancelled = false; clearCompressResults(); updateCompressSummary();
    $('compress-cancel').hidden = false; $('compress-cancel').disabled = false; $('compress-cancel').textContent = '取消壓縮';
    setCompressStatus(0, '準備縮小 PDF…');
    try {
      const result = await window.PDFCompressor.compressToSize(s.source, settings.limit, {
        allowRaster: settings.allowRaster, minDpi: settings.minDpi,
        checkCancelled() { if (s.cancelled) throw new Error('__CANCELLED__'); },
        yieldControl: nextTick, onProgress({ percent, detail }) { setCompressStatus(percent, detail); },
      });
      if (s.cancelled) throw new Error('__CANCELLED__');
      const filename = `${cleanName(s.source.file.name)}_${result.method === 'original' ? '原檔' : '壓縮'}.pdf`;
      s.result = { ...result, ...addDownloadData(result.bytes, filename) };
      $('compress-result-title').textContent = result.metTarget ? '符合容量限制 ✓' : '尚未達到容量限制';
      $('compress-result-title').classList.toggle('unmet', !result.metTarget);
      $('compress-result-caption').textContent = `目標 ≤ ${fmtNumber(settings.limit)} bytes（${settings.mb} MB）；輸出 ${fmtNumber(result.bytes.length)} bytes。${result.metTarget ? '已確認符合設定上限。' : '目前可取得的最小結果仍超過上限，可調高限制或改用分割。'}`;
      $('compress-result-size').textContent = fmtMB(result.bytes.length);
      $('compress-result-saving').textContent = `${Math.max(0, (1 - result.bytes.length / s.source.bytes.length) * 100).toFixed(1)}%`;
      $('compress-result-pages').textContent = `${result.pages} 頁`;
      const method = result.method === 'original' ? '提供原始檔案（未變更內容）。' : result.method === 'rewrite' ? '已保留文字與向量，重新封裝 PDF；未降低圖面解析度。' : `已影像化：${result.dpi} dpi、JPEG 品質 ${Math.round(result.quality * 100)}%。原文字無法選取／搜尋；下載後請核對細字、尺寸線與註解外觀。`;
      $('compress-result-method').textContent = method + (result.method === 'original' && !result.metTarget && !settings.allowRaster ? ' 若要進一步縮小，可勾選同意影像化後再試。' : '');
      $('compress-results').hidden = false;
      $('compress-results').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      if (error.message === '__CANCELLED__') alertUser('已取消壓縮，原始 PDF 沒有變更。');
      else alertUser(error?.message || '壓縮失敗，請保留原檔並重新嘗試。');
    } finally {
      s.working = false; $('compress-cancel').hidden = true; $('compress-status').hidden = true; updateCompressSummary();
    }
  });
  $('compress-cancel').addEventListener('click', () => {
    state.compress.cancelled = true; $('compress-cancel').disabled = true; $('compress-cancel').textContent = '正在取消…';
  });
  $('compress-download').addEventListener('click', () => {
    if (state.compress.result) downloadUrl(state.compress.result.url, state.compress.result.name);
  });

  window.addEventListener('pagehide', () => {
    state.split.parts.forEach(revokeResult);
    revokeResult(state.merge.result);
    revokeResult(state.compress.result);
  });
  if (!PDFEngine || !ZIP) {
    $('split-start').disabled = true; $('merge-start').disabled = true;
    alertUser('必要的 PDF 處理元件沒有載入。請重新整理網站，或下載離線單檔版使用。');
  }
  updateSplitSummary(); updateMergeSummary(); updateCompressSummary();
})();
