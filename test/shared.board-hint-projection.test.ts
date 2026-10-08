import * as BoardHintProjection from '../shared/board-hint-projection';

function toArray(set: Set<string>): string[] {
  return Array.from(set).sort();
}

describe('board hint projection', () => {
  test('collects selected target highlights for multi-stage pending cards', () => {
    expect(toArray(BoardHintProjection.collectPendingSelectedTargetHighlightKeys({
      type: 'BOARD_EXPANSION_GOD',
      stage: 'selectTarget',
      firstTarget: { row: 1, col: 2 },
      selectedTargets: [{ row: 3, col: 4 }, { row: 5, col: 6 }]
    }))).toEqual(['1,2', '3,4', '5,6']);
  });

  test('builds random spawn previews from injected card logic', () => {
    const projection = BoardHintProjection.buildBoardHintProjection({
      gameState: { board: [[0]], currentPlayer: 1 },
      cardState: {
        selectedCardId: 'reinforce_01',
        selectedCardOwnerKey: 'black',
        pendingEffectByPlayer: { black: null }
      },
      playerKey: 'black',
      boardShape: { rows: 1, cols: 1 },
      canControlCurrentTurn: true,
      isHumanTurn: true,
      cardLogic: {
        getSelectableTargets: jest.fn(() => []),
        getCardType: jest.fn(() => 'REINFORCEMENT_WILL'),
        getReinforcementWillTargets: jest.fn(() => [{ row: 0, col: 0 }])
      },
      getLegalMoves: jest.fn(() => [{ row: 0, col: 0 }])
    });

    expect(toArray(projection.randomSpawnPreviewSet)).toEqual(['0,0']);
    expect(projection.showLegalHints).toBe(false);
    expect(toArray(projection.legalSet)).toEqual([]);
  });

  test('restores normal legal hints when a stale random spawn selection has already been used', () => {
    const projection = BoardHintProjection.buildBoardHintProjection({
      gameState: { board: [[0]], currentPlayer: 1 },
      cardState: {
        selectedCardId: 'support_troops_01',
        selectedCardOwnerKey: 'black',
        hasUsedCardThisTurnByPlayer: { black: true },
        pendingEffectByPlayer: { black: null }
      },
      playerKey: 'black',
      boardShape: { rows: 1, cols: 1 },
      canControlCurrentTurn: true,
      isHumanTurn: true,
      cardLogic: {
        getSelectableTargets: jest.fn(() => []),
        getCardType: jest.fn(() => 'SUPPORT_TROOPS_WILL'),
        getSupportTroopsWillTargets: jest.fn(() => [{ row: 0, col: 0 }])
      },
      getLegalMoves: jest.fn(() => [{ row: 0, col: 0 }])
    });

    expect(toArray(projection.randomSpawnPreviewSet)).toEqual([]);
    expect(projection.showLegalHints).toBe(true);
    expect(toArray(projection.legalSet)).toEqual(['0,0']);
  });

  // 01-rulebook.md §8.4: 終局後は置けるマスを光らせない。
  test('hides legal hints once the game has ended', () => {
    const getLegalMoves = jest.fn(() => [{ row: 0, col: 0 }]);
    const projection = BoardHintProjection.buildBoardHintProjection({
      gameState: { board: [[0]], currentPlayer: 1, consecutivePasses: 2 },
      cardState: { pendingEffectByPlayer: { black: null } },
      playerKey: 'black',
      boardShape: { rows: 1, cols: 1 },
      canControlCurrentTurn: true,
      isHumanTurn: true,
      cardLogic: { getSelectableTargets: jest.fn(() => []) },
      getLegalMoves
    });

    expect(projection.showLegalHints).toBe(false);
    expect(toArray(projection.legalSet)).toEqual([]);
    expect(getLegalMoves).not.toHaveBeenCalled();
  });

  test('combines normal legal hints and taboo reverse candidates', () => {
    const projection = BoardHintProjection.buildBoardHintProjection({
      gameState: {
        board: [
          [0, 1, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0]
        ],
        boardConfig: { rows: 4, cols: 4 },
        currentPlayer: 1
      },
      cardState: {
        pendingEffectByPlayer: {
          black: { type: 'TABOO_REVERSE_WILL' }
        }
      },
      playerKey: 'black',
      boardShape: { rows: 4, cols: 4 },
      canControlCurrentTurn: true,
      isHumanTurn: true,
      expansions: [{ row: 2, col: 0, owner: 0 }],
      cardLogic: {
        getSelectableTargets: jest.fn(() => []),
        getCardContext: jest.fn(() => ({ protectedStones: [], permaProtectedStones: [] })),
        getTabooReverseCandidates: jest.fn((_cardState, _gameState, _playerKey, row, col) => (
          row === 1 && col === 0 ? [{ row: 0, col: 1 }] : []
        ))
      },
      getLegalMoves: jest.fn(() => [{ row: 0, col: 0 }])
    });

    expect(projection.showLegalHints).toBe(true);
    expect(toArray(projection.normalLegalSet)).toEqual(['0,0']);
    expect(toArray(projection.tabooLegalSet)).toEqual(['1,0']);
    expect(toArray(projection.legalSet)).toEqual(['0,0', '1,0']);
  });

  test('taboo hints include expansion empties and exclude meteor holes through BoardView', () => {
    const getTabooReverseCandidates = jest.fn((_cardState, _gameState, _playerKey, row, col) => (
      row === 1 && (col === 4 || col === 5)
        ? [{ row: 0, col: 1 }]
        : []
    ));
    const projection = BoardHintProjection.buildBoardHintProjection({
      gameState: {
        board: Array.from({ length: 4 }, () => Array(4).fill(0)),
        boardConfig: { rows: 4, cols: 4 },
        boardExpansion: {
          active: true,
          cells: [
            { row: 1, col: 4, side: 'right', owner: 0 },
            { row: 1, col: 5, side: 'right', owner: 0 }
          ]
        },
        currentPlayer: 1
      },
      cardState: {
        pendingEffectByPlayer: {
          black: { type: 'TABOO_REVERSE_WILL' }
        },
        markers: [{
          kind: 'specialStone',
          row: 1,
          col: 5,
          data: { type: 'METEOR_HOLE' }
        }]
      },
      playerKey: 'black',
      boardShape: { rows: 4, cols: 4 },
      canControlCurrentTurn: true,
      isHumanTurn: true,
      cardLogic: {
        getSelectableTargets: jest.fn(() => []),
        getCardContext: jest.fn(() => ({ protectedStones: [], permaProtectedStones: [] })),
        getTabooReverseCandidates
      },
      getLegalMoves: jest.fn(() => [])
    });

    expect(toArray(projection.tabooLegalSet)).toEqual(['1,4']);
    expect(getTabooReverseCandidates).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'black',
      1,
      4
    );
    expect(getTabooReverseCandidates).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'black',
      1,
      5
    );
  });

  test('builds board shrink direction and preview hints', () => {
    const pending = {
      type: 'BOARD_SHRINK_GOD',
      stage: 'selectTarget',
      firstTarget: { row: 2, col: 2 }
    };
    const selectableTargets = [
      { row: 2, col: 4, lineCells: [{ row: 2, col: 3 }, { row: 2, col: 4 }] },
      { row: 0, col: 2, lineCells: [{ row: 1, col: 2 }, { row: 0, col: 2 }] }
    ];

    expect(Array.from(BoardHintProjection.buildBoardShrinkGodDirectionHintMap(pending, selectableTargets).entries()).sort()).toEqual([
      ['0,2', 'up'],
      ['2,4', 'right']
    ]);
    expect(toArray(BoardHintProjection.collectBoardShrinkGodPreviewHighlightKeys(pending, selectableTargets))).toEqual([
      '0,2',
      '1,2',
      '2,3',
      '2,4'
    ]);
  });

  test('builds board expansion direction hints for edge and corner targets', () => {
    const willPending = {
      type: 'BOARD_EXPANSION_WILL',
      stage: 'selectTarget'
    };
    const willTargets = [
      { row: 2, col: 0, side: 'left', directionKey: 'left' },
      { row: 5, col: 7, side: 'right', directionKey: 'right' }
    ];

    expect(Array.from(BoardHintProjection.buildBoardExpansionDirectionHintMap(willPending, willTargets, { rows: 8, cols: 8 }).entries()).sort()).toEqual([
      ['2,0', ['left']],
      ['5,7', ['right']]
    ]);

    const godPending = {
      type: 'BOARD_EXPANSION_GOD',
      stage: 'selectTarget'
    };
    const godTargets = [
      { row: 0, col: 0, directionKey: 'up-left' },
      { row: 7, col: 7, directionKey: 'down-right' }
    ];

    expect(Array.from(BoardHintProjection.buildBoardExpansionDirectionHintMap(godPending, godTargets, { rows: 8, cols: 8 }).entries()).sort()).toEqual([
      ['0,0', ['up-left']],
      ['7,7', ['down-right']]
    ]);

    const multiDirectionTargets = [
      { row: 0, col: 0, directionKey: 'up' },
      { row: 0, col: 0, directionKey: 'left' }
    ];
    expect(Array.from(BoardHintProjection.buildBoardExpansionDirectionHintMap(willPending, multiDirectionTargets, { rows: 8, cols: 8 }).entries())).toEqual([
      ['0,0', ['up', 'left']]
    ]);
  });

  test('treats non-array selectable target results as empty', () => {
    const projection = BoardHintProjection.buildBoardHintProjection({
      gameState: { board: [[0]], currentPlayer: 1 },
      cardState: {
        pendingEffectByPlayer: {
          black: { type: 'GUARD_WILL', stage: 'selectTarget' }
        }
      },
      playerKey: 'black',
      boardShape: { rows: 1, cols: 1 },
      canControlCurrentTurn: true,
      isHumanTurn: true,
      cardLogic: {
        getSelectableTargets: jest.fn(() => ({ row: 0, col: 0 }))
      },
      getLegalMoves: jest.fn(() => [])
    });

    expect(projection.selectableTargets).toEqual([]);
    expect(projection.isSelectingTarget).toBe(false);
  });
});
