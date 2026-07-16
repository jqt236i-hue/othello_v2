import type {
  BoardPlaybackContext,
  BoardStoneVisualState,
  BoardVisualFrame
} from '../ui/board-visual/types';
import {
  createPixiBoardPlayback
} from '../ui/pixi/board-playback';

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
    visualSignature: `${row},${col}:${value.owner}`
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
  let scope: { id: number; key: string } | null = null;
  const ghosts = new Map<number, any>();
  const highlights = new Map<number, any>();
  const effects = new Map<number, any>();
  let pooledGhosts = 0;
  let pooledHighlights = 0;
  let pooledEffects = 0;

  function clearProjection(label: string) {
    log.push(label);
    pooledGhosts += ghosts.size;
    pooledHighlights += highlights.size;
    pooledEffects += effects.size;
    ghosts.clear();
    highlights.clear();
    effects.clear();
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
    hideStone: jest.fn((_scope: any, row: number, col: number) => {
      log.push(`scene:hide:${row},${col}`);
    }),
    retainStoneOverride: jest.fn(),
    acquirePlaybackGhost: jest.fn((ownedScope: any, options: any) => {
      const handle = Object.freeze({ id: nextGhostId++, scopeId: ownedScope.id });
      ghosts.set(handle.id, { handle, ...options, alpha: 1, visible: true });
      log.push(`scene:ghost-acquire:${options.row},${options.col}:${options.stone.owner}`);
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
      pooledPlaybackEffectCount: pooledEffects
    })),
    reset: jest.fn(() => clearProjection('scene:reset')),
    destroy: jest.fn(() => clearProjection('scene:destroy'))
  };
  return scene;
}

function context(
  strictNetworkPlayback = false,
  events: readonly unknown[] = [],
  waitForTargetPrelude?: (event: unknown, target: unknown) => Promise<void>
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
      stepIndex: 0,
      ...(waitForTargetPrelude ? { waitForTargetPrelude } : {})
    })
  });
}

function createHarness(options: {
  frame?: BoardVisualFrame;
  noAnimation?: boolean;
  reducedMotion?: boolean;
  timings?: Record<string, number>;
  renderImpl?: () => void;
} = {}) {
  const log: string[] = [];
  const application = createManualApplication(log, options.renderImpl);
  const scene = createMockScene(log);
  const record = jest.fn((event: string, detail?: any) => {
    const eventType = detail && detail.eventType ? `:${detail.eventType}` : '';
    log.push(`record:${event}${eventType}`);
  });
  const frame = options.frame || makeFrame();
  const playback = createPixiBoardPlayback({
    application,
    scene,
    getFrame: () => frame,
    noAnimation: options.noAnimation,
    reducedMotion: options.reducedMotion,
    timings: options.timings,
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
  ])('preflights the Phase 7 global DESTROY trajectory gate for %s', async (
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
        sourceRow: 2,
        sourceCol: 3,
        ownerBefore: 'black',
        cause,
        reason,
        before: { owner: 'black', color: 1 }
      }]
    };

    await expect(harness.playback.playPhase([event], context(false, [event])))
      .rejects.toEqual(expect.objectContaining({
        name: 'PresentationPlaybackError',
        code: 'board_event_unimplemented',
        eventType: 'destroy',
        strictNetworkPlayback: false
      }));

    expect(harness.scene.beginPlaybackScope).not.toHaveBeenCalled();
    expect(harness.application.startTicker).not.toHaveBeenCalled();
    expect(harness.playback.getDiagnostics()).toMatchObject({
      phaseCount: 0,
      activeScopeKey: null,
      inFlightEffectCount: 0
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
    const gate = jest.fn(async () => undefined);

    await expect(harness.playback.playPhase(
      [event],
      context(false, [event], gate)
    )).resolves.toBeUndefined();

    const needsGlobalGate = ![
      'WILL_HUNTER_KING',
      'GLUTTONOUS_WILL',
      'SUPER_GRAVITY_WILL'
    ].includes(cause);
    expect(gate).toHaveBeenCalledTimes(needsGlobalGate ? 1 : 0);
    expect(harness.playback.getDiagnostics()).toMatchObject({
      phaseCount: 1,
      completedPhaseCount: 1,
      failedPhaseCount: 0,
      inFlightEffectCount: 0
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

  test('zombie terminal flip waits for its DOM-global source decoration gate', async () => {
    const harness = createHarness({
      frame: makeFrame([[2, 3, stone('white')]]),
      noAnimation: true
    });
    let resolvePrelude!: () => void;
    const prelude = new Promise<void>((resolve) => { resolvePrelude = resolve; });
    const gate = jest.fn(() => prelude);
    const event = {
      type: 'flip',
      targets: [{
        r: 2,
        col: 3,
        ownerBefore: 'white',
        ownerAfter: 'black',
        cause: 'ZOMBIE',
        reason: 'zombie_infection',
        meta: { sourceRow: 2, sourceCol: 2 },
        after: { owner: 'black', color: 1, special: 'ZOMBIE' }
      }]
    };
    let settled = false;
    const playback = harness.playback.playPhase([event], context(false, [event], gate))
      .then(() => { settled = true; });

    await flushMicrotasks();
    expect(gate).toHaveBeenCalledTimes(1);
    expect(settled).toBe(false);
    resolvePrelude();
    await playback;
    expect(settled).toBe(true);
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

    harness.application.tick(10);
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
        before: { owner: 'black', color: 1 },
        after: { owner: 'white', color: -1, special: 'ZOMBIE' }
      }]
    };
    let settled = false;
    const pending = harness.playback.playPhase([event], context()).then(() => { settled = true; });
    await flushMicrotasks();

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
