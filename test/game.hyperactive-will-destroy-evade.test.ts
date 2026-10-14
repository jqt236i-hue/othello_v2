import * as CardLogic from '../game/logic/cards.js';
import * as BoardOps from '../game/logic/board_ops.js';
import * as Core from '../game/logic/core.js';

describe('躍動石・逃亡石の破壊回避', () => {
  function makePrng() {
    return {
      shuffle: (arr) => arr,
      random: () => 0
    };
  }

  function createEmptyBoard() {
    return Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
  }

  function placeWithCard(cardType, cardId) {
    const cardState = CardLogic.createCardState(makePrng());
    const gameState = { board: createEmptyBoard(), currentPlayer: Core.BLACK };
    gameState.board[3][3] = Core.BLACK;
    cardState.pendingEffectByPlayer.black = { type: cardType, stage: null, cardId };
    CardLogic.applyPlacementEffects(cardState, gameState, 'black', 3, 3, 0);
    const marker = (cardState.markers || []).find((m) => m && m.kind === 'specialStone' && m.row === 3 && m.col === 3);
    return { cardState, gameState, marker };
  }

  function destroyUntilGone(cardState, gameState, marker) {
    const evasions = [];
    for (let i = 0; i < 10; i++) {
      const row = marker.row;
      const col = marker.col;
      const result = BoardOps.destroyAt(cardState, gameState, row, col, 'SYSTEM', 'test_destroy');
      if (!result || !result.evaded) {
        expect(result && result.destroyed).toBe(true);
        expect(gameState.board[row][col]).toBe(Core.EMPTY);
        return evasions;
      }
      expect(gameState.board[row][col]).toBe(Core.EMPTY);
      evasions.push(marker.data.destroyEvadeRemaining);
    }
    throw new Error('destroy evasion did not end');
  }

  test.each([
    ['HYPERACTIVE_WILL', 'hyperactive_01', 'HYPERACTIVE', 1, [0]],
    ['ESCAPE_WILL', 'escape_01', 'ESCAPE_HYPERACTIVE', 3, [2, 1, 0]]
  ])('%s の石は破壊回避を初期値どおり使い切ってから破壊される', (cardType, cardId, markerType, initial, remainingAfterEach) => {
    const { cardState, gameState, marker } = placeWithCard(cardType, cardId);
    expect(marker && marker.data.type).toBe(markerType);
    expect(marker.data.destroyEvadeRemaining).toBe(initial);

    expect(destroyUntilGone(cardState, gameState, marker)).toEqual(remainingAfterEach);
    expect((cardState.markers || []).includes(marker)).toBe(false);
  });

  test('瞬間躍動の石は破壊回避しない', () => {
    const { cardState, gameState, marker } = placeWithCard('INSTANT_HYPERACTIVE_WILL', 'instant_hyperactive_01');
    expect(marker && marker.data.instantPlacementOnly).toBe(true);

    const result = BoardOps.destroyAt(cardState, gameState, 3, 3, 'SYSTEM', 'test_destroy');
    expect(result && result.destroyed).toBe(true);
    expect(result && result.evaded).toBe(false);
  });

  test('逃亡石の自爆では自身は回避せず、巻き込まれた逃亡石は爆破範囲の外へ回避する', () => {
    const cardState = CardLogic.createCardState(makePrng());
    const gameState = { board: createEmptyBoard(), currentPlayer: Core.BLACK };
    gameState.board[3][3] = Core.BLACK;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        gameState.board[3 + dr][3 + dc] = Core.WHITE;
      }
    }
    cardState.markers.push({
      id: 201, kind: 'specialStone', row: 3, col: 3, owner: 'black',
      data: { type: 'ESCAPE_HYPERACTIVE', flipEvadeRemaining: 3, destroyEvadeRemaining: 3 }
    });
    const neighbor = {
      id: 202, kind: 'specialStone', row: 2, col: 2, owner: 'white',
      data: { type: 'ESCAPE_HYPERACTIVE', flipEvadeRemaining: 3, destroyEvadeRemaining: 3 }
    };
    cardState.markers.push(neighbor);

    const res = CardLogic.processHyperactiveMoveAtAnchor(cardState, gameState, 'black', 3, 3, makePrng());
    expect(res && res.moved).toHaveLength(0);

    expect(gameState.board[3][3]).toBe(Core.EMPTY);
    expect((cardState.markers || []).some((m) => m && m.id === 201)).toBe(false);

    expect(neighbor.data.destroyEvadeRemaining).toBe(2);
    const insideBlast = Math.abs(neighbor.row - 3) <= 1 && Math.abs(neighbor.col - 3) <= 1;
    expect(insideBlast).toBe(false);
    expect(gameState.board[neighbor.row][neighbor.col]).toBe(Core.WHITE);
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        expect(gameState.board[3 + dr][3 + dc]).toBe(Core.EMPTY);
      }
    }
  });
});
