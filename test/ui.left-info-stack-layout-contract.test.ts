import {
  readLayoutCssSurface,
  readRepoTextFile,
} from './helpers/css-test-helpers';

describe('left info stack layout contract', () => {
  test('left info stack and manifest panel exist in index markup', () => {
    const html = readRepoTextFile('index.html');

    expect(html).toMatch(/id="left-info-stack"/);
    expect(html).toMatch(/id="manifest-effect-panel"/);
    expect(html).toMatch(/id="left-info-stack"[\s\S]*id="effect-live-panel"[\s\S]*id="stone-info-panel"[\s\S]*id="manifest-effect-panel"/);
  });

  test('desktop left info stack uses anchored layout hooks', () => {
    const layoutCss = readLayoutCssSurface();
    const varsCss = readRepoTextFile('styles-variables.css');

    expect(layoutCss).toMatch(/#left-info-stack[\s\S]*display:\s*contents/);
    expect(layoutCss).toMatch(/#manifest-effect-panel[\s\S]*#manifest-effect-panel\.is-visible/);
    expect(varsCss).toMatch(/--layout-anchor-left-info-stack-top/);
    expect(varsCss).toMatch(/--layout-anchor-left-info-stack-top:\s*188px/);
  });

  test('responsive left info stack overrides stay explicit', () => {
    const responsiveCss = readRepoTextFile('styles-responsive.css');

    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait\s+#manifest-effect-panel/);
    expect(responsiveCss).toMatch(/html\.layout-stage-enabled:not\(\.layout-profile-phone-portrait\)\s+#left-info-stack[\s\S]*display:\s*flex/);
    expect(responsiveCss).toMatch(/html\.layout-stage-enabled:not\(\.layout-profile-phone-portrait\)\s+#left-info-stack\s*>\s*#stone-info-panel,[\s\S]*#left-info-stack\s*>\s*#effect-live-panel,[\s\S]*#left-info-stack\s*>\s*#manifest-effect-panel[\s\S]*position:\s*static/);
    expect(responsiveCss).not.toMatch(/html\.layout-stage-enabled:not\(\.layout-profile-phone-portrait\)\s+#stone-info-panel[\s\S]*position:\s*fixed/);
    expect(responsiveCss).not.toMatch(/html\.layout-stage-enabled:not\(\.layout-profile-phone-portrait\)\s+#stone-info-panel[\s\S]*top:\s*calc\(var\(--profile-effect-top\)\s*\+\s*var\(--profile-effect-min-height\)\s*\+\s*calc\(8px\s*\*\s*var\(--layout-stage-scale\)\)\)/);
    expect(responsiveCss).toMatch(/html\.layout-stage-enabled:not\(\.layout-profile-phone-portrait\)\s+#stone-info-panel[\s\S]*transform:\s*none/);
    expect(responsiveCss).toMatch(/html\.layout-stage-enabled:not\(\.layout-profile-phone-portrait\)\s+#manifest-effect-panel[\s\S]*min-height:\s*calc\(var\(--layout-anchor-manifest-effect-height\)\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(responsiveCss).toMatch(/html\.layout-stage-enabled:not\(\.layout-profile-phone-portrait\)\s+#manifest-effect-panel[\s\S]*max-height:\s*calc\(var\(--layout-anchor-manifest-effect-height\)\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(responsiveCss).not.toMatch(/html\.layout-stage-enabled:not\(\.layout-profile-phone-portrait\)\s+#manifest-effect-panel[\s\S]*280px/);
    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait\s+#stone-info-panel[\s\S]*transform:\s*translateX\(-50%\)/);
  });

  test('left information HUD uses game-like readable panel treatments', () => {
    const layoutCss = readLayoutCssSurface();
    const boardCss = readRepoTextFile('styles-board.css');
    const manifestPanelBlock = Array.from(layoutCss.matchAll(/#manifest-effect-panel\s*\{[\s\S]*?\n\}/g))
      .map((match) => match[0])
      .find((block) => block.includes('--left-hud-accent')) || '';

    expect(layoutCss).toMatch(/#effect-live-panel[\s\S]*--left-hud-accent/);
    expect(layoutCss).toMatch(/#effect-live-panel,\s*#manifest-effect-panel[\s\S]*--left-hud-text-title/);
    expect(layoutCss).toMatch(/#effect-live-panel,\s*#manifest-effect-panel[\s\S]*--left-hud-text-label/);
    expect(layoutCss).toMatch(/#effect-live-panel,\s*#manifest-effect-panel[\s\S]*--left-hud-text-value/);
    expect(layoutCss).toMatch(/#effect-live-panel[\s\S]*clip-path:\s*polygon/);
    expect(layoutCss).toMatch(/\.battle-status-score[\s\S]*grid-template-columns:\s*1fr auto 1fr/);
    expect(layoutCss).toMatch(/\.battle-status-turn::before[\s\S]*content:\s*''/);
    expect(layoutCss).toMatch(/#manifest-effect-panel[\s\S]*--left-hud-accent/);
    expect(layoutCss).toMatch(/#manifest-effect-panel[\s\S]*clip-path:\s*polygon/);
    expect(manifestPanelBlock).toMatch(/box-shadow:[\s\S]*calc\(-10px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(manifestPanelBlock).not.toMatch(/var\(--ui-elevation-panel\)/);
    expect(layoutCss).toMatch(/\.manifest-effect-line[\s\S]*font-size:\s*max\(calc\(13px\s*\*\s*var\(--layout-stage-scale\)\),\s*13px\)/);
    expect(layoutCss).toMatch(/\.manifest-effect-line[\s\S]*font-weight:\s*800/);
    expect(layoutCss).toMatch(/\.manifest-effect-line[\s\S]*text-shadow:/);
    expect(layoutCss).toMatch(/\.manifest-effect-line::before[\s\S]*content:\s*''/);
    expect(layoutCss).toMatch(/\.manifest-effect-label[\s\S]*color:\s*var\(--left-hud-text-label\)/);
    expect(layoutCss).toMatch(/\.manifest-effect-value-strong[\s\S]*color:\s*var\(--left-hud-text-value\)/);
    expect(layoutCss).toMatch(/\.battle-status-latest-label[\s\S]*color:\s*var\(--left-hud-text-label\)/);
    expect(layoutCss).toMatch(/\.battle-status-count-value[\s\S]*color:\s*var\(--left-hud-text-value\)/);
    expect(boardCss).toMatch(/\.stone-info-panel[\s\S]*--left-hud-accent/);
    expect(boardCss).toMatch(/\.stone-info-panel[\s\S]*--left-hud-text-title/);
    expect(boardCss).toMatch(/\.stone-info-panel[\s\S]*--left-hud-text-body/);
    expect(boardCss).toMatch(/\.stone-info-panel[\s\S]*--left-hud-text-label/);
    expect(boardCss).toMatch(/\.stone-info-panel::before[\s\S]*content:\s*''/);
    expect(boardCss).toMatch(/\.stone-info-name[\s\S]*color:\s*var\(--left-hud-text-title\)/);
  });
});
