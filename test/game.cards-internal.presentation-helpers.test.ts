import * as PresentationHelpers from '../game/logic/cards-internal/presentation-helpers.js';

describe('presentation-helpers', () => {
  function makeMockContext(overrides = {}) {
    return {
      constants: { BLACK: 1, EMPTY: 0 },
      getSpecialMarkers: (cs) => (cs && Array.isArray(cs.markers) ? cs.markers : []),
      findBombMarkerAt: () => null,
      isOverlayOnlySpecialStoneType: (type) => type === 'OVERLAY',
      getCellValueForCard: (gs, r, c) => (gs && gs.board ? gs.board[r][c] : 0),
      setCellValueForCard: (gs, r, c, v) => { if (gs && gs.board) gs.board[r][c] = v; },
      swapCellCoordinates: () => {},
      getStoneIdAtForCard: () => null,
      ...overrides
    };
  }

  describe('compactPresentationMeta', () => {
    test('strips null and undefined values', () => {
      expect(PresentationHelpers.compactPresentationMeta({ a: 1, b: null, c: undefined, d: 0 })).toEqual({ a: 1, d: 0 });
    });

    test('returns undefined for empty object', () => {
      expect(PresentationHelpers.compactPresentationMeta({})).toBeUndefined();
      expect(PresentationHelpers.compactPresentationMeta(null)).toBeUndefined();
    });
  });

  describe('getCellVisualPresentationMeta', () => {
    test('returns undefined when no markers exist', () => {
      const cardState = { markers: [] };
      const meta = PresentationHelpers.getCellVisualPresentationMeta(cardState, 0, 0, makeMockContext());
      expect(meta).toBeUndefined();
    });

    test('builds meta from visual special marker', () => {
      const cardState = {
        markers: [{ row: 1, col: 2, owner: 'black', data: { type: 'SHIELD', remainingOwnerTurns: 3, flipEvadeRemaining: 2 } }]
      };
      const meta = PresentationHelpers.getCellVisualPresentationMeta(cardState, 1, 2, makeMockContext());
      expect(meta).toEqual({ special: 'SHIELD', timer: 3, owner: 'black', flipEvadeRemaining: 2 });
    });

    test('builds meta from bomb marker fallback', () => {
      const cardState = { markers: [] };
      const context = makeMockContext({
        findBombMarkerAt: () => ({ owner: 'white', data: { type: 'TIME_BOMB', remainingTurns: 5 } })
      });
      const meta = PresentationHelpers.getCellVisualPresentationMeta(cardState, 0, 0, context);
      expect(meta).toEqual({ special: 'TIME_BOMB', timer: 5, owner: 'white' });
    });

    test('includes inherited hyperactive data alongside visual special', () => {
      const cardState = {
        markers: [{ row: 0, col: 0, owner: 'black', data: { type: 'INHERITED_HYPERACTIVE', remainingOwnerTurns: 4, flipEvadeRemaining: 1 } }]
      };
      const meta = PresentationHelpers.getCellVisualPresentationMeta(cardState, 0, 0, makeMockContext());
      expect(meta).toEqual({
        special: 'INHERITED_HYPERACTIVE',
        timer: 4,
        owner: 'black',
        flipEvadeRemaining: 1,
        inheritedTimer: 4,
        inheritedOwner: 'black',
        inheritedFlipEvadeRemaining: 1
      });
    });

    test('sums destroy evade values', () => {
      const cardState = {
        markers: [
          { row: 0, col: 0, data: { destroyEvadeRemaining: 2 } },
          { row: 0, col: 0, data: { destroyEvadeRemaining: 3 } }
        ]
      };
      const meta = PresentationHelpers.getCellVisualPresentationMeta(cardState, 0, 0, makeMockContext());
      expect(meta).toEqual({ destroyEvadeRemaining: 5 });
    });

    test('delegates to StoneStatusSnapshot when available', () => {
      const cardState = { markers: [{ row: 0, col: 0, data: { type: 'SHIELD' } }] };
      const snapshot = {
        resolveStoneVisualStatusFromMarkers: (markers) => ({ delegated: true, count: markers.length })
      };
      const context = makeMockContext({ StoneStatusSnapshot: snapshot });
      const meta = PresentationHelpers.getCellVisualPresentationMeta(cardState, 0, 0, context);
      expect(meta).toEqual({ delegated: true, count: 1 });
    });
  });

  describe('allocateStoneId', () => {
    test('allocates sequential stone ids', () => {
      const cardState = {};
      expect(PresentationHelpers.allocateStoneId(cardState)).toBe('s1');
      expect(PresentationHelpers.allocateStoneId(cardState)).toBe('s2');
      expect(cardState._nextStoneId).toBe(3);
    });

    test('returns null for null cardState', () => {
      expect(PresentationHelpers.allocateStoneId(null)).toBeNull();
    });
  });

  describe('emitPresentationEvent', () => {
    test('pushes event to presentationEvents array', () => {
      const cardState = { presentationEvents: [] };
      const ev = { type: 'TEST', value: 42 };
      PresentationHelpers.emitPresentationEvent(cardState, ev, makeMockContext());
      expect(cardState.presentationEvents).toContainEqual(ev);
    });

    test('initializes presentationEvents if missing', () => {
      const cardState = {};
      PresentationHelpers.emitPresentationEvent(cardState, { type: 'INIT' }, makeMockContext());
      expect(Array.isArray(cardState.presentationEvents)).toBe(true);
      expect(cardState.presentationEvents.length).toBe(1);
    });

    test('delegates to BoardOpsModule when available', () => {
      const emitFn = jest.fn();
      const cardState = { presentationEvents: [] };
      const context = makeMockContext({ BoardOpsModule: { emitPresentationEvent: emitFn } });
      const ev = { type: 'DELEGATED' };
      PresentationHelpers.emitPresentationEvent(cardState, ev, context);
      expect(emitFn).toHaveBeenCalledWith(cardState, ev);
      expect(cardState.presentationEvents.length).toBe(0);
    });
  });

  describe('flushPresentationEvents', () => {
    test('returns and clears events', () => {
      const cardState = { presentationEvents: [{ type: 'A' }, { type: 'B' }] };
      const flushed = PresentationHelpers.flushPresentationEvents(cardState, makeMockContext());
      expect(flushed).toEqual([{ type: 'A' }, { type: 'B' }]);
      expect(cardState.presentationEvents.length).toBe(0);
    });

    test('persists to _presentationEventsPersist when no BoardOpsModule', () => {
      const cardState = { presentationEvents: [{ type: 'P' }] };
      PresentationHelpers.flushPresentationEvents(cardState, makeMockContext());
      expect(cardState._presentationEventsPersist).toEqual([{ type: 'P' }]);
    });

    test('does not persist when BoardOpsModule is present', () => {
      const cardState = { presentationEvents: [{ type: 'P' }] };
      const context = makeMockContext({ BoardOpsModule: { emitPresentationEvent: () => {} } });
      PresentationHelpers.flushPresentationEvents(cardState, context);
      expect(cardState._presentationEventsPersist).toBeUndefined();
    });

    test('returns empty array for invalid input', () => {
      expect(PresentationHelpers.flushPresentationEvents(null, makeMockContext())).toEqual([]);
      expect(PresentationHelpers.flushPresentationEvents({}, makeMockContext())).toEqual([]);
    });
  });

  describe('swapOccupiedCellsWithPresentation', () => {
    test('swaps occupied cells and emits MOVE events', () => {
      const board = Array.from({ length: 4 }, () => Array(4).fill(0));
      board[1][1] = 1;
      board[2][2] = -1;
      const cardState = {
        presentationEvents: [],
        markers: []
      };
      const gameState = { board };
      const context = makeMockContext({
        getCellValueForCard: (gs, r, c) => gs.board[r][c],
        setCellValueForCard: (gs, r, c, v) => { gs.board[r][c] = v; },
        getStoneIdAtForCard: () => 'sid',
        swapCellCoordinates: () => {}
      });

      const result = PresentationHelpers.swapOccupiedCellsWithPresentation(
        cardState, gameState, { row: 1, col: 1 }, { row: 2, col: 2 }, {}, context
      );

      expect(result.swapped).toBe(true);
      expect(board[1][1]).toBe(-1);
      expect(board[2][2]).toBe(1);
      expect(cardState.presentationEvents.length).toBe(2);
      expect(cardState.presentationEvents[0].type).toBe('MOVE');
      expect(cardState.presentationEvents[1].type).toBe('MOVE');
    });

    test('returns reason empty when a cell is empty', () => {
      const board = Array.from({ length: 4 }, () => Array(4).fill(0));
      board[1][1] = 1;
      const gameState = { board };
      const result = PresentationHelpers.swapOccupiedCellsWithPresentation(
        {}, gameState, { row: 1, col: 1 }, { row: 2, col: 2 }, {}, makeMockContext()
      );
      expect(result.swapped).toBe(false);
      expect(result.reason).toBe('empty');
    });

    test('returns reason invalid_args for non-integer coordinates', () => {
      const result = PresentationHelpers.swapOccupiedCellsWithPresentation(
        {}, {}, { row: 1.5, col: 1 }, { row: 2, col: 2 }, {}, makeMockContext()
      );
      expect(result.swapped).toBe(false);
      expect(result.reason).toBe('invalid_args');
    });

    test('returns reason invalid_args when args are missing', () => {
      expect(PresentationHelpers.swapOccupiedCellsWithPresentation(null, null, null, null, {}, makeMockContext()).reason).toBe('invalid_args');
    });

    test('returns reason out_of_board when cell value is null', () => {
      const board = Array.from({ length: 4 }, () => Array(4).fill(0));
      const gameState = { board };
      const result = PresentationHelpers.swapOccupiedCellsWithPresentation(
        {}, gameState, { row: 1, col: 1 }, { row: 2, col: 2 }, {},
        makeMockContext({ getCellValueForCard: (gs, r, c) => (r === 2 && c === 2 ? null : gs.board[r][c]) })
      );
      expect(result.swapped).toBe(false);
      expect(result.reason).toBe('out_of_board');
    });
  });
});
