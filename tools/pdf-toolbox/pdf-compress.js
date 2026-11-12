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

  async function compressToSize(source, byteLimit, opts = {}) {
    const {
      allowRaster = false, minDpi = 72,
      onProgress = () => {}, checkCancelled = () => {},
      yieldControl = () => new Promise(resolve => setTimeout(resolve, 0)),
      createCanvas = (width, height) => {
        const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; return canvas;
      },
    } = opts;
    if (!Number.isSafeInteger(byteLimit) || byteLimit < 1) throw new Error('目標容量必須是正整數 bytes。');
    if (![48, 72, 96, 150].includes(Number(minDpi))) throw new Error('最低解析度必須為 48、72、96 或 150 dpi。');
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
        const width = Math.ceil(w * dpi / 72), height = Math.ceil(h * dpi / 72);
        return width * height <= 24_000_000 && width <= 16384 && height <= 16384;
      });
      const plan = [[150, .82], [150, .58], [120, .62], [96, .55], [72, .43], [48, .32]]
        .filter(([dpi]) => dpi >= Number(minDpi) && fitsCanvas(dpi));
      if (!plan.length) throw new Error('圖面在設定的最低解析度仍超過瀏覽器畫布範圍。請選擇較低的最低解析度或改用桌面 PDF 工具。');
      for (let pass = 0; pass < plan.length; pass++) {
        const [dpi, quality] = plan[pass];
        checkCancelled();
        const output = await PDFDocument.create();
        output.setProducer('PDF 工具箱 v1.1（影像化壓縮）');
        for (let n = 1; n <= pdf.numPages; n++) {
          checkCancelled();
          onProgress({ percent: 10 + 82 * (pass + (n - 1) / pdf.numPages) / plan.length,
            detail: `第 ${pass + 1}/${plan.length} 次嘗試：${dpi} dpi，JPEG ${Math.round(quality * 100)}%；處理第 ${n}/${pdf.numPages} 頁` });
          await yieldControl();
          const page = await pdf.getPage(n);
          const physical = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: dpi / 72 });
          const width = Math.ceil(viewport.width), height = Math.ceil(viewport.height);
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
