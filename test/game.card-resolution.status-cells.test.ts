import * as StatusCells from '../game/logic/card-resolution/status-cells';

describe('card-resolution status cell primitive', () => {
  test('overwrites temporary special cells before applying one canonical marker without touching pending state', () => {
    const cardState = {
      markers: [
        { id: 'poison', kind: 'specialStone', row: 2, col: 3, data: { type: 'POISON_CELL' } },
        { id: 'seed', kind: 'specialStone', row: 2, col: 3, data: { type: 'SEED' } }
      ],
      pendingEffectByPlayer: { black: { type: 'FREEZE_WILL' } }
    } as any;
    const getMarkers = jest.fn(() => cardState.markers);
    const removeMarkerById = jest.fn((_state, id) => {
      const before = cardState.markers.length;
      cardState.markers = cardState.markers.filter((marker: any) => marker.id !== id);
      return cardState.markers.length !== before;
    });
    const addMarker = jest.fn(() => ({ id: 'freeze' }));
    const emitPresentationEvent = jest.fn();

    const result = StatusCells.applyStatusCellMarker(cardState, 'black', 2, 3, {
      markerType: 'FREEZE',
      remainingOwnerTurns: 5,
      reason: 'freeze_selected'
    }, {
      getMarkers,
      removeMarkerById,
      addMarker,
      emitPresentationEvent,
      MARKER_KINDS: { SPECIAL_STONE: 'specialStone' }
    });

    expect(result).toEqual({
      applied: true,
      row: 2,
      col: 3,
      markerId: 'freeze',
      removedTypes: ['POISON_CELL', 'SEED']
    });
    expect(removeMarkerById).toHaveBeenNthCalledWith(1, cardState, 'poison');
    expect(removeMarkerById).toHaveBeenNthCalledWith(2, cardState, 'seed');
    expect(addMarker).toHaveBeenCalledWith(cardState, 'specialStone', 2, 3, 'black', {
      type: 'FREEZE',
      remainingOwnerTurns: 5
    });
    expect(emitPresentationEvent).toHaveBeenCalledWith(cardState, {
      type: 'STATUS_REMOVED',
      row: 2,
      col: 3,
      meta: { special: 'POISON_CELL', reason: 'special_cell_overwritten' }
    });
    expect(emitPresentationEvent).toHaveBeenCalledWith(cardState, {
      type: 'STATUS_REMOVED',
      row: 2,
      col: 3,
      meta: { special: 'SEED', reason: 'special_cell_overwritten' }
    });
    expect(emitPresentationEvent).toHaveBeenCalledWith(cardState, {
      type: 'STATUS_APPLIED',
      row: 2,
      col: 3,
      meta: {
        special: 'FREEZE',
        owner: 'black',
        timer: 5,
        reason: 'freeze_selected'
      }
    });
    expect(cardState.pendingEffectByPlayer.black).toEqual({ type: 'FREEZE_WILL' });
  });

  test('rejects invalid coordinates before mutating markers', () => {
    const removeMarkersAt = jest.fn();
    const addMarker = jest.fn();
    const result = StatusCells.applyStatusCellMarker({} as any, 'black', Number.NaN, 3, {
      markerType: 'FREEZE',
      remainingOwnerTurns: 5,
      reason: 'freeze_selected'
    }, { removeMarkersAt, addMarker });

    expect(result).toEqual({ applied: false, reason: 'invalid_target' });
    expect(removeMarkersAt).not.toHaveBeenCalled();
    expect(addMarker).not.toHaveBeenCalled();
  });

  test('fails closed when canonical marker dependencies are missing', () => {
    expect(StatusCells.applyStatusCellMarker({} as any, 'black', 1, 1, {
      markerType: 'FREEZE',
      remainingOwnerTurns: 5,
      reason: 'freeze_selected'
    }, {})).toEqual({ applied: false, reason: 'deps_missing' });
  });
});
