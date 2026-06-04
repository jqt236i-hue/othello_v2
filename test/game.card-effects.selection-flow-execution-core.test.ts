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
});
