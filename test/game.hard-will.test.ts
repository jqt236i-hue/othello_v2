import * as SharedConstants from '../shared-constants.js';
import * as CardLogic from '../game/logic/cards.js';
import * as BoardOps from '../game/logic/board_ops.js';

describe('HARD_WILL / DESTROY_PROTECTION (硬い意志 / 破壊保護)', () => {
  function makeState(options = {}) {
    const rows = Number.isInteger((options as any).rows) ? (options as any).rows : 8;
    const cols = Number.isInteger((options as any).cols) ? (options as any).cols : rows;
    const prng = { shuffle: () => {}, random: () => 0.5 };
    const cardState = CardLogic.createCardState(prng, { boardConfig: { rows, cols } });
    const gameState = {
      board: Array.from({ length: rows }, () => Array(cols).fill(SharedConstants.EMPTY)),
      currentPlayer: SharedConstants.BLACK,
      turnNumber: 1,
      consecutivePasses: 0
    };
    return { cardState, gameState };
  }

  function findDestroyProtectionMarker(cardState: any, row: number, col: number) {
    return (cardState.markers || []).find((marker: any) => (
      marker &&
      marker.kind === 'specialStone' &&
      marker.row === row &&
      marker.col === col &&
      marker.data &&
      marker.data.type === 'DESTROY_PROTECTION'
    ));
  }

  test('applies destroy protection to an own stone and clears pending selection', () => {
    const { cardState, gameState } = makeState();
    gameState.board[2][2] = SharedConstants.BLACK;
    cardState.pendingEffectByPlayer.black = { type: 'HARD_WILL', stage: 'selectTarget', cardId: 'hard_will_01' };

    expect(typeof CardLogic.applyHardWill).toBe('function');
    const applied = CardLogic.applyHardWill(cardState, gameState, 'black', 2, 2);

    expect(applied).toMatchObject({ applied: true, row: 2, col: 2 });
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
    const marker = findDestroyProtectionMarker(cardState, 2, 2);
    expect(marker).toBeTruthy();
    expect(marker.owner).toBe('black');
    expect(marker.data.remainingOwnerTurns).toBe(8);
  });

  test('reapplying refreshes the existing destroy protection marker without stacking', () => {
    const { cardState, gameState } = makeState();
    gameState.board[2][2] = SharedConstants.BLACK;
    cardState.markers.push({
      id: 201,
      kind: 'specialStone',
      row: 2,
      col: 2,
      owner: 'black',
      data: { type: 'DESTROY_PROTECTION', remainingOwnerTurns: 2 }
    });
    cardState.pendingEffectByPlayer.black = { type: 'HARD_WILL', stage: 'selectTarget', cardId: 'hard_will_01' };

    const applied = CardLogic.applyHardWill(cardState, gameState, 'black', 2, 2);

    expect(applied).toMatchObject({ applied: true });
    const markers = (cardState.markers || []).filter((marker: any) => (
      marker &&
      marker.row === 2 &&
      marker.col === 2 &&
      marker.data &&
      marker.data.type === 'DESTROY_PROTECTION'
    ));
    expect(markers).toHaveLength(1);
    expect(markers[0].data.remainingOwnerTurns).toBe(8);
  });

  test('destroy protection blocks stone destruction and removes the cell from destroy targets', () => {
    const { cardState, gameState } = makeState();
    gameState.board[3][3] = SharedConstants.WHITE;
    cardState.markers.push({
      id: 301,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'white',
      data: { type: 'DESTROY_PROTECTION', remainingOwnerTurns: 8 }
    });

    const targets = CardLogic.getDestroyTargets(cardState, gameState, 'black');
    expect(targets).not.toContainEqual({ row: 3, col: 3 });

    const destroyed = BoardOps.destroyAt(cardState, gameState, 3, 3, 'DESTROY_ONE_STONE', 'hard_will_test');
    expect(destroyed).toMatchObject({ destroyed: false, reason: 'destroy_protected' });
    expect(gameState.board[3][3]).toBe(SharedConstants.WHITE);
  });

  test('destroy protection does not block non-destroy flipping effects', () => {
    const { cardState, gameState } = makeState();
    gameState.board[3][3] = SharedConstants.BLACK;
    gameState.board[3][4] = SharedConstants.WHITE;
    cardState.markers.push(
      {
        id: 401,
        kind: 'specialStone',
        row: 3,
        col: 3,
        owner: 'black',
        data: { type: 'DRAGON', remainingOwnerTurns: 5 }
      },
      {
        id: 402,
        kind: 'specialStone',
        row: 3,
        col: 4,
        owner: 'white',
        data: { type: 'DESTROY_PROTECTION', remainingOwnerTurns: 8 }
      }
    );

    CardLogic.processDragonEffectsAtAnchor(cardState, gameState, 'black', 3, 3);

    expect(gameState.board[3][4]).toBe(SharedConstants.BLACK);
  });

  test('duration decreases on owner turns only and then expires', () => {
    const { cardState, gameState } = makeState();
    gameState.board[1][1] = SharedConstants.BLACK;
    cardState.markers.push({
      id: 501,
      kind: 'specialStone',
      row: 1,
      col: 1,
      owner: 'black',
      data: { type: 'DESTROY_PROTECTION', remainingOwnerTurns: 2 }
    });

    CardLogic.onTurnStart(cardState, 'white', gameState);
    let marker = findDestroyProtectionMarker(cardState, 1, 1);
    expect(marker.data.remainingOwnerTurns).toBe(2);

    CardLogic.onTurnStart(cardState, 'black', gameState);
    marker = findDestroyProtectionMarker(cardState, 1, 1);
    expect(marker.data.remainingOwnerTurns).toBe(1);

    CardLogic.onTurnStart(cardState, 'black', gameState);
    marker = findDestroyProtectionMarker(cardState, 1, 1);
    expect(marker).toBeUndefined();
  });
});
