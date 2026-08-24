const ExecutionCore = require('../game/card-effects/selection-flow-execution-core.ts');

function createDeps(config = {}) {
  const calls = [];
  const busy = { processing: false, cardAnimating: false };
  const pendingType = config.pendingType || 'BOARD_EXPANSION_GOD';
  const contract = config.contract || {
    kind: 'multi_stage',
    turnOutcome: 'continue_turn',
    deferNetworkPublish: true
  };
  const pendingAfterPreview = config.pendingAfterPreview || null;
  const deps = {
    calls,
    busy,
    normalizePendingType: (value) => String(value || '').trim().toUpperCase(),
    normalizeSelectionPlayerKey: (value) => (String(value || '').trim().toLowerCase() === 'white' ? 'white' : 'black'),
    resolveSelectionStateRefs: () => ({
      cardState: {
        turnIndex: 4,
        pendingEffectByPlayer: {
          black: { type: pendingType, stage: 'selectTarget', cardId: 'board_expand_god_01' },
          white: null
        }
      },
      gameState: {
        currentPlayer: 1,
        turnNumber: 9,
        board: Array.from({ length: 8 }, () => Array(8).fill(0))
      }
    }),
    getPendingCoordinator: () => ({
      readPendingEffect: (cardState, playerKey) => cardState.pendingEffectByPlayer[playerKey]
    }),
    shouldAllowSelectionEntryDuringPlayback: () => false,
    readSelectionBusyState: () => ({ processing: false, cardAnimating: false }),
    beginSelectionSettlementLock: jest.fn(() => ({ id: 1 })),
    endSelectionSettlementLock: jest.fn(() => true),
    clearSelectionEntryDuringPlayback: jest.fn(),
    setSelectionProcessing: jest.fn((next) => {
      busy.processing = next === true;
      calls.push(['processing', busy.processing]);
    }),
    setSelectionCardAnimating: jest.fn((next) => {
      busy.cardAnimating = next === true;
      calls.push(['cardAnimating', busy.cardAnimating]);
    }),
    createPendingSelectionAction: jest.fn((playerKey, type, payload) => ({
      type: 'place',
      playerKey,
      pendingType: type,
      ...(payload || {})
    })),
    resolvePendingSelectionContract: () => contract,
    shouldUseNetworkPublishOnlyPendingSelection: () => false,
    shouldUsePreviewThenPublishOnlyPendingSelection: () => config.previewThenPublish === true,
    shouldSuppressLocalPlaybackForDeferredNetworkSelection: () => false,
    publishPendingSelectionSnapshot: jest.fn(() => ({ ok: true })),
    readMatchMode: () => 'network',
    hasActiveNetworkPublishClient: () => true,
    resolveAuthoritativeSelectionState: () => ({
      cardState: { pendingEffectByPlayer: { black: null, white: null } },
      gameState: {}
    }),
    shouldRetainPendingSelectionAction: () => false,
    clearPendingSelectionAction: jest.fn(() => true),
    applySelectionStateResult: jest.fn(),
    emitSelectionPlaybackEvents: jest.fn(),
    emitSelectionStateChangeSignals: jest.fn(),
    resolveTurnPipelineUIAdapter: () => ({
      runTurnWithAdapter: jest.fn(() => ({
        ok: true,
        rawEvents: [{ type: 'board_expansion_selected', applied: true, completed: true }],
        nextCardState: {
          pendingEffectByPlayer: { black: pendingAfterPreview, white: null }
        },
        nextGameState: {
          currentPlayer: 1,
          turnNumber: 10,
          board: Array.from({ length: 8 }, () => Array(8).fill(0)),
          boardExpansion: {
            active: true,
            cells: [{ row: 7, col: 8, side: 'right', owner: 0 }]
          }
        },
        playbackEvents: []
      }))
    }),
    resolveTurnPipeline: () => ({}),
    cloneData: (value) => JSON.parse(JSON.stringify(value)),
    clonePendingSelectionAction: (value) => JSON.parse(JSON.stringify(value)),
    emitSelectionMessage: jest.fn(),
    resolveRootFunction: () => null,
    finalizePendingSelectionFlow: jest.fn(() => Promise.resolve(true)),
    clearPendingSelectionFailureState: jest.fn()
  };
  return deps;
}

