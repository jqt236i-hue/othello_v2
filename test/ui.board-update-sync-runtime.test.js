const { JSDOM } = require('jsdom');

describe('BoardUpdateSyncRuntime', () => {
  let dom;

  beforeEach(() => {
    jest.resetModules();
    dom = new JSDOM('<!doctype html><html><body></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
  });

  afterEach(() => {
    if (dom && dom.window && typeof dom.window.close === 'function') {
      dom.window.close();
    }
    delete global.window;
    delete global.document;
  });

  test('allowBoardUpdateDuringPlayback context is one-shot', () => {
    const runtime = require('../ui/board-update-sync-runtime');

    expect(runtime.peekBoardUpdateSyncContext()).toBeNull();

    runtime.armBoardUpdateSyncContext({
      allowBoardUpdateDuringPlayback: true,
      source: 'unit-test',
      reason: 'network_snapshot_sync'
    });

    expect(runtime.peekBoardUpdateSyncContext()).toMatchObject({
      allowBoardUpdateDuringPlayback: true,
      source: 'unit-test',
      reason: 'network_snapshot_sync'
    });
    expect(runtime.consumeBoardUpdateSyncContext()).toMatchObject({
      allowBoardUpdateDuringPlayback: true,
      source: 'unit-test',
      reason: 'network_snapshot_sync'
    });
    expect(runtime.peekBoardUpdateSyncContext()).toBeNull();
  });
});
