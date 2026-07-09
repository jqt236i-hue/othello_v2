import * as fs from 'fs';
import * as path from 'path';

describe('deck builder layout CSS', () => {
  test('compact layout keeps the modal body vertically scrollable without horizontal overflow', () => {
    const cssPath = path.join(__dirname, '..', 'styles-layout-controls.css');
    const css = fs.readFileSync(cssPath, 'utf8');
    const compactSection = css.split('Bold Redesign — Compact density')[1] || '';
    const compactBodyBlock = compactSection.match(/#deckBuilderBody\s*\{([\s\S]*?)\}/)?.[1] || '';

    expect(compactBodyBlock).toMatch(/overflow-y:\s*auto\s*!important/);
    expect(compactBodyBlock).toMatch(/overflow-x:\s*hidden/);
    expect(compactBodyBlock).not.toMatch(/overflow:\s*hidden\s*!important/);
  });

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

  test('preset sections use subtle accent colors to separate default, built-in, and saved decks', () => {
    const cssPath = path.join(__dirname, '..', 'styles-layout-controls.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    expect(css).toMatch(/#deckBuilderModal\s+\.deck-builder-standard-card\s*\{[\s\S]*rgba\(242,\s*201,\s*95,\s*0\.18\)[\s\S]*border-color:\s*rgba\(242,\s*201,\s*95,\s*0\.38\)/);
    expect(css).toMatch(/#deckBuilderModal\s+\.deck-builder-standard-card\s+\.deck-builder-preset-title\s*\{[\s\S]*color:\s*rgba\(255,\s*228,\s*163,\s*0\.96\)/);
    expect(css).toMatch(/#deckBuilderModal\s+\.deck-builder-built-in-preset-section\s*\{[\s\S]*rgba\(83,\s*214,\s*209,\s*0\.08\)[\s\S]*border:\s*var\(--layout-size-border-thin\)\s*solid\s*rgba\(83,\s*214,\s*209,\s*0\.18\)/);
    expect(css).toMatch(/#deckBuilderModal\s+\.deck-builder-built-in-preset-grid\s+\.deck-builder-preset-card\s*\{[\s\S]*rgba\(83,\s*214,\s*209,\s*0\.1\)[\s\S]*border-color:\s*rgba\(83,\s*214,\s*209,\s*0\.22\)[\s\S]*box-shadow:\s*inset\s*calc\(3px\s*\*\s*var\(--layout-stage-scale\)\)\s*0\s*0\s*rgba\(83,\s*214,\s*209,\s*0\.18\)/);
    expect(css).toMatch(/#deckBuilderModal\s+\.deck-builder-built-in-preset-grid\s+\.deck-builder-preset-title\s*\{[\s\S]*color:\s*rgba\(184,\s*236,\s*231,\s*0\.9\)/);
    expect(css).toMatch(/#deckBuilderModal\s+\.deck-builder-view-presets\s*>\s*\.deck-builder-preset-grid\s*>\s*\.deck-builder-preset-card\s*\{[\s\S]*rgba\(212,\s*169,\s*122,\s*0\.14\)[\s\S]*border-color:\s*rgba\(212,\s*169,\s*122,\s*0\.38\)/);
    expect(css).toMatch(/#deckBuilderModal\s+\.deck-builder-view-presets\s*>\s*\.deck-builder-preset-grid\s*>\s*\.deck-builder-preset-card\s+\.deck-builder-preset-title\s*\{[\s\S]*color:\s*rgba\(255,\s*232,\s*178,\s*0\.94\)/);
  });

  test('preset action buttons use lighter role-specific styling instead of the generic brown buttons', () => {
    const cssPath = path.join(__dirname, '..', 'styles-layout-controls.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    expect(css).toMatch(/#deckBuilderModal\s+\.deck-builder-preset-card\s*>\s*\.deck-builder-actions-row\s+\.btn-small\s*\{[\s\S]*border-radius:\s*calc\(6px\s*\*\s*var\(--layout-stage-scale\)\)[\s\S]*rgba\(255,\s*255,\s*255,\s*0\.12\)[\s\S]*rgba\(16,\s*24,\s*34,\s*0\.92\)/);
    expect(css).toMatch(/#deckBuilderModal\s+\.deck-builder-preset-card\s*>\s*\.deck-builder-actions-row\s+\.btn-small:first-child\s*\{[\s\S]*rgba\(86,\s*226,\s*210,\s*0\.17\)[\s\S]*border-color:\s*rgba\(86,\s*226,\s*210,\s*0\.3\)[\s\S]*color:\s*rgba\(224,\s*255,\s*250,\s*0\.96\)/);
    expect(css).toMatch(/#deckBuilderModal\s+\.deck-builder-preset-card\s*>\s*\.deck-builder-actions-row\s+\.btn-small\s*\+\s*\.btn-small\s*\{[\s\S]*rgba\(124,\s*184,\s*255,\s*0\.14\)[\s\S]*border-color:\s*rgba\(124,\s*184,\s*255,\s*0\.22\)[\s\S]*color:\s*rgba\(223,\s*236,\s*255,\s*0\.94\)/);
    expect(css).toMatch(/\.deck-builder-built-in-preset-grid\s+\.deck-builder-actions-row\s*\{[\s\S]*gap:\s*calc\(4px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(css).toMatch(/\.deck-builder-built-in-preset-grid\s+\.deck-builder-actions-row\s+\.btn-small\s*\{[\s\S]*opacity:\s*1/);
  });

  test('generic small buttons use the cool dark style instead of the old brown default', () => {
    const cssPath = path.join(__dirname, '..', 'styles-layout-controls.css');
    const css = fs.readFileSync(cssPath, 'utf8');
    const block = css.match(/^\.btn-small\s*\{([\s\S]*?)^\}/m)?.[1] || '';

    expect(block).toMatch(/rgba\(38,\s*70,\s*82,\s*0\.96\)/);
    expect(block).toMatch(/rgba\(116,\s*214,\s*224,\s*0\.28\)/);
    expect(block).not.toMatch(/#5d4037|#3e2723|#4a3828|#8d6e63|#6d4c41|#4e342e/);
    expect(css).toMatch(/^\.btn-small:hover:not\(:disabled\),\s*\n\.btn-small:focus-visible\s*\{[\s\S]*rgba\(95,\s*205,\s*220,\s*0\.42\)/m);
  });
});
