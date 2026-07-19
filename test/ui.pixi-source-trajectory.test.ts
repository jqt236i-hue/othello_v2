import * as BoardVisualModel from '../ui/board-visual/model';
import {
  BOARD_SOURCE_TRAJECTORY_PROFILE_REGISTRY,
  collectBoardSourceTrajectoryRequests,
  type BoardSourceTrajectoryProfileKey,
  type BoardSourceTrajectoryRequest
} from '../ui/board-visual/source-trajectory';
import * as Theme from '../ui/board-visual/theme';
import * as BoardScene from '../ui/pixi/board-scene';
import {
  buildPixiSourceTrajectoryVisualState,
  createPixiSourceTrajectoryRenderer,
  resolvePixiSourceTrajectoryTiming
} from '../ui/pixi/effects/source-trajectory';
import type { PixiTimelineRunOptions } from '../ui/pixi/timeline';
import {
  BOARD_SOURCE_TRAJECTORY_BASELINE_FIXTURES,
  resolveBaselineDurationMs
} from './fixtures/board-source-trajectory-contract';

class FakePoint {
  x = 0;
  y = 0;
  set(x: number, y = x) { this.x = x; this.y = y; }
}

class FakeDisplayObject {
  label = '';
  name = '';
  parent: FakeDisplayObject | null = null;
  children: FakeDisplayObject[] = [];
  position = new FakePoint();
  scale = new FakePoint();
  anchor = new FakePoint();
  pivot = new FakePoint();
  visible = true;
  alpha = 1;
  rotation = 0;
  width = 0;
  height = 0;
  eventMode = 'none';
  cursor = 'default';
  hitArea: any = null;
  sortableChildren = false;
  destroyed = false;

  constructor(options?: any) {
    this.label = String(options?.label || '');
    this.name = this.label;
  }

  addChild(...values: FakeDisplayObject[]) {
    for (const value of values) {
      value.removeFromParent();
      value.parent = this;
      this.children.push(value);
    }
    return values[0];
  }

  removeChild(value: FakeDisplayObject) {
    const index = this.children.indexOf(value);
    if (index >= 0) this.children.splice(index, 1);
    if (value.parent === this) value.parent = null;
    return value;
  }

  removeChildren() {
    const removed = this.children.slice();
    this.children.length = 0;
    removed.forEach((child) => { child.parent = null; });
    return removed;
  }

  removeFromParent() { this.parent?.removeChild(this); }

  destroy(options?: { children?: boolean }) {
    if (this.destroyed) return;
    this.removeFromParent();
    if (options?.children) this.removeChildren().forEach((child) => child.destroy({ children: true }));
    this.destroyed = true;
  }
}

class FakeContainer extends FakeDisplayObject {}

class FakeGraphics extends FakeDisplayObject {
  commands: any[] = [];
  clear() { this.commands = []; return this; }
  rect(...args: any[]) { this.commands.push(['rect', ...args]); return this; }
  roundRect(...args: any[]) { this.commands.push(['roundRect', ...args]); return this; }
  circle(...args: any[]) { this.commands.push(['circle', ...args]); return this; }
  ellipse(...args: any[]) { this.commands.push(['ellipse', ...args]); return this; }
  poly(...args: any[]) { this.commands.push(['poly', ...args]); return this; }
  moveTo(...args: any[]) { this.commands.push(['moveTo', ...args]); return this; }
  lineTo(...args: any[]) { this.commands.push(['lineTo', ...args]); return this; }
  fill(style: any) { this.commands.push(['fill', style]); return this; }
  stroke(style: any) { this.commands.push(['stroke', style]); return this; }
}

class FakeSprite extends FakeDisplayObject {
  texture: any = null;
  constructor(options?: any) {
    super(options);
    this.texture = options && Object.prototype.hasOwnProperty.call(options, 'texture')
      ? options.texture
      : options;
  }
}

class FakeText extends FakeDisplayObject {
  text = '';
  style: any = {};
  constructor(options?: any, style?: any) {
    super(options && typeof options === 'object' ? options : undefined);
    this.text = typeof options === 'object' ? String(options.text || '') : String(options || '');
    this.style = typeof options === 'object' ? options.style || {} : style || {};
  }
}

