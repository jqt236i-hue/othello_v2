const fs = require('fs');
const path = require('path');

describe('hand card performance css', () => {
  test('hand hot-path overrides disable perpetual motion on playable, selected, and high-tier cards', () => {
    const cssPath = path.join(__dirname, '..', 'styles-cards.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    expect(css).toMatch(/#hand-black \.card-item\.selected,[\s\S]*?animation:\s*none;/);
    expect(css).toMatch(/#hand-black \.card-item\.affordable:not\(\.selected\),[\s\S]*?filter:\s*none;[\s\S]*?animation:\s*none;/);
    expect(css).toMatch(/#hand-black \.card-item\.visible\.cost-tier-gold,[\s\S]*?animation:\s*none;/);
    expect(css).toMatch(/#hand-black \.card-item\.visible\.cost-tier-gold::before,[\s\S]*?animation:\s*none;/);
  });

  test('card use ghost explicitly disables animation, filter, and transition carry-over', () => {
    const cssPath = path.join(__dirname, '..', 'styles-cards.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    expect(css).toMatch(/\.card-item\.card-use-ghost,[\s\S]*?animation:\s*none !important;[\s\S]*?filter:\s*none !important;[\s\S]*?transition:\s*none !important;/);
  });
});
