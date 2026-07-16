const Check = require('../scripts/playback-board-writer-browser-check');

function record(label: string, options: any = {}): any {
  return {
    label,
    cell: { hasCell: true, hasStone: options.hasStone !== false, owner: 'white' },
    writerMode: options.writerMode || 'playback',
    visualDigest: options.visualDigest || 'initial',
    backendDiagnostics: options.backendDiagnostics || null
  };
}

function goodEvidence(backend: 'dom' | 'pixi'): any {
  const finalDiagnostics = backend === 'pixi' ? {
    tickerRunning: false,
    timeline: { tickerRunning: false, activeRunCount: 0 },
    playback: { inFlightEffectCount: 0 },
    pool: { activePlaybackGhostCount: 0, activePlaybackHighlightLeaseCount: 0 }
  } : null;
  return {
    backend,
    observedBackend: backend,
    records: [
      record('initial-settled', { writerMode: 'idle' }),
      record('during-direct-render'),
      record('during-scheduler-render'),
      record('final-settled', {
        hasStone: false,
        writerMode: 'idle',
        visualDigest: 'final',
        backendDiagnostics: finalDiagnostics
      })
    ],
    consoleErrors: [],
    pageErrors: []
  };
}

describe('playback board writer browser check evaluator', () => {
  test.each(['dom', 'pixi'] as const)('accepts explicit %s writer coalescing and settlement', (backend) => {
    expect(Check.evaluateWriterLaneEvidence(goodEvidence(backend))).toEqual({ ok: true, errors: [] });
  });

  test('rejects early final exposure, retained final stone, and active Pixi resources', () => {
    const evidence = goodEvidence('pixi');
    evidence.records[1].cell.hasStone = false;
    evidence.records[2].visualDigest = 'changed-early';
    evidence.records[3].cell.hasStone = true;
    evidence.records[3].backendDiagnostics.tickerRunning = true;
    evidence.records[3].backendDiagnostics.pool.activePlaybackGhostCount = 1;
    const result = Check.evaluateWriterLaneEvidence(evidence);
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.stringMatching(/exposed the canonical final cell early/),
      expect.stringMatching(/changed the settled visual digest/),
      expect.stringMatching(/retained the removed stone/),
      expect.stringMatching(/private ticker remained active/),
      expect.stringMatching(/projection resources remained active/)
    ]));
  });
});
