// Jest's CommonJS runtime cannot parse pixelmatch 7's ESM entry. Production
// browser checks load the real package; this deterministic mechanical mock
// keeps evaluator units focused on threshold wiring and failure propagation.
jest.mock('pixelmatch', () => ({
  default: (left: Uint8Array, right: Uint8Array, output: Uint8Array | null) => {
    let different = 0;
    for (let offset = 0; offset < Math.min(left.length, right.length); offset += 4) {
      const mismatch = left[offset] !== right[offset]
        || left[offset + 1] !== right[offset + 1]
        || left[offset + 2] !== right[offset + 2]
        || left[offset + 3] !== right[offset + 3];
      if (mismatch) different += 1;
      if (output) {
        output[offset] = mismatch ? 255 : 0;
        output[offset + 1] = 0;
        output[offset + 2] = 0;
        output[offset + 3] = 255;
      }
    }
    return different;
  }
}));

const Check = require('../scripts/pixijs-board-playback-browser-check');
const crypto = require('crypto');
const { PNG } = require('pngjs');

function rgbaPng(red: number, green: number, blue: number): string {
  const png = new PNG({ width: 2, height: 2 });
  for (let offset = 0; offset < png.data.length; offset += 4) {
    png.data[offset] = red;
    png.data[offset + 1] = green;
    png.data[offset + 2] = blue;
    png.data[offset + 3] = 255;
  }
  return PNG.sync.write(png).toString('base64');
}

