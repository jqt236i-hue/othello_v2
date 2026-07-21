import {
  CPU_WORKER_OPERATIONS,
  CPU_WORKER_PROTOCOL_VERSION,
  collectTransferableBuffers,
  parseCpuWorkerCancel,
  parseCpuWorkerRequest,
  parseCpuWorkerResponse,
  sameCpuWorkerIdentity
} from '../browser-vite/cpu-worker/protocol';
import {
  createCpuCandidateScoringBoardShape,
  createCpuCandidateScoringRequest,
  scoreCpuCandidateRequest
} from '../game/ai/cpu-candidate-scoring';
import {
  createCpuCardQuiescenceRequest,
  executeCpuCardQuiescenceRequest
} from '../game/ai/cpu-card-quiescence';

function createIdentity() {
  return {
    protocolVersion: CPU_WORKER_PROTOCOL_VERSION,
    requestId: 'cpu-1-1',
    operation: CPU_WORKER_OPERATIONS.ONNX_RUN_SESSION,
    decisionEpoch: 7,
    stateVersion: 12,
    turnNumber: 4
  } as const;
}

describe('CPU Worker protocol', () => {
  function createScoringRequest() {
    return createCpuCandidateScoringRequest({
      requestId: 'score-inner-1',
      decisionEpoch: 7,
      stateVersion: 12,
      turnNumber: 4,
      playerKey: 'white',
      level: 4,
      boardShape: createCpuCandidateScoringBoardShape(7, 7, []),
      candidateMoves: [
        { row: 2, col: 3, flips: [{ row: 3, col: 3 }] },
        { row: 4, col: 5, flips: [] }
      ]
    });
  }

  test('validates a readiness probe without any ONNX payload', () => {
    const request = parseCpuWorkerRequest({
      ...createIdentity(),
      operation: CPU_WORKER_OPERATIONS.PING,
      kind: 'request',
      payload: { probe: true }
    });
    const response = parseCpuWorkerResponse({
      ...request,
      kind: 'response',
      ok: true,
      result: { ready: true }
    });

    expect(request.payload).toEqual({ probe: true });
    expect(response.ok && response.result).toEqual({ ready: true });
  });

  test('validates a versioned inference request and preserves its authority identity', () => {
    const data = new Float32Array([1, 2, 3, 4]);
    const request = parseCpuWorkerRequest({
      ...createIdentity(),
      kind: 'request',
      payload: {
        sessionKey: 'policy-placement',
        input: { name: 'obs', type: 'float32', data, dims: [1, 4] }
      }
    });

    expect(request.payload).toMatchObject({ sessionKey: 'policy-placement' });
    expect(request.decisionEpoch).toBe(7);
    expect(request.stateVersion).toBe(12);
    expect(request.turnNumber).toBe(4);
    expect(collectTransferableBuffers(request.payload)).toEqual([data.buffer]);
  });

  test('keeps scorer identity nested while transport requestId remains independent', () => {
    const scoringRequest = createScoringRequest();
    const request = parseCpuWorkerRequest({
      ...createIdentity(),
      operation: CPU_WORKER_OPERATIONS.SCORE_CANDIDATES,
      kind: 'request',
      payload: { request: scoringRequest }
    });
    const response = parseCpuWorkerResponse({
      ...request,
      kind: 'response',
      ok: true,
      result: scoreCpuCandidateRequest(scoringRequest)
    });

    expect(request.requestId).toBe('cpu-1-1');
    expect((request.payload as any).request.requestId).toBe('score-inner-1');
    expect(response.ok && (response.result as any).requestId).toBe('score-inner-1');

    expect(() => parseCpuWorkerRequest({
      ...createIdentity(),
      operation: CPU_WORKER_OPERATIONS.SCORE_CANDIDATES,
      decisionEpoch: scoringRequest.decisionEpoch + 1,
      kind: 'request',
      payload: { request: scoringRequest }
    })).toThrow(/identity/);
  });

  test('validates card-quiescence payloads and responses with nested request identity', () => {
    const quiescenceRequest = createCpuCardQuiescenceRequest({
      requestId: 'card-quiescence:1:7',
      decisionEpoch: 7,
      stateVersion: 12,
      turnNumber: 4,
      playerKey: 'white',
      level: 6,
      playerValue: -1,
      board: Array.from({ length: 4 }, () => Array(4).fill(0)),
      legalMoves: [{ row: 0, col: 0, flips: [] }],
      search: {
        depth: 4,
        maxBranch: 4,
        nodeBudget: 120000,
        maxTimeMs: 300,
        endgameSolveEmpties: 12,
        endgameDepth: 10,
        endgameNodeBudget: 600000,
        endgameMaxTimeMs: 700
      }
    });
    const request = parseCpuWorkerRequest({
      ...createIdentity(),
      operation: CPU_WORKER_OPERATIONS.CARD_QUIESCENCE,
      kind: 'request',
      payload: { request: quiescenceRequest }
    });
    const result = executeCpuCardQuiescenceRequest(quiescenceRequest, (moves) => moves[0]);
    const response = parseCpuWorkerResponse({
      ...request,
      kind: 'response',
      ok: true,
      result
    });

    expect((request.payload as any).request.requestId).toBe('card-quiescence:1:7');
    expect(response.ok && (response.result as any).bestMove).toEqual({ row: 0, col: 0, flips: [] });
    expect(() => parseCpuWorkerRequest({
      ...createIdentity(),
      operation: CPU_WORKER_OPERATIONS.CARD_QUIESCENCE,
      decisionEpoch: 8,
      kind: 'request',
      payload: { request: quiescenceRequest }
    })).toThrow(/identity/);
  });

  test('rejects unsupported versions, relative model URLs, and mismatched tensor shapes', () => {
    expect(() => parseCpuWorkerRequest({
      ...createIdentity(),
      protocolVersion: 2,
      kind: 'request',
      payload: { sessionKey: 'x', input: { name: 'obs', type: 'float32', data: new Float32Array(1), dims: [1] } }
    })).toThrow('protocol version');

    expect(() => parseCpuWorkerRequest({
      ...createIdentity(),
      operation: CPU_WORKER_OPERATIONS.ONNX_CREATE_SESSION,
      kind: 'request',
      payload: {
        sessionKey: 'x',
        modelUrl: 'data/model.onnx',
        metaUrl: 'https://example.test/meta.json',
        wasmPathsUrl: 'https://example.test/ort/',
        executionProviders: ['wasm']
      }
    })).toThrow('absolute URL');

    expect(() => parseCpuWorkerRequest({
      ...createIdentity(),
      kind: 'request',
      payload: {
        sessionKey: 'x',
        input: { name: 'obs', type: 'float32', data: new Float32Array(3), dims: [1, 4] }
      }
    })).toThrow('shape');
  });

  test('accepts non-finite model outputs so existing selectors can ignore them candidate-by-candidate', () => {
    const response = parseCpuWorkerResponse({
      ...createIdentity(),
      kind: 'response',
      ok: true,
      result: {
        sessionKey: 'policy-placement',
        outputs: [{
          name: 'logits',
          type: 'float32',
          data: new Float32Array([Number.NaN, Number.POSITIVE_INFINITY]),
          dims: [1, 2]
        }]
      }
    });

    expect(response.ok).toBe(true);
    if (response.ok) {
      const result: any = response.result;
      expect(Number.isNaN(result.outputs[0].data[0])).toBe(true);
      expect(result.outputs[0].data[1]).toBe(Number.POSITIVE_INFINITY);
    }
  });

  test('requires exact request identity and validates cancellation envelopes', () => {
    const expected = createIdentity();
    const stale = { ...expected, decisionEpoch: expected.decisionEpoch + 1 };
    expect(sameCpuWorkerIdentity(expected, expected)).toBe(true);
    expect(sameCpuWorkerIdentity(expected, stale)).toBe(false);
    expect(parseCpuWorkerCancel({
      protocolVersion: CPU_WORKER_PROTOCOL_VERSION,
      kind: 'cancel',
      requestId: expected.requestId
    }).requestId).toBe(expected.requestId);
  });
});
