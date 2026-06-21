const Planner = require('../game/cpu-network-command-planner');

function createInput(overrides: any = {}) {
  return Object.assign({
    playerKey: 'black',
    gameState: { currentPlayer: 1, turnNumber: 10 },
    cardState: {
      turnIndex: 10,
      hands: { black: [], white: [] },
      pendingEffectByPlayer: { black: null, white: null },
      hasUsedCardThisTurnByPlayer: { black: false, white: false }
    },
    getLegalMoves: jest.fn().mockReturnValue([]),
    selectCpuMoveWithPolicy: jest.fn((moves: any[]) => moves[0]),
    computeCpuAction: jest.fn().mockReturnValue({ type: 'pass' }),
    CardLogic: {
      hasUsableCard: jest.fn().mockReturnValue(false)
    },
    CoreLogic: null,
    PendingCoordinator: {
      resolvePendingSelectionActionField: jest.fn()
    },
    PendingSelectionRegistry: {
      getPendingSelectionTargetMethod: jest.fn()
    }
  }, overrides);
}

describe('CpuNetworkCommandPlanner', () => {
  test('plans a place command from legal moves', () => {
    const input = createInput({
      getLegalMoves: jest.fn().mockReturnValue([{ row: 2, col: 3 }, { row: 4, col: 5 }]),
      selectCpuMoveWithPolicy: jest.fn().mockReturnValue({ row: 4, col: 5 })
    });

    expect(Planner.planCpuNetworkCommand(input)).toEqual({
      actionType: 'place',
      action: { type: 'place', row: 4, col: 5 }
    });
  });

  test('plans a use_card command from CPU card decision', () => {
    const input = createInput({
      CardLogic: { hasUsableCard: jest.fn().mockReturnValue(true) },
      computeCpuAction: jest.fn().mockReturnValue({ type: 'useCard', cardId: 'work_01' })
    });

    expect(Planner.planCpuNetworkCommand(input)).toEqual({
      actionType: 'use_card',
      action: {
        type: 'use_card',
        playerKey: 'black',
        useCardId: 'work_01',
        useCardOwnerKey: 'black'
      }
    });
  });

  test('falls back to the first usable card when CPU card decision declines to use one', () => {
    const input = createInput({
      cardState: {
        turnIndex: 13,
        hands: {
          black: ['ultimate_hyperactive_01', 'board_expand_01'],
          white: []
        },
        pendingEffectByPlayer: { black: null, white: null },
        hasUsedCardThisTurnByPlayer: { black: false, white: false }
      },
      getLegalMoves: jest.fn().mockReturnValue([]),
      computeCpuAction: jest.fn().mockReturnValue({ type: 'pass' }),
      CardLogic: {
        hasUsableCard: jest.fn().mockReturnValue(true),
        getUsableCardIds: jest.fn().mockReturnValue(['board_expand_01'])
      }
    });

    expect(Planner.planCpuNetworkCommand(input)).toEqual({
      actionType: 'use_card',
      action: {
        type: 'use_card',
        playerKey: 'black',
        useCardId: 'board_expand_01',
        useCardOwnerKey: 'black'
      }
    });
  });

  test('does not publish autoNoActionPass when a usable card exists but no card id can be resolved', () => {
    const input = createInput({
      getLegalMoves: jest.fn().mockReturnValue([]),
      computeCpuAction: jest.fn().mockReturnValue({ type: 'pass' }),
      CardLogic: {
        hasUsableCard: jest.fn().mockReturnValue(true),
        getUsableCardIds: jest.fn().mockReturnValue([])
      }
    });

    expect(Planner.planCpuNetworkCommand(input)).toEqual({
      actionType: 'pass',
      action: {
        type: 'pass',
        playerKey: 'black'
      }
    });
  });

  test('plans a pending target selection command from registry metadata', () => {
    const input = createInput({
      cardState: {
        turnIndex: 12,
        pendingEffectByPlayer: {
          black: {
            type: 'TIME_BOMB',
            stage: 'selectTarget',
            cardId: 'time_bomb_01',
            pendingEffectId: 'pending_12_1'
          },
          white: null
        }
      },
      CardLogic: {
        getTimeBombTargets: jest.fn().mockReturnValue([{ row: 3, col: 4 }])
      },
      PendingCoordinator: {
        resolvePendingSelectionActionField: jest.fn().mockReturnValue('bombTarget')
      },
      PendingSelectionRegistry: {
        getPendingSelectionTargetMethod: jest.fn().mockReturnValue('getTimeBombTargets')
      }
    });

    expect(Planner.planCpuNetworkCommand(input)).toEqual({
      actionType: 'place',
      action: {
        type: 'place',
        player: 'black',
        row: 3,
        col: 4,
        bombTarget: { row: 3, col: 4 },
        pendingSelectionState: {
          type: 'TIME_BOMB',
          stage: 'selectTarget',
          cardId: 'time_bomb_01',
          pendingEffectId: 'pending_12_1'
        },
        turnIndex: 12
      }
    });
  });

  test('plans an autoNoActionPass only when no move, card, or pending action exists', () => {
    const input = createInput();

    expect(Planner.planCpuNetworkCommand(input)).toEqual({
      actionType: 'pass',
      action: {
        type: 'pass',
        playerKey: 'black',
        autoNoActionPass: true
      }
    });
  });

  test('plans heaven blessing hand-overlay selection', () => {
    const input = createInput({
      cardState: {
        turnIndex: 13,
        pendingEffectByPlayer: {
          black: {
            type: 'HEAVEN_BLESSING',
            stage: 'selectTarget',
            cardId: 'heaven_01',
            pendingEffectId: 'pending_13_1',
            offers: ['gold_stone']
          },
          white: null
        }
      }
    });

    expect(Planner.planCpuNetworkCommand(input)).toEqual({
      actionType: 'place',
      action: {
        type: 'place',
        player: 'black',
        heavenBlessingCardId: 'gold_stone',
        pendingSelectionState: {
          type: 'HEAVEN_BLESSING',
          stage: 'selectTarget',
          cardId: 'heaven_01',
          pendingEffectId: 'pending_13_1'
        },
        turnIndex: 13
      }
    });
  });

  test('preserves multi-stage pending selection transport state', () => {
    const input = createInput({
      cardState: {
        turnIndex: 14,
        pendingEffectByPlayer: {
          black: {
            type: 'BOARD_SHRINK_WILL',
            stage: 'selectTarget',
            cardId: 'board_shrink_01',
            pendingEffectId: 'pending_14_1',
            selectedTargets: [{ row: 1, col: 1 }],
            selectedCount: 1,
            maxSelections: 3
          },
          white: null
        }
      },
      CardLogic: {
        getBoardShrinkTargets: jest.fn().mockReturnValue([{ row: 2, col: 2 }])
      },
      PendingCoordinator: {
        resolvePendingSelectionActionField: jest.fn().mockReturnValue('shrinkTarget')
      },
      PendingSelectionRegistry: {
        getPendingSelectionTargetMethod: jest.fn().mockReturnValue('getBoardShrinkTargets')
      }
    });

    expect(Planner.planCpuNetworkCommand(input)).toEqual({
      actionType: 'place',
      action: {
        type: 'place',
        player: 'black',
        row: 2,
        col: 2,
        shrinkTarget: { row: 2, col: 2 },
        pendingSelectionState: {
          type: 'BOARD_SHRINK_WILL',
          stage: 'selectTarget',
          cardId: 'board_shrink_01',
          pendingEffectId: 'pending_14_1',
          selectedTargets: [{ row: 1, col: 1 }],
          selectedCount: 1,
          maxSelections: 3
        },
        turnIndex: 14
      }
    });
  });

  test('uses core legal-move fallback for placement-style pending effects', () => {
    const input = createInput({
      cardState: {
        turnIndex: 19,
        pendingEffectByPlayer: {
          black: {
            type: 'ULTIMATE_HYPERACTIVE_GOD',
            stage: null,
            cardId: 'ultimate_hyperactive_01',
            pendingEffectId: 'pending_19_1'
          },
          white: null
        }
      },
      getLegalMoves: jest.fn().mockReturnValue([]),
      CardLogic: {
        hasUsableCard: jest.fn().mockReturnValue(false),
        getCardContext: jest.fn().mockReturnValue({ blockedCells: [] })
      },
      CoreLogic: {
        getLegalMoves: jest.fn().mockReturnValue([{ row: 1, col: 5, flips: [[1, 4]] }])
      }
    });

    expect(Planner.planCpuNetworkCommand(input)).toEqual({
      actionType: 'place',
      action: { type: 'place', row: 1, col: 5 }
    });
    expect(input.CoreLogic.getLegalMoves).toHaveBeenCalled();
  });

  test('uses free-placement fallback moves for free placement pending effects', () => {
    const input = createInput({
      cardState: {
        turnIndex: 20,
        pendingEffectByPlayer: {
          black: {
            type: 'FREE_PLACEMENT',
            stage: null,
            cardId: 'free_01',
            pendingEffectId: 'pending_20_1'
          },
          white: null
        }
      },
      getLegalMoves: jest.fn().mockReturnValue([]),
      CardLogic: {
        hasUsableCard: jest.fn().mockReturnValue(false),
        getCardContext: jest.fn().mockReturnValue({ blockedCells: [] }),
        isFreePlacementPendingType: jest.fn().mockReturnValue(true)
      },
      CoreLogic: {
        getFreePlacementMoves: jest.fn().mockReturnValue([{ row: 0, col: 0, flips: [] }]),
        getLegalMoves: jest.fn().mockReturnValue([])
      }
    });

    expect(Planner.planCpuNetworkCommand(input)).toEqual({
      actionType: 'place',
      action: { type: 'place', row: 0, col: 0 }
    });
    expect(input.CoreLogic.getFreePlacementMoves).toHaveBeenCalled();
  });

  test('does not publish autoNoActionPass while an unresolved pending effect remains', () => {
    const input = createInput({
      cardState: {
        turnIndex: 21,
        pendingEffectByPlayer: {
          black: {
            type: 'ULTIMATE_HYPERACTIVE_GOD',
            stage: null,
            cardId: 'ultimate_hyperactive_01',
            pendingEffectId: 'pending_21_1'
          },
          white: null
        }
      },
      getLegalMoves: jest.fn().mockReturnValue([]),
      CardLogic: {
        hasUsableCard: jest.fn().mockReturnValue(false),
        getCardContext: jest.fn().mockReturnValue({})
      },
      CoreLogic: {
        getLegalMoves: jest.fn().mockReturnValue([])
      }
    });

    expect(Planner.planCpuNetworkCommand(input)).toEqual({
      actionType: 'pass',
      action: {
        type: 'pass',
        playerKey: 'black'
      }
    });
  });
});
