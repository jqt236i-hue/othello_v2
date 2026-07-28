import {
  assembleMatchCommandActionPresentation,
  applyPreparedMatchCommandExecution,
  executeMatchCommand,
  prepareMatchCommandExecution,
  prepareMatchCommandAction,
  reconcileMatchCommandTurnStart,
  shouldReconcileMatchCommandTurnStart,
  shouldSkipMatchCommandTurnStart,
  validateCanonicalMatchCommandSnapshot
} from '../utils/match-command-runtime';
import type {
  MatchCommandAuthorityContext,
  MatchCommandExecutionCapabilities
} from '../utils/match-runtime-ports';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createAuthorityContext(overrides: any = {}): MatchCommandAuthorityContext {
  return {
    snapshot: {
      gameState: { currentPlayer: 1, turnNumber: 3 },
      cardState: {
        turnIndex: 4,
        hands: { black: [], white: [] },
        pendingEffectByPlayer: { black: null, white: null },
        prngState: { seed: 17, calls: 2 },
        chargeDeltaEvents: [{ player: 'black', amount: 99 }]
      }
    },
    playerKey: 'black',
    roomSeed: 17,
    stateVersion: 6,
    initialDeckOptions: {},
    networkDebugEnabled: false,
    networkAutoEnabled: false,
    ...overrides
  };
}

function createExecutionCapabilities(overrides: any = {}): MatchCommandExecutionCapabilities {
  const capabilities: any = {
    snapshot: {
      cloneSnapshot: (snapshot) => clone(snapshot),
      stripTransientChargeDeltaState: (snapshot) => {
        snapshot.cardState.chargeDeltaEvents = [];
      },
      stripTransientPresentationState: jest.fn(),
      restoreMissingChargeDeltaEvents: jest.fn()
    },
    schema: {
      buildAction: (input, fallbackActor) => ({
        actor: fallbackActor,
        action: input.action || { type: input.actionType || 'pass' }
      })
    },
    autoCommand: {
      isAutoTurnPublishBody: (body) => body.actionType === 'auto_turn',
      resolveAutoTurnPublishBody: ({ body }) => ({
        ok: true,
        body: {
          ...body,
          actionType: 'pass',
          action: { type: 'pass', playerKey: 'black' }
        }
      })
    },
    debug: {
      isDebugFillHandPayload: (body) => body.actionType === 'debug_fill_hand',
      resolveDebugFillHandOptions: () => ({ replaceExisting: true }),
      fillDebugHand: jest.fn(() => true)
    },
    random: {
      fromState: jest.fn((state) => ({ source: 'restored', state })),
      createPrng: jest.fn((seed) => ({ source: 'derived', seed })),
      deriveSeed: jest.fn(() => 991)
    },
    pipeline: {
      applyTurnSafe: jest.fn((cardState, gameState) => ({
        ok: true,
        cardState: clone(cardState),
        gameState: clone(gameState),
        events: [{ type: 'PASS' }]
      }))
    },
    turnStart: {
      isGameOver: jest.fn(() => false),
      createCardState: jest.fn(() => ({})),
      mergeWithDefaultShape: jest.fn((_base, current) => current),
      applyTurnStartPhase: jest.fn(),
      cardLogic: {},
      coreLogic: {}
    },
    authority: {
      normalizePlayerKey: (value) => value === 'white' ? 'white' : 'black',
      parsePlayerKeyOptional: (value) => value === 'black' || value === 'white' ? value : null,
      getCurrentPlayerKey: (gameState) => Number((gameState as any).currentPlayer) === -1 ? 'white' : 'black',
      parseHiddenHandToken: (value) => typeof value === 'string' && value.startsWith('__hidden_hand__:')
        ? { ownerKey: value.split(':')[1] }
        : null,
      validatePendingSelectionPublish: jest.fn(() => ({ ok: true, pendingEffectId: 'pending_1' })),
      sanitizePendingSelectionActionForAuthority: jest.fn((_snapshot, _playerKey, action) => action),
      validateAuthoritativePendingSelectionResult: jest.fn(() => ({ ok: true })),
      isSubPlacementTurnActive: jest.fn(() => false)
    },
    presentation: {
      collectActionPlaybackEvents: jest.fn(() => ({
        playbackEvents: [],
        presentationEvents: [],
        diagnostics: null
      })),
      collectTurnStartPlaybackEvents: jest.fn(() => ({
        playbackEvents: [],
        presentationEvents: [],
        diagnostics: null
      })),
      buildActionEffectLogs: jest.fn(() => []),
      collectTurnStartEffectLogs: jest.fn(() => []),
      appendTurnStartDrawPlaybackEvents: jest.fn((options) => options.playbackAssembly),
      appendPlaybackEventsAfter: jest.fn((first, second) => [...first, ...second]),
      appendEffectLogMessages: jest.fn((first, second) => [...first, ...second]),
      reportPlaybackAssemblyDiagnostics: jest.fn(),
      toDebugPlaybackDiagnostics: jest.fn(() => null)
    }
  };
  for (const [key, value] of Object.entries(overrides)) {
    capabilities[key] = value;
  }
  return capabilities;
}

