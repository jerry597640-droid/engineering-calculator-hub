import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const dependencies = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const dependency = (name) => {
  try { return require(name); } catch (error) {
    if (dependencies) return require(resolve(dependencies, name));
    throw new Error(`Missing test dependency ${name}. Install it locally or set CODEX_PRIMARY_RUNTIME_NODE_MODULES.`, { cause: error });
  }
};
const PDFLib = dependency('pdf-lib');
const JSZip = dependency('jszip');
const { PNG } = dependency('pngjs');
const root = resolve(import.meta.dirname, '..');
const source = await readFile(resolve(root, 'pdf-engine.js'), 'utf8');
const sandbox = { PDFLib, Uint8Array, ArrayBuffer, Array };
runInNewContext(source, sandbox);
const engine = sandbox.PDFEngine;
assert.ok(engine && typeof engine.splitBySize === 'function');

function noisePNG(size) {
  const png = new PNG({ width: size, height: size });
  const rgb = randomBytes(size * size * 3);
  for (let i = 0, j = 0; i < rgb.length; i += 3, j += 4) {
    png.data[j] = rgb[i]; png.data[j + 1] = rgb[i + 1]; png.data[j + 2] = rgb[i + 2]; png.data[j + 3] = 255;
  }
  return PNG.sync.write(png, { colorType: 2 });
}
async function makePDF(pages, dims, imageSize = 0) {
  const doc = await PDFLib.PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage(dims);
    if (imageSize) {
      const img = await doc.embedPng(noisePNG(imageSize));
      page.drawImage(img, { x: 10, y: 10, width: dims[0] - 20, height: dims[1] - 20 });
    } else page.drawText(`Page ${i + 1}`);
  }
  return new Uint8Array(await doc.save());
}
const fixture = (bytes, name) => ({ name, size: bytes.length, arrayBuffer: async () => bytes.slice().buffer });
const firstFile = fixture(await makePDF(5, [500, 700], 400), '分割測試.pdf');
const secondFile = fixture(await makePDF(2, [610, 820]), '合併封面.pdf');
const oversizedFile = fixture(await makePDF(1, [500, 700], 700), '超大單頁.pdf');

const first = await engine.openPDF(firstFile);
const second = await engine.openPDF(secondFile);
assert.equal(first.pages, 5);
assert.equal(second.pages, 2);

const byPages = await engine.splitByPages(first, 2);
assert.deepEqual(Array.from(byPages, p => p.last - p.first + 1), [2, 2, 1]);
for (const p of byPages) {
  const doc = await PDFLib.PDFDocument.load(p.bytes);
  assert.equal(doc.getPageCount(), p.last - p.first + 1);
}

const bySize = await engine.splitBySize(first, 1_000_000);
assert.ok(bySize.length >= 2);
assert.equal(bySize[0].first, 1);
assert.equal(bySize.at(-1).last, 5);
for (let i = 0; i < bySize.length; i++) {
  const p = bySize[i];
  assert.ok(p.bytes.length <= 1_000_000, `PDF ${i + 1} is over the size limit`);
  if (i > 0) assert.equal(p.first, bySize[i - 1].last + 1);
  assert.equal((await PDFLib.PDFDocument.load(p.bytes)).getPageCount(), p.last - p.first + 1);
}

const oversized = (await engine.splitBySize(await engine.openPDF(oversizedFile), 500_000))[0];
assert.equal(oversized.oversized, true);
assert.equal(oversized.first, 1);
assert.equal(oversized.last, 1);
assert.ok(oversized.bytes.length > 500_000);

const unchanged = await engine.splitBySize(second, 1_000_000);
assert.equal(unchanged.length, 1);
assert.equal(unchanged[0].original, true);
assert.equal(unchanged[0].bytes.length, second.file.size);

const merged = await engine.mergePDFs([second, first]);
const loadedMerged = await PDFLib.PDFDocument.load(merged.bytes);
assert.equal(merged.pages, 7);
assert.equal(loadedMerged.getPageCount(), 7);
assert.equal(loadedMerged.getPage(0).getWidth(), 610);
assert.equal(loadedMerged.getPage(2).getWidth(), 500);

const mergedForSplit = await engine.openPDF(fixture(merged.bytes, '合併文件.pdf'));
assert.equal((await engine.splitByPages(mergedForSplit, 3)).length, 3);

const zip = new JSZip();
byPages.forEach((p, i) => zip.file(`result_${i + 1}.pdf`, p.bytes, { compression: 'STORE' }));
const zipResult = await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
assert.equal(Object.keys((await JSZip.loadAsync(zipResult)).files).length, 3);

new Function(await readFile(resolve(root, 'app.js'), 'utf8'));
new Function(await readFile(resolve(root, 'pdf-engine.js'), 'utf8'));
const offlineHTML = await readFile(resolve(root, 'offline.html'), 'utf8');
assert.ok(!offlineHTML.includes('script defer src='));
assert.ok(offlineHTML.includes('window.PDFLib') || offlineHTML.includes('PDFLib'));

console.log(JSON.stringify({ status: 'passed', byPages: byPages.map(p => p.last - p.first + 1), bySize: bySize.map(p => p.bytes.length), oversizeBytes: oversized.bytes.length, mergedPages: merged.pages, offlineBytes: Buffer.byteLength(offlineHTML) }, null, 2));
