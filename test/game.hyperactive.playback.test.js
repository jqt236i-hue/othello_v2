const path = require('path');

describe('hyperactive playback detection', () => {
  test('uses bootstrap registered PlaybackEngine when available and calls emitBoardUpdate', async () => {
    jest.isolateModules(() => {
      jest.resetModules();
      // Mock bootstrap to return PlaybackEngine
      jest.doMock(path.resolve(__dirname, '..', 'ui', 'bootstrap.js'), () => ({
        getRegisteredUIGlobals: () => ({ PlaybackEngine: { playPresentationEvents: () => {} } })
      }), { virtual: false });

      // stub emitBoardUpdate
      global.emitBoardUpdate = jest.fn();

      const hyper = require(path.resolve(__dirname, '..', 'game', 'special-effects', 'hyperactive.js'));
      // call processHyperactiveMovesAtTurnStart with minimal params
      return hyper.processHyperactiveMovesAtTurnStart(1, { moved: [], destroyed: [], flipped: [] }).then(() => {
        expect(global.emitBoardUpdate).toHaveBeenCalled();
      });
    });
  });
});