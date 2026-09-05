describe('NetworkTransportController', () => {
  let controller: any;
  let stateObj: any;
  let fetchImpl: any;
  let abortControllers: any[];

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();

    stateObj = {
      serverUrl: 'http://localhost:8787/'
    };
    fetchImpl = jest.fn();
    abortControllers = [];

    const { createNetworkTransportController } = require('../ui/network/transport.js');
    controller = createNetworkTransportController({
      getState: () => stateObj,
      withTrailingSlashRemoved: (url: any) => String(url || '').replace(/\/+$/, ''),
      scheduleTimeout: setTimeout,
      clearScheduledTimeout: clearTimeout,
      requestTimeoutMs: 1000,
      publishRetryMaxAttempts: 3,
      publishRetryBaseDelayMs: 50,
      publishRetryMaxDelayMs: 200,
      computeRetryDelayMs: (_base: any, _max: any, attempt: any) => 25 + Number(attempt || 0),
      fetchImpl,
      abortControllerClass: class MockAbortController {
        signal: any;
        aborted: boolean;
        abortListeners: any[];
        constructor() {
          this.abortListeners = [];
          this.signal = {
            aborted: false,
            addEventListener: (type: any, listener: any) => {
              if (type === 'abort' && typeof listener === 'function') {
                this.abortListeners.push(listener);
              }
            }
          };
          this.aborted = false;
          abortControllers.push(this);
        }
        abort() {
          this.aborted = true;
          this.signal.aborted = true;
          this.abortListeners.forEach((listener) => listener());
        }
      }
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('requestJson sends JSON and returns status/data shape', async () => {
    fetchImpl.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, value: 1 })
    });

    const res = await controller.requestJson('POST', '/api/match/state', { roomId: 'ABC' });

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost:8787/api/match/state',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: 'ABC' }),
        signal: expect.any(Object)
      })
    );
    expect(res).toEqual({
      ok: true,
      status: 200,
      data: { ok: true, value: 1 }
    });
  });

  test('publishRequestWithRetry retries retryable status and then succeeds', async () => {
    fetchImpl
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ ok: false, reason: 'TEMP' })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true })
      });

    const canonicalPayload = { operationId: 'op1', baseVersion: 7 };
    const promise = controller.publishRequestWithRetry(canonicalPayload);
    await Promise.resolve();
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(25);
    const res = await promise;

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(canonicalPayload).toEqual({ operationId: 'op1', baseVersion: 7 });
    for (const call of fetchImpl.mock.calls) {
      expect(JSON.parse(call[1].body)).toEqual({
        operationId: 'op1',
        baseVersion: 7,
        presentationEnvelopeVersion: 3
      });
    }
    expect(res).toEqual({
      ok: true,
      status: 200,
      data: { ok: true }
    });
  });

  test('cancelSessionReadRequests aborts an in-flight match GET', async () => {
    fetchImpl.mockImplementation((_url: any, init: any) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => {
        const error: any = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      });
    }));

    const pending = controller.requestJson(
      'GET',
      '/api/match/presentation-journal?roomId=ABC',
      undefined
    );
    const pendingResult = pending.catch((error: any) => error);
    await Promise.resolve();

    await expect(controller.cancelSessionReadRequests()).resolves.toBe(1);
    expect(abortControllers).toHaveLength(1);
    expect(abortControllers[0].aborted).toBe(true);
    await expect(pendingResult).resolves.toMatchObject({ name: 'AbortError' });
  });

  test('isMatchApiMissing returns true only for 404', () => {
    expect(controller.isMatchApiMissing({ status: 404 })).toBe(true);
    expect(controller.isMatchApiMissing({ status: 500 })).toBe(false);
    expect(controller.isMatchApiMissing(null)).toBe(false);
  });

  test('stream payload handler parses payload and updates stream markers', () => {
    const rememberStreamEventId = jest.fn();
    const markStreamActivity = jest.fn();
    const payloadHandler = jest.fn();
    const handler = controller.createStreamPayloadHandler(payloadHandler, {
      rememberStreamEventId,
      markStreamActivity
    });

    handler({ data: JSON.stringify({ ok: true, type: 'chat' }), lastEventId: 'evt-1' });

    expect(rememberStreamEventId).toHaveBeenCalled();
    expect(markStreamActivity).toHaveBeenCalled();
    expect(payloadHandler).toHaveBeenCalledWith({ ok: true, type: 'chat' });
  });
});
