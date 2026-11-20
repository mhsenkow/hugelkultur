// Assemble the static site Cloudflare serves at hugelkultur.ibm.io.
// The game stays in hugelkultur/ and imports the toolkit from the repo root.
// This copy flattens that layout so the domain root is the clearing.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const site = path.join(root, 'site');
const game = path.join(root, 'hugelkultur');

function copy(src, dest) {
  fs.cpSync(src, dest, { recursive: true });
}

fs.rmSync(site, { recursive: true, force: true });
fs.mkdirSync(site, { recursive: true });

const bundle = require(path.join(root, 'index.js')).bundle();
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'ink-studio.browser.js'), bundle);
fs.writeFileSync(path.join(site, 'ink-studio.browser.js'), bundle);
copy(path.join(root, 'webgl.mjs'), path.join(site, 'webgl.mjs'));
copy(path.join(root, 'src', 'webgl'), path.join(site, 'src', 'webgl'));
copy(path.join(root, 'src', 'camera-lens.js'), path.join(site, 'src', 'camera-lens.js'));

for (const name of fs.readdirSync(game)) {
  if (name === 'index.html' || name === 'main.js') continue;
  copy(path.join(game, name), path.join(site, name));
}

const htmlPath = path.join(game, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const htmlOut = html.replace('../dist/ink-studio.browser.js', './ink-studio.browser.js');
if (htmlOut === html) throw new Error('index.html no longer points at ../dist/ink-studio.browser.js');
fs.writeFileSync(path.join(site, 'index.html'), htmlOut);

const mainPath = path.join(game, 'main.js');
const main = fs.readFileSync(mainPath, 'utf8');
const mainOut = main.replace("from '../webgl.mjs'", "from './webgl.mjs'");
if (mainOut === main) throw new Error("main.js no longer imports '../webgl.mjs'");
fs.writeFileSync(path.join(site, 'main.js'), mainOut);

const bytes = fs.statSync(path.join(site, 'ink-studio.browser.js')).size;
console.log('hugelkultur site ready (' + (bytes / 1024 / 1024).toFixed(1) + ' MB renderer)');
