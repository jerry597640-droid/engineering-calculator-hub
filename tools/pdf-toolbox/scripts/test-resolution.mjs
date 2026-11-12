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
  ...[23, 1201, 180.5, NaN].map(targetDpi => ({ targetDpi })),
  ...[23, 1201, 72.5, NaN].map(minDpi => ({ minDpi })),
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

// A real uncompressed RGB scan keeps the source large enough to exercise the
// raster result instead of the intentional "keep the smaller original" path.
async function highResolutionFixture() {
  const width = 1200, height = 1600;
  const pixels = new Uint8Array(width * height * 3);
  const colors = [[220, 40, 50], [40, 180, 65], [45, 75, 220], [230, 185, 35]];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const color = colors[(y >= height / 2 ? 2 : 0) + (x >= width / 2 ? 1 : 0)];
    pixels.set(color, (y * width + x) * 3);
  }
  const doc = await PDFDocument.create();
  const imageRef = doc.context.register(doc.context.stream(pixels, {
    Type: 'XObject', Subtype: 'Image', Width: width, Height: height,
    ColorSpace: 'DeviceRGB', BitsPerComponent: 8,
  }));
  const imageName = PDFName.of('UncompressedScan');
  const dimensions = [[210 / 25.4 * 72, 297 / 25.4 * 72], [612, 792]];
  for (let i = 0; i < dimensions.length; i++) {
    const [w, h] = dimensions[i], page = doc.addPage([w, h]);
    page.node.setXObject(imageName, imageRef);
    page.pushOperators(PDFLib.pushGraphicsState(), PDFLib.concatTransformationMatrix(w, 0, 0, h, 0, 0),
      PDFLib.drawObject(imageName), PDFLib.popGraphicsState());
    page.drawLine({ start: { x: 0, y: 0 }, end: { x: w, y: h }, thickness: 2, color: PDFLib.rgb(0, 0, 0) });
    page.drawLine({ start: { x: 0, y: h * .35 }, end: { x: w, y: h * .65 }, thickness: 1, color: PDFLib.rgb(1, 1, 1) });
    if (i === 1) {
      page.setCropBox(48, 60, 360, 480);
      page.setRotation(PDFLib.degrees(90));
      page.node.set(PDFName.of('UserUnit'), PDFLib.PDFNumber.of(1.25));
    }
  }
  return source(await doc.save());
}

const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-6,
  `${message}: expected ${expected}, actual ${actual}`);
const multiply = (a, b) => [
  a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5],
];
async function verifyTileGeometry(bytes, dpi, expectedPages) {
  const doc = await PDFDocument.load(bytes), evidence = [];
  assert.equal(doc.getPageCount(), expectedPages.length);
  for (const [pageIndex, page] of doc.getPages().entries()) {
    const [expectedWidth, expectedHeight] = expectedPages[pageIndex];
    close(page.getWidth(), expectedWidth, 'Visible page width');
    close(page.getHeight(), expectedHeight, 'Visible page height');
    assert.equal(page.getRotation().angle, 0, 'Visible rotation is baked into the image tiles');
    const objects = page.node.Resources().lookup(PDFName.of('XObject'));
    const contents = page.node.Contents();
    const streams = contents instanceof PDFLib.PDFArray
      ? Array.from({ length: contents.size() }, (_, i) => contents.lookup(i)) : [contents];
    const content = streams.map(stream => Buffer.from(PDFLib.decodePDFRawStream(stream).decode()).toString()).join('\n');
    let matrix = [1, 0, 0, 1, 0, 0];
    const stack = [], tiles = [];
    for (const line of content.split(/\r?\n/).map(line => line.trim()).filter(Boolean)) {
      if (line === 'q') stack.push([...matrix]);
      else if (line === 'Q') matrix = stack.pop();
      else if (line.endsWith(' cm')) matrix = multiply(matrix, line.split(/\s+/).slice(0, 6).map(Number));
      else if (line.endsWith(' Do')) {
        const name = PDFName.of(line.split(/\s+/)[0].slice(1)), image = objects.lookup(name);
        const width = image.dict.get(PDFName.of('Width')).asNumber();
        const height = image.dict.get(PDFName.of('Height')).asNumber();
        assert.ok(width > 0 && width <= 2048 && height > 0 && height <= 2048, 'Every canvas stays within the bounded tile size');
        close(matrix[0], width * 72 / dpi, 'Exact horizontal pixel density');
        close(matrix[3], height * 72 / dpi, 'Exact vertical pixel density');
        close(matrix[1], 0, 'No tile skew'); close(matrix[2], 0, 'No tile skew');
        const x = matrix[4] * dpi / 72;
        const y = (page.getHeight() - matrix[5] - matrix[3]) * dpi / 72;
        close(x, Math.round(x), 'Horizontal tile origin is on the shared pixel grid');
        close(y, Math.round(y), 'Vertical tile origin is on the shared pixel grid');
        tiles.push({ x: Math.round(x), y: Math.round(y), width, height });
      }
    }
    assert.equal(stack.length, 0);
    const pixelWidth = Math.ceil(expectedWidth * dpi / 72 - 1e-7);
    const pixelHeight = Math.ceil(expectedHeight * dpi / 72 - 1e-7);
    const rows = new Map();
    for (const tile of tiles) rows.set(tile.y, [...(rows.get(tile.y) || []), tile]);
    let bottom = 0, coveredPixels = 0;
    for (const [top, row] of [...rows].sort((a, b) => a[0] - b[0])) {
      assert.equal(top, bottom, 'Rows cover the page with no gap or overlap');
      row.sort((a, b) => a.x - b.x);
      let right = 0;
      for (const tile of row) {
        assert.equal(tile.x, right, 'Columns cover the page with no gap or overlap');
        assert.equal(tile.height, row[0].height);
        right += tile.width; coveredPixels += tile.width * tile.height;
      }
      assert.equal(right, pixelWidth); bottom += row[0].height;
    }
    assert.equal(bottom, pixelHeight);
    assert.equal(coveredPixels, pixelWidth * pixelHeight, 'Every required output pixel is present exactly once');
    evidence.push({ physicalWidth: expectedWidth, physicalHeight: expectedHeight,
      pixelWidth, pixelHeight, coveredPixels, tiles: tiles.length });
  }
  return evidence;
}

