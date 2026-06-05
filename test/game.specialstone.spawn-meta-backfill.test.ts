import * as CardLogic from '../game/logic/cards.js';
import * as BoardOps from '../game/logic/board_ops.js';

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

  test('manifest stone marker backfills prior SPAWN meta through the same placement visual path', () => {
    const prng = { shuffle: (arr) => arr };
    const cardState = CardLogic.createCardState(prng);
    const gameState = { board: Array(8).fill(null).map(() => Array(8).fill(0)) };

    cardState._currentActionMeta = { actionId: 'observer-1', turnIndex: 18, plyIndex: 18 };

    BoardOps.spawnAt(cardState, gameState, 4, 5, 'black', 'SYSTEM', 'standard_place');
    CardLogic.addMarker(cardState, 'manifestStone', 4, 5, 'black', {
      type: 'OBSERVER_WILL',
      remainingOwnerTurns: 5,
      absoluteProtected: true,
      visualEffectKey: 'observerWillStone'
    });

    const spawn = (cardState._presentationEventsPersist || []).find(e => e && e.type === 'SPAWN' && e.row === 4 && e.col === 5);
    expect(spawn && spawn.meta && spawn.meta.special).toBe('OBSERVER_WILL');
    expect(spawn && spawn.meta && spawn.meta.timer).toBe(5);
    expect(spawn && spawn.meta && spawn.meta.owner).toBe('black');
    expect(spawn && spawn.meta && spawn.meta.visualEffectKey).toBe('observerWillStone');
    expect(spawn && spawn.meta && spawn.meta.manifestAura).toEqual({ owner: 'black' });

    const status = (cardState._presentationEventsPersist || []).find(e => e && e.type === 'STATUS_APPLIED' && e.row === 4 && e.col === 5);
    expect(status && status.meta && status.meta.special).toBe('OBSERVER_WILL');
    expect(status && status.meta && status.meta.manifestAura).toEqual({ owner: 'black' });
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

  test('will hunter king marker backfills SPAWN meta with destroy evasion count', () => {
    const prng = { shuffle: (arr) => arr };
    const cardState = CardLogic.createCardState(prng);
    const gameState = { board: Array(8).fill(null).map(() => Array(8).fill(0)) };

    cardState._currentActionMeta = { actionId: 'a3', turnIndex: 0, plyIndex: 0 };

    BoardOps.spawnAt(cardState, gameState, 2, 2, 'black', 'SYSTEM', 'standard_place');
    cardState.pendingEffectByPlayer.black = { type: 'WILL_HUNTER_KING' };

    const effects = CardLogic.applyPlacementEffects(cardState, gameState, 'black', 2, 2, 0);
    expect(effects && effects.willHunterKingPlaced).toBe(true);

    const spawn = (cardState._presentationEventsPersist || []).find(e => e && e.type === 'SPAWN' && e.row === 2 && e.col === 2);
    expect(spawn && spawn.meta && spawn.meta.special).toBe('WILL_HUNTER_KING');
    expect(spawn && spawn.meta && spawn.meta.flipEvadeRemaining).toBe(2);
    expect(spawn && spawn.meta && spawn.meta.destroyEvadeRemaining).toBe(2);

    const status = (cardState._presentationEventsPersist || []).find(e => e && e.type === 'STATUS_APPLIED' && e.row === 2 && e.col === 2);
    expect(status && status.meta && status.meta.special).toBe('WILL_HUNTER_KING');
    expect(status && status.meta && status.meta.destroyEvadeRemaining).toBe(2);
  });

  test('afterimage marker backfills SPAWN meta with dual evade counts', () => {
    const prng = { shuffle: (arr) => arr };
    const cardState = CardLogic.createCardState(prng);
    const gameState = { board: Array(8).fill(null).map(() => Array(8).fill(0)) };

    cardState._currentActionMeta = { actionId: 'a4', turnIndex: 0, plyIndex: 0 };

    BoardOps.spawnAt(cardState, gameState, 3, 3, 'black', 'SYSTEM', 'standard_place');
    cardState.pendingEffectByPlayer.black = { type: 'AFTERIMAGE_WILL' };

    const effects = CardLogic.applyPlacementEffects(cardState, gameState, 'black', 3, 3, 0);
    expect(effects && effects.afterimagePlaced).toBe(true);

    const spawn = (cardState._presentationEventsPersist || []).find(e => e && e.type === 'SPAWN' && e.row === 3 && e.col === 3);
    expect(spawn && spawn.meta && spawn.meta.special).toBe('AFTERIMAGE_WILL');
    expect(spawn && spawn.meta && spawn.meta.flipEvadeRemaining).toBe(3);
    expect(spawn && spawn.meta && spawn.meta.destroyEvadeRemaining).toBe(3);

    const status = (cardState._presentationEventsPersist || []).find(e => e && e.type === 'STATUS_APPLIED' && e.row === 3 && e.col === 3);
    expect(status && status.meta && status.meta.special).toBe('AFTERIMAGE_WILL');
    expect(status && status.meta && status.meta.flipEvadeRemaining).toBe(3);
    expect(status && status.meta && status.meta.destroyEvadeRemaining).toBe(3);
  });
});