describe('match command runtime helpers', () => {
  test('prepares the shared canonical action and preserves a pending-selection turn skip', () => {
    const buildAction = jest.fn(() => ({
      actor: 'black',
      action: { type: 'select_target', pendingSelectionState: { type: 'SEED' } }
    }));
    const validatePendingSelectionPublish = jest.fn(() => ({
      ok: true,
      pendingEffectId: 'pending_1'
    }));
    const sanitizePendingSelectionActionForAuthority = jest.fn((_snapshot, _playerKey, action) => action);
    const snapshot = {
      cardState: {
        turnIndex: 7,
        pendingEffectByPlayer: { black: { type: 'SEED' } }
      }
    };

    const prepared = prepareMatchCommandAction({
      snapshot,
      body: { actionType: 'select_target', action: { type: 'select_target' } },
      playerKey: 'black',
      buildAction,
      normalizePlayerKey: (value) => value,
      validatePendingSelectionPublish,
      sanitizePendingSelectionActionForAuthority
    });

    expect(prepared).toEqual(expect.objectContaining({
      ok: true,
      currentTurnIndex: 7,
      pendingValidation: { ok: true, pendingEffectId: 'pending_1' }
    }));
    expect(buildAction).toHaveBeenCalledWith({
      actionType: 'select_target',
      actor: undefined,
      params: undefined,
      actionId: undefined,
      turnIndex: undefined,
      action: { type: 'select_target' }
    }, 'black', 7);
    if (prepared.ok !== true) throw new Error('Expected a prepared command');
    expect(shouldSkipMatchCommandTurnStart({
      cardState: prepared.currentCardState,
      playerKey: 'black',
      resolvedAction: prepared.resolvedAction,
      isSubPlacementTurnActive: () => false
    })).toBe(true);
  });

  test('keeps schema, seat, and pending-selection rejections fail-closed', () => {
    const base = {
      snapshot: { cardState: { turnIndex: 2 } },
      body: { actionType: 'place' },
      playerKey: 'black',
      normalizePlayerKey: (value) => value,
      validatePendingSelectionPublish: () => ({ ok: true }),
      sanitizePendingSelectionActionForAuthority: () => ({ type: 'place' })
    };

    expect(prepareMatchCommandAction({
      ...base,
      buildAction: () => null
    })).toEqual({ ok: false, rejectedReason: 'COMMAND_REQUIRED' });
    expect(prepareMatchCommandAction({
      ...base,
      buildAction: () => ({ actor: 'white', action: { type: 'place' } })
    })).toEqual({ ok: false, rejectedReason: 'SEAT_MISMATCH' });
    expect(prepareMatchCommandAction({
      ...base,
      buildAction: () => ({ actor: 'black', action: { type: 'place' } }),
      validatePendingSelectionPublish: () => ({ ok: false, rejectedReason: 'STALE_PENDING_SELECTION' })
    })).toEqual({ ok: false, rejectedReason: 'STALE_PENDING_SELECTION' });
  });

  test.each([
    ['null', null],
    ['undefined', undefined],
    ['empty object', {}]
  ])('treats %s network debug options as unspecified and strips them', (_label, debugOptions) => {
    const sanitizePendingSelectionActionForAuthority = jest.fn((_snapshot, _playerKey, action) => action);
    const prepared = prepareMatchCommandAction({
      snapshot: { cardState: { turnIndex: 3 } },
      body: { actionType: 'use_card' },
      playerKey: 'black',
      networkDebugEnabled: false,
      buildAction: () => ({
        actor: 'black',
        action: { type: 'use_card', debugOptions }
      }),
      normalizePlayerKey: (value) => value,
      validatePendingSelectionPublish: () => ({ ok: true }),
      sanitizePendingSelectionActionForAuthority
    });

    expect(prepared).toEqual(expect.objectContaining({ ok: true }));
    expect(sanitizePendingSelectionActionForAuthority).toHaveBeenCalledWith(
      expect.any(Object),
      'black',
      { type: 'use_card' }
    );
  });

  test.each([
    ['no-consume', { ignoreCost: true, noConsume: true }],
    ['turn-limit bypass', { skipCostAndTurnLimit: true }]
  ])('rejects non-empty %s options when network debug is disabled', (_label, debugOptions) => {
    expect(prepareMatchCommandAction({
      snapshot: { cardState: { turnIndex: 3 } },
      body: { actionType: 'use_card' },
      playerKey: 'black',
      networkDebugEnabled: false,
      buildAction: () => ({
        actor: 'black',
        action: { type: 'use_card', debugOptions }
      }),
      normalizePlayerKey: (value) => value,
      validatePendingSelectionPublish: () => ({ ok: true }),
      sanitizePendingSelectionActionForAuthority: (_snapshot, _playerKey, action) => action
    })).toEqual({ ok: false, rejectedReason: 'NETWORK_DEBUG_DISABLED' });
  });

  test('allows and canonicalizes the exact server-enabled no-consume debug pair', () => {
    const prepared = prepareMatchCommandAction({
      snapshot: { cardState: { turnIndex: 3 } },
      body: { actionType: 'use_card' },
      playerKey: 'black',
      networkDebugEnabled: true,
      buildAction: () => ({
        actor: 'black',
        action: {
          type: 'use_card',
          debugOptions: { noConsume: true, ignoreCost: true }
        }
      }),
      normalizePlayerKey: (value) => value,
      validatePendingSelectionPublish: () => ({ ok: true }),
      sanitizePendingSelectionActionForAuthority: (_snapshot, _playerKey, action) => action
    });

    expect(prepared).toEqual(expect.objectContaining({
      ok: true,
      resolvedAction: {
        type: 'use_card',
        debugOptions: { ignoreCost: true, noConsume: true }
      }
    }));
  });

  test.each([
    ['turn-limit bypass', { skipCostAndTurnLimit: true }],
    ['unknown option', { ignoreCost: true, noConsume: true, surprise: true }],
    ['partial allowlist', { noConsume: true }]
  ])('rejects %s even when network debug is enabled', (_label, debugOptions) => {
    expect(prepareMatchCommandAction({
      snapshot: { cardState: { turnIndex: 3 } },
      body: { actionType: 'use_card' },
      playerKey: 'black',
      networkDebugEnabled: true,
      buildAction: () => ({
        actor: 'black',
        action: { type: 'use_card', debugOptions }
      }),
      normalizePlayerKey: (value) => value,
      validatePendingSelectionPublish: () => ({ ok: true }),
      sanitizePendingSelectionActionForAuthority: (_snapshot, _playerKey, action) => action
    })).toEqual({ ok: false, rejectedReason: 'NETWORK_DEBUG_OPTIONS_INVALID' });
  });
});

