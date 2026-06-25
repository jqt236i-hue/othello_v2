const Core = require('../game/logic/core.js');
const CardLogic = require('../game/logic/cards.js');
const BoardOps = require('../game/logic/board_ops.js');

function createPrng(randomValue = 0) {
  return {
    shuffle: (arr) => arr,
    random: () => randomValue
  };
}

describe('cell removal contract', () => {
  test('applyCellRemovalAt removes a living-will stone without reviving it', () => {
    const rng = createPrng(0);
    const cardState = CardLogic.createCardState(rng);
    const gameState = Core.createGameState();
    cardState.debugNoDraw = true;

    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
    gameState.board[2][2] = Core.BLACK;
    cardState.pendingEffectByPlayer.black = { type: 'LIVING_WILL', stage: 'selectTarget', cardId: 'living_will_01' };
    expect(CardLogic.applyLivingWill(cardState, gameState, 'black', 2, 2)).toMatchObject({ applied: true });

    const res = BoardOps.applyCellRemovalAt(cardState, gameState, 2, 2, 'black', 'METEOR_WILL', 'meteor_cell_destroy', {
      removalPolicy: 'cell_removal',
      removalKind: 'meteor_hole',
      randomSource: rng
    });

    expect(res).toMatchObject({ applied: true, row: 2, col: 2, destroyed: true });
    expect(gameState.board[2][2]).toBe(Core.EMPTY);
    expect((cardState.markers || []).some((m) => m && m.row === 2 && m.col === 2 && m.data && m.data.type === 'METEOR_HOLE')).toBe(true);
    expect((cardState.presentationEvents || []).some((ev) => ev && ev.cause === 'LIVING_WILL' && (ev.type === 'SPAWN' || ev.type === 'CHANGE'))).toBe(false);
  });

  test('applyCellRemovalAt ignores regen and destroy evasion but still fails on inviolable manifest stones', () => {
    const rng = createPrng(1);
    const cardState = CardLogic.createCardState(rng);
    const gameState = Core.createGameState();
    cardState.debugNoDraw = true;

    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
    gameState.board[3][3] = Core.BLACK;
    gameState.board[4][4] = Core.BLACK;
    gameState.board[5][5] = Core.BLACK;

    expect(CardLogic.applyRegenWill(cardState, 'black', 3, 3)).toEqual({ applied: true });
    cardState.markers.push({
      id: 'afterimage_1',
      kind: 'specialStone',
      row: 4,
      col: 4,
      owner: 'black',
      data: { type: 'AFTERIMAGE_WILL', flipEvadeRemaining: 3, destroyEvadeRemaining: 3 }
    });
    cardState.markers.push({
      id: 'manifest_1',
      kind: 'manifestStone',
      row: 5,
      col: 5,
      owner: 'black',
      data: { type: 'BOARD_EXECUTOR', remainingOwnerTurns: 4, inviolable: true }
    });

    expect(BoardOps.applyCellRemovalAt(cardState, gameState, 3, 3, 'black', 'METEOR_WILL', 'meteor_cell_destroy')).toMatchObject({ applied: true });
    expect(BoardOps.applyCellRemovalAt(cardState, gameState, 4, 4, 'black', 'METEOR_WILL', 'meteor_cell_destroy')).toMatchObject({ applied: true });
    expect(BoardOps.applyCellRemovalAt(cardState, gameState, 5, 5, 'black', 'METEOR_WILL', 'meteor_cell_destroy')).toMatchObject({ applied: false, reason: 'inviolable' });
  });
});
