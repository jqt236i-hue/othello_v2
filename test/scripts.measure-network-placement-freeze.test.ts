import {
  buildReport,
  compareReports,
  deriveSeatMetrics,
  parseArgs,
  renderMarkdown,
  REPORT_SCHEMA_VERSION,
  SAMPLE_SCHEMA_VERSION,
  SCENARIO_IDS,
  summarizeTraceEvents,
  type MoveSample,
  type SeatSample
} from '../scripts/perf/measure-network-placement-freeze';

function makeSeat(role: SeatSample['role'], overrides: Partial<SeatSample> = {}): SeatSample {
  const isActor = role === 'actor';
  return {
    role,
    stateVersionAfter: 3,
    timeline: {
      click: isActor ? 0 : null,
      clickReturn: isActor ? 6 : null,
      publishFetchStart: isActor ? 8 : null,
      publishHeaders: isActor ? 50 : null,
      publishBody: isActor ? 60 : null,
      publishBytes: isActor ? 8000 : null,
      publishStatus: isActor ? 200 : null,
      streamArrive: isActor ? 52 : 0,
      streamBytes: 2600,
      streamBinary: true,
      streamTransport: 'ws',
      versionChange: isActor ? 70 : 20,
      playbackStart: isActor ? 70 : 20,
      playbackIdle: isActor ? 1570 : 1520,
      stateFetches: 0
    },
    longTasks: isActor
      ? [{ at: -1, dur: 30 }, { at: 52, dur: 40 }, { at: 1500, dur: 60 }]
      : [{ at: 0, dur: 45 }, { at: 1450, dur: 55 }],
    loaf: { count: 3, blockingTotalMs: 40, longestMs: 60 },
    rafGaps: [],
    ops: null,
    cloneCallers: null,
    trace: null,
    consoleErrors: [],
    pageErrors: [],
    ...overrides
  };
}

function makeSample(index: number, scenarioId: MoveSample['scenarioId'] = 'opening'): MoveSample {
  return {
    schemaVersion: SAMPLE_SCHEMA_VERSION,
    scenarioId,
    index,
    phase: 'opening-move',
    actor: 'black',
    move: { row: 2, col: 3, playerKey: 'black', legalCount: 4, turnNumber: 1 + index, stateVersion: 2 + index },
    clickSyncMs: 6,
    seats: {
      black: makeSeat('actor'),
      white: makeSeat('opponent'),
      spectator: makeSeat('spectator')
    }
  };
}

describe('measure-network-placement-freeze: parseArgs', () => {
  test('defaults and explicit values', () => {
    const defaults = parseArgs([]);
    expect(defaults.scenarios).toEqual(SCENARIO_IDS.slice());
    expect(defaults.iterations).toBe(3);
    expect(defaults.openingMoves).toBe(12);
    expect(defaults.throttle).toBe(1);
    expect(defaults.lane).toBe('vite');
    expect(defaults.server).toBe('local');
    expect(defaults.label).toBe('vite-desktop-x1');
    const mobile = parseArgs(['--mobile', '--scenario', 'opening,late-special-20', '--quick', '--lane', 'classic', '--trace', '--count-callers']);
    expect(mobile.scenarios).toEqual(['opening', 'late-special-20']);
    expect(mobile.throttle).toBe(4);
    expect(mobile.iterations).toBe(1);
    expect(mobile.openingMoves).toBe(4);
    expect(mobile.lane).toBe('classic');
    expect(mobile.label).toBe('classic-mobile-x4');
    expect(mobile.trace).toBe(true);
    expect(mobile.countOps).toBe(true);
    expect(mobile.countCallers).toBe(true);
  });

  test('rejects unknown scenarios', () => {
    expect(() => parseArgs(['--scenario', 'nope'])).toThrow(/unknown scenario/);
  });
});

