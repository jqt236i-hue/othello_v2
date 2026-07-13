import {
  CpuCandidateWorkerScorer,
  CpuWorkerClient,
  CpuWorkerClientError,
  OnnxWorkerInferenceExecutor,
  type CpuWorkerTransport
} from '../browser-vite/cpu-worker/client';
import {
  CPU_WORKER_OPERATIONS,
  CPU_WORKER_PROTOCOL_VERSION,
  type CpuWorkerRequest
} from '../browser-vite/cpu-worker/protocol';
import {
  createCpuCandidateScoringBoardShape,
  createCpuCandidateScoringRequest,
  scoreCpuCandidateRequest
} from '../game/ai/cpu-candidate-scoring';

class FakeWorker implements CpuWorkerTransport {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;
  readonly messages: Array<{ message: any; transfer?: Transferable[] }> = [];
  terminated = false;

  postMessage(message: unknown, transfer?: Transferable[]): void {
    this.messages.push({ message, transfer });
  }

  terminate(): void {
    this.terminated = true;
  }

  emit(data: unknown): void {
    this.onmessage?.({ data } as MessageEvent);
  }

  crash(message = 'boom'): void {
    this.onerror?.({ message, error: new Error(message) } as ErrorEvent);
  }
}

function createSessionPayload() {
  return {
    sessionKey: 'policy-placement',
    modelUrl: 'https://example.test/data/model.onnx',
    metaUrl: 'https://example.test/data/model.meta.json',
    wasmPathsUrl: 'https://example.test/node_modules/onnxruntime-web/dist/',
    executionProviders: ['wasm']
  };
}

function successFor(request: CpuWorkerRequest, result: unknown) {
  return {
    protocolVersion: CPU_WORKER_PROTOCOL_VERSION,
    kind: 'response',
    ok: true,
    requestId: request.requestId,
    operation: request.operation,
    decisionEpoch: request.decisionEpoch,
    stateVersion: request.stateVersion,
    turnNumber: request.turnNumber,
    result
  };
}

function createScoringRequest(overrides: Record<string, unknown> = {}) {
  return createCpuCandidateScoringRequest({
    requestId: 'client-score-1',
    decisionEpoch: 7,
    stateVersion: 13,
    turnNumber: 5,
    playerKey: 'white',
    level: 4,
    boardShape: createCpuCandidateScoringBoardShape(7, 7, []),
    candidateMoves: [
      { row: 2, col: 3, flips: [{ row: 3, col: 3 }] },
      { row: 4, col: 5, flips: [] }
    ],
    ...overrides
  } as any);
}

