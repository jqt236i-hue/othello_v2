import { JSDOM } from 'jsdom';
import { setupMobileCommandSurface } from '../ui/mobile-command-surface';

function createFixture() {
  const dom = new JSDOM(`<!doctype html>
    <html class="layout-profile-phone-portrait" data-layout-profile="layout-profile-phone-portrait">
      <body>
        <div id="leftActionButtons">
          <button id="modeCpuBtn"><span class="left-action-icon left-action-icon-cpu"></span>CPU</button>
          <button id="modeNetworkBtn"><span class="left-action-icon left-action-icon-network"></span>ネット対戦</button>
          <button id="ratedMatchOpenBtn"><span class="left-action-icon left-action-icon-rated"></span>レート戦</button>
          <a id="reversiDestinyOpenLink" href="https://example.com/" target="_blank" rel="noopener noreferrer">
            <span class="left-action-icon left-action-icon-reversi-destiny"></span>2Dアクション
          </a>
          <button id="deckBuilderOpenBtn"><span class="left-action-icon left-action-icon-deck"></span>デッキ</button>
          <button id="gachaOpenBtn"><span class="left-action-icon left-action-icon-gacha"></span>ガチャ</button>
          <button id="handSkinBtn"><span class="left-action-icon left-action-icon-skin"></span>スキン</button>
          <button id="leaderboardOpenBtn"><span class="left-action-icon left-action-icon-ranking"></span>ランキング</button>
          <button id="profileOpenBtn"><span class="left-action-icon left-action-icon-profile"></span>プロフィール</button>
          <button id="rulesHelpBtn"><span class="left-action-icon left-action-icon-help"></span>ヘルプ</button>
          <button id="sidePanelToggleBtn"><span class="left-action-icon left-action-icon-settings"></span>設定</button>
        </div>
        <div id="quick-controls-bar">
          <button id="resetBtn" data-rematch-state="local">リセット</button>
          <button id="quickBgmToggleBtn" aria-pressed="true" class="btn-active">BGM: ON</button>
          <button id="autoToggleBtn" aria-pressed="false">AUTO: OFF</button>
          <button id="muteBtn">音声: ON</button>
          <select id="bgmTrackSelect">
            <option value="0">通常曲</option>
            <option value="1">対戦曲</option>
          </select>
          <input id="seVolSlider" type="range" min="0" max="2" step="0.05" value="1">
        </div>
        <div id="side-panel" aria-hidden="true"><div id="control-panel"></div></div>
        <div id="handSkinPanel" aria-hidden="true" role="dialog" aria-modal="false"><div id="handSkinPanelHeader"><button id="handSkinCloseBtn">×</button></div></div>
        <div id="rules-help-panel" aria-hidden="true" role="dialog" aria-modal="false">
          <div id="rules-help-title-row"><button id="rules-help-close-btn">×</button></div>
          <div id="rules-help-catalog-layout">
            <div id="rules-help-catalog-controls"></div>
          </div>
        </div>
        <div id="leaderboardOverlay" aria-hidden="true"><div id="leaderboardModalHeader"><button id="leaderboardCloseBtn">×</button></div></div>
        <div id="profileOverlay" aria-hidden="true"><div id="profileModalHeader"><button id="profileCloseBtn">×</button></div></div>
        <div id="gachaOverlay" aria-hidden="true"><div id="gachaModalHeader"><button id="gachaCloseBtn">×</button></div></div>
        <div id="deckBuilderOverlay" aria-hidden="true"><div id="deckBuilderModalHeader"><button id="deckBuilderCloseBtn">×</button></div></div>
        <div id="networkOverlay" aria-hidden="true"><div id="networkModalHeader"><button id="networkCloseBtn">×</button></div></div>
        <div id="ratedMatchOverlay" aria-hidden="true"><div id="ratedMatchModalHeader"><button id="ratedMatchCloseBtn">×</button></div></div>
      </body>
    </html>`, {
    url: 'http://localhost/',
    pretendToBeVisual: true,
  });
  const windowRef = dom.window as unknown as Window;
  (windowRef as any).requestAnimationFrame = (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  };

  const panelPairs: Array<[string, string, string]> = [
    ['modeNetworkBtn', 'networkOverlay', 'networkCloseBtn'],
    ['ratedMatchOpenBtn', 'ratedMatchOverlay', 'ratedMatchCloseBtn'],
    ['deckBuilderOpenBtn', 'deckBuilderOverlay', 'deckBuilderCloseBtn'],
    ['gachaOpenBtn', 'gachaOverlay', 'gachaCloseBtn'],
    ['handSkinBtn', 'handSkinPanel', 'handSkinCloseBtn'],
    ['leaderboardOpenBtn', 'leaderboardOverlay', 'leaderboardCloseBtn'],
    ['profileOpenBtn', 'profileOverlay', 'profileCloseBtn'],
    ['rulesHelpBtn', 'rules-help-panel', 'rules-help-close-btn'],
    ['sidePanelToggleBtn', 'side-panel', 'sidePanelToggleBtn'],
  ];
  panelPairs.forEach(([openId, panelId, closeId]) => {
    const open = dom.window.document.getElementById(openId)!;
    const panel = dom.window.document.getElementById(panelId)!;
    open.addEventListener('click', () => {
      const nextOpen = panel.getAttribute('aria-hidden') !== 'false';
      panel.classList.toggle('is-open', nextOpen);
      panel.setAttribute('aria-hidden', nextOpen ? 'false' : 'true');
    });
    if (closeId !== openId) {
      dom.window.document.getElementById(closeId)!.addEventListener('click', () => {
        panel.classList.remove('is-open');
        panel.setAttribute('aria-hidden', 'true');
      });
    }
  });

  return {
    dom,
    windowRef,
    documentRef: dom.window.document,
  };
}

