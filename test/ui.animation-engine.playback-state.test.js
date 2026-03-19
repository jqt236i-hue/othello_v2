const { JSDOM } = require('jsdom');

describe('animation-engine playback-state integration', () => {
  beforeEach(() => {
    jest.resetModules();
    global.window = {
      __telemetry__: { watchdogFired: 0, singleVisualWriterHits: 0, abortCount: 0 }
    };
    global.document = {
      getElementById: () => ({
        classList: { add() {}, remove() {} },
        querySelector: () => null,
        getBoundingClientRect: () => ({})
      })
    };
    global.emitBoardUpdate = jest.fn();
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
    delete global.emitBoardUpdate;
  });

  test('watchdog clears playback through PlaybackStateManager', async () => {
    const playbackStateMock = {
      setInteractionLock: jest.fn(),
      setPlaybackActive: jest.fn(),
      setSuppressNextDiffFlip: jest.fn()
    };

    jest.doMock('../ui/playback-state-manager', () => playbackStateMock);

    const engine = require('../ui/animation-engine');
    await engine.handleWatchdog();

    expect(playbackStateMock.setInteractionLock).toHaveBeenCalledWith(false);
    expect(playbackStateMock.setPlaybackActive).toHaveBeenCalledWith(false);
  });

  test('cell teleport playback arms board update context to suppress expansion reveal sound', async () => {
    const dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.window.__telemetry__ = { watchdogFired: 0, singleVisualWriterHits: 0, abortCount: 0 };
    global.window.DISABLE_ANIMATIONS = true;
    global.emitBoardUpdate = jest.fn();

    const playbackStateMock = {
      setInteractionLock: jest.fn(),
      armBoardUpdateContext: jest.fn()
    };
    jest.doMock('../ui/playback-state-manager', () => playbackStateMock);

    const board = document.getElementById('board');
    const fromCell = document.createElement('div');
    fromCell.className = 'cell has-disc';
    fromCell.dataset.row = '0';
    fromCell.dataset.col = '0';
    const toCell = document.createElement('div');
    toCell.className = 'cell';
    toCell.dataset.row = '0';
    toCell.dataset.col = '1';
    const disc = document.createElement('div');
    disc.className = 'disc black';
    fromCell.appendChild(disc);
    board.appendChild(fromCell);
    board.appendChild(toCell);

    const engine = require('../ui/animation-engine');
    await engine.play([
      {
        type: 'move',
        phase: 1,
        targets: [{
          from: { row: 0, col: 0 },
          to: { row: 0, col: 1 },
          cause: 'CELL_TELEPORT_WILL',
          reason: 'teleport_move',
          ownerAfter: 'black',
          after: { color: 1, special: null, timer: null }
        }]
      }
    ]);

    expect(playbackStateMock.armBoardUpdateContext).toHaveBeenCalledWith(expect.objectContaining({
      suppressBoardExpansionRevealSound: true,
      source: 'animation-engine',
      reason: 'post_playback_sync'
    }));

    dom.window.close();
  });
});
