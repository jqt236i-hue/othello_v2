import * as fs from 'fs';
import * as path from 'path';

describe('title wordmark UI', () => {
  test('renders Card Reversi as the left title wordmark', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(__dirname, '..', 'styles-layout-info.css'), 'utf8');
    const wordmarkBlock = css.match(/#info-panel \.brand-wordmark \{([\s\S]*?)\n\}/)?.[1] || '';

    expect(html).toMatch(/<h1 class="brand-wordmark" aria-label="Card Reversi">/);
    expect(html).toMatch(/<span class="brand-wordmark-main">Card Reversi<\/span>/);
    expect(html).not.toContain('CARD BATTLE OTHELLO');
    expect(html).not.toMatch(/brand-wordmark-sub/);
    expect(css).toMatch(/\.brand-wordmark/);
    expect(css).toMatch(/\.brand-wordmark-main/);
    expect(css).not.toMatch(/\.brand-wordmark-sub/);
    expect(css).toMatch(/-webkit-text-stroke:\s*calc\(1px \* var\(--layout-stage-scale\)\) rgba\(22,\s*24,\s*28,\s*0\.92\)/);
    expect(css).toMatch(/text-shadow:[\s\S]*0 calc\(4px \* var\(--layout-stage-scale\)\) calc\(7px \* var\(--layout-stage-scale\)\) rgba\(0,\s*0,\s*0,\s*0\.98\)/);
    expect(css).toMatch(/text-shadow:[\s\S]*0 0 calc\(4px \* var\(--layout-stage-scale\)\) rgba\(0,\s*0,\s*0,\s*0\.94\)/);
    expect(css).toMatch(/filter:[\s\S]*drop-shadow\(0 0 calc\(4px \* var\(--layout-stage-scale\)\) rgba\(0,\s*0,\s*0,\s*0\.98\)\)/);
    expect(css).toMatch(/calc\(2px \* var\(--layout-stage-scale\)\) 0 0 rgba\(0,\s*0,\s*0,\s*0\.95\)/);
    expect(css).toMatch(/0 calc\(-2px \* var\(--layout-stage-scale\)\) 0 rgba\(0,\s*0,\s*0,\s*0\.95\)/);
    expect(wordmarkBlock).not.toMatch(/border:/);
    expect(wordmarkBlock).not.toMatch(/background:/);
    expect(css).not.toMatch(/rgba\(43,\s*34,\s*22/);
    expect(css).not.toMatch(/rgba\(39,\s*24,\s*12/);
  });
});
