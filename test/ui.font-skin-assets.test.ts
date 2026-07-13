import * as fs from 'fs';
import * as path from 'path';

describe('font skin bundled assets', () => {
  test('declares local font faces for every bundled game-fit font skin', () => {
    const root = path.resolve(__dirname, '..');
    const css = fs.readFileSync(path.join(root, 'styles-base.css'), 'utf8');
    const expected = [
      ['CR-Cinzel', 'cinzel-400.woff2'],
      ['CR-Shippori Mincho', 'shippori-mincho-400.woff2'],
      ['CR-Kaisei Tokumin', 'kaisei-tokumin-400.woff2'],
      ['CR-Zen Antique Soft', 'zen-antique-soft-400.woff2'],
      ['CR-Yusei Magic', 'yusei-magic-400.woff2'],
      ['CR-RocknRoll One', 'rocknroll-one-400.woff2']
    ];

    expected.forEach(([family, fileName]) => {
      expect(css).toContain(`font-family: "${family}"`);
      expect(css).toContain(`url("assets/fonts/${fileName}")`);
    });
  });

  test('ships local font files and source license notes', () => {
    const root = path.resolve(__dirname, '..');
    const css = fs.readFileSync(path.join(root, 'styles-base.css'), 'utf8');
    [
      'cinzel-400.woff2',
      'cinzel-700.woff2',
      'cinzel-900.woff2',
      'shippori-mincho-400.woff2',
      'shippori-mincho-700.woff2',
      'shippori-mincho-800.woff2',
      'kaisei-tokumin-400.woff2',
      'kaisei-tokumin-700.woff2',
      'kaisei-tokumin-800.woff2',
      'zen-antique-soft-400.woff2',
      'yusei-magic-400.woff2',
      'rocknroll-one-400.woff2',
      'font-build-manifest.json',
      'OFL.txt'
    ].forEach((name) => {
      const filePath = path.join(root, 'assets', 'fonts', name);
      expect(fs.existsSync(filePath)).toBe(true);
    });
    expect(fs.readdirSync(path.join(root, 'assets', 'fonts')).some((name) => name.endsWith('.ttf'))).toBe(false);
    expect(css).not.toContain('.ttf');
    expect(css).toContain('format("woff2")');
  });
});
