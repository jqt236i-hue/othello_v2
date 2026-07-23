import { JSDOM } from 'jsdom';

function createShellHtml(): string {
  return `<!doctype html><html><head>
    <meta data-card-reversi-feature-style-slot="network-layout-controls"
      data-card-reversi-feature-style-href="styles-feature-network-layout-controls.css">
    <meta data-card-reversi-feature-style-slot="network"
      data-card-reversi-feature-style-href="styles-feature-network.css">
    <meta data-card-reversi-feature-style-slot="network-responsive"
      data-card-reversi-feature-style-href="styles-feature-network-responsive.css">
  </head><body>
    <button id="modeCpuBtn" type="button">CPU</button>
    <button id="modeReversiBtn" type="button">リバーシ</button>
    <button id="modeNetworkBtn" type="button" aria-controls="networkOverlay" aria-expanded="false">ネット対戦</button>
    <button id="autoToggleBtn" type="button">AUTO: OFF</button>
    <div id="control-panel"></div>
    <div id="networkTimerStatus"></div>
    <div id="networkChatPanel" aria-hidden="true"></div>
    <div id="networkOverlay" aria-hidden="true">
      <div id="networkModal" role="dialog" aria-modal="true" aria-label="ネット対戦設定"></div>
    </div>
  </body></html>`;
}

function featureLinks(): HTMLLinkElement[] {
  return Array.from(document.querySelectorAll<HTMLLinkElement>(
    'link[data-card-reversi-feature-style]'
  ));
}

function settleFeatureLinks(type: 'load' | 'error' = 'load', failedGroup = ''): void {
  featureLinks().forEach((link) => {
    const group = link.getAttribute('data-card-reversi-feature-style') || '';
    link.dispatchEvent(new window.Event(group === failedGroup ? 'error' : type));
  });
}

async function flush(attempts = 5): Promise<void> {
  for (let index = 0; index < attempts; index += 1) {
    await Promise.resolve();
  }
}