describe('measure-network-placement-freeze: deriveSeatMetrics', () => {
  test('actor metrics pick the longest task overlapping each phase', () => {
    const metrics = deriveSeatMetrics(makeSeat('actor'));
    expect(metrics.clickTaskMs).toBe(30);
    expect(metrics.clickToPublishMs).toBe(8);
    expect(metrics.publishRoundTripMs).toBe(42);
    expect(metrics.arrivalTaskMs).toBe(40);
    expect(metrics.arrivalToPlaybackStartMs).toBe(18);
    expect(metrics.settlementTaskMs).toBe(60);
    expect(metrics.playbackMs).toBe(1500);
    expect(metrics.loafBlockingTotalMs).toBe(40);
    expect(metrics.longTaskCount).toBe(3);
    expect(metrics.longestTaskMs).toBe(60);
  });

  test('receiver metrics have no click phase and use the stream arrival as origin', () => {
    const metrics = deriveSeatMetrics(makeSeat('opponent'));
    expect(metrics.clickTaskMs).toBeNull();
    expect(metrics.clickToPublishMs).toBeNull();
    expect(metrics.arrivalTaskMs).toBe(45);
    expect(metrics.arrivalToPlaybackStartMs).toBe(20);
    expect(metrics.settlementTaskMs).toBe(55);
  });

  test('prefers trace long tasks when a main-thread trace exists', () => {
    const seat = makeSeat('opponent', {
      trace: {
        mainThread: true, eventCount: 1, profileSamples: 0, marks: [], longTaskCount: 2, gcCount: 0, gcMajorMinorTotalMs: 0, gcTop: [],
        busyWindows: {},
        longTasks: [
          { at: 1, dur: 22, children: [], inclusive: [], self: [] },
          { at: 1480, dur: 33, children: [], inclusive: [], self: [] }
        ]
      }
    });
    const metrics = deriveSeatMetrics(seat);
    expect(metrics.arrivalTaskMs).toBe(22);
    expect(metrics.settlementTaskMs).toBe(33);
    expect(metrics.longTaskCount).toBe(2);
  });

  test('missing playback idle yields null settlement', () => {
    const seat = makeSeat('opponent');
    const metrics = deriveSeatMetrics({ ...seat, timeline: { ...seat.timeline, playbackIdle: null } });
    expect(metrics.settlementTaskMs).toBeNull();
    expect(metrics.playbackMs).toBeNull();
  });
});

describe('measure-network-placement-freeze: buildReport / compareReports', () => {
  test('summarizes by role with nearest-rank median and p95', () => {
    const report = buildReport('unit', { lane: 'vite' }, { opening: [makeSample(0), makeSample(1), makeSample(2)] });
    expect(report.schemaVersion).toBe(REPORT_SCHEMA_VERSION);
    expect(report.scenarios.opening.sampleCount).toBe(3);
    expect(report.scenarios.opening.byRole.actor.settlementTaskMs.median).toBe(60);
    expect(report.scenarios.opening.byRole.actor.clickTaskMs.count).toBe(3);
    expect(report.scenarios.opening.byRole.opponent.clickTaskMs.count).toBe(0);
    expect(report.scenarios.opening.byRole.spectator.arrivalTaskMs.median).toBe(45);
    const markdown = renderMarkdown(report);
    expect(markdown).toContain('## opening (3 moves)');
    expect(markdown).toContain('| actor | 30 / 30 (n=3)');
  });

  test('rejects samples with another schema', () => {
    const sample = { ...makeSample(0), schemaVersion: 'other' } as unknown as MoveSample;
    expect(() => buildReport('unit', {}, { opening: [sample] })).toThrow(/unexpected sample schema/);
  });

  test('compareReports applies the median / tail rule', () => {
    const baseline = buildReport('base', {}, { opening: [makeSample(0), makeSample(1), makeSample(2)] });
    const improvedSample = (index: number): MoveSample => {
      const sample = makeSample(index);
      const black = makeSeat('actor', { longTasks: [{ at: -1, dur: 30 }, { at: 52, dur: 40 }, { at: 1500, dur: 20 }] });
      return { ...sample, seats: { ...sample.seats, black } };
    };
    const candidate = buildReport('cand', {}, { opening: [improvedSample(0), improvedSample(1), improvedSample(2)] });
    const rows = compareReports(baseline, candidate).rows;
    const settlement = rows.find((row) => row.role === 'actor' && row.metric === 'settlementTaskMs');
    expect(settlement && settlement.verdict).toBe('improved');
    const arrival = rows.find((row) => row.role === 'actor' && row.metric === 'arrivalTaskMs');
    expect(arrival && arrival.verdict).toBe('unchanged');
    const tailSample = (index: number): MoveSample => {
      const sample = makeSample(index);
      const black = makeSeat('actor', { longTasks: [{ at: -1, dur: 30 }, { at: 52, dur: 40 }, { at: 1500, dur: index === 2 ? 120 : 60 }] });
      return { ...sample, seats: { ...sample.seats, black } };
    };
    const tail = buildReport('tail', {}, { opening: [tailSample(0), tailSample(1), tailSample(2)] });
    const tailRow = compareReports(baseline, tail).rows.find((row) => row.role === 'actor' && row.metric === 'settlementTaskMs');
    expect(tailRow && tailRow.verdict).toBe('tail-only');
  });
});

