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

  test('phone portrait command buttons use role tones without color-only state cues', () => {
    const mobileCss = readRepoTextFile('styles-mobile-command-surface.css');

    for (const tone of ['emerald', 'azure', 'gold', 'ember', 'violet', 'rose', 'sage', 'danger']) {
      expect(mobileCss).toMatch(new RegExp(`\\[data-mobile-tone="${tone}"\\]`));
    }
    expect(mobileCss).toMatch(/\.mobile-command-trigger[\s\S]*rgba\(var\(--mobile-tone-rgb\),\s*0\.56\)[\s\S]*inset 3px 0 0 rgba\(var\(--mobile-tone-rgb\),\s*0\.46\)/);
    expect(mobileCss).toMatch(/\.mobile-command-menu-icon[\s\S]*var\(--mobile-tone-icon-top\)[\s\S]*var\(--mobile-tone-icon-bottom\)/);
    expect(mobileCss).toMatch(/\.mobile-command-quick-action\.is-active[\s\S]*var\(--mobile-tone-text\)/);
    expect(mobileCss).toMatch(/\.mobile-command-menu-item,[\s\S]*\.mobile-command-quick-action[\s\S]*\):disabled[\s\S]*filter:\s*saturate\(0\.45\)[\s\S]*opacity:\s*0\.48/);
    expect(mobileCss).toMatch(/\):focus-visible\s*\{[\s\S]*outline:\s*3px solid rgba\(126,\s*215,\s*255,\s*0\.72\)/);
  });

  test('phone portrait exposes battle status and a compact opponent avatar', () => {
    const mobileCss = readRepoTextFile('styles-mobile-command-surface.css');

    expect(mobileCss).toMatch(/html\.layout-profile-phone-portrait\s+\.mobile-command-status-trigger[\s\S]*top:\s*var\(--mobile-command-safe-top\)[\s\S]*right:\s*var\(--mobile-command-safe-right\)/);
    expect(mobileCss).toMatch(/html\.layout-profile-phone-portrait\s+\.mobile-command-status-panel[\s\S]*width:\s*min\(360px,[\s\S]*max-height:\s*calc\(100dvh/);
    expect(mobileCss).toMatch(/#mobile-command-surface\.is-status-open\s+\.mobile-command-status-panel[\s\S]*transform:\s*translateY\(0\)\s*scale\(1\)/);
    expect(mobileCss).toMatch(/\.mobile-command-status-content\s+#manifest-effect-panel,[\s\S]*\.mobile-command-status-content\s+#stone-info-panel[\s\S]*display:\s*block\s*!important/);
    expect(mobileCss).toMatch(/\.player-area-top\s+\.mobile-command-opponent-avatar[\s\S]*width:\s*clamp\(48px,\s*13vw,\s*56px\)[\s\S]*min-height:\s*48px/);
    expect(mobileCss).toMatch(/\.mobile-command-opponent-avatar-image[\s\S]*object-fit:\s*cover[\s\S]*object-position:\s*center top/);
  });

  test('phone portrait keeps the board, status, card detail, and hand inside the viewport', () => {
    const mobileCss = readRepoTextFile('styles-mobile-command-surface.css');
    const responsiveCss = readRepoTextFile('styles-responsive.css');

    expect(mobileCss).toMatch(/html\.layout-profile-phone-portrait\s+#game-container[\s\S]*overflow-x:\s*clip/);
    expect(responsiveCss).toMatch(/--board-frame-inner-size:\s*min\([\s\S]*78vw,[\s\S]*37dvh[\s\S]*\)/);
    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait\s+#stone-info-panel\s+\.stone-info-list-item[\s\S]*min-height:\s*calc\(50px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait\s+#card-detail-panel[\s\S]*max-height:\s*calc\(130px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(mobileCss).not.toMatch(/html\.layout-profile-phone-portrait\s+#board-frame/);
    expect(mobileCss).not.toMatch(/html\.layout-profile-phone-portrait\s+#stone-info-panel/);
    expect(mobileCss).not.toMatch(/html\.layout-profile-phone-portrait\s+#card-detail-panel/);
  });
});
