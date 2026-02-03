const fs = require('fs');
const path = require('path');
const PNG = require('pngjs').PNG;

function checkImage(filePath) {
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(new PNG())
      .on('parsed', function() {
        const { width, height, data } = this;
        // check a 2px border for any transparent pixels
        const checkCoords = [];
        for (let x = 0; x < width; x++) {
          for (let y of [0, 1, height - 2, height - 1]) checkCoords.push([x, y]);
        }
        for (let y = 0; y < height; y++) {
          for (let x of [0, 1, width - 2, width - 1]) checkCoords.push([x, y]);
        }
        let transparentCount = 0;
        for (const [x,y] of checkCoords) {
          const idx = (width*y + x) << 2;
          const alpha = data[idx+3];
          if (alpha < 255) transparentCount++;
        }
        resolve({ file: filePath, width, height, transparentBorderPixels: transparentCount });
      })
      .on('error', reject);
  });
}

(async function(){
  const stonesDir = path.join(__dirname, '..', 'assets', 'images', 'stones');
  const files = ['normal_stone-black.png', 'normal_stone-white.png'];
  for (const f of files) {
    const p = path.join(stonesDir, f);
    if (!fs.existsSync(p)) {
      console.log(`MISSING: ${p}`);
      continue;
    }
    try {
      const r = await checkImage(p);
      console.log(JSON.stringify(r));
    } catch (e) {
      console.error('ERR', p, e.message);
    }
  }
})();
