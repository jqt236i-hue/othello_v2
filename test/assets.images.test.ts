import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

describe('stone image assets', () => {
  const specialStonesDir = path.join(__dirname, '..', 'assets', 'images', 'special-stones');
  const stoneSkinDir = path.join(__dirname, '..', 'assets', 'images', 'stone-skin');

  it('includes the normal stone PNGs', () => {
    assert.ok(fs.existsSync(path.join(stoneSkinDir, 'default', 'black.png')));
    assert.ok(fs.existsSync(path.join(stoneSkinDir, 'default', 'white.png')));
  });

  test('includes the TIME_STOP stone PNGs', () => {
    assert.ok(fs.existsSync(path.join(specialStonesDir, 'TIME_STOP-black.png')));
    assert.ok(fs.existsSync(path.join(specialStonesDir, 'TIME_STOP-white.png')));
  });

  it('declares CSS variables for the normal stone images', () => {
    const variablesCss = fs.readFileSync(path.join(__dirname, '..', 'styles-variables.css'), 'utf8');
    assert.ok(variablesCss.includes('--normal-stone-black-image'));
    assert.ok(variablesCss.includes('--normal-stone-white-image'));
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
