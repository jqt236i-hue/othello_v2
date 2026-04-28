describe('hyperactive playback detection', () => {
  test('uses bootstrap registered PlaybackEngine when available and does not force emitBoardUpdate', async () => {
    jest.isolateModules(() => {
      jest.resetModules();
      import * as gameVisuals from '../game/move-executor-visuals.js';
      gameVisuals.setUIImpl({
        hasPlaybackEngine: () => true
      });
      // stub emitBoardUpdate
      global.emitBoardUpdate = jest.fn();
      global.emitGameStateChange = jest.fn();
      global.emitCardStateChange = jest.fn();

      import * as hyper from '../game/special-effects/hyperactive.js';
      // call processHyperactiveMovesAtTurnStart with minimal params
      return hyper.processHyperactiveMovesAtTurnStart(1, { moved: [], destroyed: [], flipped: [] }).then(() => {
        expect(global.emitBoardUpdate).not.toHaveBeenCalled();
        gameVisuals.clearUIImpl();
        delete global.emitGameStateChange;
        delete global.emitCardStateChange;
      });
    });
  });

  test('delegates chained hyperactive fallback animation to injected move visuals without DOM queries in game/', async () => {
    await jest.isolateModulesAsync(async () => {
      jest.resetModules();
      import * as gameVisuals from '../game/move-executor-visuals.js';
      const animateHyperactiveMoveChain = jest.fn(async () => {});
      gameVisuals.setUIImpl({
        hasPlaybackEngine: () => false,
        animateHyperactiveMoveChain
      });

      global.emitBoardUpdate = jest.fn();
      global.emitGameStateChange = jest.fn();
      global.emitCardStateChange = jest.fn();
      import * as hyper from '../game/special-effects/hyperactive.js';
      const moved = [
        { from: { row: 3, col: 3 }, to: { row: 3, col: 4 } },
        { from: { row: 3, col: 4 }, to: { row: 3, col: 5 } }
      ];

      await hyper.processHyperactiveMovesAtTurnStart(1, { moved, destroyed: [], flipped: [] });

      expect(animateHyperactiveMoveChain).toHaveBeenCalledWith(moved);
      expect(global.emitBoardUpdate).toHaveBeenCalled();
      gameVisuals.clearUIImpl();
      delete global.emitBoardUpdate;
      delete global.emitGameStateChange;
      delete global.emitCardStateChange;
    });
  });
});
