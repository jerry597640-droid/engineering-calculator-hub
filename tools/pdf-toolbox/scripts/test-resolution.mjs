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
    throw new Error(`Missing test dependency ${name}. Set CODEX_PRIMARY_RUNTIME_NODE_MODULES.`, { cause: error });
  }
};
const PDFLib = require(dependencyPath('pdf-lib'));
const canvasModule = require(dependencyPath('@napi-rs/canvas'));
const { PNG } = require(dependencyPath('pngjs'));
for (const name of ['DOMMatrix', 'ImageData', 'Path2D']) globalThis[name] ||= canvasModule[name];
const renderer = await import(pathToFileURL(dependencyPath('pdfjs-dist/legacy/build/pdf.mjs')).href);
const root = resolve(import.meta.dirname, '..');
const binaryPack = JSON.parse(await readFile(join(root, 'vendor/pdfjs-data.json'), 'utf8'));
assert.equal(binaryPack.version, renderer.version);
class EmbeddedBinaryDataFactory {
  async fetch({ kind, filename }) {
    const data = binaryPack.data[kind]?.[filename];
    assert.ok(data, `Missing bundled ${kind}/${filename}`);
    return new Uint8Array(Buffer.from(data, 'base64'));
  }
}
const sandbox = { PDFLib };
new Function('window', await readFile(join(root, 'pdf-compress.js'), 'utf8'))(sandbox);
const { compressToSize } = sandbox.PDFCompressor;
const { PDFDocument, PDFName, PDFRawStream } = PDFLib;
const output = process.env.PDF_QA_OUTPUT_DIR || await mkdtemp(join(tmpdir(), 'pdf-resolution-qa-'));
await mkdir(output, { recursive: true });

async function source(bytes) {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  return { bytes: new Uint8Array(bytes), doc, pages: doc.getPageCount() };
}
async function imageFixture() {
  const bitmap = new PNG({ width: 800, height: 800 });
  let seed = 931;
  for (let i = 0; i < bitmap.data.length; i += 4) {
    for (let c = 0; c < 3; c++) { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; bitmap.data[i + c] = seed >>> 24; }
    bitmap.data[i + 3] = 255;
  }
  const doc = await PDFDocument.create();
  const image = await doc.embedPng(PNG.sync.write(bitmap, { colorType: 2 }));
  const page = doc.addPage([216, 288]);
  page.drawImage(image, { x: 0, y: 0, width: 216, height: 288 });
  return source(await doc.save());
}
function options(calls, selected = {}) {
  return {
    allowRaster: true, renderer,
    rendererOptions: {
      BinaryDataFactory: EmbeddedBinaryDataFactory, standardFontDataUrl: 'embedded-fonts/',
      cMapUrl: 'embedded-cmaps/', cMapPacked: true, wasmUrl: 'embedded-wasm/', useWorkerFetch: false,
    },
    createCanvas(width, height) {
      const canvas = canvasModule.createCanvas(width, height);
      const convertToBlob = canvas.convertToBlob.bind(canvas);
      canvas.convertToBlob = ({ type, quality }) => {
        calls.push({ width, height, quality });
        return convertToBlob({ mime: type, quality });
      };
      return canvas;
    },
    yieldControl: async () => {},
    ...selected,
  };
}
async function embeddedImages(bytes) {
  const doc = await PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(), 1);
  assert.equal(doc.getPage(0).getWidth(), 216);
  assert.equal(doc.getPage(0).getHeight(), 288);
  return doc.context.enumerateIndirectObjects().flatMap(([, value]) => {
    if (!(value instanceof PDFRawStream) || value.dict.get(PDFName.of('Subtype'))?.toString() !== '/Image') return [];
    return [{ width: value.dict.get(PDFName.of('Width')).asNumber(), height: value.dict.get(PDFName.of('Height')).asNumber() }];
  });
}

