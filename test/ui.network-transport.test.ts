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
        constructor() {
          this.signal = { aborted: false };
          this.aborted = false;
          abortControllers.push(this);
        }
        abort() {
          this.aborted = true;
          this.signal.aborted = true;
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

    const promise = controller.publishRequestWithRetry({ operationId: 'op1' });
    await Promise.resolve();
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(25);
    const res = await promise;

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(res).toEqual({
      ok: true,
      status: 200,
      data: { ok: true }
    });
  });

  test('cancelSessionReadRequests aborts an in-flight match GET', async () => {
    let resolveRead: any;
    fetchImpl.mockReturnValue(new Promise((resolve) => {
      resolveRead = resolve;
    }));

    const pending = controller.requestJson(
      'GET',
      '/api/match/presentation-journal?roomId=ABC',
      undefined
    );
    await Promise.resolve();

    expect(controller.cancelSessionReadRequests()).toBe(1);
    expect(abortControllers).toHaveLength(1);
    expect(abortControllers[0].aborted).toBe(true);

    resolveRead({
      ok: true,
      status: 200,
      json: async () => ({ ok: true })
    });
    await expect(pending).resolves.toEqual({
      ok: true,
      status: 200,
      data: { ok: true }
    });
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
