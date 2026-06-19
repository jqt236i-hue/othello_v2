import * as PlaybackPlanner from '../shared/playback-planner';

function createPlannerDeps(overrides: any = {}) {
  const deps: any = {
    createPlaybackPhaseState: jest.fn(() => ({
      currentPhase: 1,
      prevWasProliferationDestroy: false,
      superCrushPhase: null,
      superCrushActionId: null
    })),
    orderDeferredSpawnsForPlayback: jest.fn((events) => events),
    createPlaybackEventBase: jest.fn((event) => ({
      rawType: event.type,
      actionId: event.actionId || null
    })),
    createPlaybackEvent: jest.fn((base, type, phase, targets) => ({
      type,
      phase,
      targets: Array.isArray(targets) ? targets : [],
      ...base
    })),
    mapPassivePresentationEvent: jest.fn(() => false),
    mapBoardPresentationEvent: jest.fn((ctx) => {
      ctx.pEvent.type = String(ctx.ev.type || '').toLowerCase();
      ctx.pEvent.targets = [{ row: ctx.ev.row, col: ctx.ev.col }];
      return null;
    }),
    isDeferredSpawnPresentationEvent: jest.fn(() => false),
    populatePlaybackEventAfterState: jest.fn((playbackEvent, event) => {
      playbackEvent.after = { rawType: event.type };
    }),
    postProcessPlaybackEvents: jest.fn((events) => events)
  };
  return { ...deps, ...overrides };
}

describe('shared playback planner', () => {
  test('maps ordered presentation events through injected pure mappers', () => {
    const deps = createPlannerDeps();
    const out = PlaybackPlanner.planPlaybackEvents(
      [
        { type: 'SPAWN', row: 2, col: 3, actionId: 'a1' },
        { type: 'CHANGE', row: 2, col: 4, actionId: 'a1' }
      ],
      { turnIndex: 7 },
      { board: [] },
      deps
    );

    expect(out.map((event: any) => event.rawType)).toEqual(['SPAWN', 'CHANGE']);
    expect(out.map((event: any) => event.phase)).toEqual([1, 1]);
    expect(deps.populatePlaybackEventAfterState).toHaveBeenCalledTimes(2);
    expect(deps.postProcessPlaybackEvents).toHaveBeenCalledWith(out);
  });

  test('honors consumed presentation indexes and appends trailing playback events in order', () => {
    const deps = createPlannerDeps({
      mapBoardPresentationEvent: jest.fn((ctx) => {
        ctx.pEvent.type = String(ctx.ev.type || '').toLowerCase();
        if (ctx.ev.consumeNext) {
          ctx.consumedPresentationIndexes.add(ctx.presIndex + 1);
          ctx.trailingPlaybackEvents.push({
            type: 'tail',
            phase: ctx.phaseState.currentPhase + 1,
            targets: [],
            rawType: 'TAIL'
          });
        }
        return null;
      })
    });

    const out = PlaybackPlanner.planPlaybackEvents(
      [
        { type: 'MOVE', consumeNext: true },
        { type: 'CHANGE' },
        { type: 'DESTROY' }
      ],
      {},
      {},
      deps
    );

    expect(out.map((event: any) => event.type)).toEqual(['move', 'tail', 'destroy']);
  });

  test('skips a board event when mapper explicitly returns skip', () => {
    const deps = createPlannerDeps({
      mapBoardPresentationEvent: jest.fn((ctx) => {
        if (ctx.ev.skip) return { skip: true };
        ctx.pEvent.type = String(ctx.ev.type || '').toLowerCase();
        return null;
      })
    });

    const out = PlaybackPlanner.planPlaybackEvents(
      [
        { type: 'SPAWN', skip: true },
        { type: 'CHANGE' }
      ],
      {},
      {},
      deps
    );

    expect(out.map((event: any) => event.type)).toEqual(['change']);
  });
});
