/* eslint-env jest */

const Core = require('../game/logic/core.js');
import * as BoardOps from '../game/logic/board_ops.js';

const DestroyProtectionContext = require('../game/logic/cards-internal/destroy-protection-context');

function createEmptyGameState() {
  const gameState = Core.createGameState();
  gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
  gameState.currentPlayer = Core.BLACK;
  gameState.turnNumber = 1;
  gameState.consecutivePasses = 0;
  return gameState;
}

function marker(type: string, row = 2, col = 3, owner: 'black' | 'white' = 'black') {
  return {
    id: `${type}-${row}-${col}`,
    kind: 'specialStone',
    row,
    col,
    owner,
    data: { type }
  };
}

function registry(entries: Record<string, any>) {
  return {
    getSpecialStoneInfo(type: any) {
      return entries[String(type || '').toUpperCase()] || null;
    },
    SPECIAL_STONE_REGISTRY: entries
  };
}

describe('destroy-protection context', () => {
  test('finds registry-backed destroy protection without requiring BoardOps changes per new type', () => {
    const cardState = {
      markers: [
        marker('REGISTRY_PROTECTED', 2, 3),
        marker('NOT_PROTECTED', 4, 4)
      ]
    };

    const found = DestroyProtectionContext.resolveDestroyProtectionAt(cardState, 2, 3, {
      SpecialStoneRegistry: registry({
        REGISTRY_PROTECTED: { destroyProtected: true },
        NOT_PROTECTED: { destroyProtected: false }
      })
    });

    expect(found).toEqual(expect.objectContaining({
      type: 'REGISTRY_PROTECTED',
      reason: 'destroy_protected'
    }));
    expect(found.marker).toBe(cardState.markers[0]);
  });

  test('keeps GUARD reason stable and lets ignoreGuard bypass only GUARD', () => {
    const guardState = { markers: [marker('GUARD', 1, 1)] };
    const genericState = { markers: [marker('REGISTRY_PROTECTED', 1, 1)] };
    const fakeRegistry = registry({
      GUARD: { destroyProtected: true },
      REGISTRY_PROTECTED: { destroyProtected: true }
    });

    expect(DestroyProtectionContext.resolveDestroyProtectionAt(guardState, 1, 1, {
      SpecialStoneRegistry: fakeRegistry
    })).toEqual(expect.objectContaining({
      type: 'GUARD',
      reason: 'guard_protected'
    }));

    expect(DestroyProtectionContext.resolveDestroyProtectionAt(guardState, 1, 1, {
      SpecialStoneRegistry: fakeRegistry,
      ignoreGuard: true
    })).toBeNull();

    expect(DestroyProtectionContext.resolveDestroyProtectionAt(genericState, 1, 1, {
      SpecialStoneRegistry: fakeRegistry,
      ignoreGuard: true
    })).toEqual(expect.objectContaining({
      type: 'REGISTRY_PROTECTED',
      reason: 'destroy_protected'
    }));
  });

  test('ignores non-special markers and markers outside the requested cell', () => {
    const cardState = {
      markers: [
        { ...marker('REGISTRY_PROTECTED', 2, 2), kind: 'bomb' },
        marker('REGISTRY_PROTECTED', 2, 3)
      ]
    };
    const fakeRegistry = registry({
      REGISTRY_PROTECTED: { destroyProtected: true }
    });

    expect(DestroyProtectionContext.resolveDestroyProtectionAt(cardState, 2, 2, {
      SpecialStoneRegistry: fakeRegistry
    })).toBeNull();
    expect(DestroyProtectionContext.resolveDestroyProtectionAt(cardState, 2, 3, {
      SpecialStoneRegistry: fakeRegistry
    })).toEqual(expect.objectContaining({
      type: 'REGISTRY_PROTECTED',
      reason: 'destroy_protected'
    }));
  });

  test('BoardOps.destroyAt keeps current GUARD behavior through the shared helper', () => {
    const gameState = createEmptyGameState();
    const cardState = { markers: [marker('GUARD', 3, 3)] };
    gameState.board[3][3] = Core.BLACK;

    const blocked = BoardOps.destroyAt(cardState, gameState, 3, 3, 'TEST', 'guard_block');

    expect(blocked.destroyed).toBe(false);
    expect(blocked.reason).toBe('guard_protected');
    expect(BoardOps.getCellValue(gameState, 3, 3)).toBe(Core.BLACK);
  });

  test('BoardOps.destroyAt still destroys GUARD when ignoreGuard is explicitly set', () => {
    const gameState = createEmptyGameState();
    const cardState = { markers: [marker('GUARD', 3, 3)] };
    gameState.board[3][3] = Core.BLACK;

    const destroyed = BoardOps.destroyAt(cardState, gameState, 3, 3, 'TEST', 'guard_bypass', {
      ignoreGuard: true
    });

    expect(destroyed.destroyed).toBe(true);
    expect(BoardOps.getCellValue(gameState, 3, 3)).toBe(Core.EMPTY);
  });
});
