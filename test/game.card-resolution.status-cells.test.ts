import * as StatusCells from '../game/logic/card-resolution/status-cells';

describe('card-resolution status cell primitive', () => {
  test('applies one canonical marker and presentation event without touching pending state', () => {
    const cardState = { markers: [], pendingEffectByPlayer: { black: { type: 'FREEZE_WILL' } } } as any;
    const removeMarkersAt = jest.fn();
    const addMarker = jest.fn();
    const emitPresentationEvent = jest.fn();

    const result = StatusCells.applyStatusCellMarker(cardState, 'black', 2, 3, {
      markerType: 'FREEZE',
      remainingOwnerTurns: 5,
      reason: 'freeze_selected'
    }, {
      removeMarkersAt,
      addMarker,
      emitPresentationEvent,
      MARKER_KINDS: { SPECIAL_STONE: 'specialStone' }
    });

    expect(result).toEqual({ applied: true, row: 2, col: 3 });
    expect(removeMarkersAt).toHaveBeenCalledWith(cardState, 2, 3, {
      kind: 'specialStone',
      type: 'FREEZE'
    });
    expect(addMarker).toHaveBeenCalledWith(cardState, 'specialStone', 2, 3, 'black', {
      type: 'FREEZE',
      remainingOwnerTurns: 5
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
