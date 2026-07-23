import { JSDOM } from 'jsdom';

describe('player profile panel controller', () => {
  let storage: Map<string, string>;
  let identityStore: any;
  let dom: JSDOM;

  async function flushAsyncWork(): Promise<void> {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }

  async function openProfile(): Promise<void> {
    document.getElementById('profileOpenBtn')!.click();
    const link = document.querySelector(
      'link[data-card-reversi-feature-style="profile"]'
    ) as HTMLLinkElement | null;
    if (link && link.dataset.cardReversiFeatureStyleLoaded !== 'true') {
      link.dispatchEvent(new dom.window.Event('load'));
    }
    await flushAsyncWork();
  }

  beforeEach(() => {
    jest.resetModules();
    storage = new Map();
    identityStore = {
      playerId: 'p_ABCDEFGHIJKLMNOPQRSTUV0001',
      playerToken: 'pt_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno12',
      recoveryCode: 'CR-ABCDE-FGHJK-MNPQR-STUVW-XYZ23'
    };
    (global as any).localStorage = {
      getItem: jest.fn((key: string) => storage.get(key) || null),
      setItem: jest.fn((key: string, value: string) => void storage.set(key, value)),
      removeItem: jest.fn((key: string) => void storage.delete(key))
    };
    dom = new JSDOM(`<!doctype html><html><head>
      <meta data-card-reversi-feature-style-slot="profile"
        data-card-reversi-feature-style-href="styles-profile.css?v=test">
    </head><body>
      <button id="profileOpenBtn" type="button" aria-controls="profileOverlay" aria-expanded="false"></button>
      <input id="leaderboardNameInput">
      <input id="networkPlayerNameInput">
      <div id="profileOverlay" aria-hidden="true">
        <div id="profileModal" role="dialog" aria-modal="true" aria-labelledby="profileModalTitle" tabindex="-1"></div>
      </div>
    </body></html>`, {
      url: 'https://example.test/?debug=1&uxMonitor=1'
    });
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    (global as any).HTMLElement = dom.window.HTMLElement;
    (global as any).HTMLInputElement = dom.window.HTMLInputElement;
    (global as any).HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
    Object.defineProperty(dom.window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: jest.fn(async () => undefined) }
    });
    jest.doMock('../ui/player-identity', () => ({
      getPlayerId: jest.fn(() => identityStore.playerId),
      getRecoveryCode: jest.fn(() => identityStore.recoveryCode),
      ensurePlayerIdentity: jest.fn(async () => identityStore),
      regenerateRecoveryCode: jest.fn(async () => {
        identityStore = Object.assign({}, identityStore, { recoveryCode: 'CR-ZYXWV-UTSRQ-PNMKJ-HGFED-CBA32' });
        return identityStore;
      }),
      recoverPlayerIdentity: jest.fn(async () => {
        identityStore = Object.assign({}, identityStore, { recoveryCode: 'CR-HHHHH-JJJJJ-KKKKK-MMMMM-NNNNN' });
        return identityStore;
      })
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete (global as any).localStorage;
    dom.window.close();
    delete (global as any).window;
    delete (global as any).document;
    delete (global as any).HTMLElement;
    delete (global as any).HTMLInputElement;
    delete (global as any).HTMLTextAreaElement;
  });

  test('keeps only the stable shell at boot and creates one retained inner surface on first open', async () => {
    const panel = require('../ui/player-profile-panel.ts');
    const controller = panel.setupPlayerProfilePanel({ root: window });

    expect(controller.ok).toBe(true);
    expect(document.getElementById('profileModal')!.childElementCount).toBe(0);
    expect(document.getElementById('profileNameInput')).toBeNull();
    expect(document.querySelectorAll('link[data-card-reversi-feature-style="profile"]')).toHaveLength(0);

    await openProfile();
    const firstNameInput = document.getElementById('profileNameInput');
    const firstModalHeader = document.getElementById('profileModalHeader');
    expect(firstNameInput).toBeTruthy();
    expect(document.getElementById('profileOverlay')!.classList.contains('is-open')).toBe(true);
    expect(document.activeElement).toBe(firstNameInput);
    expect(document.querySelectorAll('link[data-card-reversi-feature-style="profile"]')).toHaveLength(1);

    document.getElementById('profileCloseBtn')!.click();
    await openProfile();
    expect(document.getElementById('profileNameInput')).toBe(firstNameInput);
    expect(document.getElementById('profileModalHeader')).toBe(firstModalHeader);
    expect(document.querySelectorAll('link[data-card-reversi-feature-style="profile"]')).toHaveLength(1);

    const diagnostics = require('../ui/assets/lazy-feature-surface.ts')
      .getLazyFeatureSurfaceDiagnostics('profile', document);
    expect(diagnostics).toMatchObject({
      status: 'ready',
      attemptCount: 1,
      domCreatedCount: 1,
      readyCount: 1,
      failureCount: 0
    });
  });

  test('opens, projects saved fields, saves edits, and updates identity controls', async () => {
    storage.set('card_reversi_player_profile_v1', JSON.stringify({
      displayName: '保存名',
      avatarStoneType: 'SNIPER',
      bio: '保存済み紹介'
    }));
    const panel = require('../ui/player-profile-panel.ts');
    (window as any).LeaderboardClient = {
      setPlayerName: jest.fn(),
      updatePublicProfile: jest.fn(async () => ({ ok: true }))
    };
    panel.setupPlayerProfilePanel({ root: window });

    await openProfile();
    expect((document.getElementById('profileNameInput') as HTMLInputElement).value).toBe('保存名');
    expect((document.getElementById('profileBioInput') as HTMLTextAreaElement).value).toBe('保存済み紹介');
    expect(document.querySelector('[data-avatar-stone-type="SNIPER"]')?.getAttribute('aria-checked')).toBe('true');
    expect(document.getElementById('profilePlayerIdText')!.textContent).toBe('p_ABCDEFGHIJKLMNOPQRSTUV0001');

    (document.getElementById('networkPlayerNameInput') as HTMLInputElement).value = '古い名前';
    (document.getElementById('profileNameInput') as HTMLInputElement).value = 'さかな';
    (document.getElementById('profileBioInput') as HTMLTextAreaElement).value = 'よろしく';
    (document.querySelector('[data-avatar-stone-type="SNIPER"]') as HTMLButtonElement).click();
    document.getElementById('profileSaveBtn')!.click();

    const storedProfile = JSON.parse(storage.get('card_reversi_player_profile_v1') || '{}');
    expect(storedProfile).toMatchObject({ displayName: 'さかな', avatarStoneType: 'SNIPER', bio: 'よろしく' });
    expect((document.getElementById('leaderboardNameInput') as HTMLInputElement).value).toBe('さかな');
    expect((document.getElementById('networkPlayerNameInput') as HTMLInputElement).value).toBe('さかな');
    expect((window as any).LeaderboardClient.setPlayerName).toHaveBeenCalledWith('さかな');
    expect((window as any).LeaderboardClient.updatePublicProfile).toHaveBeenCalled();

    document.getElementById('profileEnsureIdentityBtn')!.click();
    await flushAsyncWork();
    expect(document.getElementById('profilePlayerIdText')!.textContent).toBe('p_ABCDEFGHIJKLMNOPQRSTUV0001');
  });

  test('reveals, copies, regenerates, and imports recovery codes only after first open', async () => {
    const panel = require('../ui/player-profile-panel.ts');
    panel.setupPlayerProfilePanel({ root: window });
    await openProfile();

    expect((document.getElementById('profileRecoveryCodeOutput') as HTMLInputElement).value).toBe('');
    document.getElementById('profileRevealRecoveryBtn')!.click();
    await flushAsyncWork();
    expect((document.getElementById('profileRecoveryCodeOutput') as HTMLInputElement).value).toBe('CR-ABCDE-FGHJK-MNPQR-STUVW-XYZ23');

    document.getElementById('profileCopyRecoveryBtn')!.click();
    await flushAsyncWork();
    expect(window.navigator.clipboard.writeText).toHaveBeenCalledWith('CR-ABCDE-FGHJK-MNPQR-STUVW-XYZ23');

    document.getElementById('profileRegenerateRecoveryBtn')!.click();
    await flushAsyncWork();
    expect((document.getElementById('profileRecoveryCodeOutput') as HTMLInputElement).value).toBe('CR-ZYXWV-UTSRQ-PNMKJ-HGFED-CBA32');

    (document.getElementById('profileRecoveryCodeInput') as HTMLInputElement).value = 'CR-ABCDE-FGHJK-MNPQR-STUVW-XYZ23';
    document.getElementById('profileRecoverIdentityBtn')!.click();
    await flushAsyncWork();
    expect((document.getElementById('profileRecoveryCodeOutput') as HTMLInputElement).value).toBe('CR-HHHHH-JJJJJ-KKKKK-MMMMM-NNNNN');
  });

  test('closes with Escape or backdrop, returns focus, and traps Tab inside the dialog', async () => {
    const panel = require('../ui/player-profile-panel.ts');
    panel.setupPlayerProfilePanel({ root: window });
    await openProfile();

    const closeBtn = document.getElementById('profileCloseBtn') as HTMLButtonElement;
    const lastControl = document.getElementById('profileBioInput') as HTMLTextAreaElement;
    lastControl.focus();
    document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement).toBe(closeBtn);
    closeBtn.focus();
    document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
    expect(document.activeElement).toBe(lastControl);

    document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.getElementById('profileOverlay')!.classList.contains('is-open')).toBe(false);
    expect(document.activeElement).toBe(document.getElementById('profileOpenBtn'));

    await openProfile();
    document.getElementById('profileOverlay')!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    expect(document.getElementById('profileOverlay')!.classList.contains('is-open')).toBe(false);
    expect(document.activeElement).toBe(document.getElementById('profileOpenBtn'));
  });

  test('shows a closable failure and retries with a fresh stylesheet and DOM', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const panel = require('../ui/player-profile-panel.ts');
    panel.setupPlayerProfilePanel({ root: window });

    document.getElementById('profileOpenBtn')!.click();
    const failedLink = document.querySelector(
      'link[data-card-reversi-feature-style="profile"]'
    ) as HTMLLinkElement;
    failedLink.dispatchEvent(new dom.window.Event('error'));
    await flushAsyncWork();

    expect(failedLink.isConnected).toBe(false);
    expect(document.getElementById('profileOverlay')!.classList.contains('profile-surface-failure')).toBe(true);
    expect(document.getElementById('profileModalTitle')!.textContent).toBe('プロフィールを読み込めませんでした');
    expect(document.getElementById('profileModal')!.getAttribute('aria-labelledby')).toBe('profileModalTitle');
    expect(document.getElementById('profileModal')!.textContent).toContain('もう一度押すと再試行');
    expect(document.getElementById('profileNameInput')).toBeNull();
    (document.querySelector('#profileModal button') as HTMLButtonElement).click();
    expect(document.activeElement).toBe(document.getElementById('profileOpenBtn'));

    document.getElementById('profileOpenBtn')!.click();
    const retryLink = document.querySelector(
      'link[data-card-reversi-feature-style="profile"]'
    ) as HTMLLinkElement;
    expect(retryLink).not.toBe(failedLink);
    retryLink.dispatchEvent(new dom.window.Event('load'));
    await flushAsyncWork();

    expect(document.getElementById('profileOverlay')!.classList.contains('is-open')).toBe(true);
    expect(document.getElementById('profileNameInput')).toBeTruthy();
    expect(require('../ui/assets/lazy-feature-surface.ts')
      .getLazyFeatureSurfaceDiagnostics('profile', document)).toMatchObject({
      status: 'ready',
      attemptCount: 2,
      retryCount: 1,
      readyCount: 1,
      failureCount: 1
    });
    warn.mockRestore();
  });
});