describe('mobile command surface', () => {
  test('initializes once and keeps the drawer and quick sheet mutually exclusive', () => {
    const fixture = createFixture();
    const controller = setupMobileCommandSurface({
      root: fixture.windowRef,
      document: fixture.documentRef,
    });
    const second = setupMobileCommandSurface({
      root: fixture.windowRef,
      document: fixture.documentRef,
    });

    expect(controller).not.toBeNull();
    expect(second).toBe(controller);
    expect(fixture.documentRef.querySelectorAll('#mobile-command-surface')).toHaveLength(1);
    expect(fixture.documentRef.querySelector('#mobile-command-menu-action')).not.toBeNull();

    controller!.openDrawer();
    const surface = fixture.documentRef.getElementById('mobile-command-surface')!;
    expect(surface.classList.contains('is-drawer-open')).toBe(true);
    expect(fixture.documentRef.body.classList.contains('mobile-command-surface-locked')).toBe(true);
    expect(fixture.documentRef.getElementById('mobile-command-drawer')!.getAttribute('aria-hidden')).toBe('false');

    controller!.openQuickControls();
    expect(surface.classList.contains('is-drawer-open')).toBe(false);
    expect(surface.classList.contains('is-quick-open')).toBe(true);

    fixture.windowRef.dispatchEvent(new (fixture.windowRef as any).PopStateEvent('popstate'));
    expect(surface.classList.contains('is-quick-open')).toBe(false);
    expect(fixture.documentRef.body.classList.contains('mobile-command-surface-locked')).toBe(false);

    controller!.destroy();
    fixture.dom.window.close();
  });

  test('delegates quick actions, BGM selection, and master volume to existing controls', () => {
    const fixture = createFixture();
    const confirmReset = jest.fn(() => false);
    const resetSource = fixture.documentRef.getElementById('resetBtn')!;
    const resetHandler = jest.fn();
    resetSource.addEventListener('click', resetHandler);
    const bgmSource = fixture.documentRef.getElementById('bgmTrackSelect') as HTMLSelectElement;
    const bgmHandler = jest.fn();
    bgmSource.addEventListener('change', bgmHandler);
    const volumeSource = fixture.documentRef.getElementById('seVolSlider') as HTMLInputElement;
    const volumeHandler = jest.fn();
    volumeSource.addEventListener('input', volumeHandler);

    const controller = setupMobileCommandSurface({
      root: fixture.windowRef,
      document: fixture.documentRef,
      confirmReset,
    })!;
    controller.openQuickControls();

    const resetProxy = fixture.documentRef.querySelector<HTMLButtonElement>('[data-mobile-proxy="resetBtn"]')!;
    resetProxy.click();
    expect(confirmReset).toHaveBeenCalledWith('現在の対局をリセットしますか？');
    expect(resetHandler).not.toHaveBeenCalled();

    confirmReset.mockReturnValue(true);
    resetProxy.click();
    expect(resetHandler).toHaveBeenCalledTimes(1);

    const mobileBgm = fixture.documentRef.getElementById('mobile-command-bgm-select') as HTMLSelectElement;
    mobileBgm.value = '1';
    mobileBgm.dispatchEvent(new fixture.dom.window.Event('change', { bubbles: true }));
    expect(bgmSource.value).toBe('1');
    expect(bgmHandler).toHaveBeenCalledTimes(1);

    const mobileVolume = fixture.documentRef.getElementById('mobile-command-volume-slider') as HTMLInputElement;
    mobileVolume.value = '1.5';
    mobileVolume.dispatchEvent(new fixture.dom.window.Event('input', { bubbles: true }));
    expect(volumeSource.value).toBe('1.5');
    expect(volumeHandler).toHaveBeenCalledTimes(1);

    controller.destroy();
    fixture.dom.window.close();
  });

  test('opens existing native panels and adds mobile navigation chrome', () => {
    const fixture = createFixture();
    const controller = setupMobileCommandSurface({
      root: fixture.windowRef,
      document: fixture.documentRef,
    })!;
    controller.openDrawer();

    fixture.documentRef.getElementById('mobile-command-menu-network')!.click();
    controller.sync();

    const surface = fixture.documentRef.getElementById('mobile-command-surface')!;
    const networkPanel = fixture.documentRef.getElementById('networkOverlay')!;
    expect(networkPanel.classList.contains('is-open')).toBe(true);
    expect(networkPanel.classList.contains('mobile-command-native-panel')).toBe(true);
    expect(networkPanel.getAttribute('aria-modal')).toBe('true');
    expect(surface.classList.contains('has-native-panel')).toBe(true);
    expect(fixture.documentRef.querySelector('#networkModalHeader .mobile-command-current-location')?.textContent)
      .toBe('メニュー / ネット対戦');

    fixture.documentRef.getElementById('networkCloseBtn')!.click();
    controller.sync();
    expect(surface.classList.contains('has-native-panel')).toBe(false);
    expect(fixture.documentRef.body.classList.contains('mobile-command-surface-locked')).toBe(false);

    controller.openDrawer();
    fixture.documentRef.getElementById('mobile-command-menu-settings')!.click();
    controller.sync();
    expect(fixture.documentRef.getElementById('mobile-command-settings-header')).not.toBeNull();
    expect(fixture.documentRef.querySelector('#mobile-command-settings-header .mobile-command-native-close')).not.toBeNull();

    controller.destroy();
    fixture.dom.window.close();
  });

  test('restores injected chrome and existing attributes before a clean reinitialization', () => {
    const fixture = createFixture();
    const controller = setupMobileCommandSurface({
      root: fixture.windowRef,
      document: fixture.documentRef,
    })!;

    controller.openDrawer();
    fixture.documentRef.getElementById('mobile-command-menu-help')!.click();
    controller.sync();

    const helpPanel = fixture.documentRef.getElementById('rules-help-panel')!;
    const helpHeader = fixture.documentRef.getElementById('rules-help-title-row')!;
    const helpClose = fixture.documentRef.getElementById('rules-help-close-btn')!;
    const helpLayout = fixture.documentRef.getElementById('rules-help-catalog-layout')!;
    const firstToggle = fixture.documentRef.getElementById('mobile-command-help-filter-toggle')!;
    expect(helpPanel.classList.contains('mobile-command-native-panel')).toBe(true);
    expect(helpPanel.getAttribute('aria-modal')).toBe('true');
    expect(helpHeader.classList.contains('mobile-command-native-header')).toBe(true);
    expect(helpClose.classList.contains('mobile-command-native-close')).toBe(true);
    expect(helpLayout.classList.contains('is-mobile-filters-collapsed')).toBe(true);

    firstToggle.click();
    expect(helpLayout.classList.contains('is-mobile-filters-collapsed')).toBe(false);
    controller.destroy();

    expect(fixture.documentRef.getElementById('mobile-command-help-filter-toggle')).toBeNull();
    expect(fixture.documentRef.querySelector('#rules-help-title-row .mobile-command-current-location')).toBeNull();
    expect(helpPanel.classList.contains('mobile-command-native-panel')).toBe(false);
    expect(helpPanel.getAttribute('role')).toBe('dialog');
    expect(helpPanel.getAttribute('aria-modal')).toBe('false');
    expect(helpHeader.classList.contains('mobile-command-native-header')).toBe(false);
    expect(helpClose.classList.contains('mobile-command-native-close')).toBe(false);
    expect(helpLayout.classList.contains('is-mobile-filters-collapsed')).toBe(false);

    fixture.documentRef.getElementById('rules-help-close-btn')!.click();
    fixture.windowRef.history.replaceState({}, '');
    const secondController = setupMobileCommandSurface({
      root: fixture.windowRef,
      document: fixture.documentRef,
    })!;
    secondController.openDrawer();
    fixture.documentRef.getElementById('mobile-command-menu-help')!.click();
    secondController.sync();

    const secondToggle = fixture.documentRef.getElementById('mobile-command-help-filter-toggle')!;
    expect(secondToggle).not.toBe(firstToggle);
    expect(helpLayout.classList.contains('is-mobile-filters-collapsed')).toBe(true);
    secondToggle.click();
    expect(helpLayout.classList.contains('is-mobile-filters-collapsed')).toBe(false);

    secondController.destroy();
    fixture.dom.window.close();
  });

  test('restores mobile panel decorations when the phone profile is left', () => {
    const fixture = createFixture();
    const controller = setupMobileCommandSurface({
      root: fixture.windowRef,
      document: fixture.documentRef,
    })!;
    controller.openDrawer();
    fixture.documentRef.getElementById('mobile-command-menu-appearance')!.click();
    controller.sync();

    const panel = fixture.documentRef.getElementById('handSkinPanel')!;
    const header = fixture.documentRef.getElementById('handSkinPanelHeader')!;
    expect(panel.getAttribute('aria-modal')).toBe('true');
    expect(panel.classList.contains('mobile-command-native-panel')).toBe(true);
    expect(header.classList.contains('mobile-command-native-header')).toBe(true);

    fixture.documentRef.documentElement.classList.remove('layout-profile-phone-portrait');
    fixture.documentRef.documentElement.removeAttribute('data-layout-profile');
    fixture.windowRef.dispatchEvent(new fixture.dom.window.Event('resize'));

    expect(panel.getAttribute('aria-modal')).toBe('false');
    expect(panel.getAttribute('role')).toBe('dialog');
    expect(panel.classList.contains('mobile-command-native-panel')).toBe(false);
    expect(header.classList.contains('mobile-command-native-header')).toBe(false);
    expect(fixture.documentRef.querySelector('#handSkinPanelHeader .mobile-command-current-location')).toBeNull();
    expect(fixture.documentRef.body.classList.contains('mobile-command-surface-locked')).toBe(false);

    fixture.windowRef.history.replaceState({}, '');
    fixture.documentRef.documentElement.classList.add('layout-profile-phone-portrait');
    fixture.documentRef.documentElement.setAttribute(
      'data-layout-profile',
      'layout-profile-phone-portrait',
    );
    fixture.windowRef.dispatchEvent(new fixture.dom.window.Event('resize'));
    controller.openDrawer();
    fixture.documentRef.getElementById('mobile-command-menu-appearance')!.click();
    controller.sync();
    expect(panel.getAttribute('aria-modal')).toBe('true');
    expect(panel.classList.contains('mobile-command-native-panel')).toBe(true);
    expect(header.classList.contains('mobile-command-native-header')).toBe(true);

    controller.destroy();
    fixture.dom.window.close();
  });

  test('closes a custom layer with Escape and restores its opening focus', () => {
    const fixture = createFixture();
    const controller = setupMobileCommandSurface({
      root: fixture.windowRef,
      document: fixture.documentRef,
    })!;
    const cpuButton = fixture.documentRef.getElementById('modeCpuBtn') as HTMLButtonElement;
    cpuButton.focus();
    controller.openDrawer();

    fixture.documentRef.dispatchEvent(new fixture.dom.window.KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    }));

    expect(fixture.documentRef.getElementById('mobile-command-surface')!
      .classList.contains('is-drawer-open')).toBe(false);
    expect(fixture.documentRef.activeElement).toBe(cpuButton);
    controller.destroy();
    fixture.dom.window.close();
  });

  test('does not move focus when a native panel was opened outside the mobile menu', () => {
    const fixture = createFixture();
    const controller = setupMobileCommandSurface({
      root: fixture.windowRef,
      document: fixture.documentRef,
    })!;
    const cpuButton = fixture.documentRef.getElementById('modeCpuBtn') as HTMLButtonElement;
    cpuButton.focus();

    fixture.documentRef.getElementById('modeNetworkBtn')!.click();
    controller.sync();
    fixture.documentRef.getElementById('networkCloseBtn')!.click();
    controller.sync();

    expect(fixture.documentRef.activeElement).toBe(cpuButton);
    controller.destroy();
    fixture.dom.window.close();
  });
});
