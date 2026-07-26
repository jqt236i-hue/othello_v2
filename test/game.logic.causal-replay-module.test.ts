import * as CardCausalReplay from '../game/logic/cards/causal_replay.js';

describe('CardCausalReplay module', () => {
  test('applyCausalReplayWill restores a meteor hole to an empty normal cell and clears pending', () => {
    const cardState: any = {
      pendingEffectByPlayer: { black: { type: 'CAUSAL_REPLAY_WILL', stage: 'selectTarget', cardId: 'causal_replay_01' } },
      markers: [
        { id: 'hole_1', kind: 'specialStone', row: 2, col: 3, owner: 'white', data: { type: 'METEOR_HOLE' } }
      ]
    };
    const gameState: any = {};
    const setCellValueForCard = jest.fn(() => true);
    const clearStoneIdAtForCard = jest.fn();
    const removeMarkersAt = jest.fn((cs, row, col, options) => {
      cs.markers = cs.markers.filter((marker) => !(
        marker &&
        marker.row === row &&
        marker.col === col &&
        marker.kind === options.kind &&
        marker.data &&
        marker.data.type === options.type
      ));
    });
    const emitPresentationEvent = jest.fn();
    const createBoardMutationCheckpoint = jest.fn((_gs, cs) => ({
      gameStateSnapshot: {},
      cardStateSnapshot: JSON.parse(JSON.stringify(cs))
    }));
    const restoreBoardMutationCheckpoint = jest.fn((_gs, cs, checkpoint) => {
      for (const key of Object.keys(cs)) delete cs[key];
      Object.assign(cs, JSON.parse(JSON.stringify(checkpoint.cardStateSnapshot)));
      return true;
    });

    const result = CardCausalReplay.applyCausalReplayWill(cardState, gameState, 'black', 2, 3, {
      getCausalReplayTargets: () => [{ row: 2, col: 3 }],
      setCellValueForCard,
      createBoardMutationCheckpoint,
      restoreBoardMutationCheckpoint,
      clearStoneIdAtForCard,
      removeMarkersAt,
      emitPresentationEvent,
      EMPTY: 0,
      MARKER_KINDS: { SPECIAL_STONE: 'specialStone' }
    });

    expect(result).toEqual({ applied: true, row: 2, col: 3, restored: true });
    expect(setCellValueForCard).toHaveBeenCalledWith(gameState, 2, 3, 0);
    expect(clearStoneIdAtForCard).toHaveBeenCalledWith(cardState, gameState, 2, 3);
    expect(removeMarkersAt).toHaveBeenCalledWith(cardState, 2, 3, {
      kind: 'specialStone',
      type: 'METEOR_HOLE'
    });
    expect(emitPresentationEvent).toHaveBeenCalledWith(cardState, {
      type: 'STATUS_REMOVED',
      row: 2,
      col: 3,
      cause: 'CAUSAL_REPLAY_WILL',
      reason: 'causal_replay_selected',
      meta: expect.objectContaining({
        special: 'METEOR_HOLE',
        owner: 'white',
        timer: null,
        cellRestorationCause: 'CAUSAL_REPLAY_WILL',
        restoredAs: 'normal_empty_cell',
        highlightTone: 'positive'
      })
    });
    expect(cardState.markers).toEqual([]);
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
    expect(createBoardMutationCheckpoint).toHaveBeenCalledWith(gameState, cardState);
    expect(restoreBoardMutationCheckpoint).not.toHaveBeenCalled();
  });

  test('rolls the hole marker and pending state back when the cell cannot be restored', () => {
    const cardState: any = {
      pendingEffectByPlayer: { black: { type: 'CAUSAL_REPLAY_WILL', stage: 'selectTarget' } },
      markers: [
        { id: 'hole_1', kind: 'specialStone', row: 2, col: 3, owner: 'white', data: { type: 'METEOR_HOLE' } }
      ]
    };
    const snapshot = JSON.parse(JSON.stringify(cardState));
    const restoreBoardMutationCheckpoint = jest.fn((_gs, cs) => {
      for (const key of Object.keys(cs)) delete cs[key];
      Object.assign(cs, JSON.parse(JSON.stringify(snapshot)));
      return true;
    });
    const clearStoneIdAtForCard = jest.fn();

    const result = CardCausalReplay.applyCausalReplayWill(cardState, {}, 'black', 2, 3, {
      getCausalReplayTargets: () => [{ row: 2, col: 3 }],
      setCellValueForCard: () => false,
      createBoardMutationCheckpoint: () => ({
        gameStateSnapshot: {},
        cardStateSnapshot: snapshot
      }),
      restoreBoardMutationCheckpoint,
      clearStoneIdAtForCard,
      removeMarkersAt: (cs, row, col) => {
        cs.markers = cs.markers.filter((marker) => marker.row !== row || marker.col !== col);
      },
      MARKER_KINDS: { SPECIAL_STONE: 'specialStone' }
    });

    expect(result).toEqual({ applied: false, reason: 'restore_failed', row: 2, col: 3 });
    expect(cardState).toEqual(snapshot);
    expect(restoreBoardMutationCheckpoint).toHaveBeenCalledTimes(1);
    expect(clearStoneIdAtForCard).not.toHaveBeenCalled();
  });

  test('applyCausalReplayWill rejects a non-hole target and keeps pending selection', () => {
    const cardState: any = {
      pendingEffectByPlayer: { black: { type: 'CAUSAL_REPLAY_WILL', stage: 'selectTarget', cardId: 'causal_replay_01' } },
      markers: []
    };
    const setCellValueForCard = jest.fn();

    const result = CardCausalReplay.applyCausalReplayWill(cardState, {}, 'black', 4, 4, {
      getCausalReplayTargets: () => [],
      setCellValueForCard
    });

    expect(result).toEqual({ applied: false, reason: 'invalid_target', row: 4, col: 4 });
    expect(setCellValueForCard).not.toHaveBeenCalled();
    expect(cardState.pendingEffectByPlayer.black).toMatchObject({ type: 'CAUSAL_REPLAY_WILL', stage: 'selectTarget' });
  });
});
