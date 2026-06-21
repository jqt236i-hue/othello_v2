import {
  expectCssBlockToContain,
  readRepoTextFile,
  readLayoutCssSurface
} from './helpers/css-test-helpers';

describe('UI elevation shadow contract', () => {
  test('shared elevation tokens exist for layered game UI surfaces', () => {
    const varsCss = readRepoTextFile('styles-variables.css');

    expect(varsCss).toMatch(/--ui-elevation-panel:/);
    expect(varsCss).toMatch(/--ui-elevation-strong:/);
    expect(varsCss).toMatch(/--ui-elevation-board:/);
    expect(varsCss).toMatch(/--ui-elevation-card:/);
    expect(varsCss).toMatch(/--ui-drop-shadow-panel:[\s\S]*rgba\(0,\s*0,\s*0,\s*0\.82\)/);
    expect(varsCss).toMatch(/--ui-elevation-panel:[\s\S]*rgba\(0,\s*0,\s*0,\s*0\.78\)/);
  });

  test('major fixed HUD surfaces use shared elevation shadows', () => {
    const layoutCss = readLayoutCssSurface();
    const boardCss = readRepoTextFile('styles-board.css');
    const cardsCss = readRepoTextFile('styles-cards.css');

    expectCssBlockToContain(layoutCss, '#board-frame', /box-shadow:[\s\S]*var\(--ui-elevation-board\)/);
    expect(layoutCss).toMatch(/#effect-live-panel[\s\S]*box-shadow:[\s\S]*var\(--ui-elevation-panel\)/);
    expect(layoutCss).toMatch(/#manifest-effect-panel[\s\S]*box-shadow:[\s\S]*var\(--ui-elevation-panel\)/);
    expect(layoutCss).toMatch(/#leftActionButtons[\s\S]*box-shadow:[\s\S]*var\(--ui-elevation-panel\)/);
    expect(layoutCss).toMatch(/#side-panel[\s\S]*filter:[\s\S]*drop-shadow\(var\(--ui-drop-shadow-panel\)\)/);
    expect(boardCss).toMatch(/\.stone-info-panel[\s\S]*box-shadow:[\s\S]*var\(--ui-elevation-panel\)/);
    expect(cardsCss).toMatch(/#card-detail-panel[\s\S]*box-shadow:[\s\S]*var\(--ui-elevation-strong\)/);
    expect(cardsCss).toMatch(/#card-detail-panel[\s\S]*filter:[\s\S]*drop-shadow\(var\(--ui-drop-shadow-strong\)\)/);
  });

  test('floating game pieces and lightweight overlays also cast shared shadows', () => {
    const layoutCss = readLayoutCssSurface();
    const cardsCss = readRepoTextFile('styles-cards.css');

    expect(layoutCss).toMatch(/\.charge-display[\s\S]*box-shadow:[\s\S]*var\(--ui-elevation-panel\)/);
    expect(layoutCss).toMatch(/#cpu-speech-bubble[\s\S]*box-shadow:[\s\S]*var\(--ui-elevation-panel\)/);
    expect(layoutCss).toMatch(/#cpu-level-label[\s\S]*box-shadow:[\s\S]*var\(--ui-elevation-panel\)/);
    expect(layoutCss).toMatch(/#hero-label[\s\S]*filter:[\s\S]*drop-shadow\(var\(--ui-drop-shadow-panel\)\)/);
    expect(cardsCss).toMatch(/\.deck-stack[\s\S]*filter:[\s\S]*drop-shadow\(var\(--ui-drop-shadow-panel\)\)/);
    expect(cardsCss).toMatch(/\.card-item\.visible[\s\S]*box-shadow:[\s\S]*var\(--ui-elevation-card\)/);
    expect(cardsCss).toMatch(/:is\(#hand-black,\s*#hand-white\)\s+\.card-item\.visible:not\(\.card-use-ghost\)[\s\S]*filter:[\s\S]*drop-shadow\(var\(--ui-drop-shadow-panel\)\)/);
    expect(cardsCss).toMatch(/\.card-item\.hidden[\s\S]*box-shadow:[\s\S]*var\(--ui-elevation-card\)/);
  });
});
