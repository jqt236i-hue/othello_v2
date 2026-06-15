describe('ui render scheduler', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    delete (global as any).window;
    delete (global as any).renderBoard;
    delete (global as any).renderCardUI;
    delete (global as any).updateStatus;
  });

  test('coalesces repeated board and card UI requests into one frame flush', () => {
    const scheduled: FrameRequestCallback[] = [];
    const renderBoard = jest.fn();
    const renderCardUI = jest.fn();
    const updateStatus = jest.fn();

    const { createRenderScheduler } = require('../ui/render-scheduler.js');
    const scheduler = createRenderScheduler({
      requestAnimationFrame: (cb: FrameRequestCallback) => {
        scheduled.push(cb);
        return scheduled.length;
      },
      cancelAnimationFrame: jest.fn(),
      renderBoard,
      renderCardUI,
      updateStatus,
      shouldDeferUiSync: () => false
    });

    expect(scheduler.requestBoardRender({ reason: 'a' })).toBe(true);
    expect(scheduler.requestBoardRender({ reason: 'b' })).toBe(true);
    expect(scheduler.requestCardUiRender({ reason: 'c' })).toBe(true);
    expect(scheduler.requestStatusUpdate({ reason: 'd' })).toBe(true);

    expect(scheduled).toHaveLength(1);
    expect(renderBoard).not.toHaveBeenCalled();
    expect(renderCardUI).not.toHaveBeenCalled();

    scheduled[0](16);

    expect(renderBoard).toHaveBeenCalledTimes(1);
    expect(renderCardUI).toHaveBeenCalledTimes(1);
    expect(updateStatus).toHaveBeenCalledTimes(1);
    expect(scheduler.getState()).toMatchObject({
      boardQueued: false,
      cardUiQueued: false,
      statusQueued: false,
      scheduled: false
    });
  });

  test('defers visual flush while playback or presentation work is active', () => {
    const scheduled: FrameRequestCallback[] = [];
    let busy = true;
    const renderBoard = jest.fn();

    const { createRenderScheduler } = require('../ui/render-scheduler.js');
    const scheduler = createRenderScheduler({
      requestAnimationFrame: (cb: FrameRequestCallback) => {
        scheduled.push(cb);
        return scheduled.length;
      },
      renderBoard,
      shouldDeferUiSync: () => busy
    });

    scheduler.requestBoardRender({ reason: 'during-playback' });
    scheduled[0](16);

    expect(renderBoard).not.toHaveBeenCalled();
    expect(scheduled).toHaveLength(2);

    busy = false;
    scheduled[1](32);

    expect(renderBoard).toHaveBeenCalledTimes(1);
  });

  test('flushNow renders synchronously and keeps board before card UI', () => {
    const calls: string[] = [];
    const { createRenderScheduler } = require('../ui/render-scheduler.js');
    const scheduler = createRenderScheduler({
      requestAnimationFrame: jest.fn(),
      renderBoard: () => calls.push('board'),
      renderCardUI: () => calls.push('card'),
      updateStatus: () => calls.push('status'),
      shouldDeferUiSync: () => false
    });

    scheduler.requestCardUiRender({ reason: 'card' });
    scheduler.requestBoardRender({ reason: 'board' });
    scheduler.requestStatusUpdate({ reason: 'status' });

    expect(scheduler.flushNow({ ignorePlayback: true })).toBe(true);
    expect(calls).toEqual(['board', 'card', 'status']);
  });
});
