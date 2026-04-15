const fs = require('fs');
const path = require('path');

describe('gacha fallback css', () => {
  test('hidden SOUND fallback tiles are explicitly removed from layout', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'styles-layout.css'), 'utf8');

    expect(css).toMatch(/\.gacha-item-fallback\[hidden\]\s*\{\s*display:\s*none;/);
  });
});
