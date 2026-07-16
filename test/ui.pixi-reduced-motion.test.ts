import type { PresentationPlaybackEvent } from '../ui/board-visual/playback-types';
import { createPlaybackStoneVisual } from '../ui/pixi/effects/common';
import { playPixiDestroyEffect } from '../ui/pixi/effects/destroy';
import { playPixiFlipEffect } from '../ui/pixi/effects/flip';
import { playPixiMoveEffect } from '../ui/pixi/effects/move';
import { playPixiPlaceEffect } from '../ui/pixi/effects/place';
import { playPixiSpawnEffect } from '../ui/pixi/effects/spawn';
import { playPixiStatusEffect } from '../ui/pixi/effects/status';
import type {
  PixiBoardEffectPlayer,
  PixiBoardEffectProjection,
  PixiBoardEffectTimings
} from '../ui/pixi/effects/types';
import type {
  PixiTimelineFrame,
  PixiTimelineRunOptions,
  PixiTimelineRunResult
} from '../ui/pixi/timeline';

const TIMINGS: PixiBoardEffectTimings = Object.freeze({
  flipMs: 40,
  fadeOutMs: 50,
  destroySettlementMs: 70,
  breedingSpawnFadeMs: 50,
  moveMs: 40,
  overlayCrossfadeMs: 60,
  regenConsumeFadeMs: 50,
  positiveHighlightMinimumMs: 20,
  zombieBiteMs: 80,
  teleportPulseMs: 14
});

type PlaybackVisual = NonNullable<ReturnType<typeof createPlaybackStoneVisual>>;

interface EffectHarness {
  readonly projection: PixiBoardEffectProjection;
  readonly durations: number[];
  readonly initialSnapshots: Array<{
    readonly ghostCount: number;
    readonly highlightCount: number;
    readonly ghostAlphas: readonly number[];
  }>;
  readonly releasedGhostCount: () => number;
  readonly projectedStone: (row: number, col: number) => PlaybackVisual | null;
}

function stone(owner: 'black' | 'white', special: string | null = null): PlaybackVisual {
  const visual = createPlaybackStoneVisual({
    owner,
    color: owner === 'black' ? 1 : -1,
    special
  });
  if (!visual) throw new Error('test stone must be renderable');
  return visual;
}

function createFrame(): any {
  const playableKeys = Object.freeze(Array.from({ length: 64 }, (_unused, index) => (
    `${Math.floor(index / 8)},${index % 8}`
  )));
  return Object.freeze({
    model: Object.freeze({
      topology: Object.freeze({
        minRow: 0,
        maxRow: 7,
        minCol: 0,
        maxCol: 7,
        renderRowOffset: 0,
        renderColOffset: 0,
        playableKeys
      })
    }),
    layout: Object.freeze({
      cellSize: 32,
      frameInset: Object.freeze({ top: 0, right: 0, bottom: 0, left: 0 }),
      camera: Object.freeze({ scrollLeft: 0, scrollTop: 0 })
    })
  });
}

