import * as fs from 'fs';
import * as path from 'path';

describe('deck builder layout CSS', () => {
  test('built-in preset deck cards are compact and subdued next to the default deck', () => {
    const cssPath = path.join(__dirname, '..', 'styles-layout-controls.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    expect(css).toMatch(/\.deck-builder-default-preset-row\s*\{[\s\S]*grid-template-columns:\s*minmax\(calc\(300px\s*\*\s*var\(--layout-stage-scale\)\),\s*1fr\)\s*minmax\(calc\(360px\s*\*\s*var\(--layout-stage-scale\)\),\s*calc\(430px\s*\*\s*var\(--layout-stage-scale\)\)\)/);
    expect(css).toMatch(/\.deck-builder-built-in-preset-grid\s+\.deck-builder-preset-card\s*\{[\s\S]*grid-template-areas:\s*"title action"\s*"summary action"/);
    expect(css).toMatch(/\.deck-builder-built-in-preset-grid\s+\.deck-builder-preset-card\s*\{[\s\S]*padding:\s*calc\(6px\s*\*\s*var\(--layout-stage-scale\)\)\s*calc\(7px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(css).toMatch(/\.deck-builder-built-in-preset-grid\s+\.deck-builder-preset-title\s*\{[\s\S]*font-size:\s*calc\(10px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(css).toMatch(/\.deck-builder-built-in-preset-grid\s+\.deck-builder-actions-row\s+\.btn-small\s*\{[\s\S]*opacity:\s*0\.78/);
  });
});
