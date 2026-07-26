import { JSDOM } from 'jsdom';

const PUBLIC_NETWORK_MATCH_CLIENT_METHODS = [
  'acceptRematchRequest',
  'adoptMatchedRoom',
  'applySnapshot',
  'cancelRatedQueue',
  'createRoom',
  'declineRematchRequest',
  'dumpDiagnostics',
  'enterRatedQueue',
  'getChatMaxLength',
  'getMyRating',
  'getMyRatingHistory',
  'getNetworkAutoEnabled',
  'getNetworkTelemetry',
  'getRatedLeaderboard',
  'getRatedMatch',
  'getRoomBoardConfig',
  'getRoomDeck',
  'getRoomId',
  'getRoomSeats',
  'getSeatHandSkins',
  'getSeatKey',
  'getSeatNames',
  'getServerUrl',
  'getState',
  'getStateVersion',
  'hasPendingRematchRequest',
  'hasRestorableStoredSession',
  'hasTwoPlayers',
  'isActive',
  'isSpectator',
  'joinRoom',
  'leaveRoom',
  'listRooms',
  'pollRatedQueue',
  'publishCommand',
  'publishSnapshot',
  'requestRematch',
  'restoreStoredSession',
  'retryPresentationTimeline',
  'sendChatMessage',
  'setChatListener',
  'setRematchRequestListener',
  'setRoomStateListener',
  'setServerUrl',
  'setStatusWriter',
  'setTurnTimerListener',
  'spectateRoom',
  'syncLatestState',
  'updateDeckSelection',
  'updateHandSkin'
].sort();

describe('NetworkMatchClient public API inventory', () => {
  afterEach(() => {
    try { delete (global as any).window; } catch (e) { /* ignore */ }
    try { delete (global as any).document; } catch (e) { /* ignore */ }
    try { delete (global as any).location; } catch (e) { /* ignore */ }
    try { delete (global as any).localStorage; } catch (e) { /* ignore */ }
  });

  test('exports the compatibility facade without additions or removals', () => {
    jest.resetModules();
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    (global as any).location = dom.window.location;
    (global as any).localStorage = dom.window.localStorage;

    require('../ui/network-client.js');

    expect(Object.keys((dom.window as any).NetworkMatchClient).sort()).toEqual(PUBLIC_NETWORK_MATCH_CLIENT_METHODS);
  });

  test('reports only normalized stored-session presence without exposing its payload', () => {
    jest.resetModules();
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    (global as any).location = dom.window.location;
    (global as any).localStorage = dom.window.localStorage;

    require('../ui/network-client.js');
    const client = (dom.window as any).NetworkMatchClient;
    expect(client.hasRestorableStoredSession()).toBe(false);

    dom.window.localStorage.setItem('network_match_last_session', '{broken');
    expect(client.hasRestorableStoredSession()).toBe(false);

    dom.window.localStorage.setItem('network_match_last_session', JSON.stringify({
      roomId: 'ABC',
      viewerRole: 'seat',
      seatKey: 'black',
      seatToken: 'private-seat-token',
      playerName: 'プレイヤー'
    }));
    const presence = client.hasRestorableStoredSession();
    expect(presence).toBe(true);
    expect(typeof presence).toBe('boolean');
    expect(Object.keys(client)).not.toContain('readStoredSession');
    dom.window.close();
  });

  test('treats unavailable storage as no restorable session', () => {
    jest.resetModules();
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    (global as any).location = dom.window.location;
    (global as any).localStorage = dom.window.localStorage;
    require('../ui/network-client.js');
    const client = (dom.window as any).NetworkMatchClient;

    Object.defineProperty(dom.window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('storage unavailable');
      }
    });
    Object.defineProperty(global, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('storage unavailable');
      }
    });

    expect(client.hasRestorableStoredSession()).toBe(false);
    dom.window.close();
  });
});
