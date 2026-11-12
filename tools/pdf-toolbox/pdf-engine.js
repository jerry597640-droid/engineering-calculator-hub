/* 文件分割與合併核心。瀏覽器與測試環境共用相同算法。 */
(function (root) {
  'use strict';
  const PDFDocument = root.PDFLib.PDFDocument;

  async function openPDF(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    return { file, bytes, doc, pages: doc.getPageCount() };
  }

  async function createPagesPDF(source, firstIndex, count, checkCancelled = () => {}) {
    checkCancelled();
    const output = await PDFDocument.create();
    const indices = Array.from({ length: count }, (_, i) => firstIndex + i);
    const pages = await output.copyPages(source, indices);
    pages.forEach((page) => output.addPage(page));
    const bytes = await output.save({ useObjectStreams: true, objectsPerTick: 80 });
    checkCancelled();
    return bytes;
  }

  async function splitByPages(source, pagesPerFile, opts = {}) {
    const { onProgress = () => {}, checkCancelled = () => {}, yieldControl = async () => {} } = opts;
    const result = [];
    const total = source.pages;
    if (pagesPerFile >= total) return [{ first: 1, last: total, bytes: source.bytes, oversized: false, original: true }];
    for (let first = 0; first < total; first += pagesPerFile) {
      checkCancelled();
      const count = Math.min(pagesPerFile, total - first);
      onProgress({ percent: (first / total) * 100, first: first + 1, count, phase: 'pages' });
      await yieldControl();
      const bytes = await createPagesPDF(source.doc, first, count, checkCancelled);
      result.push({ first: first + 1, last: first + count, bytes, oversized: false });
    }
    return result;
  }

  async function splitBySize(source, byteLimit, opts = {}) {
    const { onProgress = () => {}, checkCancelled = () => {}, yieldControl = async () => {} } = opts;
    if (source.bytes.length <= byteLimit) return [{ first: 1, last: source.pages, bytes: source.bytes, oversized: false, original: true }];
    const result = [];
    const total = source.pages;
    let first = 0;
    while (first < total) {
      checkCancelled();
      let low = 1, high = total - first, bestCount = 0, bestBytes = null;
      while (low <= high) {
        checkCancelled();
        const count = Math.floor((low + high) / 2);
        onProgress({ percent: (first / total) * 100, first: first + 1, count, phase: 'testing' });
        await yieldControl();
        const bytes = await createPagesPDF(source.doc, first, count, checkCancelled);
        if (bytes.length <= byteLimit) { bestCount = count; bestBytes = bytes; low = count + 1; }
        else high = count - 1;
      }
      if (bestCount === 0) {
        onProgress({ percent: (first / total) * 100, first: first + 1, count: 1, phase: 'oversized' });
        await yieldControl();
        const bytes = await createPagesPDF(source.doc, first, 1, checkCancelled);
        result.push({ first: first + 1, last: first + 1, bytes, oversized: bytes.length > byteLimit });
        first += 1;
      } else {
        result.push({ first: first + 1, last: first + bestCount, bytes: bestBytes, oversized: false });
        first += bestCount;
      }
    }
    return result;
  }

  async function mergePDFs(items, opts = {}) {
    const { onProgress = () => {}, yieldControl = async () => {} } = opts;
    const joined = await PDFDocument.create();
    let pages = 0;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      onProgress({ percent: (i / items.length) * 90, item, index: i });
      await yieldControl();
      const copied = await joined.copyPages(item.doc, item.doc.getPageIndices());
      copied.forEach((page) => joined.addPage(page));
      pages += item.pages;
    }
    const bytes = await joined.save({ useObjectStreams: true, objectsPerTick: 80 });
    return { bytes, pages };
  }

  root.PDFEngine = Object.freeze({ openPDF, createPagesPDF, splitByPages, splitBySize, mergePDFs });
})(typeof window !== 'undefined' ? window : globalThis);