function fakeRuntime() {
  return {
    Container: FakeContainer,
    Graphics: FakeGraphics,
    Sprite: FakeSprite,
    Text: FakeText,
    Texture: { EMPTY: { id: 'empty' } }
  };
}

function rectangleKeys(minRow: number, maxRow: number, minCol: number, maxCol: number): string[] {
  const keys: string[] = [];
  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) keys.push(`${row},${col}`);
  }
  return keys;
}

function makeFrame(options: {
  revision?: number;
  scrollLeft?: number;
  scrollTop?: number;
  viewportCells?: number;
  orientation?: 'normal' | 'rotated-180';
  minRow?: number;
  maxRow?: number;
  minCol?: number;
  maxCol?: number;
} = {}): any {
  const minRow = options.minRow ?? 0;
  const maxRow = options.maxRow ?? 7;
  const minCol = options.minCol ?? 0;
  const maxCol = options.maxCol ?? 7;
  const keys = rectangleKeys(minRow, maxRow, minCol, maxCol);
  const topology = {
    baseRows: 8,
    baseCols: 8,
    minRow,
    maxRow,
    minCol,
    maxCol,
    renderRowOffset: -minRow,
    renderColOffset: -minCol,
    renderRows: maxRow - minRow + 1,
    renderCols: maxCol - minCol + 1,
    existingKeys: keys,
    playableKeys: keys,
    holeKeys: []
  };
  const cells = keys.map((key) => {
    const [row, col] = key.split(',').map(Number);
    return {
      key,
      row,
      col,
      renderRow: row - minRow,
      renderCol: col - minCol,
      kind: 'playable',
      expansionSide: null,
      boundaryEdges: { top: 'none', right: 'none', bottom: 'none', left: 'none' },
      stone: null,
      markers: [],
      interaction: {
        legal: false,
        legalFree: false,
        tabooLegal: false,
        selectable: false,
        interactionLocked: false,
        hovered: false,
        keyboardCursor: false,
        previewKinds: [],
        selected: false,
        selectionKinds: [],
        directionHints: [],
        directionHintIds: [],
        localPendingHintIds: []
      }
    };
  });
  const model = BoardVisualModel.createBoardRenderModel({ visualRevision: options.revision || 1, topology, cells });
  const cellSize = 32;
  const viewportCells = options.viewportCells || 4;
  return {
    frameToken: `trajectory-frame:${options.revision || 1}`,
    model,
    layout: {
      revision: options.revision || 1,
      cellSize,
      dpr: 1,
      stageScale: 1,
      cellScale: 1,
      orientation: options.orientation || 'normal',
      frameInset: { top: 0, right: 0, bottom: 0, left: 0 },
      clientOrigin: { x: 0, y: 0 },
      visualViewport: { scale: 1, offsetLeft: 0, offsetTop: 0 },
      camera: {
        scrollLeft: options.scrollLeft || 0,
        scrollTop: options.scrollTop || 0,
        viewportWidth: viewportCells * cellSize,
        viewportHeight: viewportCells * cellSize
      },
      logicalWidth: (maxCol - minCol + 1) * cellSize,
      logicalHeight: (maxRow - minRow + 1) * cellSize,
      visibleWorldWindow: {
        minRow,
        maxRow: Math.min(maxRow, minRow + viewportCells - 1),
        minCol,
        maxCol: Math.min(maxCol, minCol + viewportCells - 1)
      }
    },
    appearance: {
      boardSkinId: 'board-default',
      boardImageUrl: '',
      boardFrameSkinId: 'frame-default',
      boardFrameLayout: {},
      stoneSkinId: 'stone-default',
      blackStoneImageUrl: '',
      whiteStoneImageUrl: '',
      revision: options.revision || 1
    },
    theme: Theme.createBoardVisualThemeDescriptor({ revision: options.revision || 1 })
  };
}

