describe('controller event helpers', () => {
  afterEach(() => {
    jest.resetModules();
    delete global.GameEvents;
  });

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

    import * as controllerEvents from '../game/controller-events.js';
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
      import * as controllerEvents from '../game/controller-events.js';
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
      import * as controllerEvents from '../game/controller-events.js';
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
