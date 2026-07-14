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

  test('prepares one visual update and passes the same immutable frame context to every scheduled surface', () => {
    const prepared = Object.freeze({ frame: Object.freeze({ frameToken: 'idle:1' }) });
    const prepareBoardVisualUpdate = jest.fn(() => prepared);
    const renderBoard = jest.fn();
    const renderCardUI = jest.fn();
    const updateStatus = jest.fn();
    const { createRenderScheduler } = require('../ui/render-scheduler.js');
    const scheduler = createRenderScheduler({
      requestAnimationFrame: jest.fn(),
      prepareBoardVisualUpdate,
      renderBoard,
      renderCardUI,
      updateStatus,
      shouldDeferUiSync: () => false
    });

    scheduler.requestBoardRender('board');
    scheduler.requestBoardRender('board-again');
    scheduler.requestCardUiRender('cards');
    scheduler.requestStatusUpdate('status');
    scheduler.flushNow();

    expect(prepareBoardVisualUpdate).toHaveBeenCalledTimes(1);
    expect(renderBoard).toHaveBeenCalledWith(prepared);
    expect(renderCardUI).toHaveBeenCalledWith(prepared);
    expect(updateStatus).toHaveBeenCalledWith(prepared);
  });

  test('sends board frames to the controller path while deferring card and status UI', () => {
    const scheduled: FrameRequestCallback[] = [];
    let busy = true;
    const renderBoard = jest.fn();
    const renderCardUI = jest.fn();
    const updateStatus = jest.fn();

    const { createRenderScheduler } = require('../ui/render-scheduler.js');
    const scheduler = createRenderScheduler({
      requestAnimationFrame: (cb: FrameRequestCallback) => {
        scheduled.push(cb);
        return scheduled.length;
      },
      renderBoard,
      renderCardUI,
      updateStatus,
      shouldDeferUiSync: () => busy
    });

    scheduler.requestBoardRender({ reason: 'during-playback' });
    scheduler.requestCardUiRender({ reason: 'during-playback' });
    scheduler.requestStatusUpdate({ reason: 'during-playback' });
    scheduled[0](16);

    expect(renderBoard).toHaveBeenCalledTimes(1);
    expect(renderCardUI).not.toHaveBeenCalled();
    expect(updateStatus).not.toHaveBeenCalled();
    expect(scheduled).toHaveLength(2);

    busy = false;
    scheduled[1](32);

    expect(renderBoard).toHaveBeenCalledTimes(1);
    expect(renderCardUI).toHaveBeenCalledTimes(1);
    expect(updateStatus).toHaveBeenCalledTimes(1);
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

  test('flushNow ignorePlayback explicitly flushes board, card, and status in order', () => {
    const scheduled: FrameRequestCallback[] = [];
    const calls: string[] = [];
    let busy = true;
    const { createRenderScheduler } = require('../ui/render-scheduler.js');
    const scheduler = createRenderScheduler({
      requestAnimationFrame: (cb: FrameRequestCallback) => {
        scheduled.push(cb);
        return scheduled.length;
      },
      renderBoard: () => calls.push('board'),
      renderCardUI: () => calls.push('card'),
      updateStatus: () => calls.push('status'),
      shouldDeferUiSync: () => busy
    });

    scheduler.requestBoardRender({ reason: 'board' });
    scheduler.requestCardUiRender({ reason: 'card' });
    scheduler.requestStatusUpdate({ reason: 'status' });

    expect(scheduler.flushNow({ ignorePlayback: true })).toBe(true);
    expect(calls).toEqual(['board', 'card', 'status']);
    expect(scheduler.getState()).toMatchObject({
      boardQueued: false,
      cardUiQueued: false,
      statusQueued: false,
      deferredUntilIdle: false
    });
    expect(scheduled).toHaveLength(1);
  });

  test('ui requestCardUiSync still coalesces through scheduler-compatible state', async () => {
    jest.resetModules();
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    (global as any).requestAnimationFrame = (cb: FrameRequestCallback) => {
      cb(16);
      return 1;
    };
    (global as any).window.renderCardUI = jest.fn();
    (global as any).window.renderBoard = jest.fn();

    const ui = require('../ui.ts');
    expect(ui.requestCardUiSync('unit')).toBe(true);
    await Promise.resolve();

    expect((global as any).window.renderCardUI).toHaveBeenCalledTimes(1);

    dom.window.close();
    delete (global as any).window;
    delete (global as any).document;
    delete (global as any).requestAnimationFrame;
  });
});