function requestFor(
  profileKey: BoardSourceTrajectoryProfileKey,
  source = { row: 1, col: 1 },
  target = { row: 4, col: 4 }
): BoardSourceTrajectoryRequest {
  const fixture = BOARD_SOURCE_TRAJECTORY_BASELINE_FIXTURES.find((candidate) => candidate.profileKey === profileKey)!;
  const targetPayload = {
    r: target.row,
    col: target.col,
    ownerBefore: 'black',
    ownerAfter: 'white',
    projectileOwner: 'white',
    cause: fixture.cause,
    reason: fixture.reason,
    before: { owner: 'black', color: 1 },
    after: { owner: 'white', color: -1, special: profileKey === 'zombieBite' ? 'ZOMBIE' : null },
    meta: { sourceRow: source.row, sourceCol: source.col }
  };
  const batch = collectBoardSourceTrajectoryRequests([{
    type: fixture.eventType,
    presentationBatchId: 'trajectory-test:1',
    targets: [targetPayload]
  }], { phaseKey: 'trajectory-test', stepIndex: 0 });
  const request = batch.requests[0];
  if (!request) throw new Error(`test request was not classified: ${profileKey}`);
  return request;
}

function geometry(options: {
  distance?: number;
  visible?: boolean;
  direction?: 'source-to-target' | 'target-to-source';
} = {}): BoardScene.PixiSourceTrajectoryGeometrySnapshot {
  const distance = options.distance ?? 200;
  const sourceCenter = Object.freeze({ x: 20, y: 100 });
  const targetCenter = Object.freeze({ x: 20 + distance, y: 100 });
  const direction = options.direction || 'source-to-target';
  const movementStart = direction === 'source-to-target' ? sourceCenter : targetCenter;
  const movementEnd = direction === 'source-to-target' ? targetCenter : sourceCenter;
  const visibleClip = Object.freeze({ left: 0, top: 0, right: 256, bottom: 256, width: 256, height: 256 });
  return Object.freeze({
    frameToken: 'geometry:1',
    layoutRevision: 1,
    topologySignature: '8:8:normal',
    direction,
    cellSize: 32,
    sourceCenter,
    targetCenter,
    movementStart,
    movementEnd,
    distancePx: distance,
    angleRad: direction === 'source-to-target' ? 0 : Math.PI,
    visibleClip,
    paintedHaloClip: Object.freeze({ left: -64, top: -64, right: 320, bottom: 320, width: 384, height: 384 }),
    visibleSegment: options.visible === false
      ? null
      : Object.freeze({ start: movementStart, end: movementEnd, startT: 0, endT: 1 })
  });
}

function createManualTimeline() {
  let nextRunId = 1;
  const pending: Array<{
    run: PixiTimelineRunOptions;
    durationMs: number;
    resolve: (value: any) => void;
    reject: (error: unknown) => void;
    settled: boolean;
  }> = [];
  const timeline: any = {
    run: jest.fn((run: PixiTimelineRunOptions) => {
      const durationMs = Math.max(0, Number(run.durationMs) || 0);
      const runId = nextRunId++;
      return new Promise((resolve, reject) => {
        const entry = { run, durationMs, resolve, reject, settled: false };
        pending.push(entry);
        const frame = {
          runId,
          baseDurationMs: durationMs,
          effectFamily: run.effectFamily || null,
          event: run.event,
          noAnimation: durationMs === 0,
          reducedMotion: false,
          durationMs,
          elapsedMs: 0,
          progress: 0
        };
        run.onStart?.(frame);
        run.onUpdate(0, frame);
      });
    }),
    finishAll() {
      for (let index = 0; index < pending.length; index += 1) {
        const entry = pending[index];
        if (entry.settled) continue;
        entry.settled = true;
        const frame = {
          runId: index + 1,
          baseDurationMs: entry.durationMs,
          effectFamily: entry.run.effectFamily || null,
          event: entry.run.event,
          noAnimation: entry.durationMs === 0,
          reducedMotion: false,
          durationMs: entry.durationMs,
          elapsedMs: entry.durationMs,
          progress: 1
        };
        entry.run.onUpdate(1, frame);
        const result = { runId: index + 1, durationMs: entry.durationMs, elapsedMs: entry.durationMs, noAnimation: false, reducedMotion: false };
        entry.run.onComplete?.(result);
        entry.resolve(result);
      }
    },
    abort(reason = new Error('aborted')) {
      let count = 0;
      for (const entry of pending) {
        if (entry.settled) continue;
        entry.settled = true;
        count += 1;
        entry.reject(reason);
      }
      return count;
    },
    get runs() { return pending; },
    getDiagnostics: () => ({ activeRunCount: pending.filter((entry) => !entry.settled).length })
  };
  return timeline;
}

