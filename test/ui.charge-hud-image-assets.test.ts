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
  test('ships same-sized turn banners for self/enemy and black/white turn colors', () => {
    const root = path.resolve(__dirname, '..');
    const bannerPaths = [
      path.join(root, 'assets/images/other/turn-banner-your-v1.png'),
      path.join(root, 'assets/images/other/turn-banner-your-white-v1.png'),
      path.join(root, 'assets/images/other/turn-banner-enemy-v1.png'),
      path.join(root, 'assets/images/other/turn-banner-enemy-black-v1.png')
    ];

    bannerPaths.forEach((filePath) => {
      expect(fs.existsSync(filePath)).toBe(true);
    });

    expect(readPngSize(bannerPaths[0])).toEqual({ width: 720, height: 139 });
    expect(readPngSize(bannerPaths[1])).toEqual({ width: 720, height: 139 });
    expect(readPngSize(bannerPaths[2])).toEqual({ width: 720, height: 158 });
    expect(readPngSize(bannerPaths[3])).toEqual({ width: 720, height: 158 });
  });
});
