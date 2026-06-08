import { readRepoTextFile } from './helpers/css-test-helpers';

describe('board CSS rendering contract', () => {
  test('board root keeps geometry open for expansion cells', () => {
    const css = readRepoTextFile('styles-board.css');

    expect(css).toMatch(/#board\s*\{[\s\S]*--board-layer-decoration:\s*0;/);
    expect(css).toMatch(/#board\s*\{[\s\S]*--board-layer-cell:\s*1;/);
    expect(css).toMatch(/#board\s*\{[\s\S]*--board-layer-expanded-cell:\s*8;/);
    expect(css).toMatch(/#board\s*\{[\s\S]*isolation:\s*isolate;/);
    expect(css).toMatch(/#board\s*\{[\s\S]*overflow:\s*visible;/);
    expect(css).not.toMatch(/#board\s*\{[^}]*overflow:\s*hidden/);
  });

  test('board decoration and cells use separate layer tokens', () => {
    const css = readRepoTextFile('styles-board.css');

    expect(css).toMatch(/#board::before\s*\{[\s\S]*background:\s*var\(--board-surface-overlay\);[\s\S]*z-index:\s*var\(--board-layer-decoration\);/);
    expect(css).toMatch(/#board::after\s*\{[\s\S]*z-index:\s*var\(--board-layer-decoration\);/);
    expect(css).toMatch(/\.cell\s*\{[\s\S]*z-index:\s*var\(--board-layer-cell\);/);
    expect(css).toMatch(/#board\s+\.cell-expanded\s*\{[\s\S]*z-index:\s*var\(--board-layer-expanded-cell\);/);
  });

  test('expanded cells inherit board surface tokens instead of duplicating base art', () => {
    const css = readRepoTextFile('styles-board.css');

    expect(css).toMatch(/--board-surface-base-color:\s*#1f4738;/);
    expect(css).toMatch(/--board-cell-base-color:\s*var\(--board-surface-base-color\);/);
    expect(css).toMatch(/--board-cell-base-image:\s*var\(--board-surface-base-image\);/);
    expect(css).toMatch(/--board-cell-base-size:\s*var\(--board-surface-base-size\);/);
    expect(css).toMatch(/#board\s+\.cell-expanded\s*\{[\s\S]*background-image:[\s\S]*var\(--board-cell-base-image\);/);
  });
});
