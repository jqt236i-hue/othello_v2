import {
  expectCssBlockToContain,
  readDomCompatBoardCssSurface,
  readLayoutCssSurface,
  readRepoTextFile
} from './helpers/css-test-helpers';

describe('charge HUD layering contract', () => {
  test('expanded board layer sits above hand and left HUD layers while charge HUD stays above the board', () => {
    const layoutCss = readLayoutCssSurface();
    const boardCss = readDomCompatBoardCssSurface();
    const variablesCss = readRepoTextFile('styles-variables.css');
    const cardsCss = readRepoTextFile('styles-cards.css');
    const animationsCss = readRepoTextFile('styles-animations.css');
    const indexHtml = readRepoTextFile('index.html');

    expect(indexHtml).toMatch(/<div id="board-stack">[\s\S]*<div id="board-frame">[\s\S]*<div id="charge-hud-layer">/);
    expect(indexHtml).not.toMatch(/id="board-expansion-layer"/);
    expect(layoutCss).toMatch(/#game-container\s*\{[\s\S]*position:\s*relative/);
    expect(layoutCss).not.toMatch(/#game-container\s*\{[^}]*z-index:/);
    expect(layoutCss).toMatch(/#board-stack[\s\S]*position:\s*relative/);
    expect(boardCss).toMatch(/#board-expansion-layer\s*\{[\s\S]*z-index:\s*var\(--layout-z-board-expansion-layer\)/);
    expect(layoutCss).toMatch(/#board-frame[\s\S]*z-index:\s*var\(--layout-z-board-frame\)/);
    expectCssBlockToContain(layoutCss, '#board-frame', /var\(--ui-elevation-board\)/);
    expect(layoutCss).toMatch(/#charge-hud-layer[\s\S]*z-index:\s*var\(--layout-z-charge-hud\)/);
    expect(layoutCss).toMatch(/#round-display-panel[\s\S]*z-index:\s*var\(--layout-z-board-toast\)/);
    expect(layoutCss).toMatch(/#fate-will-banner[\s\S]*z-index:\s*var\(--layout-z-board-toast\)/);
    expect(layoutCss).toMatch(/\.player-area-top,\s*[\s\S]*\.player-area-bottom\s*\{[\s\S]*z-index:\s*var\(--layout-z-player-area\)/);
    expectCssBlockToContain(cardsCss, '#handLayer', /z-index:\s*var\(--layout-z-hand-animation\)/);
    expect(variablesCss).toMatch(/--layout-z-board-frame:\s*10/);
    expect(variablesCss).toMatch(/--layout-z-player-area:\s*20/);
    expect(variablesCss).toMatch(/--layout-z-charge-hud:\s*12020/);
    expect(variablesCss).toMatch(/--layout-z-board-expansion-layer:\s*12025/);
    expect(variablesCss).toMatch(/--layout-z-hand-animation:\s*12030/);
    expect(variablesCss).toMatch(/--layout-z-board-toast:\s*12040/);
    expect(variablesCss).toMatch(/--layout-z-charge-display:\s*1009/);
    expect(animationsCss).toMatch(/\.special-card-cinematic-overlay\s*\{[\s\S]*z-index:\s*24000/);
    expect(variablesCss).toMatch(/--layout-z-charge-delta:\s*24020/);
  });
});
