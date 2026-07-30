import { readRepoTextFile } from './helpers/css-test-helpers';

describe('mobile command surface panel contract', () => {
  test('phone portrait presents settings and feature panels as full-screen surfaces', () => {
    const mobileCss = readRepoTextFile('styles-mobile-command-surface.css');

    expect(mobileCss).toMatch(/html\.layout-profile-phone-portrait\s+#side-panel[\s\S]*position:\s*fixed\s*!important[\s\S]*inset:\s*0\s*!important[\s\S]*width:\s*100vw\s*!important[\s\S]*height:\s*100dvh\s*!important/);
    expect(mobileCss).toMatch(/html\.layout-profile-phone-portrait\s+#control-panel[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)[\s\S]*width:\s*100%\s*!important/);
    expect(mobileCss).toMatch(/html\.layout-profile-phone-portrait\s+:is\([\s\S]*#networkOverlay,[\s\S]*#deckBuilderOverlay[\s\S]*\)[\s\S]*inset:\s*0\s*!important[\s\S]*height:\s*100dvh\s*!important/);
    expect(mobileCss).toMatch(/html\.layout-profile-phone-portrait\s+#appearancePanelTabs[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
    expect(mobileCss).toMatch(/html\.layout-profile-phone-portrait\s+#rules-help-tabs[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  });

  test('phone portrait uses a safe-area drawer instead of the horizontal action rail', () => {
    const mobileCss = readRepoTextFile('styles-mobile-command-surface.css');

    expect(mobileCss).toMatch(/--mobile-command-safe-top:\s*max\(10px,\s*env\(safe-area-inset-top\)\)/);
    expect(mobileCss).toMatch(/html\.layout-profile-phone-portrait\s+\.mobile-command-drawer[\s\S]*width:\s*min\(86vw,\s*360px\)[\s\S]*overflow:\s*hidden auto[\s\S]*transform:\s*translateX\(-102%\)/);
    expect(mobileCss).toMatch(/#mobile-command-surface\.is-drawer-open\s+\.mobile-command-drawer[\s\S]*transform:\s*translateX\(0\)/);
    expect(mobileCss).toMatch(/\.mobile-command-menu-item[\s\S]*min-height:\s*48px/);
    expect(mobileCss).toMatch(/\.mobile-command-layer-close,[\s\S]*\.mobile-command-native-close[\s\S]*min-width:\s*44px[\s\S]*min-height:\s*44px/);
  });

  test('phone portrait keeps the board, status, card detail, and hand inside the viewport', () => {
    const mobileCss = readRepoTextFile('styles-mobile-command-surface.css');

    expect(mobileCss).toMatch(/html\.layout-profile-phone-portrait\s+#game-container[\s\S]*overflow-x:\s*clip/);
    expect(mobileCss).toMatch(/--board-frame-inner-size:\s*min\([\s\S]*78vw,[\s\S]*37dvh[\s\S]*\)/);
    expect(mobileCss).toMatch(/html\.layout-profile-phone-portrait\s+#stone-info-panel\s+\.stone-info-list-item[\s\S]*min-height:\s*calc\(50px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(mobileCss).toMatch(/html\.layout-profile-phone-portrait\s+#card-detail-panel[\s\S]*max-height:\s*calc\(130px\s*\*\s*var\(--layout-stage-scale\)\)/);
  });
});
