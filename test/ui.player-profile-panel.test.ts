import { JSDOM } from 'jsdom';

describe('player profile panel controller', () => {
  let storage: Map<string, string>;
  let identityStore: any;
  let dom: JSDOM;

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
    dom = new JSDOM(`<!doctype html><html><body>
      <button id="profileOpenBtn" type="button" aria-expanded="false"></button>
      <input id="leaderboardNameInput">
      <input id="networkPlayerNameInput">
      <div id="profileOverlay" aria-hidden="true">
        <div id="profileModal">
          <button id="profileCloseBtn" type="button"></button>
          <button id="profileTabProfile" type="button"></button>
          <button id="profileTabIdentity" type="button"></button>
          <section id="profileEditSection">
            <div id="profileAvatarPreview"></div>
            <input id="profileNameInput">
            <div id="profileAvatarOptions"></div>
            <textarea id="profileBioInput"></textarea>
            <button id="profileSaveBtn" type="button"></button>
          </section>
          <section id="profileIdentitySection" hidden>
            <code id="profilePlayerIdText"></code>
            <button id="profileEnsureIdentityBtn" type="button"></button>
            <input id="profileRecoveryCodeOutput">
            <button id="profileRevealRecoveryBtn" type="button"></button>
            <button id="profileCopyRecoveryBtn" type="button"></button>
            <button id="profileRegenerateRecoveryBtn" type="button"></button>
            <input id="profileRecoveryCodeInput">
            <button id="profileRecoverIdentityBtn" type="button"></button>
            <div id="profileIdentityStatus"></div>
          </section>
        </div>
      </div>
    </body></html>`);
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
    delete (global as any).localStorage;
    dom.window.close();
    delete (global as any).window;
    delete (global as any).document;
    delete (global as any).HTMLElement;
    delete (global as any).HTMLInputElement;
    delete (global as any).HTMLTextAreaElement;
  });

  test('opens, saves profile fields, and updates identity controls', async () => {
    const panel = require('../ui/player-profile-panel.js');
    (window as any).LeaderboardClient = {
      setPlayerName: jest.fn(),
      updatePublicProfile: jest.fn(async () => ({ ok: true }))
    };
    panel.setupPlayerProfilePanel({ root: window });

    document.getElementById('profileOpenBtn')!.click();
    expect(document.getElementById('profileOverlay')!.classList.contains('is-open')).toBe(true);

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
    await Promise.resolve();
    expect(document.getElementById('profilePlayerIdText')!.textContent).toBe('p_ABCDEFGHIJKLMNOPQRSTUV0001');
  });

  test('reveals, copies, regenerates, and imports recovery codes', async () => {
    const panel = require('../ui/player-profile-panel.js');
    panel.setupPlayerProfilePanel({ root: window });

    document.getElementById('profileRevealRecoveryBtn')!.click();
    await Promise.resolve();
    expect((document.getElementById('profileRecoveryCodeOutput') as HTMLInputElement).value).toBe('CR-ABCDE-FGHJK-MNPQR-STUVW-XYZ23');

    document.getElementById('profileCopyRecoveryBtn')!.click();
    await Promise.resolve();
    expect(window.navigator.clipboard.writeText).toHaveBeenCalledWith('CR-ABCDE-FGHJK-MNPQR-STUVW-XYZ23');

    document.getElementById('profileRegenerateRecoveryBtn')!.click();
    await Promise.resolve();
    expect((document.getElementById('profileRecoveryCodeOutput') as HTMLInputElement).value).toBe('CR-ZYXWV-UTSRQ-PNMKJ-HGFED-CBA32');

    (document.getElementById('profileRecoveryCodeInput') as HTMLInputElement).value = 'CR-ABCDE-FGHJK-MNPQR-STUVW-XYZ23';
    document.getElementById('profileRecoverIdentityBtn')!.click();
    await Promise.resolve();
    expect((document.getElementById('profileRecoveryCodeOutput') as HTMLInputElement).value).toBe('CR-HHHHH-JJJJJ-KKKKK-MMMMM-NNNNN');
  });
});