describe('shared match command prepare and apply stages', () => {
  test.each([
    ['schema', { schema: null }, { actionType: 'pass' }, 'COMMAND_SCHEMA_UNAVAILABLE'],
    ['pipeline', { pipeline: null }, { actionType: 'pass' }, 'COMMAND_PIPELINE_UNAVAILABLE'],
    ['AUTO planner', { autoCommand: null }, { actionType: 'auto_turn' }, 'AUTO_COMMAND_PLANNER_UNAVAILABLE'],
    ['debug actions', { debug: null }, { actionType: 'debug_fill_hand' }, 'DEBUG_ACTIONS_UNAVAILABLE']
  ])('fails closed when %s capability is missing', (_label, overrides, body, rejectedReason) => {
    const result = prepareMatchCommandExecution(
      createAuthorityContext(),
      body,
      createExecutionCapabilities(overrides)
    );

    expect(result).toEqual({
      kind: 'terminal',
      result: { ok: false, rejectedReason }
    });
  });

  test.each([
    ['projected seat metadata', { _meta: { projectedForSeat: 'black' } }],
    ['viewer role metadata', { _meta: { viewerRole: 'spectator' } }],
    ['black hidden hand', { cardState: { hands: { black: ['__hidden_hand__:black:0'], white: [] } } }],
    ['white hidden hand', { cardState: { hands: { black: [], white: ['__hidden_hand__:white:0'] } } }]
  ])('rejects non-canonical snapshot input with %s', (_label, patch) => {
    const context: any = createAuthorityContext();
    context.snapshot = {
      ...context.snapshot,
      ...patch,
      cardState: {
        ...context.snapshot.cardState,
        ...((patch as any).cardState || {})
      }
    };
    const capabilities = createExecutionCapabilities();

    expect(validateCanonicalMatchCommandSnapshot(context.snapshot, capabilities.authority)).toBe(false);
    expect(prepareMatchCommandExecution(context, { actionType: 'pass' }, capabilities)).toEqual({
      kind: 'terminal',
      result: { ok: false, rejectedReason: 'INVALID_SNAPSHOT' }
    });
  });

  test('authority context contains only canonical command inputs', () => {
    expect(Object.keys(createAuthorityContext()).sort()).toEqual([
      'initialDeckOptions',
      'networkAutoEnabled',
      'networkDebugEnabled',
      'playerKey',
      'roomSeed',
      'snapshot',
      'stateVersion'
    ]);
  });

  test('debug fill is a terminal shared result and never calls the pipeline', () => {
    const capabilities = createExecutionCapabilities();
    const result = prepareMatchCommandExecution(
      createAuthorityContext({ networkDebugEnabled: true }),
      { actionType: 'debug_fill_hand', action: { type: 'debug_fill_hand' } },
      capabilities
    );

    expect(result).toEqual({
      kind: 'terminal',
      result: expect.objectContaining({
        ok: true,
        rawEvents: [],
        playbackEvents: [],
        effectLogs: [],
        action: { type: 'debug_fill_hand' }
      })
    });
    expect(capabilities.debug!.fillDebugHand).toHaveBeenCalledTimes(1);
    expect(capabilities.pipeline.applyTurnSafe).not.toHaveBeenCalled();
  });

  test('AUTO resolves to a canonical body and preserves planner failures', () => {
    const enabledContext = createAuthorityContext({ networkAutoEnabled: true });
    const capabilities = createExecutionCapabilities();
    const prepared = prepareMatchCommandExecution(
      enabledContext,
      { actionType: 'auto_turn' },
      capabilities
    );
    expect(prepared).toEqual(expect.objectContaining({
      kind: 'prepared',
      value: expect.objectContaining({
        commandBody: expect.objectContaining({ actionType: 'pass' }),
        resolvedAction: expect.objectContaining({ type: 'pass' })
      })
    }));

    const failedCapabilities = createExecutionCapabilities({
      autoCommand: {
        isAutoTurnPublishBody: () => true,
        resolveAutoTurnPublishBody: () => ({ ok: false, rejectedReason: 'AUTO_NO_ACTION' })
      }
    });
    expect(prepareMatchCommandExecution(
      enabledContext,
      { actionType: 'auto_turn' },
      failedCapabilities
    )).toEqual({
      kind: 'terminal',
      result: { ok: false, rejectedReason: 'AUTO_NO_ACTION' }
    });
  });

  test.each([
    ['valid serialized state', { seed: 17, calls: 2 }, 'restored'],
    ['corrupt serialized state', { seed: 'bad', calls: 2 }, 'derived'],
    ['missing serialized state', undefined, 'derived']
  ])('uses the %s PRNG path', (_label, prngState, expectedSource) => {
    const context: any = createAuthorityContext();
    context.snapshot.cardState.prngState = prngState;
    const prepared = prepareMatchCommandExecution(
      context,
      { actionType: 'pass', action: { type: 'pass' } },
      createExecutionCapabilities()
    );

    expect(prepared).toEqual(expect.objectContaining({
      kind: 'prepared',
      value: expect.objectContaining({
        prng: expect.objectContaining({ source: expectedSource })
      })
    }));
  });

  test('pending selection and sub-placement both preserve skipTurnStart', () => {
    const pendingContext: any = createAuthorityContext();
    pendingContext.snapshot.cardState.pendingEffectByPlayer.black = { type: 'SEED' };
    const pending = prepareMatchCommandExecution(
      pendingContext,
      {
        actionType: 'select_target',
        action: {
          type: 'select_target',
          pendingSelectionState: { type: 'SEED' }
        }
      },
      createExecutionCapabilities()
    );
    expect(pending).toEqual(expect.objectContaining({
      kind: 'prepared',
      value: expect.objectContaining({ skipTurnStart: true })
    }));

    const subCapabilities = createExecutionCapabilities();
    (subCapabilities.authority.isSubPlacementTurnActive as jest.Mock).mockReturnValue(true);
    const subPlacement = prepareMatchCommandExecution(
      createAuthorityContext(),
      { actionType: 'place', action: { type: 'place' } },
      subCapabilities
    );
    expect(subPlacement).toEqual(expect.objectContaining({
      kind: 'prepared',
      value: expect.objectContaining({ skipTurnStart: true })
    }));
  });

  test('applies the pipeline and authoritative pending validation exactly once', () => {
    const capabilities = createExecutionCapabilities();
    const prepared = prepareMatchCommandExecution(
      createAuthorityContext(),
      { actionType: 'pass', action: { type: 'pass' } },
      capabilities
    );
    if (prepared.kind !== 'prepared') throw new Error('expected prepared command');

    const applied = applyPreparedMatchCommandExecution(prepared.value, capabilities);

    expect(applied).toEqual(expect.objectContaining({
      nextSnapshot: expect.any(Object),
      rawEvents: [{ type: 'PASS' }]
    }));
    expect(capabilities.pipeline.applyTurnSafe).toHaveBeenCalledTimes(1);
    expect(capabilities.authority.validateAuthoritativePendingSelectionResult).toHaveBeenCalledTimes(1);
  });

  test('keeps pipeline rejection raw events and rejects invalid authoritative pending results', () => {
    const rejectedCapabilities = createExecutionCapabilities();
    (rejectedCapabilities.pipeline.applyTurnSafe as jest.Mock).mockReturnValue({
      ok: false,
      rejectedReason: 'ILLEGAL_MOVE',
      errorMessage: 'occupied',
      events: [{ type: 'REJECTED_EVENT' }]
    });
    const rejectedPrepared = prepareMatchCommandExecution(
      createAuthorityContext(),
      { actionType: 'place', action: { type: 'place' } },
      rejectedCapabilities
    );
    if (rejectedPrepared.kind !== 'prepared') throw new Error('expected prepared command');
    expect(applyPreparedMatchCommandExecution(rejectedPrepared.value, rejectedCapabilities)).toEqual({
      ok: false,
      rejectedReason: 'ILLEGAL_MOVE',
      errorMessage: 'occupied',
      rawEvents: [{ type: 'REJECTED_EVENT' }]
    });

    const invalidPendingCapabilities = createExecutionCapabilities();
    (invalidPendingCapabilities.authority.validateAuthoritativePendingSelectionResult as jest.Mock)
      .mockReturnValue({ ok: false, rejectedReason: 'INVALID_PENDING_SELECTION_TARGET' });
    const invalidPrepared = prepareMatchCommandExecution(
      createAuthorityContext(),
      { actionType: 'select_target', action: { type: 'select_target' } },
      invalidPendingCapabilities
    );
    if (invalidPrepared.kind !== 'prepared') throw new Error('expected prepared command');
    expect(applyPreparedMatchCommandExecution(invalidPrepared.value, invalidPendingCapabilities)).toEqual({
      ok: false,
      rejectedReason: 'INVALID_PENDING_SELECTION_TARGET'
    });
  });
});

