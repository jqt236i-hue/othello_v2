const path = require('path');

function loadDeckSpecWithCardDefs(cardDefs: any[]) {
  jest.resetModules();
  jest.doMock('../shared-constants', () => ({
    CARD_DEFS: cardDefs
  }));
  return require('../shared/deck-spec.ts');
}

function loadCardStateManagerWithCardDefs(cardDefs: any[]) {
  jest.resetModules();
  jest.doMock('../shared-constants', () => ({
    CARD_DEFS: cardDefs,
    CHARGE_MAX: 99
  }));
  return require('../game/cards/state-manager.ts');
}

function createCardDefs(ids: string[]) {
  return ids.map((id) => ({
    id,
    name: id,
    type: id.toUpperCase(),
    cost: 0,
    enabled: true
  }));
}

describe('special card foundation assets', () => {
  test('board executor assets use the official board_executor filename', () => {
    const manifest = require('../assets/asset-manifest.json');
    const paths = manifest.files.map((entry: any) => entry.path);

    expect(paths).toContain('assets/images/special-stones/board_executor-black.png');
    expect(paths).toContain('assets/images/special-stones/board_executor-white.png');
    expect(paths).not.toContain('assets/images/stones/bankai-black.png');
    expect(paths).not.toContain('assets/images/stones/bankai-white.png');
  });
});

describe('special card foundation deck rules', () => {
  const specialIds = ['theory_incarnation_01', 'board_executor_01', 'observer_will_01'];

  test('exports the future special card ids and caps each at one copy', () => {
    const DeckSpecHelpers = require('../shared/deck-spec.ts');

    expect(DeckSpecHelpers.SPECIAL_FOUNDATION_CARD_IDS).toEqual(specialIds);
    expect(DeckSpecHelpers.getMaxCopiesForCardId('board_executor_01')).toBe(1);
    expect(DeckSpecHelpers.getMaxCopiesForCardId('guard_01')).toBe(DeckSpecHelpers.MAX_DUPLICATES_PER_CARD);
  });

  test('default deck sampling reserves exactly one special slot when the special cards are enabled', () => {
    const normalIds = Array.from({ length: 40 }, (_unused, index) => `normal_${index + 1}`);
    const DeckSpecHelpers = loadDeckSpecWithCardDefs(createCardDefs([...specialIds, ...normalIds]));
    const prng = {
      shuffle(list: any[]) {
        list.reverse();
        return list;
      }
    };

    const sampled = DeckSpecHelpers.sampleDefaultDeckCardIds(prng);
    const sampledSpecials = sampled.filter((cardId: string) => specialIds.includes(cardId));

    expect(sampled).toHaveLength(DeckSpecHelpers.getDefaultDeckSize());
    expect(sampledSpecials).toHaveLength(1);
  });

  test('runtime default deck creation reserves exactly one special slot when the special cards are enabled', () => {
    const normalIds = Array.from({ length: 40 }, (_unused, index) => `normal_${index + 1}`);
    const CardStateManager = loadCardStateManagerWithCardDefs(createCardDefs([...specialIds, ...normalIds]));
    const prng = {
      shuffle(list: any[]) {
        list.reverse();
        return list;
      }
    };

    const deck = CardStateManager.createDefaultDeck(prng);
    const deckSpecials = deck.filter((cardId: string) => specialIds.includes(cardId));

    expect(deck).toHaveLength(30);
    expect(deckSpecials).toHaveLength(1);
  });

  test('custom deck normalization rejects duplicate special cards but allows one of each', () => {
    const normalIds = Array.from({ length: 30 }, (_unused, index) => `normal_${index + 1}`);
    const DeckSpecHelpers = loadDeckSpecWithCardDefs(createCardDefs([...specialIds, ...normalIds]));

    expect(() => DeckSpecHelpers.normalizeDeckSpec([
      'board_executor_01',
      'board_executor_01'
    ], { requireFullDeck: false })).toThrow(/1 枚まで/);

    expect(DeckSpecHelpers.normalizeDeckSpec(specialIds, { requireFullDeck: false }).cards).toEqual(
      specialIds.map((cardId) => ({ cardId, count: 1 }))
    );
  });
});

