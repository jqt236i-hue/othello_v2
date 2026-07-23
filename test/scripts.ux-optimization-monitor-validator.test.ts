import {
  UX_OPTIMIZATION_CAPTURE_POLICY_DIGEST,
  UX_OPTIMIZATION_IDS,
  UX_OPTIMIZATION_REPORT_SCHEMA_VERSION,
  UX_OPTIMIZATION_SCENARIO_CAPTURES,
  UX_OPTIMIZATION_SCENARIO_DIGEST,
  UX_OPTIMIZATION_SCENARIOS
} from '../scripts/perf/ux-optimization-monitor-contract';
import {
  findForbiddenReportPaths,
  validateUxOptimizationReport
} from '../scripts/perf/validate-ux-optimization-monitor';

const DEFAULT_FRAME_PNG_PATH =
  'assets/images/board/board-frame-marsh-forged-iron-v1.png';
const DEFAULT_FRAME_WEBP_PATH =
  'assets/images/board/board-frame-marsh-forged-iron-v1.webp';

function validFrameVariant(
  cssPath: string,
  counts: {
    webpRequests: number;
    pngRequests: number;
    webpResponses: number;
    pngResponses: number;
    failedWebpRequests: number;
    browserErrors?: number;
  }
): Record<string, unknown> {
  const cssValue = `url("${cssPath}")`;
  return {
    backend: 'pixi',
    singleWriter: true,
    uiInitialized: true,
    visiblySized: true,
    rootSkinId: 'marsh-forged-iron',
    elementSkinId: 'marsh-forged-iron',
    rootCssValue: cssValue,
    elementCssValue: cssValue,
    computedBackgroundImage: cssValue,
    frameWebpRequestCount: counts.webpRequests,
    framePngRequestCount: counts.pngRequests,
    frameWebpResponseCount: counts.webpResponses,
    framePngResponseCount: counts.pngResponses,
    failedWebpRequestCount: counts.failedWebpRequests,
    browserErrorCount: counts.browserErrors || 0,
    visualScreenshotSha256: '9'.repeat(64)
  };
}

