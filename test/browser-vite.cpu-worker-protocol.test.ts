import {
  CPU_WORKER_OPERATIONS,
  CPU_WORKER_PROTOCOL_VERSION,
  collectTransferableBuffers,
  parseCpuWorkerCancel,
  parseCpuWorkerRequest,
  parseCpuWorkerResponse,
  sameCpuWorkerIdentity
} from '../browser-vite/cpu-worker/protocol';

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
