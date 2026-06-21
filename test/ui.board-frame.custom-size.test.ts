import * as fs from 'fs';
import * as path from 'path';
import { readLayoutCssSurface } from './helpers/css-test-helpers';

describe('custom board frame styling', () => {
  test('styles keep the standard frame as the default and allow runtime expansion for oversized custom boards', () => {
    const baseCss = fs.readFileSync(path.join(__dirname, '..', 'styles-base.css'), 'utf8');
    const layoutCss = readLayoutCssSurface();
    const boardCss = fs.readFileSync(path.join(__dirname, '..', 'styles-board.css'), 'utf8');

    expect(baseCss).toMatch(/body\.board-oversize-active[\s\S]*overflow:\s*auto/);
    expect(layoutCss).toMatch(/#game-container\.board-oversize-active[\s\S]*width:\s*max-content/);
    expect(layoutCss).toMatch(/#game-container\.board-oversize-active[\s\S]*min-width:\s*100vw/);
    expect(layoutCss).toMatch(/#board-frame[\s\S]*--board-frame-padding:\s*calc\(25px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(layoutCss).toMatch(/#board-frame[\s\S]*--board-frame-padding-top:\s*var\(--board-frame-padding\)/);
    expect(layoutCss).toMatch(/#board-frame[\s\S]*--board-frame-padding-bottom:\s*var\(--board-frame-padding\)/);
    expect(layoutCss).toMatch(/#board-frame[\s\S]*--board-frame-inner-size:\s*calc\(var\(--layout-anchor-board-size\)\s*\*\s*var\(--layout-stage-scale\)\s*\*\s*var\(--layout-priority-board-scale\)\)/);
    expect(layoutCss).toMatch(/#board-frame[\s\S]*--board-frame-fill-background:/);
    expect(layoutCss).not.toMatch(/#board-frame\[data-board-frame-skin-id\^="compact-"\][\s\S]*--board-frame-padding-top/);
    expect(layoutCss).toMatch(/#board-frame[\s\S]*width:\s*var\(--board-frame-outer-width,\s*calc\(var\(--board-frame-inner-size\)\s*\+\s*var\(--board-frame-padding-left\)\s*\+\s*var\(--board-frame-padding-right\)\)\)/);
    expect(layoutCss).toMatch(/#board-frame[\s\S]*height:\s*var\(--board-frame-outer-height,\s*calc\(var\(--board-frame-inner-size\)\s*\+\s*var\(--board-frame-padding-top\)\s*\+\s*var\(--board-frame-padding-bottom\)\)\)/);
    expect(layoutCss).toMatch(/#board-frame[\s\S]*--board-frame-art-overhang-top:\s*var\(--board-frame-art-overhang\)/);
    expect(layoutCss).toMatch(/#board-frame[\s\S]*--board-frame-art-overhang-bottom:\s*var\(--board-frame-art-overhang\)/);
    expect(layoutCss).toMatch(/#board-frame::before[\s\S]*top:\s*calc\(-1\s*\*\s*var\(--board-frame-art-overhang-top\)\s*\+\s*var\(--board-frame-art-offset-y\)\)/);
    expect(layoutCss).toMatch(/#board-frame::before[\s\S]*bottom:\s*calc\(-1\s*\*\s*var\(--board-frame-art-overhang-bottom\)\s*-\s*var\(--board-frame-art-offset-y\)\)/);
    expect(boardCss).toMatch(/#board[\s\S]*--board-max-size:\s*var\(--board-frame-inner-size,\s*calc\(var\(--layout-anchor-board-size\)\s*\*\s*var\(--layout-stage-scale\)\s*\*\s*var\(--layout-priority-board-scale\)\)\)/);
    expect(boardCss).toMatch(/#board[\s\S]*--board-disc-size:\s*var\(--board-disc-size-px,\s*89\.9%\)/);
    expect(boardCss).toMatch(/#board[\s\S]*--board-disc-inset:\s*var\(--board-disc-inset-px,\s*5\.05%\)/);
    expect(boardCss).toMatch(/#board[\s\S]*width:\s*calc\(var\(--board-max-size\)\s*\*\s*\(var\(--board-cols\)\s*\/\s*var\(--board-max-grid\)\)\)/);
    expect(boardCss).toMatch(/#board[\s\S]*height:\s*calc\(var\(--board-max-size\)\s*\*\s*\(var\(--board-rows\)\s*\/\s*var\(--board-max-grid\)\)\)/);
    expect(boardCss).toMatch(/#board \.disc[\s\S]*width:\s*var\(--board-disc-size\)/);
    expect(boardCss).toMatch(/#board \.disc[\s\S]*top:\s*var\(--board-disc-inset\)/);
    expect(boardCss).toMatch(/\.cell\.blocked-cell\.board-shrink-hole-cell[\s\S]*border:\s*none/);
    expect(boardCss).toMatch(/\.cell\.blocked-cell\.board-shrink-hole-cell\s+\.board-shrink-hole-mark[\s\S]*background:\s*var\(--board-frame-fill-background/);
    expect(boardCss).toMatch(/\.cell\.blocked-cell\.board-shrink-hole-cell\s+\.board-shrink-hole-mark::before[\s\S]*background-image:\s*url\('assets\/images\/other\/aaa\.png'\)/);
    expect(boardCss).toMatch(/\.cell\.blocked-cell\.board-shrink-hole-cell\s+\.board-shrink-hole-mark[\s\S]*isolation:\s*isolate/);
    expect(boardCss).toMatch(/\.cell\.blocked-cell\.board-shrink-hole-cell\s+\.board-shrink-hole-mark[\s\S]*inset:\s*calc\(-1\s*\*\s*var\(--layout-size-border-thin\)\)/);
    expect(boardCss).toMatch(/\.board-shrink-hole-inner-edge\.inner-edge-bottom[\s\S]*height:\s*calc\(4px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(boardCss).toMatch(/\.board-shrink-hole-inner-edge\.inner-edge-right[\s\S]*width:\s*calc\(4px\s*\*\s*var\(--layout-stage-scale\)\)/);
  });
});