function validReport(): Record<string, any> {
  return {
    schemaVersion: UX_OPTIMIZATION_REPORT_SCHEMA_VERSION,
    profile: 'quick',
    identity: {
      candidateCommit: 'a'.repeat(40),
      dirty: true,
      dirtyPaths: ['M scripts/example.ts'],
      browserArtifactSha256: 'b'.repeat(64),
      fixtureDigest: 'c'.repeat(64),
      scenarioDigest: UX_OPTIMIZATION_SCENARIO_DIGEST,
      capturePolicyDigest: UX_OPTIMIZATION_CAPTURE_POLICY_DIGEST,
      environment: {
        browserVersion: 'Chromium 1',
        os: 'win32',
        viewport: { width: 1366, height: 900 },
        dpr: 1
      }
    },
    pendingOptimizationIds: [],
    scenarios: UX_OPTIMIZATION_SCENARIO_CAPTURES.map((definition) => {
      const firstSpecial = definition.id === 'board.first-special';
      const fallback = definition.id.startsWith('fallback.');
      const lockToggle = definition.id === 'board.lock-toggle';
      const opponentTurn = definition.id === 'playback.opponent-actions';
      const boot = definition.id.startsWith('boot.');
      const help = definition.id.startsWith('help.');
      const webpAsset = definition.id === 'asset.webp-fallback';
      const resultFeature = definition.id === 'feature.result';
      const profileFeature = definition.id === 'feature.profile';
      const rulesHelpFeature = definition.id === 'feature.rules-help';
      const deckBuilderFeature = definition.id === 'feature.deck-builder';
      return {
        id: definition.id,
        lane: definition.lane,
        backend: definition.backend,
        cacheProfile: definition.cacheProfile,
        captureStatus: 'complete',
        phases: [
          { name: 'navigation', atMs: 0 },
          { name: 'feature-ready:fixture', atMs: 2 }
        ],
        resources: firstSpecial || fallback
          ? [
            { path: 'assets/images/special-stones/Time_bomb.png' },
            ...(fallback ? [{ path: 'styles-board-dom-compat.css' }] : [])
          ]
          : resultFeature
            ? [{ path: 'styles-layout-result.css' }]
          : profileFeature
            ? [{ path: 'styles-profile.css' }]
          : rulesHelpFeature
            ? [
              { path: 'styles-feature-rules-help-layout-info.css' },
              { path: 'styles-feature-rules-help-cards.css' },
              { path: 'styles-feature-rules-help-responsive.css' }
            ]
          : deckBuilderFeature
            ? [
              { path: 'styles-feature-deck-builder.css' },
              { path: 'styles-feature-deck-builder-responsive.css' }
            ]
          : [{ path: 'assets/images/ui/example.png' }],
        errors: [],
        metrics: firstSpecial
          ? {
            backend: 'pixi',
            singleWriter: true,
            accepted: true,
            framePreparedBeforeSettlement: true,
            settledSpecialFrame: true,
            neededSpecialAssetIds: ['TIME_BOMB'],
            specialResponseCount: 1
          }
          : fallback
            ? {
              backend: 'dom',
              singleWriter: true,
              fallbackStyled: true,
              specialResponseCount: 1,
              domCompatStylesheetResponseCount: 1,
              domCompatStylesheetLinkCount: 1,
              domCompatStylesheetLoaded: true,
              domCompatStylesheetReadyAt: 4,
              domBackendMountedAt: 5,
              domCompatStylesheetAtSlot: true,
              ...(definition.id === 'fallback.explicit-dom'
                ? {
                  stylesheetFailurePreventedMount: true,
                  stylesheetFailureSurfaced: true,
                  stylesheetFailureUiInitialized: false
                }
                : {}),
              ...(definition.id === 'fallback.context-loss' ? { lossPrevented: true } : {})
            }
            : lockToggle
              ? {
                backend: 'pixi',
                lockAccepted: true,
                unlockAccepted: true,
                lockDelta: {
                  updatedCellViews: 0,
                  updatedStoneViews: 0,
                  updatedHintViews: 64,
                  hintPaintCount: 0,
                  hintInputSyncCount: 64
                },
                unlockDelta: {
                  updatedCellViews: 0,
                  updatedStoneViews: 0,
                  updatedHintViews: 64,
                  hintPaintCount: 0,
                  hintInputSyncCount: 64
                },
                lockedCommandCount: 0,
                unlockCommandCount: 1,
                staleInputStateCount: 0
              }
              : opponentTurn
                ? {
                  backend: 'pixi',
                  settledOpponentTurn: true,
                  longTaskSupported: true,
                  longTaskCount: 0,
                  rafSampleCount: 60,
                  rafP95Ms: 16.7,
                  rafStall50msCount: 0,
                  tickerIdle: true
                }
                : resultFeature
                  ? {
                    backend: 'pixi',
                    resultStylesheetLinkCountBeforeOpen: 0,
                    resultStylesheetSlotCount: 1,
                    resultDomCountBeforeOpen: 0,
                    resultResponseCountBeforeOpen: 0,
                    normalLinkCountImmediately: 1,
                    normalOverlayImmediate: false,
                    normalDisplayDelayMs: 2008,
                    normalStylesheetReadyLatencyMs: 20,
                    normalFullStyleReady: true,
                    normalStyleLeadMs: 1988,
                    normalCascadeOrderPreserved: true,
                    resultResponseCountAfterNormalOpen: 1,
                    normalResultLinkCount: 1,
                    normalPanelVisible: true,
                    normalButtonsVisible: true,
                    normalWarningCount: 0,
                    normalFocusPreserved: true,
                    normalBgmCallCount: 1,
                    normalBgmOutcome: 'win',
                    normalAppendBeforeBgm: true,
                    normalCloseWorked: true,
                    normalReopenAvailable: true,
                    normalReopenWorked: true,
                    normalLinkCountAfterReopen: 1,
                    directReturnType: 'undefined',
                    directDomImmediate: true,
                    directCallLatencyMs: 3,
                    directFullStylePending: true,
                    directCriticalPosition: 'fixed',
                    directCriticalDisplay: 'flex',
                    directCriticalZIndex: '20000',
                    directCriticalBackgroundImage: 'none',
                    directCriticalPanelOverflow: 'auto',
                    directCriticalPanelVisible: true,
                    directCriticalButtonsVisible: true,
                    directFullStyleReady: true,
                    directResultLinkCount: 1,
                    directResultResponseCount: 1,
                    directCascadeOrderPreserved: true,
                    directUnexpectedErrorCount: 0,
                    failureDirectReturnType: 'undefined',
                    failureDomImmediate: true,
                    failureDirectCallLatencyMs: 3,
                    failureInitialButtonsVisible: true,
                    failureWarningVisible: true,
                    failureFallbackClass: true,
                    failureButtonsVisible: true,
                    failureResultLinkCount: 0,
                    failureResultRequestCount: 2,
                    failureResultRequestFailureCount: 1,
                    failureResultResponseCount: 1,
                    failureConsoleErrorCount: 1,
                    failureConsoleWarningCount: 1,
                    failureRetryReady: true,
                    failureRetryWarningCount: 0,
                    failureRetryFallbackClass: false,
                    failureRetryResultLinkCount: 1,
                    clsDelta: 0
                  }
                : profileFeature
                  ? {
                    backend: 'pixi',
                    profileStylesheetLinkCountBeforeOpen: 0,
                    profileStylesheetSlotCount: 1,
                    profileInnerDomCountBeforeOpen: 0,
                    profileResponseCountBeforeOpen: 0,
                    profileOpenIconReady: true,
                    firstOpenLatencyMs: 20,
                    firstStyleReadyLatencyMs: 10,
                    firstLinkCount: 1,
                    firstInnerDomCount: 2,
                    firstPanelVisible: true,
                    firstFullStyleReady: true,
                    firstCascadeOrderPreserved: true,
                    profileResponseCountAfterOpen: 1,
                    savedNameProjected: true,
                    savedBioProjected: true,
                    savedAvatarProjected: true,
                    savedIdentityProjected: true,
                    avatarResourceCoverage: true,
                    secretInitiallyHidden: true,
                    secretRevealWorked: true,
                    initialFocusCorrect: true,
                    focusTrapStartReady: true,
                    focusTrapWorked: true,
                    escapeClosed: true,
                    escapeFocusReturned: true,
                    backdropClosed: true,
                    backdropFocusReturned: true,
                    reopenSameInnerNode: true,
                    reopenLinkCount: 1,
                    reopenInnerDomCount: 2,
                    diagnosticsAttemptCount: 1,
                    diagnosticsDomCreatedCount: 1,
                    diagnosticsReadyCount: 1,
                    diagnosticsFailureCount: 0,
                    diagnosticsListenerBindingCount: 45,
                    failureVisible: true,
                    failureFocused: true,
                    failureRetryGuidance: true,
                    failureInnerDomCount: 0,
                    failureLinkCount: 0,
                    failureRequestCount: 2,
                    failureRequestFailureCount: 1,
                    failureResponseCount: 1,
                    failureConsoleErrorCount: 1,
                    failureConsoleWarningCount: 1,
                    failureRetryReady: true,
                    failureRetryLinkCount: 1,
                    failureRetryInnerDomCount: 2,
                    failureRetryAttemptCount: 2,
                    failureRetryFailureCount: 1,
                    failureRetryCount: 1,
                    clsDelta: 0
                  }
                : rulesHelpFeature
                  ? {
                    backend: 'pixi',
                    uiInitialized: true,
                    rulesHelpStylesheetLinkCountBeforeOpen: 0,
                    rulesHelpStylesheetSlotCount: 3,
                    rulesHelpInnerDomCountBeforeOpen: 0,
                    rulesHelpImageElementCountBeforeOpen: 0,
                    rulesHelpResourceCountBeforeOpen: 0,
                    rulesHelpResponseCountBeforeOpen: 0,
                    rulesHelpOpenIconReady: true,
                    firstOpenLatencyMs: 30,
                    firstStyleReadyLatencyMs: 12,
                    firstLinkCount: 3,
                    firstInnerDomCount: 3,
                    firstPanelVisible: true,
                    firstFullStyleReady: true,
                    firstCascadeOrderPreserved: true,
                    rulesHelpResponseCountAfterOpen: 3,
                    firstCardCount: 95,
                    firstGuideComplete: true,
                    firstProtectionComplete: true,
                    initialOpenControlFocused: true,
                    searchNoMatchWorked: true,
                    searchStatusUpdated: true,
                    searchClearWorked: true,
                    tagFilterWorked: true,
                    effectsTabWorked: true,
                    guideNextWorked: true,
                    protectionNextWorked: true,
                    countersTabWorked: true,
                    focusWithinPanel: true,
                    escapeClosed: true,
                    escapeFocusReturned: true,
                    backdropClosed: true,
                    backdropFocusReturned: true,
                    reopenSameInnerNode: true,
                    reopenLinkCount: 3,
                    reopenInnerDomCount: 3,
                    diagnosticsAttemptCount: 1,
                    diagnosticsDomCreatedCount: 1,
                    diagnosticsReadyCount: 1,
                    diagnosticsFailureCount: 0,
                    diagnosticsListenerBindingCount: 120,
                    failureVisible: true,
                    failureFocused: true,
                    failureDialogStable: true,
                    failureRetryGuidance: true,
                    failureNormalInnerDomCount: 0,
                    failureLinkCount: 0,
                    failureRequestCount: 2,
                    failureRequestFailureCount: 1,
                    failureResponseCount: 1,
                    failureConsoleErrorCount: 1,
                    failureConsoleWarningCount: 1,
                    failureRetryReady: true,
                    failureRetryLinkCount: 3,
                    failureRetryInnerDomCount: 3,
                    failureRetryAttemptCount: 2,
                    failureRetryFailureCount: 1,
                    failureRetryCount: 1,
                    firstOpenLongTaskSupported: true,
                    firstOpenLongTaskCount: 0,
                    clsDelta: 0
                  }
                : deckBuilderFeature
                  ? {
                    backend: 'pixi',
                    uiInitialized: true,
                    deckBuilderStylesheetLinkCountBeforeOpen: 0,
                    deckBuilderStylesheetSlotCount: 2,
                    deckBuilderInnerDomCountBeforeOpen: 0,
                    deckBuilderCardCountBeforeOpen: 0,
                    deckBuilderResourceCountBeforeOpen: 0,
                    deckBuilderResponseCountBeforeOpen: 0,
                    deckBuilderOpenIconReady: true,
                    deckModelAvailableBeforeOpen: true,
                    firstOpenLatencyMs: 40,
                    firstStyleReadyLatencyMs: 15,
                    firstLinkCount: 2,
                    firstInnerDomCount: 2,
                    firstPresetCardCount: 11,
                    firstPanelVisible: true,
                    firstFullStyleReady: true,
                    firstCascadeOrderPreserved: true,
                    firstComputedStylePreserved: true,
                    deckBuilderResponseCountAfterOpen: 2,
                    initialOpenControlFocused: true,
                    presetViewWorked: true,
                    editorViewWorked: true,
                    scrollPreserved: true,
                    randomDeckWorked: true,
                    detailWorked: true,
                    saveWorked: true,
                    networkDeckUpdateWorked: true,
                    escapeClosed: true,
                    escapeFocusReturned: true,
                    backdropClosed: true,
                    backdropFocusReturned: true,
                    reopenSameInnerNode: true,
                    reopenLinkCount: 2,
                    reopenInnerDomCount: 2,
                    diagnosticsAttemptCount: 1,
                    diagnosticsDomCreatedCount: 2,
                    diagnosticsReadyCount: 1,
                    diagnosticsFailureCount: 0,
                    diagnosticsListenerBindingCount: 8,
                    failureVisible: true,
                    failureFocused: true,
                    failureDialogStable: true,
                    failureRetryGuidance: true,
                    failureNormalInnerDomCount: 0,
                    failureLinkCount: 0,
                    failureRequestCount: 2,
                    failureRequestFailureCount: 1,
                    failureResponseCount: 1,
                    failureConsoleErrorCount: 1,
                    failureConsoleWarningCount: 1,
                    failureRetryReady: true,
                    failureRetryLinkCount: 2,
                    failureRetryInnerDomCount: 2,
                    failureRetryAttemptCount: 2,
                    failureRetryFailureCount: 1,
                    failureRetryCount: 1,
                    firstOpenLongTaskSupported: true,
                    firstOpenLongTaskCount: 0,
                    clsDelta: 0
                  }
                : webpAsset
                  ? {
                    admission: {
                      manifestSha256: '8'.repeat(64),
                      schemaVersion: 1,
                      codec: 'webp-lossless',
                      minimumSavingsRatio: 0.1,
                      admittedMappingOutput: DEFAULT_FRAME_WEBP_PATH,
                      sourceBytes: 1_126_115,
                      outputBytes: 553_268,
                      savingsRatio: 0.508,
                      visiblePixelsEqual: true,
                      width: 1254,
                      height: 1254,
                      sourceSha256: '6'.repeat(64),
                      outputSha256: '7'.repeat(64),
                      actualSourceSha256: '6'.repeat(64),
                      actualOutputSha256: '7'.repeat(64),
                      admissionStatus: 'admitted',
                      hardwareDecode: {
                        sampleCountPerFormat: 12,
                        order: 'alternating',
                        pngMedianMs: 12,
                        webpMedianMs: 10.75,
                        allowedDeltaMs: 2,
                        verdict: 'admitted'
                      }
                    },
                    normal: validFrameVariant('blob:admitted-frame', {
                      webpRequests: 1,
                      pngRequests: 0,
                      webpResponses: 1,
                      pngResponses: 0,
                      failedWebpRequests: 0
                    }),
                    forcedPng: validFrameVariant(DEFAULT_FRAME_PNG_PATH, {
                      webpRequests: 0,
                      pngRequests: 1,
                      webpResponses: 0,
                      pngResponses: 1,
                      failedWebpRequests: 0
                    }),
                    forcedWebpFailure: validFrameVariant(DEFAULT_FRAME_PNG_PATH, {
                      webpRequests: 1,
                      pngRequests: 1,
                      webpResponses: 0,
                      pngResponses: 1,
                      failedWebpRequests: 1,
                      browserErrors: 1
                    })
                  }
                : boot
                  ? {
                    imageConstructorAssignments: [],
                    logicalImageSrcMutations: [],
                    initialHelpImageSrcCount: 0,
                    initialHelpImageElementCount: 0,
                    domCompatStylesheetLinkCount: 0,
                    domCompatStylesheetSlotCount: 1,
                    resultStylesheetLinkCount: 0,
                    resultStylesheetSlotCount: 1,
                    profileStylesheetLinkCount: 0,
                    profileStylesheetSlotCount: 1,
                    rulesHelpStylesheetLinkCount: 0,
                    rulesHelpStylesheetSlotCount: 3,
                    deckBuilderStylesheetLinkCount: 0,
                    deckBuilderStylesheetSlotCount: 2,
                    featureInnerDomCounts: {
                      result: 0,
                      profile: 0,
                      rulesHelp: 0,
                      deckBuilder: 0
                    }
                  }
                  : help
                    ? {
                      backend: 'pixi',
                      uiInitialized: true,
                      initialInnerDomCount: 0,
                      initialImageElementCount: 0,
                      initialStylesheetLinkCount: 0,
                      stylesheetSlotCount: 3,
                      initialSrcCount: 0,
                      dimensionsReserved: true,
                      panelOpen: true,
                      guideComplete: true,
                      protectionComplete: true,
                      guideFrameVisible: true,
                      protectionFrameVisible: true,
                      guideDimensions: { width: 1920, height: 1080 },
                      protectionDimensions: { width: 1600, height: 1080 },
                      focusWithinPanel: true,
                      helpRequestsBeforeFirstFrame: 0,
                      helpResourcePathCount: 2,
                      helpEncodedBodyBytes: 325_100,
                      clsDelta: 0,
                      firstOpenLatencyMs: 20,
                      helpResponsePathsAfterOpen: ['guide.png', 'protection.png'],
                      helpResourceEntriesBeforeOpen: definition.id === 'help.after-idle' ? 2 : 0,
                      helpResponsePathsBeforeOpen: definition.id === 'help.after-idle'
                        ? ['guide.png', 'protection.png']
                        : [],
                      pendingIdleCallbackCount: definition.id === 'help.before-idle' ? 1 : 0,
                      boardIdleAtMs: 10,
                      idlePrefetchAtMs: 11,
                      earliestHelpResourceStartMs: 12,
                      additionalHelpTransferSizeAfterOpen: 0
                    }
                    : {}
      };
    })
  };
}