describe('CpuWorkerClient', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test('creates the Worker lazily and resolves only an exact matching response', async () => {
    const worker = new FakeWorker();
    const factory = jest.fn(() => worker);
    const client = new CpuWorkerClient({ workerFactory: factory });
    expect(factory).not.toHaveBeenCalled();

    const pending = client.request(CPU_WORKER_OPERATIONS.ONNX_CREATE_SESSION, createSessionPayload());
    expect(factory).toHaveBeenCalledTimes(1);
    const request = worker.messages[0].message as CpuWorkerRequest;
    worker.emit(successFor(request, {
      sessionKey: 'policy-placement',
      inputNames: ['obs'],
      outputNames: ['logits'],
      meta: { inputName: 'obs' },
      executionProviders: ['wasm']
    }));

    await expect(pending).resolves.toMatchObject({ sessionKey: 'policy-placement' });
    expect(client.getStatus()).toMatchObject({ pendingRequests: 0, workerCreatedCount: 1, requestCount: 1 });
  });

  test('probes Worker readiness without creating an ONNX session', async () => {
    const worker = new FakeWorker();
    const client = new CpuWorkerClient({ workerFactory: () => worker });
    const pending = client.probe();
    const request = worker.messages[0].message as CpuWorkerRequest;
    expect(request.operation).toBe(CPU_WORKER_OPERATIONS.PING);
    worker.emit(successFor(request, { ready: true }));

    await expect(pending).resolves.toBe(true);
    expect(client.getStatus()).toMatchObject({ workerCreatedCount: 1, requestCount: 1 });
  });

  test('binds browser timer functions to the global object before starting a request', async () => {
    const worker = new FakeWorker();
    const setTimeoutFn = jest.fn(function browserSetTimeout(this: unknown, handler: TimerHandler) {
      if (this !== globalThis) throw new TypeError('Illegal invocation');
      return setTimeout(handler, 1000);
    }) as unknown as typeof setTimeout;
    const clearTimeoutFn = jest.fn(function browserClearTimeout(this: unknown, timeoutId: any) {
      if (this !== globalThis) throw new TypeError('Illegal invocation');
      clearTimeout(timeoutId);
    }) as unknown as typeof clearTimeout;
    const client = new CpuWorkerClient({ workerFactory: () => worker, setTimeoutFn, clearTimeoutFn });
    const pending = client.request(CPU_WORKER_OPERATIONS.ONNX_CREATE_SESSION, createSessionPayload());
    const request = worker.messages[0].message as CpuWorkerRequest;
    worker.emit(successFor(request, {
      sessionKey: 'policy-placement',
      inputNames: ['obs'],
      outputNames: ['logits'],
      meta: null,
      executionProviders: ['wasm']
    }));

    await expect(pending).resolves.toBeTruthy();
    expect(setTimeoutFn).toHaveBeenCalledTimes(1);
    expect(clearTimeoutFn).toHaveBeenCalledTimes(1);
    expect(client.getStatus().pendingRequests).toBe(0);
  });

  test('cancels with AbortSignal and ignores a late response for that request', async () => {
    const worker = new FakeWorker();
    const client = new CpuWorkerClient({ workerFactory: () => worker });
    const controller = new AbortController();
    const pending = client.request(
      CPU_WORKER_OPERATIONS.ONNX_CREATE_SESSION,
      createSessionPayload(),
      { signal: controller.signal }
    );
    const request = worker.messages[0].message as CpuWorkerRequest;
    controller.abort();

    await expect(pending).rejects.toMatchObject({ code: 'CPU_WORKER_CANCELLED' });
    expect(worker.messages[1].message).toEqual({
      protocolVersion: CPU_WORKER_PROTOCOL_VERSION,
      kind: 'cancel',
      requestId: request.requestId
    });
    worker.emit(successFor(request, {
      sessionKey: 'policy-placement',
      inputNames: ['obs'],
      outputNames: ['logits'],
      meta: null,
      executionProviders: ['wasm']
    }));
    expect(worker.terminated).toBe(false);
    expect(client.getStatus().pendingRequests).toBe(0);
  });

  test('terminates a timed-out Worker and recreates it on the next request', async () => {
    jest.useFakeTimers();
    const workers: FakeWorker[] = [];
    const client = new CpuWorkerClient({
      workerFactory: () => {
        const worker = new FakeWorker();
        workers.push(worker);
        return worker;
      },
      defaultTimeoutMs: 10
    });
    const first = client.request(CPU_WORKER_OPERATIONS.ONNX_CREATE_SESSION, createSessionPayload());
    const expectation = expect(first).rejects.toMatchObject({ code: 'CPU_WORKER_TIMEOUT' });
    jest.advanceTimersByTime(11);
    await expectation;
    expect(workers[0].terminated).toBe(true);

    const second = client.request(CPU_WORKER_OPERATIONS.ONNX_CREATE_SESSION, createSessionPayload());
    expect(workers).toHaveLength(2);
    const request = workers[1].messages[0].message as CpuWorkerRequest;
    workers[1].emit(successFor(request, {
      sessionKey: 'policy-placement',
      inputNames: ['obs'],
      outputNames: ['logits'],
      meta: null,
      executionProviders: ['wasm']
    }));
    await expect(second).resolves.toBeTruthy();
    expect(client.getStatus()).toMatchObject({ workerCreatedCount: 2, restartCount: 1 });
  });

  test('rejects mismatched authority metadata and restarts after a crash', async () => {
    const workers: FakeWorker[] = [];
    const client = new CpuWorkerClient({ workerFactory: () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    } });
    const pending = client.request(
      CPU_WORKER_OPERATIONS.ONNX_CREATE_SESSION,
      createSessionPayload(),
      { decisionEpoch: 9, stateVersion: 3, turnNumber: 2 }
    );
    const request = workers[0].messages[0].message as CpuWorkerRequest;
    workers[0].emit({
      ...successFor(request, {
        sessionKey: 'policy-placement',
        inputNames: ['obs'],
        outputNames: ['logits'],
        meta: null,
        executionProviders: ['wasm']
      }),
      turnNumber: 3
    });

    await expect(pending).rejects.toThrow('stale or mismatched');
    expect(workers[0].terminated).toBe(true);
    expect(client.getStatus().workerActive).toBe(false);
  });

  test('reports unsupported Worker creation without pretending the request succeeded', async () => {
    const client = new CpuWorkerClient({
      workerFactory: () => { throw new Error('Worker is blocked'); }
    });
    await expect(client.request(
      CPU_WORKER_OPERATIONS.ONNX_RELEASE_SESSION,
      { sessionKey: 'x' }
    )).rejects.toMatchObject({ code: 'CPU_WORKER_UNAVAILABLE' });
    expect(client.getStatus()).toMatchObject({ workerActive: false, workerCreatedCount: 0 });
  });
});

