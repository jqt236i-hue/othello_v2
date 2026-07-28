import * as CardMarkers from '../game/logic/cards/markers.js';
import * as CardExpansion from '../game/logic/cards/expansion.js';
import * as Core from '../game/logic/core.js';
import * as PresentationHelper from '../game/logic/presentation.js';

const RuntimePresentationHelper = require('../dist/game/logic/presentation');

describe('CardMarkers module', () => {
  let emitPresentationEvent: jest.Mock;

  beforeEach(() => {
    emitPresentationEvent = jest.fn((cardState, ev) => {
        if (!Array.isArray(cardState.presentationEvents)) cardState.presentationEvents = [];
        cardState.presentationEvents.push(ev);
    });
    PresentationHelper.setPresentationRuntime({ emitPresentationEvent });
    RuntimePresentationHelper.setPresentationRuntime({ emitPresentationEvent });
  });

  afterEach(() => {
    PresentationHelper.setPresentationRuntime(null);
    RuntimePresentationHelper.setPresentationRuntime(null);
  });

  test('addMarker emits status and backfills the latest spawn meta for matching action', () => {
    const cardState = {
      markers: [],
      _nextMarkerId: 1,
      _nextCreatedSeq: 1,
      _currentActionMeta: { actionId: 'action-1' },
      _presentationEventsPersist: [
        { type: 'SPAWN', row: 4, col: 4, actionId: 'action-1', meta: { existing: true } }
      ],
      presentationEvents: []
    };

    const marker = CardMarkers.addMarker(
      cardState,
      CardMarkers.MARKER_KINDS.SPECIAL_STONE,
      4,
      4,
      'black',
      { type: 'GUARD', remainingOwnerTurns: 2, flipEvadeRemaining: 1 }
    );

    expect(marker).toMatchObject({
      id: 1,
      createdSeq: 1,
      row: 4,
      col: 4,
      kind: CardMarkers.MARKER_KINDS.SPECIAL_STONE,
      owner: 'black',
      data: { type: 'GUARD', remainingOwnerTurns: 2, flipEvadeRemaining: 1 }
    });
    expect(emitPresentationEvent).toHaveBeenCalledWith(
      cardState,
      expect.objectContaining({
        type: 'STATUS_APPLIED',
        row: 4,
        col: 4,
        meta: expect.objectContaining({
          special: 'GUARD',
          timer: 2,
          owner: 'black',
          flipEvadeRemaining: 1
        })
      })
    );
    expect(cardState._presentationEventsPersist[0].meta).toMatchObject({
      existing: true,
      special: 'GUARD',
      timer: 2,
      owner: 'black',
      flipEvadeRemaining: 1
    });
  });

  test('addMarker does not emit status or backfill spawn meta for hidden trap', () => {
    const cardState = {
      markers: [],
      _nextMarkerId: 1,
      _nextCreatedSeq: 1,
      _currentActionMeta: { actionId: 'action-trap' },
      _presentationEventsPersist: [
        { type: 'SPAWN', row: 5, col: 5, actionId: 'action-trap', meta: { existing: true } }
      ],
      presentationEvents: []
    };

    const marker = CardMarkers.addMarker(
      cardState,
      CardMarkers.MARKER_KINDS.SPECIAL_STONE,
      5,
      5,
      'black',
      { type: 'TRAP', hidden: true, armedForPlayer: 'white' }
    );

    expect(marker).toMatchObject({
      id: 1,
      row: 5,
      col: 5,
      kind: CardMarkers.MARKER_KINDS.SPECIAL_STONE,
      owner: 'black',
      data: { type: 'TRAP', hidden: true, armedForPlayer: 'white' }
    });
    expect(emitPresentationEvent).not.toHaveBeenCalledWith(
      cardState,
      expect.objectContaining({
        type: 'STATUS_APPLIED',
        row: 5,
        col: 5
      })
    );
    expect(cardState._presentationEventsPersist[0].meta).toMatchObject({ existing: true });
    expect(cardState._presentationEventsPersist[0].meta.special).toBeUndefined();
  });

  test('addMarker presentation suppression stores the marker without generic status or spawn backfill', () => {
    const cardState = {
      markers: [],
      _nextMarkerId: 1,
      _nextCreatedSeq: 1,
      _currentActionMeta: { actionId: 'action-cell' },
      _presentationEventsPersist: [
        { type: 'SPAWN', row: 2, col: 3, actionId: 'action-cell', meta: { existing: true } }
      ],
      presentationEvents: []
    };

    const marker = CardMarkers.addMarker(
      cardState,
      CardMarkers.MARKER_KINDS.SPECIAL_STONE,
      2,
      3,
      null,
      { type: 'SCORCHED_CELL', remainingTurns: 10, sourcePlayer: 'black' },
      { emitStatusApplied: false }
    );

    expect(marker).toMatchObject({
      row: 2,
      col: 3,
      owner: null,
      data: { type: 'SCORCHED_CELL', remainingTurns: 10, sourcePlayer: 'black' }
    });
    expect(emitPresentationEvent).not.toHaveBeenCalled();
    expect(cardState._presentationEventsPersist[0].meta).toEqual({ existing: true });
  });

  test('swapCellCoordinates swaps main and expansion stone ids and marker-linked positions', () => {
    const gameState = Core.createGameState();
    CardExpansion.ensureExpansionCellForCard(null, gameState, -1, 0, Core.EMPTY);

    const cardState = {
      stoneIdMap: Array.from({ length: 8 }, () => Array(8).fill(null)),
      expansionStoneIdByCell: {},
      markers: [
        { id: 1, row: 0, col: 0, kind: CardMarkers.MARKER_KINDS.SPECIAL_STONE, owner: 'black', createdSeq: 1, data: { type: 'WORK' } },
        { id: 2, row: -1, col: 0, kind: CardMarkers.MARKER_KINDS.SPECIAL_STONE, owner: 'white', createdSeq: 2, data: { type: 'TIME_BOMB', category: 'bomb', remainingTurns: 2 } }
      ],
      workAnchorPosByPlayer: { black: { row: 0, col: 0 }, white: null },
      breedingSproutByOwner: { black: [{ row: -1, col: 0 }], white: [] },
      breedingFrontierByAnchorId: {
        anchorA: [{ row: 0, col: 0 }, { row: -1, col: 0 }]
      }
    };

    CardMarkers.setStoneIdAtForCard(cardState, gameState, 0, 0, 's-main');
    CardMarkers.setStoneIdAtForCard(cardState, gameState, -1, 0, 's-expansion');

    CardMarkers.swapCellCoordinates(cardState, gameState, { row: 0, col: 0 }, { row: -1, col: 0 });

    expect(CardMarkers.getStoneIdAtForCard(cardState, gameState, 0, 0)).toBe('s-expansion');
    expect(CardMarkers.getStoneIdAtForCard(cardState, gameState, -1, 0)).toBe('s-main');
    expect(cardState.markers).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 1, row: -1, col: 0 }),
      expect.objectContaining({ id: 2, row: 0, col: 0 })
    ]));
    expect(cardState.workAnchorPosByPlayer.black).toEqual({ row: -1, col: 0 });
    expect(cardState.breedingSproutByOwner.black).toEqual([{ row: 0, col: 0 }]);
    expect(cardState.breedingFrontierByAnchorId.anchorA).toEqual([
      { row: -1, col: 0 },
      { row: 0, col: 0 }
    ]);
  });

  test('stone ids use the canonical custom-board topology and reject meteor holes', () => {
    const gameState = Core.createGameState({ rows: 10, cols: 10 });
    CardExpansion.ensureExpansionCellForCard(null, gameState, 2, 10, Core.EMPTY);
    const cardState: any = {
      stoneIdMap: null,
      expansionStoneIdByCell: {},
      markers: []
    };

    expect(CardMarkers.setStoneIdAtForCard(cardState, gameState, 9, 9, 'base-10x10')).toBe(true);
    expect(cardState.stoneIdMap).toHaveLength(10);
    expect(cardState.stoneIdMap[9]).toHaveLength(10);
    expect(CardMarkers.setStoneIdAtForCard(cardState, gameState, 2, 10, 'expanded')).toBe(true);
    expect(CardMarkers.getStoneIdAtForCard(cardState, gameState, 9, 9)).toBe('base-10x10');
    expect(CardMarkers.getStoneIdAtForCard(cardState, gameState, 2, 10)).toBe('expanded');

    cardState.markers.push({
      id: 1,
      row: 2,
      col: 10,
      kind: CardMarkers.MARKER_KINDS.SPECIAL_STONE,
      owner: 'black',
      createdSeq: 1,
      data: { type: 'METEOR_HOLE' }
    });

    expect(CardMarkers.getStoneIdAtForCard(cardState, gameState, 2, 10)).toBeNull();
    expect(CardMarkers.setStoneIdAtForCard(cardState, gameState, 2, 10, 'hidden')).toBe(false);
    CardMarkers.clearStoneIdAtForCard(cardState, gameState, 2, 10);
    expect(cardState.expansionStoneIdByCell['2,10']).toBeUndefined();
  });
});
