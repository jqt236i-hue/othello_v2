import {
  dispatchPresentationPhase,
  normalizePresentationPhaseSoundEvents
} from '../ui/presentation/dispatcher';
import {
  PresentationPlaybackError,
  isKnownGlobalPresentationEvent
} from '../ui/board-visual/playback-types';

describe('presentation dispatcher', () => {
  test('starts reincarnation sound once after visual resources are ready, even if the cue is first', async () => {
    const calls: string[] = [];
    await dispatchPresentationPhase([
      { type: 'sound_effect', phase: 1, targets: [{ soundKey: 'reincarnation_will' }] },
      { type: 'theory_incarnation_spawn_roulette', phase: 1, targets: [{ reincarnation: true }] }
    ], {
      async playBoardPhase(events, scope) {
        calls.push('prepare');
        await Promise.resolve();
        expect(calls).toEqual(['prepare']);
        scope?.onVisualStart?.(events);
        calls.push('draw');
        scope?.onVisualStart?.(events);
      },
      async playGlobalEvent() { calls.push('sound'); }
    });
    expect(calls).toEqual(['prepare', 'sound', 'draw']);
  });

  test('manifest is serial, then flip batch and non-flips launch in legacy order', async () => {
    const calls: string[] = [];
    const boardScopes: any[] = [];
    const gate = () => new Promise<void>((resolve) => {
      calls.push('await');
      resolve();
    });
    await dispatchPresentationPhase([
      { type: 'place', phase: 4 },
      { type: 'manifest_ending', phase: 4 },
      { type: 'flip', phase: 4, sequenceIndex: 9 },
      { type: 'log', phase: 4, message: 'x' },
      { type: 'flip', phase: 4, sequenceIndex: 1 },
      { type: 'spawn', phase: 4 }
    ], {
      playBoardPhase(events, scope) {
        calls.push(`board:${events.map((event) => event.type).join(',')}`);
        boardScopes.push(scope);
        return gate();
      },
      playManifestEndingGlobal() {
        calls.push('global:manifest_ending');
      },
      playGlobalEvent(event) {
        calls.push(`global:${event.type}`);
      }
    });

    expect(calls.filter((entry) => entry !== 'await')).toEqual([
      'board:manifest_ending',
      'global:manifest_ending',
      'board:flip,flip',
      'board:place',
      'global:log',
      'board:spawn'
    ]);
    expect(boardScopes[0]).not.toBe(boardScopes[1]);
    expect(boardScopes.slice(1)).toEqual([boardScopes[1], boardScopes[1], boardScopes[1]]);
    expect(boardScopes[1]).toEqual(expect.objectContaining({
      phaseKey: '4',
      stepIndex: 1,
      events: expect.arrayContaining([
        expect.objectContaining({ type: 'flip', sequenceIndex: 9 }),
        expect.objectContaining({ type: 'place' }),
        expect.objectContaining({ type: 'log' }),
        expect.objectContaining({ type: 'spawn' })
      ])
    }));
    expect(Object.isFrozen(boardScopes[1])).toBe(true);
    expect(Object.isFrozen(boardScopes[1].events)).toBe(true);
  });

  test('strict unknown event fails before any compatibility final-state write', async () => {
    const playBoardPhase = jest.fn();
    await expect(dispatchPresentationPhase([{ type: 'future_event', phase: 1 }], {
      strictNetworkPlayback: true,
      playBoardPhase,
      playGlobalEvent: jest.fn()
    })).rejects.toEqual(expect.objectContaining<Partial<PresentationPlaybackError>>({
      name: 'PresentationPlaybackError',
      code: 'presentation_event_unimplemented',
      strictNetworkPlayback: true
    }));
    expect(playBoardPhase).not.toHaveBeenCalled();
  });

  test('preflights the complete parallel step before flip, sound, or board launch', async () => {
    const calls: string[] = [];
    const unsupported = { type: 'crossfade_stone', phase: 3, row: 2, col: 2 };
    const error = new PresentationPlaybackError('board_event_unimplemented', unsupported, {
      strictNetworkPlayback: true
    });

    await expect(dispatchPresentationPhase([
      { type: 'place', phase: 3, targets: [] },
      { type: 'flip', phase: 3, targets: [] },
      { type: 'sound_effect', phase: 3, soundKey: 'stone_flip' },
      unsupported
    ], {
      strictNetworkPlayback: true,
      preflightBoardPhase(events) {
        calls.push(`preflight:${events.map((event) => event.type).join(',')}`);
        throw error;
      },
      playBoardPhase(events) {
        calls.push(`board:${events.map((event) => event.type).join(',')}`);
      },
      playGlobalEvent(event) {
        calls.push(`global:${event.type}`);
      }
    })).rejects.toBe(error);

    expect(calls).toEqual([
      'preflight:flip,place,sound_effect,crossfade_stone'
    ]);
  });

  test('does not consult the board backend for a pure-global planner step', async () => {
    const preflightBoardPhase = jest.fn();
    const playGlobalEvent = jest.fn();

    await dispatchPresentationPhase([
      { type: 'sound_effect', phase: 5, soundKey: 'stone_place' },
      { type: 'log', phase: 5, message: 'global only' }
    ], {
      preflightBoardPhase,
      playBoardPhase: jest.fn(),
      playGlobalEvent
    });

    expect(preflightBoardPhase).not.toHaveBeenCalled();
    expect(playGlobalEvent.mock.calls.map(([event]) => event.type)).toEqual([
      'sound_effect',
      'log'
    ]);
  });

  test('routes zombie flip only through the board backend without a synthetic global event', async () => {
    const target = {
      r: 2,
      col: 3,
      cause: 'ZOMBIE',
      reason: 'zombie_infection',
      meta: { sourceRow: 2, sourceCol: 2 }
    };
    const event = { type: 'flip', phase: 7, targets: [target] };
    const playGlobalEvent = jest.fn();
    const playBoardPhase = jest.fn();

    await dispatchPresentationPhase([event], {
      playGlobalEvent,
      playBoardPhase
    });

    expect(playGlobalEvent).not.toHaveBeenCalled();
    expect(playBoardPhase).toHaveBeenCalledTimes(1);
    expect(playBoardPhase).toHaveBeenCalledWith(
      [event],
      expect.objectContaining({ events: [event], phaseKey: '7', stepIndex: 0 })
    );
    expect(playBoardPhase.mock.calls[0][1]).not.toHaveProperty('waitForTargetPrelude');
  });

  test('routes special DESTROY targets unchanged through the board backend', async () => {
    const sniper = {
      r: 1,
      col: 1,
      sourceRow: 0,
      sourceCol: 0,
      cause: 'SNIPER_WILL',
      reason: 'sniper_shot'
    };
    const robot = {
      r: 4,
      col: 4,
      sourceRow: 6,
      sourceCol: 6,
      cause: 'ROBOT_VACUUM',
      reason: 'robot_vacuum_suck'
    };
    const ordinary = {
      r: 2,
      col: 2,
      cause: 'SYSTEM',
      reason: 'board_effect'
    };
    const event = { type: 'destroy', phase: 9, targets: [sniper, ordinary, robot] };
    const playGlobalEvent = jest.fn();
    const playBoardPhase = jest.fn();

    await dispatchPresentationPhase([event], {
      playGlobalEvent,
      playBoardPhase
    });

    expect(playGlobalEvent).not.toHaveBeenCalled();
    expect(playBoardPhase).toHaveBeenCalledWith(
      [event],
      expect.objectContaining({ events: [event], phaseKey: '9', stepIndex: 0 })
    );
    expect(playBoardPhase.mock.calls[0][0][0].targets).toEqual([sniper, ordinary, robot]);
    expect(playBoardPhase.mock.calls[0][1]).not.toHaveProperty('waitForTargetPrelude');
  });

  test('synthetic source event names are not public global presentation events', () => {
    expect(isKnownGlobalPresentationEvent({ type: 'destroy_source_animation' })).toBe(false);
    expect(isKnownGlobalPresentationEvent({ type: 'zombie_bite_source_animation' })).toBe(false);
  });

  test('local unknown event uses the exclusive DOM compatibility board port', async () => {
    const playBoardPhase = jest.fn();
    const event = { type: 'legacy_event', phase: 2, targets: [{ r: 1, col: 2 }] };
    await dispatchPresentationPhase([event], {
      playBoardPhase,
      playGlobalEvent: jest.fn()
    });
    expect(playBoardPhase).toHaveBeenCalledWith(
      [expect.objectContaining({ type: '__dom_compatibility_final_state', sourceEvent: event })],
      expect.objectContaining({ phaseKey: '2', stepIndex: 0 })
    );
  });

  test('treasure sound suppression keeps stable event order', () => {
    const events = [
      { type: 'log', message: 'before' },
      { type: 'sound_effect', targets: [{ soundKey: 'charge_gain_common' }] },
      { type: 'sound_effect', targets: [{ soundKey: 'treasure_gain' }] },
      { type: 'log', message: 'after' }
    ];
    expect(normalizePresentationPhaseSoundEvents(events).map((event) => (
      event.type === 'log' ? event.message : (event.targets?.[0] as { soundKey: string }).soundKey
    ))).toEqual(['before', 'treasure_gain', 'after']);
  });
});
