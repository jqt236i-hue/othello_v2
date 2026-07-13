const {
  evaluateOnnxWorkerSmoke,
  evaluateOnnxWorkerFallbackSmoke
} = require('../scripts/browser-onnx-worker-smoke');

function probe(lane: 'classic' | 'vite' | 'vite-worker-fallback', overrides: Record<string, unknown> = {}) {
  const fallback = lane === 'vite-worker-fallback';
  return Object.assign({
    lane,
    digest: 'same',
    outputLength: 100,
    selectedMove: { row: 2, col: 3 },
    candidateScoreDigest: 'candidate-same',
    candidateScoreCount: 3,
    candidateWorkerUsed: lane === 'vite',
    candidateScoringInjected: lane === 'vite' ? true : (fallback ? false : null),
    windowOrt: lane === 'classic' || fallback,
    workerExecutor: lane === 'vite',
    mainThreadOrtScripts: lane === 'classic' || fallback ? 1 : 0,
    startupWorkerRequests: [],
    startupOrtRequests: [],
    scoringWorkerRequests: lane === 'vite' ? ['worker-entry.js'] : [],
    scoringOrtRequests: [],
    scoringClientStatus: lane === 'vite' ? { workerCreatedCount: 1, pendingRequests: 0 } : null,
    workerRequests: lane === 'vite' ? ['worker-entry.js'] : [],
    ortRequests: lane === 'vite' ? ['ort.min.js'] : ['ort.min.js'],
    clientStatus: lane === 'vite' ? { workerCreatedCount: 1, pendingRequests: 0 } : null,
    pageErrors: [],
    consoleErrors: [],
    resourceErrors: []
  }, overrides);
}

describe('browser ONNX Worker smoke evaluation', () => {
  test('accepts an exact classic/Vite inference match with no main-thread Vite ORT', () => {
    expect(evaluateOnnxWorkerSmoke(probe('classic'), probe('vite'))).toEqual([]);
  });

  test('reports result drift and main-thread ORT regression', () => {
    const errors = evaluateOnnxWorkerSmoke(
      probe('classic'),
      probe('vite', { digest: 'different', windowOrt: true, mainThreadOrtScripts: 1 })
    );
    expect(errors).toContain('classic/Vite ONNX output digest mismatch');
    expect(errors).toContain('Vite lane exposed ORT on the main thread');
    expect(errors).toContain('Vite lane appended a main-thread ORT script');
  });

  test('accepts exact in-thread fallback when Worker construction is blocked', () => {
    expect(evaluateOnnxWorkerFallbackSmoke(
      probe('classic'),
      probe('vite-worker-fallback')
    )).toEqual([]);
  });
});
