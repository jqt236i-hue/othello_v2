const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('stone image assets', () => {
  const stonesDir = path.join(__dirname, '..', 'assets', 'images', 'stones');

  it('includes the normal stone PNGs', () => {
    assert.ok(fs.existsSync(path.join(stonesDir, 'normal_stone-black.png')));
    assert.ok(fs.existsSync(path.join(stonesDir, 'normal_stone-white.png')));
  });

  it('declares CSS variables for the normal stone images', () => {
    const variablesCss = fs.readFileSync(path.join(__dirname, '..', 'styles-variables.css'), 'utf8');
    assert.ok(variablesCss.includes('--normal-stone-black-image'));
    assert.ok(variablesCss.includes('--normal-stone-white-image'));
  });

  it('applies the normal stone image variables in board styles', () => {
    const boardCss = fs.readFileSync(path.join(__dirname, '..', 'styles-board.css'), 'utf8');
    assert.ok(boardCss.includes('var(--normal-stone-black-image)'));
    assert.ok(boardCss.includes('var(--normal-stone-white-image)'));
  });

  it('includes a rule to hide base backgrounds when stone images are loaded', () => {
    const boardCss = fs.readFileSync(path.join(__dirname, '..', 'styles-board.css'), 'utf8');
    assert.ok(boardCss.includes('html.stone-images-loaded .disc.black'));
    assert.ok(boardCss.includes('html.stone-images-loaded .disc.white'));
  });

  it('provides fallback overlay images for black/white discs when stone-images-loaded is active', () => {
    const boardCss = fs.readFileSync(path.join(__dirname, '..', 'styles-board.css'), 'utf8');
    assert.ok(boardCss.includes('html.stone-images-loaded .disc.black::after'));
    assert.ok(boardCss.includes('html.stone-images-loaded .disc.white::after'));
  });

  it('ensures special stone overlay (::before) has higher z-index than normal overlay', () => {
    const boardCss = fs.readFileSync(path.join(__dirname, '..', 'styles-board.css'), 'utf8');
    // Ensure special stone ::before z-index is set to 25 (above .disc::after z-index:15)
    assert.ok(boardCss.includes('.disc.special-stone::before') && boardCss.includes('z-index: 25'));
  });
});