function createEffectHarness(options: {
  readonly reducedMotion: boolean;
  readonly stones?: ReadonlyArray<readonly [number, number, PlaybackVisual]>;
}): EffectHarness {
  let nextGhostId = 1;
  let nextHighlightId = 1;
  let releasedGhosts = 0;
  const durations: number[] = [];
  const initialSnapshots: EffectHarness['initialSnapshots'] = [];
  const projectedStones = new Map<string, PlaybackVisual | null>();
  const ghosts = new Map<number, { alpha: number; [key: string]: any }>();
  const highlights = new Map<number, unknown>();
  for (const [row, col, visual] of options.stones || []) {
    projectedStones.set(`${row},${col}`, visual);
  }
  const phaseSourceStones = new Map(projectedStones);

  const frameFor = (
    runId: number,
    durationMs: number,
    elapsedMs: number,
    progress: number,
    run: PixiTimelineRunOptions
  ): PixiTimelineFrame => Object.freeze({
    runId,
    baseDurationMs: run.durationMs,
    effectFamily: run.effectFamily || null,
    event: run.event,
    noAnimation: false,
    reducedMotion: options.reducedMotion,
    durationMs,
    elapsedMs,
    progress
  });

  const timeline: any = {
    run: jest.fn(async (run: PixiTimelineRunOptions): Promise<PixiTimelineRunResult> => {
      const durationMs = Math.max(0, Number(run.durationMs) || 0);
      const runId = durations.length + 1;
      durations.push(durationMs);
      const initialFrame = frameFor(runId, durationMs, 0, 0, run);
      run.onStart?.(initialFrame);
      run.onUpdate(0, initialFrame);
      initialSnapshots.push(Object.freeze({
        ghostCount: ghosts.size,
        highlightCount: highlights.size,
        ghostAlphas: Object.freeze(Array.from(ghosts.values(), (ghost) => ghost.alpha))
      }));
      const finalFrame = frameFor(runId, durationMs, durationMs, 1, run);
      run.onUpdate(1, finalFrame);
      const result = Object.freeze({
        runId,
        durationMs,
        elapsedMs: durationMs,
        noAnimation: false,
        reducedMotion: options.reducedMotion
      });
      run.onComplete?.(result);
      return result;
    }),
    abort: jest.fn(() => 0),
    destroy: jest.fn(),
    getDiagnostics: jest.fn(() => ({ state: 'idle' }))
  };

  const projection: PixiBoardEffectProjection = {
    frame: createFrame(),
    scene: {} as any,
    scope: Object.freeze({ id: 1, key: 'reduced-motion-test' }) as any,
    timeline,
    timings: TIMINGS,
    noAnimation: false,
    reducedMotion: options.reducedMotion,
    getPhaseSourceStone(row, col) {
      return phaseSourceStones.get(`${row},${col}`) || null;
    },
    getProjectedStone(row, col) {
      return projectedStones.get(`${row},${col}`) || null;
    },
    setProjectedStone(row, col, visual) {
      projectedStones.set(`${row},${col}`, visual);
    },
    acquireTransientGhost(row, col, visual) {
      const handle = Object.freeze({ id: nextGhostId++, scopeId: 1 });
      ghosts.set(handle.id, { row, col, visual, alpha: 1 });
      return handle as any;
    },
    updateGhost(handle, update) {
      const current = ghosts.get(handle.id);
      if (current) ghosts.set(handle.id, { ...current, ...update });
    },
    releaseGhost(handle) {
      if (ghosts.delete(handle.id)) releasedGhosts += 1;
    },
    acquireHighlight(row, col, tone) {
      const handle = Object.freeze({ id: nextHighlightId++, scopeId: 1 });
      highlights.set(handle.id, { row, col, tone });
      return handle as any;
    },
    releaseHighlight(handle) {
      highlights.delete(handle.id);
    }
  };

  return {
    projection,
    durations,
    initialSnapshots,
    releasedGhostCount: () => releasedGhosts,
    projectedStone: (row, col) => projectedStones.get(`${row},${col}`) || null
  };
}

async function run(
  player: PixiBoardEffectPlayer,
  event: PresentationPlaybackEvent,
  options: Parameters<typeof createEffectHarness>[0]
): Promise<EffectHarness> {
  const harness = createEffectHarness(options);
  await player(event, harness.projection);
  return harness;
}