describe('selection-flow execution core network publish refresh', () => {
  test.each([
    [
      'BOARD_EXPANSION_GOD',
      {
        pendingType: 'BOARD_EXPANSION_GOD',
        contract: { kind: 'multi_stage', turnOutcome: 'continue_turn', deferNetworkPublish: true }
      }
    ],
    [
      'BOARD_EXPANSION_WILL',
      {
        pendingType: 'BOARD_EXPANSION_WILL',
        contract: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true },
        previewThenPublish: true
      }
    ]
  ])('%s requests a board refresh after network publish busy state is released', async (_label, config) => {
    const deps = createDeps(config);
    const renderAfterPublish = jest.fn(() => {
      deps.calls.push(['render', { ...deps.busy }]);
    });

    const result = await ExecutionCore.executePendingSelectionCore({
      row: 7,
      col: 7,
      playerKey: 'black',
      pendingType: config.pendingType,
      actionPayload: { expansionTarget: { row: 7, col: 7 } },
      validateResult: () => true,
      defaultSelectionHandoffRender: renderAfterPublish
    }, deps);

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      publishedByNetwork: true
    }));
    expect(deps.publishPendingSelectionSnapshot).toHaveBeenCalledTimes(1);
    expect(renderAfterPublish).toHaveBeenCalledTimes(1);
    expect(deps.calls).toEqual(expect.arrayContaining([
      ['processing', false],
      ['cardAnimating', false],
      ['render', { processing: false, cardAnimating: false }]
    ]));
    expect(deps.calls.findIndex((entry) => entry[0] === 'render')).toBeGreaterThan(
      deps.calls.findIndex((entry) => entry[0] === 'cardAnimating' && entry[1] === false)
    );
  });

  test('rolls back a multi-stage preview and reports runtime_unavailable when integrity latches after state change', async () => {
    let blocked = false;
    const deps = createDeps({
      pendingType: 'BOARD_SHRINK_GOD',
      contract: { kind: 'multi_stage', turnOutcome: 'continue_turn', deferNetworkPublish: true },
      pendingAfterPreview: { type: 'BOARD_SHRINK_GOD', stage: 'selectTarget', cardId: 'board_shrink_god_01' }
    });
    deps.isCardRuntimeIntegrityBlocked = () => blocked;

    const result = await ExecutionCore.executePendingSelectionCore({
      row: 1,
      col: 1,
      playerKey: 'black',
      pendingType: 'BOARD_SHRINK_GOD',
      actionPayload: { shrinkTarget: { row: 1, col: 1 } },
      validateResult: () => true,
      afterStateChange: () => {
        blocked = true;
      }
    }, deps);

    expect(result).toMatchObject({
      ok: false,
      reason: 'runtime_unavailable',
      result: { ok: false, reason: 'RUNTIME_UNAVAILABLE' }
    });
    expect(deps.applySelectionStateResult).toHaveBeenCalledTimes(2);
    expect(deps.publishPendingSelectionSnapshot).not.toHaveBeenCalled();
    expect(deps.finalizePendingSelectionFlow).not.toHaveBeenCalled();
    expect(deps.clearPendingSelectionAction).not.toHaveBeenCalled();
    expect(deps.busy).toEqual({ processing: false, cardAnimating: false });
  });

  test.each(['rejects after latching', 'resolves before a queued latch'])(
    'rolls back an uncommitted multi-stage preview when the finalizer %s',
    async (finalizerMode) => {
      let blocked = false;
      const pendingType = 'BOARD_SHRINK_GOD';
      const deps = createDeps({
        pendingType,
        contract: { kind: 'multi_stage', turnOutcome: 'continue_turn', deferNetworkPublish: true },
        pendingAfterPreview: { type: pendingType, stage: 'selectTarget', cardId: 'board_shrink_god_01' }
      });
      const ensureCurrentPlayerCanActOrPass = jest.fn();
      const renderAfterFinalize = jest.fn();
      deps.isCardRuntimeIntegrityBlocked = () => blocked;
      deps.resolveRootFunction = (name) => name === 'ensureCurrentPlayerCanActOrPass'
        ? ensureCurrentPlayerCanActOrPass
        : null;
      deps.finalizePendingSelectionFlow = finalizerMode === 'rejects after latching'
        ? jest.fn(async () => {
          blocked = true;
          throw new Error('runtime unavailable while finalizing intermediate preview');
        })
        : jest.fn(() => {
          queueMicrotask(() => {
            blocked = true;
          });
          return Promise.resolve(true);
        });

      const result = await ExecutionCore.executePendingSelectionCore({
        row: 1,
        col: 1,
        playerKey: 'black',
        pendingType,
        actionPayload: { shrinkTarget: { row: 1, col: 1 } },
        validateResult: () => true,
        defaultSelectionHandoffRender: renderAfterFinalize
      }, deps);

      expect(result).toMatchObject({ ok: false, reason: 'runtime_unavailable' });
      expect(deps.applySelectionStateResult).toHaveBeenCalledTimes(2);
      expect(deps.applySelectionStateResult.mock.calls[1][0]).toMatchObject({
        nextCardState: {
          turnIndex: 4,
          pendingEffectByPlayer: {
            black: { type: pendingType, stage: 'selectTarget' }
          }
        },
        nextGameState: { currentPlayer: 1, turnNumber: 9 }
      });
      expect(deps.publishPendingSelectionSnapshot).not.toHaveBeenCalled();
      expect(deps.clearPendingSelectionAction).not.toHaveBeenCalled();
      expect(renderAfterFinalize).not.toHaveBeenCalled();
      expect(ensureCurrentPlayerCanActOrPass).not.toHaveBeenCalled();
      expect(deps.busy).toEqual({ processing: false, cardAnimating: false });
    }
  );

  test('settles an authority-accepted publish exactly once, then suppresses all later callbacks after a latch race', async () => {
    let blocked = false;
    const deps = createDeps({
      pendingType: 'TRAP_WILL',
      contract: { kind: 'single_stage', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true }
    });
    const exactVisualSettlement = jest.fn(async () => ({ ok: true, visualSeq: 19 }));
    const ensureCurrentPlayerCanActOrPass = jest.fn();
    deps.isCardRuntimeIntegrityBlocked = () => blocked;
    deps.shouldUseNetworkPublishOnlyPendingSelection = () => true;
    deps.publishPendingSelectionSnapshot = jest.fn(async () => {
      blocked = true;
      return { ok: true, presentationCursor: { visualSeq: 19 } };
    });
    deps.waitForAuthoritativeVisualSettlement = exactVisualSettlement;
    deps.resolveRootFunction = (name) => name === 'ensureCurrentPlayerCanActOrPass'
      ? ensureCurrentPlayerCanActOrPass
      : null;

    const result = await ExecutionCore.executePendingSelectionCore({
      row: 2,
      col: 3,
      playerKey: 'black',
      pendingType: 'TRAP_WILL',
      actionPayload: { target: { row: 2, col: 3 } }
    }, deps);

    expect(result).toMatchObject({ ok: false, reason: 'runtime_unavailable' });
    expect(exactVisualSettlement).toHaveBeenCalledTimes(1);
    expect(deps.clearPendingSelectionAction).not.toHaveBeenCalled();
    expect(deps.clearPendingSelectionFailureState).not.toHaveBeenCalled();
    expect(deps.finalizePendingSelectionFlow).not.toHaveBeenCalled();
    expect(ensureCurrentPlayerCanActOrPass).not.toHaveBeenCalled();
    expect(deps.busy).toEqual({ processing: false, cardAnimating: false });
  });

  test.each(['reported failure', 'rejection'])(
    'authority-accepted publish drains accepted visuals after a latch races with exact settlement %s',
    async (exactFailureMode) => {
      let blocked = false;
      const deps = createDeps({
        pendingType: 'TRAP_WILL',
        contract: { kind: 'single_stage', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true }
      });
      let resolveLegacyDrain: () => void = () => undefined;
      const legacyDrain = jest.fn(() => new Promise<void>((resolve) => {
        resolveLegacyDrain = resolve;
      }));
      const exactSettlement = exactFailureMode === 'rejection'
        ? jest.fn(async () => { blocked = true; throw new Error('exact waiter rejected'); })
        : jest.fn(async () => { blocked = true; return { ok: false, reason: 'session_changed' }; });
      const renderAfterPublish = jest.fn();
      deps.isCardRuntimeIntegrityBlocked = () => blocked;
      deps.shouldUseNetworkPublishOnlyPendingSelection = () => true;
      deps.publishPendingSelectionSnapshot = jest.fn(async () => ({
        ok: true,
        presentationCursor: { visualSeq: 20 }
      }));
      deps.waitForAuthoritativeVisualSettlement = exactSettlement;
      deps.waitForSelectionPlaybackIdle = legacyDrain;

      const executionPromise = ExecutionCore.executePendingSelectionCore({
        row: 2,
        col: 3,
        playerKey: 'black',
        pendingType: 'TRAP_WILL',
        actionPayload: { target: { row: 2, col: 3 } },
        defaultSelectionHandoffRender: renderAfterPublish
      }, deps);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(exactSettlement).toHaveBeenCalledTimes(1);
      expect(legacyDrain).toHaveBeenCalledWith([], { force: true, authorityAccepted: true });
      expect(renderAfterPublish).not.toHaveBeenCalled();
      expect(deps.clearPendingSelectionAction).not.toHaveBeenCalled();

      resolveLegacyDrain();
      const result = await executionPromise;

      expect(result).toMatchObject({ ok: false, reason: 'runtime_unavailable' });
      expect(renderAfterPublish).not.toHaveBeenCalled();
      expect(deps.clearPendingSelectionAction).not.toHaveBeenCalled();
    }
  );

  test('keeps the legacy visual waiter for compatibility when the exact waiter is unavailable', async () => {
    const deps = createDeps({
      pendingType: 'TRAP_WILL',
      contract: { kind: 'single_stage', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true }
    });
    deps.shouldUseNetworkPublishOnlyPendingSelection = () => true;
    deps.publishPendingSelectionSnapshot = jest.fn(async () => ({ ok: true }));
    deps.waitForAuthoritativeVisualSettlement = jest.fn(async () => undefined);
    deps.waitForSelectionPlaybackIdle = jest.fn(async () => undefined);

    const result = await ExecutionCore.executePendingSelectionCore({
      row: 2,
      col: 3,
      playerKey: 'black',
      pendingType: 'TRAP_WILL',
      actionPayload: { target: { row: 2, col: 3 } }
    }, deps);

    expect(result).toMatchObject({ ok: true, publishedByNetwork: true });
    expect(deps.waitForSelectionPlaybackIdle).toHaveBeenCalledWith([], {
      force: true,
      authorityAccepted: true
    });
  });

  test.each(['reported failure', 'rejection'])(
    'does not weaken strict visual settlement after an ordinary exact waiter %s',
    async (exactFailureMode) => {
      const deps = createDeps({
        pendingType: 'TRAP_WILL',
        contract: { kind: 'single_stage', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true }
      });
      const legacyDrain = jest.fn(async () => undefined);
      deps.shouldUseNetworkPublishOnlyPendingSelection = () => true;
      deps.publishPendingSelectionSnapshot = jest.fn(async () => ({ ok: true }));
      deps.waitForAuthoritativeVisualSettlement = exactFailureMode === 'rejection'
        ? jest.fn(async () => { throw new Error('exact waiter rejected'); })
        : jest.fn(async () => ({ ok: false, reason: 'session_changed' }));
      deps.waitForSelectionPlaybackIdle = legacyDrain;
      const renderAfterPublish = jest.fn();

      const result = await ExecutionCore.executePendingSelectionCore({
        row: 2,
        col: 3,
        playerKey: 'black',
        pendingType: 'TRAP_WILL',
        actionPayload: { target: { row: 2, col: 3 } },
        defaultSelectionHandoffRender: renderAfterPublish
      }, deps);

      expect(result).toMatchObject({ ok: false, reason: 'visual_settlement_failed' });
      expect(legacyDrain).not.toHaveBeenCalled();
      expect(renderAfterPublish).not.toHaveBeenCalled();
      expect(deps.clearPendingSelectionAction).not.toHaveBeenCalled();
    }
  );

  test.each(['direct publish', 'completed multi-stage publish', 'preview-then-publish'])(
    'late integrity latch after exact settlement failure drains accepted visuals for %s',
    async (lane) => {
      let blocked = false;
      const pendingType = lane === 'completed multi-stage publish'
        ? 'BOARD_EXPANSION_GOD'
        : 'TRAP_WILL';
      const contract = lane === 'completed multi-stage publish'
        ? { kind: 'multi_stage', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true }
        : { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true };
      const deps = createDeps({
        pendingType,
        contract,
        previewThenPublish: lane === 'preview-then-publish'
      });
      if (lane === 'direct publish') {
        deps.shouldUseNetworkPublishOnlyPendingSelection = () => true;
      }
      let resolveExactSettlement = null;
      const exactSettlement = jest.fn(() => new Promise((resolve) => {
        resolveExactSettlement = resolve;
      }));
      const legacyDrain = jest.fn(async () => undefined);
      const renderAfterPublish = jest.fn();
      const ensureCurrentPlayerCanActOrPass = jest.fn();
      deps.isCardRuntimeIntegrityBlocked = () => blocked;
      deps.publishPendingSelectionSnapshot = jest.fn(async () => ({
        ok: true,
        presentationCursor: { visualSeq: 27 }
      }));
      deps.waitForAuthoritativeVisualSettlement = exactSettlement;
      deps.waitForSelectionPlaybackIdle = legacyDrain;
      deps.resolveRootFunction = (name) => name === 'ensureCurrentPlayerCanActOrPass'
        ? ensureCurrentPlayerCanActOrPass
        : null;

      const executionPromise = ExecutionCore.executePendingSelectionCore({
        row: 2,
        col: 3,
        playerKey: 'black',
        pendingType,
        actionPayload: { target: { row: 2, col: 3 } },
        validateResult: () => true,
        defaultSelectionHandoffRender: renderAfterPublish
      }, deps);
      for (let index = 0; index < 8 && !resolveExactSettlement; index += 1) {
        await Promise.resolve();
      }
      expect(resolveExactSettlement).toEqual(expect.any(Function));

      resolveExactSettlement({ ok: false, reason: 'session_changed' });
      queueMicrotask(() => {
        blocked = true;
      });
      const result = await executionPromise;

      expect(result).toMatchObject({ ok: false, reason: 'runtime_unavailable' });
      expect(exactSettlement).toHaveBeenCalledTimes(1);
      expect(legacyDrain).toHaveBeenCalledWith([], { force: true, authorityAccepted: true });
      expect(deps.clearPendingSelectionAction).not.toHaveBeenCalled();
      expect(renderAfterPublish).not.toHaveBeenCalled();
      expect(ensureCurrentPlayerCanActOrPass).not.toHaveBeenCalled();
    }
  );

  test('publish-only acceptance clears a stale cached action after authority ends the pending selection', async () => {
    const deps = createDeps({
      pendingType: 'TRAP_WILL',
      contract: { kind: 'single_stage', turnOutcome: 'continue_turn', deferNetworkPublish: true }
    });
    deps.shouldUseNetworkPublishOnlyPendingSelection = () => true;
    deps.publishPendingSelectionSnapshot = jest.fn(async () => ({ ok: true }));

    const result = await ExecutionCore.executePendingSelectionCore({
      row: 2,
      col: 3,
      playerKey: 'black',
      pendingType: 'TRAP_WILL',
      actionPayload: { target: { row: 2, col: 3 } }
    }, deps);

    expect(result).toMatchObject({ ok: true, publishedByNetwork: true });
    expect(deps.clearPendingSelectionAction).toHaveBeenCalledWith('black');
  });

  test('publish-only acceptance retains cache while authority keeps the same pending selection', async () => {
    const deps = createDeps({
      pendingType: 'TRAP_WILL',
      contract: { kind: 'single_stage', turnOutcome: 'continue_turn', deferNetworkPublish: true }
    });
    deps.shouldUseNetworkPublishOnlyPendingSelection = () => true;
    deps.shouldRetainPendingSelectionAction = () => true;
    deps.publishPendingSelectionSnapshot = jest.fn(async () => ({ ok: true }));

    const result = await ExecutionCore.executePendingSelectionCore({
      row: 2,
      col: 3,
      playerKey: 'black',
      pendingType: 'TRAP_WILL',
      actionPayload: { target: { row: 2, col: 3 } }
    }, deps);

    expect(result).toMatchObject({ ok: true, publishedByNetwork: true });
    expect(deps.clearPendingSelectionAction).not.toHaveBeenCalled();
  });

  test('publish-only latch during authority cache inspection preserves the cached action', async () => {
    let blocked = false;
    const deps = createDeps({
      pendingType: 'TRAP_WILL',
      contract: { kind: 'single_stage', turnOutcome: 'continue_turn', deferNetworkPublish: true }
    });
    deps.isCardRuntimeIntegrityBlocked = () => blocked;
    deps.shouldUseNetworkPublishOnlyPendingSelection = () => true;
    deps.shouldRetainPendingSelectionAction = () => {
      blocked = true;
      return false;
    };
    deps.publishPendingSelectionSnapshot = jest.fn(async () => ({ ok: true }));

    const result = await ExecutionCore.executePendingSelectionCore({
      row: 2,
      col: 3,
      playerKey: 'black',
      pendingType: 'TRAP_WILL',
      actionPayload: { target: { row: 2, col: 3 } }
    }, deps);

    expect(result).toMatchObject({ ok: false, reason: 'runtime_unavailable' });
    expect(deps.clearPendingSelectionAction).not.toHaveBeenCalled();
  });

  test('preserves the pending action when authority rejects with RUNTIME_UNAVAILABLE', async () => {
    const deps = createDeps({
      pendingType: 'TRAP_WILL',
      contract: { kind: 'single_stage', turnOutcome: 'continue_turn', deferNetworkPublish: true }
    });
    const ensureCurrentPlayerCanActOrPass = jest.fn();
    deps.shouldUseNetworkPublishOnlyPendingSelection = () => true;
    deps.publishPendingSelectionSnapshot = jest.fn(async () => ({ ok: false, reason: 'RUNTIME_UNAVAILABLE' }));
    deps.resolveRootFunction = (name) => name === 'ensureCurrentPlayerCanActOrPass'
      ? ensureCurrentPlayerCanActOrPass
      : null;

    const result = await ExecutionCore.executePendingSelectionCore({
      row: 2,
      col: 3,
      playerKey: 'black',
      pendingType: 'TRAP_WILL',
      actionPayload: { target: { row: 2, col: 3 } }
    }, deps);

    expect(result).toMatchObject({ ok: false, reason: 'runtime_unavailable' });
    expect(deps.clearPendingSelectionAction).not.toHaveBeenCalled();
    expect(deps.clearPendingSelectionFailureState).not.toHaveBeenCalled();
    expect(ensureCurrentPlayerCanActOrPass).not.toHaveBeenCalled();
    expect(deps.busy).toEqual({ processing: false, cardAnimating: false });
  });

  test('treats a finalizer exception that raises the integrity latch as runtime_unavailable', async () => {
    let blocked = false;
    const deps = createDeps({
      pendingType: 'TRAP_WILL',
      contract: { kind: 'single_stage', turnOutcome: 'continue_turn', deferNetworkPublish: false }
    });
    const ensureCurrentPlayerCanActOrPass = jest.fn();
    deps.isCardRuntimeIntegrityBlocked = () => blocked;
    deps.resolveRootFunction = (name) => name === 'ensureCurrentPlayerCanActOrPass'
      ? ensureCurrentPlayerCanActOrPass
      : null;
    deps.finalizePendingSelectionFlow = jest.fn(async () => {
      blocked = true;
      throw new Error('integrity failure while finalizing');
    });

    const result = await ExecutionCore.executePendingSelectionCore({
      row: 2,
      col: 3,
      playerKey: 'black',
      pendingType: 'TRAP_WILL',
      actionPayload: { target: { row: 2, col: 3 } }
    }, deps);

    expect(result).toMatchObject({
      ok: false,
      reason: 'runtime_unavailable',
      result: { ok: false, reason: 'RUNTIME_UNAVAILABLE' }
    });
    expect(ensureCurrentPlayerCanActOrPass).not.toHaveBeenCalled();
    expect(deps.clearPendingSelectionFailureState).not.toHaveBeenCalled();
    expect(deps.busy).toEqual({ processing: false, cardAnimating: false });
  });

  test('rechecks integrity after a successful finalizer resolves across a microtask boundary', async () => {
    let blocked = false;
    const deps = createDeps({
      pendingType: 'TRAP_WILL',
      contract: { kind: 'single_stage', turnOutcome: 'continue_turn', deferNetworkPublish: false }
    });
    deps.isCardRuntimeIntegrityBlocked = () => blocked;
    deps.finalizePendingSelectionFlow = jest.fn(() => {
      queueMicrotask(() => {
        blocked = true;
      });
      return Promise.resolve(true);
    });

    const result = await ExecutionCore.executePendingSelectionCore({
      row: 2,
      col: 3,
      playerKey: 'black',
      pendingType: 'TRAP_WILL',
      actionPayload: { target: { row: 2, col: 3 } }
    }, deps);

    expect(result).toMatchObject({ ok: false, reason: 'runtime_unavailable' });
    expect(deps.clearPendingSelectionFailureState).not.toHaveBeenCalled();
    expect(deps.busy).toEqual({ processing: false, cardAnimating: false });
  });

  test('propagates an explicit runtime-unavailable finalizer report without relying on a global latch', async () => {
    const deps = createDeps({
      pendingType: 'TRAP_WILL',
      contract: { kind: 'single_stage', turnOutcome: 'continue_turn', deferNetworkPublish: false }
    });
    deps.isCardRuntimeIntegrityBlocked = () => false;
    deps.finalizePendingSelectionFlow = jest.fn(async (options) => {
      options.onRuntimeUnavailable({ ok: false, reason: 'RUNTIME_UNAVAILABLE' });
      return false;
    });

    const result = await ExecutionCore.executePendingSelectionCore({
      row: 2,
      col: 3,
      playerKey: 'black',
      pendingType: 'TRAP_WILL',
      actionPayload: { target: { row: 2, col: 3 } }
    }, deps);

    expect(result).toMatchObject({ ok: false, reason: 'runtime_unavailable' });
    expect(deps.clearPendingSelectionFailureState).not.toHaveBeenCalled();
    expect(deps.busy).toEqual({ processing: false, cardAnimating: false });
  });

  test('does not restore ordinary recovery when ensure itself raises the integrity latch', async () => {
    let blocked = false;
    const deps = createDeps({
      pendingType: 'TRAP_WILL',
      contract: { kind: 'single_stage', turnOutcome: 'continue_turn', deferNetworkPublish: false }
    });
    const ensureCurrentPlayerCanActOrPass = jest.fn(() => {
      blocked = true;
      throw new Error('runtime unavailable during ensure');
    });
    deps.isCardRuntimeIntegrityBlocked = () => blocked;
    deps.resolveRootFunction = (name) => name === 'ensureCurrentPlayerCanActOrPass'
      ? ensureCurrentPlayerCanActOrPass
      : null;
    deps.finalizePendingSelectionFlow = jest.fn(() => Promise.reject(new Error('ordinary finalizer failure')));

    const result = await ExecutionCore.executePendingSelectionCore({
      row: 2,
      col: 3,
      playerKey: 'black',
      pendingType: 'TRAP_WILL',
      actionPayload: { target: { row: 2, col: 3 } }
    }, deps);

    expect(result).toMatchObject({ ok: false, reason: 'runtime_unavailable' });
    expect(ensureCurrentPlayerCanActOrPass).toHaveBeenCalledTimes(1);
    expect(deps.clearPendingSelectionFailureState).not.toHaveBeenCalled();
    expect(deps.busy).toEqual({ processing: false, cardAnimating: false });
  });

  test('preserves pending failure state when direct publish recovery ensure raises the integrity latch', async () => {
    let blocked = false;
    const deps = createDeps({
      pendingType: 'TRAP_WILL',
      contract: { kind: 'single_stage', turnOutcome: 'continue_turn', deferNetworkPublish: true }
    });
    const ensureCurrentPlayerCanActOrPass = jest.fn(() => {
      blocked = true;
      throw new Error('runtime unavailable during ensure');
    });
    deps.isCardRuntimeIntegrityBlocked = () => blocked;
    deps.shouldUseNetworkPublishOnlyPendingSelection = () => true;
    deps.publishPendingSelectionSnapshot = jest.fn(async () => ({ ok: false, reason: 'OUT_OF_TURN' }));
    deps.resolveRootFunction = (name) => name === 'ensureCurrentPlayerCanActOrPass'
      ? ensureCurrentPlayerCanActOrPass
      : null;

    const result = await ExecutionCore.executePendingSelectionCore({
      row: 2,
      col: 3,
      playerKey: 'black',
      pendingType: 'TRAP_WILL',
      actionPayload: { target: { row: 2, col: 3 } }
    }, deps);

    expect(result).toMatchObject({ ok: false, reason: 'runtime_unavailable' });
    expect(deps.clearPendingSelectionFailureState).not.toHaveBeenCalled();
    expect(deps.clearPendingSelectionAction).not.toHaveBeenCalled();
  });

  test('cannot return publish-only success when the post-settlement render raises the integrity latch', async () => {
    let blocked = false;
    const deps = createDeps({
      pendingType: 'TRAP_WILL',
      contract: { kind: 'single_stage', turnOutcome: 'continue_turn', deferNetworkPublish: true },
      previewThenPublish: true
    });
    deps.isCardRuntimeIntegrityBlocked = () => blocked;
    deps.publishPendingSelectionSnapshot = jest.fn(async () => ({ ok: true }));
    const renderAfterPublish = jest.fn(async () => {
      blocked = true;
      throw new Error('runtime unavailable while rendering');
    });

    const result = await ExecutionCore.executePendingSelectionCore({
      row: 2,
      col: 3,
      playerKey: 'black',
      pendingType: 'TRAP_WILL',
      actionPayload: { target: { row: 2, col: 3 } },
      defaultSelectionHandoffRender: renderAfterPublish
    }, deps);

    expect(result).toMatchObject({ ok: false, reason: 'runtime_unavailable' });
    expect(renderAfterPublish).toHaveBeenCalledTimes(1);
    expect(deps.clearPendingSelectionAction).not.toHaveBeenCalled();
    expect(deps.busy).toEqual({ processing: false, cardAnimating: false });
  });
});
