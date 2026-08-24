const Planner = require('../game/cpu-network-command-planner');
const { createCardRuntimeUnavailableError } = require('../game/logic/card-runtime-errors');

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
      getPendingSelectionTargetMethod: jest.fn(),
      getPendingSelectionEntry: jest.fn()
    }
  }, overrides);
}

describe('CpuNetworkCommandPlanner', () => {
  test.each([
    ['hasUsableCard', {
      hasUsableCard: (error: Error) => jest.fn(() => { throw error; })
    }],
    ['analyzeCardUsability', {
      hasUsableCard: () => jest.fn(() => true),
      analyzeCardUsability: (error: Error) => jest.fn(() => { throw error; })
    }],
    ['getUsableCardIds', {
      hasUsableCard: () => jest.fn(() => true),
      getUsableCardIds: (error: Error) => jest.fn(() => { throw error; })
    }]
  ])('propagates tagged CardLogic.%s failure instead of inventing a move or pass', (_name, factories) => {
    const unavailable = createCardRuntimeUnavailableError('state.availability', 'state');
    const CardLogic = Object.fromEntries(Object.entries(factories).map(([key, factory]) => [
      key,
      (factory as (error: Error) => jest.Mock)(unavailable)
    ]));
    const input = createInput({
      CardLogic,
      getLegalMoves: jest.fn().mockReturnValue([]),
      computeCpuAction: jest.fn().mockReturnValue({ type: 'pass' })
    });

    expect(() => Planner.planCpuNetworkCommand(input)).toThrow(unavailable);
    expect(input.getLegalMoves).not.toHaveBeenCalled();
  });

  test('replans an invalid projected pass from the canonical card cost ledger', () => {
    const CardLogic = {
      hasUsableCard: jest.fn().mockReturnValue(true),
      getUsableCardIds: jest.fn().mockReturnValue(['hard_01'])
    };

    expect(Planner.planCanonicalCpuNetworkCommand({
      playerKey: 'black',
      snapshot: {
        gameState: { currentPlayer: 1, turnNumber: 74 },
        cardState: {
          turnIndex: 74,
          hands: { black: ['hard_01'], white: [] },
          pendingEffectByPlayer: { black: null, white: null }
        }
      },
      preferredActionType: 'pass',
      preferredAction: { type: 'pass', playerKey: 'black', autoNoActionPass: true },
      CardLogic,
      CoreLogic: { getLegalMoves: jest.fn().mockReturnValue([]) }
    })).toEqual({
      actionType: 'use_card',
      action: {
        type: 'use_card',
        playerKey: 'black',
        useCardId: 'hard_01',
        useCardOwnerKey: 'black'
      }
    });
  });

  test('targets the usable copy when duplicate card ids have different private costs', () => {
    const CardLogic = {
      hasUsableCard: jest.fn().mockReturnValue(true),
      analyzeCardUsability: jest.fn().mockReturnValue({
        usableCardIds: ['hard_01'],
        usableSlots: [
          { cardId: 'hard_01', handIndex: 1, cardCopyId: 102 }
        ]
      })
    };

    expect(Planner.planCanonicalCpuNetworkCommand({
      playerKey: 'black',
      snapshot: {
        gameState: { currentPlayer: 1, turnNumber: 74 },
        cardState: {
          turnIndex: 74,
          hands: { black: ['hard_01', 'hard_01'], white: [] },
          pendingEffectByPlayer: { black: null, white: null }
        }
      },
      preferredActionType: 'pass',
      preferredAction: { type: 'pass', playerKey: 'black', autoNoActionPass: true },
      CardLogic,
      CoreLogic: { getLegalMoves: jest.fn().mockReturnValue([]) }
    })).toEqual({
      actionType: 'use_card',
      action: {
        type: 'use_card',
        playerKey: 'black',
        useCardId: 'hard_01',
        useCardOwnerKey: 'black',
        useCardHandIndex: 1
      }
    });
  });

  test('keeps a preferred legal move when canonical planning agrees it is playable', () => {
    const moves = [{ row: 2, col: 3 }, { row: 4, col: 5 }];

    expect(Planner.planCanonicalCpuNetworkCommand({
      playerKey: 'black',
      snapshot: {
        gameState: { currentPlayer: 1, turnNumber: 12 },
        cardState: {
          turnIndex: 12,
          hands: { black: [], white: [] },
          pendingEffectByPlayer: { black: null, white: null }
        }
      },
      preferredActionType: 'place',
      preferredAction: { type: 'place', row: 4, col: 5 },
      CardLogic: {
        hasUsableCard: jest.fn().mockReturnValue(false),
        getCardContext: jest.fn().mockReturnValue({})
      },
      CoreLogic: { getLegalMoves: jest.fn().mockReturnValue(moves) }
    })).toEqual({
      actionType: 'place',
      action: { type: 'place', row: 4, col: 5 }
    });
  });

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

  test('prioritizes a CPU-selected card before placing a legal move', () => {
    const input = createInput({
      getLegalMoves: jest.fn().mockReturnValue([{ row: 2, col: 3 }]),
      selectCpuMoveWithPolicy: jest.fn().mockReturnValue({ row: 2, col: 3 }),
      selectCardToUse: jest.fn().mockReturnValue({ cardId: 'work_01' }),
      computeCpuAction: jest.fn().mockReturnValue({ type: 'move', move: { row: 2, col: 3 } }),
      CardLogic: { hasUsableCard: jest.fn().mockReturnValue(true) }
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
    expect(input.selectCpuMoveWithPolicy).not.toHaveBeenCalled();
  });

  test('uses a legal continuation placement instead of a card during sub-placement', () => {
    const isSubPlacementTurnActive = jest.fn().mockReturnValue(true);
    const input = createInput({
      cardState: {
        turnIndex: 10,
        hands: { black: ['work_01'], white: [] },
        pendingEffectByPlayer: { black: null, white: null },
        hasUsedCardThisTurnByPlayer: { black: true, white: false },
        extraPlaceRemainingByPlayer: { black: 1, white: 0 },
        infinitePlaceActiveByPlayer: { black: false, white: false }
      },
      getLegalMoves: jest.fn().mockReturnValue([{ row: 2, col: 3 }]),
      selectCpuMoveWithPolicy: jest.fn().mockReturnValue({ row: 2, col: 3 }),
      selectCardToUse: jest.fn().mockReturnValue({ cardId: 'work_01' }),
      computeCpuAction: jest.fn().mockReturnValue({ type: 'useCard', cardId: 'work_01' }),
      CardLogic: {
        hasUsableCard: jest.fn().mockReturnValue(true),
        getUsableCardIds: jest.fn().mockReturnValue(['work_01'])
      },
      SubPlacementContinuation: {
        isSubPlacementTurnActive
      }
    });

    expect(Planner.planCpuNetworkCommand(input)).toEqual({
      actionType: 'place',
      action: { type: 'place', row: 2, col: 3 }
    });
    expect(input.selectCpuMoveWithPolicy).toHaveBeenCalled();
    expect(input.selectCardToUse).not.toHaveBeenCalled();
    expect(input.computeCpuAction).not.toHaveBeenCalled();
    expect(input.CardLogic.hasUsableCard).not.toHaveBeenCalled();
    expect(isSubPlacementTurnActive).toHaveBeenCalledWith(input.cardState, 'black');
  });

  test('canonical planning ignores a preferred card during pending throw-chain placement', () => {
    const isSubPlacementTurnActive = jest.fn().mockReturnValue(true);
    const CardLogic = {
      hasUsableCard: jest.fn().mockReturnValue(true),
      analyzeCardUsability: jest.fn().mockReturnValue({
        usableCardIds: ['work_01'],
        usableSlots: [{ cardId: 'work_01', handIndex: 0 }]
      }),
      getCardContext: jest.fn().mockReturnValue({})
    };
    const CoreLogic = {
      getLegalMoves: jest.fn().mockReturnValue([{ row: 2, col: 3 }])
    };

    expect(Planner.planCanonicalCpuNetworkCommand({
      playerKey: 'black',
      snapshot: {
        gameState: { currentPlayer: 1, turnNumber: 10 },
        cardState: {
          turnIndex: 10,
          hands: { black: ['work_01'], white: [] },
          pendingEffectByPlayer: {
            black: { type: 'DOUBLE_PLACE', stage: 'awaitPlace' },
            white: null
          },
          hasUsedCardThisTurnByPlayer: { black: true, white: false }
        }
      },
      preferredActionType: 'use_card',
      preferredAction: {
        type: 'use_card',
        playerKey: 'black',
        useCardId: 'work_01',
        useCardOwnerKey: 'black',
        useCardHandIndex: 0
      },
      CardLogic,
      CoreLogic,
      SubPlacementContinuation: {
        isSubPlacementTurnActive
      }
    })).toEqual({
      actionType: 'place',
      action: { type: 'place', row: 2, col: 3 }
    });
    expect(CoreLogic.getLegalMoves).toHaveBeenCalled();
    expect(CardLogic.hasUsableCard).not.toHaveBeenCalled();
    expect(CardLogic.analyzeCardUsability).not.toHaveBeenCalled();
    expect(isSubPlacementTurnActive).toHaveBeenCalledWith(
      expect.objectContaining({
        pendingEffectByPlayer: expect.objectContaining({
          black: expect.objectContaining({ type: 'DOUBLE_PLACE' })
        })
      }),
      'black'
    );
  });

  test('fails closed instead of falling back to a card when continuation state has no legal move', () => {
    const isSubPlacementTurnActive = jest.fn().mockReturnValue(true);
    const input = createInput({
      cardState: {
        turnIndex: 10,
        hands: { black: ['work_01'], white: [] },
        pendingEffectByPlayer: { black: null, white: null },
        hasUsedCardThisTurnByPlayer: { black: true, white: false },
        infinitePlaceActiveByPlayer: { black: true, white: false }
      },
      getLegalMoves: jest.fn().mockReturnValue([]),
      selectCardToUse: jest.fn().mockReturnValue({ cardId: 'work_01' }),
      CardLogic: {
        hasUsableCard: jest.fn().mockReturnValue(true),
        getUsableCardIds: jest.fn().mockReturnValue(['work_01'])
      },
      SubPlacementContinuation: {
        isSubPlacementTurnActive
      }
    });

    expect(Planner.planCpuNetworkCommand(input)).toBeNull();
    expect(input.selectCardToUse).not.toHaveBeenCalled();
    expect(input.CardLogic.hasUsableCard).not.toHaveBeenCalled();
    expect(isSubPlacementTurnActive).toHaveBeenCalled();
  });

  test('does not fallback to the first card while a legal move exists', () => {
    const input = createInput({
      getLegalMoves: jest.fn().mockReturnValue([{ row: 2, col: 3 }]),
      selectCpuMoveWithPolicy: jest.fn().mockReturnValue({ row: 2, col: 3 }),
      selectCardToUse: jest.fn().mockReturnValue(null),
      computeCpuAction: jest.fn().mockReturnValue({ type: 'move', move: { row: 2, col: 3 } }),
      CardLogic: {
        hasUsableCard: jest.fn().mockReturnValue(true),
        getUsableCardIds: jest.fn().mockReturnValue(['work_01'])
      }
    });

    expect(Planner.planCpuNetworkCommand(input)).toEqual({
      actionType: 'place',
      action: { type: 'place', row: 2, col: 3 }
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

  test('preserves board-expansion directionKey in pending AUTO selection', () => {
    const input = createInput({
      cardState: {
        turnIndex: 12,
        pendingEffectByPlayer: {
          black: {
            type: 'BOARD_EXPANSION_WILL',
            stage: 'selectTarget',
            cardId: 'board_expand_01',
            pendingEffectId: 'pending_expand_12_1'
          },
          white: null
        }
      },
      CardLogic: {
        getBoardExpansionTargets: jest.fn().mockReturnValue([
          { row: 0, col: 0, directionKey: 'up' },
          { row: 0, col: 0, directionKey: 'left' }
        ])
      },
      PendingCoordinator: {
        resolvePendingSelectionActionField: jest.fn().mockReturnValue('expansionTarget')
      },
      PendingSelectionRegistry: {
        getPendingSelectionTargetMethod: jest.fn().mockReturnValue('getBoardExpansionTargets')
      }
    });

    expect(Planner.planCpuNetworkCommand(input)).toEqual({
      actionType: 'place',
      action: {
        type: 'place',
        player: 'black',
        row: 0,
        col: 0,
        expansionTarget: { row: 0, col: 0, directionKey: 'up' },
        pendingSelectionState: {
          type: 'BOARD_EXPANSION_WILL',
          stage: 'selectTarget',
          cardId: 'board_expand_01',
          pendingEffectId: 'pending_expand_12_1'
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

  test('cancels a cancellable target selection when no canonical target remains', () => {
    const input = createInput({
      cardState: {
        turnIndex: 21,
        pendingEffectByPlayer: {
          black: {
            type: 'DESTROY_ONE_STONE',
            stage: 'selectTarget',
            cardId: 'destroy_01',
            pendingEffectId: 'pending_21_1'
          },
          white: null
        }
      },
      CardLogic: {
        hasUsableCard: jest.fn().mockReturnValue(false),
        getDestroyTargets: jest.fn().mockReturnValue([])
      },
      PendingCoordinator: {
        resolvePendingSelectionActionField: jest.fn().mockReturnValue('destroyTarget')
      },
      PendingSelectionRegistry: {
        getPendingSelectionTargetMethod: jest.fn().mockReturnValue('getDestroyTargets'),
        getPendingSelectionEntry: jest.fn().mockReturnValue({
          needsTargetSelection: true,
          cancellable: true
        })
      }
    });

    expect(Planner.planCpuNetworkCommand(input)).toEqual({
      actionType: 'cancel_card',
      action: {
        type: 'cancel_card',
        cancelOptions: {
          refundCost: false,
          resetUsage: true
        }
      }
    });
    expect(input.getLegalMoves).not.toHaveBeenCalled();
  });

  test('fails closed when an unresolved target selection cannot be cancelled', () => {
    const input = createInput({
      cardState: {
        turnIndex: 22,
        pendingEffectByPlayer: {
          black: {
            type: 'REVERSE_WILL',
            stage: 'selectTarget',
            cardId: 'reverse_01',
            pendingEffectId: 'pending_22_1'
          },
          white: null
        }
      },
      CardLogic: {
        hasUsableCard: jest.fn().mockReturnValue(false),
        getReverseWillTargets: jest.fn().mockReturnValue([])
      },
      PendingCoordinator: {
        resolvePendingSelectionActionField: jest.fn().mockReturnValue('reverseWillTarget')
      },
      PendingSelectionRegistry: {
        getPendingSelectionTargetMethod: jest.fn().mockReturnValue('getReverseWillTargets'),
        getPendingSelectionEntry: jest.fn().mockReturnValue({
          needsTargetSelection: true,
          cancellable: false
        })
      }
    });

    expect(Planner.planCpuNetworkCommand(input)).toBeNull();
    expect(input.getLegalMoves).not.toHaveBeenCalled();
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