function createMockScene(snapshot: BoardScene.PixiSourceTrajectoryGeometrySnapshot, log: string[] = []) {
  let nextId = 1;
  const records = new Map<number, any>();
  const scope = Object.freeze({ id: 1, key: 'trajectory-scope' });
  const scene: any = {
    snapshotSourceTrajectoryGeometry: jest.fn(() => snapshot),
    acquireSourceTrajectory: jest.fn((_scope: any, options: any) => {
      const handle = Object.freeze({ id: nextId++, scopeId: scope.id });
      records.set(handle.id, { handle, options, visual: null });
      log.push(`source:${options.trajectoryId}`);
      return handle;
    }),
    updateSourceTrajectory: jest.fn((_scope: any, handle: any, visual: any) => {
      const current = records.get(handle.id);
      if (current) current.visual = visual;
    }),
    releaseSourceTrajectory: jest.fn((_scope: any, handle: any) => {
      const current = records.get(handle.id);
      if (!current) return;
      records.delete(handle.id);
      current.options.textureLease?.release();
    }),
    getSourceTrajectory: jest.fn((handle: any) => records.get(handle.id) || null),
    getDiagnostics: jest.fn(() => ({
      playbackScopeKey: scope.key,
      activeSourceTrajectoryCount: records.size,
      activeSourceTrajectoryTextureLeaseCount: Array.from(records.values())
        .filter((record: any) => !!record.options.textureLease && record.options.textureLease.released !== true).length
    })),
    reset() {
      for (const current of Array.from(records.values())) current.options.textureLease?.release();
      records.clear();
    }
  };
  return { records, scene, scope };
}

function createProjection(options: {
  snapshot?: BoardScene.PixiSourceTrajectoryGeometrySnapshot;
  noAnimation?: boolean;
  reducedMotion?: boolean;
  log?: string[];
} = {}) {
  const timeline = createManualTimeline();
  const mock = createMockScene(options.snapshot || geometry(), options.log);
  const leases: Array<{ released: boolean; release: jest.Mock }> = [];
  const projection: any = {
    scene: mock.scene,
    scope: mock.scope,
    timeline,
    noAnimation: options.noAnimation === true,
    reducedMotion: options.reducedMotion === true,
    acquireStoneTextureLease: jest.fn(() => {
      const lease = {
        texture: { id: `stone:${leases.length}` },
        released: false,
        release: jest.fn(function release(this: any) {
          if (lease.released) return false;
          lease.released = true;
          return true;
        })
      };
      leases.push(lease);
      return lease;
    })
  };
  return { ...mock, leases, projection, timeline };
}

async function flushMicrotasks(rounds = 5): Promise<void> {
  for (let index = 0; index < rounds; index += 1) await Promise.resolve();
}

