describe('NetworkPlacementFeedbackController', () => {
  function handFixture() {
    const { createNetworkPlacementFeedbackController } = require('../ui/network/placement-feedback');
    const session = { active: true, roomId: 'ABC', sessionEpoch: 1 };
    let contact: () => void = () => {};
    let options: any;
    const playPlacementHand = jest.fn((_owner, _row, _col, opts) => {
      options = opts;
      return new Promise<void>((resolve) => { contact = resolve; });
    });
    const controller = createNetworkPlacementFeedbackController({
      getSessionIdentity: () => session, setPreviewHints: jest.fn(), playPlacementHand
    });
    const token = controller.beginPlacement({ row: 2, col: 3 }, 'black');
    controller.bindOperation(token, { operationId: 'op-1', roomId: 'ABC', sessionEpoch: 1 });
    const frame = { operationId: 'op-1', playbackEvents: [
      { type: 'place_hand_animation', targets: [{ player: 'black', r: 2, col: 3 }] },
      { type: 'place', targets: [{ r: 2, col: 3 }] }
    ] };
    return { controller, token, frame, session, playPlacementHand, options, contact: () => contact() };
  }

  test('starts the hand at input time and joins its contact before suppressing only the matching replay', async () => {
    const f = handFixture();
    expect(f.playPlacementHand).toHaveBeenCalledTimes(1);
    expect(f.options.preserveInputLock).toBe(true);
    f.controller.acceptForIntake({ operationId: 'op-1', roomId: 'ABC' }, { enqueuedFrameCount: 1 });
    let completed = false;
    const prepared = f.controller.preparePlayback(f.frame).then((events) => { completed = true; return events; });
    await expect(f.options.waitForPlacement).resolves.toBe(true);
    expect(completed).toBe(false);
    f.contact();
    const events = await prepared;
    expect(events[0].meta.localPlacementHandComplete).toBe(true);
    expect(events[1]).toBe(f.frame.playbackEvents[1]);
    expect(f.frame.playbackEvents[0]).not.toHaveProperty('meta');
    expect((await f.controller.preparePlayback(f.frame))[0].meta.localPlacementHandComplete).toBe(true);
    expect(f.playPlacementHand).toHaveBeenCalledTimes(1);
  });

  test('does not approve a different operation, owner, or coordinate', async () => {
    const f = handFixture();
    const other = { ...f.frame, operationId: 'op-other' };
    expect(await f.controller.preparePlayback(other)).toBe(other.playbackEvents);
    expect(f.options.signal.aborted).toBe(false);
    const mismatched = { ...f.frame, playbackEvents: [
      { type: 'place_hand_animation', targets: [{ player: 'white', r: 2, col: 3 }] }
    ] };
    expect(await f.controller.preparePlayback(mismatched)).toBe(mismatched.playbackEvents);
    await expect(f.options.waitForPlacement).resolves.toBe(false);
    expect(f.options.signal.aborted).toBe(true);
  });

  test.each(['reject', 'leave'])('cancels an unconfirmed hand on %s without a placement replay skip', async (reason) => {
    const f = handFixture();
    if (reason === 'reject') f.controller.settlePlacement(f.token, { ok: false });
    else f.controller.clear();
    await expect(f.options.waitForPlacement).resolves.toBe(false);
    expect(f.options.signal.aborted).toBe(true);
    expect(await f.controller.preparePlayback(f.frame)).toBe(f.frame.playbackEvents);
  });

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
