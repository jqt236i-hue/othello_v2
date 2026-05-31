import * as fs from 'fs';
import * as path from 'path';

describe('heaven overlay card style', () => {
  test('uses normal card size instead of hand-large size', () => {
    const cssPath = path.join(__dirname, '..', 'styles-cards.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    expect(css).toMatch(/\.heaven-blessing-offers \.heaven-offer-card[\s\S]*width:\s*var\(--layout-size-card-width\)/);
    expect(css).toMatch(/\.heaven-blessing-offers \.heaven-offer-card[\s\S]*height:\s*var\(--layout-size-card-height\)/);
    expect(css).not.toMatch(/\.heaven-blessing-offers \.heaven-offer-card[\s\S]*width:\s*var\(--layout-size-card-large-width\)/);
  });
});
