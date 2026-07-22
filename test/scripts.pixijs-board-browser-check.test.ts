jest.mock('pixelmatch', () => ({
  default: (left: Uint8Array, right: Uint8Array) => {
    let different = 0;
    for (let index = 0; index < Math.min(left.length, right.length); index += 4) {
      if (left[index] !== right[index]
        || left[index + 1] !== right[index + 1]
        || left[index + 2] !== right[index + 2]
        || left[index + 3] !== right[index + 3]) different += 1;
    }
    return different;
  }
}));

const Check = require('../scripts/pixijs-board-browser-check');
const path = require('path');

function goodFixture(definition: any, dpr = 1): any {
  const expected = definition.skin || {
    board: 'bluegreen-felt',
    frame: 'marsh-forged-iron',
    stone: 'o-stone'
  };
  const presentationCandidateKeys = definition.decoratePresentation
    ? Array.from({ length: 9 }, (_unused, index) => `candidate-${index}`)
    : [];
  const renderedCells = Object.fromEntries(presentationCandidateKeys.map((key, index) => [key, {
    hint: {
      legal: index === 0,
      selectable: index === 3 || index === 7,
      selected: index === 2,
      keyboardCursor: index === 8,
      previewKinds: index >= 2 && index <= 6 ? ['fixture-preview'] : []
    }
  }]));
  if (definition.name === 'presentation-special-timer-badge') {
    for (const [key, expectation] of Object.entries(Check.SPECIAL_TIMER_BADGE_EXPECTATIONS) as any[]) {
      renderedCells[key] = {
        cell: { renderedMarkerKinds: [] },
        stone: {
          visible: true,
          specialType: expectation.specialType,
          statusLabels: expectation.statusLabels.map((label: string) => {
            const separator = label.lastIndexOf(':');
            return { kind: label.slice(0, separator), value: label.slice(separator + 1) };
          }),
          renderedMarkerKinds: expectation.renderedMarkerKinds || []
        }
      };
    }
    renderedCells['4,4'] = {
      cell: { renderedMarkerKinds: [] },
      stone: { visible: true, specialType: null, statusLabels: [], renderedMarkerKinds: [] }
    };
  }
  return {
    fixture: definition.name,
    renderer: 'pixi',
    canvasCount: 1,
    domCellCount: 0,
    scrollSurfaceCellCount: 0,
    canvasAriaHidden: true,
    connectedBoardContextCount: 1,
    requestedDpr: dpr,
    observedDpr: dpr,
    frameDigest: `digest:${definition.name}`,
    backendDiagnostics: {
      application: {
        tickerRunning: false,
        privateTickerRunning: false,
        sharedTickerRunning: false,
        systemTickerRunning: false
      }
    },
    canvas: {
      backingWidth: 900 * dpr,
      backingHeight: 700 * dpr,
      backingMaxWidth: 1000 * dpr,
      backingMaxHeight: 800 * dpr
    },
    displayObjectCounts: { total: 100, active: 64, pooled: 0 },
    textureLeaseCounts: { total: 3, cached: 3, external: 0, source: 0 },
    materializationMax: 100,
    idleRafCallbacks: 0,
    gutter: { top: 100, right: 100, bottom: 100, left: 100, expected: 100 },
    skin: { expected, ...expected },
    presentationCandidateKeys,
    renderedCells,
    phaseZeroComparison: null
  };
}

