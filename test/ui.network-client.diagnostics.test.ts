import { JSDOM } from 'jsdom';

function loadClient() {
  jest.resetModules();
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.location = dom.window.location;
  global.localStorage = dom.window.localStorage;
  global.gameState = {
    currentPlayer: 1,
    turnNumber: 7,
    consecutivePasses: 0,
    board: [
      [0, 0],
      [0, 0]
    ]
  };
  global.cardState = {
    hands: {
      black: ['swap_01', 'trap_01'],
      white: ['guard_01']
    },
    charge: { black: 12, white: 8 },
    selectedCardId: 'swap_01',
    selectedCardOwnerKey: 'black',
    pendingEffectByPlayer: { black: null, white: null }
  };
  window.MATCH_MODE = 'network';

  require('../ui/network-client.js');
  return { dom, client: window.NetworkMatchClient };
}

describe('NetworkMatchClient diagnostics dump', () => {
  afterEach(() => {
    try { delete global.window; } catch (e) { /* ignore */ }
    try { delete global.document; } catch (e) { /* ignore */ }
    try { delete global.location; } catch (e) { /* ignore */ }
    try { delete global.localStorage; } catch (e) { /* ignore */ }
    try { delete global.gameState; } catch (e) { /* ignore */ }
    try { delete global.cardState; } catch (e) { /* ignore */ }
  });

  test('dumpDiagnostics writes a pasteable sanitized snapshot to the console', () => {
    const { client } = loadClient();
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const consoleGroupSpy = jest.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
    const consoleGroupEndSpy = jest.spyOn(console, 'groupEnd').mockImplementation(() => {});

    try {
      const snapshot = client.dumpDiagnostics('manual');

      expect(snapshot).toMatchObject({
        reason: 'manual',
        matchMode: 'network',
        active: false,
        roomId: '',
        seatKey: 'black',
        stateVersion: null,
        appliedStateVersion: null,
        gameState: {
          currentPlayer: 1,
          turnNumber: 7,
          consecutivePasses: 0,
          boardRows: 2,
          boardCols: 2,
          resultShown: false
        },
        cardState: {
          handCounts: { black: 2, white: 1 },
          charge: { black: 12, white: 8 },
          selectedCardId: 'swap_01',
          selectedCardOwnerKey: 'black',
          pendingEffectByPlayer: { black: null, white: null },
          hasUsedCardThisTurnByPlayer: null
        },
        networkTelemetry: {
          counts: {},
          recentEvents: []
        }
      });
      expect(JSON.stringify(snapshot)).not.toContain('token');
      expect(consoleGroupSpy).toHaveBeenCalledWith(expect.stringContaining('[network-diagnostics] manual'));
      expect(consoleLogSpy).toHaveBeenCalledWith(snapshot);
      expect(consoleGroupEndSpy).toHaveBeenCalled();
    } finally {
      consoleLogSpy.mockRestore();
      consoleGroupSpy.mockRestore();
      consoleGroupEndSpy.mockRestore();
    }
  });

  test('F12 in network mode dumps diagnostics without blocking the browser shortcut', () => {
    const { dom, client } = loadClient();
    const dumpSpy = jest.spyOn(client, 'dumpDiagnostics').mockImplementation(() => ({}));
    const event = new dom.window.KeyboardEvent('keydown', {
      key: 'F12',
      code: 'F12',
      bubbles: true,
      cancelable: true
    });

    dom.window.document.dispatchEvent(event);

    expect(dumpSpy).toHaveBeenCalledWith('F12');
    expect(event.defaultPrevented).toBe(false);
  });
});