describe('Pixi basic-effect reduced-motion parity', () => {
  test.each([
    {
      name: 'PLACE highlight',
      player: playPixiPlaceEffect,
      durationMs: 20,
      event: {
        type: 'place',
        targets: [{
          r: 1,
          col: 1,
          owner: 'black',
          cause: 'SYSTEM',
          reason: 'standard_place',
          meta: { placementKind: 'normal_placement' },
          after: { owner: 'black', color: 1 }
        }]
      }
    },
    {
      name: 'ordinary FLIP',
      player: playPixiFlipEffect,
      durationMs: 40,
      stones: [[2, 2, stone('black')]] as const,
      event: {
        type: 'flip',
        targets: [{
          r: 2,
          col: 2,
          cause: 'SYSTEM',
          before: { owner: 'black', color: 1 },
          after: { owner: 'white', color: -1 }
        }]
      }
    },
    {
      name: 'breeding SPAWN',
      player: playPixiSpawnEffect,
      durationMs: 50,
      event: {
        type: 'spawn',
        targets: [{
          r: 3,
          col: 3,
          cause: 'BREEDING',
          reason: 'breeding_spawn_adjacent',
          after: { owner: 'black', color: 1, special: 'BREEDING' }
        }]
      }
    },
    {
      name: 'ordinary MOVE',
      player: playPixiMoveEffect,
      durationMs: 40,
      stones: [[4, 4, stone('black')]] as const,
      event: {
        type: 'move',
        targets: [{
          from: { r: 4, col: 4 },
          to: { r: 4, col: 5 },
          cause: 'HYPERACTIVE',
          reason: 'hyperactive_move',
          before: { owner: 'black', color: 1 },
          after: { owner: 'black', color: 1 }
        }]
      }
    },
    {
      name: 'STATUS crossfade',
      player: playPixiStatusEffect,
      durationMs: 60,
      stones: [[5, 5, stone('black')]] as const,
      event: {
        type: 'status_applied',
        rawType: 'STATUS_APPLIED',
        meta: { special: 'GUARD' },
        targets: [{
          r: 5,
          col: 5,
          before: { owner: 'black', color: 1 },
          after: { owner: 'black', color: 1, special: 'GUARD', timer: 2 }
        }]
      }
    }
  ])('$name keeps its existing duration instead of becoming NOANIM', async ({
    player,
    durationMs,
    event,
    stones
  }) => {
    const harness = await run(player, event, {
      reducedMotion: true,
      stones
    });

    expect(harness.durations).toEqual([durationMs]);
    expect(harness.initialSnapshots[0]).toEqual(expect.objectContaining({
      ghostCount: expect.any(Number),
      highlightCount: expect.any(Number)
    }));
  });

  test('zombie FLIP omits the bite but keeps the target-highlight minimum', async () => {
    const event: PresentationPlaybackEvent = {
      type: 'flip',
      targets: [{
        r: 2,
        col: 2,
        cause: 'ZOMBIE',
        reason: 'zombie_infection',
        before: { owner: 'black', color: 1 },
        after: { owner: 'white', color: -1, special: 'ZOMBIE' }
      }]
    };
    const reduced = await run(playPixiFlipEffect, event, {
      reducedMotion: true,
      stones: [[2, 2, stone('black')]]
    });
    const normal = await run(playPixiFlipEffect, event, {
      reducedMotion: false,
      stones: [[2, 2, stone('black')]]
    });

    expect(reduced.durations).toEqual([TIMINGS.positiveHighlightMinimumMs]);
    expect(reduced.initialSnapshots[0]).toMatchObject({
      ghostCount: 0,
      highlightCount: 1
    });
    expect(reduced.projectedStone(2, 2)?.stone).toMatchObject({
      owner: 'white',
      specialType: 'ZOMBIE'
    });
    expect(normal.durations).toEqual([TIMINGS.zombieBiteMs]);
    expect(normal.initialSnapshots[0]).toMatchObject({
      ghostCount: 1,
      highlightCount: 1
    });
  });

  test.each([
    {
      name: 'live source',
      durationMs: TIMINGS.destroySettlementMs,
      stones: [[3, 3, stone('black')]] as const
    },
    {
      name: 'source-empty event ghost',
      durationMs: TIMINGS.fadeOutMs,
      stones: [] as const
    }
  ])('DESTROY $name hides its fade visual immediately but preserves settlement', async ({
    durationMs,
    stones
  }) => {
    const event: PresentationPlaybackEvent = {
      type: 'destroy',
      targets: [{
        r: 3,
        col: 3,
        ownerBefore: 'black',
        cause: 'SYSTEM',
        reason: 'board_effect',
        before: { owner: 'black', color: 1 }
      }]
    };
    const reduced = await run(playPixiDestroyEffect, event, {
      reducedMotion: true,
      stones
    });
    const normal = await run(playPixiDestroyEffect, event, {
      reducedMotion: false,
      stones
    });

    expect(reduced.durations).toEqual([durationMs]);
    expect(reduced.initialSnapshots[0]).toMatchObject({
      ghostCount: 0,
      ghostAlphas: []
    });
    expect(reduced.releasedGhostCount()).toBe(1);
    expect(reduced.projectedStone(3, 3)).toBeNull();

    expect(normal.durations).toEqual([durationMs]);
    expect(normal.initialSnapshots[0]).toMatchObject({
      ghostCount: 1,
      ghostAlphas: [1]
    });
  });
});
