describe('controller event helpers', () => {
  afterEach(() => {
    jest.resetModules();
    delete global.GameEvents;
  });

  function requireControllerEventsWithRuntime() {
    const controllerEvents = require('../game/controller-events.js');
    controllerEvents.setControllerEventsRuntime({
      getGameEvents: () => global.GameEvents || null
    });
    return controllerEvents;
  }

  test('emitBoardUpdate returns true when GameEvents emits successfully', () => {
    const emit = jest.fn();
    global.GameEvents = {
      EVENT_TYPES: {
        BOARD_UPDATED: 'BOARD_UPDATED'
      },
      gameEvents: {
        emit
      }
    };

    const controllerEvents = requireControllerEventsWithRuntime();
    expect(controllerEvents.emitBoardUpdate()).toBe(true);
    expect(emit).toHaveBeenCalledWith('BOARD_UPDATED', null);
  });

  test('emitBoardUpdate warns and returns false when listener dispatch throws', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const failure = new Error('listener failed');
    global.GameEvents = {
      EVENT_TYPES: {
        BOARD_UPDATED: 'BOARD_UPDATED'
      },
      gameEvents: {
        emit: jest.fn(() => {
          throw failure;
        })
      }
    };

    try {
      const controllerEvents = requireControllerEventsWithRuntime();
      expect(controllerEvents.emitBoardUpdate({
        source: 'unit-test',
        reason: 'listener_throw'
      })).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(
        '[ControllerEvents] BOARD_UPDATED request failed (source=unit-test, reason=listener_throw)',
        failure
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  test('emitCardStateChange warns and returns false when no event bus is available', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const controllerEvents = requireControllerEventsWithRuntime();
      expect(controllerEvents.emitCardStateChange({
        source: 'unit-test',
        reason: 'missing_event_bus'
      })).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(
        '[ControllerEvents] CARD_STATE_CHANGED request unavailable (source=unit-test, reason=missing_event_bus)'
      );
    } finally {
      warnSpy.mockRestore();
    }
  });
});
