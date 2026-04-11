describe('ui board update dispatch', () => {
  afterEach(() => {
    jest.resetModules();
    delete global.emitBoardUpdate;
    delete global.renderBoard;
  });

  test('prefers emitBoardUpdate when available', () => {
    global.emitBoardUpdate = jest.fn(() => true);
    global.renderBoard = jest.fn();

    const dispatch = require('../ui/board-update-dispatch');
    expect(dispatch.requestBoardUpdate({
      source: 'unit-test',
      reason: 'preferred_path'
    })).toBe(true);

    expect(global.emitBoardUpdate).toHaveBeenCalledWith({
      source: 'unit-test',
      reason: 'preferred_path'
    });
    expect(global.renderBoard).not.toHaveBeenCalled();
  });

  test('falls back to renderBoard when emitBoardUpdate is unavailable', () => {
    global.renderBoard = jest.fn();

    const dispatch = require('../ui/board-update-dispatch');
    expect(dispatch.requestBoardUpdate()).toBe(true);

    expect(global.renderBoard).toHaveBeenCalledTimes(1);
  });

  test('returns false and does not hide emitBoardUpdate failure behind renderBoard fallback', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    global.emitBoardUpdate = jest.fn(() => false);
    global.renderBoard = jest.fn();

    try {
      const dispatch = require('../ui/board-update-dispatch');
      expect(dispatch.requestBoardUpdate()).toBe(false);

      expect(global.emitBoardUpdate).toHaveBeenCalledTimes(1);
      expect(global.renderBoard).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith('[BoardUpdateDispatch] emitBoardUpdate reported failure');
    } finally {
      warnSpy.mockRestore();
    }
  });

  test('returns false and warns when emitBoardUpdate throws', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const failure = new Error('emit failed');
    global.emitBoardUpdate = jest.fn(() => {
      throw failure;
    });
    global.renderBoard = jest.fn();

    try {
      const dispatch = require('../ui/board-update-dispatch');
      expect(dispatch.requestBoardUpdate()).toBe(false);

      expect(warnSpy).toHaveBeenCalledWith('[BoardUpdateDispatch] emitBoardUpdate threw', failure);
      expect(global.renderBoard).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  test('returns false and warns when renderBoard fallback throws', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const failure = new Error('render failed');
    global.renderBoard = jest.fn(() => {
      throw failure;
    });

    try {
      const dispatch = require('../ui/board-update-dispatch');
      expect(dispatch.requestBoardUpdate()).toBe(false);

      expect(warnSpy).toHaveBeenCalledWith('[BoardUpdateDispatch] renderBoard fallback failed', failure);
    } finally {
      warnSpy.mockRestore();
    }
  });

  test('returns false when no board update entrypoint exists', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const dispatch = require('../ui/board-update-dispatch');
      expect(dispatch.requestBoardUpdate()).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith('[BoardUpdateDispatch] no board update entrypoint available');
    } finally {
      warnSpy.mockRestore();
    }
  });
});
