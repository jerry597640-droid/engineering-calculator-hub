import { readFile, writeFile } from 'node:fs/promises';

const resolve = name => new URL(name, import.meta.url);
const sources = ['style.css', 'material-editor.css', 'section-editor.css'];
const styles = await Promise.all(sources.map(name => readFile(resolve(name), 'utf8')));
const css = styles.join('\n');
if (/<\/style\b/i.test(css)) throw new Error('Unexpected style closing tag in CSS');

const page = resolve('index.html');
const html = await readFile(page, 'utf8');
const block = /<style id="beamlab-styles">[\s\S]*?<\/style>/g;
if ([...html.matchAll(block)].length !== 1) throw new Error('Expected one embedded stylesheet');
const updated = html.replace(block, () => '<style id="beamlab-styles">\n' + css + '\n</style>');
if (process.argv.includes('--check')) {
  if (updated !== html) throw new Error('Run node sync-styles.mjs to update index.html');
} else if (updated !== html) {
  await writeFile(page, updated);
}
