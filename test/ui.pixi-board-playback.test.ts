import type {
  BoardPlaybackContext,
  BoardStoneVisualState,
  BoardVisualFrame
} from '../ui/board-visual/types';
import {
  createPixiBoardPlayback
} from '../ui/pixi/board-playback';
import { PIXI_PLAYBACK_RESTORE_INTERRUPTION_CODE } from '../ui/board-visual/playback-interruption';

type TickListener = (deltaMs: number) => void;

function stone(
  owner: 'black' | 'white',
  specialType: string | null = null
): BoardStoneVisualState {
  return Object.freeze({
    owner,
    value: owner === 'black' ? 1 : -1,
    specialType,
    status: Object.freeze({})
  });
}

function makeFrame(
  stones: ReadonlyArray<readonly [number, number, BoardStoneVisualState]> = []
): BoardVisualFrame {
  const boardKeys = Object.freeze(Array.from({ length: 64 }, (_unused, index) => (
    `${Math.floor(index / 8)},${index % 8}`
  )));
  const topology = Object.freeze({
    baseRows: 8,
    baseCols: 8,
    minRow: 0,
    maxRow: 7,
    minCol: 0,
    maxCol: 7,
    renderRowOffset: 0,
    renderColOffset: 0,
    renderRows: 8,
    renderCols: 8,
    existingKeys: boardKeys,
    playableKeys: boardKeys,
    holeKeys: Object.freeze([])
  });
  const cells = stones.map(([row, col, value]) => Object.freeze({
    key: `${row},${col}`,
    row,
    col,
    renderRow: row,
    renderCol: col,
    kind: 'playable' as const,
    expansionSide: null,
    boundaryEdges: Object.freeze({ top: 'none' as const, right: 'none' as const, bottom: 'none' as const, left: 'none' as const }),
    stone: value,
    markers: Object.freeze([]),
    interaction: Object.freeze({
      legal: false,
      legalFree: false,
      tabooLegal: false,
      selectable: false,
      interactionLocked: false,
      hovered: false,
      keyboardCursor: false,
      previewKinds: Object.freeze([]),
      selected: false,
      selectionKinds: Object.freeze([]),
      directionHints: Object.freeze([]),
      directionHintIds: Object.freeze([]),
      localPendingHintIds: Object.freeze([])
    }),
    visualSignature: `${row},${col}:${value.owner}`,
    surfaceSignature: `surface:${row},${col}`,
    stoneSignature: `stone:${row},${col}:${value.owner}:${value.specialType || 'normal'}`,
    hintPaintSignature: `hint-paint:${row},${col}:idle`,
    hintInputSignature: `hint-input:${row},${col}:idle`,
    interactionSignature: `interaction:${row},${col}:idle`
  }));
  return Object.freeze({
    frameToken: 'pixi-playback-frame:1',
    model: Object.freeze({
      visualRevision: 1,
      topology,
      cells: Object.freeze(cells),
      keyboardCursorKey: null,
      viewerContext: 'black' as const,
      currentPlayer: 'black' as const,
      canControlCurrentTurn: true,
      isHumanTurn: true
    }),
    layout: Object.freeze({
      revision: 1,
      cellSize: 32,
      dpr: 1,
      orientation: 'normal' as const,
      frameInset: Object.freeze({ top: 0, right: 0, bottom: 0, left: 0 }),
      clientOrigin: Object.freeze({ x: 0, y: 0 }),
      visualViewport: Object.freeze({ scale: 1, offsetLeft: 0, offsetTop: 0 }),
      camera: Object.freeze({
        scrollLeft: 0,
        scrollTop: 0,
        viewportWidth: 256,
        viewportHeight: 256
      }),
      logicalWidth: 256,
      logicalHeight: 256,
      visibleWorldWindow: Object.freeze({ minRow: 0, maxRow: 7, minCol: 0, maxCol: 7 })
    }),
    appearance: Object.freeze({
      boardSkinId: 'default',
      boardImageUrl: '',
      boardFrameSkinId: 'default',
      boardFrameLayout: Object.freeze({}),
      stoneSkinId: 'default',
      blackStoneImageUrl: '',
      whiteStoneImageUrl: '',
      revision: 1
    }),
    // Playback effects do not inspect theme properties. Keeping this fixture
    // deliberately empty makes accidental theme authority reads fail loudly.
    theme: Object.freeze({}) as BoardVisualFrame['theme']
  });
}

function createManualApplication(log: string[], renderImpl?: () => void) {
  const listeners = new Set<TickListener>();
  let running = false;
  const application = {
    render: jest.fn(() => {
      log.push('app:render');
      renderImpl?.();
    }),
    subscribeTicker: jest.fn((listener: TickListener) => {
      log.push('app:ticker-subscribe');
      listeners.add(listener);
      let subscribed = true;
      return () => {
        if (!subscribed) return;
        subscribed = false;
        log.push('app:ticker-unsubscribe');
        listeners.delete(listener);
      };
    }),
    startTicker: jest.fn(() => {
      log.push('app:ticker-start');
      running = true;
    }),
    stopTicker: jest.fn(() => {
      log.push('app:ticker-stop');
      running = false;
    }),
    tick(deltaMs: number) {
      if (!running) return;
      for (const listener of Array.from(listeners)) listener(deltaMs);
    },
    get running() { return running; },
    get listenerCount() { return listeners.size; }
  };
  return application;
}

