import * as fs from 'fs';
import * as path from 'path';

describe('deck builder layout CSS', () => {
  test('preset screen keeps the existing sections while tightening spacing and grid density', () => {
    const cssPath = path.join(__dirname, '..', 'styles-layout-controls.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    expect(css).toMatch(/#deckBuilderBody\s*\{[\s\S]*gap:\s*calc\(8px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(css).toMatch(/#deckBuilderBody\s*\{[\s\S]*padding:\s*calc\(10px\s*\*\s*var\(--layout-stage-scale\)\)\s*calc\(12px\s*\*\s*var\(--layout-stage-scale\)\)\s*calc\(12px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(css).toMatch(/\.deck-builder-default-preset-row\s*\{[\s\S]*grid-template-columns:\s*minmax\(calc\(260px\s*\*\s*var\(--layout-stage-scale\)\),\s*1fr\)\s*minmax\(calc\(540px\s*\*\s*var\(--layout-stage-scale\)\),\s*calc\(720px\s*\*\s*var\(--layout-stage-scale\)\)\)/);
    expect(css).toMatch(/\.deck-builder-view-presets\s*>\s*\.deck-builder-preset-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(calc\(160px\s*\*\s*var\(--layout-stage-scale\)\),\s*1fr\)\)/);
    expect(css).toMatch(/\.deck-builder-built-in-preset-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(calc\(150px\s*\*\s*var\(--layout-stage-scale\)\),\s*1fr\)\)/);
    expect(css).toMatch(/\.deck-builder-built-in-preset-grid\s+\.deck-builder-preset-card\s*\{[\s\S]*grid-template-areas:\s*"title action"\s*"summary action"/);
    expect(css).toMatch(/\.deck-builder-preset-card\s*\{[\s\S]*gap:\s*calc\(6px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(css).toMatch(/\.deck-builder-preset-card\s*\{[\s\S]*padding:\s*calc\(8px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(css).toMatch(/\.deck-builder-preset-card\s*>\s*\.deck-builder-actions-row\s+\.btn-small\s*\{[\s\S]*min-height:\s*calc\(24px\s*\*\s*var\(--layout-stage-scale\)\)/);
  });
});