async function waitForCondition(predicate: () => boolean, attempts = 20): Promise<void> {
  for (let index = 0; index < attempts; index += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error('condition was not met');
}

function createClient(overrides: Record<string, unknown> = {}): any {
  return {
    hasRestorableStoredSession: jest.fn(() => false),
    restoreStoredSession: jest.fn(async () => ({ ok: false, reason: 'NO_STORED_SESSION' })),
    setStatusWriter: jest.fn(),
    setRoomStateListener: jest.fn(),
    setTurnTimerListener: jest.fn(),
    setChatListener: jest.fn(),
    setRematchRequestListener: jest.fn(),
    getServerUrl: jest.fn(() => ''),
    setServerUrl: jest.fn(),
    listRooms: jest.fn(async () => ({ ok: true, rooms: [] })),
    hasTwoPlayers: jest.fn(() => false),
    isSpectator: jest.fn(() => false),
    isActive: jest.fn(() => false),
    getSeatNames: jest.fn(() => ({ black: '', white: '' })),
    getSeatKey: jest.fn(() => 'black'),
    getRoomDeck: jest.fn(() => null),
    getRoomBoardConfig: jest.fn(() => null),
    getNetworkAutoEnabled: jest.fn(() => false),
    ...overrides
  };
}

describe('match-mode lazy network surface', () => {
  let dom: JSDOM;
  let matchMode: any;

  beforeEach(() => {
    jest.resetModules();
    dom = new JSDOM(createShellHtml(), { url: 'http://localhost/?debug=1&uxMonitor=1' });
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    (global as any).location = dom.window.location;
    (global as any).localStorage = dom.window.localStorage;
    (global as any).addLog = jest.fn();
    (window as any).NetworkMatchClient = createClient();
    matchMode = require('../ui/handlers/match-mode.ts');
    matchMode.setupMatchModeControls({
      modeCpuBtn: document.getElementById('modeCpuBtn'),
      modeReversiBtn: document.getElementById('modeReversiBtn'),
      modeNetworkBtn: document.getElementById('modeNetworkBtn'),
      controlPanel: document.getElementById('control-panel'),
      networkOverlay: document.getElementById('networkOverlay'),
      networkTimerStatus: document.getElementById('networkTimerStatus'),
      networkChatPanel: document.getElementById('networkChatPanel'),
      autoToggleBtn: document.getElementById('autoToggleBtn'),
      deferStoredSessionRestore: true
    });
  });

  afterEach(() => {
    dom.window.close();
    delete (global as any).window;
    delete (global as any).document;
    delete (global as any).location;
    delete (global as any).localStorage;
    delete (global as any).addLog;
  });

  test('keeps network inner DOM and styles absent until first mode selection, then reuses them', async () => {
    const modal = document.getElementById('networkModal')!;
    const chatPanel = document.getElementById('networkChatPanel')!;
    expect(modal.childElementCount).toBe(0);
    expect(chatPanel.childElementCount).toBe(0);
    expect(featureLinks()).toHaveLength(0);

    document.getElementById('modeNetworkBtn')!.click();
    await flush(2);
    expect(featureLinks()).toHaveLength(3);
    expect((window as any).NetworkMatchClient.listRooms).not.toHaveBeenCalled();

    settleFeatureLinks();
    await waitForCondition(
      () => document.getElementById('networkOverlay')!.classList.contains('is-open')
    );
    expect(document.getElementById('networkOverlay')!.classList.contains('is-open')).toBe(true);
    expect(modal.childElementCount).toBe(2);
    expect(chatPanel.childElementCount).toBe(2);
    expect(document.getElementById('networkRoomListPanel')).not.toBeNull();

    const firstHeader = document.getElementById('networkModalHeader');
    document.getElementById('networkCloseBtn')!.click();
    document.getElementById('modeNetworkBtn')!.click();
    await flush();

    expect(document.getElementById('networkModalHeader')).toBe(firstHeader);
    expect(featureLinks()).toHaveLength(3);
    const diagnostics = require('../ui/assets/lazy-feature-surface')
      .getLazyFeatureSurfaceDiagnostics('network', document);
    expect(diagnostics).toMatchObject({
      status: 'ready',
      attemptCount: 1,
      readyCount: 1,
      failureCount: 0,
      listenerBindingCount: 1
    });
  });

  test('cleans a failed atomic attempt, blocks mode entry, and retries with fresh links', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      document.getElementById('modeNetworkBtn')!.click();
      await flush(2);
      settleFeatureLinks('load', 'network');
      await flush();

      expect(matchMode.getCurrentMode()).toBe('cpu');
      expect(featureLinks()).toHaveLength(0);
      expect(document.getElementById('networkPanel')).toBeNull();
      expect(document.querySelector('.network-surface-failure-title')?.textContent)
        .toContain('読み込めませんでした');
      expect((window as any).NetworkMatchClient.listRooms).not.toHaveBeenCalled();

      (document.querySelector('#networkModal .btn-small') as HTMLButtonElement).click();
      document.getElementById('modeNetworkBtn')!.click();
      await flush(2);
      expect(featureLinks()).toHaveLength(3);
      settleFeatureLinks();
      await waitForCondition(() => matchMode.getCurrentMode() === 'network');

      expect(matchMode.getCurrentMode()).toBe('network');
      expect(document.getElementById('networkPanel')).not.toBeNull();
      const diagnostics = require('../ui/assets/lazy-feature-surface')
        .getLazyFeatureSurfaceDiagnostics('network', document);
      expect(diagnostics).toMatchObject({
        status: 'ready',
        attemptCount: 2,
        retryCount: 1,
        failureCount: 1,
        readyCount: 1
      });
    } finally {
      warnSpy.mockRestore();
    }
  });

  test('does not create the surface when no stored session exists', async () => {
    await matchMode.restoreStoredNetworkSessionOnBoot();

    expect((window as any).NetworkMatchClient.hasRestorableStoredSession).toHaveBeenCalledTimes(1);
    expect((window as any).NetworkMatchClient.restoreStoredSession).not.toHaveBeenCalled();
    expect(featureLinks()).toHaveLength(0);
    expect(document.getElementById('networkModal')!.childElementCount).toBe(0);
  });

  test('awaits surface readiness before restoring a stored session', async () => {
    const restoreStoredSession = jest.fn(async () => ({
      ok: true,
      restored: true,
      viewerRole: 'spectator'
    }));
    (window as any).NetworkMatchClient.hasRestorableStoredSession.mockReturnValue(true);
    (window as any).NetworkMatchClient.restoreStoredSession = restoreStoredSession;

    const restorePromise = matchMode.restoreStoredNetworkSessionOnBoot();
    await flush(2);
    expect(featureLinks()).toHaveLength(3);
    expect(restoreStoredSession).not.toHaveBeenCalled();

    settleFeatureLinks();
    await restorePromise;

    expect(restoreStoredSession).toHaveBeenCalledTimes(1);
    expect(matchMode.getCurrentMode()).toBe('network');
    expect(document.getElementById('networkStatusText')!.textContent).toContain('復帰');
    expect(document.getElementById('networkOverlay')!.getAttribute('aria-hidden')).toBe('true');
  });

  test('treats a session removed after presence detection as a normal no-op', async () => {
    (window as any).NetworkMatchClient.hasRestorableStoredSession.mockReturnValue(true);
    (window as any).NetworkMatchClient.restoreStoredSession.mockResolvedValue({
      ok: false,
      reason: 'NO_STORED_SESSION'
    });

    const restorePromise = matchMode.restoreStoredNetworkSessionOnBoot();
    await flush(2);
    settleFeatureLinks();
    await restorePromise;

    expect(matchMode.getCurrentMode()).toBe('cpu');
    expect(document.getElementById('networkStatusText')!.textContent).toBe('CPU対戦モード');
  });

  test('does not start stored-session restore when surface preparation fails', async () => {
    (window as any).NetworkMatchClient.hasRestorableStoredSession.mockReturnValue(true);
    const restorePromise = matchMode.restoreStoredNetworkSessionOnBoot();
    await flush(2);
    settleFeatureLinks('load', 'network-responsive');
    await restorePromise;

    expect((window as any).NetworkMatchClient.restoreStoredSession).not.toHaveBeenCalled();
    expect(document.querySelector('.network-surface-failure-title')).not.toBeNull();
  });

  test('projects an invalid stored-session result into the ready surface', async () => {
    (window as any).NetworkMatchClient.hasRestorableStoredSession.mockReturnValue(true);
    (window as any).NetworkMatchClient.restoreStoredSession.mockResolvedValue({
      ok: false,
      reason: 'SEAT_TOKEN_INVALID'
    });

    const restorePromise = matchMode.restoreStoredNetworkSessionOnBoot();
    await flush(2);
    settleFeatureLinks();
    await restorePromise;

    expect(matchMode.getCurrentMode()).toBe('cpu');
    expect(document.getElementById('networkStatusText')!.textContent).toContain('復帰に失敗');
    expect(document.getElementById('networkStatusText')!.style.color).toBe('rgb(255, 107, 107)');
  });
});
