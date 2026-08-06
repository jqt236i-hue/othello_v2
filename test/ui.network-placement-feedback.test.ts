describe('NetworkPlacementFeedbackController', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('shows a local pending-placement hint and removes it when its authoritative envelope arrives', () => {
    const { createNetworkPlacementFeedbackController } = require('../ui/network/placement-feedback');
    const session = { active: true, roomId: 'abc', sessionEpoch: 7 };
    const setPreviewHints = jest.fn();
    const controller = createNetworkPlacementFeedbackController({
      getSessionIdentity: () => session,
      setPreviewHints
    });

    const token = controller.beginPlacement({ row: 2, col: 3 });

    expect(token).toBe('network-placement:1');
    expect(setPreviewHints).toHaveBeenLastCalledWith([
      { cellKey: '2,3', kind: 'network-pending-placement' }
    ], undefined);
    expect(controller.bindOperation(token, {
      operationId: 'op-place-1',
      roomId: 'ABC',
      sessionEpoch: 7
    })).toBe(true);
    expect(controller.clearForEnvelope({ operationId: 'other-op', roomId: 'ABC' })).toBe(false);
    expect(controller.clearForEnvelope({ operationId: 'op-place-1', roomId: 'ABC' })).toBe(true);
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

    const firstToken = controller.beginPlacement({ row: 1, col: 1 });
    const secondToken = controller.beginPlacement({ row: 4, col: 5 });

    expect(controller.settlePlacement(firstToken, { ok: true })).toBe(false);
    expect(controller.getActiveFeedback()).toMatchObject({
      token: secondToken,
      cellKey: '4,5'
    });
    expect(controller.settlePlacement(secondToken, { ok: false, reason: 'PUBLISH_REJECTED' })).toBe(true);
    expect(setPreviewHints).toHaveBeenLastCalledWith([], undefined);
  });

  test('clears a stale-session indicator without applying an old envelope to the current session', () => {
    const { createNetworkPlacementFeedbackController } = require('../ui/network/placement-feedback');
    const session: any = { active: true, roomId: 'ABC', sessionEpoch: 3 };
    const setPreviewHints = jest.fn();
    const controller = createNetworkPlacementFeedbackController({
      getSessionIdentity: () => session,
      setPreviewHints
    });

    const token = controller.beginPlacement({ row: 6, col: 0 });
    controller.bindOperation(token, { operationId: 'op-session', roomId: 'ABC', sessionEpoch: 3 });
    session.roomId = 'DEF';
    session.sessionEpoch = 4;

    expect(controller.clearForEnvelope({ operationId: 'op-session', roomId: 'ABC' })).toBe(true);
    expect(setPreviewHints).toHaveBeenLastCalledWith([], { deferRender: true });
  });
});
