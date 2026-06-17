import { readLayoutCssSurface } from './helpers/css-test-helpers';
import fs from 'fs';
import path from 'path';

describe('charge HUD layering contract', () => {
  test('charge HUD layer sits above hand areas while board frame stays lower', () => {
    const layoutCss = readLayoutCssSurface();
    const variablesCss = fs.readFileSync(path.resolve(__dirname, '../styles-variables.css'), 'utf8');
    const indexHtml = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');

    expect(indexHtml).toMatch(/<div id="board-stack">[\s\S]*<div id="board-frame">[\s\S]*<div id="charge-hud-layer">/);
    expect(layoutCss).toMatch(/#board-stack[\s\S]*position:\s*relative/);
    expect(layoutCss).toMatch(/#board-frame[\s\S]*z-index:\s*var\(--layout-z-board-frame\)/);
    expect(layoutCss).toMatch(/#charge-hud-layer[\s\S]*z-index:\s*var\(--layout-z-charge-hud\)/);
    expect(layoutCss).toMatch(/\.player-area-top,\s*[\s\S]*\.player-area-bottom\s*\{[\s\S]*z-index:\s*var\(--layout-z-player-area\)/);
    expect(variablesCss).toMatch(/--layout-z-board-frame:\s*10/);
    expect(variablesCss).toMatch(/--layout-z-player-area:\s*20/);
    expect(variablesCss).toMatch(/--layout-z-charge-hud:\s*30/);
    expect(variablesCss).toMatch(/--layout-z-charge-display:\s*1009/);
    expect(variablesCss).toMatch(/--layout-z-charge-delta:\s*1010/);
  });
});