describe('special card foundation marker metadata and locks', () => {
  test('future special marker types are inviolable manifestation stones', () => {
    const SpecialStoneRegistry = require('../shared/special-stone-registry.ts');
    const VisualEffectsMap = require('../game/visual-effects-map');

    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('THEORY_INCARNATION')).toBe('manifest_stone');
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('BOARD_EXECUTOR')).toBe('manifest_stone');
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('OBSERVER_WILL')).toBe('manifest_stone');
    expect(SpecialStoneRegistry.isInviolableSpecialType('THEORY_INCARNATION')).toBe(true);
    expect(SpecialStoneRegistry.isInviolableSpecialType('BOARD_EXECUTOR')).toBe(true);
    expect(SpecialStoneRegistry.isInviolableSpecialType('OBSERVER_WILL')).toBe(true);
    expect(SpecialStoneRegistry.getSpecialCardMarkerMetadata('BOARD_EXECUTOR')).toMatchObject({
      displayName: '盤界の執行者',
      durationOwnerTurns: 4,
      inviolable: true,
      visualEffectKey: 'boardExecutorStone'
    });
    expect(SpecialStoneRegistry.getSpecialCardMarkerMetadata('THEORY_INCARNATION')).toMatchObject({
      displayName: '理論の化身',
      durationOwnerTurns: 4,
      inviolable: true,
      visualEffectKey: 'theoryIncarnationStone'
    });
    expect(VisualEffectsMap.SPECIAL_TYPE_TO_EFFECT_KEY.THEORY_INCARNATION).toBe('theoryIncarnationStone');
    expect(VisualEffectsMap.SPECIAL_TYPE_TO_EFFECT_KEY.BOARD_EXECUTOR).toBe('boardExecutorStone');
    expect(VisualEffectsMap.SPECIAL_TYPE_TO_EFFECT_KEY.OBSERVER_WILL).toBe('observerWillStone');
  });

  test('card and placement locks are derived from active manifestation markers', () => {
    const CardMarkers = require('../game/logic/cards/markers.ts');
    const cardState = {
      markers: [
        { kind: 'manifestStone', row: 1, col: 1, owner: 'black', data: { type: 'THEORY_INCARNATION', remainingOwnerTurns: 4 } },
        { kind: 'manifestStone', row: 2, col: 2, owner: 'white', data: { type: 'BOARD_EXECUTOR', remainingOwnerTurns: 4 } },
        { kind: 'manifestStone', row: 3, col: 3, owner: 'black', data: { type: 'OBSERVER_WILL', remainingOwnerTurns: 5 } },
        { kind: 'manifestStone', row: 4, col: 4, owner: 'white', data: { type: 'THEORY_INCARNATION', remainingOwnerTurns: 0 } }
      ]
    };

    expect(CardMarkers.isCardPlayLockedForPlayer(cardState, 'black')).toBe(true);
    expect(CardMarkers.isCardPlayLockedForPlayer(cardState, 'white')).toBe(true);
    expect(CardMarkers.isPlacementLockedForPlayer(cardState, 'black')).toBe(false);
    expect(CardMarkers.isPlacementLockedForPlayer(cardState, 'white')).toBe(false);
  });

  test('hand manager excludes all usable cards when card play is locked', () => {
    const HandManager = require('../game/logic/cards-internal/hand-manager.ts');
    const context = {
      constants: {
        CARD_DEFS: [{ id: 'guard_01', name: 'guard', type: 'GUARD_WILL', cost: 0 }],
        CARD_TYPE_BY_ID: { guard_01: 'GUARD_WILL' },
        RIBO_WILL_UNLOCK_TURN_INDEX: 19
      }
    };
    const cardState = {
      hands: { black: ['guard_01'], white: [] },
      charge: { black: 10, white: 10 },
      markers: [
        { kind: 'specialStone', row: 1, col: 1, owner: 'black', data: { type: 'THEORY_INCARNATION', remainingOwnerTurns: 4 } }
      ]
    };

    expect(HandManager.canUseCard(cardState, 'black', 'guard_01', context)).toBe(false);
    expect(HandManager.getUsableCardIds(cardState, {}, 'black', context)).toEqual([]);
  });

  test('hand manager excludes usable cards while theory incarnation stone placement is reserved', () => {
    const HandManager = require('../game/logic/cards-internal/hand-manager.ts');
    const context = {
      constants: {
        CARD_DEFS: [{ id: 'guard_01', name: 'guard', type: 'GUARD_WILL', cost: 0 }],
        CARD_TYPE_BY_ID: { guard_01: 'GUARD_WILL' },
        RIBO_WILL_UNLOCK_TURN_INDEX: 19
      }
    };
    const cardState = {
      hands: { black: ['guard_01'], white: ['guard_01'] },
      charge: { black: 10, white: 10 },
      markers: [],
      nextTheoryIncarnationStoneByPlayer: {
        black: { sourceType: 'THEORY_INCARNATION', sessionId: 'theory_black_1' },
        white: null
      }
    };

    expect(HandManager.canUseCard(cardState, 'black', 'guard_01', context)).toBe(false);
    expect(HandManager.getUsableCardIds(cardState, {}, 'black', context)).toEqual([]);
    expect(HandManager.canUseCard(cardState, 'white', 'guard_01', context)).toBe(true);
  });

  test('placement resolver rejects placement while the player is placement locked', () => {
    const PlaceResolution = require('../game/turn/action-phase/place-resolution.ts');
    const options = {
      CardLogic: {
        isPlacementLockedForPlayer: () => true
      },
      Core: { BLACK: 1, WHITE: -1, getFlipsWithContext: () => [[0, 1]] },
      BoardOps: null,
      cardState: { extraPlaceRemainingByPlayer: { black: 0 } },
      gameState: { board: [[0, -1, 1]], turnNumber: 1 },
      playerKey: 'black',
      action: { row: 0, col: 0 },
      events: [],
      prng: null,
      pendingType: null,
      resolveSafeCardContext: () => ({}),
      getActionCellOwner: () => null,
      getPendingEffectTypeForActionPhase: () => null,
      applyTrapEffectsAfterSelection: () => undefined,
      handOffTurnAfterSelection: () => undefined,
      applyPlacementBoardBonusGain: () => 0,
      applyPostFlipRevives: () => ({ regenRes: {}, livingWillRes: {} }),
      isOthelloMode: () => false
    };

    expect(() => PlaceResolution.resolvePlacementAction(options)).toThrow(/placement locked/);
  });

  test('future inviolable marker types block board mutations', () => {
    const BoardOps = require('../game/logic/board_ops.ts');
    const cardState = {
      markers: [
        { kind: 'specialStone', row: 0, col: 0, owner: 'black', data: { type: 'BOARD_EXECUTOR', remainingOwnerTurns: 4 } }
      ],
      presentationEvents: []
    };
    const gameState = {
      board: [[1, 0]],
      turnNumber: 1
    };

    expect(BoardOps.changeAt(cardState, gameState, 0, 0, 'white', 'card', 'test')).toEqual(expect.objectContaining({
      changed: false,
      reason: 'inviolable'
    }));
    expect(BoardOps.destroyAt(cardState, gameState, 0, 0, 'card', 'test')).toEqual(expect.objectContaining({
      destroyed: false,
      reason: 'inviolable'
    }));
    expect(BoardOps.applyCellRemovalAt(cardState, gameState, 0, 0, 'black', 'card', 'test')).toEqual(expect.objectContaining({
      applied: false,
      reason: 'inviolable'
    }));
    expect(BoardOps.getCellValue(gameState, 0, 0)).toBe(1);
  });
});