class AutoWorker extends FakeWorker {
  override postMessage(message: unknown, transfer?: Transferable[]): void {
    super.postMessage(message, transfer);
    const request = message as CpuWorkerRequest;
    if (!request || request.kind !== 'request') return;
    queueMicrotask(() => {
      if (request.operation === CPU_WORKER_OPERATIONS.PING) {
        this.emit(successFor(request, { ready: true }));
      } else if (request.operation === CPU_WORKER_OPERATIONS.SCORE_CANDIDATES) {
        this.emit(successFor(request, scoreCpuCandidateRequest((request.payload as any).request)));
      } else if (request.operation === CPU_WORKER_OPERATIONS.ONNX_CREATE_SESSION) {
        this.emit(successFor(request, {
          sessionKey: (request.payload as any).sessionKey,
          inputNames: ['obs'],
          outputNames: ['logits'],
          meta: { inputName: 'obs', outputName: 'logits' },
          executionProviders: ['wasm']
        }));
      } else if (request.operation === CPU_WORKER_OPERATIONS.ONNX_RUN_SESSION) {
        this.emit(successFor(request, {
          sessionKey: (request.payload as any).sessionKey,
          outputs: [{ name: 'logits', type: 'float32', data: new Float32Array([0.25]), dims: [1] }]
        }));
      } else {
        this.emit(successFor(request, { sessionKey: (request.payload as any).sessionKey, released: true }));
      }
    });
  }
}

