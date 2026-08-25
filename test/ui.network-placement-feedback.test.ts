describe('NetworkPlacementFeedbackController', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('shows an owner-colored provisional stone and hands it off only after verified intake', () => {
    const { createNetworkPlacementFeedbackController } = require('../ui/network/placement-feedback');
    const session = { active: true, roomId: 'abc', sessionEpoch: 7 };
    const setPreviewHints = jest.fn();
    const controller = createNetworkPlacementFeedbackController({
      getSessionIdentity: () => session,
      setPreviewHints
    });

    const token = controller.beginPlacement({ row: 2, col: 3 }, 'black');

    expect(token).toBe('network-placement:1');
    expect(setPreviewHints).toHaveBeenLastCalledWith([
      { cellKey: '2,3', kind: 'network-pending-placement', owner: 'black' }
    ], undefined);
    expect(controller.bindOperation(token, {
      operationId: 'op-place-1',
      roomId: 'ABC',
      sessionEpoch: 7
    })).toBe(true);
    expect(controller.settlePlacement(token, { ok: true })).toBe(false);
    expect(controller.acceptForIntake(
      { operationId: 'op-place-1', roomId: 'ABC', intakeError: 'invalid_snapshot' },
      { appliedSnapshot: true }
    )).toBe(false);
    expect(controller.acceptForIntake(
      { operationId: 'other-op', roomId: 'ABC' },
      { appliedSnapshot: true }
    )).toBe(false);
    expect(controller.acceptForIntake(
      { operationId: 'op-place-1', roomId: 'ABC' },
      { appliedSnapshot: true, enqueuedFrameCount: 1, skippedReason: null }
    )).toBe(true);
    expect(setPreviewHints).toHaveBeenLastCalledWith([], { deferRender: true });
    expect(controller.getActiveFeedback()).toBeNull();
  });

  test('does not let a late completion clear a newer placement indicator', () => {
    const { createNetworkPlacementFeedbackController } = require('../ui/network/placement-feedback');
    const setPreviewHints = jest.fn();
    const controller = createNetworkPlacementFeedbackController({
      getSessionIdentity: () => ({ active: true, roomId: 'ABC', sessionEpoch: 3 }),
      setPreviewHints
    });

    const firstToken = controller.beginPlacement({ row: 1, col: 1 }, 'black');
    const secondToken = controller.beginPlacement({ row: 4, col: 5 }, 'white');

    expect(controller.settlePlacement(firstToken, { ok: true })).toBe(false);
    expect(controller.getActiveFeedback()).toMatchObject({
      token: secondToken,
      cellKey: '4,5',
      owner: 'white'
    });
    expect(controller.settlePlacement(secondToken, { ok: false, reason: 'PUBLISH_REJECTED' })).toBe(true);
    expect(setPreviewHints).toHaveBeenLastCalledWith([], undefined);
  });

  test('keeps the legacy ring fallback when the owner is unavailable', () => {
    const { createNetworkPlacementFeedbackController } = require('../ui/network/placement-feedback');
    const setPreviewHints = jest.fn();
    const controller = createNetworkPlacementFeedbackController({
      getSessionIdentity: () => ({ active: true, roomId: 'ABC', sessionEpoch: 2 }),
      setPreviewHints
    });

    expect(controller.beginPlacement({ row: 0, col: 1 })).toBe('network-placement:1');
    expect(setPreviewHints).toHaveBeenLastCalledWith([
      { cellKey: '0,1', kind: 'network-pending-placement' }
    ], undefined);
  });

  test('clears a stale-session indicator without applying an old envelope to the current session', () => {
    const { createNetworkPlacementFeedbackController } = require('../ui/network/placement-feedback');
    const session: any = { active: true, roomId: 'ABC', sessionEpoch: 3 };
    const setPreviewHints = jest.fn();
    const controller = createNetworkPlacementFeedbackController({
      getSessionIdentity: () => session,
      setPreviewHints
    });

    const token = controller.beginPlacement({ row: 6, col: 0 }, 'black');
    controller.bindOperation(token, { operationId: 'op-session', roomId: 'ABC', sessionEpoch: 3 });
    session.roomId = 'DEF';
    session.sessionEpoch = 4;

    expect(controller.acceptForIntake(
      { operationId: 'op-session', roomId: 'ABC' },
      { appliedSnapshot: true }
    )).toBe(true);
    expect(setPreviewHints).toHaveBeenLastCalledWith([], { deferRender: true });
  });
});
