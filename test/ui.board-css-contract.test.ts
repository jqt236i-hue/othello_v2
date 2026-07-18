import { readDomCompatBoardCssSurface } from './helpers/css-test-helpers';

describe('board CSS rendering contract', () => {
  test('board root keeps geometry open for expansion cells', () => {
    const css = readDomCompatBoardCssSurface();

    expect(css).toMatch(/#board\s*\{[^}]*--board-layer-decoration:\s*0;/);
    expect(css).toMatch(/#board-expansion-layer\s*\{[^}]*--board-layer-decoration:\s*0;/);
    expect(css).toMatch(/#board\s*\{[^}]*--board-layer-cell:\s*1;/);
    expect(css).toMatch(/#board-expansion-layer\s*\{[^}]*--board-layer-cell:\s*1;/);
    expect(css).toMatch(/#board\s*\{[^}]*--board-layer-expanded-cell:\s*8;/);
    expect(css).toMatch(/#board-expansion-layer\s*\{[^}]*--board-layer-expanded-cell:\s*8;/);
    expect(css).toMatch(/#board\s*\{[\s\S]*isolation:\s*isolate;/);
    expect(css).toMatch(/#board\s*\{[\s\S]*overflow:\s*visible;/);
    expect(css).not.toMatch(/#board\s*\{[^}]*overflow:\s*hidden/);
    expect(css).toMatch(/#board-expansion-layer\s*\{[\s\S]*position:\s*absolute/);
    expect(css).toMatch(/#board-expansion-layer\s*\{[\s\S]*overflow:\s*visible/);
  });

  test('board decoration and cells use separate layer tokens', () => {
    const css = readDomCompatBoardCssSurface();

    expect(css).toMatch(/#board::before\s*\{[\s\S]*background:\s*var\(--board-surface-overlay\);[\s\S]*z-index:\s*var\(--board-layer-decoration\);/);
    expect(css).toMatch(/#board::after\s*\{[\s\S]*z-index:\s*var\(--board-layer-decoration\);/);
    expect(css).toMatch(/\.cell\s*\{[\s\S]*z-index:\s*var\(--board-layer-cell\);/);
    expect(css).toMatch(/#board-expansion-layer\s+\.cell-expanded\s*\{[\s\S]*z-index:\s*var\(--board-layer-expanded-cell\);/);
  });

  test('fixed-size board markers follow the initial board cell scale', () => {
    const css = readDomCompatBoardCssSurface();

    expect(css).toMatch(/#board\s*\{[^}]*--board-cell-scale:\s*1;/);
    expect(css).toMatch(/#board-expansion-layer\s*\{[^}]*--board-cell-scale:\s*1;/);
    expect(css).toMatch(/\.board-bonus-number,\s*[\s\S]*\.stone-regen-badge\s*\{\s*scale:\s*var\(--board-cell-scale,\s*1\);/);
  });

  test('expanded cells inherit board surface tokens instead of duplicating base art', () => {
    const css = readDomCompatBoardCssSurface();

    expect(css).toMatch(/--board-surface-base-color:\s*#[0-9a-fA-F]{6};/);
    expect(css).toMatch(/--board-surface-texture-image:\s*url\("assets\/images\/board\/board-surface-bluegreen-felt-v1\.png"\);/);
    expect(css).toMatch(/--board-cell-base-color:\s*var\(--board-surface-base-color\);/);
    expect(css).toMatch(/--board-cell-base-image:\s*var\(--board-surface-base-image\);/);
    expect(css).toMatch(/--board-cell-base-size:\s*var\(--board-surface-base-size\);/);
    expect(css).toMatch(/#board-expansion-layer\s+\.cell-expanded\s*\{[\s\S]*background-image:[\s\S]*var\(--board-cell-base-image\);/);
  });

  test('board bonus numbers follow the selected app font', () => {
    const css = readDomCompatBoardCssSurface();

    expect(css).toMatch(/--board-bonus-number-font-family:\s*var\(--selected-app-font-accent-family,\s*var\(--selected-app-font-family\)\);/);
    expect(css).toMatch(/\.cell\.has-board-bonus\s+\.board-bonus-number\s*\{[\s\S]*font-family:\s*var\(--board-bonus-number-font-family\);/);
    expect(css).not.toMatch(/--board-bonus-number-font-family:\s*"DotGothic16"/);
  });

  test('board bonus numbers use readable jade surface styling', () => {
    const css = readDomCompatBoardCssSurface();

    expect(css).toMatch(/--board-bonus-number-color:\s*rgba\(206,\s*235,\s*214,\s*0\.60\);/);
    expect(css).toMatch(/--board-bonus-number-highlight:\s*rgba\(238,\s*255,\s*236,\s*0\.24\);/);
    expect(css).toMatch(/--board-bonus-number-shadow:\s*rgba\(0,\s*0,\s*0,\s*0\.74\);/);
    expect(css).toMatch(/\.cell\.has-board-bonus\s+\.board-bonus-number\s*\{[\s\S]*color:\s*var\(--board-bonus-number-color\);/);
    expect(css).toMatch(/\.cell\.has-board-bonus\s+\.board-bonus-number\s*\{[\s\S]*font-variant-numeric:\s*tabular-nums;/);
    expect(css).toMatch(/\.cell\.has-board-bonus\s+\.board-bonus-number\s*\{[\s\S]*opacity:\s*1;/);
    expect(css).toMatch(/\.cell\.has-board-bonus\s+\.board-bonus-number\s*\{[\s\S]*mix-blend-mode:\s*normal;/);
  });

  test('theory number cells keep a distinct premium treatment', () => {
    const css = readDomCompatBoardCssSurface();

    expect(css).toMatch(/\.cell\.has-theory-number-cell\s*\{[\s\S]*overflow:\s*hidden;/);
    expect(css).toMatch(/\.cell\.has-theory-number-cell\s*\{[\s\S]*rgba\(91,\s*56,\s*178,\s*0\.46\)/);
    expect(css).toMatch(/\.cell\.has-theory-number-cell::before\s*\{[\s\S]*border:[\s\S]*rgba\(255,\s*228,\s*137,\s*0\.36\)/);
    expect(css).toMatch(/\.cell\.has-theory-number-cell::after\s*\{[\s\S]*conic-gradient\(from 45deg/);
    expect(css).toMatch(/\.cell\.has-theory-number-cell\s+\.board-bonus-number\s*\{[\s\S]*color:\s*rgba\(255,\s*244,\s*196,\s*0\.98\);/);
    expect(css).toMatch(/\.cell\.has-theory-number-cell\s+\.board-bonus-number\s*\{[\s\S]*font-weight:\s*800;/);
  });
});
