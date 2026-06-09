import { readRepoTextFile, readLayoutCssSurface } from './helpers/css-test-helpers';

describe('UI elevation shadow contract', () => {
  test('shared elevation tokens exist for layered game UI surfaces', () => {
    const varsCss = readRepoTextFile('styles-variables.css');

    expect(varsCss).toMatch(/--ui-elevation-panel:/);
    expect(varsCss).toMatch(/--ui-elevation-strong:/);
    expect(varsCss).toMatch(/--ui-elevation-board:/);
  });

  test('major fixed HUD surfaces use shared elevation shadows', () => {
    const layoutCss = readLayoutCssSurface();
    const boardCss = readRepoTextFile('styles-board.css');
    const cardsCss = readRepoTextFile('styles-cards.css');

    expect(layoutCss).toMatch(/#board-frame[\s\S]*box-shadow:[\s\S]*var\(--ui-elevation-board\)/);
    expect(layoutCss).toMatch(/#effect-live-panel[\s\S]*box-shadow:[\s\S]*var\(--ui-elevation-panel\)/);
    expect(layoutCss).toMatch(/#manifest-effect-panel[\s\S]*box-shadow:[\s\S]*var\(--ui-elevation-panel\)/);
    expect(layoutCss).toMatch(/#leftActionButtons[\s\S]*box-shadow:[\s\S]*var\(--ui-elevation-panel\)/);
    expect(layoutCss).toMatch(/#side-panel[\s\S]*filter:[\s\S]*drop-shadow\(var\(--ui-drop-shadow-panel\)\)/);
    expect(boardCss).toMatch(/\.stone-info-panel[\s\S]*box-shadow:[\s\S]*var\(--ui-elevation-panel\)/);
    expect(cardsCss).toMatch(/#card-detail-panel[\s\S]*box-shadow:[\s\S]*var\(--ui-elevation-strong\)/);
  });
});
