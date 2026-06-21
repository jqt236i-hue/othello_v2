import * as fs from 'fs';
import * as path from 'path';

describe('font skin bundled assets', () => {
  test('declares local font faces for every bundled game-fit font skin', () => {
    const root = path.resolve(__dirname, '..');
    const css = fs.readFileSync(path.join(root, 'styles-base.css'), 'utf8');
    const expected = [
      ['CR-Cinzel', 'cinzel-400.ttf'],
      ['CR-Shippori Mincho', 'shippori-mincho-400.ttf'],
      ['CR-Kaisei Tokumin', 'kaisei-tokumin-400.ttf'],
      ['CR-Zen Antique Soft', 'zen-antique-soft-400.ttf'],
      ['CR-Yusei Magic', 'yusei-magic-400.ttf'],
      ['CR-RocknRoll One', 'rocknroll-one-400.ttf']
    ];

    expected.forEach(([family, fileName]) => {
      expect(css).toContain(`font-family: "${family}"`);
      expect(css).toContain(`url("assets/fonts/${fileName}")`);
    });
  });

  test('ships local font files and source license notes', () => {
    const root = path.resolve(__dirname, '..');
    [
      'cinzel-400.ttf',
      'cinzel-700.ttf',
      'cinzel-900.ttf',
      'shippori-mincho-400.ttf',
      'shippori-mincho-700.ttf',
      'shippori-mincho-800.ttf',
      'kaisei-tokumin-400.ttf',
      'kaisei-tokumin-700.ttf',
      'kaisei-tokumin-800.ttf',
      'zen-antique-soft-400.ttf',
      'yusei-magic-400.ttf',
      'rocknroll-one-400.ttf',
      'OFL.txt'
    ].forEach((name) => {
      const filePath = path.join(root, 'assets', 'fonts', name);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });
});
