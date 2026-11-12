/* PDF compression: preserve original or rewrite first; rasterization requires consent. */
(function (root) {
  'use strict';
  const PDFDocument = root.PDFLib.PDFDocument;
  const scriptBase = typeof document !== 'undefined'
    ? new URL('./', document.currentScript?.src || document.baseURI).href : '';
  let rendererPromise;
  const decode64 = (text) => Uint8Array.from(atob(text), c => c.charCodeAt(0));
  async function loadRenderer() {
    if (!rendererPromise) rendererPromise = (async () => {
      const embedded = document.getElementById('pdfjs-offline-data');
      let pack, moduleUrl, workerUrl;
      if (embedded) {
        pack = JSON.parse(embedded.textContent);
        moduleUrl = URL.createObjectURL(new Blob([decode64(pack.main)], { type: 'text/javascript' }));
        workerUrl = URL.createObjectURL(new Blob([decode64(pack.worker)], { type: 'text/javascript' }));
      } else {
        const response = await fetch(new URL('./vendor/pdfjs-data.json', scriptBase));
        if (!response.ok) throw new Error('無法載入 PDF 影像處理資料，請重新整理或使用離線單檔版。');
        pack = await response.json();
        moduleUrl = new URL('./vendor/pdfjs.min.mjs', scriptBase).href;
        workerUrl = new URL('./vendor/pdfjs.worker.min.mjs', scriptBase).href;
      }
      const renderer = await import(moduleUrl);
      renderer.GlobalWorkerOptions.workerSrc = workerUrl;
      class LocalBinaryDataFactory {
        async fetch({ kind, filename }) {
          const value = pack.data[kind]?.[filename];
          if (!value) throw new Error(`缺少 PDF 解碼資源：${filename}`);
          return decode64(value);
        }
      }
      return { renderer, options: {
        BinaryDataFactory: LocalBinaryDataFactory, useWorkerFetch: false,
        cMapUrl: 'embedded-cmaps/', cMapPacked: true,
        standardFontDataUrl: 'embedded-fonts/', wasmUrl: 'embedded-wasm/',
      } };
    })().catch(error => { rendererPromise = null; throw error; });
    return rendererPromise;
  }

  async function jpegBytes(canvas, quality) {
    if (canvas.convertToBlob) return new Uint8Array(await (await canvas.convertToBlob({ type: 'image/jpeg', quality })).arrayBuffer());
    const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('無法將頁面轉為 JPEG。')), 'image/jpeg', quality));
    return new Uint8Array(await blob.arrayBuffer());
  }

  // At most six resolutions and two JPEG qualities at each resolution. Always
  // include the exact user-selected endpoints, even for custom values such as
  // 180, 240 or 350 dpi; never substitute a preset for a fixed resolution.
  function rasterPlan(mode, targetDpi, minDpi, jpegQuality) {
    if (mode === 'fixed') return [[targetDpi, jpegQuality / 100]];
    const count = targetDpi === minDpi ? 1
      : Math.min(6, Math.ceil(Math.log(targetDpi / minDpi) / Math.log(1.25)) + 1);
    const resolutions = [];
    for (let i = 0; i < count; i++) {
      const fraction = count === 1 ? 0 : i / (count - 1);
      const dpi = i === count - 1 ? minDpi
        : Math.max(minDpi, Math.round(targetDpi * (minDpi / targetDpi) ** fraction));
      if (!resolutions.includes(dpi)) resolutions.push(dpi);
    }
    const floorQuality = Math.min(32, jpegQuality);
    const plan = [];
    for (let i = 0; i < resolutions.length; i++) {
      const fraction = resolutions.length === 1 ? 0 : i / (resolutions.length - 1);
      const highQuality = Math.round(jpegQuality - (jpegQuality - Math.min(55, jpegQuality)) * fraction);
      const lowQuality = i === resolutions.length - 1 ? floorQuality
        : Math.max(floorQuality, Math.round(highQuality * .7));
      plan.push([resolutions[i], highQuality / 100]);
      if (lowQuality !== highQuality) plan.push([resolutions[i], lowQuality / 100]);
    }
    return plan;
  }

  async function compressToSize(source, byteLimit, opts = {}) {
    const {
      allowRaster = false, resolutionMode = 'auto', targetDpi = 150, minDpi = 72, jpegQuality = 82,
      onProgress = () => {}, checkCancelled = () => {},
      yieldControl = () => new Promise(resolve => setTimeout(resolve, 0)),
      createCanvas = (width, height) => {
        const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; return canvas;
      },
    } = opts;
    if (!Number.isSafeInteger(byteLimit) || byteLimit < 1) throw new Error('目標容量必須是正整數 bytes。');
    if (!['auto', 'fixed'].includes(resolutionMode)) throw new Error('解析度模式必須為自動調整或固定解析度。');
    const startDpi = Number(targetDpi);
    const floorDpi = resolutionMode === 'fixed' ? startDpi : Number(minDpi);
    const qualityPercent = Number(jpegQuality);
    if (!Number.isInteger(startDpi) || startDpi < 24 || startDpi > 600) throw new Error('影像解析度必須為 24 至 600 dpi 的整數。');
    if (!Number.isInteger(floorDpi) || floorDpi < 24 || floorDpi > 600) throw new Error('最低影像解析度必須為 24 至 600 dpi 的整數。');
    if (floorDpi > startDpi) throw new Error('自動調整的最低解析度不可高於起始解析度。');
    if (!Number.isInteger(qualityPercent) || qualityPercent < 10 || qualityPercent > 100) throw new Error('JPEG 品質必須為 10 至 100% 的整數。');
    if (!source?.bytes?.length || !source.doc || source.pages < 1) throw new Error('請先匯入有效的 PDF。');
    checkCancelled();
    let attempts = 0;
    let best = { bytes: source.bytes, pages: source.pages, method: 'original', dpi: null, quality: null };
    const finish = async () => {
      checkCancelled();
      const verified = await PDFDocument.load(best.bytes, { updateMetadata: false });
      if (verified.getPageCount() !== source.pages) throw new Error('輸出頁數驗證失敗，請保留原始檔案。');
      return { ...best, metTarget: best.bytes.length <= byteLimit, attempts };
    };
    if (best.bytes.length <= byteLimit) return finish();
    onProgress({ percent: 3, detail: '先嘗試保留文字與向量的重新封裝…' });
    await yieldControl();
    const rewritten = await source.doc.save({ useObjectStreams: true, addDefaultPage: false, objectsPerTick: 60 });
    attempts++;
    checkCancelled();
    if (rewritten.length < best.bytes.length) best = { ...best, bytes: rewritten, method: 'rewrite' };
    if (best.bytes.length <= byteLimit || !allowRaster) return finish();

    onProgress({ percent: 8, detail: '已同意影像化，正在載入本機 PDF 渲染元件…' });
    const loaded = opts.renderer ? { renderer: opts.renderer, options: opts.rendererOptions || {} } : await loadRenderer();
    checkCancelled();
    const task = loaded.renderer.getDocument({
      data: new Uint8Array(source.bytes),
      isEvalSupported: false, stopAtErrors: true, enableXfa: false,
      ...loaded.options,
    });
    let pdf;
    try {
      pdf = await task.promise;
      if (pdf.numPages !== source.pages) throw new Error('渲染頁數與來源不一致。');
      const dimensions = [];
      for (let n = 1; n <= pdf.numPages; n++) {
        checkCancelled();
        const page = await pdf.getPage(n);
        const viewport = page.getViewport({ scale: 1 });
        dimensions.push([viewport.width, viewport.height]);
        page.cleanup();
      }
      const fitsCanvas = dpi => dimensions.every(([w, h]) => {
        const width = Math.ceil(w * dpi / 72 - 1e-7), height = Math.ceil(h * dpi / 72 - 1e-7);
        return width * height <= 24_000_000 && width <= 16384 && height <= 16384;
      });
      const plan = rasterPlan(resolutionMode, startDpi, floorDpi, qualityPercent)
        .filter(([dpi]) => fitsCanvas(dpi));
      if (!plan.length) {
        if (resolutionMode === 'fixed') throw new Error(`所選 ${startDpi} dpi 超過瀏覽器可處理的畫布範圍。固定模式不會自動降低解析度；請選擇較低的 dpi，或改用自動調整。`);
        throw new Error(`圖面在設定的最低 ${floorDpi} dpi 仍超過瀏覽器畫布範圍。請選擇較低的最低解析度或改用桌面 PDF 工具。`);
      }
      for (let pass = 0; pass < plan.length; pass++) {
        const [dpi, quality] = plan[pass];
        checkCancelled();
        const output = await PDFDocument.create();
        output.setProducer('PDF 工具箱 v1.2.0（影像化壓縮）');
        for (let n = 1; n <= pdf.numPages; n++) {
          checkCancelled();
          onProgress({ percent: 10 + 82 * (pass + (n - 1) / pdf.numPages) / plan.length,
            detail: `第 ${pass + 1}/${plan.length} 次嘗試：${dpi} dpi，JPEG ${Math.round(quality * 100)}%；處理第 ${n}/${pdf.numPages} 頁` });
          await yieldControl();
          const page = await pdf.getPage(n);
          const physical = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: dpi / 72 });
          // PDF.js can return 900.0000000000001 for an exact 900 px extent.
          const width = Math.ceil(viewport.width - 1e-7), height = Math.ceil(viewport.height - 1e-7);
          if (width * height > 24_000_000 || width > 16384 || height > 16384) {
            throw new Error(`第 ${n} 頁在 ${dpi} dpi 超過瀏覽器可處理的畫布範圍。請先將大型圖說分冊或改用桌面 PDF 工具。`);
          }
          const canvas = createCanvas(width, height);
          try {
            const context = canvas.getContext('2d');
            if (!context) throw new Error('瀏覽器無法建立頁面畫布。');
            await page.render({ canvasContext: context, viewport,
              background: 'rgb(255,255,255)', annotationMode: loaded.renderer.AnnotationMode?.ENABLE ?? 1 }).promise;
            checkCancelled();
            const jpeg = await jpegBytes(canvas, quality);
            const image = await output.embedJpg(jpeg);
            const destination = output.addPage([physical.width, physical.height]);
            destination.drawImage(image, { x: 0, y: 0, width: physical.width, height: physical.height });
          } finally { canvas.width = 0; canvas.height = 0; page.cleanup(); }
        }
        checkCancelled();
        const bytes = await output.save({ useObjectStreams: true, objectsPerTick: 60 });
        attempts++;
        if (bytes.length < best.bytes.length) best = { bytes, pages: source.pages, method: 'raster', dpi, quality };
        if (best.bytes.length <= byteLimit) break;
      }
    } finally { await task.destroy(); }
    onProgress({ percent: 97, detail: '驗證實際檔案大小與完整頁數…' });
    return finish();
  }
  root.PDFCompressor = Object.freeze({ compressToSize });
})(typeof window !== 'undefined' ? window : globalThis);
