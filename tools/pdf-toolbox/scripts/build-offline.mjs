import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
let page = await readFile(resolve(root, 'index.html'), 'utf8');
const css = await readFile(resolve(root, 'app.css'), 'utf8');
page = page.replace(/<link rel="stylesheet" href="\.\/app\.css(?:\?[^"<>]*)?">/, () => `<style>\n${css}\n</style>`);
const resources = JSON.parse(await readFile(resolve(root, 'vendor/pdfjs-data.json'), 'utf8'));
resources.main = (await readFile(resolve(root, 'vendor/pdfjs.min.mjs'))).toString('base64');
resources.worker = (await readFile(resolve(root, 'vendor/pdfjs.worker.min.mjs'))).toString('base64');
page = page.replace('</head>', () => `<script type="application/json" id="pdfjs-offline-data">${JSON.stringify(resources)}</script>\n</head>`);
const scripts = [];
for (const name of ['vendor/pdf-lib.min.js', 'vendor/jszip.min.js', 'pdf-engine.js', 'pdf-compress.js', 'app.js']) {
  const source = await readFile(resolve(root, name), 'utf8');
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  page = page.replace(new RegExp(`<script defer src="\\./${escapedName}(?:\\?[^"<>]*)?"></script>`), '');
  scripts.push(`<script>\n${source.replace(/<\/script/gi, '<\\/script')}\n</script>`);
}
for (const [id, file] of [
  ['pdf-lib-license', 'PDF-LIB-LICENSE.txt'],
  ['jszip-license', 'JSZIP-LICENSE.txt'],
  ['pdfjs-license', 'PDFJS-LICENSE.txt'],
  ['pdfjs-third-party-licenses', 'PDFJS-THIRD-PARTY-LICENSES.txt'],
]) {
  const license = await readFile(resolve(root, 'vendor', file), 'utf8');
  scripts.unshift(`<script type="text/plain" id="${id}">${license.replace(/<\/script/gi, '<\\/script')}</script>`);
}
page = page.replace('</body>', () => scripts.join('\n') + '\n</body>');
page = page.replaceAll('href="./offline.html"', 'href="#top"');
page = page.replaceAll(' download="PDF工具箱_離線版.html"', '');
page = page.replaceAll('下載離線單檔版', '目前已是離線單檔版');
if (page.includes('<script defer src=') || page.includes('href="./app.css"')) throw new Error('Offline bundle still references an external runtime asset.');
await writeFile(resolve(root, 'offline.html'), page);
console.log(`Built standalone offline HTML (${Buffer.byteLength(page).toLocaleString()} bytes; PDF.js ${resources.version})`);