function goodReport(): any {
  return {
    lane: 'classic',
    requestedDpr: 1,
    fixtures: Check.BROWSER_FIXTURES.map((definition: any) => goodFixture(definition)),
    expansionRectInvariance: Check.REQUIRED_EXPANSION_FIXTURES.map((fixture: string) => ({
      fixture,
      before: { left: 10, top: 20, width: 50, height: 50 },
      after: { left: 10, top: 20, width: 50, height: 50 },
      maxDeltaPx: 0
    })),
    virtualization: {
      topMaterialized: true,
      bottomMaterialized: true,
      maxActive: 100,
      maxPooled: 100,
      logicalExceedsViewport: true,
      maxBackingWidth: 900,
      minBackingWidth: 900,
      maxBackingHeight: 700,
      minBackingHeight: 700,
      maxBackingWidthLimit: 1000,
      maxBackingHeightLimit: 800,
      activeStrictMonotonicGrowth: false,
      pooledStrictMonotonicGrowth: false,
      leasesStrictMonotonicGrowth: false,
      backingStrictMonotonicGrowth: false,
      expansionActiveStrictMonotonicGrowth: false,
      expansionPooledStrictMonotonicGrowth: false,
      expansionLeasesStrictMonotonicGrowth: false,
      seriesGrowth: {
        viewportStart: { active: false, pooled: false, leases: false, backingWidth: false, backingHeight: false },
        viewportEnd: { active: false, pooled: false, leases: false, backingWidth: false, backingHeight: false },
        base: { active: false, pooled: false, leases: false, backingWidth: false, backingHeight: false },
        expanded: { active: false, pooled: false, leases: false, backingWidth: false, backingHeight: false }
      }
    },
    visualViewport: {
      scaleChanged: true,
      layoutRevisionAdvanced: true,
      cellSizeStable: true,
      offsetCoordinateDelta: { matches: true }
    },
    customBlob: {
      boardId: 'custom:board:test',
      stoneId: 'custom:stone:test',
      baseline: {
        leases: { total: 3, cached: 2, source: 1, external: 0 },
        objectUrls: { activeLeaseCount: 0, retainedUrlCount: 0 }
      },
      active: {
        skin: { board: 'custom:board:test', stone: 'custom:stone:test' },
        leases: { total: 4, cached: 2, source: 2, external: 0 },
        objectUrls: { activeLeaseCount: 2, retainedUrlCount: 3 }
      },
      released: {
        leases: { total: 3, cached: 2, source: 1, external: 0 },
        objectUrls: { activeLeaseCount: 0, retainedUrlCount: 0 }
      }
    }
  };
}

