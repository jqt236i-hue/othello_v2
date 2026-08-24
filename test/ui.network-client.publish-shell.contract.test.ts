import { JSDOM } from 'jsdom';

describe('NetworkMatchClient publish shell contract', () => {
  let dom: JSDOM | null = null;

  beforeEach(() => {
    jest.resetModules();

    dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
    global.window = dom.window as any;
    global.document = dom.window.document as any;
    global.location = dom.window.location as any;
    global.localStorage = dom.window.localStorage as any;

    global.gameState = { currentPlayer: 1, turnNumber: 1 } as any;
    global.cardState = {
      turnIndex: 1,
      pendingEffectByPlayer: { black: null, white: null }
    } as any;
    global.addLog = jest.fn();
    global.emitCardStateChange = jest.fn();
    global.emitGameStateChange = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.renderCardUI = jest.fn();
    global.EventSource = class MockEventSource {
      addEventListener() {}
      close() {}
    } as any;
  });

  afterEach(() => {
    try {
      if (dom && dom.window && typeof dom.window.close === 'function') {
        dom.window.close();
      }
    } catch (e) {
      // ignore
    }

    delete global.window;
    delete global.document;
    delete global.location;
    delete global.localStorage;
    delete global.gameState;
    delete global.cardState;
    delete global.addLog;
    delete global.emitCardStateChange;
    delete global.emitGameStateChange;
    delete global.emitBoardUpdate;
    delete global.renderCardUI;
    delete global.BoardOps;
    delete global.EventSource;
    jest.unmock('../ui/network/publish-flow');
  });

  test('missing publish-flow controller is collapsed to PUBLISH_ERROR', async () => {
    jest.doMock('../ui/network/publish-flow', () => ({}));
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    const statusWriter = jest.fn();
    client.setStatusWriter(statusWriter);

    const result = await client.publishSnapshot({
      playerKey: 'black',
      actionType: 'place',
      playbackEvents: [],
      action: {
        type: 'place',
        playerKey: 'black',
        row: 2,
        col: 3,
        turnIndex: 1
      }
    });

    expect(result).toEqual({ ok: false, reason: 'PUBLISH_ERROR' });
    expect(statusWriter).toHaveBeenCalledWith('ネット対戦: 通信失敗 (PUBLISH_FLOW_UNAVAILABLE)', true);
  });

  test('integrity latch rejects at the final publish boundary before the controller', async () => {
    const publishSnapshot = jest.fn(() => Promise.resolve({ ok: true }));
    jest.doMock('../ui/network/publish-flow', () => ({
      createNetworkPublishFlowController: () => ({ publishSnapshot })
    }));
    const integrity = require('../ui/card-runtime-integrity');
    const { createCardRuntimeUnavailableError } = require('../game/logic/card-runtime-errors');
    integrity.latchCardRuntimeIntegrityFailure(
      createCardRuntimeUnavailableError('targeting.targetResolver', 'targeting'),
      { source: 'network-client-publish-shell-test' }
    );

    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    const statusWriter = jest.fn();
    client.setStatusWriter(statusWriter);

    await expect(client.publishSnapshot({
      playerKey: 'black',
      actionType: 'pass',
      action: { type: 'pass', playerKey: 'black' }
    })).resolves.toEqual({ ok: false, reason: 'RUNTIME_UNAVAILABLE' });
    expect(publishSnapshot).not.toHaveBeenCalled();
    expect(statusWriter).toHaveBeenCalledWith(
      'ゲーム実行環境を確認できませんでした。ページを再読み込みしてください。',
      true
    );
  });
});
