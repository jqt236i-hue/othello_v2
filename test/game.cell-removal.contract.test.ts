const Core = require('../game/logic/core.js');
const CardLogic = require('../game/logic/cards.js');
const BoardOps = require('../game/logic/board_ops.js');
const CardMarkers = require('../game/logic/cards/markers.js');

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

  test.each([
    {
      label: 'base',
      row: 2,
      col: 2,
      prepare(gameState, cardState) {
        gameState.board[2][2] = Core.BLACK;
        cardState.stoneIdMap[2][2] = 'base-stone';
      },
      readOwner(gameState) {
        return gameState.board[2][2];
      },
      readStoneId(cardState) {
        return cardState.stoneIdMap[2][2];
      }
    },
    {
      label: 'expansion',
      row: 1,
      col: 8,
      prepare(gameState, cardState) {
        gameState.boardExpansion = {
          cells: [{ side: 'right', row: 1, col: 8, owner: Core.WHITE }],
          usedByPlayer: { black: true, white: false }
        };
        cardState.expansionStoneIdByCell = { '1,8': 'expansion-stone' };
      },
      readOwner(gameState) {
        return gameState.boardExpansion.cells[0].owner;
      },
      readStoneId(cardState) {
        return cardState.expansionStoneIdByCell['1,8'];
      }
    }
  ])('rolls back every $label-cell mutation when hole marker creation fails', ({
    row,
    col,
    prepare,
    readOwner,
    readStoneId
  }) => {
    const cardState = CardLogic.createCardState(createPrng(0));
    const gameState = Core.createGameState();
    prepare(gameState, cardState);
    cardState.markers.push({
      id: 'existing-marker',
      markerId: 'existing-marker',
      kind: 'specialStone',
      row,
      col,
      owner: 'black',
      data: { type: 'AFTERIMAGE_WILL', flipEvadeRemaining: 1 }
    });
    cardState.presentationEvents.push({ type: 'TEST_SENTINEL' });
    const markersBefore = JSON.parse(JSON.stringify(cardState.markers));
    const eventsBefore = JSON.parse(JSON.stringify(cardState.presentationEvents));
    const expansionBefore = JSON.parse(JSON.stringify(gameState.boardExpansion));
    const addMarker = jest.spyOn(CardMarkers, 'addMarker').mockReturnValue(null);

    try {
      const result = BoardOps.applyCellRemovalAt(
        cardState,
        gameState,
        row,
        col,
        'black',
        'METEOR_WILL',
        'meteor_cell_destroy'
      );

      expect(result).toMatchObject({
        applied: false,
        reason: 'marker_failed',
        destroyed: false,
        destroyResult: null
      });
      expect(readOwner(gameState)).not.toBe(Core.EMPTY);
      expect(readStoneId(cardState)).toMatch(/stone/);
      expect(cardState.markers).toEqual(markersBefore);
      expect(cardState.presentationEvents).toEqual(eventsBefore);
      expect(gameState.boardExpansion).toEqual(expansionBefore);
    } finally {
      addMarker.mockRestore();
    }
  });
});
