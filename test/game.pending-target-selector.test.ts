import * as PendingTargetSelector from '../game/turn-handlers/pending-target-selector.js';

describe('pending-target-selector', () => {
  test('choosePendingTargetWithPolicy selects the highest score target', () => {
    const targets = [
      { row: 4, col: 4 },
      { row: 1, col: 6 },
      { row: 2, col: 3 }
    ];

    const selected = PendingTargetSelector.choosePendingTargetWithPolicy({
      targets,
      scoreTarget: (target) => {
        if (target.row === 1 && target.col === 6) return 75;
        if (target.row === 2 && target.col === 3) return 110;
        return 40;
      }
    });

    expect(selected).toEqual({ row: 2, col: 3 });
  });

  test('choosePendingTargetWithPolicy breaks score ties by row then col', () => {
    const targets = [
      { row: 5, col: 5 },
      { row: 2, col: 4 },
      { row: 2, col: 1 }
    ];

    const selected = PendingTargetSelector.choosePendingTargetWithPolicy({
      targets,
      scoreTarget: () => 50
    });

    expect(selected).toEqual({ row: 2, col: 1 });
  });

  test('choosePendingTargetWithPolicy falls back to first valid target when scorer is absent', () => {
    const targets = [
      { row: 3, col: 2 },
      { row: 1, col: 1 }
    ];

    const selected = PendingTargetSelector.choosePendingTargetWithPolicy({ targets });

    expect(selected).toEqual({ row: 3, col: 2 });
  });

  test('buildPendingSelectionAction for HEAVEN_BLESSING prefers retention-heavy future utility card', () => {
    const action = PendingTargetSelector.buildPendingSelectionAction({
      pendingType: 'HEAVEN_BLESSING',
      playerKey: 'white',
      gameState: {},
      rng: () => 0.5,
      cardState: {
        pendingEffectByPlayer: {
          white: { type: 'HEAVEN_BLESSING', stage: 'selectTarget', offers: ['guard_01', 'meteor_01'] }
        }
      },
      cardLogic: {
        getCardCost: (id) => id === 'meteor_01' ? 21 : 2,
        getCardDef: (id) => ({ id, type: id === 'meteor_01' ? 'METEOR_WILL' : 'GUARD_WILL' })
      },
      getLegalMovesForAction: () => [{ row: 0, col: 0 }, { row: 2, col: 3 }],
      buildCardDecisionContext: () => ({ level: 6, playerValue: -1 }),
      cpuPolicyCore: {
        scoreCardUseDecision: (id) => {
          if (id === 'meteor_01') return { score: 20, shouldUse: false };
          return { score: 42, shouldUse: true };
        },
        scoreCardRetentionPriority: (id) => {
          if (id === 'meteor_01') return { score: -10 };
          return { score: 30 };
        }
      }
    });

    expect(action).toEqual({ type: 'place', heavenBlessingCardId: 'guard_01' });
  });

  test('buildPendingSelectionAction for HEAVEN_BLESSING prefers supplied pending over stale cardState', () => {
    const action = PendingTargetSelector.buildPendingSelectionAction({
      pendingType: 'HEAVEN_BLESSING',
      pending: { type: 'HEAVEN_BLESSING', stage: 'selectTarget', offers: ['guard_01', 'meteor_01'] },
      playerKey: 'white',
      gameState: {},
      rng: () => 0.5,
      cardState: {
        pendingEffectByPlayer: {
          white: { type: 'HEAVEN_BLESSING', stage: 'selectTarget', offers: ['stale_01'] }
        }
      },
      cardLogic: {
        getCardCost: (id) => {
          if (id === 'meteor_01') return 21;
          if (id === 'guard_01') return 2;
          return 99;
        },
        getCardDef: (id) => ({ id, type: id === 'meteor_01' ? 'METEOR_WILL' : 'GUARD_WILL' })
      },
      getLegalMovesForAction: () => [{ row: 0, col: 0 }, { row: 2, col: 3 }],
      buildCardDecisionContext: () => ({ level: 6, playerValue: -1 }),
      cpuPolicyCore: {
        scoreCardUseDecision: (id) => {
          if (id === 'meteor_01') return { score: 20, shouldUse: false };
          if (id === 'guard_01') return { score: 42, shouldUse: true };
          return { score: -100, shouldUse: false };
        },
        scoreCardRetentionPriority: (id) => {
          if (id === 'meteor_01') return { score: -10 };
          if (id === 'guard_01') return { score: 30 };
          return { score: -100 };
        }
      }
    });

    expect(action).toEqual({ type: 'place', heavenBlessingCardId: 'guard_01' });
  });

  test('buildPendingSelectionAction can read pending via callback when cardState is stale', () => {
    const readPendingEffect = jest.fn(() => ({
      type: 'CONDEMN_WILL',
      stage: 'selectTarget',
      offers: [
        { handIndex: 1, cardId: 'guard_01' },
        { handIndex: 3, cardId: 'meteor_01' }
      ]
    }));
    const cardState = {
      pendingEffectByPlayer: {
        white: null
      }
    };

    const action = PendingTargetSelector.buildPendingSelectionAction({
      playerKey: 'white',
      gameState: {},
      cardState,
      readPendingEffect,
      cardLogic: {
        getCardCost: (id) => id === 'meteor_01' ? 21 : 2,
        getCardDef: (id) => ({ id, type: id === 'meteor_01' ? 'METEOR_WILL' : 'GUARD_WILL' })
      },
      getLegalMovesForAction: () => [{ row: 1, col: 1 }],
      buildCardDecisionContext: () => ({ level: 6, playerValue: 1 }),
      cpuPolicyCore: {
        scoreCardUseDecision: (id) => {
          if (id === 'meteor_01') return { score: 20, shouldUse: true };
          return { score: 0, shouldUse: false };
        }
      }
    });

    expect(readPendingEffect).toHaveBeenCalledWith(cardState, 'white', expect.any(Object));
    expect(action).toEqual({ type: 'place', condemnTargetIndex: 3 });
  });

  test('buildPendingSelectionAction uses shrinkTarget payload for board shrink cards', () => {
    const action = PendingTargetSelector.buildPendingSelectionAction({
      pendingType: 'BOARD_SHRINK_GOD',
      gameState: {},
      cardState: {},
      playerKey: 'black',
      selectors: {
        chooseBoardShrinkTarget: () => ({ row: 0, col: 1 })
      }
    });

    expect(action).toEqual({
      type: 'place',
      shrinkTarget: { row: 0, col: 1 }
    });
  });

  test('buildPendingSelectionAction uses livingWillTarget payload for living will', () => {
    const action = PendingTargetSelector.buildPendingSelectionAction({
      pendingType: 'LIVING_WILL',
      gameState: {},
      cardState: {},
      playerKey: 'black',
      selectors: {
        chooseLivingWillTarget: () => ({ row: 4, col: 2 })
      }
    });

    expect(action).toEqual({
      type: 'place',
      livingWillTarget: { row: 4, col: 2 }
    });
  });

  test('buildPendingSelectionAction uses freezeTarget payload for freeze cards', () => {
    const action = PendingTargetSelector.buildPendingSelectionAction({
      pendingType: 'FREEZE_WILL',
      gameState: {},
      cardState: {},
      playerKey: 'black',
      selectors: {
        chooseFreezeTarget: () => ({ row: 2, col: 5 })
      }
    });

    expect(action).toEqual({
      type: 'place',
      freezeTarget: { row: 2, col: 5 }
    });
  });
});
