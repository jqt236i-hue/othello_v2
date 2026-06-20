import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

const { PNG } = require('pngjs');

type AlphaBounds = {
  width: number;
  height: number;
};

function readAlphaBounds(filePath: string): AlphaBounds {
  const png = PNG.sync.read(fs.readFileSync(filePath));
  let minX = png.width;
  let minY = png.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const alpha = png.data[(y * png.width + x) * 4 + 3];
      if (alpha === 0) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  assert.ok(maxX >= minX && maxY >= minY, `${filePath} should contain visible pixels`);
  return {
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}

describe('stone image assets', () => {
  const stonesDir = path.join(__dirname, '..', 'assets', 'images', 'stones');
  const stoneSkinDir = path.join(__dirname, '..', 'assets', 'images', 'stone-skin');

  it('includes the normal stone PNGs', () => {
    assert.ok(fs.existsSync(path.join(stonesDir, 'normal_stone-black.png')));
    assert.ok(fs.existsSync(path.join(stonesDir, 'normal_stone-white.png')));
  });

  test('includes the TIME_STOP stone PNGs', () => {
    assert.ok(fs.existsSync(path.join(stonesDir, 'TIME_STOP-black.png')));
    assert.ok(fs.existsSync(path.join(stonesDir, 'TIME_STOP-white.png')));
  });

  it('includes the promoted strongest-stone PNGs used after 強い意志 evolves', () => {
    assert.ok(fs.existsSync(path.join(stonesDir, 'absolute_protect_next_stone-black.png')));
    assert.ok(fs.existsSync(path.join(stonesDir, 'absolute_protect_next_stone-white.png')));
  });

  it('declares CSS variables for the normal stone images', () => {
    const variablesCss = fs.readFileSync(path.join(__dirname, '..', 'styles-variables.css'), 'utf8');
    assert.ok(variablesCss.includes('--normal-stone-black-image'));
    assert.ok(variablesCss.includes('--normal-stone-white-image'));
  });

  it('keeps the default jade rim stone images at the same visible size', () => {
    const blackBounds = readAlphaBounds(path.join(stoneSkinDir, 'jade-rim', 'black.png'));
    const whiteBounds = readAlphaBounds(path.join(stoneSkinDir, 'jade-rim', 'white.png'));

    assert.deepStrictEqual(whiteBounds, blackBounds);
    assert.ok(whiteBounds.width >= 117);
    assert.ok(whiteBounds.height >= 119);
  });

  it('uses the shared render skeleton hooks in board styles', () => {
    const boardCss = fs.readFileSync(path.join(__dirname, '..', 'styles-board.css'), 'utf8');
    assert.ok(boardCss.includes('.disc[data-render-mode="overlay"] .disc__overlay-image'));
    assert.ok(boardCss.includes('.disc[data-render-mode="replace"] .disc__overlay-image'));
  });

  it('includes a rule to hide base backgrounds when stone images are loaded', () => {
    const boardCss = fs.readFileSync(path.join(__dirname, '..', 'styles-board.css'), 'utf8');
    assert.ok(boardCss.includes('html.stone-images-loaded .disc.black'));
    assert.ok(boardCss.includes('html.stone-images-loaded .disc.white'));
  });

  it('keeps the stone-images-loaded compatibility selectors for black/white discs', () => {
    const boardCss = fs.readFileSync(path.join(__dirname, '..', 'styles-board.css'), 'utf8');
    assert.ok(boardCss.includes('html.stone-images-loaded .disc.black'));
    assert.ok(boardCss.includes('html.stone-images-loaded .disc.white'));
  });

  it('keeps HUD layers above image overlays in the shared skeleton', () => {
    const boardCss = fs.readFileSync(path.join(__dirname, '..', 'styles-board.css'), 'utf8');
    assert.ok(boardCss.includes('.disc__hud'));
    assert.ok(boardCss.includes('z-index: 40'));
    assert.ok(boardCss.includes('.disc.stone-fade-overlay'));
    assert.ok(boardCss.includes('z-index: 20'));
  });
});