describe('shared match command presentation, turn-start, and single executor', () => {
  function prepareAndApply(
    context: MatchCommandAuthorityContext,
    capabilities: MatchCommandExecutionCapabilities
  ) {
    const prepared = prepareMatchCommandExecution(
      context,
      { actionType: 'pass', action: { type: 'pass' } },
      capabilities
    );
    if (prepared.kind !== 'prepared') throw new Error('expected prepared command');
    const applied = applyPreparedMatchCommandExecution(prepared.value, capabilities);
    if ('ok' in applied) throw new Error('expected applied command');
    return applied;
  }

  test('action presentation preserves raw event order and captures command-local charge delta once', () => {
    const capabilities = createExecutionCapabilities();
    (capabilities.pipeline.applyTurnSafe as jest.Mock).mockImplementation((cardState, gameState) => ({
      ok: true,
      cardState: {
        ...clone(cardState),
        chargeDeltaEvents: [{ player: 'black', amount: 3 }]
      },
      gameState: clone(gameState),
      events: [{ type: 'RAW_1' }, { type: 'RAW_2' }]
    }));
    (capabilities.presentation.collectActionPlaybackEvents as jest.Mock).mockReturnValue({
      playbackEvents: [{ type: 'ACTION_PLAYBACK' }],
      presentationEvents: [{ type: 'ACTION_PRESENTATION' }],
      diagnostics: { source: 'action' }
    });
    (capabilities.presentation.buildActionEffectLogs as jest.Mock).mockReturnValue(['action-log']);

    const applied = prepareAndApply(createAuthorityContext(), capabilities);
    const assembly = assembleMatchCommandActionPresentation(applied, capabilities);

    expect(assembly).toEqual(expect.objectContaining({
      rawEvents: [{ type: 'RAW_1' }, { type: 'RAW_2' }],
      playbackEvents: [{ type: 'ACTION_PLAYBACK' }],
      presentationEvents: [{ type: 'ACTION_PRESENTATION' }],
      effectLogs: ['action-log'],
      diagnostics: { source: 'action' },
      actionChargeDeltaEvents: [{ player: 'black', amount: 3 }]
    }));
    expect(capabilities.snapshot.restoreMissingChargeDeltaEvents).toHaveBeenCalledTimes(1);
  });

  test.each([
    [false, 'black', 'black', true],
    [true, 'black', 'black', false],
    [true, 'black', 'white', true]
  ])(
    'turn-start decision uses skip=%s and player transition %s→%s',
    (skipTurnStart, preActionPlayerKey, postActionPlayerKey, expected) => {
      expect(shouldReconcileMatchCommandTurnStart({
        skipTurnStart,
        preActionPlayerKey: preActionPlayerKey as any,
        postActionPlayerKey: postActionPlayerKey as any
      })).toBe(expected);
    }
  );

  test('turn-start reconciliation is synchronous and applies normalized state exactly once', () => {
    const context: any = createAuthorityContext();
    context.snapshot.cardState.lastTurnStartedFor = 'white';
    const capabilities = createExecutionCapabilities();
    (capabilities.turnStart.applyTurnStartPhase as jest.Mock).mockImplementation(
      (_cardLogic, _coreLogic, cardState, _gameState, _playerKey, events) => {
        events.push({ type: 'TURN_START_1' }, { type: 'TURN_START_2' });
        cardState.chargeDeltaEvents = [];
      }
    );
    (capabilities.presentation.collectTurnStartPlaybackEvents as jest.Mock).mockReturnValue({
      playbackEvents: [{ type: 'TURN_START_PLAYBACK' }],
      presentationEvents: [{ type: 'TURN_START_PRESENTATION' }],
      diagnostics: { source: 'turn-start' }
    });
    (capabilities.presentation.collectTurnStartEffectLogs as jest.Mock).mockReturnValue(['turn-start-log']);
    (capabilities.presentation.appendTurnStartDrawPlaybackEvents as jest.Mock).mockImplementation(
      ({ playbackAssembly }) => ({
        ...playbackAssembly,
        playbackEvents: [...playbackAssembly.playbackEvents, { type: 'DRAW_PLAYBACK' }]
      })
    );

    const result: any = reconcileMatchCommandTurnStart(context, clone(context.snapshot), capabilities);

    expect(result && typeof result.then).not.toBe('function');
    expect(result.rawEvents).toEqual([{ type: 'TURN_START_1' }, { type: 'TURN_START_2' }]);
    expect(result.playbackEvents).toEqual([
      { type: 'TURN_START_PLAYBACK' },
      { type: 'DRAW_PLAYBACK' }
    ]);
    expect(result.effectLogs).toEqual(['turn-start-log']);
    expect(capabilities.turnStart.applyTurnStartPhase).toHaveBeenCalledTimes(1);
    expect(capabilities.random.fromState).toHaveBeenCalledTimes(1);
  });

  test('single executor keeps action→turn-start ordering, restores action delta, and cleans presentation', () => {
    const order: string[] = [];
    const context: any = createAuthorityContext({ networkDebugEnabled: true });
    context.snapshot.cardState.lastTurnStartedFor = 'black';
    const capabilities = createExecutionCapabilities();
    (capabilities.pipeline.applyTurnSafe as jest.Mock).mockImplementation((cardState, gameState) => {
      order.push('apply');
      return {
        ok: true,
        cardState: {
          ...clone(cardState),
          lastTurnStartedFor: 'black',
          chargeDeltaEvents: [{ player: 'black', amount: 4 }]
        },
        gameState: { ...clone(gameState), currentPlayer: -1 },
        events: [{ type: 'ACTION_RAW_1' }, { type: 'ACTION_RAW_2' }]
      };
    });
    (capabilities.snapshot.restoreMissingChargeDeltaEvents as jest.Mock).mockImplementation(() => {
      order.push('restore-charge');
    });
    (capabilities.presentation.collectActionPlaybackEvents as jest.Mock).mockImplementation(() => {
      order.push('action-playback');
      return {
        playbackEvents: [{ type: 'ACTION_PLAYBACK_1' }, { type: 'ACTION_PLAYBACK_2' }],
        presentationEvents: [],
        diagnostics: { exact: true }
      };
    });
    (capabilities.presentation.buildActionEffectLogs as jest.Mock).mockReturnValue(['action-log-1', 'action-log-2']);
    (capabilities.turnStart.applyTurnStartPhase as jest.Mock).mockImplementation(
      (_cardLogic, _coreLogic, cardState, _gameState, _playerKey, events) => {
        order.push('turn-start');
        events.push({ type: 'TURN_START_RAW' });
        cardState.chargeDeltaEvents = [];
      }
    );
    (capabilities.presentation.collectTurnStartPlaybackEvents as jest.Mock).mockImplementation(() => {
      order.push('turn-start-playback');
      return {
        playbackEvents: [{ type: 'TURN_START_PLAYBACK' }],
        presentationEvents: [],
        diagnostics: { turnStart: true }
      };
    });
    (capabilities.presentation.collectTurnStartEffectLogs as jest.Mock).mockReturnValue(['turn-start-log']);
    (capabilities.presentation.appendTurnStartDrawPlaybackEvents as jest.Mock).mockImplementation(
      ({ playbackAssembly }) => ({
        ...playbackAssembly,
        playbackEvents: [...playbackAssembly.playbackEvents, { type: 'DRAW_PLAYBACK' }]
      })
    );
    (capabilities.presentation.toDebugPlaybackDiagnostics as jest.Mock).mockImplementation(
      (diagnostics, enabled) => enabled ? diagnostics : null
    );

    const result: any = executeMatchCommand(
      context,
      { actionType: 'pass', action: { type: 'pass' } },
      capabilities
    );

    expect(result && typeof result.then).not.toBe('function');
    expect(result).toEqual(expect.objectContaining({
      ok: true,
      rawEvents: [
        { type: 'ACTION_RAW_1' },
        { type: 'ACTION_RAW_2' },
        { type: 'TURN_START_RAW' }
      ],
      playbackEvents: [
        { type: 'ACTION_PLAYBACK_1' },
        { type: 'ACTION_PLAYBACK_2' },
        { type: 'TURN_START_PLAYBACK' },
        { type: 'DRAW_PLAYBACK' }
      ],
      effectLogs: ['action-log-1', 'action-log-2', 'turn-start-log'],
      playbackDiagnostics: { exact: true }
    }));
    expect(result.snapshot.cardState.chargeDeltaEvents).toEqual([
      { player: 'black', amount: 4 }
    ]);
    expect(order).toEqual([
      'apply',
      'restore-charge',
      'action-playback',
      'turn-start',
      'turn-start-playback'
    ]);
    expect(capabilities.snapshot.stripTransientPresentationState).toHaveBeenCalledTimes(2);
  });

  test('non-empty turn-start charge delta wins and disabled diagnostics stay private', () => {
    const context: any = createAuthorityContext({ networkDebugEnabled: false });
    context.snapshot.cardState.lastTurnStartedFor = 'black';
    const capabilities = createExecutionCapabilities();
    (capabilities.pipeline.applyTurnSafe as jest.Mock).mockImplementation((cardState, gameState) => ({
      ok: true,
      cardState: {
        ...clone(cardState),
        lastTurnStartedFor: 'black',
        chargeDeltaEvents: [{ player: 'black', amount: 4 }]
      },
      gameState: { ...clone(gameState), currentPlayer: -1 },
      events: []
    }));
    (capabilities.turnStart.applyTurnStartPhase as jest.Mock).mockImplementation(
      (_cardLogic, _coreLogic, cardState) => {
        cardState.chargeDeltaEvents = [{ player: 'white', amount: 7 }];
      }
    );
    (capabilities.presentation.collectActionPlaybackEvents as jest.Mock).mockReturnValue({
      playbackEvents: [],
      presentationEvents: [],
      diagnostics: { private: true }
    });
    (capabilities.presentation.toDebugPlaybackDiagnostics as jest.Mock).mockImplementation(
      (_diagnostics, enabled) => enabled ? { private: true } : null
    );

    const result: any = executeMatchCommand(
      context,
      { actionType: 'pass', action: { type: 'pass' } },
      capabilities
    );

    expect(result.snapshot.cardState.chargeDeltaEvents).toEqual([
      { player: 'white', amount: 7 }
    ]);
    expect(result.playbackDiagnostics).toBeNull();
  });

  test('skipped same-player continuation never invokes turn-start capabilities', () => {
    const context: any = createAuthorityContext();
    context.snapshot.cardState.pendingEffectByPlayer.black = { type: 'SEED' };
    const capabilities = createExecutionCapabilities();

    const result = executeMatchCommand(
      context,
      {
        actionType: 'select_target',
        action: {
          type: 'select_target',
          pendingSelectionState: { type: 'SEED' }
        }
      },
      capabilities
    );

    expect(result.ok).toBe(true);
    expect(capabilities.turnStart.applyTurnStartPhase).not.toHaveBeenCalled();
    expect(capabilities.presentation.collectTurnStartPlaybackEvents).not.toHaveBeenCalled();
  });

  test('terminal debug and rejection results stop before later stages', () => {
    const debugCapabilities = createExecutionCapabilities();
    const debug = executeMatchCommand(
      createAuthorityContext({ networkDebugEnabled: true }),
      { actionType: 'debug_fill_hand' },
      debugCapabilities
    );
    expect(debug.ok).toBe(true);
    expect(debugCapabilities.pipeline.applyTurnSafe).not.toHaveBeenCalled();
    expect(debugCapabilities.presentation.collectActionPlaybackEvents).not.toHaveBeenCalled();

    const rejectedCapabilities = createExecutionCapabilities();
    (rejectedCapabilities.pipeline.applyTurnSafe as jest.Mock).mockReturnValue({
      ok: false,
      rejectedReason: 'ILLEGAL_MOVE',
      events: [{ type: 'REJECTED_RAW' }]
    });
    const rejected = executeMatchCommand(
      createAuthorityContext(),
      { actionType: 'place', action: { type: 'place' } },
      rejectedCapabilities
    );
    expect(rejected).toEqual({
      ok: false,
      rejectedReason: 'ILLEGAL_MOVE',
      errorMessage: null,
      rawEvents: [{ type: 'REJECTED_RAW' }]
    });
    expect(rejectedCapabilities.presentation.collectActionPlaybackEvents).not.toHaveBeenCalled();
  });
});
