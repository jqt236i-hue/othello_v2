const CardLogic = require('../game/logic/cards.js');
const BoardOps = require('../game/logic/board_ops.js');

describe('special stone placement visuals (spawn meta backfill)', () => {
  beforeEach(() => {
    global.BoardOps = BoardOps;
  });

  afterEach(() => {
    delete global.BoardOps;
  });

  test('addMarker backfills prior SPAWN meta so placed special shows immediately', () => {
    const prng = { shuffle: (arr) => arr };
    const cardState = CardLogic.createCardState(prng);
    const gameState = { board: Array(8).fill(null).map(() => Array(8).fill(0)) };

    cardState._currentActionMeta = { actionId: 'a1', turnIndex: 0, plyIndex: 0 };

    BoardOps.spawnAt(cardState, gameState, 0, 0, 'black', 'SYSTEM', 'standard_place');
    cardState.pendingEffectByPlayer.black = { type: 'HYPERACTIVE_WILL' };

    const effects = CardLogic.applyPlacementEffects(cardState, gameState, 'black', 0, 0, 0);
    expect(effects && effects.hyperactivePlaced).toBe(true);

    const spawn = (cardState._presentationEventsPersist || []).find(e => e && e.type === 'SPAWN' && e.row === 0 && e.col === 0);
    expect(spawn && spawn.meta && spawn.meta.special).toBe('HYPERACTIVE');

    const status = (cardState._presentationEventsPersist || []).find(e => e && e.type === 'STATUS_APPLIED' && e.row === 0 && e.col === 0);
    expect(status && status.meta && status.meta.special).toBe('HYPERACTIVE');
  });

  test('ultimate hyperactive marker also backfills SPAWN meta', () => {
    const prng = { shuffle: (arr) => arr };
    const cardState = CardLogic.createCardState(prng);
    const gameState = { board: Array(8).fill(null).map(() => Array(8).fill(0)) };

    cardState._currentActionMeta = { actionId: 'a2', turnIndex: 0, plyIndex: 0 };

    BoardOps.spawnAt(cardState, gameState, 1, 1, 'black', 'SYSTEM', 'standard_place');
    cardState.pendingEffectByPlayer.black = { type: 'ULTIMATE_HYPERACTIVE_GOD' };

    const effects = CardLogic.applyPlacementEffects(cardState, gameState, 'black', 1, 1, 0);
    expect(effects && effects.ultimateHyperactivePlaced).toBe(true);

    const spawn = (cardState._presentationEventsPersist || []).find(e => e && e.type === 'SPAWN' && e.row === 1 && e.col === 1);
    expect(spawn && spawn.meta && spawn.meta.special).toBe('ULTIMATE_HYPERACTIVE');

    const status = (cardState._presentationEventsPersist || []).find(e => e && e.type === 'STATUS_APPLIED' && e.row === 1 && e.col === 1);
    expect(status && status.meta && status.meta.special).toBe('ULTIMATE_HYPERACTIVE');
  });
});