async function renderVisiblePages(bytes) {
  const task = renderer.getDocument({ data: new Uint8Array(bytes), ...options([]).rendererOptions });
  try {
    const pdf = await task.promise, pages = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n), viewport = page.getViewport({ scale: 1 });
      const canvas = canvasModule.createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      try {
        const context = canvas.getContext('2d');
        await page.render({ canvasContext: context, viewport, background: 'rgb(255,255,255)' }).promise;
        pages.push({ width: canvas.width, height: canvas.height,
          pixels: new Uint8Array(context.getImageData(0, 0, canvas.width, canvas.height).data) });
      } finally { canvas.width = 0; canvas.height = 0; page.cleanup(); }
    }
    return pages;
  } finally { await task.destroy(); }
}

console.log('Checking A4 high-DPI tiles, cropped/rotated UserUnit page, and actual exported geometry…');
const highInput = await highResolutionFixture();
const expectedPages = [[210 / 25.4 * 72, 297 / 25.4 * 72], [600, 450]];
const referencePages = await renderVisiblePages(highInput.bytes), highDpiCases = [];
for (const dpi of [720, 1200]) {
  const calls = [];
  const result = await compressToSize(highInput, 100, options(calls, {
    resolutionMode: 'fixed', targetDpi: dpi, jpegQuality: 67,
  }));
  assert.equal(result.method, 'raster', 'The actual downloaded candidate must contain the requested high-resolution tiles');
  assert.equal(result.dpi, dpi); assert.equal(result.quality, .67); assert.equal(result.metTarget, false);
  const pages = await verifyTileGeometry(result.bytes, dpi, expectedPages);
  assert.equal(calls.length, pages.reduce((sum, page) => sum + page.tiles, 0));
  const rendered = await renderVisiblePages(result.bytes);
  const comparison = rendered.map((page, index) => {
    const reference = referencePages[index];
    assert.equal(page.width, reference.width); assert.equal(page.height, reference.height);
    let absoluteError = 0;
    for (let offset = 0; offset < page.pixels.length; offset++) if (offset % 4 !== 3) {
      absoluteError += Math.abs(page.pixels[offset] - reference.pixels[offset]);
    }
    const meanRgbError = absoluteError / (page.width * page.height * 3);
    assert.ok(meanRgbError < 5, `Page ${index + 1}: crop, rotation, or tile continuity changed (RGB error ${meanRgbError})`);
    return { page: index + 1, meanRgbError };
  });
  await writeFile(join(output, `fixed-${dpi}dpi-A4-crop-rotation.pdf`), result.bytes);
  highDpiCases.push({ dpi, quality: 67, outputBytes: result.bytes.length, pages, comparison });
}

// Cancellation is honored between tiles, before the next canvas allocation.
const cancelledCalls = [], canvases = [];
let cancelled = false;
const cancelledOptions = options(cancelledCalls, {
  resolutionMode: 'fixed', targetDpi: 1200, jpegQuality: 67,
  onProgress(progress) { if (progress.detail.includes('第 2/')) cancelled = true; },
  checkCancelled() { if (cancelled) throw new Error('CANCELLED_TEST'); },
});
const makeCanvas = cancelledOptions.createCanvas;
cancelledOptions.createCanvas = (w, h) => { const canvas = makeCanvas(w, h); canvases.push(canvas); return canvas; };
await assert.rejects(() => compressToSize(highInput, 100, cancelledOptions), /CANCELLED_TEST/);
assert.equal(canvases.length, 1, 'Cancellation prevents allocation of another tile');
assert.equal(cancelledCalls.length, 1);
assert.ok(canvases.every(canvas => canvas.width <= 1 && canvas.height <= 1), 'Cancellation releases the previous canvas');

// A4 alone fits 1200 dpi; eight A4 pages exceed the whole-document budget.
const manyPagesDoc = await PDFDocument.create();
for (let i = 0; i < 8; i++) manyPagesDoc.addPage(expectedPages[0]);
const manyPages = await source(await manyPagesDoc.save()), manyPageCalls = [];
await assert.rejects(() => compressToSize(manyPages, 1, options(manyPageCalls, {
  resolutionMode: 'fixed', targetDpi: 1200,
})), /10 億/);
assert.equal(manyPageCalls.length, 0, 'Whole-document budget is checked before rasterization');

const evidence = {
  status: 'passed', rendererVersion: renderer.version, inputBytes: input.bytes.length,
  fixedCases, auto: { targetDpi: 241, minDpi: 137, jpegQuality: 61,
    actualDpi: automatic.dpi, actualQuality: automatic.quality, outputBytes: automatic.bytes.length,
    metTarget: automatic.metTarget, rasterAttempts: autoCalls.length, calls: autoCalls },
  invalidSettings, fixedDpiPreserved: true, actualExportedPixelsVerified: true,
  oversizedFixedRejectedWithoutFallback: true,
  highDpiInputBytes: highInput.bytes.length, highDpiCases,
  croppedRotatedUserUnitPreserved: true, exactTileCoverageVerified: true,
  cancellationBetweenTilesVerified: true, wholeDocumentBudgetVerified: true,
};
await writeFile(join(output, 'resolution-validation.json'), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
