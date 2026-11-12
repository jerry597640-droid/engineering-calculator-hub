import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const dependencies = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const dependencyPath = (name) => {
  try { return require.resolve(name); } catch (error) {
    if (dependencies) return require.resolve(resolve(dependencies, name));
    throw new Error(`Missing test dependency ${name}. Install it locally or set CODEX_PRIMARY_RUNTIME_NODE_MODULES.`, { cause: error });
  }
};
const PDFLib = require(dependencyPath('pdf-lib'));
const canvasModule = require(dependencyPath('@napi-rs/canvas'));
const { PNG } = require(dependencyPath('pngjs'));
for (const name of ['DOMMatrix', 'ImageData', 'Path2D']) globalThis[name] ||= canvasModule[name];
const renderer = await import(pathToFileURL(dependencyPath('pdfjs-dist/legacy/build/pdf.mjs')).href);
const root = resolve(import.meta.dirname, '..');
const binaryPack = JSON.parse(await readFile(join(root, 'vendor/pdfjs-data.json'), 'utf8'));
assert.equal(binaryPack.version, renderer.version, 'Vendored decoding data and test renderer must match');
let embeddedAssetReads = 0;
class EmbeddedBinaryDataFactory {
  async fetch({ kind, filename }) {
    const encoded = binaryPack.data[kind]?.[filename];
    assert.ok(encoded, `Missing bundled ${kind}/${filename}`);
    embeddedAssetReads++;
    return new Uint8Array(Buffer.from(encoded, 'base64'));
  }
}
const output = process.env.PDF_QA_OUTPUT_DIR || await mkdtemp(join(tmpdir(), 'pdf-compression-qa-'));
await mkdir(output, { recursive: true });
const sandbox = { PDFLib };
// Keep PDF-Lib and array literals in the same realm for its instanceof guards.
new Function('window', await readFile(join(root, 'pdf-compress.js'), 'utf8'))(sandbox);
const { compressToSize } = sandbox.PDFCompressor;
const { PDFDocument, rgb, degrees } = PDFLib;

async function source(bytes) {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  return { bytes: new Uint8Array(bytes), doc, pages: doc.getPageCount() };
}
async function makeImageFixture() {
  const doc = await PDFDocument.create();
  let seed = 42;
  for (let n = 0; n < 3; n++) {
    const bitmap = new PNG({ width: 560, height: 560 });
    for (let i = 0; i < bitmap.data.length; i += 4) {
      for (let c = 0; c < 3; c++) { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; bitmap.data[i + c] = seed >>> 24; }
      bitmap.data[i + 3] = 255;
    }
    const image = await doc.embedPng(PNG.sync.write(bitmap, { colorType: 2 }));
    const page = doc.addPage([595.28, 841.89]);
    page.drawText(`COMPRESSION QA / Page ${n + 1}`, { x: 30, y: 805, size: 20, color: rgb(.05, .1, .2) });
    page.drawImage(image, { x: 30, y: 150, width: 535, height: 535 });
    page.drawText('Page boundary, orientation, linework and image test', { x: 30, y: 100, size: 12 });
    page.drawRectangle({ x: 15, y: 15, width: 565.28, height: 811.89, borderWidth: .5, borderColor: rgb(0, 0, 0) });
    if (n === 1) page.setRotation(degrees(90));
  }
  return source(await doc.save());
}
async function makeTextFixture() {
  const doc = await PDFDocument.create();
  doc.addPage([420, 595]).drawText('Small source must be byte-for-byte unchanged.', { x: 20, y: 550, size: 12 });
  return source(await doc.save());
}
const renderOptions = {
  allowRaster: true,
  minDpi: 72,
  renderer,
  rendererOptions: {
    BinaryDataFactory: EmbeddedBinaryDataFactory,
    standardFontDataUrl: 'embedded-fonts/',
    cMapUrl: 'embedded-cmaps/', cMapPacked: true,
    wasmUrl: 'embedded-wasm/',
    useWorkerFetch: false,
  },
  createCanvas: (width, height) => {
    const canvas = canvasModule.createCanvas(width, height);
    // napi canvas uses `mime`; browser OffscreenCanvas uses the standard `type`.
    const convertToBlob = canvas.convertToBlob.bind(canvas);
    canvas.convertToBlob = ({ type, quality }) => convertToBlob({ mime: type, quality });
    return canvas;
  },
  yieldControl: async () => {},
};
const imageSource = await makeImageFixture();
const textSource = await makeTextFixture();
await writeFile(join(output, 'compression-source-3pages.pdf'), imageSource.bytes);

const unchanged = await compressToSize(textSource, 1_000_000, renderOptions);
assert.equal(unchanged.method, 'original');
assert.equal(unchanged.attempts, 0);
assert.equal(unchanged.metTarget, true);
assert.deepEqual(Buffer.from(unchanged.bytes), Buffer.from(textSource.bytes));

// Raster permission is not implied by merely entering a smaller size.
const noConsent = await compressToSize(imageSource, 450_000, {
  renderer: { getDocument() { throw new Error('Renderer must not be called without explicit raster consent'); } },
  yieldControl: async () => {},
});
assert.equal(noConsent.metTarget, false);
assert.notEqual(noConsent.method, 'raster');
assert.ok(noConsent.bytes.length <= imageSource.bytes.length);
assert.equal((await PDFDocument.load(noConsent.bytes)).getPageCount(), 3);

const compressed = await compressToSize(imageSource, 450_000, renderOptions);
assert.equal(compressed.metTarget, true);
assert.equal(compressed.method, 'raster');
assert.ok(compressed.bytes.length <= 450_000);
const compressedDoc = await PDFDocument.load(compressed.bytes);
assert.equal(compressedDoc.getPageCount(), 3);
// PDF.js bakes /Rotate into the raster and changes physical page orientation.
assert.ok(Math.abs(compressedDoc.getPage(0).getWidth() - 595.28) < .01);
assert.ok(Math.abs(compressedDoc.getPage(1).getWidth() - 841.89) < .01);
assert.ok(Math.abs(compressedDoc.getPage(1).getHeight() - 595.28) < .01);
await writeFile(join(output, 'compression-result-450KB.pdf'), compressed.bytes);

const impossible = await compressToSize(imageSource, 100, { ...renderOptions, minDpi: 150 });
assert.equal(impossible.metTarget, false);
assert.ok(impossible.bytes.length > 100);
assert.ok(impossible.bytes.length <= imageSource.bytes.length);
assert.equal((await PDFDocument.load(impossible.bytes)).getPageCount(), 3);

let checks = 0;
await assert.rejects(() => compressToSize(imageSource, 450_000, {
  ...renderOptions,
  checkCancelled: () => { if (++checks >= 5) throw new Error('__CANCELLED__'); },
}), /__CANCELLED__/);
for (const badLimit of [0, -1, 1.5, NaN]) await assert.rejects(() => compressToSize(imageSource, badLimit), /bytes/);

console.log(JSON.stringify({
  status: 'passed', rendererVersion: renderer.version, inputBytes: imageSource.bytes.length,
  targetBytes: 450_000, outputBytes: compressed.bytes.length, outputPages: compressedDoc.getPageCount(),
  dpi: compressed.dpi, quality: compressed.quality, attempts: compressed.attempts,
  unmetTarget: { targetBytes: 100, actualBytes: impossible.bytes.length, metTarget: impossible.metTarget },
  originalPreserved: true, consentEnforced: true, rotationPreserved: true, cancellationVerified: true,
  embeddedAssetReads,
  outputDirectory: output,
}, null, 2));
