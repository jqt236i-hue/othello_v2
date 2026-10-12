import {
  readLayoutCssSurface,
  readRepoTextFile,
  readCssBlock,
} from './helpers/css-test-helpers';

describe('left action rail layout contract', () => {
  test('left action rail keeps vertical fixed desktop layout', () => {
    const layoutCss = readLayoutCssSurface();

    expect(layoutCss).toMatch(/#leftActionButtons[\s\S]*position:\s*fixed/);
    expect(layoutCss).toMatch(/#leftActionButtons[\s\S]*--left-rail-accent:\s*#53d6d1/);
    expect(layoutCss).toMatch(/#leftActionButtons[\s\S]*--left-rail-accent-soft:\s*#233f46/);
    expect(layoutCss).toMatch(/#leftActionButtons[\s\S]*--left-rail-iron:\s*#081012/);
    expect(layoutCss).toMatch(/#leftActionButtons[\s\S]*top:\s*calc\(var\(--layout-stage-offset-y\)\s*\+\s*max\(calc\(176px\s*\*\s*var\(--layout-stage-scale\)\),\s*env\(safe-area-inset-top\)\s*\+\s*calc\(24px\s*\*\s*var\(--layout-stage-scale\)\)\)\)/);
    expect(layoutCss).toMatch(/#leftActionButtons[\s\S]*padding:\s*calc\(12px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(layoutCss).toMatch(/#leftActionButtons[\s\S]*clip-path:\s*polygon\(/);
    expect(layoutCss).toMatch(/#leftActionButtons[\s\S]*flex-direction:\s*column/);
    expect(layoutCss).toMatch(/#leftActionButtons::before[\s\S]*linear-gradient\(90deg,\s*transparent,\s*rgba\(83,\s*214,\s*209/);
    expect(layoutCss).toMatch(/#leftActionButtons::after[\s\S]*linear-gradient\(180deg,\s*transparent,\s*rgba\(185,\s*154,\s*87,\s*0\.42\),\s*rgba\(92,\s*122,\s*94,\s*0\.28\),\s*transparent\)/);
    expect(layoutCss).toMatch(/#leftActionButtons\s+\.left-action-btn[\s\S]*min-width:\s*calc\(88px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(layoutCss).toMatch(/#leftActionButtons\s+\.left-action-btn[\s\S]*--left-action-tone:/);
    expect(layoutCss).toMatch(/#leftActionButtons\s+\.left-action-btn[\s\S]*linear-gradient\(90deg,\s*var\(--left-action-tone\)/);
    expect(layoutCss).toMatch(/#leftActionButtons\s+\.left-action-btn[\s\S]*grid-template-rows/);
    expect(layoutCss).toMatch(/#leftActionButtons\s+\.left-action-btn[\s\S]*transition:/);
    expect(layoutCss).toMatch(/#leftActionButtons\s+\.left-action-icon[\s\S]*mask-image/);
    expect(layoutCss).toMatch(/#modeCpuBtn[\s\S]*--left-action-tone:\s*rgba\(106,\s*255,\s*172,\s*0\.24\)/);
    expect(layoutCss).toMatch(/#modeNetworkBtn[\s\S]*--left-action-tone:\s*rgba\(93,\s*171,\s*255,\s*0\.24\)/);
    expect(layoutCss).toMatch(/#reversiDestinyOpenLink[\s\S]*--left-action-tone:\s*rgba\(255,\s*137,\s*90,\s*0\.23\)/);
    expect(layoutCss).toMatch(/#gachaOpenBtn[\s\S]*--left-action-tone:\s*rgba\(255,\s*130,\s*92,\s*0\.20\)/);
    expect(layoutCss).toMatch(/#handSkinBtn[\s\S]*--left-action-tone:\s*rgba\(210,\s*130,\s*255,\s*0\.2\)/);
  });

  test('primary left action buttons darken their opened state', () => {
    const layoutCss = readLayoutCssSurface();
    const deckBuilderCss = readRepoTextFile('styles-feature-deck-builder.css');

    expect(layoutCss).toMatch(/#leftActionButtons\s+:is\(#modeNetworkBtn,\s*#gachaOpenBtn,\s*#deckBuilderOpenBtn,\s*#leaderboardOpenBtn\)\[aria-expanded="true"\][\s\S]*linear-gradient\(180deg,\s*rgba\(2,\s*14,\s*17,\s*0\.94\),\s*rgba\(1,\s*8,\s*10,\s*0\.96\)\)/);
    expect(layoutCss).toMatch(/#leftActionButtons\s+:is\(#modeNetworkBtn,\s*#gachaOpenBtn,\s*#deckBuilderOpenBtn,\s*#leaderboardOpenBtn\)\[aria-expanded="true"\][\s\S]*inset calc\(3px \* var\(--layout-stage-scale\)\) 0 0 var\(--left-action-tone-strong\)/);
    expect(deckBuilderCss).not.toMatch(/#leftActionButtons\s+:is\(#modeNetworkBtn/);
  });

  test('left action popups use the premium game panel skin', () => {
    const layoutCss = readLayoutCssSurface();

    expect(layoutCss).toMatch(/:is\(#networkModal,\s*#leaderboardModal,\s*#gachaModal,\s*#deckBuilderModal,\s*#handSkinPanel,\s*#rules-help-panel,\s*#control-panel\)[\s\S]*clip-path:\s*polygon\(/);
    expect(layoutCss).toMatch(/:is\(#networkModal,\s*#leaderboardModal,\s*#gachaModal,\s*#deckBuilderModal,\s*#handSkinPanel,\s*#rules-help-panel,\s*#control-panel\)[\s\S]*--rail-panel-accent:\s*#53d6d1/);
    expect(layoutCss).toMatch(/:is\(#networkModal,\s*#leaderboardModal,\s*#gachaModal,\s*#deckBuilderModal,\s*#handSkinPanel,\s*#rules-help-panel,\s*#control-panel\)[\s\S]*--rail-panel-gold:\s*#f2c95f/);
    expect(layoutCss).toMatch(/:is\(#leaderboardModal,\s*#gachaModal,\s*#deckBuilderModal,\s*#handSkinPanel,\s*#rules-help-panel,\s*#control-panel\)::before[\s\S]*linear-gradient\(90deg,\s*transparent,\s*rgba\(83,\s*214,\s*209/);
    expect(layoutCss).toMatch(/:is\(#networkCloseBtn,\s*#leaderboardCloseBtn,\s*#gachaCloseBtn,\s*#deckBuilderCloseBtn,\s*#handSkinCloseBtn,\s*#rules-help-close-btn\)[\s\S]*border-radius:\s*50%/);
    expect(layoutCss).toMatch(/:is\(#networkModalHeader,\s*#leaderboardModalHeader,\s*#gachaModalHeader,\s*#deckBuilderModalHeader,\s*#handSkinPanelHeader,\s*#rules-help-title-row\)[\s\S]*background:/);
    expect(layoutCss).toMatch(/:is\(#networkPanel,\s*#networkRoomListViewport,\s*#leaderboardModalBody,\s*#gachaModalBody,\s*#deckBuilderBody,\s*#handSkinOptions,\s*#backgroundSkinOptions,\s*#boardSkinOptions,\s*#fontSkinOptions,\s*#stoneSkinOptions,\s*#mySkinOptions,\s*#rules-help-pages\)[\s\S]*scrollbar-width:\s*thin/);
    expect(layoutCss).toMatch(/#handSkinPanel[\s\S]*position:\s*fixed/);
    expect(layoutCss).toMatch(/#rules-help-panel[\s\S]*position:\s*fixed/);
    expect(layoutCss).not.toMatch(/:is\(#networkModal,\s*#leaderboardModal,\s*#gachaModal,\s*#deckBuilderModal,\s*#handSkinPanel,\s*#rules-help-panel,\s*#control-panel\)\s*\{[^}]*position:\s*relative/);
  });

  test('left action popups fade in consistently when opened', () => {
    const layoutCss = readLayoutCssSurface();

    const modalOverlayBlock = readCssBlock(layoutCss, ':is(#networkOverlay, #leaderboardOverlay, #gachaOverlay, #deckBuilderOverlay)');
    expect(modalOverlayBlock).toMatch(/opacity:\s*0/);
    expect(modalOverlayBlock).toMatch(/visibility:\s*hidden/);
    expect(modalOverlayBlock).toMatch(/transition:\s*opacity\s+180ms\s+ease,\s*visibility\s+0s\s+linear\s+180ms/);

    const modalOpenBlock = readCssBlock(layoutCss, ':is(#networkOverlay, #leaderboardOverlay, #gachaOverlay, #deckBuilderOverlay).is-open');
    expect(modalOpenBlock).toMatch(/opacity:\s*1/);
    expect(modalOpenBlock).toMatch(/visibility:\s*visible/);
    expect(modalOpenBlock).toMatch(/transition-delay:\s*0s/);

    const panelBlock = readCssBlock(layoutCss, ':is(#handSkinPanel, #rules-help-panel)');
    expect(panelBlock).toMatch(/opacity:\s*0/);
    expect(panelBlock).toMatch(/visibility:\s*hidden/);
    expect(panelBlock).toMatch(/transition:\s*opacity\s+160ms\s+ease,\s*transform\s+160ms\s+ease,\s*visibility\s+0s\s+linear\s+160ms/);

    const panelOpenBlock = readCssBlock(layoutCss, ':is(#handSkinPanel, #rules-help-panel).is-open');
    expect(panelOpenBlock).toMatch(/opacity:\s*1/);
    expect(panelOpenBlock).toMatch(/visibility:\s*visible/);
    expect(panelOpenBlock).toMatch(/transition-delay:\s*0s/);
  });

  test('left action rail exposes mode and utility buttons in index markup', () => {
    const html = readRepoTextFile('index.html');

    expect(html).toMatch(/id="leftActionButtons"[\s\S]*id="modeCpuBtn"[\s\S]*id="modeNetworkBtn"[\s\S]*id="reversiDestinyOpenLink"[\s\S]*id="leaderboardOpenBtn"/);
    expect(html).not.toMatch(/id="modeReversiBtn"\s+class="btn-small left-action-btn"/);
    expect(html).toMatch(/id="control-panel"[\s\S]*id="modeReversiBtn"[\s\S]*>リバーシ</);
    expect(html).toMatch(/id="leftActionButtons"[\s\S]*id="leaderboardOpenBtn"[\s\S]*>ランキング<[\s\S]*id="deckBuilderOpenBtn"[\s\S]*>デッキ<[\s\S]*id="gachaOpenBtn"[\s\S]*>ガチャ<[\s\S]*id="handSkinBtn"[\s\S]*>スキン<[\s\S]*id="sidePanelToggleBtn"[\s\S]*>設定<[\s\S]*id="rulesHelpBtn"[\s\S]*>ヘルプ</);
    expect(html).toMatch(/id="leftActionButtons"[\s\S]*id="sidePanelToggleBtn"[\s\S]*>設定</);
    expect(html).toMatch(/id="leftActionButtons"[\s\S]*id="leftRailVisibilityBtn"[\s\S]*>非表示</);
    expect(html).toMatch(/class="left-action-icon left-action-icon-gacha"/);
    expect(html).not.toContain('ratedMatchOpenBtn');
    expect(html).toMatch(/id="parallelWorldsOpenBtn"[^>]*popovertarget="parallelWorldsPopover"/);
    expect(html).toMatch(/class="left-action-icon left-action-icon-parallel-worlds"/);
    expect(html).toMatch(/class="left-action-icon left-action-icon-deck"/);
    expect(html).toMatch(/class="left-action-icon left-action-icon-ranking"/);
    expect(html).toMatch(/id="reversiDestinyOpenLink"[\s\S]*href="https:\/\/reversi-destiny\.pages\.dev\/"[\s\S]*target="_blank"[\s\S]*rel="noopener noreferrer external"[\s\S]*referrerpolicy="no-referrer"[\s\S]*aria-describedby="parallelWorldsLinkNotice"/);
    expect(html.match(/https:\/\/reversi-destiny\.pages\.dev\//g)).toHaveLength(1);
    // 森の広場：並行世界の次に置き、押した時だけ 3D の別ページを iframe で読み込む
    expect(html).toMatch(/id="parallelWorldsOpenBtn"[\s\S]*id="forestPlazaOpenBtn"[\s\S]*>森の広場<[\s\S]*id="leaderboardOpenBtn"/);
    expect(html).toMatch(/class="left-action-icon left-action-icon-forest-plaza"/);
    expect(html).toMatch(/id="forestPlazaOverlay"[^>]*hidden/);
    expect(html).not.toMatch(/<iframe[^>]*forest-plaza/);
    expect(html).toContain("frame.src = 'vite-dist/forest-plaza.html'");
  });

  test('settings panel keeps a narrower vertical layout with an internal reversi shortcut', () => {
    const layoutCss = readLayoutCssSurface();

    expect(layoutCss).toMatch(/body #control-panel[\s\S]*max-width:\s*calc\(206px \* var\(--layout-stage-scale\)\)/);
    expect(layoutCss).toMatch(/body #control-panel \.control-group[\s\S]*flex-wrap:\s*wrap/);
    expect(layoutCss).toMatch(/body #control-panel \.control-group\.mode-shortcut-group[\s\S]*flex-direction:\s*column/);
    expect(layoutCss).toMatch(/body #control-panel #modeReversiBtn[\s\S]*width:\s*100%/);
  });

  test('left action rail can collapse to its visibility toggle', () => {
    const layoutCss = readLayoutCssSurface();
    const html = readRepoTextFile('index.html');

    expect(layoutCss).toMatch(/#leftActionButtons\.left-rail-collapsed[\s\S]*width:\s*calc\(58px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(layoutCss).toMatch(/#leftActionButtons\.left-rail-collapsed\s+\.left-action-btn:not\(\.left-action-btn-rail-toggle\)[\s\S]*display:\s*none/);
    expect(layoutCss).toMatch(/#leftActionButtons\.left-rail-collapsed\s+\.left-action-btn-rail-toggle[\s\S]*grid-template-rows:\s*1fr/);
    expect(layoutCss).toMatch(/left-action-icon-rail-toggle/);
    expect(html).toMatch(/leftRailVisibilityBtn[\s\S]*aria-expanded="true"[\s\S]*left-rail-collapsed/);
  });

  test('responsive rail overrides remain explicit', () => {
    const responsiveCss = readRepoTextFile('styles-responsive.css');
    const mobileCommandCss = readRepoTextFile('styles-mobile-command-surface.css');

    expect(responsiveCss).toMatch(/html\.layout-stage-enabled:not\(\.layout-profile-phone-portrait\)\s+#leftActionButtons[\s\S]*top:\s*max\(calc\(240px\s*\*\s*var\(--layout-stage-scale\)\),\s*env\(safe-area-inset-top\)\s*\+\s*calc\(12px\s*\*\s*var\(--layout-stage-scale\)\)\)\s*!important/);
    expect(responsiveCss).toMatch(/@media\s*\(max-width:\s*(?:900px|56\.25em)\)\s*\{[\s\S]*#leftActionButtons[\s\S]*top:/);
    expect(responsiveCss).toMatch(/html\.layout-profile-tablet-4x3\.layout-stage-enabled:not\(\.layout-profile-phone-portrait\)\s+#leftActionButtons[\s\S]*top:\s*auto/);
    expect(responsiveCss).toMatch(/html\.layout-profile-tablet-4x3\.layout-stage-enabled:not\(\.layout-profile-phone-portrait\)\s+#leftActionButtons[\s\S]*bottom:\s*max\(calc\(10px\s*\*\s*var\(--layout-stage-scale\)\),\s*env\(safe-area-inset-bottom\)\)/);
    expect(responsiveCss).toMatch(/html\.layout-profile-tablet-4x3\.layout-stage-enabled\s+#hero-character-panel[\s\S]*bottom:\s*calc\(var\(--layout-stage-offset-y\)\s*\+\s*calc\(120px\s*\*\s*var\(--layout-stage-scale\)\)\s*\+\s*var\(--layout-stage-bottom-safe-shift\)\)/);
    expect(responsiveCss).toMatch(/html\.layout-profile-tablet-4x3\.layout-stage-enabled\s+#left-info-stack[\s\S]*top:\s*calc\(var\(--layout-stage-offset-y\)\s*\+\s*calc\(150px\s*\*\s*var\(--layout-stage-scale\)\)\)/);
    expect(mobileCommandCss).toMatch(/html\.layout-profile-phone-portrait\s+:is\(\s*#leftActionButtons,\s*#quick-controls-bar\s*\)[\s\S]*display:\s*none\s*!important/);
    expect(mobileCommandCss).toMatch(/html\.layout-profile-phone-portrait\s+\.mobile-command-menu-trigger[\s\S]*top:\s*var\(--mobile-command-safe-top\)[\s\S]*left:\s*var\(--mobile-command-safe-left\)/);
    expect(responsiveCss).toMatch(/@media\s*\(orientation:\s*landscape\)\s*and\s*\(pointer:\s*coarse\)[\s\S]*#leftActionButtons[\s\S]*grid-template-columns:\s*repeat\(6,/);
    expect(responsiveCss).toMatch(/@media\s*\(orientation:\s*landscape\)\s*and\s*\(pointer:\s*coarse\)[\s\S]*#leftActionButtons[\s\S]*grid-auto-rows:\s*max\(24px,\s*calc\(44px\s*\*\s*var\(--layout-stage-scale\)\)\)/);
  });
});
