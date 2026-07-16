import type { PresentationPlaybackEvent } from '../ui/board-visual/playback-types';
import {
  PIXI_THEORY_ROULETTE_DELAYS_MS,
  playPixiTheoryIncarnationEffect
} from '../ui/pixi/effects/theory-incarnation';

describe('Pixi theory incarnation effect', () => {
  test('keeps the MIDI-aligned 19-step roulette timeline', () => {
    expect(PIXI_THEORY_ROULETTE_DELAYS_MS).toEqual([
      62.5, 62.5, 62.5, 62.5, 62.5, 62.5, 62.5, 62.5,
      125, 125, 125, 125, 125, 125, 125,
      250, 250, 375, 250
    ]);
    expect(PIXI_THEORY_ROULETTE_DELAYS_MS).toHaveLength(19);
    expect(PIXI_THEORY_ROULETTE_DELAYS_MS.reduce((sum, value) => sum + value, 0))
      .toBe(2500);
  });

  test('does not reveal the selected cell first and releases roulette/materialize leases', async () => {
    let nextEffectId = 1;
    let nextGhostId = 1;
    const effects = new Map<number, any>();
    const ghosts = new Map<number, any>();
    const projected = new Map<string, any>();
    const updatesByEffect = new Map<number, any[]>();
    const releasedEffects: number[] = [];
    const releasedGhosts: number[] = [];
    const timeline = {
      run: jest.fn(async (options: any) => {
        const durationMs = Number(options.durationMs) || 0;
        const baseFrame = {
          runId: timeline.run.mock.calls.length,
          baseDurationMs: durationMs,
          durationMs,
          elapsedMs: 0,
          progress: 0,
          effectFamily: options.effectFamily || null,
          event: options.event,
          noAnimation: false,
          reducedMotion: false
        };
        options.onStart?.(baseFrame);
        options.onUpdate(0, baseFrame);
        options.onUpdate(1, {
          ...baseFrame,
          elapsedMs: durationMs,
          progress: 1
        });
        options.onComplete?.({
          runId: baseFrame.runId,
          durationMs,
          elapsedMs: durationMs,
          noAnimation: false,
          reducedMotion: false
        });
        return {
          runId: baseFrame.runId,
          durationMs,
          elapsedMs: durationMs,
          noAnimation: false,
          reducedMotion: false
        };
      })
    };
    const projection: any = {
      frame: { model: { topology: { playableKeys: ['0,0', '0,1', '0,2'] } } },
      scene: {},
      scope: {},
      timeline,
      timings: { theoryRouletteMs: 2500, theoryMaterializeMs: 2000 },
      noAnimation: false,
      reducedMotion: false,
      waitForTargetPrelude: jest.fn(async () => undefined),
      getPhaseSourceStone: jest.fn(() => null),
      getProjectedStone: jest.fn((row: number, col: number) => (
        projected.get(`${row},${col}`) || null
      )),
      setProjectedStone: jest.fn((row: number, col: number, visual: any) => {
        projected.set(`${row},${col}`, visual);
      }),
      acquireTransientGhost: jest.fn((row: number, col: number, stone: any) => {
        const handle = Object.freeze({ id: nextGhostId++ });
        ghosts.set(handle.id, { handle, row, col, stone });
        return handle;
      }),
      updateGhost: jest.fn((handle: any, update: any) => {
        ghosts.set(handle.id, { ...ghosts.get(handle.id), ...update });
      }),
      releaseGhost: jest.fn((handle: any) => {
        releasedGhosts.push(handle.id);
        ghosts.delete(handle.id);
      }),
      acquireHighlight: jest.fn(),
      releaseHighlight: jest.fn(),
      acquireEffect: jest.fn((options: any) => {
        const handle = Object.freeze({ id: nextEffectId++ });
        effects.set(handle.id, { handle, options });
        return handle;
      }),
      updateEffect: jest.fn((handle: any, update: any) => {
        const updates = updatesByEffect.get(handle.id) || [];
        updates.push(update);
        updatesByEffect.set(handle.id, updates);
        effects.set(handle.id, { ...effects.get(handle.id), ...update });
      }),
      releaseEffect: jest.fn((handle: any) => {
        releasedEffects.push(handle.id);
        effects.delete(handle.id);
      })
    };
    const event: PresentationPlaybackEvent = {
      type: 'theory_incarnation_spawn_roulette',
      durationMs: 2500,
      materializeMs: 2000,
      targets: [{
        row: 0,
        col: 2,
        selectedCell: { row: 0, col: 2 },
        candidateCells: [
          { row: 0, col: 0, value: 3 },
          { row: 0, col: 1, value: 5 },
          { row: 0, col: 2, value: 7 }
        ],
        ownerAfter: 'black',
        after: { owner: 'black', color: 1, special: 'GHOST' }
      }]
    } as any;

    await playPixiTheoryIncarnationEffect(event, projection);

    const acquiredOptions = projection.acquireEffect.mock.calls.map((call: any[]) => call[0]);
    expect(acquiredOptions).toEqual([
      expect.objectContaining({ row: 0, col: 0, label: 3 }),
      expect.objectContaining({ row: 0, col: 1, label: 5 }),
      expect.objectContaining({ row: 0, col: 2, label: 7 })
    ]);
    const selectedHandleId = 3;
    const firstRouletteUpdate = (id: number) => updatesByEffect.get(id)?.[1];
    expect(firstRouletteUpdate(selectedHandleId)).toEqual(expect.objectContaining({
      alpha: 0.16,
      scale: 0.96
    }));
    expect(Array.from(updatesByEffect.keys()).some((id) => (
      id !== selectedHandleId
        && firstRouletteUpdate(id)?.scale === 1.08
        && firstRouletteUpdate(id)?.alpha === 1
    ))).toBe(true);
    expect(projected.get('0,2')).toEqual(expect.objectContaining({
      stone: expect.objectContaining({
        owner: 'black',
        specialType: 'GHOST'
      })
    }));
    expect(releasedEffects).toEqual([3, 2, 1]);
    expect(releasedGhosts).toEqual([1]);
    expect(effects.size).toBe(0);
    expect(ghosts.size).toBe(0);
  });
});
