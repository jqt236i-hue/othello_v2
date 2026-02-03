const fs = require('fs');
const PNG = require('pngjs').PNG;
let pixelmatch = require('pixelmatch');
if (pixelmatch && pixelmatch.default) pixelmatch = pixelmatch.default;

const img1 = PNG.sync.read(fs.readFileSync('tests/visual-regression/baseline-board.png'));
const img2 = PNG.sync.read(fs.readFileSync('tests/visual-regression/fallback-board.png'));
const { width, height } = img1;
const diff = new PNG({ width, height });
const num = pixelmatch(img1.data, img2.data, diff.data, width, height, { threshold: 0.1 });
fs.writeFileSync('tests/visual-regression/diff.png', PNG.sync.write(diff));
console.log('diff pixels:', num);
if (num > 0) process.exit(0); else process.exit(0);
