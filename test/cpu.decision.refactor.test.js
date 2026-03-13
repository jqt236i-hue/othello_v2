const path = require('path');
const cpuDecision = require(path.resolve(__dirname, '..', 'game', 'cpu-decision.js'));
const cpuPolicyCore = require(path.resolve(__dirname, '..', 'game', 'ai', 'cpu-policy-core.js'));
const catalog = require(path.resolve(__dirname, '..', 'cards', 'catalog.json'));

describe('cpu decision refactor helpers', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    // reset globals
    global.gameState = {};
    global.cardState = { hands: { white: [] }, pendingEffectByPlayer: { white: null }, hasUsedCardThisTurnByPlayer: { white: false } };
    global.getActiveProtectionForPlayer = () => [];
    global.getLegalMoves = () => [];
    global.cpuSmartness = { white: 1, black: 1 };
    global.BLACK = 1; global.WHITE = -1;
    // spies
    global.emitCardStateChange = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.emitLogAdded = jest.fn();
    delete global.TurnPipeline;
    delete global.TurnPipelineUIAdapter;
    delete global.CpuPolicyTableRuntime;
  });

  test('selectCardToUse returns AISystem suggestion when present', () => {
    global.cardState.hands.white = ['card_a'];
    global.AISystem = { selectCardToUse: () => ({ cardId: 'card_a', cardDef: { name: 'A' } }) };

    const res = cpuDecision.selectCardToUse('white');
    expect(res).toBeDefined();
    expect(res.cardId).toBe('card_a');
  });

  test('selectCardToUse falls back to selectCardFallback when AISystem absent', () => {
    global.AISystem = null;
    // mock CardLogic to allow fallback
    global.CardLogic = {
      canUseCard: () => true,
      getCardDef: (id) => ({ name: id })
    };
    global.cardState.hands.white = ['fallback_card'];
    // force selection by using a deterministic rng
    cpuDecision.setCpuRng({ random: () => 0.0 });

    const res = cpuDecision.selectCardToUse('white');
    expect(res).not.toBeNull();
    expect(res.cardId).toBeDefined();
  });

  test('selectCardToUse catches AISystem exceptions and falls back', () => {
    global.AISystem = { selectCardToUse: () => { throw new Error('boom'); } };
    global.CardLogic = { canUseCard: () => true, getCardDef: id => ({ name: id }) };
    global.cardState.hands.white = ['fallback2'];
    cpuDecision.setCpuRng({ random: () => 0.0 });

    const res = cpuDecision.selectCardToUse('white');
    expect(res).not.toBeNull();
    expect(res.cardId).toBeDefined();
  });

  test('selectCardToUse prefers learned use_card action when score exists', () => {
    global.cardState.hands.white = ['c_low', 'c_high'];
    global.CardLogic = {
      canUseCard: () => true,
      getCardDef: (id) => ({ name: id })
    };
    global.CpuPolicyTableRuntime = {
      getActionScoreForKey: jest.fn((key) => (key === 'use_card:c_high' ? 9999 : null))
    };

    const res = cpuDecision.selectCardToUse('white');
    expect(res).toBeDefined();
    expect(res.cardId).toBe('c_high');
  });

  test('selectCardToUse follows shared Lv6 policy-table core path for risky learned card choice', () => {
    global.gameState = {
      board: [
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, -1, 1, 0, 0, 0],
        [0, 0, 0, 1, -1, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0]
      ],
      currentPlayer: -1
    };
    global.getLegalMoves = () => [
      { row: 0, col: 0, flips: [{ row: 1, col: 1 }] },
      { row: 2, col: 3, flips: [{ row: 3, col: 3 }] }
    ];
    global.cpuSmartness.white = 6;
    global.cardState = {
      hands: { white: ['guard_01', 'time_01'], black: [] },
      pendingEffectByPlayer: { white: null, black: null },
      hasUsedCardThisTurnByPlayer: { white: false, black: false },
      charge: { white: 20, black: 10 },
      boardBonusByCell: {},
      boardBonusConsumedByCell: {}
    };
    global.CardLogic = {
      getUsableCardIds: () => ['guard_01', 'time_01'],
      canUseCard: () => true,
      getCardDef: (id) => {
        if (id === 'guard_01') return { id, name: 'guard', type: 'GUARD_WILL' };
        if (id === 'time_01') return { id, name: 'time', type: 'TIME_BOMB' };
        return { id, name: id, type: 'TREASURE_BOX' };
      },
      getCardCost: (id) => {
        if (id === 'guard_01') return 2;
        if (id === 'time_01') return 10;
        return 1;
      }
    };
    global.CpuPolicyTableRuntime = {
      getActionScoreForKey: jest.fn((key) => (key === 'use_card:time_01' ? 9999 : 0))
    };
    jest.spyOn(cpuPolicyCore, 'scoreCardUseDecision').mockImplementation((cardId) => {
      if (cardId === 'time_01') return { score: 24, shouldUse: false };
      if (cardId === 'guard_01') return { score: 12, shouldUse: true };
      return { score: 0, shouldUse: false };
    });
    jest.spyOn(cpuPolicyCore, 'chooseCardWithRiskProfile').mockImplementation((usable) => {
      expect(usable).toEqual(['guard_01', 'time_01']);
      return { cardId: 'guard_01', cardDef: { id: 'guard_01', name: 'guard', type: 'GUARD_WILL' } };
    });

    const res = cpuDecision.selectCardToUse('white');
    expect(res).toBeDefined();
    expect(res.cardId).toBe('guard_01');
    expect(cpuPolicyCore.scoreCardUseDecision).toHaveBeenCalledWith(
      'time_01',
      global.CardLogic.getCardCost,
      global.CardLogic.getCardDef,
      expect.objectContaining({ level: 6, legalMovesCount: 2 })
    );
    expect(cpuPolicyCore.chooseCardWithRiskProfile).toHaveBeenCalled();
  });

  test('all catalog card types have explicit Lv6 plan pressure profile', () => {
    const types = Array.from(new Set((catalog.cards || []).map((c) => c && c.type).filter(Boolean)));
    const missing = types.filter((type) => !cpuDecision.hasPlanPressureProfileForCardType(type));
    expect(missing).toEqual([]);
  });

  test('selectCardToUse can withhold risky expensive card when already ahead', () => {
    global.gameState = {
      board: [
        [-1, -1, -1, -1, -1, -1, -1, -1],
        [-1, -1, -1, -1, -1, -1, -1, -1],
        [-1, -1, -1, -1, -1, -1, -1, -1],
        [-1, -1, -1, -1, 1, 1, 0, 0],
        [-1, -1, -1, -1, 1, 1, 0, 0],
        [-1, -1, -1, -1, 1, 1, 0, 0],
        [-1, -1, -1, -1, 1, 1, 0, 0],
        [-1, -1, -1, -1, 1, 1, 0, 0]
      ],
      currentPlayer: 'white'
    };
    global.getLegalMoves = () => [{ row: 2, col: 3, flips: [{ row: 2, col: 2 }] }];
    global.cpuSmartness.white = 6;
    global.cardState.hands.white = ['udr'];
    global.cardState.charge = { white: 35, black: 10 };
    global.CardLogic = {
      getUsableCardIds: () => ['udr'],
      getCardDef: () => ({ id: 'udr', name: 'dragon', type: 'ULTIMATE_REVERSE_DRAGON' }),
      getCardCost: () => 30
    };
    global.CpuPolicyTableRuntime = {
      getActionScoreForKey: jest.fn(() => 9999)
    };

    const res = cpuDecision.selectCardToUse('white');
    expect(res).toBeNull();
  });

  test('selectCardToUse shared Lv6 policy-table core can keep recovery card choice when risk score allows it', () => {
    global.gameState = {
      board: [
        [-1, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, -1, 1, 0, 0, 0],
        [0, 0, 0, 1, -1, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, -1]
      ],
      currentPlayer: -1
    };
    global.cpuSmartness.white = 6;
    global.getLegalMoves = () => [{ row: 2, col: 3, flips: [{ row: 3, col: 3 }] }];
    global.cardState.hands.white = ['destroy_01'];
    global.cardState.charge = { white: 30, black: 10 };
    global.CardLogic = {
      getUsableCardIds: () => ['destroy_01'],
      getCardDef: () => ({ id: 'destroy_01', name: '破壊神', type: 'DESTROY_ONE_STONE' }),
      getCardCost: () => 14
    };
    global.CpuPolicyTableRuntime = {
      getActionScoreForKey: jest.fn(() => 9999)
    };

    const res = cpuDecision.selectCardToUse('white');
    expect(res).toBeDefined();
    expect(res.cardId).toBe('destroy_01');
  });

  test('selectCardToUse uses corner hold card when corner move exists', () => {
    global.gameState = {
      board: [
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, -1, 1, 0, 0, 0],
        [0, 0, 0, 1, -1, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0]
      ],
      currentPlayer: -1
    };
    global.cpuSmartness.white = 6;
    global.getLegalMoves = () => [
      { row: 0, col: 0, flips: [{ row: 1, col: 1 }] },
      { row: 2, col: 3, flips: [{ row: 3, col: 3 }] }
    ];
    global.cardState.hands.white = ['guard_01'];
    global.cardState.charge = { white: 10, black: 10 };
    global.CardLogic = {
      getUsableCardIds: () => ['guard_01'],
      getCardDef: () => ({ id: 'guard_01', name: '守る意志', type: 'GUARD_WILL' }),
      getCardCost: () => 2
    };

    const res = cpuDecision.selectCardToUse('white');
    expect(res).toBeDefined();
    expect(res.cardId).toBe('guard_01');
  });

  test('cpuSelectHeavenBlessingWithPolicy prefers future-utility card over merely expensive volatile card', async () => {
    global.gameState = {
      board: [
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, -1, 1, 0, 0, 0],
        [0, 0, 0, 1, -1, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0]
      ],
      currentPlayer: -1
    };
    global.cpuSmartness.white = 6;
    global.getLegalMoves = () => [
      { row: 0, col: 0, flips: [{ row: 1, col: 1 }] },
      { row: 2, col: 3, flips: [{ row: 3, col: 3 }] }
    ];
    global.cardState = {
      hands: { white: ['heaven_01'], black: [] },
      pendingEffectByPlayer: { white: { type: 'HEAVEN_BLESSING', stage: 'selectTarget', offers: ['guard_01', 'meteor_01'] }, black: null },
      hasUsedCardThisTurnByPlayer: { white: false, black: false },
      charge: { white: 18, black: 10 },
      boardBonusByCell: {},
      boardBonusConsumedByCell: {}
    };
    global.CardLogic = {
      getCardDef: (id) => {
        if (id === 'guard_01') return { id, type: 'GUARD_WILL' };
        if (id === 'meteor_01') return { id, type: 'METEOR_WILL' };
        return { id, type: 'HEAVEN_BLESSING' };
      },
      getCardCost: (id) => {
        if (id === 'guard_01') return 2;
        if (id === 'meteor_01') return 21;
        return 3;
      },
      applyHeavenBlessingChoice: jest.fn(() => ({ applied: true }))
    };
    global.TurnPipeline = {};
    global.TurnPipelineUIAdapter = {
      runTurnWithAdapter: jest.fn(() => ({
        ok: true,
        nextCardState: {
          ...global.cardState,
          pendingEffectByPlayer: { ...global.cardState.pendingEffectByPlayer, white: null }
        },
        nextGameState: global.gameState,
        playbackEvents: []
      }))
    };

    await cpuDecision.cpuSelectHeavenBlessingWithPolicy('white');

    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalled();
    const action = global.TurnPipelineUIAdapter.runTurnWithAdapter.mock.calls[0][3];
    expect(action.heavenBlessingCardId).toBe('guard_01');
    expect(global.CardLogic.applyHeavenBlessingChoice).not.toHaveBeenCalled();
  });

  test('cpuSelectCondemnWillWithPolicy removes opponent corner-hold card before volatile expensive card', async () => {
    global.gameState = {
      board: [
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, -1, 1, 0, 0, 0],
        [0, 0, 0, 1, -1, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0]
      ],
      currentPlayer: -1
    };
    global.cpuSmartness.white = 6;
    global.getLegalMoves = () => [
      { row: 0, col: 0, flips: [{ row: 1, col: 1 }] },
      { row: 2, col: 3, flips: [{ row: 3, col: 3 }] }
    ];
    global.cardState = {
      hands: { white: ['condemn_01'], black: ['guard_01', 'meteor_01'] },
      pendingEffectByPlayer: {
        white: {
          type: 'CONDEMN_WILL',
          stage: 'selectTarget',
          offers: [
            { handIndex: 0, cardId: 'guard_01' },
            { handIndex: 1, cardId: 'meteor_01' }
          ]
        },
        black: null
      },
      hasUsedCardThisTurnByPlayer: { white: false, black: false },
      charge: { white: 18, black: 24 },
      boardBonusByCell: {},
      boardBonusConsumedByCell: {}
    };
    global.CardLogic = {
      getCardDef: (id) => {
        if (id === 'guard_01') return { id, type: 'GUARD_WILL' };
        if (id === 'meteor_01') return { id, type: 'METEOR_WILL' };
        return { id, type: 'CONDEMN_WILL' };
      },
      getCardCost: (id) => {
        if (id === 'guard_01') return 2;
        if (id === 'meteor_01') return 21;
        return 6;
      },
      applyCondemnWill: jest.fn(() => ({ applied: true }))
    };
    global.TurnPipeline = {};
    global.TurnPipelineUIAdapter = {
      runTurnWithAdapter: jest.fn(() => ({
        ok: true,
        nextCardState: {
          ...global.cardState,
          pendingEffectByPlayer: { ...global.cardState.pendingEffectByPlayer, white: null }
        },
        nextGameState: global.gameState,
        playbackEvents: []
      }))
    };

    await cpuDecision.cpuSelectCondemnWillWithPolicy('white');

    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalled();
    const action = global.TurnPipelineUIAdapter.runTurnWithAdapter.mock.calls[0][3];
    expect(action.condemnTargetIndex).toBe(0);
    expect(global.CardLogic.applyCondemnWill).not.toHaveBeenCalled();
  });

  test('Lv6 white relaxes high-confidence gate under hand and mobility pressure', () => {
    const scoreSpy = jest.spyOn(cpuPolicyCore, 'scoreCardUseDecision').mockReturnValue({
      score: 16,
      minUseScore: 12,
      shouldUse: true
    });
    global.CardLogic = {
      getCardDef: () => ({ id: 'treasure_01', type: 'TREASURE_BOX' }),
      getCardCost: () => 6
    };

    const allowed = cpuDecision.isCardChoiceAllowedByHighConfidence('white', 6, 2, 'treasure_01', {
      forceUseCard: false,
      cornerEmergency: false,
      discDiff: 2,
      handSize: 5,
      ownCharge: 40,
      legalMovesCount: 2,
      lowDiscEmergency: false,
      whiteLv6Mode: true,
      hasCornerMoveNow: false,
      highBonusMoveAvailable: false
    });

    expect(allowed).toBe(true);
    scoreSpy.mockRestore();
  });

  test('selectCardFromOnnxPolicyAsync returns onnx-picked card when available', async () => {
    global.cardState.hands.white = ['c_low', 'c_high'];
    global.CardLogic = {
      getCardDef: (id) => ({ name: id })
    };
    global.CpuPolicyOnnxRuntime = {
      chooseCard: jest.fn(async () => 'c_high')
    };

    const res = await cpuDecision.selectCardFromOnnxPolicyAsync('white', 6, 0, ['c_low', 'c_high']);
    expect(res).toBeDefined();
    expect(res.cardId).toBe('c_high');
    expect(global.CpuPolicyOnnxRuntime.chooseCard).toHaveBeenCalled();
  });

  test('selectCardFromOnnxPolicyAsync returns hold marker when onnx decides no-card', async () => {
    global.cardState.hands.white = ['c_low', 'c_high'];
    global.CardLogic = {
      getCardDef: (id) => ({ name: id })
    };
    global.CpuPolicyOnnxRuntime = {
      chooseCard: jest.fn(async () => null),
      getStatus: jest.fn(() => ({
        loaded: true,
        hasCardHead: true,
        noCardSupported: true,
        lastError: null
      }))
    };

    const res = await cpuDecision.selectCardFromOnnxPolicyAsync('white', 6, 4, ['c_low', 'c_high']);
    expect(res).toEqual({ hold: true });
  });

  test('selectCardFromOnnxPolicyAsync reranks risky ONNX card at Lv6', async () => {
    global.gameState = {
      board: [
        [0, 1, 1, 1, 1, 1, 1, 0],
        [1, -1, -1, -1, -1, -1, -1, 1],
        [1, -1, -1, -1, -1, -1, -1, 1],
        [1, -1, -1, -1, 1, 1, -1, 1],
        [1, -1, -1, 1, -1, 1, -1, 1],
        [1, -1, -1, -1, -1, -1, -1, 1],
        [1, -1, -1, -1, -1, -1, -1, 1],
        [0, 1, 1, 1, 1, 1, 1, 0]
      ],
      currentPlayer: -1
    };
    global.cardState = {
      hands: { white: ['guard_01', 'time_01'], black: [] },
      pendingEffectByPlayer: { white: null, black: null },
      hasUsedCardThisTurnByPlayer: { white: false, black: false },
      charge: { white: 20, black: 10 },
      boardBonusByCell: {},
      boardBonusConsumedByCell: {}
    };
    global.CardLogic = {
      getCardDef: (id) => {
        if (id === 'guard_01') return { id, name: 'guard', type: 'GUARD_WILL' };
        if (id === 'time_01') return { id, name: 'time', type: 'TIME_BOMB' };
        return { id, name: id, type: 'TREASURE_BOX' };
      },
      getCardCost: (id) => {
        if (id === 'guard_01') return 2;
        if (id === 'time_01') return 10;
        return 1;
      }
    };
    global.CpuPolicyOnnxRuntime = {
      chooseCard: jest.fn(async () => 'time_01')
    };

    const legalMoves = [
      { row: 0, col: 0, flips: [{ row: 1, col: 1 }] },
      { row: 2, col: 3, flips: [{ row: 3, col: 3 }] }
    ];
    const res = await cpuDecision.selectCardFromOnnxPolicyAsync('white', 6, legalMoves.length, ['guard_01', 'time_01'], legalMoves);
    expect(res).toBeDefined();
    expect(res.cardId).toBe('guard_01');
  });

  test('selectMoveFromOnnxPolicyAsync applies tactical correction for risky non-corner move at Lv6', async () => {
    const candidates = [
      { row: 2, col: 3, flips: [{ row: 3, col: 3 }] },
      { row: 0, col: 0, flips: [{ row: 1, col: 1 }] }
    ];
    global.gameState = {
      board: [
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, -1, 1, 0, 0, 0],
        [0, 0, 0, 1, -1, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0]
      ],
      currentPlayer: -1
    };
    global.cardState = {
      hands: { white: [], black: [] },
      pendingEffectByPlayer: { white: null, black: null },
      hasUsedCardThisTurnByPlayer: { white: false, black: false },
      charge: { white: 0, black: 0 },
      boardBonusByCell: {},
      boardBonusConsumedByCell: {}
    };
    global.CpuPolicyOnnxRuntime = {
      chooseMove: jest.fn(async () => candidates[0])
    };

    const move = await cpuDecision.selectMoveFromOnnxPolicyAsync(candidates, 'white', 6);
    expect(move).toBe(candidates[1]);
  });

  test('selectMoveFromOnnxPolicyAsync keeps ONNX move at Lv5 (no tactical correction)', async () => {
    const candidates = [
      { row: 2, col: 3, flips: [{ row: 3, col: 3 }] },
      { row: 0, col: 0, flips: [{ row: 1, col: 1 }] }
    ];
    global.gameState = {
      board: [
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, -1, 1, 0, 0, 0],
        [0, 0, 0, 1, -1, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0]
      ],
      currentPlayer: -1
    };
    global.cardState = {
      hands: { white: [], black: [] },
      pendingEffectByPlayer: { white: null, black: null },
      hasUsedCardThisTurnByPlayer: { white: false, black: false },
      charge: { white: 0, black: 0 },
      boardBonusByCell: {},
      boardBonusConsumedByCell: {}
    };
    global.CpuPolicyOnnxRuntime = {
      chooseMove: jest.fn(async () => candidates[0])
    };

    const move = await cpuDecision.selectMoveFromOnnxPolicyAsync(candidates, 'white', 5);
    expect(move).toBe(candidates[0]);
  });

  test('selectCpuMoveWithPolicy falls back to random when AISystem.selectMove throws', () => {
    // deterministic random to pick first candidate
    cpuDecision.setCpuRng({ random: () => 0.0 });
    const candidates = [{row:0,col:0,flips:[]}, {row:1,col:1,flips:[]}];
    global.AISystem = { selectMove: () => { throw new Error('crash'); } };

    const move = cpuDecision.selectCpuMoveWithPolicy(candidates, 'white');
    expect(move).toBeDefined();
    // With rng=0.0, random-based fallback returns index 0
    expect(move.row).toBe(0);
  });

  test('selectCpuMoveWithPolicy prefers policy-table runtime move when available', () => {
    const candidates = [{ row: 0, col: 0, flips: [] }, { row: 1, col: 1, flips: [] }];
    global.gameState = { board: [[0, 0], [0, 0]] };
    global.cpuSmartness.white = 6;
    global.CpuPolicyTableRuntime = {
      chooseMove: jest.fn(() => candidates[1])
    };

    const move = cpuDecision.selectCpuMoveWithPolicy(candidates, 'white');
    expect(move).toBe(candidates[1]);
    expect(global.CpuPolicyTableRuntime.chooseMove).toHaveBeenCalled();
  });

  test('selectCpuMoveWithPolicy prefers corner plan even when learned score favors inner move', () => {
    const candidates = [
      { row: 2, col: 3, flips: [{ row: 3, col: 3 }] },
      { row: 0, col: 0, flips: [{ row: 1, col: 1 }] }
    ];
    global.gameState = {
      board: [
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, -1, 1, 0, 0, 0],
        [0, 0, 0, 1, -1, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0]
      ],
      currentPlayer: -1
    };
    global.cpuSmartness.white = 6;
    global.cardState = {
      hands: { white: [], black: [] },
      pendingEffectByPlayer: { white: null, black: null },
      hasUsedCardThisTurnByPlayer: { white: false, black: false },
      charge: { white: 0, black: 0 },
      boardBonusByCell: {},
      boardBonusConsumedByCell: {}
    };
    global.AISystem = {
      selectMove: (_gs, _cs, moves) => moves[0]
    };
    global.CpuPolicyTableRuntime = {
      chooseMove: jest.fn(() => candidates[0]),
      getActionScore: jest.fn((move) => (move.row === 2 && move.col === 3 ? 9999 : 0))
    };

    const move = cpuDecision.selectCpuMoveWithPolicy(candidates, 'white');
    expect(move).toBe(candidates[1]);
  });

  test('selectCpuMoveWithPolicy prioritizes corner during LAST_RESORT pending placement', () => {
    const candidates = [
      { row: 3, col: 3, flips: [{ row: 3, col: 4 }] },
      { row: 0, col: 0, flips: [] }
    ];
    global.gameState = {
      board: [
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, -1, 1, 0, 0, 0],
        [0, 0, 0, 1, -1, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0]
      ],
      currentPlayer: -1
    };
    global.cpuSmartness.white = 6;
    global.cardState = {
      hands: { white: [], black: [] },
      pendingEffectByPlayer: { white: { type: 'LAST_RESORT', stage: 'awaitPlace', placementsRemaining: 2 }, black: null },
      hasUsedCardThisTurnByPlayer: { white: true, black: false },
      charge: { white: 40, black: 12 },
      boardBonusByCell: { '3,3': 7 },
      boardBonusConsumedByCell: {}
    };

    const move = cpuDecision.selectCpuMoveWithPolicy(candidates, 'white');
    expect(move).toBe(candidates[1]);
  });

  test('selectCpuMoveWithPolicy avoids unsafe X-square in FREE_PLACEMENT pending placement', () => {
    const candidates = [
      { row: 1, col: 1, flips: [] },
      { row: 0, col: 3, flips: [] }
    ];
    global.gameState = {
      board: [
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, -1, 1, 0, 0, 0],
        [0, 0, 0, 1, -1, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0]
      ],
      currentPlayer: -1
    };
    global.cpuSmartness.white = 6;
    global.cardState = {
      hands: { white: [], black: [] },
      pendingEffectByPlayer: { white: { type: 'FREE_PLACEMENT', stage: 'awaitPlace' }, black: null },
      hasUsedCardThisTurnByPlayer: { white: true, black: false },
      charge: { white: 20, black: 12 },
      boardBonusByCell: {},
      boardBonusConsumedByCell: {}
    };

    const move = cpuDecision.selectCpuMoveWithPolicy(candidates, 'white');
    expect(move).toBe(candidates[1]);
  });

  test('selectCpuMoveWithPolicy uses stable edge for WORK_WILL instead of flashy inner seat', () => {
    const candidates = [
      { row: 0, col: 3, flips: [{ row: 1, col: 3 }] },
      { row: 2, col: 4, flips: [{ row: 2, col: 3 }, { row: 3, col: 3 }, { row: 3, col: 4 }] }
    ];
    global.gameState = {
      board: [
        [-1, 0, 0, 0, 0, 0, 0, -1],
        [0, 0, 0, 1, 0, 0, 0, 0],
        [0, 0, 0, 1, 0, 0, 0, 0],
        [0, 0, 0, -1, 1, 0, 0, 0],
        [0, 0, 0, 1, -1, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [1, 0, 0, 0, 0, 0, 0, 1]
      ],
      currentPlayer: -1
    };
    global.cpuSmartness.white = 6;
    global.cardState = {
      hands: { white: [], black: [] },
      pendingEffectByPlayer: { white: { type: 'WORK_WILL', stage: 'awaitPlace' }, black: null },
      hasUsedCardThisTurnByPlayer: { white: true, black: false },
      charge: { white: 20, black: 10 },
      boardBonusByCell: { '2,4': 6 },
      boardBonusConsumedByCell: {}
    };

    const move = cpuDecision.selectCpuMoveWithPolicy(candidates, 'white');
    expect(move).toBe(candidates[0]);
  });

  test('selectCpuMoveWithPolicy uses stable edge for OBSERVER_WILL instead of vulnerable inner seat', () => {
    const candidates = [
      { row: 0, col: 3, flips: [{ row: 1, col: 3 }] },
      { row: 2, col: 4, flips: [{ row: 2, col: 3 }, { row: 3, col: 3 }, { row: 3, col: 4 }] }
    ];
    global.gameState = {
      board: [
        [-1, 0, 0, 0, 0, 0, 0, -1],
        [0, 0, 0, 1, 0, 0, 0, 0],
        [0, 0, 0, 1, 0, 0, 0, 0],
        [0, 0, 0, -1, 1, 0, 0, 0],
        [0, 0, 0, 1, -1, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [1, 0, 0, 0, 0, 0, 0, 1]
      ],
      currentPlayer: -1
    };
    global.cpuSmartness.white = 6;
    global.cardState = {
      hands: { white: [], black: [] },
      pendingEffectByPlayer: { white: { type: 'OBSERVER_WILL', stage: 'awaitPlace' }, black: null },
      hasUsedCardThisTurnByPlayer: { white: true, black: false },
      charge: { white: 20, black: 10 },
      boardBonusByCell: { '2,4': 6 },
      boardBonusConsumedByCell: {}
    };

    const move = cpuDecision.selectCpuMoveWithPolicy(candidates, 'white');
    expect(move).toBe(candidates[0]);
  });

  test('selectCpuMoveWithPolicy still prefers stable edge for GOLD_STONE pending move', () => {
    const candidates = [
      { row: 0, col: 3, flips: [{ row: 1, col: 3 }] },
      { row: 2, col: 4, flips: [{ row: 2, col: 3 }, { row: 3, col: 3 }, { row: 3, col: 4 }] }
    ];
    global.gameState = {
      board: [
        [-1, 0, 0, 0, 0, 0, 0, -1],
        [0, 0, 0, 1, 0, 0, 0, 0],
        [0, 0, 0, 1, 0, 0, 0, 0],
        [0, 0, 0, -1, 1, 0, 0, 0],
        [0, 0, 0, 1, -1, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [1, 0, 0, 0, 0, 0, 0, 1]
      ],
      currentPlayer: -1
    };
    global.cpuSmartness.white = 6;
    global.cardState = {
      hands: { white: [], black: [] },
      pendingEffectByPlayer: { white: { type: 'GOLD_STONE', stage: 'awaitPlace' }, black: null },
      hasUsedCardThisTurnByPlayer: { white: true, black: false },
      charge: { white: 20, black: 10 },
      boardBonusByCell: { '2,4': 6 },
      boardBonusConsumedByCell: {}
    };

    const move = cpuDecision.selectCpuMoveWithPolicy(candidates, 'white');
    expect(move).toBe(candidates[0]);
  });

  test('selectCpuMoveWithPolicy prefers edge stability over open inner seat for BREEDING_WILL pending move', () => {
    const candidates = [
      { row: 0, col: 5, flips: [{ row: 1, col: 5 }] },
      { row: 5, col: 3, flips: [{ row: 4, col: 3 }] }
    ];
    global.gameState = {
      board: [
        [-1, 0, 0, 0, 1, 0, 1, -1],
        [0, 0, 0, 1, 1, 1, 1, 0],
        [0, 0, 0, 1, 0, 0, 0, 0],
        [0, 0, 0, -1, 1, 0, 0, 0],
        [0, 0, 0, 1, -1, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [1, 0, 0, 0, 0, 0, 0, 1]
      ],
      currentPlayer: -1
    };
    global.cpuSmartness.white = 6;
    global.cardState = {
      hands: { white: [], black: [] },
      pendingEffectByPlayer: { white: { type: 'BREEDING_WILL', stage: 'awaitPlace' }, black: null },
      hasUsedCardThisTurnByPlayer: { white: true, black: false },
      charge: { white: 20, black: 10 },
      boardBonusByCell: {},
      boardBonusConsumedByCell: {}
    };

    const move = cpuDecision.selectCpuMoveWithPolicy(candidates, 'white');
    expect(move).toBe(candidates[0]);
  });

  test('applyCardChoice uses pipeline result and updates logs', () => {
    global.CardLogic = { applyCardUsage: jest.fn(() => true) };
    global.cardState.hands.white = ['c1'];
    global.TurnPipeline = {};
    global.TurnPipelineUIAdapter = {
      runTurnWithAdapter: jest.fn(() => ({
        ok: true,
        nextCardState: {
          ...global.cardState,
          hands: { ...global.cardState.hands, white: [] },
          hasUsedCardThisTurnByPlayer: { ...global.cardState.hasUsedCardThisTurnByPlayer, white: true }
        },
        nextGameState: global.gameState,
        playbackEvents: []
      }))
    };

    const ok = cpuDecision.applyCardChoice('white', { cardId: 'c1', cardDef: { name: 'C1' } });
    expect(ok).toBe(true);
    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalled();
    expect(CardLogic.applyCardUsage).not.toHaveBeenCalled();
    expect(emitLogAdded).toHaveBeenCalled();
  });

  test('cpuMaybeUseCardWithPolicy returns true when a card applied', () => {
    global.CardLogic = { applyCardUsage: jest.fn(() => true), canUseCard: () => true, getCardDef: (id) => ({ name: id }) };
    global.cardState.hands.white = ['c2'];
    global.TurnPipeline = {};
    global.TurnPipelineUIAdapter = {
      runTurnWithAdapter: jest.fn(() => ({
        ok: true,
        nextCardState: {
          ...global.cardState,
          hands: { ...global.cardState.hands, white: [] },
          hasUsedCardThisTurnByPlayer: { ...global.cardState.hasUsedCardThisTurnByPlayer, white: true }
        },
        nextGameState: global.gameState,
        playbackEvents: []
      }))
    };
    // ensure AISystem returns our card
    global.AISystem = { selectCardToUse: () => ({ cardId: 'c2', cardDef: { name: 'C2' } }) };

    const applied = cpuDecision.cpuMaybeUseCardWithPolicy('white');
    expect(applied).toBe(true);
  });

  test('cpuMaybeDestroyHandCardWithPolicy destroys expendable card when cycling is needed', () => {
    global.gameState = {
      board: [
        [1, 0, 0, 0, 0, 0, 0, -1],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, -1, 1, 0, 0, 0],
        [0, 0, 0, 1, -1, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0]
      ],
      currentPlayer: -1
    };
    global.cardState = {
      hands: { white: ['sacrifice_01', 'silver_stone', 'chain_01', 'gold_stone'], black: [] },
      pendingEffectByPlayer: { white: null, black: null },
      hasUsedCardThisTurnByPlayer: { white: false, black: false },
      hasDestroyedCardThisTurnByPlayer: { white: false, black: false },
      charge: { white: 10, black: 10 },
      turnIndex: 10
    };
    global.cpuSmartness.white = 6;
    global.getLegalMoves = () => [{ row: 2, col: 3, flips: [{ row: 3, col: 3 }] }];
    global.CardLogic = {
      getUsableCardIds: () => [],
      getCardDef: (id) => ({
        id,
        name: id,
        type: id === 'sacrifice_01'
          ? 'SACRIFICE_WILL'
          : (id === 'chain_01' ? 'CHAIN_WILL' : (id === 'gold_stone' ? 'GOLD_STONE' : 'SILVER_STONE'))
      }),
      getCardCost: (id) => (id === 'chain_01' ? 10 : (id === 'gold_stone' ? 6 : 5)),
      destroyHandCard: jest.fn()
    };
    global.TurnPipeline = {};
    global.TurnPipelineUIAdapter = {
      runTurnWithAdapter: jest.fn((_cs, _gs, _p, action) => {
        if (action.type !== 'destroy_hand_card') return { ok: false };
        return {
          ok: true,
          nextCardState: {
            ...global.cardState,
            hands: { ...global.cardState.hands, white: ['silver_stone', 'chain_01', 'gold_stone'] },
            hasDestroyedCardThisTurnByPlayer: { ...global.cardState.hasDestroyedCardThisTurnByPlayer, white: true }
          },
          nextGameState: global.gameState,
          playbackEvents: []
        };
      })
    };

    const destroyed = cpuDecision.cpuMaybeDestroyHandCardWithPolicy('white');
    expect(destroyed).toBe(true);
    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalled();
    const action = global.TurnPipelineUIAdapter.runTurnWithAdapter.mock.calls[0][3];
    expect(action.type).toBe('destroy_hand_card');
  });

  test('cpuMaybeUseCardWithPolicy is defensive when cardState is missing', () => {
    // remove/omit cardState
    delete global.cardState;
    const applied = cpuDecision.cpuMaybeUseCardWithPolicy('white');
    expect(applied).toBe(false);
  });

  test('cpuMaybeUseCardWithPolicy tries other usable cards when first apply fails', () => {
    // two cards: first pipeline use is rejected, second is accepted
    global.cardState = { hands: { white: ['first', 'second'] }, pendingEffectByPlayer: { white: null }, hasUsedCardThisTurnByPlayer: { white: false } };
    global.CardLogic = { applyCardUsage: jest.fn(), canUseCard: () => true, getCardDef: (id) => ({ name: id }) };
    global.TurnPipeline = {};
    global.TurnPipelineUIAdapter = {
      runTurnWithAdapter: jest.fn((_cs, _gs, _p, action) => {
        if (action && action.useCardId === 'first') return { ok: false };
        return {
          ok: true,
          nextCardState: {
            ...global.cardState,
            hands: { ...global.cardState.hands, white: ['first'] },
            hasUsedCardThisTurnByPlayer: { ...global.cardState.hasUsedCardThisTurnByPlayer, white: true }
          },
          nextGameState: global.gameState,
          playbackEvents: []
        };
      })
    };
    // AISystem suggests 'first'
    global.AISystem = { selectCardToUse: () => ({ cardId: 'first', cardDef: { name: 'first' } }) };

    const applied = cpuDecision.cpuMaybeUseCardWithPolicy('white');
    expect(applied).toBe(true);
    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalledTimes(2);
    expect(global.CardLogic.applyCardUsage).not.toHaveBeenCalled();
  });

  test('cpuMaybeUseCardWithPolicy returns false when player already used card this turn', () => {
    global.cardState.hasUsedCardThisTurnByPlayer.white = true;
    const applied = cpuDecision.cpuMaybeUseCardWithPolicy('white');
    expect(applied).toBe(false);
  });

  test('cpuSelectSwapWithEnemyWithPolicy prefers pipeline adapter path', async () => {
    global.cardState.pendingEffectByPlayer.white = { type: 'SWAP_WITH_ENEMY', stage: 'selectTarget' };
    global.CardLogic = {
      getSelectableTargets: () => [{ row: 2, col: 3 }],
      applySwapEffect: jest.fn(() => true)
    };
    global.TurnPipeline = {};
    global.TurnPipelineUIAdapter = {
      runTurnWithAdapter: jest.fn(() => ({
        ok: true,
        nextCardState: {
          ...global.cardState,
          pendingEffectByPlayer: { ...global.cardState.pendingEffectByPlayer, white: null }
        },
        nextGameState: global.gameState,
        playbackEvents: [{ type: 'dummy' }]
      }))
    };
    global.emitGameStateChange = jest.fn();

    await cpuDecision.cpuSelectSwapWithEnemyWithPolicy('white');

    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalled();
    expect(global.CardLogic.applySwapEffect).not.toHaveBeenCalled();
    expect(global.emitCardStateChange).toHaveBeenCalled();
    expect(global.emitBoardUpdate).toHaveBeenCalled();
    expect(global.emitGameStateChange).toHaveBeenCalled();
  });

  test('cpuSelectSwapWithEnemyWithPolicy prefers opponent corner target', async () => {
    global.gameState = {
      board: [
        [1, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 1, 0, 0, 0, 0],
        [0, 0, 0, 0, -1, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, -1]
      ],
      currentPlayer: -1
    };
    global.cardState.pendingEffectByPlayer.white = { type: 'SWAP_WITH_ENEMY', stage: 'selectTarget' };
    global.CardLogic = {
      getSelectableTargets: () => [{ row: 3, col: 3 }, { row: 0, col: 0 }],
      applySwapEffect: jest.fn(() => true)
    };
    global.TurnPipeline = {};
    global.TurnPipelineUIAdapter = {
      runTurnWithAdapter: jest.fn(() => ({
        ok: true,
        nextCardState: {
          ...global.cardState,
          pendingEffectByPlayer: { ...global.cardState.pendingEffectByPlayer, white: null }
        },
        nextGameState: global.gameState,
        playbackEvents: []
      }))
    };

    await cpuDecision.cpuSelectSwapWithEnemyWithPolicy('white');

    const action = global.TurnPipelineUIAdapter.runTurnWithAdapter.mock.calls[0][3];
    expect(action.swapTarget).toEqual({ row: 0, col: 0 });
  });

  test('cpuSelectGuardWillWithPolicy prefers guarding valuable timed special stone over corner', async () => {
    global.gameState = {
      board: [
        [-1, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, -1, 0, 0, 0, 0],
        [0, 0, 0, 0, 1, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 1]
      ],
      currentPlayer: -1
    };
    global.cardState.markers = [
      {
        kind: 'specialStone',
        owner: 'white',
        row: 3,
        col: 3,
        data: { type: 'ROBOT_VACUUM_WILL', remainingOwnerTurns: 4 }
      }
    ];
    global.cardState.pendingEffectByPlayer.white = { type: 'GUARD_WILL', stage: 'selectTarget' };
    global.CardLogic = {
      getSelectableTargets: () => [{ row: 3, col: 3 }, { row: 0, col: 0 }],
      applyGuardWill: jest.fn(() => ({ applied: true }))
    };
    global.TurnPipeline = {};
    global.TurnPipelineUIAdapter = {
      runTurnWithAdapter: jest.fn(() => ({
        ok: true,
        nextCardState: {
          ...global.cardState,
          pendingEffectByPlayer: { ...global.cardState.pendingEffectByPlayer, white: null }
        },
        nextGameState: global.gameState,
        playbackEvents: []
      }))
    };

    await cpuDecision.cpuSelectGuardWillWithPolicy('white');

    const action = global.TurnPipelineUIAdapter.runTurnWithAdapter.mock.calls[0][3];
    expect(action.guardTarget).toEqual({ row: 3, col: 3 });
  });

  test('cpuSelectTeleportWillWithPolicy prefers enemy corner target', async () => {
    global.gameState = {
      board: [
        [1, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 1, 0, 0, 0, 0],
        [0, 0, 0, 0, -1, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, -1]
      ],
      currentPlayer: -1
    };
    global.cardState.pendingEffectByPlayer.white = { type: 'TELEPORT_WILL', stage: 'selectTarget' };
    global.CardLogic = {
      getSelectableTargets: () => [{ row: 3, col: 3 }, { row: 0, col: 0 }],
      applyTeleportWill: jest.fn(() => ({ applied: true }))
    };
    global.TurnPipeline = {};
    global.TurnPipelineUIAdapter = {
      runTurnWithAdapter: jest.fn(() => ({
        ok: true,
        nextCardState: {
          ...global.cardState,
          pendingEffectByPlayer: { ...global.cardState.pendingEffectByPlayer, white: null }
        },
        nextGameState: global.gameState,
        playbackEvents: []
      }))
    };

    await cpuDecision.cpuSelectTeleportWillWithPolicy('white');

    const action = global.TurnPipelineUIAdapter.runTurnWithAdapter.mock.calls[0][3];
    expect(action.teleportTarget).toEqual({ row: 0, col: 0 });
  });

  test('cpuSelectSuperBuoyancyWillWithPolicy prefers edge stone that can be forced into corner lane', async () => {
    global.gameState = {
      board: [
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [-1, 0, 0, -1, 0, 0, 0, 0],
        [0, 0, 0, 0, 1, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 1]
      ],
      currentPlayer: -1
    };
    global.cardState.pendingEffectByPlayer.white = { type: 'SUPER_BUOYANCY_WILL', stage: 'selectTarget' };
    global.CardLogic = {
      getSelectableTargets: () => [{ row: 3, col: 3 }, { row: 3, col: 0 }],
      applySuperBuoyancyWill: jest.fn(() => ({ applied: true }))
    };
    global.TurnPipeline = {};
    global.TurnPipelineUIAdapter = {
      runTurnWithAdapter: jest.fn(() => ({
        ok: true,
        nextCardState: {
          ...global.cardState,
          pendingEffectByPlayer: { ...global.cardState.pendingEffectByPlayer, white: null }
        },
        nextGameState: global.gameState,
        playbackEvents: []
      }))
    };

    await cpuDecision.cpuSelectSuperBuoyancyWillWithPolicy('white');

    const action = global.TurnPipelineUIAdapter.runTurnWithAdapter.mock.calls[0][3];
    expect(action.superBuoyancyTarget).toEqual({ row: 3, col: 0 });
  });

  test('cpuSelectSuperGravityWillWithPolicy prefers edge stone that can be forced into corner lane', async () => {
    global.gameState = {
      board: [
        [-1, 0, 0, 0, 0, 0, 0, 1],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, -1, 0, 0, -1],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0]
      ],
      currentPlayer: -1
    };
    global.cardState.pendingEffectByPlayer.white = { type: 'SUPER_GRAVITY_WILL', stage: 'selectTarget' };
    global.CardLogic = {
      getSelectableTargets: () => [{ row: 4, col: 4 }, { row: 4, col: 7 }],
      applySuperGravityWill: jest.fn(() => ({ applied: true }))
    };
    global.TurnPipeline = {};
    global.TurnPipelineUIAdapter = {
      runTurnWithAdapter: jest.fn(() => ({
        ok: true,
        nextCardState: {
          ...global.cardState,
          pendingEffectByPlayer: { ...global.cardState.pendingEffectByPlayer, white: null }
        },
        nextGameState: global.gameState,
        playbackEvents: []
      }))
    };

    await cpuDecision.cpuSelectSuperGravityWillWithPolicy('white');

    const action = global.TurnPipelineUIAdapter.runTurnWithAdapter.mock.calls[0][3];
    expect(action.superGravityTarget).toEqual({ row: 4, col: 7 });
  });

  test('cpuSelectExtendLifeWillWithPolicy prefers pipeline adapter path', async () => {
    global.cardState.pendingEffectByPlayer.white = { type: 'EXTEND_LIFE_WILL', stage: 'selectTarget' };
    global.CardLogic = {
      getExtendLifeTargets: () => [{ row: 3, col: 4 }],
      applyExtendLifeWill: jest.fn(() => ({ applied: true }))
    };
    global.TurnPipeline = {};
    global.TurnPipelineUIAdapter = {
      runTurnWithAdapter: jest.fn(() => ({
        ok: true,
        nextCardState: {
          ...global.cardState,
          pendingEffectByPlayer: { ...global.cardState.pendingEffectByPlayer, white: null }
        },
        nextGameState: global.gameState,
        playbackEvents: [{ type: 'dummy' }]
      }))
    };
    global.emitGameStateChange = jest.fn();

    await cpuDecision.cpuSelectExtendLifeWillWithPolicy('white');

    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalled();
    const action = global.TurnPipelineUIAdapter.runTurnWithAdapter.mock.calls[0][3];
    expect(action.extendTarget).toEqual({ row: 3, col: 4 });
    expect(global.CardLogic.applyExtendLifeWill).not.toHaveBeenCalled();
    expect(global.emitCardStateChange).toHaveBeenCalled();
    expect(global.emitBoardUpdate).toHaveBeenCalled();
    expect(global.emitGameStateChange).toHaveBeenCalled();
  });

  test('cpuSelectSwapWithEnemyWithPolicy does not fallback when pipeline path rejects', async () => {
    global.cardState.pendingEffectByPlayer.white = { type: 'SWAP_WITH_ENEMY', stage: 'selectTarget' };
    global.CardLogic = {
      getSelectableTargets: () => [{ row: 4, col: 5 }],
      applySwapEffect: jest.fn(() => true)
    };
    global.TurnPipeline = {};
    global.TurnPipelineUIAdapter = {
      runTurnWithAdapter: jest.fn(() => ({ ok: false }))
    };
    global.emitGameStateChange = jest.fn();

    await cpuDecision.cpuSelectSwapWithEnemyWithPolicy('white');

    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalled();
    expect(global.CardLogic.applySwapEffect).not.toHaveBeenCalled();
    expect(global.emitCardStateChange).not.toHaveBeenCalled();
    expect(global.emitBoardUpdate).not.toHaveBeenCalled();
    expect(global.emitGameStateChange).not.toHaveBeenCalled();
  });

  test('applyCardChoice uses pipeline path for immediate cards (treasure box)', () => {
    global.cardState = {
      hands: { white: ['treasure_01'], black: [] },
      pendingEffectByPlayer: { white: null, black: null },
      hasUsedCardThisTurnByPlayer: { white: false, black: false },
      charge: { white: 0, black: 0 },
      turnIndex: 7
    };
    global.gameState = { board: [], currentPlayer: -1 };
    global.CardLogic = { applyCardUsage: jest.fn(() => true) };
    global.TurnPipeline = {};
    global.TurnPipelineUIAdapter = {
      runTurnWithAdapter: jest.fn(() => ({
        ok: true,
        nextCardState: {
          ...global.cardState,
          hands: { white: [], black: [] },
          hasUsedCardThisTurnByPlayer: { white: true, black: false },
          charge: { white: 2, black: 0 }
        },
        nextGameState: global.gameState,
        playbackEvents: []
      }))
    };
    global.emitGameStateChange = jest.fn();

    const ok = cpuDecision.applyCardChoice('white', { cardId: 'treasure_01', cardDef: { name: '宝箱', cost: 0 } });
    expect(ok).toBe(true);
    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalled();
    expect(global.CardLogic.applyCardUsage).not.toHaveBeenCalled();
    expect(global.cardState.charge.white).toBe(2);
    expect(global.emitLogAdded).toHaveBeenCalledWith(expect.stringContaining('カードを使用'));
  });

  test('applyCardChoice rejects when pipeline card-use fails', () => {
    global.cardState.hands.white = ['treasure_01'];
    global.CardLogic = { applyCardUsage: jest.fn(() => true) };
    global.TurnPipeline = {};
    global.TurnPipelineUIAdapter = {
      runTurnWithAdapter: jest.fn(() => ({ ok: false }))
    };

    const ok = cpuDecision.applyCardChoice('white', { cardId: 'treasure_01', cardDef: { name: '宝箱', cost: 0 } });
    expect(ok).toBe(false);
    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalled();
    expect(global.CardLogic.applyCardUsage).not.toHaveBeenCalled();
  });
});