describe('measure-network-placement-freeze: summarizeTraceEvents', () => {
  function makeTrace(): any[] {
    const pid = 7;
    const tid = 1;
    const base = 1_000_000;
    return [
      { ph: 'M', name: 'thread_name', pid, tid, args: { name: 'CrRendererMain' } },
      { ph: 'R', cat: 'blink.user_timing', name: 'np:click', pid, tid, ts: base },
      { ph: 'R', cat: 'blink.user_timing', name: 'np:fetch-start:/api/match/publish', pid, tid, ts: base + 8_000 },
      { ph: 'R', cat: 'blink.user_timing', name: 'np:stream-arrive', pid, tid, ts: base + 50_000 },
      { ph: 'R', cat: 'blink.user_timing', name: 'np:playback-start', pid, tid, ts: base + 90_000 },
      { ph: 'R', cat: 'blink.user_timing', name: 'np:playback-idle', pid, tid, ts: base + 1_090_000 },
      { ph: 'X', cat: 'toplevel', name: 'ThreadControllerImpl::RunTask', pid, tid, ts: base - 500, dur: 9_000 },
      { ph: 'X', cat: 'toplevel', name: 'ThreadControllerImpl::RunTask', pid, tid, ts: base + 50_000, dur: 35_000 },
      { ph: 'X', cat: 'devtools.timeline', name: 'FunctionCall', pid, tid, ts: base + 50_100, dur: 30_000, args: { data: { functionName: 'handleParsedStreamEvent' } } },
      { ph: 'X', cat: 'toplevel', name: 'ThreadControllerImpl::RunTask', pid, tid, ts: base + 1_070_000, dur: 60_000 },
      { ph: 'X', cat: 'devtools.timeline', name: 'MajorGC', pid, tid, ts: base + 500_000, dur: 12_000 },
      { ph: 'X', cat: 'toplevel', name: 'ThreadControllerImpl::RunTask', pid: 99, tid: 4, ts: base + 50_000, dur: 500_000 },
      { ph: 'P', name: 'Profile', id: '0x1', pid, tid: 9, ts: base - 1000, args: { data: { startTime: base - 1000 } } },
      {
        ph: 'P', name: 'ProfileChunk', id: '0x1', pid, tid: 9, ts: base + 60_000,
        args: {
          data: {
            cpuProfile: {
              nodes: [
                { id: 1, callFrame: { functionName: '(root)', url: '', lineNumber: 0 } },
                { id: 2, parent: 1, callFrame: { functionName: 'handleParsedStreamEvent', url: 'http://x/dist/ui/network/transport.js', lineNumber: 180 } },
                { id: 3, parent: 2, callFrame: { functionName: 'applySnapshot', url: 'http://x/dist/ui/network/snapshot.js', lineNumber: 852 } }
              ],
              samples: [3, 3, 3, 2]
            },
            timeDeltas: [52_000, 10_000, 10_000, 10_000]
          }
        }
      }
    ];
  }

  test('finds main-thread long tasks relative to the click mark with attribution and busy windows', () => {
    const summary = summarizeTraceEvents(makeTrace(), { minTaskMs: 16 });
    expect(summary.mainThread).toBe(true);
    expect(summary.profileSamples).toBe(4);
    expect(summary.marks.map((mark) => mark.name)).toEqual(['click', 'fetch-start:/api/match/publish', 'stream-arrive', 'playback-start', 'playback-idle']);
    expect(summary.longTaskCount).toBe(2);
    expect(summary.longTasks[0]).toMatchObject({ at: 1070, dur: 60 });
    expect(summary.longTasks[1]).toMatchObject({ at: 50, dur: 35 });
    expect(summary.longTasks[1].children[0]).toMatchObject({ name: 'FunctionCall', info: 'handleParsedStreamEvent' });
    expect(summary.longTasks[1].inclusive[0]).toMatch(/handleParsedStreamEvent ui\/network\/transport\.js:181/);
    expect(summary.longTasks[1].self[0]).toMatch(/applySnapshot ui\/network\/snapshot\.js:853/);
    expect(summary.busyWindows.streamArriveToPlaybackStart).toEqual({ wallMs: 40, busyMs: 35, longestMs: 35 });
    expect(summary.busyWindows.clickToPublishFetch).toEqual({ wallMs: 8, busyMs: 8, longestMs: 8 });
    expect(summary.gcMajorMinorTotalMs).toBe(12);
    expect(summary.gcTop[0]).toMatchObject({ name: 'MajorGC', at: 500 });
  });

  test('uses the first stream arrival as origin when no click mark exists', () => {
    const events = makeTrace().filter((event) => event.name !== 'np:click' && event.name !== 'np:fetch-start:/api/match/publish');
    const summary = summarizeTraceEvents(events, { minTaskMs: 16 });
    expect(summary.marks[0]).toEqual({ name: 'stream-arrive', at: 0 });
    expect(summary.longTasks.find((task) => task.dur === 35)?.at).toBe(0);
    expect(summary.busyWindows.clickToPublishFetch).toBeNull();
  });
});