function createMockScene(log: string[]) {
  let nextScopeId = 1;
  let nextGhostId = 1;
  let nextHighlightId = 1;
  let nextEffectId = 1;
  let nextSourceTrajectoryId = 1;
  let scope: { id: number; key: string } | null = null;
  const ghosts = new Map<number, any>();
  const highlights = new Map<number, any>();
  const effects = new Map<number, any>();
  const sourceTrajectories = new Map<number, any>();
  let pooledGhosts = 0;
  let pooledHighlights = 0;
  let pooledEffects = 0;
  let pooledSourceTrajectories = 0;

  function clearProjection(label: string) {
    log.push(label);
    pooledGhosts += ghosts.size;
    pooledHighlights += highlights.size;
    pooledEffects += effects.size;
    pooledSourceTrajectories += sourceTrajectories.size;
    for (const trajectory of sourceTrajectories.values()) trajectory.textureLease?.release();
    ghosts.clear();
    highlights.clear();
    effects.clear();
    sourceTrajectories.clear();
    scope = null;
  }

  const scene: any = {
    root: {},
    layers: {},
    beginPlaybackScope: jest.fn((key: string | number) => {
      const normalized = String(key);
      if (scope && scope.key === normalized) return scope;
      if (scope) throw new Error(`scope already active:${scope.key}`);
      scope = Object.freeze({ id: nextScopeId++, key: normalized });
      log.push(`scene:scope:${normalized}`);
      return scope;
    }),
    isPlaybackScopeActive: jest.fn((key: string | number) => (
      scope?.key === String(key).trim()
    )),
    hideStone: jest.fn((_scope: any, row: number, col: number) => {
      log.push(`scene:hide:${row},${col}`);
    }),
    retainStoneOverride: jest.fn(),
    acquirePlaybackGhost: jest.fn((ownedScope: any, options: any) => {
      const handle = Object.freeze({ id: nextGhostId++, scopeId: ownedScope.id });
      ghosts.set(handle.id, { handle, ...options, alpha: 1, visible: true });
      const visualLabel = options.stone?.owner
        || `marker:${options.markers?.[0]?.kind || 'unknown'}`;
      log.push(`scene:ghost-acquire:${options.row},${options.col}:${visualLabel}`);
      return handle;
    }),
    updatePlaybackGhost: jest.fn((_scope: any, handle: any, update: any) => {
      const current = ghosts.get(handle.id);
      if (current) ghosts.set(handle.id, { ...current, ...update });
      log.push(`scene:ghost-update:${handle.id}`);
    }),
    releasePlaybackGhost: jest.fn((_scope: any, handle: any) => {
      if (ghosts.delete(handle.id)) pooledGhosts += 1;
      log.push(`scene:ghost-release:${handle.id}`);
    }),
    acquirePlaybackCellHighlight: jest.fn((ownedScope: any, row: number, col: number, tone: string) => {
      const handle = Object.freeze({ id: nextHighlightId++, scopeId: ownedScope.id });
      highlights.set(handle.id, { handle, row, col, tone });
      log.push(`scene:highlight-acquire:${row},${col}:${tone}`);
      return handle;
    }),
    releasePlaybackCellHighlight: jest.fn((_scope: any, handle: any) => {
      if (highlights.delete(handle.id)) pooledHighlights += 1;
      log.push(`scene:highlight-release:${handle.id}`);
    }),
    acquirePlaybackEffect: jest.fn((ownedScope: any, options: any) => {
      const handle = Object.freeze({ id: nextEffectId++, scopeId: ownedScope.id });
      effects.set(handle.id, {
        handle,
        ...options,
        alpha: 1,
        scale: 1,
        rotation: 0,
        visible: true
      });
      log.push(`scene:effect-acquire:${options.family}:${options.row},${options.col}`);
      return handle;
    }),
    updatePlaybackEffect: jest.fn((_scope: any, handle: any, update: any) => {
      const current = effects.get(handle.id);
      if (current) effects.set(handle.id, { ...current, ...update });
      log.push(`scene:effect-update:${handle.id}`);
    }),
    releasePlaybackEffect: jest.fn((_scope: any, handle: any) => {
      if (effects.delete(handle.id)) pooledEffects += 1;
      log.push(`scene:effect-release:${handle.id}`);
    }),
    snapshotSourceTrajectoryGeometry: jest.fn((request: any) => {
      const sourceCenter = Object.freeze({
        x: request.source.col * 32 + 16,
        y: request.source.row * 32 + 16
      });
      const targetCenter = Object.freeze({
        x: request.target.col * 32 + 16,
        y: request.target.row * 32 + 16
      });
      const movementStart = request.direction === 'target-to-source' ? targetCenter : sourceCenter;
      const movementEnd = request.direction === 'target-to-source' ? sourceCenter : targetCenter;
      const visibleClip = Object.freeze({ left: 0, top: 0, right: 256, bottom: 256, width: 256, height: 256 });
      return Object.freeze({
        frameToken: 'pixi-playback-frame:1',
        layoutRevision: 1,
        topologySignature: '8x8',
        direction: request.direction,
        cellSize: 32,
        sourceCenter,
        targetCenter,
        movementStart,
        movementEnd,
        distancePx: Math.hypot(targetCenter.x - sourceCenter.x, targetCenter.y - sourceCenter.y),
        angleRad: Math.atan2(movementEnd.y - movementStart.y, movementEnd.x - movementStart.x),
        visibleClip,
        paintedHaloClip: Object.freeze({ left: 0, top: 0, right: 256, bottom: 256, width: 256, height: 256 }),
        visibleSegment: Object.freeze({ start: movementStart, end: movementEnd, startT: 0, endT: 1 })
      });
    }),
    acquireSourceTrajectory: jest.fn((ownedScope: any, options: any) => {
      const handle = Object.freeze({ id: nextSourceTrajectoryId++, scopeId: ownedScope.id });
      sourceTrajectories.set(handle.id, { handle, ...options, visible: false });
      log.push(`scene:source-acquire:${options.profileKey}:${options.trajectoryId}`);
      return handle;
    }),
    updateSourceTrajectory: jest.fn((_scope: any, handle: any, visual: any) => {
      const current = sourceTrajectories.get(handle.id);
      if (current) sourceTrajectories.set(handle.id, { ...current, ...visual });
      log.push(`scene:source-update:${handle.id}`);
    }),
    updateSourceTrajectoryProgress: jest.fn((_scope: any, handle: any, progress: number) => {
      const current = sourceTrajectories.get(handle.id);
      if (current) sourceTrajectories.set(handle.id, { ...current, progress });
      log.push(`scene:source-update:${handle.id}`);
    }),
    releaseSourceTrajectory: jest.fn((_scope: any, handle: any) => {
      const current = sourceTrajectories.get(handle.id);
      if (current) {
        sourceTrajectories.delete(handle.id);
        current.textureLease?.release();
        pooledSourceTrajectories += 1;
      }
      log.push(`scene:source-release:${handle.id}`);
    }),
    getSourceTrajectory: jest.fn((handle: any) => sourceTrajectories.get(handle.id) || null),
    getPlaybackGhost: jest.fn((handle: any) => ghosts.get(handle.id) || null),
    getPlaybackEffect: jest.fn((handle: any) => effects.get(handle.id) || null),
    resetPlaybackProjection: jest.fn(() => clearProjection('scene:projection-reset')),
    applyFrame: jest.fn((_frame: BoardVisualFrame, context?: { preservePlaybackProjection?: boolean }) => {
      log.push('scene:frame-apply');
      if (context?.preservePlaybackProjection !== true) clearProjection('scene:frame-settle');
      return {};
    }),
    getRenderedCell: jest.fn(() => null),
    getDiagnostics: jest.fn(() => ({
      playbackScopeKey: scope?.key || null,
      activePlaybackGhostCount: ghosts.size,
      pooledPlaybackGhostCount: pooledGhosts,
      activePlaybackHighlightLeaseCount: highlights.size,
      pooledPlaybackHighlightCount: pooledHighlights,
      activePlaybackEffectCount: effects.size,
      pooledPlaybackEffectCount: pooledEffects,
      activeSourceTrajectoryCount: sourceTrajectories.size,
      pooledSourceTrajectoryCount: pooledSourceTrajectories,
      activeSourceTrajectoryTextureLeaseCount: Array.from(sourceTrajectories.values())
        .filter((trajectory) => trajectory.textureLease && trajectory.textureLease.released !== true).length
    })),
    reset: jest.fn(() => clearProjection('scene:reset')),
    destroy: jest.fn(() => clearProjection('scene:destroy'))
  };
  return scene;
}

function context(
  strictNetworkPlayback = false,
  events: readonly unknown[] = []
): BoardPlaybackContext {
  return Object.freeze({
    token: Object.freeze({
      id: strictNetworkPlayback ? 2 : 1,
      frameToken: strictNetworkPlayback ? 'network:phase:1' : 'local:phase:1',
      mode: strictNetworkPlayback ? 'network' as const : 'local' as const
    }),
    strictNetworkPlayback,
    phaseScope: Object.freeze({
      events: Object.freeze(Array.from(events)),
      phaseKey: '1',
      stepIndex: 0
    })
  });
}

function createHarness(options: {
  frame?: BoardVisualFrame;
  noAnimation?: boolean;
  reducedMotion?: boolean;
  timings?: Record<string, number>;
  renderImpl?: () => void;
  failSourceTextureLease?: boolean;
} = {}) {
  const log: string[] = [];
  const application = createManualApplication(log, options.renderImpl);
  const scene = createMockScene(log);
  const record = jest.fn((event: string, detail?: any) => {
    const label = detail?.eventType
      ? `:${detail.eventType}`
      : detail?.profileKey
        ? `:${detail.profileKey}`
        : '';
    log.push(`record:${event}${label}`);
  });
  const frame = options.frame || makeFrame();
  const playback = createPixiBoardPlayback({
    application,
    scene,
    getFrame: () => frame,
    noAnimation: options.noAnimation,
    reducedMotion: options.reducedMotion,
    timings: options.timings,
    acquireStoneTextureLease(owner) {
      if (options.failSourceTextureLease) {
        throw new Error('source texture unavailable');
      }
      let released = false;
      log.push(`texture:source-acquire:${owner}`);
      return Object.freeze({
        texture: Object.freeze({ owner }),
        get released() { return released; },
        release() {
          if (released) return false;
          released = true;
          log.push(`texture:source-release:${owner}`);
          return true;
        }
      });
    },
    record
  });
  return { application, frame, log, playback, record, scene };
}

async function flushMicrotasks(rounds = 6): Promise<void> {
  for (let index = 0; index < rounds; index += 1) await Promise.resolve();
}

function placeEvent(row = 1, col = 1) {
  return {
    type: 'place',
    targets: [{
      r: row,
      col,
      owner: 'black',
      cause: 'SYSTEM',
      reason: 'standard_place',
      meta: { placementKind: 'normal_placement' },
      after: { owner: 'black', color: 1 }
    }]
  };
}

