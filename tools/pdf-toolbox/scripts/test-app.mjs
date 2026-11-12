import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile, mkdir, mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, extname } from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const dependencies = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const dependency = (name) => {
  try { return require(name); } catch (error) {
    if (dependencies) return require(resolve(dependencies, name));
    throw new Error(`Missing test dependency ${name}. Install it locally or set CODEX_PRIMARY_RUNTIME_NODE_MODULES.`, { cause: error });
  }
};
const { PDFDocument } = dependency('pdf-lib');
const { PNG } = dependency('pngjs');
const { chromium } = dependency('playwright');
const root = resolve(import.meta.dirname, '..');
const web = root;
const output = process.env.PDF_QA_OUTPUT_DIR || await mkdtemp(join(tmpdir(), 'pdf-toolbox-qa-'));
await mkdir(output, { recursive: true });

function randomPNG(width, height) {
  const png = new PNG({ width, height });
  const data = randomBytes(width * height * 3);
  for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
    png.data[j] = data[i]; png.data[j + 1] = data[i + 1]; png.data[j + 2] = data[i + 2]; png.data[j + 3] = 255;
  }
  return PNG.sync.write(png, { colorType: 2 });
}

async function makeFixture(count, width, height, imageSize = 0) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < count; i++) {
    const page = doc.addPage([width, height]);
    if (imageSize) {
      const img = await doc.embedPng(randomPNG(imageSize, imageSize));
      page.drawImage(img, { x: 20, y: 35, width: width - 40, height: height - 70 });
    } else {
      page.drawText(`Document page ${i + 1}`, { x: 30, y: height - 40, size: 18 });
    }
  }
  return Buffer.from(await doc.save());
}
const fixtureA = await makeFixture(5, 500, 700, 400);
const fixtureB = await makeFixture(2, 600, 800, 0);
const fixtureBig = await makeFixture(1, 500, 700, 700);
const fixtureCompression = await makeFixture(3, 595.28, 841.89, 560);
const asFile = (name, buffer) => ({ name, mimeType: 'application/pdf', buffer });

