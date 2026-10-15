import * as fs from 'fs';
import * as path from 'path';

function readPngSize(filePath: string): { width: number; height: number } {
  const buffer = fs.readFileSync(filePath);
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

describe('charge HUD image assets', () => {
  test('ships image-backed charge HUD parts with matching delta badge dimensions', () => {
    const root = path.resolve(__dirname, '..');
    const counterPath = path.join(root, 'assets/images/other/charge-counter-wafu-v1.png');
    const increasePath = path.join(root, 'assets/images/other/charge-delta-increase-wafu-v1.png');
    const decreasePath = path.join(root, 'assets/images/other/charge-delta-decrease-wafu-v1.png');

    [counterPath, increasePath, decreasePath].forEach((filePath) => {
      expect(fs.existsSync(filePath)).toBe(true);
    });

    expect(readPngSize(counterPath)).toEqual({ width: 1703, height: 386 });
    expect(readPngSize(increasePath)).toEqual({ width: 1192, height: 385 });
    expect(readPngSize(decreasePath)).toEqual({ width: 1192, height: 385 });
  });
});

describe('turn arrival image assets', () => {
  const banners = [
    ['your-obsidian', 'black'],
    ['your-ivory', 'white'],
    ['enemy-ivory', 'white'],
    ['enemy-obsidian', 'black']
  ];

  test.each(banners)('ships a clean, correctly colored %s plaque', async (name, color) => {
    const sharp = require('sharp');
    const root = path.resolve(__dirname, '..');
    const pngPath = path.join(root, `assets/images/other/turn-banner-${name}-v2.png`);
    const webpPath = pngPath.replace(/\.png$/, '.webp');
    expect(readPngSize(pngPath)).toEqual({ width: 1080, height: 150 });
    expect(fs.existsSync(webpPath)).toBe(true);

    for (const filePath of [pngPath, webpPath]) {
      const { data, info } = await sharp(filePath).ensureAlpha().raw()
        .toBuffer({ resolveWithObject: true });
      expect(info.width).toBe(1080);
      expect(info.height).toBe(150);
      // Transparent margins must not contain a sheet background or another badge.
      for (let x = 0; x < info.width; x++) {
        expect(data[x * 4 + 3]).toBe(0);
        expect(data[((info.height - 1) * info.width + x) * 4 + 3]).toBe(0);
      }
      // Clear face area to the right of the title, inside the brass trim.
      const i = (75 * info.width + 940) * 4;
      expect(data[i + 3]).toBe(255);
      const luminance = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (color === 'black') expect(luminance).toBeLessThan(70);
      else expect(luminance).toBeGreaterThan(180);
    }
  });
});
