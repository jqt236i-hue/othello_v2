import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const Baseline = require('../scripts/capture-pixijs-playfield-baseline');

describe('PixiJS playfield DOM baseline capture', () => {
  test('builds deterministic topology fixtures for every required shape family', () => {
    const first = Baseline.buildTopologyFixtures();
    const second = Baseline.buildTopologyFixtures();

    expect(second).toEqual(first);
    expect(first.map((fixture: any) => fixture.name)).toEqual(expect.arrayContaining([
      'rectangle-4x4',
      'rectangle-4x16',
      'rectangle-16x4',
      'rectangle-7x7',
      'rectangle-8x8',
      'rectangle-16x16',
      'circle-6',
      'circle-8',
      'circle-10',
      'circle-12',
      'circle-14',
      'circle-16',
      'rectangle-8x8-hole',
      'rectangle-8x8-multistage-expansion'
    ]));
    const expanded = first.find((fixture: any) => fixture.name === 'rectangle-8x8-multistage-expansion');
    expect(expanded.expansionKeys).toEqual(expect.arrayContaining(['-2,3', '-1,3', '8,4', '3,-1', '4,8']));
    expect(expanded.renderBounds).toEqual({ minRow: -2, maxRow: 8, minCol: -1, maxCol: 8 });
    expect(first.every((fixture: any) => /^[a-f0-9]{64}$/.test(fixture.digest))).toBe(true);
  });

  test('collects a machine-readable selector inventory without generated output', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pixi-selector-baseline-'));
    try {
      fs.mkdirSync(path.join(root, 'ui'), { recursive: true });
      fs.mkdirSync(path.join(root, 'test'), { recursive: true });
      fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
      fs.writeFileSync(
        path.join(root, 'ui', 'board.ts'),
        'document.querySelectorAll(".cell"); const selectorPattern = /\\.cell(?:\\.|$)/; const ignored = state.boardExpansion.cells; const literal = ".cells"; forceFullRender();\n'
      );
      fs.writeFileSync(
        path.join(root, 'test', 'board.test.ts'),
        'expect(".disc").toBeTruthy(); const selectorPattern = /\\.disc(?:\\.|$)/; const discard = cardState.discard; const discDiff = 1; expect(".discard");\n'
      );
      fs.writeFileSync(
        path.join(root, 'scripts', 'capture-pixijs-playfield-baseline.ts'),
        'document.querySelectorAll(".cell"); getCellEl(0, 0);\n'
      );

      const inventory = Baseline.collectSelectorInventory(root);
      expect(inventory.totals['.cell']).toBe(2);
      expect(inventory.totals['.disc']).toBe(2);
      expect(inventory.totals.forceFullRender).toBe(1);
      expect(inventory.entries.map((entry: any) => entry.path)).toEqual(['test/board.test.ts', 'ui/board.ts']);
      expect(inventory.byCategory).toEqual({ test: 1, ui: 1 });
      expect(inventory.digest).toMatch(/^[a-f0-9]{64}$/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('keeps real selector and regex dependencies from the repository inventory', () => {
    const inventory = Baseline.collectSelectorInventory(path.resolve(__dirname, '..'));
    const byPath = new Map(inventory.entries.map((entry: any) => [entry.path, entry.tokens]));
    expect(byPath.get('ui/board-dom-compat/dom-patcher.ts')).toMatchObject({ '.disc': expect.any(Number) });
    expect(byPath.get('test/ui.board-frame.custom-size.test.ts')).toMatchObject({ '.cell': expect.any(Number) });
    expect(byPath.get('test/ui.board-css-contract.test.ts')).toMatchObject({ '.cell': expect.any(Number) });
  });

  test('covers every required browser fixture family', () => {
    const names = Baseline.BROWSER_FIXTURES.map((fixture: any) => fixture.name);
    expect(names).toEqual(expect.arrayContaining([
      'rectangle-4x4',
      'rectangle-4x16',
      'rectangle-16x4',
      'rectangle-7x7',
      'rectangle-8x8-four-stars',
      'rectangle-16x16',
      'circle-6',
      'circle-10',
      'circle-16',
      'circle-10-hole-pseudo-edge',
      'rectangle-8x8-expanded-top',
      'rectangle-8x8-expanded-right',
      'rectangle-8x8-expanded-bottom',
      'rectangle-8x8-expanded-left',
      'rectangle-8x8-multistage-negative',
      'presentation-default-hints',
      'presentation-custom-skins',
      'presentation-special-timer-badge'
    ]));
  });

  test('defines the production playback fixture without deriving its outcome in the capture script', () => {
    const baseline = Baseline.buildPlaybackEventFixtureContract();
    expect(baseline.eventCount).toBeGreaterThanOrEqual(10);
    expect(Array.from(new Set(baseline.events.map((event: any) => event.phase)))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(baseline.declaredSoundKeys).toEqual(expect.arrayContaining([
      'stone_place', 'stone_flip', 'stone_destroy', 'breeding_spawn', 'theory_incarnation_spawn'
    ]));
    expect(baseline.inputDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(baseline.semanticDigest).toMatch(/^fnv1a32:[a-f0-9]{8}$/);
    expect(baseline.canonicalFinalDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(baseline.digest).toMatch(/^[a-f0-9]{64}$/);
  });

  test('keeps playback digests stable when only measured durations change', () => {
    const contract = Baseline.buildPlaybackEventFixtureContract();
    const mode = { name: 'normal', reducedMotion: 'no-preference', noAnim: false };
    const execution = {
      durationMs: 10400,
      phaseCompletionOrder: [1, 2],
      phaseCompletionTrace: [
        { phase: 1, depth: 0, durationMs: 120.5, eventTypes: ['PLACE', 'sound_effect'] },
        { phase: 2, depth: 0, durationMs: 240.25, eventTypes: ['FLIP'] }
      ],
      soundKeys: ['stone_place'],
      playbackActive: false,
      processing: false,
      cardAnimating: false
    };
    const first = Baseline.buildStablePlaybackExecutionDigest({
      mode,
      execution,
      inputDigest: contract.inputDigest,
      semanticDigest: contract.semanticDigest,
      finalBoardDigest: 'final-board'
    });
    const second = Baseline.buildStablePlaybackExecutionDigest({
      mode,
      execution: {
        ...execution,
        durationMs: 10999,
        phaseCompletionTrace: execution.phaseCompletionTrace.map((entry: any, index: number) => ({
          ...entry,
          durationMs: 900 + index
        }))
      },
      inputDigest: contract.inputDigest,
      semanticDigest: contract.semanticDigest,
      finalBoardDigest: 'final-board'
    });
    const changedOrder = Baseline.buildStablePlaybackExecutionDigest({
      mode,
      execution: { ...execution, phaseCompletionOrder: [2, 1] },
      inputDigest: contract.inputDigest,
      semanticDigest: contract.semanticDigest,
      finalBoardDigest: 'final-board'
    });

    expect(first).toBe(second);
    expect(first).not.toBe(changedOrder);

    const modes = [{
      name: 'normal', prefersReducedMotion: false, noAnim: false,
      durationMs: 10400, phaseCompletionOrder: [1, 2], soundKeys: ['stone_place'],
      finalBoardDigest: 'final-board', executionDigest: first
    }];
    const aggregateFirst = Baseline.buildStablePlaybackAggregateDigest(contract, modes);
    const aggregateSecond = Baseline.buildStablePlaybackAggregateDigest(contract, [{ ...modes[0], durationMs: 10999 }]);
    expect(aggregateFirst).toBe(aggregateSecond);
  });

  test('normalizes planner manifest completion to the exact Phase 0 playback digests', () => {
    const contract = Baseline.buildPlaybackEventFixtureContract();
    const eventTypesByPhase = new Map<number, string[]>();
    for (const event of contract.events) {
      const phase = Number(event.phase);
      if (!eventTypesByPhase.has(phase)) eventTypesByPhase.set(phase, []);
      eventTypesByPhase.get(phase)!.push(event.type);
    }
    const phaseCompletionTrace = Array.from(eventTypesByPhase.entries()).map(([phase, eventTypes]) => ({
      phase,
      depth: 0,
      durationMs: 0,
      eventTypes
    }));
    const normalizedTrace = Baseline.normalizePhaseZeroPlaybackCompletionTrace(phaseCompletionTrace);
    expect(normalizedTrace.slice(-2)).toEqual([
      { phase: 10, depth: 1, durationMs: 0, eventTypes: ['sound_effect'] },
      { phase: 10, depth: 0, durationMs: 0, eventTypes: ['manifest_ending', 'sound_effect'] }
    ]);
    const middleAndMultipleManifestTrace = [{
      phase: 10,
      depth: 0,
      durationMs: 5,
      eventTypes: ['sound_effect', 'manifest_ending', 'log', 'manifest_ending']
    }];
    const normalizedMiddleAndMultiple = Baseline.normalizePhaseZeroPlaybackCompletionTrace(middleAndMultipleManifestTrace);
    expect(normalizedMiddleAndMultiple).toEqual([
      { phase: 10, depth: 1, durationMs: 0, eventTypes: ['sound_effect', 'log'] },
      middleAndMultipleManifestTrace[0]
    ]);
    expect(Baseline.normalizePhaseZeroPlaybackCompletionTrace(normalizedMiddleAndMultiple))
      .toEqual(normalizedMiddleAndMultiple);

    const phaseCompletionOrder = Array.from(eventTypesByPhase.keys());
    const finalBoardDigest = '80fe11faf0d79b2fe7ca08f916f498289746748bde1b597816655ddb642f03d0';
    const modeDefinitions = [
      { name: 'normal', reducedMotion: 'no-preference', noAnim: false, expected: 'eedbfbfad770db8f276aacbf13f3a4648fa18c018fe3a844770a593656a299e9' },
      { name: 'reduced-motion', reducedMotion: 'reduce', noAnim: false, expected: 'f5fd5917f4a3eeb90abe51cfa688fb24d371d8ff963e2758a01deeeb159c5214' },
      { name: 'NOANIM=1', reducedMotion: 'no-preference', noAnim: true, expected: 'd2b103fb2607db63266bd144960f67afc1c22d9e4f97ddc9bbad65d06681c867' }
    ];
    const modes = modeDefinitions.map((mode) => {
      const executionDigest = Baseline.buildStablePlaybackExecutionDigest({
        mode,
        execution: {
          phaseCompletionTrace,
          phaseCompletionOrder,
          soundKeys: contract.declaredSoundKeys,
          playbackActive: false,
          processing: false,
          cardAnimating: false
        },
        inputDigest: contract.inputDigest,
        semanticDigest: contract.semanticDigest,
        finalBoardDigest
      });
      expect(executionDigest).toBe(mode.expected);
      return {
        name: mode.name,
        prefersReducedMotion: mode.reducedMotion === 'reduce',
        noAnim: mode.noAnim,
        phaseCompletionOrder,
        soundKeys: contract.declaredSoundKeys,
        finalBoardDigest,
        executionDigest
      };
    });
    expect(Baseline.buildStablePlaybackAggregateDigest(contract, modes))
      .toBe('e575038b75fe60388a160b96057934898d4cdc88e1586ed69d4bf062a69c2e86');
  });

  test('freezes network visual settlement scenarios through the production timeline and store', async () => {
    const baseline = await Baseline.buildNetworkVisualBaselines();
    expect(baseline.scenarios.map((scenario: any) => scenario.name)).toEqual([
      'reconnect-journal-gap-recovery',
      'late-snapshot-base-cursor-advance',
      'move-source-empty-after-visual-commit',
      'pending-selection-reconcile-after-visual-commit'
    ]);
    expect(baseline.scenarios[0].checkpoints.map((checkpoint: any) => checkpoint.drained)).toEqual([0, 2]);
    expect(baseline.scenarios.every((scenario: any) => scenario.finalDiagnostics.timeline.paused === false)).toBe(true);
    expect(baseline.scenarios.every((scenario: any) => /^[a-f0-9]{64}$/.test(scenario.digest))).toBe(true);
    expect(baseline.digest).toBe('f1bb2d4606c98e9130dd781bd3af31f2d6f0894793770be2da5e3c27bf7fe7bc');
  });

  test('labels current DOM/Pixi model/apply values as a Phase 0 microcomparison, not animation evidence', () => {
    const fixtureDigest = require('../ui/board-visual/performance-harness').BOARD_PERFORMANCE_PHASE_ZERO_MICRO_DIGEST;
    const reports = ['classic', 'vite'].flatMap((lane) => ['dom', 'pixi'].map((backend) => ({
      lane,
      backend,
      phaseZeroMicroComparison: { fixtureDigest, frameSampleCount: 30 }
    })));
    const comparison = Baseline.buildPhaseZeroPixiComparison({
      schemaVersion: 'pixijs_playfield_dom_baseline.v2',
      commit: 'phase-zero',
      environment: {
        viewport: { width: 1366, height: 900 },
        dpr: 1,
        browserVersions: { classic: 'Chromium', vite: 'Chromium' },
        userAgents: { classic: 'ua', vite: 'ua' }
      },
      browserLanes: {
        classic: { performance: { multiFlipFrameP95Ms: 40 } },
        vite: { performance: { multiFlipFrameP95Ms: 41 } }
      }
    }, reports, 'a'.repeat(64));
    expect(comparison.role).toMatch(/not animation evidence/);
    expect(comparison.fixtureDigest).toBe(fixtureDigest);
    expect(comparison.lanes.classic.currentPixi.frameSampleCount).toBe(30);
    expect(comparison.lanes.vite.immutableDomBaseline.multiFlipFrameP95Ms).toBe(41);
  });

  test('renders a readable comparison document', () => {
    const markdown = Baseline.toMarkdown({
      commit: 'abc',
      capturedAt: '2026-07-14T00:00:00.000Z',
      environment: { node: 'v24', platform: 'win32', arch: 'x64' },
      browserLanes: {
        classic: {
          lane: 'classic', browserVersion: 'Chromium 1', firstBoardObservedMs: 5, readyMs: 10,
          fixtures: Array(18), fixtureDigest: 'lane',
          performance: { multiFlipFrameP50Ms: 12, multiFlipFrameP95Ms: 18, sixteenBySixteenApplyMs: 4 }
        }
      },
      browserLaneParity: { allPixelMatch: true, allSemanticMatch: true },
      topologyFixtures: [{
        name: 'rectangle-8x8', config: { rows: 8, cols: 8, shape: 'rectangle' },
        existingKeys: Array(64), holeKeys: [], digest: 'd'
      }],
      playbackEvents: {
        modes: [{ name: 'normal', phaseCompletionOrder: [1, 2], soundKeys: ['a'], finalBoardDigest: 'board' }]
      },
      networkVisualState: {
        scenarios: [{ name: 'reconnect', finalVisualDigest: 'visual', digest: 'network' }]
      },
      presentationInventory: { digest: 'events' },
      selectorInventory: { digest: 'selectors', entries: [] }
    });
    expect(markdown).toContain('PixiJS playfield migration DOM baseline');
    expect(markdown).toContain('| classic | Chromium 1 | 5 / 10 | 18 | 12 / 18 | 4 |');
    expect(markdown).toContain('| rectangle-8x8 | 8x8 rectangle | 64 |');
    expect(markdown).toContain('Classic/Vite pixel parity: PASS');
    expect(markdown).toContain('| reconnect | `visual` | `network` |');
    expect(markdown).toContain('npm run baseline:pixijs-playfield');
  });
});