const input = await imageFixture();
const fixedCases = [];
for (const [dpi, quality] of [[72, 82], [180, 67], [300, 82], [350, 67]]) {
  const calls = [];
  const result = await compressToSize(input, 100, options(calls, {
    resolutionMode: 'fixed', targetDpi: dpi, minDpi: 600, jpegQuality: quality,
  }));
  assert.equal(result.metTarget, false, 'An impossible byte limit must not silently change a fixed resolution');
  assert.equal(result.method, 'raster');
  assert.equal(result.dpi, dpi);
  assert.equal(result.quality, quality / 100);
  assert.equal(calls.length, 1, 'Fixed mode makes one raster attempt with the chosen settings');
  assert.deepEqual(calls[0], { width: dpi * 3, height: dpi * 4, quality: quality / 100 });
  const images = await embeddedImages(result.bytes);
  assert.deepEqual(images, [{ width: dpi * 3, height: dpi * 4 }], 'The exported PDF must contain the requested pixel resolution');
  assert.ok(result.bytes.length <= input.bytes.length);
  await writeFile(join(output, `fixed-${dpi}dpi-${quality}pct.pdf`), result.bytes);
  fixedCases.push({ dpi, quality, outputBytes: result.bytes.length, images, rasterAttempts: calls.length });
}
const low = fixedCases.find(item => item.dpi === 72);
const high = fixedCases.find(item => item.dpi === 300);
assert.ok(high.images[0].width * high.images[0].height > low.images[0].width * low.images[0].height);
assert.ok(high.outputBytes > low.outputBytes, 'At equal JPEG quality, the noise fixture should retain more data at high resolution');

const autoCalls = [];
const automatic = await compressToSize(input, 100, options(autoCalls, {
  resolutionMode: 'auto', targetDpi: 241, minDpi: 137, jpegQuality: 61,
}));
assert.equal(automatic.metTarget, false);
assert.ok(automatic.bytes.length <= input.bytes.length);
assert.ok(autoCalls.length > 1 && autoCalls.length <= 12, 'Automatic attempts must be bounded');
assert.deepEqual(autoCalls[0], { width: 723, height: 964, quality: .61 });
assert.ok(autoCalls.every(call => call.width >= 411 && call.height >= 548 && call.width <= 723 && call.height <= 964));
assert.ok(autoCalls.every(call => call.quality <= .61 && call.quality > 0));
assert.ok(autoCalls.some(call => call.width === 411 && call.height === 548), 'Custom minimum dpi must be attempted exactly');
assert.ok(automatic.dpi >= 137 && automatic.dpi <= 241);
await embeddedImages(automatic.bytes);

let invalidSettings = 0;
for (const settings of [
  { resolutionMode: 'unknown' },
  ...[23, 601, 180.5, NaN].map(targetDpi => ({ targetDpi })),
  ...[23, 601, 72.5, NaN].map(minDpi => ({ minDpi })),
  { targetDpi: 100, minDpi: 101 },
  ...[0, 9, 101, 82.5, NaN].map(jpegQuality => ({ jpegQuality })),
]) {
  await assert.rejects(() => compressToSize(input, 100, options([], settings)));
  invalidSettings++;
}

const hugeDoc = await PDFDocument.create();
hugeDoc.addPage([5000, 5000]);
const hugeSource = await source(await hugeDoc.save());
const hugeCalls = [];
await assert.rejects(() => compressToSize(hugeSource, 1, options(hugeCalls, {
  resolutionMode: 'fixed', targetDpi: 600,
})), /600|畫布|解析度/);
assert.equal(hugeCalls.length, 0, 'Oversized fixed dpi must be rejected before rendering rather than silently downscaled');

const evidence = {
  status: 'passed', rendererVersion: renderer.version, inputBytes: input.bytes.length,
  fixedCases, auto: { targetDpi: 241, minDpi: 137, jpegQuality: 61,
    actualDpi: automatic.dpi, actualQuality: automatic.quality, outputBytes: automatic.bytes.length,
    metTarget: automatic.metTarget, rasterAttempts: autoCalls.length, calls: autoCalls },
  invalidSettings, fixedDpiPreserved: true, actualExportedPixelsVerified: true,
  oversizedFixedRejectedWithoutFallback: true,
};
await writeFile(join(output, 'resolution-validation.json'), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
