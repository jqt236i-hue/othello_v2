import { readDomCompatBoardCssSurface } from './helpers/css-test-helpers';

describe('legal hint styles', () => {
  test('styles-board.css removes circle pseudo elements from legal hint states', () => {
    const css = readDomCompatBoardCssSurface();
    const timeStopGlowBlock = css.match(/@keyframes timeStopLegalGlow\s*\{[\s\S]*?\n\}/);

    expect(css).not.toMatch(/\.cell\.legal::after/);
    expect(css).not.toMatch(/\.cell\.legal-free::after/);
    expect(css).not.toMatch(/\.cell\.selectable-friendly::after/);
    expect(css).not.toMatch(/\.cell\.random-spawn-preview::after/);
    expect(css).not.toMatch(/time-stop-legal-emphasis::after/);
    expect(css).toContain('@keyframes timeStopLegalGlow');
    expect(css).toContain('body.time-stop-active #board .cell.time-stop-legal-emphasis {');
    expect(css).toContain('.cell.random-spawn-preview {');
    expect(timeStopGlowBlock?.[0]).not.toMatch(/background-color:/);
  });

  test('styles-board.css gives expanded legal hint cells enough specificity to override their base background', () => {
    const css = readDomCompatBoardCssSurface();

    expect(css).toMatch(/#board-expansion-layer\s+\.cell-expanded\.legal,\s*#board-expansion-layer\s+\.cell-expanded\.legal-free,\s*#board-expansion-layer\s+\.cell-expanded\.selectable-friendly\s*\{[\s\S]*?linear-gradient\(180deg,\s*rgba\(114,\s*230,\s*212,\s*0\.06\),\s*rgba\(0,\s*0,\s*0,\s*0\.04\)\)[\s\S]*?linear-gradient\(135deg,\s*rgba\(11,\s*102,\s*91,\s*0\.70\),\s*rgba\(6,\s*72,\s*64,\s*0\.66\)\)[\s\S]*?box-shadow:\s*[\s\S]*?inset 0 0 calc\(12px \* var\(--layout-stage-scale\)\) rgba\(116,\s*255,\s*228,\s*0\.05\)[\s\S]*?\}/);
  });

  test('styles-board.css keeps normal legal hint cells slightly more transparent than the bright jade draft', () => {
    const css = readDomCompatBoardCssSurface();

    expect(css).toMatch(/\.cell\.legal,\s*\.cell\.legal-free\s*\{[\s\S]*?linear-gradient\(180deg,\s*rgba\(120,\s*232,\s*214,\s*0\.07\),\s*rgba\(0,\s*0,\s*0,\s*0\.04\)\)[\s\S]*?linear-gradient\(135deg,\s*rgba\(13,\s*108,\s*96,\s*0\.72\),\s*rgba\(7,\s*76,\s*68,\s*0\.68\)\)[\s\S]*?box-shadow:\s*[\s\S]*?inset 0 0 calc\(13px \* var\(--layout-stage-scale\)\) rgba\(116,\s*255,\s*228,\s*0\.06\)[\s\S]*?inset 0 0 0 calc\(1px \* var\(--layout-stage-scale\)\) rgba\(160,\s*255,\s*226,\s*0\.05\)[\s\S]*?inset 0 calc\(1px \* var\(--layout-stage-scale\)\) 0 rgba\(224,\s*255,\s*249,\s*0\.05\)[\s\S]*?\}/);
  });

  test('styles-board.css keeps friendly target cells visibly translucent', () => {
    const css = readDomCompatBoardCssSurface();

    expect(css).toMatch(/\.cell\.selectable-friendly\s*\{[\s\S]*?linear-gradient\(135deg,\s*rgba\(14,\s*126,\s*111,\s*0\.38\),\s*rgba\(7,\s*90,\s*79,\s*0\.32\)\)[\s\S]*?\}/);
  });

  test('styles-board.css makes positive effect target highlights override legal hint backgrounds', () => {
    const css = readDomCompatBoardCssSurface();

    expect(css).toMatch(/\.cell\.effect-target-highlight-positive\s*\{[\s\S]*?background:\s*[\s\S]*?rgba\(180,\s*102,\s*255,\s*0\.38\)[\s\S]*?\}/);
  });

  test('styles-board.css defines a bordered blue effect highlight for normal placement cells', () => {
    const css = readDomCompatBoardCssSurface();

    expect(css).toMatch(/\.cell\.effect-target-highlight-placement\s*\{[\s\S]*?background:\s*[\s\S]*?rgba\(102,\s*164,\s*255,\s*0\.38\)[\s\S]*?outline:\s*calc\(2px \* var\(--layout-stage-scale\)\) solid rgba\(154,\s*198,\s*255,\s*0\.9\)[\s\S]*?box-shadow:\s*[\s\S]*?inset 0 0 0 calc\(2px \* var\(--layout-stage-scale\)\) rgba\(138,\s*184,\s*255,\s*0\.76\)[\s\S]*?\}/);
  });

  test('styles-board.css shows causal replay selectable rings above meteor hole marks', () => {
    const css = readDomCompatBoardCssSurface();

    expect(css).toMatch(/\.cell\.blocked-cell\.meteor-hole-cell\.selectable-friendly::before,\s*\.cell\.blocked-cell\.board-shrink-hole-cell\.selectable-friendly::before\s*\{[\s\S]*?content:\s*""[\s\S]*?border:\s*calc\(1\.5px \* var\(--layout-stage-scale\)\) solid var\(--board-legal-ring-color\)[\s\S]*?z-index:\s*11[\s\S]*?\}/);
  });

  test('styles-board.css shows causal replay selectable rings above board shrink hole marks', () => {
    const css = readDomCompatBoardCssSurface();

    expect(css).toMatch(/\.cell\.blocked-cell\.board-shrink-hole-cell\.selectable-friendly::before\s*\{[\s\S]*?content:\s*""[\s\S]*?border:\s*calc\(1\.5px \* var\(--layout-stage-scale\)\) solid var\(--board-legal-ring-color\)[\s\S]*?z-index:\s*11[\s\S]*?\}/);
  });

  test('styles-responsive.css does not restore legal hint circle hover styles', () => {
    const css = readDomCompatBoardCssSurface();

    expect(css).not.toMatch(/\.cell\.legal:hover::after/);
    expect(css).toMatch(/\.cell\.legal:hover,\s*\.cell\.legal-free:hover,\s*\.cell\.selectable-friendly:hover/);
  });
});
