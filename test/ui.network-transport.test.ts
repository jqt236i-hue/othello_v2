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

  test('selects WebSocket only for an advertised server and falls back for older servers', async () => {
    fetchImpl.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}),
      headers: new Headers({ 'X-Match-Stream-Transport': 'websocket' }) });
    await controller.requestJson('POST', '/api/match/create', {});
    expect(stateObj.streamTransport).toBe('websocket');
    fetchImpl.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });
    await controller.requestJson('GET', '/api/match/state');
    expect(stateObj.streamTransport).toBe('sse');
  });

  test('a late response from a previous server cannot change transport selection', async () => {
    let resolveResponse: any;
    fetchImpl.mockImplementation(() => new Promise(resolve => { resolveResponse = resolve; }));
    const pending = controller.requestJson('GET', '/api/match/state');
    stateObj.serverUrl = 'https://new-server.example';
    stateObj.streamTransport = 'sse';
    resolveResponse({ ok: true, status: 200, json: async () => ({}),
      headers: new Headers({ 'X-Match-Stream-Transport': 'websocket' }) });
    await pending;
    expect(stateObj.streamTransport).toBe('sse');
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

  function retryableResponse() {
    return { ok: false, status: 503, json: async () => ({ ok: false, reason: 'TEMP' }) };
  }

  test('publish retries stay on the server the operation started with', async () => {
    fetchImpl
      .mockResolvedValueOnce(retryableResponse())
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true }) });

    const promise = controller.publishRequestWithRetry({ operationId: 'op-pinned' });
    await Promise.resolve();
    stateObj.serverUrl = 'https://other-server.example';
    await jest.advanceTimersByTimeAsync(25);
    await promise;

    expect(fetchImpl.mock.calls.map((call: any) => call[0])).toEqual([
      'http://localhost:8787/api/match/publish',
      'http://localhost:8787/api/match/publish'
    ]);
  });

  test('a server switch during the retry wait sends nothing to either server', async () => {
    fetchImpl.mockResolvedValue(retryableResponse());
    const requestServerUrl = stateObj.serverUrl;
    const context = {
      serverUrl: requestServerUrl,
      isCurrent: () => stateObj.serverUrl === requestServerUrl
    };

    const promise = controller.publishRequestWithRetry({ operationId: 'op-switch', roomId: 'ABC' }, context);
    await Promise.resolve();
    await Promise.resolve();
    stateObj.serverUrl = 'https://server-b.example';
    await jest.advanceTimersByTimeAsync(1000);
    const res = await promise;

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe('http://localhost:8787/api/match/publish');
    expect(res).toEqual(expect.objectContaining({ ok: false, cancelled: true, reason: 'SESSION_CHANGED' }));
  });

  test('a transient failure in the same session is retried with the same operationId', async () => {
    fetchImpl
      .mockResolvedValueOnce(retryableResponse())
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true }) });
    const context = { serverUrl: stateObj.serverUrl, isCurrent: () => true };

    const promise = controller.publishRequestWithRetry({ operationId: 'op-same', baseVersion: 3 }, context);
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(25);
    const res = await promise;

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls.map((call: any) => JSON.parse(call[1].body).operationId)).toEqual(['op-same', 'op-same']);
    expect(res).toEqual(expect.objectContaining({ ok: true, status: 200 }));
  });

  test('cancelPendingPublishRetries stops an unsent retry immediately', async () => {
    fetchImpl.mockResolvedValue(retryableResponse());

    const promise = controller.publishRequestWithRetry({ operationId: 'op-leave' }, { isCurrent: () => true });
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
    expect(controller.cancelPendingPublishRetries()).toBe(1);
    const res = await promise;
    await jest.advanceTimersByTimeAsync(1000);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(res).toEqual(expect.objectContaining({ cancelled: true }));
  });

  test('timeouts are retried but a cancelled request is not', async () => {
    const hangingFetch = (_url: any, init: any) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => {
        const error: any = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      });
    });
    fetchImpl
      .mockImplementationOnce(hangingFetch)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true }) });

    const publish = controller.publishRequestWithRetry({ operationId: 'op-timeout' }, { isCurrent: () => true });
    await jest.advanceTimersByTimeAsync(1000);
    await jest.advanceTimersByTimeAsync(25);
    await expect(publish).resolves.toEqual(expect.objectContaining({ ok: true }));
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    fetchImpl.mockReset();
    fetchImpl.mockImplementation(hangingFetch);
    const read = controller.requestJson('GET', '/api/match/state?roomId=ABC').catch((error: any) => error);
    await Promise.resolve();
    await controller.cancelSessionReadRequests();
    await expect(read).resolves.toMatchObject({ name: 'AbortError', cancelled: true, timedOut: false, code: 'REQUEST_CANCELLED' });

    const timedOutRead = controller.requestJson('GET', '/api/match/state?roomId=ABC').catch((error: any) => error);
    await jest.advanceTimersByTimeAsync(1000);
    await expect(timedOutRead).resolves.toMatchObject({ name: 'AbortError', cancelled: false, timedOut: true, code: 'REQUEST_TIMEOUT' });
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
