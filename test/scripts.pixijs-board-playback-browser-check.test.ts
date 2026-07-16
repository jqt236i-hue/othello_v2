const Check = require('../scripts/pixijs-board-playback-browser-check');

function goodBackendDiagnostics(): any {
  return {
    tickerRunning: false,
    canvasCount: 1,
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
      inFlightEffectCount: 0
    },
    pool: {
      activePlaybackGhostCount: 0,
      pooledPlaybackGhostCount: 2,
      activePlaybackHighlightLeaseCount: 0,
      renderedPlaybackHighlightCount: 0,
      pooledPlaybackHighlightCount: 1
    }
  };
}

function scenarioReport(definition: any, renderer: 'dom' | 'pixi', mode: string): any {
  const finalModelDigest = Check.canonicalFinalModelDigest(definition);
  const finalRenderedCells = JSON.parse(JSON.stringify(Check.expectedFinalRenderedCells(definition)));
  const report = {
    scenario: definition.name,
    started: renderer === 'pixi' ? {
      initialBackendDiagnostics: { timeline: { startedRunCount: 2 } }
    } : {},
    expectedEventType: definition.eventType,
    expectedSoundKey: definition.soundKey,
    expectedFinalModelDigest: finalModelDigest,
    expectedFinalRenderedCells: Check.expectedFinalRenderedCells(definition),
    inputDigest: `input:${definition.name}`,
    eventTypes: [definition.eventType],
    completedEventTypes: [definition.eventType],
    soundKeys: [definition.soundKey],
    error: null,
    finalModelDigest,
    finalVisualDigest: `${renderer}:visual:${definition.name}`,
    settledFlags: {
      playbackActive: false,
      processing: false,
      cardAnimating: false,
      writerMode: 'idle'
    },
    keyFrame: renderer === 'pixi' ? {
      capturedInsidePlayback: true,
      captureKind: mode === 'noanim' ? 'settled' : 'active',
      captureStage: mode === 'noanim' ? 'microtask' : 'microtask',
      writerMode: mode === 'noanim' ? 'idle' : 'playback',
      playbackDone: mode === 'noanim',
      screenshotSha256: 'a'.repeat(64),
      screenshotSource: 'pixi-extract',
      backendDiagnostics: {
        timeline: {
          activeRunCount: mode === 'noanim' ? 0 : 1
        },
        pool: {
          activePlaybackGhostCount: mode === 'noanim'
            || (mode === 'reduced-motion' && definition.name === 'destroy') ? 0 : 1,
          activePlaybackHighlightLeaseCount: 0
        }
      }
    } : null,
    final: renderer === 'pixi' ? {
      backendDiagnostics: goodBackendDiagnostics(),
      renderedCells: Object.fromEntries(Object.entries(finalRenderedCells).map(([key, value]: [string, any]) => [
        key,
        { rendered: true, ...value, playbackHidden: false }
      ]))
    } : {
      backendDiagnostics: null,
      renderedCells: Object.fromEntries(Object.entries(finalRenderedCells).map(([key, value]: [string, any]) => [
        key,
        { rendered: true, ...value, playbackHidden: false }
      ]))
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
          scenarios: Check.PLAYBACK_SCENARIOS.map((definition: any) => (
            scenarioReport(definition, renderer, mode)
          ))
        });
      }
    }
  }
  return { reports };
}

describe('Pixi basic playback browser check', () => {
  test('covers only the six Phase 6 board event groups and parses public lanes/modes', () => {
    expect(Check.KEY_FRAME_DELAY_MS).toBeUndefined();
    expect(Check.PLAYBACK_SCENARIOS.map((scenario: any) => scenario.eventType)).toEqual([
      'place',
      'spawn',
      'flip',
      'destroy',
      'move',
      'status_applied'
    ]);
    expect(Check.publicEntryPath('classic', 'pixi', 'normal'))
      .toBe('/index.classic.html?debug=1&boardRenderer=pixi');
    expect(Check.publicEntryPath('vite', 'pixi', 'noanim'))
      .toBe('/?debug=1&boardRenderer=pixi&noanim=1');
    expect(Check.parseCliOptions(['--classic-only', '--mode=reduced-motion'])).toEqual({
      lanes: ['classic'],
      modes: ['reduced-motion'],
      writeArtifacts: true
    });
    expect(() => Check.parseCliOptions(['--classic-only', '--vite-only'])).toThrow('mutually exclusive');
    expect(() => Check.parseCliOptions(['--mode=slow'])).toThrow('Unsupported playback mode');

    const payload = Check.createBrowserScenarioPayload(Check.PLAYBACK_SCENARIOS[0]);
    expect(payload).toEqual({
      definition: Check.PLAYBACK_SCENARIOS[0],
      boardSize: { rows: 8, cols: 8 }
    });
    expect(payload.boardSize).toBe(Check.PLAYBACK_BOARD_SIZE);
  });

  test('accepts DOM/Pixi and classic/Vite parity with settled private resources', () => {
    expect(Check.evaluatePixiPlaybackBrowserReport(goodReport())).toEqual({ ok: true, errors: [] });
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
});