function sourceEmptyDestroyEvent() {
  return {
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
}

function sourceEmptyMoveEvent() {
  return {
    type: 'move',
    targets: [{
      from: { r: 3, col: 3 },
      to: { r: 4, col: 3 },
      ownerBefore: 'black',
      ownerAfter: 'black',
      cause: 'HYPERACTIVE',
      reason: 'hyperactive_move',
      meta: { moveIntent: 'hyperactive_move' },
      after: { color: 1, owner: 'black', special: 'HYPERACTIVE', timer: 8 }
    }]
  };
}

describe('Pixi board playback contract', () => {
  test('launches the consolidated FLIP batch first, then non-FLIP events in received order', async () => {
    const harness = createHarness({ noAnimation: true });
    const events = [
      { type: 'place', targets: [] },
      { type: 'flip', targets: [] },
      { type: 'status_applied', targets: [] },
      { type: 'flip', targets: [] },
      { type: 'destroy', targets: [] },
      { type: 'spawn', targets: [] }
    ];

    await harness.playback.playPhase(events, context());

    expect(harness.scene.getDiagnostics).not.toHaveBeenCalled();
    const starts = harness.log
      .filter((entry) => entry.startsWith('record:pixi-playback:event-start'));
    expect(starts).toEqual([
      'record:pixi-playback:event-start:flip',
      'record:pixi-playback:event-start:place',
      'record:pixi-playback:event-start:status_applied',
      'record:pixi-playback:event-start:destroy',
      'record:pixi-playback:event-start:spawn'
    ]);
    expect(harness.record).toHaveBeenCalledWith(
      'pixi-playback:phase-start',
      expect.objectContaining({
        eventTypes: ['place', 'flip', 'status_applied', 'flip', 'destroy', 'spawn']
      })
    );
  });

  test('starts trajectories inside each playPhase launch without overtaking later dispatcher launches', async () => {
    const harness = createHarness({
      frame: makeFrame([
        [2, 2, stone('white')],
        [4, 4, stone('black')]
      ]),
      noAnimation: true
    });
    const sniper = {
      type: 'destroy',
      targets: [{
        r: 2,
        col: 2,
        sourceRow: 1,
        sourceCol: 1,
        ownerBefore: 'white',
        cause: 'SNIPER_WILL',
        reason: 'sniper_shot',
        before: { owner: 'white', color: -1 }
      }]
    };
    const secondSniper = {
      type: 'destroy',
      targets: [{
        r: 4,
        col: 4,
        sourceRow: 3,
        sourceCol: 4,
        ownerBefore: 'black',
        cause: 'SNIPER_WILL',
        reason: 'sniper_shot',
        before: { owner: 'black', color: 1 }
      }]
    };
    const sharedContext = context(false, [sniper, secondSniper]);

    const first = harness.playback.playPhase([sniper], sharedContext);
    const second = harness.playback.playPhase([secondSniper], sharedContext);
    await Promise.all([first, second]);

    const sourceStarts = harness.log.filter((entry) => (
      entry.startsWith('record:pixi-source-trajectory:start:')
    ));
    expect(sourceStarts).toEqual([
      'record:pixi-source-trajectory:start:sniperShot',
      'record:pixi-source-trajectory:start:sniperShot'
    ]);
    const launchOrder = harness.log.filter((entry) => (
      entry.startsWith('record:pixi-source-trajectory:start:')
      || entry === 'record:pixi-playback:event-start:destroy'
    ));
    expect(launchOrder.slice(0, 4)).toEqual([
      'record:pixi-source-trajectory:start:sniperShot',
      'record:pixi-playback:event-start:destroy',
      'record:pixi-source-trajectory:start:sniperShot',
      'record:pixi-playback:event-start:destroy'
    ]);
    const trajectoryIds = harness.record.mock.calls
      .filter(([event]) => event === 'pixi-source-trajectory:start')
      .map(([, detail]) => detail.trajectoryId);
    expect(trajectoryIds).toHaveLength(2);
    expect(trajectoryIds[0]).toContain('/0/0/sniperShot');
    expect(trajectoryIds[1]).toContain('/1/0/sniperShot');
    expect(trajectoryIds[0]).not.toBe(trajectoryIds[1]);
    expect(harness.playback.getDiagnostics()).toMatchObject({
      phaseCount: 2,
      completedPhaseCount: 2,
      inFlightEffectCount: 0,
      sourceTrajectory: expect.objectContaining({
        startedRunCount: 2,
        completedRunCount: 2
      })
    });
  });

  test('records target start and commit around the real source settlement gate', async () => {
    const harness = createHarness({
      frame: makeFrame([
        [1, 1, stone('black')],
        [2, 2, stone('white')]
      ]),
      noAnimation: true
    });
    const event = {
      type: 'destroy',
      targets: [{
        r: 2,
        col: 2,
        sourceRow: 1,
        sourceCol: 1,
        ownerBefore: 'white',
        cause: 'SNIPER_WILL',
        reason: 'sniper_shot',
        before: { owner: 'white', color: -1 }
      }]
    };

    await harness.playback.playPhase([event], context(false, [event]));

    const semanticEvents = harness.record.mock.calls
      .map(([name]) => name)
      .filter((name) => [
        'pixi-source-trajectory:start',
        'pixi-playback:target-impact-start',
        'pixi-source-trajectory:settle',
        'pixi-playback:target-commit'
      ].includes(name));
    expect(semanticEvents).toEqual([
      'pixi-source-trajectory:start',
      'pixi-playback:target-impact-start',
      'pixi-source-trajectory:settle',
      'pixi-playback:target-commit'
    ]);
    expect(harness.record).toHaveBeenCalledWith(
      'pixi-playback:target-impact-start',
      expect.objectContaining({ eventType: 'destroy', row: 2, col: 2, profileKey: 'sniperShot' })
    );
    expect(harness.record).toHaveBeenCalledWith(
      'pixi-playback:target-commit',
      expect.objectContaining({ eventType: 'destroy', row: 2, col: 2, profileKey: 'sniperShot' })
    );
  });

  test('fails closed when a trajectory-required destroy loses launch membership', async () => {
    const harness = createHarness({
      frame: makeFrame([
        [1, 1, stone('black')],
        [2, 2, stone('white')]
      ]),
      noAnimation: true
    });
    const scopedEvent = {
      type: 'destroy',
      targets: [{
        r: 2,
        col: 2,
        sourceRow: 1,
        sourceCol: 1,
        ownerBefore: 'white',
        cause: 'SNIPER_WILL',
        reason: 'sniper_shot',
        before: { owner: 'white', color: -1 }
      }]
    };
    const detachedLaunchEvent = {
      ...scopedEvent,
      targets: scopedEvent.targets.map((target) => ({ ...target }))
    };

    await expect(harness.playback.playPhase(
      [detachedLaunchEvent],
      context(false, [scopedEvent])
    )).rejects.toEqual(expect.objectContaining({
      name: 'PresentationPlaybackError',
      code: 'board_renderer_failed',
      cause: expect.objectContaining({
        message: 'Pixi source trajectory membership is missing for destroy target'
      })
    }));
    expect(harness.playback.getDiagnostics()).toMatchObject({
      failedPhaseCount: 1,
      inFlightEffectCount: 0
    });
  });

  test.each([
    'place',
    'flip',
    'destroy',
    'spawn',
    'move',
    'status_applied',
    'status_removed'
  ])('supports the %s board presentation group without DOM fallback', async (type) => {
    const harness = createHarness({ noAnimation: true });

    await expect(harness.playback.playPhase([{ type, targets: [] }], context()))
      .resolves.toBeUndefined();

    expect(harness.playback.getDiagnostics()).toMatchObject({
      phaseCount: 1,
      completedPhaseCount: 1,
      failedPhaseCount: 0
    });
    expect(harness.log).toContain(`record:pixi-playback:event-start:${type}`);
    expect(harness.log).toContain(`record:pixi-playback:event-complete:${type}`);
  });

  test('supports the Phase 7 crossfade stone branch and releases its Pixi leases', async () => {
    const frame = makeFrame([[1, 1, stone('black')]]);
    const harness = createHarness({ frame, noAnimation: true });
    const event = { type: 'crossfade_stone', row: 1, col: 1, newColor: -1 };

    await expect(harness.playback.playPhase([event], context(true, [event])))
      .resolves.toBeUndefined();

    expect(harness.scene.acquirePlaybackEffect).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ family: 'crossfade_stone', row: 1, col: 1 })
    );
    expect(harness.playback.getDiagnostics()).toMatchObject({
      phaseCount: 1,
      completedPhaseCount: 1,
      inFlightEffectCount: 0,
      activeScopeKey: 'network:2:network:phase:1'
    });
    expect(harness.scene.getDiagnostics()).toMatchObject({
      activePlaybackEffectCount: 0
    });
  });

  test.each([
    ['protection expire', { type: 'protection_expire', row: 1, col: 1 }],
    ['legacy fade', { type: 'legacy_fade_out', row: 1, col: 1, options: {} }],
    ['legacy strong will', { type: 'legacy_strong_will_apply', row: 1, col: 1 }],
    ['legacy hyperactive move', {
      type: 'legacy_hyperactive_move',
      from: { row: 1, col: 1 },
      to: { row: 1, col: 2 }
    }],
    ['legacy sacrifice pulse', { type: 'legacy_sacrifice_absorb_pulse', row: 1, col: 1 }],
    ['theory incarnation', {
      type: 'theory_incarnation_spawn_roulette',
      targets: [{
        r: 2,
        col: 2,
        selectedCell: { r: 2, col: 2 },
        candidateCells: [{ r: 2, col: 1, value: 3 }, { r: 2, col: 2, value: 7 }],
        ownerAfter: 'black',
        after: { owner: 'black', color: 1, special: 'THEORY' }
      }]
    }],
    ['manifest ending board sync', {
      type: 'manifest_ending',
      targets: [{ r: 2, col: 2, after: { owner: 'white', color: -1 } }]
    }]
  ])('supports %s without compatibility board pixels', async (_name, rawEvent) => {
    const harness = createHarness({
      frame: makeFrame([[1, 1, stone('black')], [2, 2, stone('white', 'MANIFEST_THEORY')]]),
      noAnimation: true
    });
    const event = rawEvent as any;

    await expect(harness.playback.playPhase([event], context(true, [event])))
      .resolves.toBeUndefined();

    expect(harness.playback.getDiagnostics()).toMatchObject({
      phaseCount: 1,
      completedPhaseCount: 1,
      failedPhaseCount: 0,
      inFlightEffectCount: 0
    });
    expect(harness.scene.getDiagnostics()).toMatchObject({ activePlaybackEffectCount: 0 });
  });

  test('preflights the complete phase scope before an earlier routed event mutates Pixi', async () => {
    const harness = createHarness();
    const place = placeEvent();
    const scopeEvents = [
      place,
      { type: 'sound_effect', soundKey: 'stone_place' },
      { type: 'future_board_effect', row: 1, col: 1 }
    ];

    await expect(harness.playback.playPhase(
      [place],
      context(true, scopeEvents)
    )).rejects.toEqual(expect.objectContaining({
      name: 'PresentationPlaybackError',
      code: 'board_event_unimplemented',
      eventType: 'future_board_effect',
      strictNetworkPlayback: true
    }));

    expect(harness.scene.beginPlaybackScope).not.toHaveBeenCalled();
    expect(harness.application.startTicker).not.toHaveBeenCalled();
    expect(harness.application.render).not.toHaveBeenCalled();
    expect(harness.playback.getDiagnostics()).toMatchObject({
      phaseCount: 0,
      inFlightEffectCount: 0,
      activeScopeKey: null,
      timeline: expect.objectContaining({ state: 'idle', tickerRunning: false })
    });
    expect(harness.scene.getDiagnostics()).toMatchObject({
      activePlaybackGhostCount: 0,
      activePlaybackHighlightLeaseCount: 0
    });
  });

  test.each([
    ['sniper projectile', 'SNIPER_WILL', 'sniper_shot'],
    ['destroy dragon breath', 'DESTROY_DRAGON_WILL', 'destroy_dragon_breath'],
    ['ultimate destroy lightning', 'ULTIMATE_DESTROY_GOD', 'udg_destroyed'],
    ['lightning strike', 'LIGHTNING_WILL', 'lightning_destroyed'],
    ['meteor black beam', 'METEOR_GOD', 'meteor_god_cell_destroy'],
    ['robot vacuum', 'ROBOT_VACUUM', 'robot_vacuum_suck']
  ])('preflights the board-owned DESTROY trajectory endpoint for %s', async (
    _name,
    cause,
    reason
  ) => {
    const harness = createHarness();
    const event = {
      type: 'destroy',
      targets: [{
        r: 3,
        col: 3,
        ownerBefore: 'black',
        cause,
        reason,
        before: { owner: 'black', color: 1 }
      }]
    };

    await expect(harness.playback.playPhase([event], context(false, [event])))
      .rejects.toEqual(expect.objectContaining({
        name: 'BoardSourceTrajectoryError',
        code: 'invalid_source_coordinate'
      }));

    expect(harness.scene.beginPlaybackScope).not.toHaveBeenCalled();
    expect(harness.application.startTicker).not.toHaveBeenCalled();
    expect(harness.playback.getDiagnostics()).toMatchObject({
      phaseCount: 0,
      activeScopeKey: null,
      inFlightEffectCount: 0
    });
  });

  test('rejects an integer trajectory endpoint outside sparse logical topology before writer claim', async () => {
    const harness = createHarness({ noAnimation: true });
    const event = {
      type: 'destroy',
      targets: [{
        r: 8,
        col: 3,
        sourceRow: 7,
        sourceCol: 3,
        ownerBefore: 'black',
        cause: 'SNIPER_WILL',
        reason: 'sniper_shot',
        before: { owner: 'black', color: 1 }
      }]
    };

    await expect(harness.playback.playPhase([event], context(false, [event])))
      .rejects.toEqual(expect.objectContaining({
        name: 'PresentationPlaybackError',
        code: 'board_source_trajectory_endpoint_invalid',
        eventType: 'destroy'
      }));
    expect(harness.scene.beginPlaybackScope).not.toHaveBeenCalled();
    expect(harness.playback.getDiagnostics()).toMatchObject({
      phaseCount: 0,
      activeScopeKey: null,
      inFlightEffectCount: 0
    });
  });

  test('fails a required source texture before writer claim, while NOANIM needs no lease', async () => {
    const event = {
      type: 'destroy',
      targets: [{
        r: 3,
        col: 3,
        sourceRow: 2,
        sourceCol: 3,
        ownerBefore: 'black',
        cause: 'SNIPER_WILL',
        reason: 'sniper_shot',
        before: { owner: 'black', color: 1 }
      }]
    };
    const unavailable = createHarness({ failSourceTextureLease: true });

    await expect(unavailable.playback.playPhase([event], context(false, [event])))
      .rejects.toEqual(expect.objectContaining({
        name: 'PresentationPlaybackError',
        code: 'board_source_trajectory_asset_unavailable',
        eventType: 'destroy',
        strictNetworkPlayback: false
      }));
    expect(unavailable.scene.beginPlaybackScope).not.toHaveBeenCalled();
    expect(unavailable.log.some((entry) => entry.startsWith('record:pixi-playback:event-start:')))
      .toBe(false);

    const noAnimation = createHarness({
      frame: makeFrame([[3, 3, stone('black')]]),
      failSourceTextureLease: true,
      noAnimation: true
    });
    await expect(noAnimation.playback.playPhase([event], context(false, [event])))
      .resolves.toBeUndefined();
    expect(noAnimation.log.some((entry) => entry.startsWith('texture:source-acquire:'))).toBe(false);
    expect(noAnimation.playback.getDiagnostics().sourceTrajectory).toMatchObject({
      startedRunCount: 1,
      completedRunCount: 1,
      noObjectRunCount: 1
    });
  });

  test.each([
    ['sniper projectile', 'SNIPER_WILL', 'sniper_shot'],
    ['destroy dragon breath', 'DESTROY_DRAGON_WILL', 'destroy_dragon_breath'],
    ['ultimate destroy lightning', 'ULTIMATE_DESTROY_GOD', 'udg_destroyed'],
    ['lightning strike', 'LIGHTNING_WILL', 'lightning_destroyed'],
    ['meteor black beam', 'METEOR_GOD', 'meteor_god_cell_destroy'],
    ['robot vacuum', 'ROBOT_VACUUM', 'robot_vacuum_suck'],
    ['will hunter slash', 'WILL_HUNTER_KING', 'will_hunter_king_slash'],
    ['gluttonous replacement', 'GLUTTONOUS_WILL', 'gluttonous_eat'],
    ['super crush collision', 'SUPER_GRAVITY_WILL', 'super_gravity_collision']
  ])('settles the Phase 7 DESTROY variant %s with its assigned renderer', async (
    _name,
    cause,
    reason
  ) => {
    const harness = createHarness({
      frame: makeFrame([[3, 3, stone('black')]]),
      noAnimation: true
    });
    const event = {
      type: 'destroy',
      targets: [{
        r: 3,
        col: 3,
        sourceRow: 2,
        sourceCol: 3,
        ownerBefore: 'black',
        cause,
        reason,
        before: { owner: 'black', color: 1 }
      }]
    };
    await expect(harness.playback.playPhase(
      [event],
      context(false, [event])
    )).resolves.toBeUndefined();

    const hasSourceTrajectory = ![
      'WILL_HUNTER_KING',
      'GLUTTONOUS_WILL',
      'SUPER_GRAVITY_WILL'
    ].includes(cause);
    expect(harness.playback.getDiagnostics()).toMatchObject({
      phaseCount: 1,
      completedPhaseCount: 1,
      failedPhaseCount: 0,
      inFlightEffectCount: 0,
      sourceTrajectory: expect.objectContaining({
        startedRunCount: hasSourceTrajectory ? 1 : 0,
        completedRunCount: hasSourceTrajectory ? 1 : 0
      })
    });
    expect(harness.scene.getDiagnostics()).toMatchObject({ activePlaybackEffectCount: 0 });
  });

  test('NOANIM still executes start, final projection, render, and transient cleanup', async () => {
    const harness = createHarness({ noAnimation: true });
    const event = {
      type: 'spawn',
      targets: [{
        r: 1,
        col: 1,
        owner: 'white',
        cause: 'BREEDING',
        reason: 'breeding_spawn_adjacent',
        after: { owner: 'white', color: -1, special: 'BREEDING', timer: 4 }
      }]
    };

    await harness.playback.playPhase([event], context());

    const firstHide = harness.log.indexOf('scene:hide:1,1');
    const firstAcquire = harness.log.indexOf('scene:ghost-acquire:1,1:white');
    const firstRender = harness.log.indexOf('app:render');
    const transientRelease = harness.log.indexOf('scene:ghost-release:1');
    const finalAcquire = harness.log.lastIndexOf('scene:ghost-acquire:1,1:white');
    const completion = harness.log.indexOf('record:pixi-playback:event-complete:spawn');
    expect(firstHide).toBeGreaterThan(harness.log.indexOf('record:pixi-playback:event-start:spawn'));
    expect(firstAcquire).toBeGreaterThan(firstHide);
    expect(firstRender).toBeGreaterThan(firstAcquire);
    expect(transientRelease).toBeGreaterThan(firstRender);
    expect(finalAcquire).toBeGreaterThan(transientRelease);
    expect(completion).toBeGreaterThan(finalAcquire);
    expect(harness.application.render).toHaveBeenCalledTimes(2);
    expect(harness.application.startTicker).not.toHaveBeenCalled();
    expect(harness.playback.getDiagnostics()).toMatchObject({
      activeScopeKey: 'local:1:local:phase:1',
      projectedStoneCount: 1,
      retainedFinalGhostCount: 1,
      inFlightEffectCount: 0,
      timeline: expect.objectContaining({ state: 'idle', tickerRunning: false })
    });
    expect(harness.scene.getDiagnostics()).toMatchObject({
      activePlaybackGhostCount: 1,
      activePlaybackHighlightLeaseCount: 0
    });
  });

  test('BOARD_FRAME shrink retains procedural hole geometry without an adjacent seam until commit', async () => {
    const harness = createHarness({
      frame: makeFrame([[0, 0, stone('black')], [0, 1, stone('white')]]),
      noAnimation: true
    });
    const event = {
      type: 'status_applied',
      rawType: 'STATUS_APPLIED',
      meta: { special: 'METEOR_HOLE', visualVariant: 'BOARD_FRAME' },
      targets: [
        { r: 0, col: 0, before: { owner: 'black', color: 1 }, after: { special: 'METEOR_HOLE' } },
        { r: 0, col: 1, before: { owner: 'white', color: -1 }, after: { special: 'METEOR_HOLE' } }
      ]
    } as any;

    await harness.playback.playPhase([event], context(false, [event]));

    expect(harness.scene.acquirePlaybackEffect.mock.calls.map((call: any[]) => call[1]))
      .toEqual([
        expect.objectContaining({
          family: 'board_shrink',
          kind: 'topology',
          row: 0,
          col: 0,
          innerBoundaryEdges: ['bottom']
        }),
        expect.objectContaining({
          family: 'board_shrink',
          kind: 'topology',
          row: 0,
          col: 1,
          innerBoundaryEdges: ['right', 'bottom']
        })
      ]);
    expect(harness.playback.getDiagnostics()).toMatchObject({
      retainedFinalEffectCount: 2,
      inFlightEffectCount: 0
    });
    expect(harness.scene.getDiagnostics().activePlaybackEffectCount).toBe(2);

    harness.scene.applyFrame(harness.frame);
    harness.playback.onFrameApplied();
    expect(harness.playback.getDiagnostics()).toMatchObject({
      retainedFinalEffectCount: 0,
      activeScopeKey: null
    });
    expect(harness.scene.getDiagnostics().activePlaybackEffectCount).toBe(0);
  });

  test('FIRE_WILL shows a purple target highlight during the flame beam', async () => {
    const harness = createHarness({
      frame: makeFrame([[5, 1, stone('white')]])
    });
    const meta = {
      special: 'SCORCHED_CELL',
      cause: 'FIRE_WILL',
      reason: 'scorched_cell_applied',
      sourceRow: 2,
      sourceCol: 3,
      sourceTrajectoryProfile: 'fireWillFlameBeam'
    };
    const event = {
      type: 'status_applied',
      rawType: 'STATUS_APPLIED',
      meta,
      targets: [{
        r: 5,
        col: 1,
        cause: 'FIRE_WILL',
        reason: 'scorched_cell_applied',
        sourceRow: 2,
        sourceCol: 3,
        subjectKind: 'cell_marker',
        stoneMutation: 'preserve',
        meta
      }]
    } as any;
    let settled = false;
    const pending = harness.playback.playPhase([event], context(false, [event]))
      .then(() => { settled = true; });

    await flushMicrotasks();
    const sourceAcquire = harness.log.findIndex((entry) => entry.startsWith('scene:source-acquire:fireWillFlameBeam:'));
    const highlightAcquire = harness.log.indexOf('scene:highlight-acquire:5,1:positive');
    expect(sourceAcquire).toBeGreaterThanOrEqual(0);
    expect(highlightAcquire).toBeGreaterThan(sourceAcquire);
    expect(harness.log.findIndex((entry) => entry.startsWith('scene:highlight-release:'))).toBe(-1);
    expect(harness.log).not.toContain('scene:hide:5,1');
    expect(settled).toBe(false);

    harness.application.tick(280);
    await flushMicrotasks();
    harness.application.tick(1);
    await flushMicrotasks();
    harness.application.tick(1);
    await flushMicrotasks(24);
    expect(settled).toBe(true);
    await pending;
    const sourceRelease = harness.log.findIndex((entry) => entry.startsWith('scene:source-release:'));
    const highlightRelease = harness.log.findIndex((entry) => entry.startsWith('scene:highlight-release:'));
    expect(sourceRelease).toBeGreaterThan(highlightAcquire);
    expect(highlightRelease).toBeGreaterThan(sourceRelease);
    expect(harness.log).not.toContain('scene:hide:5,1');
    expect(harness.log.some((entry) => entry.startsWith('scene:ghost-acquire:5,1:'))).toBe(false);

    expect(harness.playback.getDiagnostics().sourceTrajectory).toMatchObject({
      startedRunCount: 1,
      completedRunCount: 1,
      activeRunCount: 0,
      byProfile: {
        fireWillFlameBeam: expect.objectContaining({
          started: 1,
          completed: 1,
          active: 0
        })
      }
    });
  });

  test('GRASS_WILL shows a purple target highlight until the seed appears', async () => {
    const harness = createHarness();
    const meta = {
      special: 'SEED',
      owner: 'black',
      cause: 'GRASS_WILL',
      reason: 'grass_seeded',
      sourceRow: 2,
      sourceCol: 3,
      sourceTrajectoryProfile: 'grassWillSeedBeam'
    };
    const event = {
      type: 'status_applied',
      rawType: 'STATUS_APPLIED',
      meta,
      targets: [{
        r: 5,
        col: 1,
        cause: 'GRASS_WILL',
        reason: 'grass_seeded',
        sourceRow: 2,
        sourceCol: 3,
        meta,
        after: { special: 'SEED', timer: 5, owner: 'black' }
      }]
    } as any;
    let settled = false;
    const pending = harness.playback.playPhase([event], context(false, [event]))
      .then(() => { settled = true; });

    await flushMicrotasks();
    const sourceAcquire = harness.log.findIndex((entry) => entry.startsWith('scene:source-acquire:grassWillSeedBeam:'));
    const highlightAcquire = harness.log.indexOf('scene:highlight-acquire:5,1:positive');
    expect(sourceAcquire).toBeGreaterThanOrEqual(0);
    expect(highlightAcquire).toBeGreaterThan(sourceAcquire);
    const preImpactHide = harness.log.indexOf('scene:hide:5,1');
    expect(preImpactHide).toBeGreaterThan(sourceAcquire);
    expect(harness.log.findIndex((entry) => entry.startsWith('scene:source-release:'))).toBe(-1);
    expect(harness.log.findIndex((entry) => entry.startsWith('scene:highlight-release:'))).toBe(-1);
    expect(settled).toBe(false);

    harness.application.tick(280);
    await flushMicrotasks();
    harness.application.tick(1);
    await flushMicrotasks();
    const sourceRelease = harness.log.findIndex((entry) => entry.startsWith('scene:source-release:'));
    const highlightRelease = harness.log.findIndex((entry) => entry.startsWith('scene:highlight-release:'));
    const seedAcquire = harness.log.indexOf('scene:ghost-acquire:5,1:marker:seed');
    expect(sourceRelease).toBeGreaterThan(preImpactHide);
    expect(highlightRelease).toBeGreaterThan(sourceRelease);
    expect(seedAcquire).toBeGreaterThan(highlightRelease);
    harness.application.tick(1);
    await flushMicrotasks(24);
    expect(settled).toBe(true);
    await pending;

    expect(harness.playback.getDiagnostics().sourceTrajectory).toMatchObject({
      startedRunCount: 1,
      completedRunCount: 1,
      activeRunCount: 0,
      byProfile: {
        grassWillSeedBeam: expect.objectContaining({
          started: 1,
          completed: 1,
          active: 0
        })
      }
    });
    expect(harness.playback.getDiagnostics()).toMatchObject({
      retainedFinalGhostCount: 1,
      projectedStoneCount: 1
    });
  });

  test('WATER_WILL shows a purple target highlight during the water beam', async () => {
    const harness = createHarness({
      frame: makeFrame([[5, 1, stone('white')]])
    });
    const meta = {
      special: 'HEALING_CELL',
      cause: 'WATER_WILL',
      reason: 'healing_cell_applied',
      sourceRow: 2,
      sourceCol: 3,
      sourceTrajectoryProfile: 'waterWillHealingBeam'
    };
    const event = {
      type: 'status_applied',
      rawType: 'STATUS_APPLIED',
      meta,
      targets: [{
        r: 5,
        col: 1,
        cause: 'WATER_WILL',
        reason: 'healing_cell_applied',
        sourceRow: 2,
        sourceCol: 3,
        subjectKind: 'cell_marker',
        stoneMutation: 'preserve',
        meta
      }]
    } as any;
    let settled = false;
    const pending = harness.playback.playPhase([event], context(false, [event]))
      .then(() => { settled = true; });

    await flushMicrotasks();
    const sourceAcquire = harness.log.findIndex((entry) => entry.startsWith('scene:source-acquire:waterWillHealingBeam:'));
    const highlightAcquire = harness.log.indexOf('scene:highlight-acquire:5,1:positive');
    expect(sourceAcquire).toBeGreaterThanOrEqual(0);
    expect(highlightAcquire).toBeGreaterThan(sourceAcquire);
    expect(harness.log.findIndex((entry) => entry.startsWith('scene:highlight-release:'))).toBe(-1);
    expect(harness.log).not.toContain('scene:hide:5,1');
    expect(settled).toBe(false);

    harness.application.tick(280);
    await flushMicrotasks();
    harness.application.tick(1);
    await flushMicrotasks();
    harness.application.tick(1);
    await flushMicrotasks(24);
    expect(settled).toBe(true);
    await pending;
    const sourceRelease = harness.log.findIndex((entry) => entry.startsWith('scene:source-release:'));
    const highlightRelease = harness.log.findIndex((entry) => entry.startsWith('scene:highlight-release:'));
    expect(sourceRelease).toBeGreaterThan(highlightAcquire);
    expect(highlightRelease).toBeGreaterThan(sourceRelease);
    expect(harness.log).not.toContain('scene:hide:5,1');
    expect(harness.log.some((entry) => entry.startsWith('scene:ghost-acquire:5,1:'))).toBe(false);

    expect(harness.playback.getDiagnostics().sourceTrajectory).toMatchObject({
      startedRunCount: 1,
      completedRunCount: 1,
      activeRunCount: 0,
      byProfile: {
        waterWillHealingBeam: expect.objectContaining({
          started: 1,
          completed: 1,
          active: 0
        })
      }
    });
  });

  test('SEED_WILL status retains the asset marker through phase settlement', async () => {
    const harness = createHarness({ noAnimation: true });
    const event = {
      type: 'status_applied',
      rawType: 'STATUS_APPLIED',
      meta: {
        special: 'SEED',
        owner: 'black',
        cause: 'SEED_WILL',
        reason: 'seed_selected'
      },
      targets: [{
        r: 4,
        col: 2,
        cause: 'SEED_WILL',
        reason: 'seed_selected',
        after: { special: 'SEED', timer: 5, owner: 'black' }
      }]
    } as any;

    await harness.playback.playPhase([event], context(false, [event]));

    expect(harness.log.some((entry) => entry.startsWith('scene:source-acquire:'))).toBe(false);
    expect(harness.log).toContain('scene:ghost-acquire:4,2:marker:seed');
    expect(harness.playback.getDiagnostics()).toMatchObject({
      retainedFinalGhostCount: 1,
      projectedStoneCount: 1,
      inFlightEffectCount: 0
    });
  });

  test('deduped zombie target waits for every raw board-owned source trajectory', async () => {
    const harness = createHarness({
      frame: makeFrame([[2, 3, stone('white')]]),
      timings: {
        zombieBiteMs: 100,
        positiveHighlightMinimumMs: 0
      }
    });
    const event = {
      type: 'flip',
      targets: [1, 2].map((sourceCol) => ({
          r: 2,
          col: 3,
          ownerBefore: 'white',
          ownerAfter: 'black',
          cause: 'ZOMBIE',
          reason: 'zombie_infection',
          meta: { sourceRow: 2, sourceCol },
          after: { owner: 'black', color: 1, special: 'ZOMBIE' }
        }))
    };
    let settled = false;
    const playback = harness.playback.playPhase([event], context(false, [event]))
      .then(() => { settled = true; });

    await flushMicrotasks();
    expect(harness.playback.getDiagnostics().sourceTrajectory).toMatchObject({
      startedRunCount: 2,
      activeRunCount: 2
    });
    expect(harness.record).toHaveBeenCalledWith(
      'pixi-playback:target-impact-start',
      expect.objectContaining({ eventType: 'flip', row: 2, col: 3, profileKey: 'zombieBite' })
    );
    expect(harness.record).not.toHaveBeenCalledWith(
      'pixi-playback:target-commit',
      expect.anything()
    );
    expect(harness.log.filter((entry) => entry.startsWith('scene:source-acquire:zombieBite:')))
      .toHaveLength(2);
    harness.application.tick(100);
    await flushMicrotasks();
    expect(settled).toBe(false);
    expect(harness.record).not.toHaveBeenCalledWith(
      'pixi-playback:target-commit',
      expect.anything()
    );
    expect(harness.log).not.toContain('scene:ghost-acquire:2,3:black');
    harness.application.tick(700);
    await playback;
    expect(settled).toBe(true);
    expect(harness.log).toContain('scene:ghost-acquire:2,3:black');
    expect(harness.playback.getDiagnostics().sourceTrajectory).toMatchObject({
      startedRunCount: 2,
      completedRunCount: 2,
      activeRunCount: 0
    });
    expect(harness.record).toHaveBeenCalledWith(
      'pixi-playback:target-commit',
      expect.objectContaining({ eventType: 'flip', row: 2, col: 3, profileKey: 'zombieBite' })
    );
  });

  test('flip diagnostics use the shared zombie reason-prefix classifier', async () => {
    const harness = createHarness({
      frame: makeFrame([[2, 3, stone('white')]]),
      noAnimation: true
    });
    const event = {
      type: 'flip',
      targets: [{
        r: 2,
        col: 3,
        ownerBefore: 'white',
        ownerAfter: 'black',
        cause: 'ZOMBIE',
        reason: 'zombie_infection_chain',
        meta: { sourceRow: 2, sourceCol: 1 },
        after: { owner: 'black', color: 1, special: 'ZOMBIE' }
      }]
    };

    await harness.playback.playPhase([event], context(false, [event]));

    expect(harness.record).toHaveBeenCalledWith(
      'pixi-playback:target-impact-start',
      expect.objectContaining({ eventType: 'flip', row: 2, col: 3, profileKey: 'zombieBite' })
    );
    expect(harness.record).toHaveBeenCalledWith(
      'pixi-playback:target-commit',
      expect.objectContaining({ eventType: 'flip', row: 2, col: 3, profileKey: 'zombieBite' })
    );
  });

  test('deduped normal flip still waits an earlier raw zombie trajectory before terminal write', async () => {
    const harness = createHarness({
      frame: makeFrame([[2, 3, stone('white')]]),
      timings: {
        flipMs: 100,
        positiveHighlightMinimumMs: 0
      }
    });
    const event = {
      type: 'flip',
      targets: [{
        r: 2,
        col: 3,
        ownerBefore: 'white',
        ownerAfter: 'black',
        cause: 'ZOMBIE',
        reason: 'zombie_infection',
        meta: { sourceRow: 2, sourceCol: 1 },
        after: { owner: 'black', color: 1, special: 'ZOMBIE' }
      }, {
        r: 2,
        col: 3,
        ownerBefore: 'white',
        ownerAfter: 'black',
        cause: 'SYSTEM',
        reason: 'standard_flip',
        after: { owner: 'black', color: 1, special: null }
      }]
    };
    let settled = false;
    const playback = harness.playback.playPhase([event], context(false, [event]))
      .then(() => { settled = true; });

    await flushMicrotasks();
    harness.application.tick(100);
    await flushMicrotasks();
    expect(settled).toBe(false);
    expect(harness.playback.getDiagnostics()).toMatchObject({
      retainedFinalGhostCount: 0,
      sourceTrajectory: expect.objectContaining({ activeRunCount: 1 })
    });

    harness.application.tick(700);
    await playback;
    expect(settled).toBe(true);
    expect(harness.playback.getDiagnostics()).toMatchObject({
      retainedFinalGhostCount: 1,
      sourceTrajectory: expect.objectContaining({
        activeRunCount: 0,
        completedRunCount: 1
      })
    });
  });

  test('source-empty DESTROY and MOVE consume their logical durations', async () => {
    const destroyHarness = createHarness({
      frame: makeFrame(),
      timings: {
        fadeOutMs: 50,
        destroySettlementMs: 70,
        moveMs: 40,
        positiveHighlightMinimumMs: 10
      }
    });
    let destroySettled = false;
    const destroy = destroyHarness.playback
      .playPhase([sourceEmptyDestroyEvent()], context())
      .then(() => { destroySettled = true; });
    await flushMicrotasks();
    expect(destroyHarness.application.running).toBe(true);
    destroyHarness.application.tick(49);
    await flushMicrotasks();
    expect(destroySettled).toBe(false);
    destroyHarness.application.tick(1);
    await destroy;
    expect(destroySettled).toBe(true);
    expect(destroyHarness.application.stopTicker).toHaveBeenCalledTimes(1);

    const moveHarness = createHarness({
      frame: makeFrame(),
      timings: { moveMs: 40, positiveHighlightMinimumMs: 10 }
    });
    let moveSettled = false;
    const move = moveHarness.playback
      .playPhase([sourceEmptyMoveEvent()], context())
      .then(() => { moveSettled = true; });
    await flushMicrotasks();
    expect(moveHarness.application.running).toBe(true);
    moveHarness.application.tick(39);
    await flushMicrotasks();
    expect(moveSettled).toBe(false);
    moveHarness.application.tick(1);
    await move;
    expect(moveSettled).toBe(true);
    expect(moveHarness.application.stopTicker).toHaveBeenCalledTimes(1);
  });

  test('same-scope FLIP plus DESTROY uses the phase source duration and ends destroyed', async () => {
    const harness = createHarness({
      frame: makeFrame([[3, 3, stone('black')]]),
      timings: {
        flipMs: 40,
        fadeOutMs: 50,
        destroySettlementMs: 70,
        positiveHighlightMinimumMs: 10
      }
    });
    const flip = {
      type: 'flip',
      targets: [{
        r: 3,
        col: 3,
        ownerBefore: 'black',
        ownerAfter: 'white',
        cause: 'SYSTEM',
        reason: 'standard_flip',
        before: { owner: 'black', color: 1 },
        after: { owner: 'white', color: -1 }
      }]
    };
    const destroy = sourceEmptyDestroyEvent();
    const phaseEvents = [flip, destroy];
    const sharedContext = context(false, phaseEvents);
    let destroySettled = false;

    const flipPromise = harness.playback.playPhase([flip], sharedContext);
    const destroyPromise = harness.playback.playPhase([destroy], sharedContext)
      .then(() => { destroySettled = true; });
    await flushMicrotasks();

    harness.application.tick(40);
    await flushMicrotasks();
    expect(destroySettled).toBe(false);
    expect(harness.playback.getDiagnostics().retainedFinalGhostCount).toBe(1);

    harness.application.tick(29);
    await flushMicrotasks();
    expect(destroySettled).toBe(false);

    harness.application.tick(1);
    await Promise.all([flipPromise, destroyPromise]);
    expect(destroySettled).toBe(true);
    expect(harness.playback.getDiagnostics()).toMatchObject({
      projectedStoneCount: 1,
      retainedFinalGhostCount: 0,
      inFlightEffectCount: 0,
      timeline: expect.objectContaining({ state: 'idle', tickerRunning: false })
    });
    expect(harness.scene.getDiagnostics()).toMatchObject({
      activePlaybackGhostCount: 0,
      activePlaybackHighlightLeaseCount: 0
    });
  });

  test('terminal DESTROY wins even when a longer zombie FLIP completes last', async () => {
    const harness = createHarness({
      frame: makeFrame([[3, 3, stone('black')]]),
      timings: {
        flipMs: 40,
        fadeOutMs: 50,
        destroySettlementMs: 70,
        zombieBiteMs: 80,
        positiveHighlightMinimumMs: 10
      }
    });
    const flip = {
      type: 'flip',
      targets: [{
        r: 3,
        col: 3,
        ownerBefore: 'black',
        ownerAfter: 'white',
        cause: 'ZOMBIE',
        reason: 'zombie_infection',
        meta: { sourceRow: 3, sourceCol: 2 },
        before: { owner: 'black', color: 1 },
        after: { owner: 'white', color: -1, special: 'ZOMBIE' }
      }]
    };
    const destroy = sourceEmptyDestroyEvent();
    const phaseEvents = [flip, destroy];
    const sharedContext = context(false, phaseEvents);
    let flipSettled = false;

    const flipPromise = harness.playback.playPhase([flip], sharedContext)
      .then(() => { flipSettled = true; });
    const destroyPromise = harness.playback.playPhase([destroy], sharedContext);
    await flushMicrotasks();

    harness.application.tick(70);
    await destroyPromise;
    expect(flipSettled).toBe(false);

    harness.application.tick(730);
    await flipPromise;
    expect(flipSettled).toBe(true);
    expect(harness.playback.getDiagnostics()).toMatchObject({
      projectedStoneCount: 1,
      retainedFinalGhostCount: 0,
      inFlightEffectCount: 0,
      timeline: expect.objectContaining({ state: 'idle', tickerRunning: false })
    });
    expect(harness.scene.getDiagnostics()).toMatchObject({
      activePlaybackGhostCount: 0,
      activePlaybackHighlightLeaseCount: 0
    });
    const finalGhostRelease = harness.log.findLastIndex((entry) => entry.startsWith('scene:ghost-release:'));
    const terminalRender = harness.log.lastIndexOf('app:render');
    expect(finalGhostRelease).toBeGreaterThanOrEqual(0);
    expect(terminalRender).toBeGreaterThan(finalGhostRelease);
  });

  test('a later same-scope SPAWN remains the terminal writer for the destroyed cell', async () => {
    const harness = createHarness({
      frame: makeFrame([[3, 3, stone('black')]]),
      noAnimation: true
    });
    const destroy = sourceEmptyDestroyEvent();
    const spawn = {
      type: 'spawn',
      targets: [{
        r: 3,
        col: 3,
        owner: 'white',
        cause: 'REINFORCEMENT_WILL',
        reason: 'reinforcement_will_spawn',
        after: { owner: 'white', color: -1 }
      }]
    };
    const phaseEvents = [destroy, spawn];
    const sharedContext = context(false, phaseEvents);

    await Promise.all([
      harness.playback.playPhase([destroy], sharedContext),
      harness.playback.playPhase([spawn], sharedContext)
    ]);

    expect(harness.playback.getDiagnostics()).toMatchObject({
      projectedStoneCount: 1,
      retainedFinalGhostCount: 1,
      inFlightEffectCount: 0
    });
    expect(harness.scene.getDiagnostics().activePlaybackGhostCount).toBe(1);
    expect(harness.log.filter((entry) => entry === 'scene:ghost-acquire:3,3:white')).not.toHaveLength(0);
  });

  test('drops scope and retained-handle bookkeeping only after the committed frame applies', async () => {
    const harness = createHarness({ noAnimation: true });
    await harness.playback.playPhase([placeEvent(2, 2)], context());

    expect(harness.playback.getDiagnostics()).toMatchObject({
      activeScopeKey: 'local:1:local:phase:1',
      projectedStoneCount: 1,
      retainedFinalGhostCount: 1
    });
    expect(harness.scene.getDiagnostics().activePlaybackGhostCount).toBe(1);

    harness.scene.applyFrame(harness.frame);
    harness.playback.onFrameApplied();

    expect(harness.log.indexOf('scene:frame-apply'))
      .toBeLessThan(harness.log.lastIndexOf('scene:frame-settle'));
    expect(harness.playback.getDiagnostics()).toMatchObject({
      activeScopeKey: null,
      projectedStoneCount: 0,
      retainedFinalGhostCount: 0
    });
    expect(harness.scene.getDiagnostics()).toMatchObject({
      playbackScopeKey: null,
      activePlaybackGhostCount: 0,
      activePlaybackHighlightLeaseCount: 0
    });
  });

  test('runtime render failure leaves the private ticker and projection pools idle', async () => {
    const renderError = new Error('pixi-render-failed');
    let renderCount = 0;
    const harness = createHarness({
      timings: { fadeOutMs: 50, destroySettlementMs: 70 },
      renderImpl: () => {
        renderCount += 1;
        if (renderCount === 2) throw renderError;
      }
    });
    const pending = harness.playback.playPhase([sourceEmptyDestroyEvent()], context(true));
    await flushMicrotasks();
    expect(harness.application.running).toBe(true);

    harness.application.tick(25);

    await expect(pending).rejects.toEqual(expect.objectContaining({
      name: 'PresentationPlaybackError',
      code: 'board_renderer_failed',
      strictNetworkPlayback: true,
      cause: renderError
    }));
    expect(harness.application.running).toBe(false);
    expect(harness.application.listenerCount).toBe(0);
    expect(harness.scene.getDiagnostics()).toMatchObject({
      activePlaybackGhostCount: 0,
      activePlaybackHighlightLeaseCount: 0
    });
    expect(harness.playback.getDiagnostics()).toMatchObject({
      activeScopeKey: null,
      retainedFinalGhostCount: 0,
      inFlightEffectCount: 0,
      failedPhaseCount: 1,
      timeline: expect.objectContaining({
        state: 'idle',
        activeRunCount: 0,
        tickerRunning: false,
        tickerSubscribed: false
      })
    });
  });

  test('abort rejects active playback and returns both ticker and pools to idle', async () => {
    const harness = createHarness({ timings: { fadeOutMs: 50, destroySettlementMs: 70 } });
    const pending = harness.playback.playPhase([sourceEmptyDestroyEvent()], context());
    await flushMicrotasks();
    expect(harness.application.running).toBe(true);
    expect(harness.scene.getDiagnostics().activePlaybackGhostCount).toBe(1);

    const abortReason = new Error('writer-recovery');
    expect(harness.playback.abort(abortReason)).toBe(1);

    await expect(pending).rejects.toEqual(expect.objectContaining({
      name: 'PresentationPlaybackError',
      code: 'board_renderer_failed',
      strictNetworkPlayback: false,
      cause: abortReason
    }));
    expect(harness.application.running).toBe(false);
    expect(harness.application.listenerCount).toBe(0);
    expect(harness.scene.getDiagnostics()).toMatchObject({
      playbackScopeKey: null,
      activePlaybackGhostCount: 0,
      activePlaybackHighlightLeaseCount: 0
    });
    expect(harness.playback.getDiagnostics()).toMatchObject({
      activeScopeKey: null,
      retainedFinalGhostCount: 0,
      inFlightEffectCount: 0,
      timeline: expect.objectContaining({
        state: 'idle',
        tickerRunning: false,
        tickerSubscribed: false
      })
    });
  });

  test('abortAndWait blocks a late second move run before checkpoint restore', async () => {
    const harness = createHarness({
      frame: makeFrame([
        [2, 2, stone('black', 'EXTREME_HYPERACTIVE')],
        [2, 3, stone('white')],
        [3, 3, stone('white')]
      ]),
      timings: {
        moveMs: 40,
        fadeOutMs: 50,
        destroySettlementMs: 70,
        positiveHighlightMinimumMs: 10
      }
    });
    const move = {
      type: 'move',
      meta: { sequence: 'extreme_hyperactive_forced_swap' },
      targets: [
        {
          from: { r: 2, col: 2 },
          to: { r: 2, col: 3 },
          ownerBefore: 'black',
          ownerAfter: 'black',
          cause: 'EXTREME_HYPERACTIVE',
          reason: 'extreme_hyperactive_forced_swap',
          extremeForcedSwapRole: 'lead',
          before: { owner: 'black', color: 1, special: 'EXTREME_HYPERACTIVE' },
          after: { owner: 'black', color: 1, special: 'EXTREME_HYPERACTIVE' }
        },
        {
          from: { r: 2, col: 3 },
          to: { r: 2, col: 2 },
          ownerBefore: 'white',
          ownerAfter: 'white',
          cause: 'EXTREME_HYPERACTIVE',
          reason: 'extreme_hyperactive_forced_swap',
          extremeForcedSwapRole: 'follow',
          before: { owner: 'white', color: -1 },
          after: { owner: 'white', color: -1 }
        }
      ]
    };
    const destroy = sourceEmptyDestroyEvent();
    const sharedContext = context(false, [move, destroy]);
    const movePhase = harness.playback.playPhase([move], sharedContext);
    const destroyPhase = harness.playback.playPhase([destroy], sharedContext);
    await flushMicrotasks();

    harness.application.tick(40);
    const abortReason = new Error('network_playback_watchdog');
    const aborting = harness.playback.abortAndWait(abortReason);

    await expect(movePhase).rejects.toEqual(expect.objectContaining({
      name: 'PresentationPlaybackError',
      code: 'board_renderer_failed',
      cause: abortReason
    }));
    await expect(destroyPhase).rejects.toEqual(expect.objectContaining({
      name: 'PresentationPlaybackError',
      code: 'board_renderer_failed',
      cause: abortReason
    }));
    await expect(aborting).resolves.toBeGreaterThanOrEqual(1);

    harness.scene.applyFrame(harness.frame);
    harness.playback.onFrameApplied();
    harness.application.tick(100);
    await flushMicrotasks();
    expect(harness.application.listenerCount).toBe(0);
    expect(harness.scene.getDiagnostics()).toMatchObject({
      playbackScopeKey: null,
      activePlaybackGhostCount: 0,
      activePlaybackHighlightLeaseCount: 0
    });
    expect(harness.playback.getDiagnostics()).toMatchObject({
      activeScopeKey: null,
      inFlightEffectCount: 0,
      timeline: expect.objectContaining({
        state: 'idle',
        activeRunCount: 0,
        tickerRunning: false
      })
    });
  });

  test.each([
    ['animated', false],
    ['noAnimation', true]
  ])('極悪多動魔の位置交換後も両マスの石が最終表示に残る (%s)', async (_label, noAnimation) => {
    const harness = createHarness({
      frame: makeFrame([
        [2, 2, stone('black', 'EXTREME_HYPERACTIVE')],
        [2, 3, stone('white')]
      ]),
      noAnimation,
      timings: { moveMs: 40 }
    });
    const swap = {
      type: 'move',
      meta: { sequence: 'extreme_hyperactive_forced_swap' },
      targets: [
        {
          from: { r: 2, col: 2 },
          to: { r: 2, col: 3 },
          ownerBefore: 'black',
          ownerAfter: 'black',
          cause: 'EXTREME_HYPERACTIVE_WILL',
          reason: 'extreme_hyperactive_forced_swap',
          extremeForcedSwapRole: 'lead',
          before: { owner: 'black', color: 1, special: 'EXTREME_HYPERACTIVE' },
          after: { owner: 'black', color: 1, special: 'EXTREME_HYPERACTIVE' }
        },
        {
          from: { r: 2, col: 3 },
          to: { r: 2, col: 2 },
          ownerBefore: 'white',
          ownerAfter: 'white',
          cause: 'EXTREME_HYPERACTIVE_WILL',
          reason: 'extreme_hyperactive_forced_swap',
          extremeForcedSwapRole: 'follow',
          before: { owner: 'white', color: -1 },
          after: { owner: 'white', color: -1 }
        }
      ]
    };

    const pending = harness.playback.playPhase([swap], context(false, [swap]));
    await flushMicrotasks();
    for (let index = 0; index < 10; index += 1) {
      harness.application.tick(40);
      await flushMicrotasks();
    }
    await pending;

    const lastWriteAt = (row: number, col: number) => harness.log.filter((entry) => (
      entry === `scene:hide:${row},${col}` || entry.startsWith(`scene:ghost-acquire:${row},${col}:`)
    )).pop();
    expect(lastWriteAt(2, 3)).toBe('scene:ghost-acquire:2,3:black');
    expect(lastWriteAt(2, 2)).toBe('scene:ghost-acquire:2,2:white');
    expect(harness.playback.getDiagnostics()).toMatchObject({ retainedFinalGhostCount: 2 });
  });

  test.each([
    ['extreme_target_vacate', null],
    ['extreme_repel_push', null]
  ])('does not hide 極悪多動魔 when a settled %s plays from its cell', async (reason, metaSpecial) => {
    const harness = createHarness({
      frame: makeFrame([
        [2, 2, stone('black', 'EXTREME_HYPERACTIVE')],
        [1, 1, stone('black')]
      ]),
      noAnimation: true
    });
    const event = {
      type: 'move',
      targets: [{
        from: { r: 2, col: 2 },
        to: { r: 1, col: 1 },
        ownerBefore: 'black',
        ownerAfter: 'black',
        cause: 'EXTREME_HYPERACTIVE_WILL',
        reason,
        meta: { moveIntent: 'hyperactive_move', special: metaSpecial }
      }]
    };

    await harness.playback.playPhase([event], context(false, [event]));

    expect(harness.log).not.toContain('scene:hide:2,2');
    expect(harness.log).toContain('scene:hide:1,1');
    expect(harness.log.some((entry) => entry.startsWith('scene:ghost-acquire:2,2:black'))).toBe(true);
  });

  test('source-empty 極悪多動魔 MOVE still hides the already-settled destination', async () => {
    const harness = createHarness({
      frame: makeFrame([[4, 3, stone('black', 'EXTREME_HYPERACTIVE')]]),
      noAnimation: true
    });
    const event = {
      type: 'move',
      targets: [{
        from: { r: 3, col: 3 },
        to: { r: 4, col: 3 },
        ownerBefore: 'black',
        ownerAfter: 'black',
        cause: 'EXTREME_HYPERACTIVE_WILL',
        reason: 'hyperactive_move',
        meta: { moveIntent: 'hyperactive_move', special: 'EXTREME_HYPERACTIVE', timer: 5 }
      }]
    };

    await harness.playback.playPhase([event], context(false, [event]));

    expect(harness.log).toContain('scene:hide:4,3');
    expect(harness.log).not.toContain('scene:hide:3,3');
  });

  test('treats an authoritative restore interruption as cancellation rather than renderer failure', async () => {
    const event = placeEvent(2, 2);
    const harness = createHarness({ timings: { placeMs: 200 } });
    const phase = harness.playback.playPhase([event], context(true, [event]));
    await flushMicrotasks();
    harness.application.tick(40);

    const interruption = Object.assign(
      new Error('Pixi playback was interrupted before authoritative restore'),
      {
        name: 'PixiBoardBackendError',
        code: PIXI_PLAYBACK_RESTORE_INTERRUPTION_CODE,
        stage: 'play-phase'
      }
    );
    const aborting = harness.playback.abortAndWait(interruption);

    await expect(phase).rejects.toBe(interruption);
    await expect(aborting).resolves.toBeGreaterThanOrEqual(1);
    expect(harness.playback.getDiagnostics()).toMatchObject({
      activeScopeKey: null,
      completedPhaseCount: 0,
      failedPhaseCount: 0,
      inFlightEffectCount: 0,
      timeline: {
        state: 'idle',
        activeRunCount: 0,
        failedRunCount: 0,
        lastError: null
      }
    });
    expect(harness.playback.getDiagnostics().timeline.abortedRunCount).toBeGreaterThanOrEqual(1);
    expect(harness.record).toHaveBeenCalledWith(
      'pixi-playback:event-interrupted',
      expect.objectContaining({ error: interruption })
    );
    expect(harness.record).toHaveBeenCalledWith(
      'pixi-playback:phase-interrupted',
      expect.objectContaining({ error: interruption })
    );
    expect(harness.record).not.toHaveBeenCalledWith(
      'pixi-playback:event-error',
      expect.objectContaining({ error: interruption })
    );
    expect(harness.record).not.toHaveBeenCalledWith(
      'pixi-playback:phase-error',
      expect.objectContaining({ error: interruption })
    );
  });

  test('reduced-motion zombie FLIP skips the bite but retains the highlight minimum', async () => {
    const harness = createHarness({
      frame: makeFrame([[2, 2, stone('black')]]),
      reducedMotion: true,
      timings: {
        flipMs: 40,
        zombieBiteMs: 80,
        positiveHighlightMinimumMs: 20
      }
    });
    const event = {
      type: 'flip',
      targets: [{
        r: 2,
        col: 2,
        ownerBefore: 'black',
        ownerAfter: 'white',
        cause: 'ZOMBIE',
        reason: 'zombie_infection',
        meta: { sourceRow: 2, sourceCol: 1 },
        before: { owner: 'black', color: 1 },
        after: { owner: 'white', color: -1, special: 'ZOMBIE' }
      }]
    };
    let settled = false;
    const pending = harness.playback.playPhase([event], context()).then(() => { settled = true; });
    await flushMicrotasks(16);

    expect(harness.application.running).toBe(true);
    expect(harness.scene.getDiagnostics().activePlaybackHighlightLeaseCount).toBe(1);
    harness.application.tick(19);
    await flushMicrotasks();
    expect(settled).toBe(false);
    harness.application.tick(1);
    await pending;

    expect(settled).toBe(true);
    expect(harness.application.startTicker).toHaveBeenCalledTimes(1);
    expect(harness.application.stopTicker).toHaveBeenCalledTimes(1);
    expect(harness.scene.getDiagnostics().activePlaybackHighlightLeaseCount).toBe(0);
  });
});
