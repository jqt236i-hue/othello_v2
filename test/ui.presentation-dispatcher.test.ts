import {
  dispatchPresentationPhase,
  normalizePresentationPhaseSoundEvents
} from '../ui/presentation/dispatcher';
import { PresentationPlaybackError } from '../ui/board-visual/playback-types';

describe('presentation dispatcher', () => {
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

  test('starts zombie source decoration before the board batch and shares its target gate', async () => {
    const calls: string[] = [];
    let resolvePrelude!: () => void;
    const prelude = new Promise<void>((resolve) => { resolvePrelude = resolve; });
    const target = {
      r: 2,
      col: 3,
      cause: 'ZOMBIE',
      reason: 'zombie_infection',
      meta: { sourceRow: 2, sourceCol: 2 }
    };
    const dispatch = dispatchPresentationPhase([{ type: 'flip', phase: 7, targets: [target] }], {
      playGlobalEvent(event) {
        calls.push(`global:${event.type}`);
        return prelude;
      },
      async playBoardPhase(_events, scope) {
        calls.push('board:start');
        await scope?.waitForTargetPrelude?.(_events[0], target);
        calls.push('board:settled');
      }
    });

    await Promise.resolve();
    expect(calls).toEqual(['global:zombie_bite_source_animation', 'board:start']);
    resolvePrelude();
    await dispatch;
    expect(calls).toEqual([
      'global:zombie_bite_source_animation',
      'board:start',
      'board:settled'
    ]);
  });

  test('settles each special DESTROY source trajectory before its matching Pixi target impact', async () => {
    const calls: string[] = [];
    const resolvers = new Map<string, () => void>();
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
    let boardSettled = false;
    const dispatch = dispatchPresentationPhase([event], {
      playGlobalEvent(globalEvent) {
        const target = globalEvent.target as any;
        const key = `${target.r},${target.col}`;
        calls.push(`global:${key}`);
        return new Promise<void>((resolve) => { resolvers.set(key, resolve); });
      },
      async playBoardPhase(events, scope) {
        expect(events).toEqual([event]);
        calls.push('board:start');
        await Promise.all([
          scope?.waitForTargetPrelude?.(event, sniper),
          scope?.waitForTargetPrelude?.(event, ordinary),
          scope?.waitForTargetPrelude?.(event, robot)
        ]);
        boardSettled = true;
        calls.push('board:settled');
      }
    });

    await Promise.resolve();
    expect(calls).toEqual(['global:1,1', 'global:4,4', 'board:start']);
    expect(boardSettled).toBe(false);
    resolvers.get('1,1')?.();
    await Promise.resolve();
    expect(boardSettled).toBe(false);
    resolvers.get('4,4')?.();
    await dispatch;
    expect(boardSettled).toBe(true);
    expect(calls).toEqual([
      'global:1,1',
      'global:4,4',
      'board:start',
      'board:settled'
    ]);
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
