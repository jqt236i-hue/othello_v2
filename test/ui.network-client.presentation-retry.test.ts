import { JSDOM } from 'jsdom';

jest.setTimeout(30000);

function snapshot(version: number) {
  return {
    stateVersion: version,
    _meta: {
      authority: 'server',
      version,
      projectedForSeat: 'black',
      turnStartReconciled: true
    },
    gameState: { currentPlayer: 1, board: [[0]] },
    cardState: {
      hands: { black: [], white: [] },
      presentationEvents: [],
      _presentationEventsPersist: []
    }
  };
}

describe('NetworkMatchClient presentation settlement retry exhaustion', () => {
  let dom: JSDOM;

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    dom = new JSDOM('<!doctype html><html><body><main id="game-container"><div id="board"></div></main></body></html>', {
      url: 'http://localhost/'
    });
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    (global as any).location = dom.window.location;
    (global as any).gameState = snapshot(0).gameState;
    (global as any).cardState = snapshot(0).cardState;
    (dom.window as any).gameState = (global as any).gameState;
    (dom.window as any).cardState = (global as any).cardState;
    (global as any).emitBoardUpdate = jest.fn();
    jest.doMock('../ui/board-renderer', () => ({
      getBoardVisualControllerReady: jest.fn(async () => undefined)
    }));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.dontMock('../ui/board-renderer');
    dom.window.close();
    delete (global as any).window;
    delete (global as any).document;
    delete (global as any).location;
    delete (global as any).gameState;
    delete (global as any).cardState;
    delete (global as any).emitBoardUpdate;
  });

  test('keeps the settlement locked and exposes retry/reload actions after bounded retries', async () => {
    const applyCommittedFrame = jest.fn(async () => { throw new Error('context restore failed'); });
    const settlementHandle = Object.freeze({
      kind: 'strict-network-settlement',
      visualSeq: 1,
      applyCommittedFrame,
      settle: jest.fn(async () => true),
      cancel: jest.fn(async () => true)
    });
    const PresentationHandler = {
      handlePresentationEvent: jest.fn(async () => settlementHandle),
      onBoardUpdated: jest.fn(async () => undefined)
    };
    (global as any).PresentationHandler = PresentationHandler;
    (dom.window as any).PresentationHandler = PresentationHandler;

    const client = require('../ui/network-client.js');
    const statusWriter = jest.fn();
    client.setStatusWriter(statusWriter);
    const next = snapshot(1);
    expect(client.applySnapshot(next, {
      force: true,
      presentationFrames: [{
        roomId: 'ABC',
        visualSeq: 1,
        stateVersionFrom: 0,
        stateVersionTo: 1,
        operationId: 'op_1',
        actorSeatKey: 'black',
        actionType: 'place',
        playbackEvents: [{ type: 'flip', phase: 1 }],
        snapshotAfter: next,
        createdAt: 1
      }]
    })).toBe(true);

    for (let index = 0; index < 8; index += 1) {
      await Promise.resolve();
      await jest.runOnlyPendingTimersAsync();
    }

    expect(applyCommittedFrame).toHaveBeenCalledTimes(6);
    expect(settlementHandle.settle).not.toHaveBeenCalled();
    expect(settlementHandle.cancel).not.toHaveBeenCalled();
    expect((dom.window as any).NetworkPresentationTimeline.getDiagnostics()).toMatchObject({
      paused: true,
      blocksInput: true,
      activeSettlementStage: 'apply-committed-frame'
    });
    expect(statusWriter).toHaveBeenCalledWith(expect.stringContaining('再読み込み'), true);
    expect(dom.window.document.getElementById('network-presentation-reload-required')).not.toBeNull();
    expect(client.getStateVersion()).toBe(1);
  });
});