describe('CpuCandidateWorkerScorer', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test('round-trips canonical scores and preserves one explicit gameplay epoch after a probe', async () => {
    const worker = new AutoWorker();
    const client = new CpuWorkerClient({ workerFactory: () => worker });
    const scorer = new CpuCandidateWorkerScorer({ client });
    const request = createScoringRequest();

    await expect(client.probe()).resolves.toBe(true);
    await expect(scorer.score(request)).resolves.toEqual({
      request,
      response: scoreCpuCandidateRequest(request)
    });
    await expect(scorer.score(request)).resolves.toBeTruthy();

    const scoreRequests = worker.messages
      .map((entry) => entry.message as CpuWorkerRequest)
      .filter((entry) => entry.operation === CPU_WORKER_OPERATIONS.SCORE_CANDIDATES);
    expect(scoreRequests).toHaveLength(2);
    expect(scoreRequests.map((entry) => entry.decisionEpoch)).toEqual([7, 7]);
    expect(scoreRequests.map((entry) => entry.requestId)).not.toEqual([
      request.requestId,
      request.requestId
    ]);
  });

  test('uses cancel-only timeout, ignores the late score, and preserves the shared Worker', async () => {
    jest.useFakeTimers();
    const worker = new FakeWorker();
    const client = new CpuWorkerClient({ workerFactory: () => worker });
    const scorer = new CpuCandidateWorkerScorer({ client, timeoutMs: 10 });
    const scoringRequest = createScoringRequest();
    const pending = scorer.score(scoringRequest);
    const scoreEnvelope = worker.messages[0].message as CpuWorkerRequest;

    const expectation = expect(pending).rejects.toMatchObject({ code: 'CPU_WORKER_SCORE_TIMEOUT' });
    jest.advanceTimersByTime(11);
    await expectation;

    expect(worker.terminated).toBe(false);
    expect(worker.messages[1].message).toMatchObject({ kind: 'cancel', requestId: scoreEnvelope.requestId });
    worker.emit(successFor(scoreEnvelope, scoreCpuCandidateRequest(scoringRequest)));

    const probe = client.probe();
    const probeEnvelope = worker.messages[2].message as CpuWorkerRequest;
    worker.emit(successFor(probeEnvelope, { ready: true }));
    await expect(probe).resolves.toBe(true);
    expect(client.getStatus()).toMatchObject({ workerActive: true, workerCreatedCount: 1 });
  });

  test('invalidates a Worker that returns a structurally valid score for another request', async () => {
    const worker = new FakeWorker();
    const client = new CpuWorkerClient({ workerFactory: () => worker });
    const scorer = new CpuCandidateWorkerScorer({ client });
    const scoringRequest = createScoringRequest();
    const pending = scorer.score(scoringRequest);
    const scoreEnvelope = worker.messages[0].message as CpuWorkerRequest;
    const mismatched = {
      ...scoreCpuCandidateRequest(scoringRequest),
      requestId: 'different-inner-request'
    };
    worker.emit(successFor(scoreEnvelope, mismatched));

    await expect(pending).rejects.toMatchObject({ code: 'CPU_WORKER_PROTOCOL_ERROR', recoverable: false });
    expect(worker.terminated).toBe(true);
    expect(client.getStatus()).toMatchObject({ workerActive: false, restartCount: 1 });
  });
});

describe('OnnxWorkerInferenceExecutor recovery', () => {
  test('can constrain browser Worker inference to the deployable WASM provider', async () => {
    const worker = new AutoWorker();
    const client = new CpuWorkerClient({ workerFactory: () => worker });
    const executor = new OnnxWorkerInferenceExecutor({
      client,
      baseUrl: 'https://example.test/game/',
      wasmPathsUrl: 'https://example.test/node_modules/onnxruntime-web/dist/',
      allowedExecutionProviders: ['wasm']
    });

    await executor.createSession({
      sessionKey: 'policy-placement',
      modelUrl: '../data/model.onnx',
      metaUrl: '../data/model.meta.json',
      executionProviders: ['webgpu', 'wasm']
    });

    const request = worker.messages[0].message as CpuWorkerRequest;
    expect((request.payload as any).executionProviders).toEqual(['wasm']);
  });

  test('rehydrates its session recipe after a Worker crash before running inference', async () => {
    const workers: AutoWorker[] = [];
    const client = new CpuWorkerClient({ workerFactory: () => {
      const worker = new AutoWorker();
      workers.push(worker);
      return worker;
    } });
    const executor = new OnnxWorkerInferenceExecutor({
      client,
      baseUrl: 'https://example.test/game/',
      wasmPathsUrl: 'https://example.test/node_modules/onnxruntime-web/dist/'
    });
    const session = await executor.createSession({
      sessionKey: 'policy-placement',
      modelUrl: '../data/model.onnx',
      metaUrl: '../data/model.meta.json',
      executionProviders: ['wasm']
    });
    expect(workers).toHaveLength(1);
    workers[0].crash('simulated crash');

    const outputs = await executor.runSession({
      session,
      inputName: 'obs',
      type: 'float32',
      data: new Float32Array([1, 2]),
      dims: [1, 2]
    });

    expect(workers).toHaveLength(2);
    const operations = workers.flatMap((worker) => worker.messages)
      .map((entry) => entry.message.operation)
      .filter(Boolean);
    expect(operations).toEqual([
      CPU_WORKER_OPERATIONS.ONNX_CREATE_SESSION,
      CPU_WORKER_OPERATIONS.ONNX_CREATE_SESSION,
      CPU_WORKER_OPERATIONS.ONNX_RUN_SESSION
    ]);
    expect((outputs.logits.data as Float32Array)[0]).toBeCloseTo(0.25);
    expect(client.getStatus()).toMatchObject({ workerCreatedCount: 2, restartCount: 1 });
  });
});
