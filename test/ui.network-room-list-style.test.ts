import { readRepoTextFile } from './helpers/css-test-helpers';

function readCssRuleBlock(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm'));
  return match ? match[1] : '';
}

describe('network room list style', () => {
  test('PCネット対戦モーダルは参照画像に近い大型16:9フレームで表示する', () => {
    const css = readRepoTextFile('styles-layout-info.css');
    const modalBlock = readCssRuleBlock(css, '#networkModal');

    expect(modalBlock).toMatch(/width:\s*min\(94vw,\s*calc\(94dvh \* 1\.7777778\),\s*1100px\)/);
    expect(modalBlock).toMatch(/max-height:\s*94dvh/);
    expect(modalBlock).toMatch(/aspect-ratio:\s*16\s*\/\s*9/);
  });

  test('ルームカードの参加済みと退出ボタンは初期表示で見える実レイアウト行に置く', () => {
    const css = readRepoTextFile('styles-layout-info.css');
    const panelBlock = readCssRuleBlock(css, '#networkRoomListPanel');
    const listBlock = readCssRuleBlock(css, '#networkRoomList');
    const entryBlock = readCssRuleBlock(css, '.network-room-list-entry');
    const entryFrameBlock = readCssRuleBlock(css, '.network-room-list-entry::before');
    const bodyBlock = readCssRuleBlock(css, '.network-room-entry-body');
    const actionBlock = readCssRuleBlock(css, '.network-room-list-entry > .btn-small');
    const joinBlocks = Array.from(css.matchAll(/\n\.network-room-entry-join\s*\{([\s\S]*?)\n\}/gm));
    const joinLayoutBlock = joinBlocks.at(-1)?.[1] ?? '';
    const spectateBlocks = Array.from(css.matchAll(/\n\.network-room-entry-spectate\s*\{([\s\S]*?)\n\}/gm));
    const spectateLayoutBlock = spectateBlocks.at(-1)?.[1] ?? '';

    expect(panelBlock).toMatch(/grid-template-rows:\s*clamp\(36px,\s*3vw,\s*50px\)\s+minmax\(0,\s*1fr\)/);
    expect(listBlock).toMatch(/align-content:\s*start/);
    expect(listBlock).toMatch(/align-items:\s*start/);
    expect(listBlock).toMatch(/min-height:\s*100%/);
    expect(listBlock).toMatch(/height:\s*auto/);
    expect(listBlock).toMatch(/padding:\s*0\s+0\.5%\s+0/);
    expect(entryBlock).toMatch(/grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(entryBlock).toMatch(/grid-template-rows:\s*minmax\(0,\s*1fr\)\s+auto/);
    expect(entryBlock).toMatch(/min-height:\s*clamp\(244px,\s*15\.9vw,\s*286px\)/);
    expect(entryBlock).toMatch(/--network-room-card-cut-x:\s*clamp\(13px,\s*1vw,\s*19px\)/);
    expect(entryBlock).toMatch(/--network-room-card-step-x:\s*clamp\(30px,\s*2\.15vw,\s*42px\)/);
    expect(entryBlock).toMatch(/clip-path:\s*none/);
    expect(entryBlock).toMatch(/overflow:\s*visible/);
    expect(entryFrameBlock).toMatch(/clip-path:\s*polygon\(/);
    expect(entryFrameBlock).toMatch(/var\(--network-room-card-step-y\)/);
    expect(bodyBlock).toMatch(/grid-column:\s*1\s*\/\s*-1/);
    expect(bodyBlock).toMatch(/min-height:\s*0/);
    expect(bodyBlock).toMatch(/padding-bottom:\s*0/);
    expect(actionBlock).toMatch(/position:\s*relative/);
    expect(actionBlock).toMatch(/bottom:\s*auto/);
    expect(actionBlock).toMatch(/width:\s*100%/);
    expect(actionBlock).toMatch(/min-height:\s*clamp\(39px,\s*2\.78vw,\s*50px\)/);
    expect(joinLayoutBlock).toMatch(/grid-column:\s*1/);
    expect(joinLayoutBlock).toMatch(/left:\s*auto/);
    expect(spectateLayoutBlock).toMatch(/grid-column:\s*2/);
    expect(spectateLayoutBlock).toMatch(/right:\s*auto/);
  });

  test('ルームカード下部は参照画像の色分けと選択中リボンを持つ', () => {
    const css = readRepoTextFile('styles-layout-info.css');
    const ribbonBlock = readCssRuleBlock(css, '.network-room-list-entry.is-current-room .network-room-entry-body::before');
    const spectatorLabelBlock = readCssRuleBlock(css, '.network-room-entry-count.is-spectator-count .network-room-entry-count-label');
    const disabledJoinBlock = readCssRuleBlock(css, '#networkRoomList .network-room-entry-join:disabled');
    const leaveBlock = readCssRuleBlock(css, '.network-room-entry-leave');
    const spectateBlocks = Array.from(css.matchAll(/\n\.network-room-entry-spectate\s*\{([\s\S]*?)\n\}/gm));
    const spectateLayoutBlock = spectateBlocks.at(-1)?.[1] ?? '';

    expect(ribbonBlock).toMatch(/content:\s*"参加中"/);
    expect(ribbonBlock).toMatch(/top:\s*calc\(-44px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(ribbonBlock).toMatch(/clip-path:\s*polygon\(0 0,\s*100% 0,\s*calc\(100% - 18px\) 100%,\s*0 100%\)/);
    expect(spectatorLabelBlock).toMatch(/color:\s*#ff2f8d/);
    expect(disabledJoinBlock).toMatch(/linear-gradient\(180deg,\s*rgba\(58,\s*62,\s*63,\s*0\.90\),\s*rgba\(10,\s*11,\s*12,\s*0\.98\)\)/);
    expect(disabledJoinBlock).toMatch(/filter:\s*saturate\(0\.48\)\s*brightness\(0\.72\)/);
    expect(leaveBlock).toMatch(/linear-gradient\(180deg,\s*rgba\(130,\s*18,\s*17,\s*0\.96\),\s*rgba\(49,\s*7,\s*8,\s*0\.99\)\)/);
    expect(spectateLayoutBlock).toMatch(/linear-gradient\(180deg,\s*rgba\(48,\s*51,\s*52,\s*0\.92\),\s*rgba\(9,\s*11,\s*13,\s*0\.99\)\)/);
  });

  test('ネット対戦ロビーの文字設計は元の白金ニュアンスを保って少しだけ装飾する', () => {
    const css = readRepoTextFile('styles-layout-info.css');
    const titleBlock = readCssRuleBlock(css, '#networkModalHeader .network-title');
    const fieldLabelBlock = readCssRuleBlock(css, '.network-field-label');
    const roomNameBlock = readCssRuleBlock(css, '.network-room-entry-name');
    const playerNameBaseBlock = readCssRuleBlock(css, '.network-room-entry-mark');
    const playerNameBlock = readCssRuleBlock(css, '.network-room-entry-mark.is-long-name');
    const countValueBlock = readCssRuleBlock(css, '.network-room-entry-count-value');
    const emptyBlock = readCssRuleBlock(css, '.network-room-list-empty');

    expect(titleBlock).toMatch(/color:\s*#fff3df/);
    expect(titleBlock).toMatch(/-webkit-text-fill-color:\s*currentColor/);
    expect(titleBlock).not.toMatch(/-webkit-background-clip:\s*text/);
    expect(titleBlock).not.toMatch(/color:\s*transparent/);
    expect(titleBlock).toMatch(/font-size:\s*clamp\(24px,\s*2\.55vw,\s*42px\)/);
    expect(titleBlock).toMatch(/font-weight:\s*800/);
    expect(titleBlock).toMatch(/font-variation-settings:\s*"wght"\s*820/);
    expect(titleBlock).toMatch(/-webkit-text-stroke:\s*calc\(0\.12px\s*\*\s*var\(--layout-stage-scale\)\)\s*rgba\(255,\s*248,\s*235,\s*0\.20\)/);
    expect(titleBlock).not.toMatch(/rgba\(43,\s*24,\s*5,\s*0\.78\)/);
    expect(roomNameBlock).toMatch(/text-wrap:\s*balance/);
    expect(roomNameBlock).toMatch(/text-overflow:\s*clip/);
    expect(roomNameBlock).toMatch(/white-space:\s*normal/);
    expect(roomNameBlock).toMatch(/overflow-wrap:\s*anywhere/);
    expect(roomNameBlock).not.toMatch(/text-overflow:\s*ellipsis/);
    expect(roomNameBlock).toMatch(/color:\s*var\(--network-lobby-cream\)/);
    expect(roomNameBlock).toMatch(/-webkit-text-fill-color:\s*currentColor/);
    expect(roomNameBlock).not.toMatch(/-webkit-background-clip:\s*text/);
    expect(roomNameBlock).toMatch(/-webkit-text-stroke:\s*calc\(0\.18px\s*\*\s*var\(--layout-stage-scale\)\)\s*rgba\(255,\s*247,\s*232,\s*0\.18\)/);
    expect(roomNameBlock).not.toMatch(/rgba\(37,\s*20,\s*4,\s*0\.62\)/);
    expect(playerNameBlock).toMatch(/text-overflow:\s*clip/);
    expect(playerNameBlock).toMatch(/white-space:\s*normal/);
    expect(playerNameBlock).toMatch(/overflow-wrap:\s*anywhere/);
    expect(playerNameBaseBlock).toMatch(/text-overflow:\s*clip/);
    expect(playerNameBaseBlock).toMatch(/white-space:\s*normal/);
    expect(playerNameBaseBlock).toMatch(/overflow-wrap:\s*anywhere/);
    expect(playerNameBaseBlock).not.toMatch(/text-overflow:\s*ellipsis/);
    expect(fieldLabelBlock).toMatch(/color:\s*var\(--network-lobby-cream\)/);
    expect(fieldLabelBlock).toMatch(/font-feature-settings:\s*"kern"\s*1,\s*"palt"\s*1/);
    expect(fieldLabelBlock).toMatch(/font-variation-settings:\s*"wght"\s*720/);
    expect(fieldLabelBlock).not.toMatch(/-webkit-text-fill-color:\s*transparent/);
    expect(countValueBlock).toMatch(/font-variant-numeric:\s*tabular-nums/);
    expect(countValueBlock).toMatch(/color:\s*var\(--network-lobby-cyan\)/);
    expect(countValueBlock).toMatch(/-webkit-text-fill-color:\s*currentColor/);
    expect(countValueBlock).not.toMatch(/-webkit-background-clip:\s*text/);
    expect(countValueBlock).toMatch(/font-feature-settings:\s*"tnum"\s*1,\s*"kern"\s*1/);
    expect(countValueBlock).toMatch(/-webkit-text-stroke:\s*calc\(0\.12px\s*\*\s*var\(--layout-stage-scale\)\)\s*rgba\(234,\s*255,\s*255,\s*0\.18\)/);
    expect(emptyBlock).toMatch(/text-wrap:\s*balance/);
    expect(emptyBlock).not.toMatch(/-webkit-text-fill-color:\s*transparent/);
  });

  test('PCではルーム一覧を専用viewport内で縦スクロールし、phone portraitでは全展開する', () => {
    const layoutCss = readRepoTextFile('styles-layout-info.css');
    const responsiveCss = readRepoTextFile('styles-responsive.css');
    const viewportBlock = readCssRuleBlock(layoutCss, '#networkRoomListViewport');
    const mobileViewportBlock = readCssRuleBlock(responsiveCss, 'html.layout-profile-phone-portrait #networkRoomListViewport');

    expect(viewportBlock).toMatch(/overflow-y:\s*auto/);
    expect(viewportBlock).toMatch(/overflow-x:\s*hidden/);
    expect(viewportBlock).toMatch(/min-height:\s*0/);
    expect(mobileViewportBlock).toMatch(/max-height:\s*none/);
    expect(mobileViewportBlock).toMatch(/overflow:\s*visible/);
  });

  test('ルーム一覧見出しは背景枠に合わせて少し下げる', () => {
    const css = readRepoTextFile('styles-layout-info.css');
    const roomListTitleBlocks = Array.from(css.matchAll(/\n\.network-room-list-title\s*\{([\s\S]*?)\n\}/gm));
    const roomListTitleBlock = roomListTitleBlocks.at(-1)?.[1] ?? '';
    const sharedSectionTitleBlock = readCssRuleBlock(css, '#networkPanel .network-section-title,\n.network-room-list-title');

    expect(roomListTitleBlocks).toHaveLength(2);
    expect(roomListTitleBlock).toMatch(/transform:\s*translateY\(calc\(8px\s*\*\s*var\(--layout-stage-scale\)\)\)/);
    expect(sharedSectionTitleBlock).not.toMatch(/transform:\s*translateY/);
  });

  test('部屋作成設定の歯車は部屋作成ボタン左に配置し、ポップアップだけ開ける', () => {
    const html = readRepoTextFile('index.html');
    const css = readRepoTextFile('styles-layout-info.css');
    const responsiveCss = readRepoTextFile('styles-responsive.css');
    const settingsBtnBlock = readCssRuleBlock(css, '#networkRoomSettingsBtn');
    const settingsPopupBlock = readCssRuleBlock(css, '#networkRoomSettingsPopup');
    const settingsPopupOpenBlock = readCssRuleBlock(css, '#networkRoomSettingsPopup.is-open');
    const mobileSettingsBtnBlock = readCssRuleBlock(responsiveCss, 'html.layout-profile-phone-portrait #networkRoomSettingsBtn');

    expect(html).toMatch(/id="networkRoomSettingsBtn"[\s\S]*aria-controls="networkRoomSettingsPopup"[\s\S]*⚙/);
    expect(html).toMatch(/id="networkRoomSettingsPopup"[\s\S]*aria-hidden="true"/);
    expect(settingsBtnBlock).toMatch(/right:\s*calc\(100%\s*\+\s*clamp\(8px,\s*0\.58vw,\s*12px\)\)/);
    expect(settingsBtnBlock).toMatch(/border-radius:\s*50%/);
    expect(settingsPopupBlock).toMatch(/display:\s*none/);
    expect(settingsPopupOpenBlock).toMatch(/display:\s*grid/);
    expect(mobileSettingsBtnBlock).toMatch(/position:\s*static/);
  });

  test('部屋作成と更新ボタンは光彩を持ち、更新文字は背景枠からずれない', () => {
    const css = readRepoTextFile('styles-layout-info.css');
    const createBlock = readCssRuleBlock(css, '#networkActionRow #networkCreateBtn');
    const createHoverBlock = readCssRuleBlock(css, '#networkActionRow #networkCreateBtn:hover,\n#networkActionRow #networkCreateBtn:focus-visible');
    const createActiveBlock = readCssRuleBlock(css, '#networkActionRow #networkCreateBtn:active');
    const refreshHeaderBlock = readCssRuleBlock(css, '#networkRoomListHeader');
    const refreshBlock = readCssRuleBlock(css, '#networkRoomListRefreshBtn');
    const refreshHoverBlock = readCssRuleBlock(css, '#networkRoomListRefreshBtn:hover,\n#networkRoomListRefreshBtn:focus-visible');
    const refreshActiveBlock = readCssRuleBlock(css, '#networkRoomListRefreshBtn:active');

    expect(createBlock).toMatch(/transition:\s*color 160ms ease,\s*filter 160ms ease,\s*text-shadow 160ms ease,\s*transform 160ms ease/);
    expect(createHoverBlock).toMatch(/color:\s*#fff7ec/);
    expect(createHoverBlock).toMatch(/drop-shadow\(0 0 calc\(8px \* var\(--layout-stage-scale\)\) rgba\(36,\s*244,\s*255,\s*0\.24\)\)/);
    expect(createHoverBlock).toMatch(/transform:\s*translateY\(calc\(-1px\s*\*\s*var\(--layout-stage-scale\)\)\)/);
    expect(createActiveBlock).toMatch(/transform:\s*translateY\(calc\(1px\s*\*\s*var\(--layout-stage-scale\)\)\)/);
    expect(refreshHeaderBlock).toMatch(/--network-room-refresh-width:\s*10\.17cqw/);
    expect(refreshHeaderBlock).toMatch(/--network-room-refresh-height:\s*3\.53cqw/);
    expect(refreshHeaderBlock).toMatch(/--network-room-refresh-font-size:\s*1\.56cqw/);
    expect(refreshHeaderBlock).toMatch(/--network-room-refresh-offset-y:\s*2\.49cqw/);
    expect(refreshHeaderBlock).toMatch(/container-type:\s*inline-size/);
    expect(refreshBlock).toMatch(/width:\s*var\(--network-room-refresh-width\)/);
    expect(refreshBlock).toMatch(/height:\s*var\(--network-room-refresh-height\)/);
    expect(refreshBlock).toMatch(/font-size:\s*var\(--network-room-refresh-font-size\)/);
    expect(refreshBlock).toMatch(/transform:\s*translateY\(var\(--network-room-refresh-offset-y\)\)/);
    expect(refreshBlock).toMatch(/transition:\s*color 160ms ease,\s*filter 160ms ease,\s*text-shadow 160ms ease/);
    expect(refreshBlock).not.toMatch(/transition:[^;]*transform/);
    expect(refreshHoverBlock).toMatch(/color:\s*#fff7ec/);
    expect(refreshHoverBlock).not.toMatch(/transform\s*:/);
    expect(refreshActiveBlock).not.toMatch(/transform\s*:/);
  });

  test('観戦ボタンは参照画像の暗色ボタンとして表示する', () => {
    const css = readRepoTextFile('styles-layout-info.css');
    const spectateBlocks = Array.from(css.matchAll(/\n\.network-room-entry-spectate\s*\{([\s\S]*?)\n\}/gm));
    const spectateBlock = spectateBlocks.at(-1)?.[1] ?? '';

    expect(spectateBlock).toMatch(/color:\s*#f4ead8/);
    expect(spectateBlock).toMatch(/border-color:\s*rgba\(197,\s*180,\s*143,\s*0\.52\)/);
    expect(spectateBlock).toMatch(/linear-gradient\(180deg,\s*rgba\(48,\s*51,\s*52,\s*0\.92\),\s*rgba\(9,\s*11,\s*13,\s*0\.99\)\)/);
    expect(css).not.toMatch(/#networkJoinBtn,\s*\.network-room-entry-join,\s*\.network-room-entry-spectate/);
  });
});