const server = createServer(async (req, res) => {
  try {
    if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const requested = resolve(web, '.' + pathname.replace(/^\//, '/'));
    if (requested !== web && !requested.startsWith(web + '/')) { res.writeHead(403); res.end(); return; }
    const file = pathname === '/' ? join(web, 'index.html') : requested;
    const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.txt': 'text/plain' }[extname(file)] || 'application/octet-stream';
    const bytes = await readFile(file);
    res.setHeader('Content-Type', mime); res.writeHead(200); res.end(bytes);
  } catch { res.writeHead(404); res.end('Not found'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH || ['/usr/bin/chromium', '/usr/bin/google-chrome', chromium.executablePath()].find(existsSync);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}), args: ['--no-sandbox'] });
const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 1050 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (err) => errors.push(err.message));
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

try {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
  assert.match(await page.title(), /PDF 工具箱/);
  await page.screenshot({ path: join(output, 'pdf-tool-desktop.png'), fullPage: true });

  // Divide 5 pages by page count, then verify a downloaded part.
  await page.setInputFiles('#split-file-input', asFile('五頁圖說.pdf', fixtureA));
  await assertEventually(page, '#split-metric-pages', '5 頁');
  await page.locator('#split-view .rule-choice').nth(1).click();
  await page.locator('#split-max-pages').fill('2');
  await page.locator('#split-start').click();
  await page.locator('#split-results').waitFor({ state: 'visible', timeout: 30000 });
  assert.equal(await page.locator('.result-row').count(), 3);
  const pageDownload = await downloadResult(page, 0);
  const loadedPageResult = await PDFDocument.load(pageDownload);
  assert.equal(loadedPageResult.getPageCount(), 2);

  // Divide the same 5 pages by actual file capacity.
  await page.locator('#split-view .rule-choice').nth(0).click();
  await page.locator('#split-max-mb').fill('1');
  await page.locator('#split-start').click();
  await page.locator('#split-results').waitFor({ state: 'visible', timeout: 60000 });
  const capacityParts = await page.locator('.result-row').count();
  assert.ok(capacityParts >= 2, 'Capacity splitting should create multiple parts');
  for (let i = 0; i < capacityParts; i++) {
    const data = await downloadResult(page, i);
    assert.ok(data.length <= 1_000_000, `Part ${i} exceeds target: ${data.length}`);
  }

  // A one-page document that is too large must be visibly flagged.
  await page.setInputFiles('#split-file-input', asFile('單張大圖.pdf', fixtureBig));
  await assertEventually(page, '#split-metric-pages', '1 頁');
  await page.locator('#split-max-mb').fill('0.5');
  await page.locator('#split-start').click();
  await page.locator('#split-results').waitFor({ state: 'visible', timeout: 60000 });
  assert.equal(await page.locator('.result-row').count(), 1);
  assert.match(await page.locator('.result-row').innerText(), /單頁超出上限/);

  // Merge two PDFs; move the second to the first slot and verify page dimensions.
  await page.locator('#tab-merge').click();
  await page.setInputFiles('#merge-file-input', [asFile('圖說A.pdf', fixtureA), asFile('封面B.pdf', fixtureB)]);
  await page.locator('.merge-row').last().waitFor({ state: 'visible' });
  assert.equal(await page.locator('.merge-row').count(), 2);
  await page.locator('.merge-row').nth(1).getByRole('button', { name: /上移/ }).click();
  await page.locator('#merge-output-name').fill('工程圖說合併');
  await page.locator('#merge-start').click();
  await page.locator('#merge-results').waitFor({ state: 'visible', timeout: 60000 });
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#merge-download').click()]);
  const bytes = await readFile(await download.path());
  const joined = await PDFDocument.load(bytes);
  assert.equal(joined.getPageCount(), 7);
  assert.equal(Math.round(joined.getPage(0).getWidth()), 600);
  assert.equal(Math.round(joined.getPage(2).getWidth()), 500);

  // Move merged result into the splitter without uploading.
  await page.locator('#merge-to-split').click();
  await assertEventually(page, '#split-metric-pages', '7 頁');
  await page.locator('#split-view .rule-choice').nth(1).click();
  await page.locator('#split-max-pages').fill('3');
  await page.locator('#split-start').click();
  await page.locator('#split-results').waitFor({ state: 'visible', timeout: 60000 });
  assert.equal(await page.locator('.result-row').count(), 3);

  // No lossy processing without consent; then verify the actual downloaded PDF.
  await page.locator('#tab-compress').click();
  assert.equal(await page.locator('#compress-allow-raster').isChecked(), false);
  await page.setInputFiles('#compress-file-input', asFile('壓縮三頁.pdf', fixtureCompression));
  await assertEventually(page, '#compress-metric-pages', '3 頁');
  await page.locator('#compress-max-mb').fill('0.45');
  await page.locator('#compress-start').click();
  await page.locator('#compress-results').waitFor({ state: 'visible', timeout: 30000 });
  assert.match(await page.locator('#compress-results').innerText(), /尚未達到容量限制/);
  const noConsentBytes = await downloadCompression(page);
  assert.ok(noConsentBytes.length <= fixtureCompression.length);
  assert.ok(noConsentBytes.length > 450_000);
  await page.locator('#compress-allow-raster').check();
  await page.locator('#compress-start').click();
  await page.locator('#compress-results').waitFor({ state: 'visible', timeout: 120000 });
  const compressedBytes = await downloadCompression(page);
  assert.ok(compressedBytes.length <= 450_000);
  assert.equal((await PDFDocument.load(compressedBytes)).getPageCount(), 3);
  await page.screenshot({ path: join(output, 'pdf-compression-desktop.png'), fullPage: true });

  // A file already below target is returned without byte changes.
  await page.setInputFiles('#compress-file-input', asFile('小型文字檔.pdf', fixtureB));
  await assertEventually(page, '#compress-metric-pages', '2 頁');
  await page.locator('#compress-start').click();
  await page.locator('#compress-results').waitFor({ state: 'visible', timeout: 30000 });
  assert.deepEqual(await downloadCompression(page), fixtureB);

  await page.setViewportSize({ width: 390, height: 844 });
  for (const mode of ['split', 'merge', 'compress']) {
    await page.locator(`#tab-${mode}`).click();
    const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    assert.ok(noOverflow, `Mobile ${mode} layout has horizontal overflow`);
  }
  await page.screenshot({ path: join(output, 'pdf-tool-mobile.png'), fullPage: true });

  // Exercise the complete offline bundle while HTTP(S) is explicitly blocked.
  const offline = await context.newPage();
  const outbound = [];
  offline.on('pageerror', (err) => errors.push(`offline: ${err.message}`));
  await offline.route(/^https?:/, (route) => route.abort());
  offline.on('request', (req) => { if (/^https?:/.test(req.url())) outbound.push(req.url()); });
  await offline.goto(pathToFileURL(join(web, 'offline.html')).href, { waitUntil: 'load' });
  assert.equal(await offline.evaluate(() => !!window.PDFLib && !!window.JSZip), true);
  await offline.setInputFiles('#split-file-input', asFile('離線分割.pdf', fixtureA));
  await assertEventually(offline, '#split-metric-pages', '5 頁');
  await offline.locator('#split-view .rule-choice').nth(1).click();
  await offline.locator('#split-max-pages').fill('2');
  await offline.locator('#split-start').click();
  await offline.locator('#split-results').waitFor({ state: 'visible', timeout: 30000 });
  assert.equal(await offline.locator('.result-row').count(), 3);
  assert.equal((await PDFDocument.load(await downloadResult(offline, 0))).getPageCount(), 2);
  await offline.locator('#tab-compress').click();
  await offline.setInputFiles('#compress-file-input', asFile('離線壓縮.pdf', fixtureCompression));
  await assertEventually(offline, '#compress-metric-pages', '3 頁');
  await offline.locator('#compress-max-mb').fill('0.45');
  await offline.locator('#compress-allow-raster').check();
  await offline.locator('#compress-start').click();
  await offline.locator('#compress-results').waitFor({ state: 'visible', timeout: 120000 });
  const offlineCompressed = await downloadCompression(offline);
  assert.ok(offlineCompressed.length <= 450_000);
  assert.equal((await PDFDocument.load(offlineCompressed)).getPageCount(), 3);
  assert.deepEqual(outbound, []);
  await offline.close();

  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ status: 'passed', fixtureBytes: { a: fixtureA.length, b: fixtureB.length, oversized: fixtureBig.length, compression: fixtureCompression.length }, capacityParts, mergedPages: 7, compressedBytes: compressedBytes.length, offlineCompressedBytes: offlineCompressed.length, outboundOfflineRequests: outbound.length, screenshots: [join(output, 'pdf-tool-desktop.png'), join(output, 'pdf-compression-desktop.png'), join(output, 'pdf-tool-mobile.png')] }, null, 2));
} finally {
  await browser.close();
  server.close();
}

async function assertEventually(page, selector, text) {
  await page.waitForFunction(([id, expected]) => document.querySelector(id)?.textContent === expected, [selector, text], { timeout: 30000 });
}
async function downloadResult(page, index) {
  const [d] = await Promise.all([page.waitForEvent('download'), page.locator('.download-one').nth(index).click()]);
  return readFile(await d.path());
}
async function downloadCompression(page) {
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#compress-download').click()]);
  return readFile(await download.path());
}
