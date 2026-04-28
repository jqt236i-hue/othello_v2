import * as StateFactory from '../game/logic/cards-internal/state-factory.js';

describe('state-factory', () => {
  function makeMockContext(overrides = {}) {
    return {
      constants: {},
      defaultPrng: { shuffle: (arr) => arr, random: () => 0.5 },
      resolveCardBoardConfig: (cfg) => cfg || { size: 8 },
      resolveInitialDeckCardIdsByPlayer: () => ({ black: ['c1', 'c2'], white: ['c3', 'c4'] }),
      buildInitialBoardBonusMap: () => ({}),
      createStoneIdBoard: (cfg) => Array.from({ length: (cfg && cfg.size) || 8 }, () => []),
      getOpeningPlacementsForState: () => [],
      ensureCardCopyState: (state) => state,
      cloneSalvationDestroyedLedger: (ledger) => ledger || { black: [], white: [] },
      ...overrides
    };
  }

  describe('createCardState', () => {
    test('creates initial card state with decks and hands', () => {
      const prng = { shuffle: (arr) => arr, random: () => 0.5 };
      const context = makeMockContext();
      const state = StateFactory.createCardState(prng, {}, context);

      expect(state).toBeTruthy();
      expect(Array.isArray(state.decks.black)).toBe(true);
      expect(Array.isArray(state.decks.white)).toBe(true);
      expect(state.decks.black).toEqual(['c1', 'c2']);
      expect(state.decks.white).toEqual(['c3', 'c4']);
      expect(Array.isArray(state.hands.black)).toBe(true);
      expect(Array.isArray(state.hands.white)).toBe(true);
      expect(state.turnIndex).toBe(0);
      expect(state.selectedCardId).toBeNull();
    });

    test('uses fallback PRNG when prng argument is missing', () => {
      const context = makeMockContext({ defaultPrng: { shuffle: (arr) => arr, random: () => 0.5 } });
      const state = StateFactory.createCardState(null, {}, context);
      expect(state).toBeTruthy();
      expect(Array.isArray(state.decks.black)).toBe(true);
    });

    test('throws when required context functions are missing', () => {
      expect(() => StateFactory.createCardState(null, {}, {})).toThrow(/not available/);
    });

    test('assigns stone ids for opening placements', () => {
      const context = makeMockContext({
        getOpeningPlacementsForState: () => [{ row: 3, col: 3 }, { row: 4, col: 4 }],
        createStoneIdBoard: () => [[], [], [], ['', '', '', null], [], [], [], []]
      });
      const state = StateFactory.createCardState(null, {}, context);
      expect(state.stoneIdMap[3][3]).toBe('s1');
      expect(state.stoneIdMap[4][4]).toBe('s2');
      expect(state._nextStoneId).toBe(3);
    });
  });

  describe('copyCardState', () => {
    test('performs deep copy of card state', () => {
      const context = makeMockContext();
      const original = StateFactory.createCardState(null, {}, context);
      original.hands.black = ['card-a'];
      original.hands.white = ['card-b'];
      original.markers = [{ row: 1, col: 1, data: { type: 'BOMB' } }];
      original.pendingEffectByPlayer = { black: { type: 'TEST' }, white: null };
      original.activeEffectsByPlayer = { black: [{ id: 'e1' }], white: [] };
      original.presentationEvents = [{ type: 'MOVE', meta: { timer: 3 } }];
      original.chargeDeltaEvents = [{ amount: 1 }];
      original.riboRepaymentsByPlayer = { black: [{ remainingOwnerTurns: 2, repaymentAmount: 5, shortageDestroyCount: 1 }], white: [] };
      original.boardBonusByCell = { '1,1': 2 };
      original.boardBonusConsumedByCell = { '1,1': true };
      original.workAnchorPosByPlayer = { black: { row: 2, col: 3 }, white: null };
      original.workNextPlacementArmedByPlayer = { black: true, white: false };
      original.breedingFrontierByAnchorId = { a1: [{ row: 0, col: 0 }] };
      original.breedingSproutByOwner = { black: [{ row: 1, col: 1 }], white: [] };
      original.prevOpponentTurnDestroyedStonesByPlayer = { black: ['s1'], white: [] };
      original.fateWillControllerByTurnOwner = { black: 'ctrl1', white: null };

      const copy = StateFactory.copyCardState(original, context);

      expect(copy).not.toBe(original);
      expect(copy.hands.black).toEqual(['card-a']);
      expect(copy.hands.white).toEqual(['card-b']);
      expect(copy.hands.black).not.toBe(original.hands.black);
      expect(copy.markers).toEqual([{ row: 1, col: 1, data: { type: 'BOMB' } }]);
      expect(copy.markers).not.toBe(original.markers);
      expect(copy.markers[0].data).not.toBe(original.markers[0].data);
      expect(copy.pendingEffectByPlayer.black).toEqual({ type: 'TEST' });
      expect(copy.pendingEffectByPlayer.black).not.toBe(original.pendingEffectByPlayer.black);
      expect(copy.activeEffectsByPlayer.black).toEqual([{ id: 'e1' }]);
      expect(copy.activeEffectsByPlayer.black).not.toBe(original.activeEffectsByPlayer.black);
      expect(copy.activeEffectsByPlayer.black[0]).not.toBe(original.activeEffectsByPlayer.black[0]);
      expect(copy.presentationEvents).toEqual([{ type: 'MOVE', meta: { timer: 3 } }]);
      expect(copy.presentationEvents).not.toBe(original.presentationEvents);
      expect(copy.presentationEvents[0].meta).not.toBe(original.presentationEvents[0].meta);
      expect(copy.chargeDeltaEvents).toEqual([{ amount: 1 }]);
      expect(copy.chargeDeltaEvents).not.toBe(original.chargeDeltaEvents);
      expect(copy.riboRepaymentsByPlayer.black).toEqual([{ remainingOwnerTurns: 2, repaymentAmount: 5, shortageDestroyCount: 1 }]);
      expect(copy.boardBonusByCell).toEqual({ '1,1': 2 });
      expect(copy.boardBonusConsumedByCell).toEqual({ '1,1': true });
      expect(copy.workAnchorPosByPlayer.black).toEqual({ row: 2, col: 3 });
      expect(copy.workNextPlacementArmedByPlayer.black).toBe(true);
      expect(copy.breedingFrontierByAnchorId).toEqual({ a1: [{ row: 0, col: 0 }] });
      expect(copy.breedingSproutByOwner.black).toEqual([{ row: 1, col: 1 }]);
      expect(copy.prevOpponentTurnDestroyedStonesByPlayer).toEqual({ black: ['s1'], white: [] });
      expect(copy.fateWillControllerByTurnOwner).toEqual({ black: 'ctrl1', white: null });
    });

    test('handles legacy deck field during copy', () => {
      const context = makeMockContext();
      const legacy = {
        deck: ['legacy1', 'legacy2'],
        boardConfig: { size: 8 }
      };
      const copy = StateFactory.copyCardState(legacy, context);
      expect(copy.decks.black).toEqual(['legacy1', 'legacy2']);
      expect(copy.decks.white).toEqual(['legacy1', 'legacy2']);
      expect(copy.deck).toEqual(['legacy1', 'legacy2']);
    });

    test('defaults missing scalar fields', () => {
      const context = makeMockContext();
      const minimal = {};
      const copy = StateFactory.copyCardState(minimal, context);
      expect(copy.turnIndex).toBe(0);
      expect(copy.turnCountByPlayer).toEqual({ black: 0, white: 0 });
      expect(copy.charge.black).toBe(0);
      expect(copy.charge.white).toBe(0);
      expect(copy._nextMarkerId).toBe(1);
      expect(copy._nextStoneId).toBe(1);
      expect(copy.hyperactiveSeqCounter).toBe(0);
    });

    test('uses constants for ribo repayment defaults', () => {
      const context = makeMockContext({
        constants: { RIBO_WILL_OWNER_TURNS: 3, RIBO_WILL_REPAYMENT_AMOUNT: 10, RIBO_WILL_SHORTAGE_DESTROY_COUNT: 2 }
      });
      const original = {
        riboRepaymentsByPlayer: { black: [{}], white: [] }
      };
      const copy = StateFactory.copyCardState(original, context);
      expect(copy.riboRepaymentsByPlayer.black[0]).toEqual({ remainingOwnerTurns: 3, repaymentAmount: 10, shortageDestroyCount: 2 });
    });
  });
});