describe('Pixi static board browser check', () => {
  test('reuses every Phase 0 browser fixture and accepts a bounded exclusive Pixi report', () => {
    expect(typeof Check.applyPhaseZeroFixture).toBe('function');
    const names = Check.BROWSER_FIXTURES.map((fixture: any) => fixture.name);
    expect(names).toEqual(expect.arrayContaining([
      'rectangle-4x4',
      'rectangle-4x16',
      'rectangle-16x4',
      'rectangle-16x16',
      'circle-6',
      'circle-10-hole-pseudo-edge',
      'rectangle-8x8-multistage-negative',
      'presentation-custom-skins',
      'presentation-special-timer-badge',
      'presentation-breeding-expansion'
    ]));
    expect(Check.BROWSER_FIXTURES.find((fixture: any) => fixture.name === 'presentation-breeding-expansion'))
      .toMatchObject({
        expansionCells: [{ row: 3, col: 8, side: 'right', owner: 1 }],
        breedingSproutByOwner: { black: [{ row: 3, col: 8 }], white: [] }
      });
    expect(Check.evaluatePixijsBoardLaneReport(goodReport())).toEqual({ ok: true, errors: [] });
  });

  test('rejects simultaneous DOM/Pixi writers, unbounded backing, idle rAF, and leaked Blob leases', () => {
    const report = goodReport();
    const fixture = report.fixtures[0];
    fixture.domCellCount = 64;
    fixture.canvas.backingWidth = fixture.canvas.backingMaxWidth + 1;
    fixture.idleRafCallbacks = 2;
    fixture.gutter.left = 0;
    report.virtualization.seriesGrowth.viewportStart.leases = true;
    report.expansionRectInvariance[0].maxDeltaPx = Check.RECT_TOLERANCE_PX + 0.1;
    report.visualViewport.offsetCoordinateDelta.matches = false;
    report.customBlob.released.leases.source = 2;

    const result = Check.evaluatePixijsBoardLaneReport(report);
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.stringMatching(/DOM cells were materialized/),
      expect.stringMatching(/canvas backing width is unbounded/),
      expect.stringMatching(/rAF continued/),
      expect.stringMatching(/left effect gutter/),
      expect.stringMatching(/viewportStart\.leases has net growth/),
      expect.stringMatching(/existing cell moved/),
      expect.stringMatching(/visualViewport offsets/),
      expect.stringMatching(/pre-custom baseline/)
    ]));
  });

  test('uses the exact decorated candidate keys and accepts expansion dimension drift only via geometry/skin parity', () => {
    const report = goodReport();
    const decorated = report.fixtures.find((fixture: any) => (
      Check.BROWSER_FIXTURES.find((definition: any) => definition.name === fixture.fixture)?.decoratePresentation
    ));
    decorated.presentationCandidateKeys = decorated.presentationCandidateKeys.slice(0, 8);
    expect(Check.evaluatePixijsBoardLaneReport(report).errors).toEqual(expect.arrayContaining([
      expect.stringMatching(/static legal\/selection\/preview\/keyboard hints are incomplete/)
    ]));

    const expansionReport = goodReport();
    const expansion = expansionReport.fixtures.find((fixture: any) => (
      fixture.fixture === Check.REQUIRED_EXPANSION_FIXTURES[0]
    ));
    expansion.phaseZeroComparison = { dimensionMatch: false, diffPixels: Number.POSITIVE_INFINITY };
    expansion.phaseZeroGeometrySkinComparison = {
      ok: true,
      baselineKeyCount: 4,
      commonKeyCount: 4,
      maxCellSizeDeltaPx: 0,
      maxRelativePositionDeltaPx: 0,
      skinMatch: true
    };
    expect(Check.evaluatePixijsBoardLaneReport(expansionReport)).toEqual({ ok: true, errors: [] });

    const presentationExpansionReport = goodReport();
    const presentationExpansion = presentationExpansionReport.fixtures.find((fixture: any) => (
      fixture.fixture === 'presentation-breeding-expansion'
    ));
    presentationExpansion.phaseZeroComparison = {
      dimensionMatch: false,
      diffPixels: Number.POSITIVE_INFINITY
    };
    presentationExpansion.phaseZeroGeometrySkinComparison = expansion.phaseZeroGeometrySkinComparison;
    presentationExpansion.phaseZeroFrameComparison = {
      dimensionMatch: false,
      diffPixels: Number.POSITIVE_INFINITY
    };
    expect(Check.evaluatePixijsBoardLaneReport(presentationExpansionReport))
      .toEqual({ ok: true, errors: [] });

    const ordinaryReport = goodReport();
    ordinaryReport.fixtures[0].phaseZeroComparison = {
      dimensionMatch: false,
      diffPixels: Number.POSITIVE_INFINITY
    };
    ordinaryReport.fixtures[0].phaseZeroGeometrySkinComparison = expansion.phaseZeroGeometrySkinComparison;
    expect(Check.evaluatePixijsBoardLaneReport(ordinaryReport).errors).toEqual(expect.arrayContaining([
      expect.stringMatching(/dimensions changed without equivalent cell geometry\/skin/)
    ]));
  });

  test('compares expansion cell geometry relative to its origin and checks Phase 0 skin IDs', () => {
    const baseline = {
      selectedClientRects: {
        '0,0': { x: 500, y: 220, width: 44, height: 44 },
        '4,4': { x: 676, y: 396, width: 44, height: 44 },
        '-1,3': { x: 632, y: 176, width: 44, height: 44 }
      },
      skinSnapshot: {
        boardSkinId: 'bluegreen-felt',
        frameSkinId: 'marsh-forged-iron',
        stoneSkinId: 'o-stone'
      }
    };
    const probe = {
      cellRects: {
        '0,0': { left: 20, top: 30, width: 44, height: 44 },
        '4,4': { left: 196, top: 206, width: 44, height: 44 },
        '-1,3': { left: 152, top: -14, width: 44, height: 44 }
      },
      skin: { board: 'bluegreen-felt', frame: 'marsh-forged-iron', stone: 'o-stone' }
    };
    expect(Check.comparePhaseZeroGeometryAndSkin(probe, baseline)).toMatchObject({
      ok: true,
      baselineKeyCount: 3,
      commonKeyCount: 3,
      maxCellSizeDeltaPx: 0,
      maxRelativePositionDeltaPx: 0,
      skinMatch: true
    });

    probe.cellRects['4,4'].left += 1;
    expect(Check.comparePhaseZeroGeometryAndSkin(probe, baseline)).toMatchObject({ ok: false });
  });

  test('reads the checked-in Phase 0 fixture from the current single-run lane object', () => {
    const baseline = Check.readPhaseZeroFixtureBaseline(
      path.resolve(__dirname, '..'),
      'classic',
      'rectangle-8x8-expanded-top'
    );
    expect(baseline).toMatchObject({
      fixture: 'rectangle-8x8-expanded-top',
      selectedClientRects: {
        '0,0': { width: 44, height: 44 },
        '-1,3': { width: 44, height: 44 }
      },
      skinSnapshot: {
        boardSkinId: 'bluegreen-felt',
        frameSkinId: 'marsh-forged-iron',
        stoneSkinId: 'o-stone'
      }
    });
  });

  test('derives negative expansion topology bounds without densifying the fixture', () => {
    const expanded = Check.BROWSER_FIXTURES.find((fixture: any) => (
      fixture.name === 'rectangle-8x8-multistage-negative'
    ));
    expect(Check.topologyBounds(expanded)).toEqual({
      minRow: -2,
      maxRow: 8,
      minCol: -1,
      maxCol: 8,
      renderRows: 11,
      renderCols: 10
    });

    expect(Check.VIRTUALIZATION_FIXTURE).toMatchObject({ rows: 8, cols: 8 });
    expect(Check.topologyBounds(Check.VIRTUALIZATION_FIXTURE)).toEqual({
      minRow: -4,
      maxRow: 11,
      minCol: -4,
      maxCol: 11,
      renderRows: 16,
      renderCols: 16
    });
  });

  test('detects lifecycle growth and parses the exact public static lane options', () => {
    expect(Check.isStrictMonotonicGrowth([1, 2, 3, 4])).toBe(true);
    expect(Check.isStrictMonotonicGrowth([1, 2, 2, 3])).toBe(false);
    expect(Check.hasNetGrowthAfterWarmup([10, 11, 11, 12, 12, 13])).toBe(true);
    expect(Check.hasNetGrowthAfterWarmup([10, 12, 11, 12, 11, 12])).toBe(false);
    const missingEvidence = goodReport();
    delete missingEvidence.virtualization.seriesGrowth.base.pooled;
    expect(Check.evaluatePixijsBoardLaneReport(missingEvidence).errors).toEqual(expect.arrayContaining([
      expect.stringMatching(/lifecycle metric base\.pooled is missing/)
    ]));
    expect(Check.parseCliOptions(['--classic-only', '--dpr=2'])).toEqual({
      lanes: ['classic'],
      dprs: [2],
      comparePhaseZero: true
    });
    expect(Check.STATIC_ENTRY_QUERY).toBe('debug=1&boardRenderer=pixi&noanim=1');
    expect(() => Check.parseCliOptions(['--classic-only', '--vite-only'])).toThrow('mutually exclusive');
  });

  test('keeps the established pixel comparison threshold and rejects dimension drift', () => {
    const PNG = require('pngjs').PNG;
    const makePng = (width: number, height: number, color: number) => {
      const png = new PNG({ width, height });
      png.data.fill(color);
      return PNG.sync.write(png);
    };
    expect(Check.comparePngBuffers(makePng(2, 2, 0), makePng(2, 2, 0))).toMatchObject({
      dimensionMatch: true,
      diffPixels: 0
    });
    expect(Check.comparePngBuffers(makePng(2, 2, 0), makePng(3, 2, 0))).toMatchObject({
      dimensionMatch: false,
      diffPixels: Number.POSITIVE_INFINITY
    });
    expect(Check.PNG_DIFF_PIXEL_BUDGET).toBe(4000);
  });

  test('serializes capture failures as lane-scoped diagnostic reports', () => {
    const error: any = new Error('page closed during fixture');
    error.code = 'PAGE_CLOSED';
    error.stage = 'afterReady';
    expect(Check.createFailedLaneReport('vite', 2, error)).toMatchObject({
      lane: 'vite',
      requestedDpr: 2,
      publicEntry: '/?debug=1&boardRenderer=pixi&noanim=1',
      failure: {
        name: 'Error',
        message: 'page closed during fixture',
        code: 'PAGE_CLOSED',
        stage: 'afterReady'
      },
      evaluation: {
        ok: false,
        errors: [expect.stringMatching(/vite@2.*page closed during fixture/)]
      }
    });
  });
});
