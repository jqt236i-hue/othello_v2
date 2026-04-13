const fs = require('fs');
const path = require('path');

describe('debug hand layout css', () => {
  test('debug layout keeps hand cards from shrinking inside the fling track', () => {
    const cssPath = path.join(__dirname, '..', 'styles-layout.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    expect(css).toMatch(/html\.debug-layout\s+\.hand-track\s*>\s*\.card-item,[\s\S]*flex:\s*0\s+0\s+auto/);
  });
});