describe('Pixi board source trajectory renderer', () => {
  test.each(BOARD_SOURCE_TRAJECTORY_BASELINE_FIXTURES)(
    '$profileKey preserves Phase 0 duration, settlement and primitive',
    (fixture) => {
      const request = requestFor(fixture.profileKey);
      const snapshot = geometry({
        distance: 200,
        direction: fixture.direction
      });
      const timing = resolvePixiSourceTrajectoryTiming(request, snapshot, {
        noAnimation: false,
        reducedMotion: false
      });
      const animationDurationMs = resolveBaselineDurationMs(fixture, 200);
      expect(timing).toEqual({
        animationDurationMs,
        settlementDurationMs: fixture.settlement === 'fixed-deadline'
          ? animationDurationMs + fixture.deadlinePaddingMs
          : animationDurationMs,
        noObjectReason: null
      });
      expect(BOARD_SOURCE_TRAJECTORY_PROFILE_REGISTRY[request.profileKey].primitive).toBe(fixture.primitive);
      const visual = buildPixiSourceTrajectoryVisualState(request, snapshot, 0.5);
      expect(visual.visible).toBe(true);
      if (fixture.primitive === 'projectile' || fixture.primitive === 'suction') {
        expect(visual.sprite).toEqual(expect.objectContaining({ visible: true }));
      } else {
        expect((visual.lines?.length || 0) + (visual.polygons?.length || 0)).toBeGreaterThan(0);
      }
    }
  );

  test('seeded lightning is deterministic and never creates target impact primitives', () => {
    const request = requestFor('lightningDestroyed');
    const snapshot = geometry();
    const first = buildPixiSourceTrajectoryVisualState(request, snapshot, 0.44);
    const second = buildPixiSourceTrajectoryVisualState(request, snapshot, 0.44);
    expect(second).toEqual(first);
    expect(first.sprite).toBeUndefined();
    expect(first.circles).toBeUndefined();
    expect(first.polygons).toBeUndefined();
    expect(first.lines?.length).toBeGreaterThan(0);
  });

  test('beam and lightning include translucent glow layers matching the DOM fallback footprint', () => {
    const snapshot = geometry();
    const beam = buildPixiSourceTrajectoryVisualState(
      requestFor('destroyDragonBreath'),
      snapshot,
      0.5
    );
    const lightning = buildPixiSourceTrajectoryVisualState(
      requestFor('lightningDestroyed'),
      snapshot,
      0.44
    );

    expect(Math.max(...(beam.lines || []).map((line) => line.width))).toBeGreaterThanOrEqual(48);
    expect((beam.lines || []).some((line) => line.width >= 28 && line.alpha < 0.4)).toBe(true);
    expect(Math.max(...(lightning.lines || []).map((line) => line.width))).toBeGreaterThanOrEqual(23);
    expect((lightning.lines || []).some((line) => line.width >= 12 && line.alpha < 0.4)).toBe(true);
  });

  test('starts every raw source synchronously before the first board callback', async () => {
    const log: string[] = [];
    const harness = createProjection({ log });
    const renderer = createPixiSourceTrajectoryRenderer({
      record(event, detail: any) {
        if (event === 'pixi-source-trajectory:start') log.push(`start:${detail.profileKey}`);
      }
    });
    const requests = [requestFor('sniperShot'), requestFor('robotVacuumSuck')];
    const batch = renderer.startBatch(requests, harness.projection, () => {
      log.push('board:first-callback');
    });

    expect(log.slice(0, 5)).toEqual([
      'start:sniperShot',
      `source:${requests[0].trajectoryId}`,
      'start:robotVacuumSuck',
      `source:${requests[1].trajectoryId}`,
      'board:first-callback'
    ]);
    expect(Array.from(batch.trajectoryById.keys())).toEqual(requests.map((request) => request.trajectoryId));

    harness.timeline.finishAll();
    await batch.settlement;
    expect(harness.leases).toHaveLength(2);
    expect(harness.leases.every((lease) => lease.released)).toBe(true);
    expect(renderer.getDiagnostics()).toMatchObject({
      activeRunCount: 0,
      activeTextureLeaseCount: 0,
      startedRunCount: 2,
      completedRunCount: 2,
      failedRunCount: 0
    });
  });

  test('records the logical endpoints and frozen movement geometry actually used by the renderer', async () => {
    const snapshot = geometry({ distance: 176, direction: 'source-to-target' });
    const harness = createProjection({ snapshot });
    const record = jest.fn();
    const renderer = createPixiSourceTrajectoryRenderer({ record });
    const request = requestFor('sniperShot', { row: -2, col: 1 }, { row: 6, col: 7 });

    const pending = renderer.start(request, harness.projection);
    expect(record).toHaveBeenCalledWith('pixi-source-trajectory:start', expect.objectContaining({
      profileKey: 'sniperShot',
      source: { row: -2, col: 1 },
      target: { row: 6, col: 7 },
      direction: 'source-to-target',
      geometry: expect.objectContaining({
        sourceCenter: snapshot.sourceCenter,
        targetCenter: snapshot.targetCenter,
        movementStart: snapshot.sourceCenter,
        movementEnd: snapshot.targetCenter,
        visibleClip: snapshot.visibleClip,
        visibleSegment: snapshot.visibleSegment
      })
    }));

    harness.timeline.finishAll();
    await pending;
  });

  test('fully offscreen trajectory materializes no object or texture but settles at normal duration', async () => {
    const harness = createProjection({ snapshot: geometry({ visible: false }) });
    const renderer = createPixiSourceTrajectoryRenderer();
    const request = requestFor('sniperShot');
    const settlement = renderer.start(request, harness.projection);

    expect(harness.scene.acquireSourceTrajectory).not.toHaveBeenCalled();
    expect(harness.projection.acquireStoneTextureLease).not.toHaveBeenCalled();
    expect(harness.timeline.runs[0].durationMs).toBe(resolveBaselineDurationMs(
      BOARD_SOURCE_TRAJECTORY_BASELINE_FIXTURES[0],
      200
    ));
    harness.timeline.finishAll();
    await settlement;
    expect(renderer.getDiagnostics()).toMatchObject({ noObjectRunCount: 1, offscreenNoObjectRunCount: 1 });
  });

  test('NOANIM and reduced-motion zombie run duration zero before handle or lease acquisition', async () => {
    for (const testCase of [
      { request: requestFor('sniperShot'), noAnimation: true, reducedMotion: false },
      { request: requestFor('zombieBite'), noAnimation: false, reducedMotion: true }
    ]) {
      const harness = createProjection(testCase);
      const renderer = createPixiSourceTrajectoryRenderer();
      const settlement = renderer.start(testCase.request, harness.projection);
      expect(harness.timeline.runs[0].durationMs).toBe(0);
      expect(harness.scene.acquireSourceTrajectory).not.toHaveBeenCalled();
      expect(harness.projection.acquireStoneTextureLease).not.toHaveBeenCalled();
      harness.timeline.finishAll();
      await settlement;
    }

    const reducedDestroy = createProjection({ reducedMotion: true });
    const renderer = createPixiSourceTrajectoryRenderer();
    const settlement = renderer.start(requestFor('sniperShot'), reducedDestroy.projection);
    expect(reducedDestroy.scene.acquireSourceTrajectory).toHaveBeenCalledTimes(1);
    expect(reducedDestroy.timeline.runs[0].durationMs).toBeGreaterThan(0);
    reducedDestroy.timeline.finishAll();
    await settlement;
  });

  test('abort releases the pooled handle and stone texture exactly once', async () => {
    const harness = createProjection();
    const renderer = createPixiSourceTrajectoryRenderer();
    const settlement = renderer.start(requestFor('sniperShot'), harness.projection);
    expect(harness.leases).toHaveLength(1);
    harness.timeline.abort(new Error('context lost'));
    await expect(settlement).rejects.toThrow('context lost');
    expect(harness.leases[0].release).toHaveBeenCalledTimes(1);
    expect(harness.records.size).toBe(0);
    expect(renderer.getDiagnostics()).toMatchObject({ activeRunCount: 0, failedRunCount: 1 });
  });

  test('actual scene clips the logical segment to the board viewport without materializing path cells', () => {
    const runtime = fakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime, effectGutterCells: 2 });
    const frame = makeFrame();
    scene.applyFrame(frame, { canvasViewport: { sceneOffsetX: 64, sceneOffsetY: 64 } });
    const materializedBefore = scene.getDiagnostics().activeViewCount;
    const request = requestFor('destroyDragonBreath', { row: 1, col: -2 }, { row: 1, col: 6 });
    const snapshot = scene.snapshotSourceTrajectoryGeometry(request);

    expect(snapshot).toMatchObject({
      sourceCenter: { x: 16, y: 112 },
      targetCenter: { x: 272, y: 112 },
      visibleClip: { left: 64, top: 64, right: 192, bottom: 192 },
      paintedHaloClip: { left: 0, top: 0, right: 256, bottom: 256 },
      visibleSegment: {
        start: { x: 64, y: 112 },
        end: { x: 192, y: 112 }
      }
    });
    expect(scene.getDiagnostics().activeViewCount).toBe(materializedBefore);

    const scope = scene.beginPlaybackScope('geometry-freeze');
    const handle = scene.acquireSourceTrajectory(scope, {
      trajectoryId: request.trajectoryId,
      profileKey: request.profileKey,
      primitive: 'beam',
      geometry: snapshot
    });
    scene.updateSourceTrajectory(scope, handle, buildPixiSourceTrajectoryVisualState(request, snapshot, 0.5));
    expect(scene.getSourceTrajectory(handle)).toMatchObject({
      layoutRevision: 1,
      visible: true,
      lineCount: 5
    });

    scene.applyFrame(makeFrame({ revision: 2, scrollLeft: 32 }), {
      canvasViewport: { sceneOffsetX: 64, sceneOffsetY: 64 },
      preservePlaybackProjection: true
    });
    expect(scene.getSourceTrajectory(handle)?.geometry).toBe(snapshot);
    expect(scene.getSourceTrajectory(handle)?.layoutRevision).toBe(1);
    expect(scene.getDiagnostics().activeViewCount).toBeLessThanOrEqual(materializedBefore + 8);

    scene.releaseSourceTrajectory(scope, handle);
    expect(scene.getDiagnostics()).toMatchObject({
      activeSourceTrajectoryCount: 0,
      pooledSourceTrajectoryCount: 1,
      createdSourceTrajectoryViewCount: 1
    });
    scene.destroy();
    expect(scene.getDiagnostics()).toMatchObject({
      destroyed: true,
      activeSourceTrajectoryCount: 0,
      destroyedSourceTrajectoryViewCount: 1
    });
  });

  test('negative and fully nonintersecting world coordinates remain geometry-only', () => {
    const scene = BoardScene.createPixiBoardScene({ runtime: fakeRuntime(), effectGutterCells: 2 });
    scene.applyFrame(makeFrame(), { canvasViewport: { sceneOffsetX: 64, sceneOffsetY: 64 } });
    const crossing = scene.snapshotSourceTrajectoryGeometry(
      requestFor('sniperShot', { row: 2, col: -8 }, { row: 2, col: 12 })
    );
    const outside = scene.snapshotSourceTrajectoryGeometry(
      requestFor('sniperShot', { row: -8, col: -8 }, { row: -8, col: 12 })
    );
    expect(crossing.visibleSegment).not.toBeNull();
    expect(outside.visibleSegment).toBeNull();
    expect(scene.getDiagnostics().activeSourceTrajectoryCount).toBe(0);
    scene.destroy();
  });

  test('geometry follows the frame present at start, then stays frozen across expansion, shrink and rotation', () => {
    const scene = BoardScene.createPixiBoardScene({ runtime: fakeRuntime(), effectGutterCells: 2 });
    scene.applyFrame(makeFrame({ revision: 1 }), {
      canvasViewport: { sceneOffsetX: 64, sceneOffsetY: 64 }
    });
    const request = requestFor('destroyDragonBreath', { row: 1, col: 0 }, { row: 1, col: 3 });
    const original = scene.snapshotSourceTrajectoryGeometry(request);
    const scope = scene.beginPlaybackScope('revision-freeze');
    const handle = scene.acquireSourceTrajectory(scope, {
      trajectoryId: request.trajectoryId,
      profileKey: request.profileKey,
      primitive: 'beam',
      geometry: original
    });

    scene.applyFrame(makeFrame({
      revision: 2,
      minRow: -2,
      maxRow: 9,
      minCol: -2,
      maxCol: 9
    }), {
      canvasViewport: { sceneOffsetX: 64, sceneOffsetY: 64 },
      preservePlaybackProjection: true
    });
    const expanded = scene.snapshotSourceTrajectoryGeometry(request);
    expect(expanded.sourceCenter.x).toBe(original.sourceCenter.x + 64);
    expect(scene.getSourceTrajectory(handle)?.geometry).toBe(original);

    scene.applyFrame(makeFrame({ revision: 3, orientation: 'rotated-180' }), {
      canvasViewport: { sceneOffsetX: 64, sceneOffsetY: 64 },
      preservePlaybackProjection: true
    });
    const rotated = scene.snapshotSourceTrajectoryGeometry(request);
    expect(rotated.sourceCenter.x).toBeGreaterThan(rotated.targetCenter.x);
    expect(scene.getSourceTrajectory(handle)?.geometry).toBe(original);

    scene.releaseSourceTrajectory(scope, handle);
    scene.destroy();
  });

  test('stone texture lease survives a skin frame and is released by the shared scene disposal path', () => {
    const scene = BoardScene.createPixiBoardScene({ runtime: fakeRuntime(), effectGutterCells: 2 });
    scene.applyFrame(makeFrame({ revision: 1, viewportCells: 8 }), {
      canvasViewport: { sceneOffsetX: 64, sceneOffsetY: 64 }
    });
    const request = requestFor('sniperShot');
    const snapshot = scene.snapshotSourceTrajectoryGeometry(request);
    const scope = scene.beginPlaybackScope('skin-switch');
    const lease = {
      texture: { id: 'old-skin-stone' },
      released: false,
      release: jest.fn(() => {
        if (lease.released) return false;
        lease.released = true;
        return true;
      })
    };
    const handle = scene.acquireSourceTrajectory(scope, {
      trajectoryId: request.trajectoryId,
      profileKey: request.profileKey,
      primitive: 'projectile',
      geometry: snapshot,
      textureLease: lease
    });
    scene.updateSourceTrajectory(scope, handle, buildPixiSourceTrajectoryVisualState(request, snapshot, 0.4));

    scene.applyFrame(makeFrame({ revision: 2, viewportCells: 8 }), {
      canvasViewport: { sceneOffsetX: 64, sceneOffsetY: 64 },
      preservePlaybackProjection: true
    });
    expect(lease.release).not.toHaveBeenCalled();
    expect(scene.getSourceTrajectory(handle)?.geometry).toBe(snapshot);
    expect(scene.getDiagnostics().activeSourceTrajectoryTextureLeaseCount).toBe(1);

    scene.resetPlaybackProjection(scope);
    expect(lease.release).toHaveBeenCalledTimes(1);
    expect(scene.getDiagnostics()).toMatchObject({
      activeSourceTrajectoryCount: 0,
      activeSourceTrajectoryTextureLeaseCount: 0
    });
    scene.destroy();
    expect(lease.release).toHaveBeenCalledTimes(1);
  });

  test('50 sequential runs reuse one view and return handles, leases and ticker work to baseline', async () => {
    const runtime = fakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime, effectGutterCells: 2 });
    scene.applyFrame(makeFrame({ viewportCells: 8 }), {
      canvasViewport: { sceneOffsetX: 64, sceneOffsetY: 64 }
    });
    const scope = scene.beginPlaybackScope('repeat');
    const timeline = createManualTimeline();
    const leases: any[] = [];
    const projection: any = {
      scene,
      scope,
      timeline,
      noAnimation: false,
      reducedMotion: false,
      acquireStoneTextureLease: () => {
        const lease = {
          texture: { id: `lease:${leases.length}` },
          released: false,
          release: jest.fn(() => {
            if (lease.released) return false;
            lease.released = true;
            return true;
          })
        };
        leases.push(lease);
        return lease;
      }
    };
    const renderer = createPixiSourceTrajectoryRenderer();
    for (let index = 0; index < 50; index += 1) {
      const settlement = renderer.start(requestFor('sniperShot'), projection);
      timeline.finishAll();
      await settlement;
    }
    await flushMicrotasks();
    expect(leases).toHaveLength(50);
    expect(leases.every((lease) => lease.released && lease.release.mock.calls.length === 1)).toBe(true);
    expect(scene.getDiagnostics()).toMatchObject({
      activeSourceTrajectoryCount: 0,
      activeSourceTrajectoryTextureLeaseCount: 0,
      pooledSourceTrajectoryCount: 1,
      createdSourceTrajectoryViewCount: 1
    });
    expect(renderer.getDiagnostics()).toMatchObject({
      activeRunCount: 0,
      startedRunCount: 50,
      completedRunCount: 50
    });
    scene.destroy();
  });
});
