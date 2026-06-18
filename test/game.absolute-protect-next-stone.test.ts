/* eslint-env jest */
/**
 * Regression tests for internal ABSOLUTE_PROTECTED stones.
 *
 * Covers:
 *  1. applyAbsoluteProtect upgrades/creates the internal marker safely
 *  2. Stone resists flip (changeAt), destroy (destroyAt), and move (moveAt)
 *  3. ABSOLUTE_PROTECTED marker persists across turn starts
 */

const Core = require('../game/logic/core.js');
import * as CardLogic from '../game/logic/cards.js';
import * as BoardOps from '../game/logic/board_ops.js';

function createPrng(randomValue = 0.5) {
  return {
    shuffle: (arr) => arr,
    random: () => randomValue
  };
}

function createEmptyGameState() {
  const gameState = Core.createGameState();
  gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
  gameState.currentPlayer = Core.BLACK;
  gameState.turnNumber = 1;
  gameState.consecutivePasses = 0;
  return gameState;
}

function findAbsoluteProtectedMarker(cardState, row, col) {
  return (cardState.markers || []).find(
    (m) =>
      m &&
      m.kind === 'specialStone' &&
      m.row === row &&
      m.col === col &&
      m.data &&
      m.data.type === 'ABSOLUTE_PROTECTED'
  );
}

describe('ABSOLUTE_PROTECTED（最強の意志の昇格後状態）', () => {
  test('applyAbsoluteProtect upgrades an existing PERMA_PROTECTED marker in place', () => {
    const prng = createPrng(0);
    const cardState = CardLogic.createCardState(prng);
    cardState.markers.push({
      id: 999,
      kind: 'specialStone',
      row: 5,
      col: 5,
      owner: 'black',
      data: {
        type: 'PERMA_PROTECTED',
        strongWillPromotionOwnerTurnStarts: 19,
        strongWillPromotionThreshold: 20
      }
    });

    const result = CardLogic.applyAbsoluteProtect(cardState, 'black', 5, 5);
    expect(result).toEqual(expect.objectContaining({ applied: true }));

    const marker = findAbsoluteProtectedMarker(cardState, 5, 5);
    expect(marker).toBeTruthy();
    expect(marker.owner).toBe('black');
    expect(marker.data).toEqual({ type: 'ABSOLUTE_PROTECTED' });

    const markerCount = (cardState.markers || []).filter((entry) => (
      entry &&
      entry.kind === 'specialStone' &&
      entry.row === 5 &&
      entry.col === 5
    )).length;
    expect(markerCount).toBe(1);
  });

  test('changeAt (flip) is blocked by ABSOLUTE_PROTECTED and returns absolute_protected reason', () => {
    const prng = createPrng(0);
    const cardState = CardLogic.createCardState(prng);
    const gameState = createEmptyGameState();
    gameState.board[3][3] = Core.BLACK;

    cardState.markers.push({
      id: 998,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'ABSOLUTE_PROTECTED' }
    });

    const result = BoardOps.changeAt(cardState, gameState, 3, 3, 'white', 'card', 'test');
    expect(result.changed).toBe(false);
    expect(result.reason).toBe('absolute_protected');
    expect(BoardOps.getCellValue(gameState, 3, 3)).toBe(Core.BLACK);
  });

  test('destroyAt is blocked by ABSOLUTE_PROTECTED and returns absolute_protected reason', () => {
    const prng = createPrng(0);
    const cardState = CardLogic.createCardState(prng);
    const gameState = createEmptyGameState();
    gameState.board[4][4] = Core.WHITE;

    cardState.markers.push({
      id: 997,
      kind: 'specialStone',
      row: 4,
      col: 4,
      owner: 'white',
      data: { type: 'ABSOLUTE_PROTECTED' }
    });

    const result = BoardOps.destroyAt(cardState, gameState, 4, 4, 'card', 'test');
    expect(result.destroyed).toBe(false);
    expect(result.reason).toBe('absolute_protected');
    expect(BoardOps.getCellValue(gameState, 4, 4)).toBe(Core.WHITE);
  });

  test('moveAt source is blocked by ABSOLUTE_PROTECTED and returns absolute_protected_source reason', () => {
    const prng = createPrng(0);
    const cardState = CardLogic.createCardState(prng);
    const gameState = createEmptyGameState();
    gameState.board[2][2] = Core.BLACK;

    cardState.markers.push({
      id: 996,
      kind: 'specialStone',
      row: 2,
      col: 2,
      owner: 'black',
      data: { type: 'ABSOLUTE_PROTECTED' }
    });

    const result = BoardOps.moveAt(cardState, gameState, 2, 2, 2, 5, 'card', 'test');
    expect(result.moved).toBe(false);
    expect(result.reason).toBe('absolute_protected_source');
    expect(BoardOps.getCellValue(gameState, 2, 2)).toBe(Core.BLACK);
    expect(BoardOps.getCellValue(gameState, 2, 5)).toBe(Core.EMPTY);
  });

  test('ABSOLUTE_PROTECTED marker persists across multiple turn starts', () => {
    const prng = createPrng(0);
    const cardState = CardLogic.createCardState(prng);
    const gameState = createEmptyGameState();
    cardState.debugNoDraw = true;

    cardState.markers.push({
      id: 995,
      kind: 'specialStone',
      row: 2,
      col: 3,
      owner: 'black',
      data: { type: 'ABSOLUTE_PROTECTED' }
    });

    for (let i = 0; i < 6; i += 1) {
      CardLogic.onTurnStart(cardState, i % 2 === 0 ? 'white' : 'black', gameState, prng);
    }

    const marker = findAbsoluteProtectedMarker(cardState, 2, 3);
    expect(marker).toBeTruthy();
  });

  test('isAbsoluteProtectedCell returns true only for the protected cell', () => {
    const prng = createPrng(0);
    const cardState = CardLogic.createCardState(prng);

    cardState.markers.push({
      id: 994,
      kind: 'specialStone',
      row: 1,
      col: 1,
      owner: 'white',
      data: { type: 'ABSOLUTE_PROTECTED' }
    });

    expect(CardLogic.isAbsoluteProtectedCell(cardState, 1, 1)).toBe(true);
    expect(CardLogic.isAbsoluteProtectedCell(cardState, 1, 2)).toBe(false);
    expect(CardLogic.isAbsoluteProtectedCell(cardState, 0, 0)).toBe(false);
  });
});