describe('UX optimization monitor validator', () => {
  test('accepts a complete raw report and ignores a forged top-level verdict', () => {
    const report = validReport();
    report.verdict = 'fail';
    const result = validateUxOptimizationReport(report);
    expect(result.overallVerdict).toBe('pass');
    expect(result.checks.every((check) => check.verdict === 'pass')).toBe(true);
  });

  test('fails missing, duplicate and unknown scenarios', () => {
    const report = validReport();
    report.scenarios = [
      ...report.scenarios.slice(1),
      report.scenarios[1],
      { ...report.scenarios[1], id: 'unknown.scenario' }
    ];
    const result = validateUxOptimizationReport(report);
    const check = result.checks.find((entry) => entry.id === 'report.scenario-set');
    expect(check?.verdict).toBe('fail');
    expect(check?.reasons.join(' ')).toContain(
      'missing scenario capture: boot.pixi.cold:vite:pixi'
    );
    expect(check?.reasons.join(' ')).toContain(
      'duplicate scenario capture: boot.pixi.warm:vite:pixi'
    );
    expect(check?.reasons.join(' ')).toContain(
      'unknown scenario capture: unknown.scenario:vite:pixi'
    );
  });

  test('recursively rejects forbidden gameplay and authority keys', () => {
    const report = validReport();
    report.scenarios[0].metrics = {
      safe: true,
      nested: [{ seatToken: 'secret' }, { gameState: {} }]
    };
    expect(findForbiddenReportPaths(report)).toEqual([
      'scenarios[0].metrics.nested[0].seatToken',
      'scenarios[0].metrics.nested[1].gameState'
    ]);
    expect(validateUxOptimizationReport(report).overallVerdict).toBe('fail');
  });

  test('fails invalid identity, phases, paths and unexpected browser errors', () => {
    const report = validReport();
    report.identity.scenarioDigest = '0'.repeat(64);
    report.scenarios[0].phases[1].atMs = -1;
    report.scenarios[0].resources = [{ path: '/api/match/list' }];
    report.scenarios[0].errors = [{ kind: 'resource', path: 'styles-missing.css' }];
    const result = validateUxOptimizationReport(report);
    expect(result.overallVerdict).toBe('fail');
    expect(result.checks.find((entry) => entry.id === 'report.identity')?.verdict).toBe('fail');
    expect(
      result.checks.find((entry) => entry.id === 'scenario.boot.pixi.cold:vite:pixi')?.verdict
    ).toBe('fail');
  });

  test('allows one fixture-bound injected fault and nothing else', () => {
    const report = validReport();
    report.scenarios[0].expectedFault = {
      kind: 'resource',
      path: 'styles-layout-result.css'
    };
    report.scenarios[0].errors = [{
      kind: 'resource',
      path: 'styles-layout-result.css'
    }];
    expect(validateUxOptimizationReport(report).overallVerdict).toBe('pass');
    report.scenarios[0].errors.push({
      kind: 'console',
      path: 'unrelated'
    });
    expect(validateUxOptimizationReport(report).overallVerdict).toBe('fail');
  });

  test('allows the exact declared count for a multi-request injected fault', () => {
    const report = validReport();
    report.scenarios[0].expectedFault = {
      kind: 'console',
      path: 'document',
      count: 2
    };
    report.scenarios[0].errors = [
      { kind: 'console', path: 'document' },
      { kind: 'console', path: 'document' }
    ];
    expect(validateUxOptimizationReport(report).overallVerdict).toBe('pass');
    report.scenarios[0].errors.pop();
    expect(validateUxOptimizationReport(report).overallVerdict).toBe('fail');
  });

  test('pending optimizations remain failed but can form a valid explicit baseline', () => {
    const report = validReport();
    report.profile = 'baseline';
    report.pendingOptimizationIds = UX_OPTIMIZATION_IDS.slice();
    report.scenarios.forEach((scenario: Record<string, any>) => {
      scenario.captureStatus = 'pending-optimization';
    });
    const validation = validateUxOptimizationReport(report);
    expect(validation.overallVerdict).toBe('fail');
    expect(validation.baselineValid).toBe(true);
    expect(validation.candidateEligible).toBe(false);
  });

  test('passes a completed focused target while unrelated work remains pending', () => {
    const report = validReport();
    report.pendingOptimizationIds = UX_OPTIMIZATION_IDS.filter(
      (id) => id !== 'lock-only-hint-paint'
    );
    const relevantScenarioIds = new Set(
      UX_OPTIMIZATION_SCENARIOS
        .filter((scenario) => scenario.optimizationIds.includes('lock-only-hint-paint'))
        .map((scenario) => scenario.id)
    );
    report.scenarios.forEach((scenario: Record<string, any>) => {
      if (!relevantScenarioIds.has(scenario.id)) {
        scenario.captureStatus = 'pending-optimization';
      }
    });
    const validation = validateUxOptimizationReport(report, {
      targetOptimizationIds: ['lock-only-hint-paint']
    });
    expect(validation.overallVerdict).toBe('fail');
    expect(validation.focusedVerdict).toBe('pass');
    expect(validation.developmentValid).toBe(true);
  });

  test('fails lock paint, input leakage, stale input, and opponent-turn stalls', () => {
    const report = validReport();
    const lock = report.scenarios.find((scenario: any) => scenario.id === 'board.lock-toggle');
    const opponent = report.scenarios.find(
      (scenario: any) => scenario.id === 'playback.opponent-actions'
    );
    lock.metrics.lockDelta.hintPaintCount = 64;
    lock.metrics.lockedCommandCount = 1;
    lock.metrics.staleInputStateCount = 1;
    opponent.metrics.longTaskCount = 1;
    opponent.metrics.rafStall50msCount = 1;
    opponent.metrics.tickerIdle = false;

    const validation = validateUxOptimizationReport(report, {
      targetOptimizationIds: ['lock-only-hint-paint']
    });
    expect(validation.focusedVerdict).toBe('fail');
    expect(validation.checks.find(
      (check) => check.id === 'scenario.board.lock-toggle:vite:pixi'
    )?.reasons).toEqual(expect.arrayContaining([
      'lockDelta painted hint Graphics: 64',
      'locked command count was 1',
      'stale input state count was 1'
    ]));
    expect(validation.checks.find(
      (check) => check.id === 'scenario.playback.opponent-actions:vite:pixi'
    )?.verdict).toBe('fail');
  });

  test('fails duplicate default-frame bodies and a missing PNG fallback', () => {
    const report = validReport();
    const asset = report.scenarios.find(
      (scenario: any) => scenario.id === 'asset.webp-fallback'
    );
    asset.metrics.normal.framePngRequestCount = 1;
    asset.metrics.normal.framePngResponseCount = 1;
    asset.metrics.forcedWebpFailure.framePngRequestCount = 0;
    asset.metrics.forcedWebpFailure.framePngResponseCount = 0;

    const validation = validateUxOptimizationReport(report, {
      targetOptimizationIds: ['lossless-webp-admission']
    });
    const check = validation.checks.find(
      (entry) => entry.id === `scenario.asset.webp-fallback:${asset.lane}:pixi`
    );
    expect(validation.focusedVerdict).toBe('fail');
    expect(check?.reasons).toEqual(expect.arrayContaining([
      'normal logical frame request/fallback counts are invalid',
      'forcedWebpFailure logical frame request/fallback counts are invalid'
    ]));
  });

  test('does not classify a CSS-owned profile avatar as a Pixi board preload', () => {
    const report = validReport();
    const boot = report.scenarios.find((entry: any) => (
      entry.id === 'boot.pixi.cold' && entry.lane === 'vite'
    ));
    boot.resources = [{
      path: 'assets/images/special-stones/GHOST_WILL-black.png',
      initiatorType: 'css'
    }];
    boot.metrics.neededSpecialAssetIds = [];

    const result = validateUxOptimizationReport(report);
    const check = result.checks.find(
      (entry) => entry.id === 'scenario.boot.pixi.cold:vite:pixi'
    );
    expect(check?.verdict).toBe('pass');
  });

  test('fails duplicate logical boot images, detached preloads, and src mutations', () => {
    const report = validReport();
    const boot = report.scenarios.find((entry: any) => entry.id === 'boot.pixi.cold');
    boot.resources = [
      { path: 'vite-dist/assets/hero-HASHED.png' },
      { path: 'assets/images/hero/hero.png' },
      { path: 'vite-dist/assets/勇者の手-HASHED.png' },
      { path: 'assets/images/hand-skin/勇者の手.png' }
    ];
    boot.metrics.imageConstructorAssignments = ['assets/images/hero/hero.png'];
    boot.metrics.logicalImageSrcMutations = [{
      logicalPath: 'assets/images/hand-skin/勇者の手.png',
      sourcePath: 'assets/images/hand-skin/勇者の手.png'
    }];

    const result = validateUxOptimizationReport(report);
    const check = result.checks.find(
      (entry) => entry.id === 'scenario.boot.pixi.cold:vite:pixi'
    );
    expect(check?.verdict).toBe('fail');
    expect(check?.reasons).toEqual(expect.arrayContaining([
      'hero logical image requested 2 response bodies',
      'default-hand logical image requested 2 response bodies',
      'logical boot images used 1 detached Image preload(s)',
      'logical boot images mutated src 1 time(s)'
    ]));
  });

  test('fails help requests before first frame, layout shift, and idle-after body transfer', () => {
    const report = validReport();
    const afterIdle = report.scenarios.find((entry: any) => (
      entry.id === 'help.after-idle' && entry.lane === 'vite'
    ));
    afterIdle.metrics.helpRequestsBeforeFirstFrame = 1;
    afterIdle.metrics.clsDelta = 0.02;
    afterIdle.metrics.additionalHelpTransferSizeAfterOpen = 325_700;

    const result = validateUxOptimizationReport(report, {
      targetOptimizationIds: ['help-image-lazy-loading']
    });
    const check = result.checks.find(
      (entry) => entry.id === 'scenario.help.after-idle:vite:pixi'
    );
    expect(result.focusedVerdict).toBe('fail');
    expect(check?.reasons).toEqual(expect.arrayContaining([
      'help requests before first frame: 1',
      'help first-open CLS was 0.02',
      'idle-after open transferred 325700 extra bytes'
    ]));
  });

  test('fails eager rules help work, interaction regressions, and failed retry cleanup', () => {
    const report = validReport();
    const boot = report.scenarios.find((entry: any) => (
      entry.id === 'boot.pixi.cold' && entry.lane === 'vite'
    ));
    boot.resources.push({ path: 'styles-feature-rules-help-layout-info.css' });
    boot.metrics.rulesHelpStylesheetLinkCount = 1;
    boot.metrics.featureInnerDomCounts.rulesHelp = 3;
    const feature = report.scenarios.find((entry: any) => (
      entry.id === 'feature.rules-help' && entry.lane === 'vite'
    ));
    feature.metrics.searchNoMatchWorked = false;
    feature.metrics.guideNextWorked = false;
    feature.metrics.failureLinkCount = 2;
    feature.metrics.failureRetryAttemptCount = 1;

    const result = validateUxOptimizationReport(report, {
      targetOptimizationIds: ['feature-rules-help']
    });
    const bootCheck = result.checks.find(
      (entry) => entry.id === 'scenario.boot.pixi.cold:vite:pixi'
    );
    const featureCheck = result.checks.find(
      (entry) => entry.id === 'scenario.feature.rules-help:vite:pixi'
    );
    expect(result.focusedVerdict).toBe('fail');
    expect(bootCheck?.reasons).toEqual(expect.arrayContaining([
      'boot requested rules help CSS 1 time(s)',
      'boot mounted 1 rules help stylesheet link(s)',
      'boot rules help inner DOM count was 3'
    ]));
    expect(featureCheck?.reasons).toEqual(expect.arrayContaining([
      'rules help search, filter, tab, or slide interaction changed',
      'rules help stylesheet failure was not closable or did not clean partial DOM/style',
      'rules help stylesheet retry did not recover with one retained surface'
    ]));
  });

  test('fails eager deck builder work, interaction regressions, and failed retry cleanup', () => {
    const report = validReport();
    const boot = report.scenarios.find((entry: any) => (
      entry.id === 'boot.pixi.cold' && entry.lane === 'vite'
    ));
    boot.resources.push({ path: 'styles-feature-deck-builder.css' });
    boot.metrics.deckBuilderStylesheetLinkCount = 1;
    boot.metrics.featureInnerDomCounts.deckBuilder = 2;
    const feature = report.scenarios.find((entry: any) => (
      entry.id === 'feature.deck-builder' && entry.lane === 'vite'
    ));
    feature.metrics.randomDeckWorked = false;
    feature.metrics.networkDeckUpdateWorked = false;
    feature.metrics.failureLinkCount = 1;
    feature.metrics.failureRetryAttemptCount = 1;

    const result = validateUxOptimizationReport(report, {
      targetOptimizationIds: ['feature-deck-builder']
    });
    const bootCheck = result.checks.find(
      (entry) => entry.id === 'scenario.boot.pixi.cold:vite:pixi'
    );
    const featureCheck = result.checks.find(
      (entry) => entry.id === 'scenario.feature.deck-builder:vite:pixi'
    );
    expect(result.focusedVerdict).toBe('fail');
    expect(bootCheck?.reasons).toEqual(expect.arrayContaining([
      'boot requested deck builder CSS 1 time(s)',
      'boot mounted 1 deck builder stylesheet link(s)',
      'boot deck builder inner DOM count was 2'
    ]));
    expect(featureCheck?.reasons).toEqual(expect.arrayContaining([
      'deck builder preset, editor, scroll, card, save, or network behavior changed',
      'deck builder stylesheet failure was not closable or did not clean partial DOM/style',
      'deck builder stylesheet retry did not recover with one retained surface'
    ]));
  });

  test('fails eager DOM compatibility CSS and fallback mount-before-style regressions', () => {
    const report = validReport();
    const boot = report.scenarios.find((entry: any) => (
      entry.id === 'boot.pixi.cold' && entry.lane === 'vite'
    ));
    boot.resources.push({ path: 'styles-board-dom-compat.css' });
    boot.metrics.domCompatStylesheetLinkCount = 1;
    const fallback = report.scenarios.find((entry: any) => (
      entry.id === 'fallback.context-loss' && entry.lane === 'classic'
    ));
    fallback.metrics.domCompatStylesheetResponseCount = 2;
    fallback.metrics.domCompatStylesheetReadyAt = 8;
    fallback.metrics.domBackendMountedAt = 7;
    fallback.metrics.domCompatStylesheetAtSlot = false;
    const explicitDom = report.scenarios.find((entry: any) => (
      entry.id === 'fallback.explicit-dom' && entry.lane === 'vite'
    ));
    explicitDom.metrics.stylesheetFailurePreventedMount = false;
    explicitDom.metrics.stylesheetFailureSurfaced = false;
    explicitDom.metrics.stylesheetFailureUiInitialized = true;

    const result = validateUxOptimizationReport(report, {
      targetOptimizationIds: ['dom-compat-stylesheet-lazy-loading']
    });
    const bootCheck = result.checks.find(
      (entry) => entry.id === 'scenario.boot.pixi.cold:vite:pixi'
    );
    const fallbackCheck = result.checks.find(
      (entry) => entry.id === 'scenario.fallback.context-loss:classic:dom'
    );
    expect(result.focusedVerdict).toBe('fail');
    expect(bootCheck?.reasons).toEqual(expect.arrayContaining([
      'normal Pixi requested DOM compatibility CSS 1 time(s)',
      'normal Pixi mounted 1 DOM compatibility stylesheet link(s)'
    ]));
    expect(fallbackCheck?.reasons).toEqual(expect.arrayContaining([
      'DOM compatibility CSS response count was 2',
      'DOM compatibility stylesheet was not inserted at its fixed cascade slot',
      'DOM compatibility stylesheet/backend order was 8 > 7'
    ]));
    const explicitDomCheck = result.checks.find(
      (entry) => entry.id === 'scenario.fallback.explicit-dom:vite:dom'
    );
    expect(explicitDomCheck?.reasons).toEqual(expect.arrayContaining([
      'failed DOM compatibility CSS still allowed backend mount',
      'DOM compatibility CSS failure was not surfaced',
      'DOM compatibility CSS failure produced a success-shaped UI initialization'
    ]));
  });
});
