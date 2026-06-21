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
    expect(varsCss).toMatch(/--profile-left-info-stack-left:\s*max\(var\(--profile-stone-info-safe-left\),\s*calc\(var\(--profile-stone-info-left\)\s*-\s*calc\(24px\s*\*\s*var\(--layout-stage-scale\)\)\)\)/);
  });

  test('responsive left info stack overrides stay explicit', () => {
    const responsiveCss = readRepoTextFile('styles-responsive.css');

    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait\s+#manifest-effect-panel/);
    expect(responsiveCss).toMatch(/html\.layout-stage-enabled:not\(\.layout-profile-phone-portrait\)\s+#left-info-stack[\s\S]*display:\s*flex/);
    expect(responsiveCss).toMatch(/html\.layout-stage-enabled:not\(\.layout-profile-phone-portrait\)\s+#left-info-stack[\s\S]*left:\s*var\(--profile-left-info-stack-left\)/);
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
    const effectPanelBlock = Array.from(layoutCss.matchAll(/#effect-live-panel\s*\{[\s\S]*?\n\}/g))
      .map((match) => match[0])
      .find((block) => block.includes('--left-hud-accent')) || '';
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
    expect(layoutCss).toMatch(/#manifest-effect-panel[\s\S]*--manifest-effect-accent-secondary:\s*#7ed7ff/);
    expect(layoutCss).toMatch(/#manifest-effect-panel\[data-manifest-effect-type="THEORY_INCARNATION"\][\s\S]*--manifest-effect-accent-secondary:\s*#7dffdf/);
    expect(layoutCss).toMatch(/#manifest-effect-panel[\s\S]*--manifest-effect-border-width:\s*calc\(2px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(layoutCss).toMatch(/#manifest-effect-panel[\s\S]*clip-path:\s*polygon/);
    expect(effectPanelBlock).toMatch(/z-index:\s*11990/);
    expect(manifestPanelBlock).toMatch(/z-index:\s*11990/);
    expect(manifestPanelBlock).not.toMatch(/linear-gradient\(90deg,\s*transparent 0 14%/);
    expect(manifestPanelBlock).not.toMatch(/linear-gradient\(180deg,\s*rgba\(255,\s*232,\s*150,\s*0\.055\) 0 1px/);
    expect(layoutCss).toMatch(/#manifest-effect-panel::after[\s\S]*linear-gradient\(90deg,\s*transparent,\s*rgba\(126,\s*215,\s*255,\s*0\.72\)/);
    expect(layoutCss).toMatch(/#manifest-effect-title[\s\S]*font-size:\s*max\(calc\(13px\s*\*\s*var\(--layout-stage-scale\)\),\s*13px\)/);
    expect(layoutCss).toMatch(/#manifest-effect-title[\s\S]*background:[\s\S]*linear-gradient\(90deg,\s*rgba\(242,\s*201,\s*95,\s*0\.26\)/);
    expect(layoutCss).toMatch(/#manifest-effect-title[\s\S]*border-bottom:\s*var\(--layout-size-border-thin\)\s*solid\s*rgba\(126,\s*215,\s*255,\s*0\.22\)/);
    expect(layoutCss).toMatch(/#manifest-effect-title::before[\s\S]*width:\s*max\(calc\(10px\s*\*\s*var\(--layout-stage-scale\)\),\s*10px\)/);
    expect(manifestPanelBlock).toMatch(/box-shadow:[\s\S]*calc\(-10px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(manifestPanelBlock).not.toMatch(/var\(--ui-elevation-panel\)/);
    expect(layoutCss).toMatch(/\.manifest-effect-line[\s\S]*font-size:\s*max\(calc\(13px\s*\*\s*var\(--layout-stage-scale\)\),\s*13px\)/);
    expect(layoutCss).toMatch(/\.manifest-effect-line[\s\S]*font-weight:\s*800/);
    expect(layoutCss).toMatch(/\.manifest-effect-line[\s\S]*text-shadow:/);
    expect(layoutCss).toMatch(/\.manifest-effect-line[\s\S]*border-left:\s*max\(calc\(3px\s*\*\s*var\(--layout-stage-scale\)\),\s*3px\)\s*solid\s*var\(--manifest-effect-accent-secondary\)/);
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

  test('turn arrival art follows both local perspective and actual turn color', () => {
    const layoutCss = readLayoutCssSurface();

    expect(layoutCss).toMatch(/\.turn-arrival-toast\.is-self\.is-black-turn[\s\S]*turn-banner-your-v1\.png/);
    expect(layoutCss).toMatch(/\.turn-arrival-toast\.is-self\.is-white-turn[\s\S]*turn-banner-your-white-v1\.png/);
    expect(layoutCss).toMatch(/\.turn-arrival-toast\.is-enemy\.is-white-turn[\s\S]*turn-banner-enemy-v1\.png/);
    expect(layoutCss).toMatch(/\.turn-arrival-toast\.is-enemy\.is-black-turn[\s\S]*turn-banner-enemy-black-v1\.png/);
  });

  test('persistent game log uses themed readable panel treatment', () => {
    const layoutCss = readLayoutCssSurface();

    expect(layoutCss).toMatch(/#log[\s\S]*display:\s*none/);
    expect(layoutCss).toMatch(/#log[\s\S]*font-family:\s*var\(--selected-app-font-readable-family\)/);
    expect(layoutCss).toMatch(/#log[\s\S]*radial-gradient\(circle at 14% 0%,\s*rgba\(242,\s*201,\s*95,\s*0\.08\)/);
    expect(layoutCss).toMatch(/#log\.is-log-open[\s\S]*display:\s*block/);
    expect(layoutCss).not.toMatch(/#log\.is-visible[\s\S]*display:\s*block/);
    expect(layoutCss).toMatch(/#log[\s\S]*clip-path:\s*polygon/);
    expect(layoutCss).toMatch(/#log::before[\s\S]*linear-gradient\(90deg,\s*transparent,\s*rgba\(196,\s*160,\s*91,\s*0\.38\),\s*transparent\)/);
    expect(layoutCss).toMatch(/\.logEntry[\s\S]*font-weight:\s*700/);
    expect(layoutCss).toMatch(/#log \.logEntry::before[\s\S]*background:\s*rgba\(213,\s*177,\s*105,\s*0\.62\)/);
  });

  test('network presence toast uses lower-center compact HUD styling', () => {
    const layoutCss = readLayoutCssSurface();
    const varsCss = readRepoTextFile('styles-variables.css');

    expect(layoutCss).toMatch(/\.network-presence-toast\s*\{[\s\S]*position:\s*fixed/);
    expect(layoutCss).toMatch(/\.network-presence-toast\s*\{[\s\S]*left:\s*50%/);
    expect(layoutCss).toMatch(/\.network-presence-toast\s*\{[\s\S]*top:\s*calc\(50%\s*\+\s*calc\(96px\s*\*\s*var\(--layout-stage-scale\)\)\)/);
    expect(varsCss).toMatch(/--z-modal-network:\s*13010/);
    expect(layoutCss).toMatch(/\.network-presence-toast\s*\{[\s\S]*z-index:\s*calc\(var\(--z-modal-network\)\s*\+\s*1\)/);
    expect(layoutCss).toMatch(/\.network-presence-toast\s*\{[\s\S]*max-width:\s*min\(calc\(600px\s*\*\s*var\(--layout-stage-scale\)\),\s*calc\(100vw\s*-\s*calc\(32px\s*\*\s*var\(--layout-stage-scale\)\)\)\)/);
    expect(layoutCss).toMatch(/\.network-presence-toast\s*\{[\s\S]*min-height:\s*calc\(72px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(layoutCss).toMatch(/\.network-presence-toast\s*\{[\s\S]*padding:\s*calc\(14px\s*\*\s*var\(--layout-stage-scale\)\)\s*calc\(34px\s*\*\s*var\(--layout-stage-scale\)\)\s*calc\(14px\s*\*\s*var\(--layout-stage-scale\)\)\s*calc\(24px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(layoutCss).toMatch(/\.network-presence-toast\s*\{[\s\S]*font-size:\s*max\(calc\(20px\s*\*\s*var\(--layout-stage-scale\)\),\s*16px\)/);
    expect(layoutCss).toMatch(/\.network-presence-toast\s*\{[\s\S]*rgba\(242,\s*201,\s*95,\s*0\.16\)/);
    expect(layoutCss).toMatch(/\.network-presence-toast\s*\{[\s\S]*border-radius:\s*calc\(8px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(layoutCss).toMatch(/\.network-presence-toast__rail[\s\S]*width:\s*calc\(7px\s*\*\s*var\(--layout-stage-scale\)\)[\s\S]*height:\s*calc\(36px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(layoutCss).toMatch(/\.network-presence-toast__rail[\s\S]*background:\s*linear-gradient\(180deg,\s*#fff1aa,\s*#e0a939/);
    expect(layoutCss).toMatch(/@keyframes\s+network-presence-toast-enter/);
    expect(layoutCss).toMatch(/@keyframes\s+network-presence-toast-leave/);
    expect(layoutCss).toMatch(/\.network-presence-toast\.is-visible\s*\{[\s\S]*animation:\s*network-presence-toast-enter\s+280ms/);
    expect(layoutCss).toMatch(/\.network-presence-toast\.is-visible\.is-hiding\s*\{[\s\S]*animation:\s*network-presence-toast-leave\s+360ms/);
  });
});
