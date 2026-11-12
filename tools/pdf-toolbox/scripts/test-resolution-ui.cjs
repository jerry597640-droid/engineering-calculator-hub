/* DOM integration checks for detailed resolution controls; no network or raster renderer. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function dependency(name) {
  for (const base of [null, process.env.PDF_UI_NODE_MODULES, process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES]) {
    try { return require(base ? path.join(base, name) : name); } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND') throw error;
    }
  }
  throw new Error(`Missing ${name}. Install it or set PDF_UI_NODE_MODULES to its node_modules directory.`);
}
const { JSDOM, VirtualConsole } = dependency('jsdom');
const root = path.resolve(__dirname, '..');
const out = process.env.PDF_QA_OUTPUT_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-resolution-ui-'));
fs.mkdirSync(out, { recursive: true });
const browserErrors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', error => browserErrors.push(error.message));
const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), {
  url: 'https://example.test/tools/pdf-toolbox/index.html',
  runScripts: 'outside-only',
  virtualConsole,
});
const w = dom.window;
const $ = id => w.document.getElementById(id);
const event = (id, type = 'input') => $(id).dispatchEvent(new w.Event(type, { bubbles: true }));
const set = (id, value, type = 'input') => { $(id).value = String(value); event(id, type); };
const turn = () => new Promise(resolve => setImmediate(resolve));
const calls = [];
let pending;
let nextURL = 0;
w.URL.createObjectURL = () => `blob:resolution-qa-${++nextURL}`;
w.URL.revokeObjectURL = () => {};
w.HTMLElement.prototype.scrollIntoView = () => {};
w.addEventListener('error', error => browserErrors.push(error.message));
w.PDFEngine = {
  async openPDF(file) { return { file, bytes: new w.Uint8Array(2000), doc: {}, pages: 2 }; },
};
w.JSZip = function JSZip() {};
w.PDFCompressor = {
  compressToSize(source, limit, opts) {
    calls.push({ source, limit, opts });
    return new Promise((resolve, reject) => { pending = { resolve, reject }; });
  },
};
w.eval(fs.readFileSync(path.join(root, 'app.js'), 'utf8'));
const checks = [];
function check(name, run) { run(); checks.push({ name, status: 'passed' }); }

async function resolveRun(result) {
  assert.ok(pending, 'A compression operation must be pending');
  pending.resolve(result || { bytes: new w.Uint8Array(1000), pages: 2, method: 'raster', dpi: 241, quality: 0.67, metTarget: true, attempts: 1 });
  pending = null;
  await turn();
}

(async () => {
  try {
    $('tab-compress').click();
    const expectedPresets = [1200, 1000, 900, 800, 720, 600, 450, 400, 350, 300, 240, 200, 180, 150, 120, 100, 96, 90, 75, 72, 60, 50, 48, 36, 24];
    check('25 explicit DPI presets plus a custom option up to 1200 DPI', () => {
      const options = Array.from($('compress-dpi-preset').options, option => option.value);
      assert.deepEqual(options.filter(value => value !== 'custom').map(Number), expectedPresets);
      assert.equal(options.filter(value => value === 'custom').length, 1);
      assert.equal($('compress-target-dpi').step, '1');
      assert.equal($('compress-dpi-slider').step, '1');
      assert.equal($('compress-target-dpi').max, '1200');
      assert.equal($('compress-dpi-slider').max, '1200');
    });
    check('Consent gates image controls', () => {
      assert.equal($('compress-allow-raster').checked, false);
      assert.ok($('compress-target-dpi').matches(':disabled'));
      assert.ok($('compress-resolution-mode').matches(':disabled'));
      assert.equal($('compress-metric-resolution').textContent, '保留文字與向量');
    });

    const file = new w.File([new w.Uint8Array(2000)], 'resolution-controls.pdf', { type: 'application/pdf' });
    Object.defineProperty($('compress-file-input'), 'files', { configurable: true, value: [file] });
    event('compress-file-input', 'change');
    await turn();
    check('PDF import enables preserve-text processing', () => {
      assert.equal($('compress-metric-pages').textContent, '2 頁');
      assert.equal($('compress-start').disabled, false);
    });
    $('compress-allow-raster').click();
    check('Opting in enables detailed controls', () => {
      assert.equal($('compress-raster-options').disabled, false);
      assert.equal($('compress-target-dpi').matches(':disabled'), false);
      assert.equal($('compress-start').disabled, false);
    });

    for (const value of ['', '3', '35', '350']) {
      set('compress-target-dpi', value);
      assert.equal($('compress-min-dpi').value, '72', 'Partial numeric edits must not lower the chosen minimum DPI');
    }
    event('compress-target-dpi', 'change');
    check('Typing 350 one digit at a time preserves the 72 DPI floor', () => {
      assert.equal($('compress-min-dpi').value, '72');
      assert.equal($('compress-min-dpi').max, '350');
      assert.equal($('compress-metric-resolution').textContent, '350 → 72 dpi');
      assert.equal($('compress-start').disabled, false);
    });
    set('compress-target-dpi', 1200);
    event('compress-target-dpi', 'change');
    set('compress-min-dpi', 720);
    for (const value of ['', '1', '10', '100', '1000']) {
      set('compress-target-dpi', value);
      assert.equal($('compress-min-dpi').value, '720', 'High-DPI edits must preserve the chosen floor');
    }
    event('compress-target-dpi', 'change');
    check('Typing 1000 preserves a chosen 720 DPI floor', () => {
      assert.equal($('compress-metric-resolution').textContent, '1000 → 720 dpi');
      assert.equal($('compress-start').disabled, false);
    });

    for (const dpi of expectedPresets) {
      set('compress-dpi-preset', dpi, 'change');
      check(`Preset ${dpi} synchronizes number, slider and valid floor`, () => {
        assert.equal($('compress-target-dpi').value, String(dpi));
        assert.equal($('compress-dpi-slider').value, String(dpi));
        assert.ok(Number($('compress-min-dpi').value) <= dpi);
        assert.equal($('compress-start').disabled, false);
      });
    }
    set('compress-target-dpi', 241);
    check('Nonpreset integer 241 DPI synchronizes custom selector and slider', () => {
      assert.equal($('compress-dpi-preset').value, 'custom');
      assert.equal($('compress-dpi-slider').value, '241');
      assert.equal($('compress-settings-error').hidden, true);
      assert.match($('compress-resolution-preview').textContent, /1,993 × 2,818/);
    });
    set('compress-dpi-slider', 350);
    check('DPI slider synchronizes preset and numeric input', () => {
      assert.equal($('compress-target-dpi').value, '350');
      assert.equal($('compress-dpi-preset').value, '350');
    });
    set('compress-dpi-preset', 'custom', 'change');
    check('Choosing custom focuses number input without changing value', () => {
      assert.equal(w.document.activeElement, $('compress-target-dpi'));
      assert.equal($('compress-target-dpi').value, '350');
    });

    set('compress-target-dpi', 241);
    set('compress-min-dpi', 242);
    check('Explicit auto floor above target blocks processing with a visible error', () => {
      assert.equal($('compress-start').disabled, true);
      assert.equal($('compress-settings-error').hidden, false);
      assert.match($('compress-settings-error').textContent, /不得高於起始解析度/);
      assert.equal($('compress-min-dpi').getAttribute('aria-invalid'), 'true');
    });
    set('compress-min-dpi', 180);
    set('compress-target-dpi', 120);
    check('Unfinished lower DPI input preserves the floor and blocks processing', () => {
      assert.equal($('compress-min-dpi').value, '180');
      assert.equal($('compress-start').disabled, true);
    });
    event('compress-target-dpi', 'change');
    check('Lowering start DPI adjusts existing floor to the new maximum', () => {
      assert.equal($('compress-min-dpi').value, '120');
      assert.equal($('compress-min-dpi').max, '120');
      assert.equal($('compress-start').disabled, false);
    });
    set('compress-resolution-mode', 'fixed', 'change');
    set('compress-min-dpi', -1);
    check('Fixed mode hides and disables floor; irrelevant invalid floor is ignored', () => {
      assert.equal($('compress-auto-options').hidden, true);
      assert.ok($('compress-min-dpi').matches(':disabled'));
      assert.equal($('compress-start').disabled, false);
      assert.match($('compress-dpi-label').textContent, /固定解析度/);
    });
    set('compress-target-dpi', 241);
    for (const value of [-1, 23, 24.5, 1201, '']) {
      set('compress-target-dpi', value);
      check(`Invalid target DPI ${JSON.stringify(value)} is rejected`, () => {
        assert.equal($('compress-start').disabled, true);
        assert.equal($('compress-settings-error').hidden, false);
        assert.equal($('compress-target-dpi').getAttribute('aria-invalid'), 'true');
      });
    }
    set('compress-target-dpi', 241);
    for (const value of [-1, 9, 67.5, 101, '']) {
      set('compress-jpeg-quality', value);
      check(`Invalid JPEG quality ${JSON.stringify(value)} is rejected`, () => {
        assert.equal($('compress-start').disabled, true);
        assert.equal($('compress-jpeg-quality').getAttribute('aria-invalid'), 'true');
      });
    }
    set('compress-quality-slider', 67);
    check('JPEG slider sets exact integer quality', () => {
      assert.equal($('compress-jpeg-quality').value, '67');
      assert.equal($('compress-quality-value').textContent, '67%');
      assert.equal($('compress-start').disabled, false);
    });
    set('compress-jpeg-quality', 83);
    check('Numeric JPEG quality updates slider', () => assert.equal($('compress-quality-slider').value, '83'));
    set('compress-jpeg-quality', 67);
    set('compress-max-mb', 0.45);

    const countBefore = calls.length;
    $('compress-start').click();
    check('Exact fixed DPI and JPEG quality reach the compression engine', () => {
      assert.equal(calls.length, countBefore + 1);
      const call = calls.at(-1);
      assert.equal(call.limit, 450000);
      assert.equal(call.opts.allowRaster, true);
      assert.equal(call.opts.resolutionMode, 'fixed');
      assert.equal(call.opts.targetDpi, 241);
      assert.equal(call.opts.jpegQuality, 67);
    });
    const controlled = ['compress-resolution-mode', 'compress-dpi-preset', 'compress-target-dpi', 'compress-dpi-slider', 'compress-min-dpi', 'compress-jpeg-quality', 'compress-quality-slider', 'compress-max-mb', 'compress-allow-raster', 'compress-remove', 'compress-file-input'];
    check('Controls lock during compression while cancellation remains available', () => {
      for (const id of controlled) assert.ok($(id).matches(':disabled'), `${id} must be effectively disabled`);
      assert.equal($('compress-start').disabled, true);
      assert.equal($('compress-cancel').hidden, false);
      assert.equal($('compress-cancel').disabled, false);
    });
    await resolveRun();
    check('Completion restores controls and shows actual resolution and quality', () => {
      for (const id of controlled.filter(id => id !== 'compress-min-dpi')) assert.equal($(id).matches(':disabled'), false, `${id} must be restored`);
      assert.equal($('compress-start').disabled, false);
      assert.equal($('compress-cancel').hidden, true);
      assert.equal($('compress-results').hidden, false);
      assert.match($('compress-result-method').textContent, /固定模式.*實際 241 dpi、JPEG 品質 67%/);
    });

    set('compress-dpi-preset', 1200, 'change');
    $('compress-start').click();
    check('Fixed 1200 DPI reaches the engine without being capped at 600', () => {
      assert.equal(calls.at(-1).opts.targetDpi, 1200);
      assert.equal(calls.at(-1).opts.resolutionMode, 'fixed');
    });
    await resolveRun({ bytes: new w.Uint8Array(1000), pages: 2, method: 'raster', dpi: 1200, quality: 0.67, metTarget: true, attempts: 1 });
    check('Completed high-DPI result displays its actual 1200 DPI', () => {
      assert.match($('compress-result-method').textContent, /固定模式.*實際 1200 dpi/);
    });
    $('compress-start').click();
    await resolveRun({ bytes: new w.Uint8Array(2000), pages: 2, method: 'original', dpi: null, quality: null, metTarget: false, attempts: 2 });
    check('Keeping a smaller original never claims the specified high DPI was applied', () => {
      assert.match($('compress-result-caption').textContent, /指定影像設定未能產生更小的檔案/);
      assert.doesNotMatch($('compress-result-caption').textContent, /維持指定的解析度/);
      assert.match($('compress-result-method').textContent, /未套用影像解析度設定/);
    });

    set('compress-resolution-mode', 'auto', 'change');
    set('compress-min-dpi', 99);
    set('compress-target-dpi', 300);
    check('Auto mode restores floor controls and shows selected range', () => {
      assert.equal($('compress-auto-options').hidden, false);
      assert.equal($('compress-min-dpi').matches(':disabled'), false);
      assert.equal($('compress-metric-resolution').textContent, '300 → 99 dpi');
    });
    $('compress-start').click();
    check('Custom auto floor and start DPI reach engine unchanged', () => {
      const opts = calls.at(-1).opts;
      assert.equal(opts.resolutionMode, 'auto');
      assert.equal(opts.targetDpi, 300);
      assert.equal(opts.minDpi, 99);
      assert.equal(opts.jpegQuality, 67);
    });
    await resolveRun({ bytes: new w.Uint8Array(1000), pages: 2, method: 'raster', dpi: 99, quality: 0.4, metTarget: true, attempts: 5 });
    check('Auto result distinguishes actual DPI from selected start', () => assert.match($('compress-result-method').textContent, /自動模式.*實際 99 dpi、JPEG 品質 40%/));

    set('compress-target-dpi', 1201);
    set('compress-jpeg-quality', 9);
    $('compress-allow-raster').click();
    check('Turning consent off makes invalid image fields irrelevant', () => {
      assert.equal($('compress-start').disabled, false);
      assert.equal($('compress-settings-error').hidden, true);
      assert.equal($('compress-metric-resolution').textContent, '保留文字與向量');
      assert.ok($('compress-target-dpi').matches(':disabled'));
    });
    $('compress-start').click();
    check('Preserve-text path forwards safe defaults with raster disabled', () => {
      const opts = calls.at(-1).opts;
      assert.equal(opts.allowRaster, false);
      assert.equal(opts.targetDpi, 150);
      assert.equal(opts.minDpi, 72);
      assert.equal(opts.jpegQuality, 82);
    });
    await resolveRun({ bytes: new w.Uint8Array(1000), pages: 2, method: 'rewrite', dpi: null, quality: null, metTarget: true, attempts: 1 });
    check('Preserve-text result explains that DPI was not applied', () => assert.match($('compress-result-method').textContent, /未套用影像解析度設定/));
    $('compress-allow-raster').click();
    check('Re-enabling image processing restores validation of retained invalid inputs', () => {
      assert.equal($('compress-start').disabled, true);
      assert.equal($('compress-settings-error').hidden, false);
    });
    check('No DOM runtime errors', () => assert.deepEqual(browserErrors, []));

    const report = { status: 'passed', count: checks.length, checks, engineCalls: calls.map(({ limit, opts }) => ({ limit, allowRaster: opts.allowRaster, resolutionMode: opts.resolutionMode, targetDpi: opts.targetDpi, minDpi: opts.minDpi, jpegQuality: opts.jpegQuality })), limitation: 'JSDOM validates event wiring and application state; it does not verify physical layout or PDF rendering.' };
    fs.writeFileSync(path.join(out, 'resolution-ui-results.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ status: report.status, checks: report.count, engineCalls: report.engineCalls, output: path.join(out, 'resolution-ui-results.json') }, null, 2));
  } catch (error) {
    fs.writeFileSync(path.join(out, 'resolution-ui-results.json'), JSON.stringify({ status: 'failed', checks, message: error.message, stack: error.stack, browserErrors }, null, 2));
    throw error;
  } finally { dom.window.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
