import * as BoardScene from '../ui/pixi/board-scene';
import { playPixiDestroyEffect } from '../ui/pixi/effects/destroy';
import {
  FakeContainer,
  FakeDisplayObject,
  FakeGraphics,
  renderedGraphicsBounds,
  createFakeRuntime,
  makeTopology,
  makeFrame
} from './helpers/pixi-board-scene-fixtures';

const SPECIAL_IMPACT_FAMILIES = Object.freeze([
  'will-hunter-king-slash',
  'lightning-impact',
  'destroy-dragon-impact',
  'meteor-god-impact',
  'super-crush-impact'
] as const);

function effectGraphics(scene: any): { root: FakeContainer; graphics: FakeGraphics } {
  const root = scene.layers.effect.children.find((child: FakeDisplayObject) => (
    child.label === 'pixi-playback-effect'
  )) as FakeContainer;
  const graphics = root.children.find((child) => (
    child.label === 'pixi-playback-effect-graphics'
  )) as FakeGraphics;
  return { root, graphics };
}

function pathExtent(graphics: FakeGraphics): { width: number; height: number } {
  const points = graphics.commands
    .filter((command) => command.op === 'moveTo' || command.op === 'lineTo')
    .map((command) => command.args as number[]);
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  return {
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys)
  };
}

describe('Pixi special destroy impact families', () => {
  test('each special destroy family paints its own silhouette inside the effect gutter', () => {
    const fixture = createFakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime: fixture.runtime });
    const topology = makeTopology({ baseRows: 8, baseCols: 8 });
    const frame = makeFrame({ topology, cellSize: 32 });
    scene.applyFrame(frame);
    const scope = scene.beginPlaybackScope('writer:impact-families');
    const gutterPx = scene.getDiagnostics().effectGutterCells * frame.layout.cellSize;
    const canvasWidth = frame.layout.camera.viewportWidth + gutterPx * 2;
    const canvasHeight = frame.layout.camera.viewportHeight + gutterPx * 2;
    const signatures = new Map<string, string>();

    for (const family of ['destroy', ...SPECIAL_IMPACT_FAMILIES]) {
      for (const placement of [{ row: 0, col: 0 }, { row: 7, col: 7 }, { row: 3, col: 4 }]) {
        const handle = scene.acquirePlaybackEffect(scope, {
          ...placement,
          family,
          kind: 'impact',
          tone: 'white',
          angle: Math.PI / 4
        });
        scene.updatePlaybackEffect(scope, handle, { alpha: 1, scale: 1.72, rotation: Math.PI * 0.36 });
        const { root, graphics } = effectGraphics(scene);
        const bounds = renderedGraphicsBounds(root, graphics);
        expect({
          family,
          insideCanvasGutter: bounds.minX >= -0.001
            && bounds.minY >= -0.001
            && bounds.maxX <= canvasWidth + 0.001
            && bounds.maxY <= canvasHeight + 0.001
        }).toEqual({ family, insideCanvasGutter: true });
        signatures.set(family, JSON.stringify(graphics.commands.map((command) => command.op)));
        scene.releasePlaybackEffect(scope, handle);
      }
    }

    expect(new Set(signatures.values()).size).toBe(signatures.size);
    scene.destroy();
  });

  test('the will hunter king slash follows the painted angle', () => {
    const fixture = createFakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime: fixture.runtime });
    scene.applyFrame(makeFrame({ topology: makeTopology({ baseRows: 8, baseCols: 8 }), cellSize: 32 }));
    const scope = scene.beginPlaybackScope('writer:slash-angle');
    const paint = (angle: number) => {
      const handle = scene.acquirePlaybackEffect(scope, {
        row: 3,
        col: 3,
        family: 'will-hunter-king-slash',
        kind: 'impact',
        tone: 'white',
        angle
      });
      expect(scene.getPlaybackEffect(handle)).toMatchObject({ angle });
      const extent = pathExtent(effectGraphics(scene).graphics);
      scene.releasePlaybackEffect(scope, handle);
      return extent;
    };

    const horizontal = paint(0);
    const vertical = paint(Math.PI / 2);
    expect(horizontal.width).toBeGreaterThan(horizontal.height * 3);
    expect(vertical.height).toBeGreaterThan(vertical.width * 3);
    scene.destroy();
  });

  function createImpactProjection() {
    const acquired: any[] = [];
    const updates: any[] = [];
    let nextId = 1;
    const projection: any = {
      timings: Object.freeze({ fadeOutMs: 50, destroySettlementMs: 70, moveMs: 40, positiveHighlightMinimumMs: 20 }),
      noAnimation: false,
      reducedMotion: false,
      timeline: {
        run: jest.fn(async (run: any) => {
          const frame = { noAnimation: false, reducedMotion: false, elapsedMs: run.durationMs };
          run.onStart?.(frame);
          run.onUpdate(0, frame);
          run.onUpdate(1, frame);
          return { durationMs: run.durationMs };
        })
      },
      waitForSourceTrajectories: async () => undefined,
      getPhaseSourceStone: () => null,
      getProjectedStone: () => null,
      setProjectedStone: jest.fn(),
      acquireTransientGhost: () => ({ id: nextId++, scopeId: 1 }),
      updateGhost: jest.fn(),
      releaseGhost: jest.fn(),
      acquireHighlight: () => ({ id: nextId++, scopeId: 1 }),
      releaseHighlight: jest.fn(),
      acquireEffect: jest.fn((options: any) => {
        acquired.push(options);
        return { id: nextId++, scopeId: 1 };
      }),
      updateEffect: jest.fn((_handle: any, update: any) => updates.push(update)),
      releaseEffect: jest.fn()
    };
    return { projection, acquired, updates };
  }

  test('DESTROY aims the slash from its source cell and keeps it from spinning', async () => {
    const { projection, acquired, updates } = createImpactProjection();
    await playPixiDestroyEffect({
      type: 'destroy',
      targets: [{
        r: 2,
        col: 5,
        cause: 'WILL_HUNTER_KING',
        reason: 'will_hunter_king_slash',
        meta: { sourceRow: 5, sourceCol: 2 }
      }]
    } as any, projection);

    expect(acquired).toEqual([expect.objectContaining({
      family: 'will-hunter-king-slash',
      kind: 'impact',
      angle: Math.atan2(2 - 5, 5 - 2)
    })]);
    expect(updates.length).toBeGreaterThan(0);
    expect(updates.every((update) => update.rotation === 0)).toBe(true);
    expect(projection.releaseEffect).toHaveBeenCalledTimes(1);
  });

  test('DESTROY falls back to the DOM default slash angle without a source cell', async () => {
    const { projection, acquired } = createImpactProjection();
    await playPixiDestroyEffect({
      type: 'destroy',
      targets: [{ r: 2, col: 5, cause: 'WILL_HUNTER_KING', reason: 'will_hunter_king_slash' }]
    } as any, projection);

    expect(acquired[0]).toMatchObject({ family: 'will-hunter-king-slash' });
    expect(acquired[0].angle).toBeCloseTo((-32 * Math.PI) / 180);
  });

  test('non-directional impacts keep their spin and carry no angle', async () => {
    const { projection, acquired, updates } = createImpactProjection();
    await playPixiDestroyEffect({
      type: 'destroy',
      targets: [{ r: 2, col: 5, cause: 'LIGHTNING_WILL', reason: 'lightning_destroyed' }]
    } as any, projection);

    expect(acquired).toEqual([expect.objectContaining({ family: 'lightning-impact', angle: 0 })]);
    expect(updates[updates.length - 1].rotation).toBeCloseTo(Math.PI * 0.36);
  });
});