function pointDeltaPng(width: number, height: number, x: number, y: number): string {
  const png = new PNG({ width, height });
  for (let offset = 3; offset < png.data.length; offset += 4) png.data[offset] = 255;
  const offset = (y * width + x) * 4;
  png.data[offset] = 120;
  png.data[offset + 1] = 48;
  png.data[offset + 2] = 12;
  return PNG.sync.write(png).toString('base64');
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function goodBackendDiagnostics(): any {
  return {
    tickerRunning: false,
    canvasCount: 1,
    contextCount: 1,
    domCellCount: 0,
    application: { tickerListenerCount: 0 },
    timeline: {
      tickerRunning: false,
      tickerSubscribed: false,
      activeRunCount: 0,
      startedRunCount: 3
    },
    playback: {
      activeScopeKey: null,
      projectedStoneCount: 0,
      retainedFinalGhostCount: 0,
      inFlightEffectCount: 0,
      inFlightTopologyRevealCount: 0,
      sourceTrajectory: {
        activeRunCount: 0,
        activeTextureLeaseCount: 0,
        startedRunCount: 1,
        completedRunCount: 1,
        failedRunCount: 0
      }
    },
    pool: {
      activePlaybackGhostCount: 0,
      pooledPlaybackGhostCount: 2,
      activePlaybackHighlightLeaseCount: 0,
      renderedPlaybackHighlightCount: 0,
      pooledPlaybackHighlightCount: 1
    },
    scene: {
      activePlaybackEffectCount: 0,
      activeTopologyRevealCount: 0,
      activeSourceTrajectoryCount: 0,
      activeSourceTrajectoryTextureLeaseCount: 0,
      pooledPlaybackEffectCount: 4
    }
  };
}

function trajectoryRuntimeEvidence(definition: any, renderer: 'dom' | 'pixi', mode: string): any {
  const trajectory = definition.sourceTrajectory;
  if (!trajectory) return {
    actualTrajectoryRequests: [],
    semanticTrajectoryObservations: [],
    trajectoryDiagnosticEntries: [],
    trajectoryRoi: null
  };
  const [sourceRow, sourceCol] = trajectory.sourceId.split(',').map(Number);
  const [targetRow, targetCol] = trajectory.targetId.split(',').map(Number);
  const direction = trajectory.profileKey === 'robotVacuumSuck' ? 'target-to-source' : 'source-to-target';
  const sourceCenter = { x: 20, y: 20 };
  const targetCenter = { x: 80, y: 20 };
  const geometry = mode === 'normal' ? {
    sourceCenter,
    targetCenter,
    movementStart: direction === 'target-to-source' ? targetCenter : sourceCenter,
    movementEnd: direction === 'target-to-source' ? sourceCenter : targetCenter,
    distancePx: 60,
    visibleClip: { left: 0, top: 0, right: 100, bottom: 100 }
  } : null;
  const sourceEvent = `${renderer}-source-trajectory:start`;
  const settleEvent = `${renderer}-source-trajectory:settle`;
  const impactEvent = `${renderer}-playback:target-impact-start`;
  const commitEvent = `${renderer}-playback:target-commit`;
  const startDetail = {
    trajectoryId: trajectory.trajectoryId,
    profileKey: trajectory.profileKey,
    source: { row: sourceRow, col: sourceCol },
    target: { row: targetRow, col: targetCol },
    direction,
    geometry
  };
  const targetDetail = {
    eventType: definition.eventType,
    row: targetRow,
    col: targetCol,
    profileKey: trajectory.profileKey
  };
  const trajectoryDiagnosticEntries = [
    { index: 10, event: sourceEvent, detail: startDetail },
    { index: 11, event: impactEvent, detail: targetDetail },
    { index: 12, event: settleEvent, detail: { trajectoryId: trajectory.trajectoryId, profileKey: trajectory.profileKey } },
    { index: 13, event: commitEvent, detail: targetDetail }
  ];
  const semanticTrajectoryObservations = [
    { sequence: 10, kind: 'trajectory-start', profileKey: trajectory.profileKey, trajectoryId: trajectory.trajectoryId, targetId: trajectory.targetId, diagnosticEvent: sourceEvent },
    { sequence: 11, kind: 'target-impact-start', profileKey: trajectory.profileKey, trajectoryId: trajectory.trajectoryId, targetId: trajectory.targetId, diagnosticEvent: impactEvent },
    { sequence: 12, kind: 'trajectory-settle', profileKey: trajectory.profileKey, trajectoryId: trajectory.trajectoryId, targetId: trajectory.targetId, diagnosticEvent: settleEvent },
    { sequence: 13, kind: 'target-commit', profileKey: trajectory.profileKey, trajectoryId: trajectory.trajectoryId, targetId: trajectory.targetId, diagnosticEvent: commitEvent }
  ];
  let trajectoryRoi = null;
  if (mode === 'normal') {
    const baselineColor = renderer === 'dom' ? 10 : 30;
    const baselinePngBase64 = rgbaPng(baselineColor, baselineColor, baselineColor);
    const activePngBase64 = rgbaPng(baselineColor + 100, baselineColor + 20, baselineColor + 5);
    const delta = Check.buildTrajectoryDeltaPng(baselinePngBase64, activePngBase64);
    const clip = { x: 100, y: 120, width: 2, height: 2 };
    const baselineMetadata = {
      sourceId: trajectory.sourceId,
      targetId: trajectory.targetId,
      clip,
      endpointPolicy: 'logical-source-target-with-pixel-clipping'
    };
    const activeMetadata = {
      ...baselineMetadata,
      profileKey: trajectory.profileKey,
      trajectoryId: trajectory.trajectoryId,
      direction,
      captureDelayMs: trajectory.captureDelayMs,
      captureElapsedMs: trajectory.captureDelayMs + 5,
      sourceStartedAtMs: 100,
      readyAtMs: 100 + trajectory.captureDelayMs + 5
    };
    trajectoryRoi = {
      metadata: activeMetadata,
      error: null,
      baseline: { metadata: baselineMetadata, pngBase64: baselinePngBase64, width: 2, height: 2 },
      active: {
        metadata: activeMetadata,
        pngBase64: activePngBase64,
        width: 2,
        height: 2,
        screenshotElapsedMs: trajectory.captureDelayMs + 12
      },
      delta
    };
  }
  return {
    actualTrajectoryRequests: [{
      trajectoryId: trajectory.trajectoryId,
      profileKey: trajectory.profileKey,
      eventType: definition.eventType,
      direction,
      source: { row: sourceRow, col: sourceCol },
      target: { row: targetRow, col: targetCol },
      sourceId: trajectory.sourceId,
      targetId: trajectory.targetId
    }],
    semanticTrajectoryObservations,
    trajectoryDiagnosticEntries,
    trajectoryRoi
  };
}

function scenarioReport(definition: any, renderer: 'dom' | 'pixi', mode: string): any {
  const finalModelDigest = Check.canonicalFinalModelDigest(definition);
  const finalRenderedCells = JSON.parse(JSON.stringify(Check.expectedFinalRenderedCells(definition)));
  const immediateEvidence = definition.pixiEvidence === 'immediate';
  const topologyEvidence = definition.pixiEvidence === 'topology-reveal';
  const settledKeyFrame = mode === 'noanim' || immediateEvidence;
  const expectedSemanticTrajectoryTrace = Check.expectedSemanticTrajectoryTrace(definition);
  const trajectoryRuntime = trajectoryRuntimeEvidence(definition, renderer, mode);
  const inputDigest = `input:${definition.name}`;
  const renderedCells = Object.fromEntries(Object.entries(finalRenderedCells).map(([key, value]: [string, any]) => [
    key,
    { rendered: true, ...value, playbackHidden: false }
  ]));
  const report = {
    scenario: definition.name,
    started: renderer === 'pixi' ? {
      initialBackendDiagnostics: { timeline: { startedRunCount: 2 } }
    } : {},
    expectedEventType: definition.eventType,
    expectedEventTypes: Check.expectedBoardEventTypes(definition),
    expectedSoundKey: definition.soundKey,
    expectedPhaseEventTypes: Check.expectedPhaseEventTypes(definition),
    expectedGlobalEventTypes: definition.expectedGlobalEventTypes || [],
    expectedDispatchLaunchOrder: Check.expectedDispatchLaunchOrder(definition),
    expectedSemanticTrajectoryTrace,
    pixiEvidence: definition.pixiEvidence || 'timeline',
    execution: definition.execution || 'playback',
    expectedFinalModelDigest: finalModelDigest,
    expectedFinalRenderedCells: Check.expectedFinalRenderedCells(definition),
    expectedInputDigest: inputDigest,
    inputDigest,
    settledInputDigest: inputDigest,
    eventTypes: Check.expectedBoardEventTypes(definition),
    completedEventTypes: Check.expectedBoardEventTypes(definition),
    phaseEventTypes: Check.expectedPhaseEventTypes(definition),
    completedPhaseEventTypes: Check.expectedPhaseEventTypes(definition),
    globalEventTypes: definition.expectedGlobalEventTypes || [],
    completedGlobalEventTypes: definition.expectedGlobalEventTypes || [],
    dispatchLaunchOrder: Check.expectedDispatchLaunchOrder(definition),
    semanticTrajectoryObservations: trajectoryRuntime.semanticTrajectoryObservations,
    semanticTrajectoryTrace: Check.normalizeSemanticTrajectoryTrace(
      trajectoryRuntime.semanticTrajectoryObservations
    ),
    trajectoryDiagnosticEntries: trajectoryRuntime.trajectoryDiagnosticEntries,
    actualTrajectoryRequests: trajectoryRuntime.actualTrajectoryRequests,
    semanticTrajectoryEvidence: definition.sourceTrajectory ? [{
      backendKind: renderer,
      trajectoryId: definition.sourceTrajectory.trajectoryId,
      profileKey: definition.sourceTrajectory.profileKey,
      startedRunDelta: renderer === 'pixi' ? 1 : 0,
      profileStartedRunDelta: renderer === 'pixi' ? 1 : 0,
      activeRunCount: renderer === 'pixi' ? 1 : 0,
      inFlightEffectCount: renderer === 'pixi' ? 2 : 0,
      trajectoryDomOverlayCount: renderer === 'pixi' ? 0 : 1,
      completedRunDelta: renderer === 'pixi' ? 1 : 0,
      profileCompletedRunDelta: renderer === 'pixi' ? 1 : 0,
      failedRunDelta: 0,
      targetCommitted: true
    }] : [],
    soundKeys: [definition.soundKey],
    logEntries: [],
    logDigest: sha256('[]'),
    manifestWorldStarts: definition.name === 'manifest-ending-world'
      ? [{ overlayPresent: mode !== 'noanim', noAnimation: mode === 'noanim' }]
      : [],
    manifestWorldCompletions: definition.name === 'manifest-ending-world'
      ? [{ overlayPresent: false, noAnimation: mode === 'noanim' }]
      : [],
    manifestBgmTransitions: definition.name === 'manifest-ending-world'
      ? [
        [null, null, { transitionMs: mode === 'noanim' ? 0 : 2000 }],
        [null, null],
        [null, null]
      ]
      : [],
    error: null,
    finalModelDigest,
    finalVisualDigest: `${renderer}:visual:${definition.name}`,
    finalVisualSemanticDigest: Check.buildFinalVisualSemanticDigest({
      finalModelDigest,
      renderedCells
    }),
    settledFlags: {
      playbackActive: false,
      processing: false,
      cardAnimating: false,
      writerMode: 'idle'
    },
    sourceTrajectory: definition.sourceTrajectory || null,
    trajectoryRoi: trajectoryRuntime.trajectoryRoi,
    keyFrame: renderer === 'pixi' ? {
      capturedInsidePlayback: !topologyEvidence,
      capturedFromCommittedFrame: topologyEvidence,
      captureKind: settledKeyFrame ? 'settled' : 'active',
      captureStage: mode === 'noanim' ? 'microtask' : 'microtask',
      writerMode: settledKeyFrame || topologyEvidence ? 'idle' : 'playback',
      playbackDone: settledKeyFrame,
      screenshotSha256: 'a'.repeat(64),
      screenshotSource: 'pixi-extract',
      trajectoryDomOverlayCount: 0,
      backendDiagnostics: {
        canvasCount: 1,
        contextCount: 1,
        domCellCount: 0,
        timeline: {
          activeRunCount: settledKeyFrame ? 0 : 1
        },
        pool: {
          activePlaybackGhostCount: mode === 'noanim'
            || immediateEvidence
            || topologyEvidence
            || (mode === 'reduced-motion' && definition.name === 'destroy') ? 0 : 1,
          activePlaybackHighlightLeaseCount: 0
        },
        scene: {
          activePlaybackEffectCount: 0,
          activeTopologyRevealCount: topologyEvidence && mode !== 'noanim' ? 1 : 0,
          topologyRevealKeys: topologyEvidence && mode !== 'noanim' ? ['2,-1'] : []
        }
      }
    } : null,
    final: renderer === 'pixi' ? {
      backendDiagnostics: goodBackendDiagnostics(),
      trajectoryDomOverlayCount: 0,
      renderedCells
    } : {
      backendDiagnostics: null,
      trajectoryDomOverlayCount: 0,
      renderedCells
    }
  };
  return {
    ...report,
    parityDigest: Check.buildPlaybackParityDigest(report)
  };
}

function goodReport(): any {
  const reports: any[] = [];
  for (const lane of ['classic', 'vite']) {
    for (const mode of Check.PLAYBACK_MODES) {
      for (const renderer of ['dom', 'pixi'] as const) {
        reports.push({
          lane,
          renderer,
          mode,
          smokeEvaluation: { ok: true, errors: [] },
          scenarios: Check.scenariosForMode(mode).map((definition: any) => (
            scenarioReport(definition, renderer, mode)
          ))
        });
      }
    }
  }
  return { scenarioNames: Check.PLAYBACK_SCENARIOS.map((scenario: any) => scenario.name), reports };
}

describe('Pixi playback browser scenario matrix', () => {
  test('keeps the six Phase 6 groups and adds the Phase 7 normal/NOANIM matrix', () => {
    expect(Check.KEY_FRAME_DELAY_MS).toBeUndefined();
    expect(Check.SOURCE_TRAJECTORY_CAPTURE_TIMEOUT_MS).toBe(8000);
    expect(Check.SOURCE_TRAJECTORY_PIXELMATCH_THRESHOLD).toBe(0.18);
    expect(Check.PLAYBACK_SCENARIOS.slice(0, 6).map((scenario: any) => scenario.eventType)).toEqual([
      'place',
      'spawn',
      'flip',
      'destroy',
      'move',
      'status_applied'
    ]);
    expect(Check.PLAYBACK_SCENARIOS.slice(6).map((scenario: any) => scenario.name)).toEqual([
      'fire-will-scorch',
      'water-will-healing',
      'grass-will-seed',
      'trajectory-sniper-shot',
      'trajectory-robot-vacuum-suck',
      'special-destroy-hybrid',
      'trajectory-meteor-black-beam',
      'trajectory-lightning-destroyed',
      'trajectory-udg-destroyed',
      'zombie-infection-source',
      'theory-incarnation',
      'manifest-ending-world',
      'topology-expansion',
      'topology-shrink',
      'legacy-fade-out',
      'crossfade-stone',
      'protection-expire',
      'legacy-strong-will-apply',
      'legacy-hyperactive-move',
      'legacy-sacrifice-absorb-pulse'
    ]);
    expect(Check.scenariosForMode('reduced-motion')).toHaveLength(6);
    expect(Check.scenariosForMode('normal')).toHaveLength(26);
    expect(Check.scenariosForMode('noanim')).toHaveLength(26);
    const sourceScenarios = Check.PLAYBACK_SCENARIOS.filter((scenario: any) => scenario.sourceTrajectory);
    expect(sourceScenarios.map((scenario: any) => scenario.sourceTrajectory.profileKey)).toEqual([
      'fireWillFlameBeam',
      'waterWillHealingBeam',
      'grassWillSeedBeam',
      'sniperShot',
      'robotVacuumSuck',
      'destroyDragonBreath',
      'meteorGodBlackBeam',
      'lightningDestroyed',
      'udgDestroyed',
      'zombieBite'
    ]);
    expect(sourceScenarios.every((scenario: any) => (
      scenario.events[0].type === scenario.eventType
      && scenario.events[1].type === 'sound_effect'
    ))).toBe(true);
    expect(Check.publicEntryPath('classic', 'pixi', 'normal'))
      .toBe('/index.classic.html?debug=1&boardRenderer=pixi');
    expect(Check.publicEntryPath('vite', 'pixi', 'noanim'))
      .toBe('/?debug=1&boardRenderer=pixi&noanim=1');
    expect(Check.parseCliOptions(['--classic-only', '--mode=reduced-motion'])).toEqual({
      lanes: ['classic'],
      modes: ['reduced-motion'],
      writeArtifacts: true
    });
    expect(Check.parseCliOptions([
      '--classic-only',
      '--mode=normal',
      '--scenario=topology-expansion,theory-incarnation'
    ])).toEqual({
      lanes: ['classic'],
      modes: ['normal'],
      scenarioNames: ['topology-expansion', 'theory-incarnation'],
      writeArtifacts: true
    });
    expect(() => Check.parseCliOptions(['--classic-only', '--vite-only'])).toThrow('mutually exclusive');
    expect(() => Check.parseCliOptions(['--mode=slow'])).toThrow('Unsupported playback mode');
    expect(() => Check.parseCliOptions(['--scenario=missing'])).toThrow('Unsupported playback scenario');

    const payload = Check.createBrowserScenarioPayload(Check.PLAYBACK_SCENARIOS[0]);
    expect(payload).toEqual({
      definition: Check.PLAYBACK_SCENARIOS[0],
      boardSize: { rows: 8, cols: 8 }
    });
    expect(payload.boardSize).toBe(Check.PLAYBACK_BOARD_SIZE);

    const theory = Check.PLAYBACK_SCENARIOS.find((scenario: any) => scenario.name === 'theory-incarnation');
    expect(Check.expectedFinalRenderedCells(theory)['1,4']).toEqual({
      hasStone: true,
      owner: 'black',
      specialType: 'THEORY_INCARNATION'
    });

    const destroySource = Check.PLAYBACK_SCENARIOS.find((scenario: any) => (
      scenario.name === 'special-destroy-hybrid'
    ));
    const zombieSource = Check.PLAYBACK_SCENARIOS.find((scenario: any) => (
      scenario.name === 'zombie-infection-source'
    ));
    const fireSource = Check.PLAYBACK_SCENARIOS.find((scenario: any) => (
      scenario.name === 'fire-will-scorch'
    ));
    const grassSource = Check.PLAYBACK_SCENARIOS.find((scenario: any) => (
      scenario.name === 'grass-will-seed'
    ));
    const waterSource = Check.PLAYBACK_SCENARIOS.find((scenario: any) => (
      scenario.name === 'water-will-healing'
    ));
    expect(destroySource.expectedGlobalEventTypes).toBeUndefined();
    expect(zombieSource.expectedGlobalEventTypes).toBeUndefined();
    expect(Check.expectedDispatchLaunchOrder(destroySource)).toEqual([
      'board:destroy',
      'sound:stone_destroy'
    ]);
    expect(Check.expectedSemanticTrajectoryTrace(destroySource)).toEqual([
      'trajectory:start(destroyDragonBreath,1/0/0/0/destroyDragonBreath)',
      'impact:start(2,5)',
      'trajectory:settle(destroyDragonBreath,1/0/0/0/destroyDragonBreath)',
      'target:commit(2,5)'
    ]);
    expect(Check.expectedSemanticTrajectoryTrace(zombieSource)).toEqual([
      'trajectory:start(zombieBite,1/0/0/0/zombieBite)',
      'impact:start(3,5)',
      'trajectory:settle(zombieBite,1/0/0/0/zombieBite)',
      'target:commit(3,5)'
    ]);
    expect(Check.expectedSemanticTrajectoryTrace(fireSource)).toEqual([
      'trajectory:start(fireWillFlameBeam,1/0/0/0/fireWillFlameBeam)',
      'impact:start(5,5)',
      'trajectory:settle(fireWillFlameBeam,1/0/0/0/fireWillFlameBeam)',
      'target:commit(5,5)'
    ]);
    expect(Check.expectedSemanticTrajectoryTrace(waterSource)).toEqual([
      'trajectory:start(waterWillHealingBeam,1/0/0/0/waterWillHealingBeam)',
      'impact:start(5,5)',
      'trajectory:settle(waterWillHealingBeam,1/0/0/0/waterWillHealingBeam)',
      'target:commit(5,5)'
    ]);
    expect(Check.expectedSemanticTrajectoryTrace(grassSource)).toEqual([
      'trajectory:start(grassWillSeedBeam,1/0/0/0/grassWillSeedBeam)',
      'impact:start(5,5)',
      'trajectory:settle(grassWillSeedBeam,1/0/0/0/grassWillSeedBeam)',
      'target:commit(5,5)'
    ]);
    const sniper = Check.PLAYBACK_SCENARIOS.find((scenario: any) => scenario.name === 'trajectory-sniper-shot');
    expect(sniper.sourceTrajectory).toEqual(expect.objectContaining({
      sourceId: '2,1',
      targetId: '2,5',
      direction: 'source-to-target',
      primitive: 'projectile'
    }));
    expect(sniper.events[0].targets[0]).toEqual(expect.objectContaining({
      sourceRow: 2,
      sourceCol: 1,
      r: 2,
      col: 5
    }));
  });

  test('accepts DOM/Pixi and classic/Vite parity with settled private resources', () => {
    expect(Check.evaluatePixiPlaybackBrowserReport(goodReport())).toEqual({ ok: true, errors: [] });
  });

  test('accepts an explicitly filtered scenario matrix without weakening its scenario contract', () => {
    const report = goodReport();
    report.scenarioNames = ['topology-expansion'];
    for (const lane of report.reports) {
      lane.scenarios = lane.scenarios.filter((scenario: any) => scenario.scenario === 'topology-expansion');
      if (lane.renderer === 'pixi' && lane.mode === 'noanim') {
        const topology = lane.scenarios[0];
        topology.final.backendDiagnostics.timeline.startedRunCount =
          topology.started.initialBackendDiagnostics.timeline.startedRunCount;
      }
    }
    expect(Check.evaluatePixiPlaybackBrowserReport(report)).toEqual({ ok: true, errors: [] });
  });

  test('accepts a reduced-motion branch that settles before the external frame probe', () => {
    const report = goodReport();
    const pixi = report.reports.find((entry: any) => (
      entry.lane === 'classic' && entry.renderer === 'pixi' && entry.mode === 'reduced-motion'
    ));
    const scenario = pixi.scenarios.find((entry: any) => entry.scenario === 'move');
    // The in-page fallback is captured before the wrapper returns, so the
    // board phase can be settled while the outer writer is still owned.
    scenario.keyFrame.writerMode = 'playback';
    scenario.keyFrame.playbackDone = true;
    scenario.keyFrame.captureKind = 'settled';
    scenario.keyFrame.backendDiagnostics.timeline.activeRunCount = 0;
    scenario.keyFrame.backendDiagnostics.pool.activePlaybackGhostCount = 0;

    expect(Check.evaluatePixiPlaybackBrowserReport(report)).toEqual({ ok: true, errors: [] });
  });

  test('requires an in-page active probe for normal motion and settled capture for NOANIM', () => {
    const normalReport = goodReport();
    const normalPixi = normalReport.reports.find((entry: any) => (
      entry.lane === 'classic' && entry.renderer === 'pixi' && entry.mode === 'normal'
    ));
    normalPixi.scenarios[0].keyFrame.capturedInsidePlayback = false;
    normalPixi.scenarios[0].keyFrame.captureKind = 'settled';

    const normalEvaluation = Check.evaluatePixiPlaybackBrowserReport(normalReport);
    expect(normalEvaluation.ok).toBe(false);
    expect(normalEvaluation.errors).toEqual(expect.arrayContaining([
      expect.stringMatching(/not captured inside board playback/),
      expect.stringMatching(/not captured from an active frame/)
    ]));

    const noanimReport = goodReport();
    const noanimPixi = noanimReport.reports.find((entry: any) => (
      entry.lane === 'classic' && entry.renderer === 'pixi' && entry.mode === 'noanim'
    ));
    noanimPixi.scenarios[0].keyFrame.captureKind = 'active';

    const noanimEvaluation = Check.evaluatePixiPlaybackBrowserReport(noanimReport);
    expect(noanimEvaluation.ok).toBe(false);
    expect(noanimEvaluation.errors).toEqual(expect.arrayContaining([
      expect.stringMatching(/NOANIM key-frame did not capture immediate settlement/)
    ]));
  });

  test('rejects sound/final parity drift, missing key frames, and active ticker/pool leases', () => {
    const report = goodReport();
    const pixi = report.reports.find((entry: any) => (
      entry.lane === 'classic' && entry.renderer === 'pixi' && entry.mode === 'normal'
    ));
    pixi.scenarios[0].soundKeys = ['wrong_sound'];
    pixi.scenarios[0].keyFrame.screenshotSha256 = null;
    pixi.scenarios[0].final.backendDiagnostics.tickerRunning = true;
    pixi.scenarios[0].final.backendDiagnostics.application.tickerListenerCount = 1;
    pixi.scenarios[0].final.backendDiagnostics.pool.activePlaybackGhostCount = 1;
    pixi.scenarios[0].final.renderedCells['2,2'].hasStone = false;

    const evaluation = Check.evaluatePixiPlaybackBrowserReport(report);
    expect(evaluation.ok).toBe(false);
    expect(evaluation.errors).toEqual(expect.arrayContaining([
      expect.stringMatching(/sound order drifted/),
      expect.stringMatching(/key-frame screenshot evidence is missing/),
      expect.stringMatching(/private ticker remained active/),
      expect.stringMatching(/private ticker listener remained subscribed/),
      expect.stringMatching(/object-pool lease remained active/),
      expect.stringMatching(/final rendered cell semantics drifted/),
      expect.stringMatching(/parity digest is inconsistent/),
      expect.stringMatching(/DOM\/Pixi event, sound, or final-model digest drifted/)
    ]));
  });

  test('rejects canonical input drift, synthetic-route-shaped trace drift, and Pixi surface overlap', () => {
    const report = goodReport();
    const pixi = report.reports.find((entry: any) => (
      entry.lane === 'classic' && entry.renderer === 'pixi' && entry.mode === 'normal'
    ));
    const scenario = pixi.scenarios.find((entry: any) => entry.scenario === 'special-destroy-hybrid');
    scenario.settledInputDigest = 'mutated-events';
    scenario.semanticTrajectoryTrace = [
      'global:destroy_source_animation',
      ...scenario.semanticTrajectoryTrace
    ];
    scenario.keyFrame.trajectoryDomOverlayCount = 1;
    scenario.keyFrame.backendDiagnostics.contextCount = 2;
    scenario.final.trajectoryDomOverlayCount = 1;
    scenario.final.backendDiagnostics.contextCount = 2;
    scenario.semanticTrajectoryEvidence[0].completedRunDelta = 0;

    const evaluation = Check.evaluatePixiPlaybackBrowserReport(report);
    expect(evaluation.ok).toBe(false);
    expect(evaluation.errors).toEqual(expect.arrayContaining([
      expect.stringMatching(/canonical input events\[\] digest drifted/),
      expect.stringMatching(/backend-local semantic trajectory trace drifted/),
      expect.stringMatching(/materialized a DOM\/SVG trajectory overlay/),
      expect.stringMatching(/active Pixi canvas\/context exclusivity drifted/),
      expect.stringMatching(/retained a DOM\/SVG trajectory overlay/),
      expect.stringMatching(/Pixi\/DOM exclusive render surface contract drifted/),
      expect.stringMatching(/did not start, settle, and commit exactly once/)
    ]));
  });

  test('rejects an actual diagnostic trace whose settle precedes target impact', () => {
    const report = goodReport();
    const pixi = report.reports.find((entry: any) => (
      entry.lane === 'classic' && entry.renderer === 'pixi' && entry.mode === 'normal'
    ));
    const scenario = pixi.scenarios.find((entry: any) => entry.scenario === 'trajectory-sniper-shot');
    const settleObservation = scenario.semanticTrajectoryObservations.find((entry: any) => (
      entry.kind === 'trajectory-settle'
    ));
    const impactObservation = scenario.semanticTrajectoryObservations.find((entry: any) => (
      entry.kind === 'target-impact-start'
    ));
    settleObservation.sequence = 11;
    impactObservation.sequence = 12;
    const settleDiagnostic = scenario.trajectoryDiagnosticEntries.find((entry: any) => (
      entry.event === 'pixi-source-trajectory:settle'
    ));
    const impactDiagnostic = scenario.trajectoryDiagnosticEntries.find((entry: any) => (
      entry.event === 'pixi-playback:target-impact-start'
    ));
    settleDiagnostic.index = 11;
    impactDiagnostic.index = 12;
    scenario.semanticTrajectoryTrace = Check.normalizeSemanticTrajectoryTrace(
      scenario.semanticTrajectoryObservations
    );
    scenario.parityDigest = Check.buildPlaybackParityDigest(scenario);

    const evaluation = Check.evaluatePixiPlaybackBrowserReport(report);
    expect(evaluation.ok).toBe(false);
    expect(evaluation.errors).toEqual(expect.arrayContaining([
      expect.stringMatching(/backend-local semantic trajectory trace drifted/)
    ]));
  });

  test('pixelmatches backend-local baseline-to-active masks and rejects a meaning-level drift', () => {
    const report = goodReport();
    expect(Check.evaluatePixiPlaybackBrowserReport(report)).toEqual({ ok: true, errors: [] });
    const pixi = report.reports.find((entry: any) => (
      entry.lane === 'classic' && entry.renderer === 'pixi' && entry.mode === 'normal'
    ));
    const scenario = pixi.scenarios.find((entry: any) => entry.scenario === 'trajectory-sniper-shot');
    scenario.trajectoryRoi.delta = {
      ...scenario.trajectoryRoi.delta,
      pngBase64: rgbaPng(255, 255, 255)
    };

    const evaluation = Check.evaluatePixiPlaybackBrowserReport(report);
    expect(evaluation.ok).toBe(false);
    expect(evaluation.errors).toEqual(expect.arrayContaining([
      expect.stringMatching(/trajectory delta-mask pixelmatch exceeded/)
    ]));
  });

  test('aligns beam ROI masks by the actual backend-local source endpoint', () => {
    const dom = pointDeltaPng(12, 8, 2, 3);
    const pixi = pointDeltaPng(12, 8, 5, 3);
    const comparison = Check.compareTrajectoryRoiPng(
      dom,
      pixi,
      'destroyDragonBreath',
      {
        clip: { x: 100, y: 200, width: 12, height: 8 },
        sourceCenter: { x: 102, y: 203 },
        targetCenter: { x: 110, y: 203 },
        cellSize: 2
      },
      {
        clip: { x: 100, y: 200, width: 12, height: 8 },
        sourceCenter: { x: 105, y: 203 },
        targetCenter: { x: 113, y: 203 },
        cellSize: 2
      }
    );

    expect(comparison).toMatchObject({ ok: true, diffPixelCount: 0, alignment: { x: -3, y: 0 } });
  });
});
