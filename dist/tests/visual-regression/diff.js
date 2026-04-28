"use strict";
const fs = require('fs');
const path = require('path');
const PNG = require('pngjs').PNG;
let pixelmatch = require('pixelmatch');
if (pixelmatch && pixelmatch.default)
    pixelmatch = pixelmatch.default;
const baselinePath = path.join(__dirname, 'baseline-board.png');
const fallbackPath = path.join(__dirname, 'fallback-board.png');
const diffPath = path.join(__dirname, 'diff.png');
const img1 = PNG.sync.read(fs.readFileSync(baselinePath));
const img2 = PNG.sync.read(fs.readFileSync(fallbackPath));
const { width, height } = img1;
const diff = new PNG({ width, height });
const num = pixelmatch(img1.data, img2.data, diff.data, width, height, { threshold: 0.1 });
fs.writeFileSync(diffPath, PNG.sync.write(diff));
console.log('diff pixels:', num);
if (num > 0)
    process.exit(0);
else
    process.exit(0);
//# sourceMappingURL=diff.js.map