'use strict';

function createNetworkTransportController(config?: any): any {
  const cfg = (config && typeof config === 'object') ? config : {};
  const getState = typeof cfg.getState === 'function' ? cfg.getState : function () { return null; };
  const withTrailingSlashRemoved = typeof cfg.withTrailingSlashRemoved === 'function'
    ? cfg.withTrailingSlashRemoved
    : function (url: any) { return String(url || '').replace(/\/+$/, ''); };
  const scheduleTimeout = typeof cfg.scheduleTimeout === 'function'
    ? cfg.scheduleTimeout
    : function (fn: any, ms: number) { return setTimeout(fn, ms); };
  const clearScheduledTimeout = typeof cfg.clearScheduledTimeout === 'function'
    ? cfg.clearScheduledTimeout
    : function (id: any) { clearTimeout(id); };
  const requestTimeoutMs = Number.isFinite(Number(cfg.requestTimeoutMs))
    ? Math.max(1, Math.trunc(Number(cfg.requestTimeoutMs)))
    : 10000;
  const publishRetryMaxAttempts = Number.isFinite(Number(cfg.publishRetryMaxAttempts))
    ? Math.max(1, Math.trunc(Number(cfg.publishRetryMaxAttempts)))
    : 3;
  const publishRetryBaseDelayMs = Number.isFinite(Number(cfg.publishRetryBaseDelayMs))
    ? Math.max(1, Math.trunc(Number(cfg.publishRetryBaseDelayMs)))
    : 400;
  const publishRetryMaxDelayMs = Number.isFinite(Number(cfg.publishRetryMaxDelayMs))
    ? Math.max(publishRetryBaseDelayMs, Math.trunc(Number(cfg.publishRetryMaxDelayMs)))
    : 4000;
  const activeSessionReadRequests = new Map<any, any>();

  function readState(): any {
    const state = getState();
    if (!state || typeof state !== 'object') {
      throw new Error('network_transport_state_required');
    }
    return state;
  }

  function getFetchImpl(): any {
    if (typeof cfg.fetchImpl === 'function') return cfg.fetchImpl;
    if (typeof fetch === 'function') return fetch;
    throw new Error('fetch_unavailable');
  }

  function getAbortControllerClass(): any {
    if (typeof cfg.abortControllerClass === 'function') return cfg.abortControllerClass;
    if (typeof AbortController === 'function') return AbortController;
    try {
      if (typeof globalThis !== 'undefined' && typeof (globalThis as any).AbortController === 'function') {
        return (globalThis as any).AbortController;
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  function waitForMs(ms: any): Promise<void> {
    const waitMs = Number.isFinite(Number(ms)) ? Math.max(0, Math.trunc(Number(ms))) : 0;
    return new Promise(function (resolve) {
      scheduleTimeout(resolve, waitMs);
    });
  }

  async function requestJson(method: any, path: any, payload: any): Promise<any> {
    const state = readState();
    const url = withTrailingSlashRemoved(state.serverUrl) + String(path || '');
    const sessionReadRequest = String(method || '').trim().toUpperCase() === 'GET'
      && String(path || '').startsWith('/api/match/');
    const init: any = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (payload !== undefined) {
      init.body = JSON.stringify(payload);
    }

    let timeoutId = 0;
    let controller: any = null;
    try {
      const AbortControllerClass = getAbortControllerClass();
      if (typeof AbortControllerClass === 'function') {
        controller = new AbortControllerClass();
        init.signal = controller.signal;
        if (sessionReadRequest) {
          let resolveSettled: any = null;
          const settled = new Promise<void>(function (resolve) {
            resolveSettled = resolve;
          });
          activeSessionReadRequests.set(controller, {
            settled,
            resolveSettled
          });
        }
        timeoutId = scheduleTimeout(function () {
          try { controller.abort(); } catch (e) { /* ignore */ }
        }, requestTimeoutMs);
      }
    } catch (e) { /* ignore */ }

    try {
      const response = await getFetchImpl()(url, init);
      const data = await response.json().catch(function () { return {}; });
      return { ok: response.ok, status: response.status, data };
    } finally {
      if (controller && sessionReadRequest) {
        const activeRequest = activeSessionReadRequests.get(controller);
        activeSessionReadRequests.delete(controller);
        if (activeRequest && typeof activeRequest.resolveSettled === 'function') {
          activeRequest.resolveSettled();
        }
      }
      if (timeoutId) {
        clearScheduledTimeout(timeoutId);
      }
    }
  }

  async function cancelSessionReadRequests(): Promise<number> {
    const activeRequests = Array.from(activeSessionReadRequests.entries());
    activeRequests.forEach(function (entry: any) {
      const controller = entry[0];
      try { controller.abort(); } catch (e) { /* ignore */ }
    });
    await Promise.allSettled(activeRequests.map(function (entry: any) {
      return entry[1].settled;
    }));
    return activeRequests.length;
  }

  function isMatchApiMissing(res: any): boolean {
    return !!(res && Number(res.status) === 404);
  }

  function isRetryablePublishStatus(status: any): boolean {
    const code = Number(status);
    return code === 408 || code === 429 || code === 500 || code === 502 || code === 503 || code === 504;
  }

  async function publishRequestWithRetry(payload: any): Promise<any> {
    let lastError: any = null;
    for (let attempt = 0; attempt < publishRetryMaxAttempts; attempt += 1) {
      try {
        const res = await requestJson('POST', '/api/match/publish', payload);
        if (!isRetryablePublishStatus(res && res.status) || attempt >= (publishRetryMaxAttempts - 1)) {
          return res;
        }
      } catch (e: any) {
        lastError = e;
        if (attempt >= (publishRetryMaxAttempts - 1)) {
          throw e;
        }
      }

      const delayMs = typeof cfg.computeRetryDelayMs === 'function'
        ? cfg.computeRetryDelayMs(publishRetryBaseDelayMs, publishRetryMaxDelayMs, attempt)
        : publishRetryBaseDelayMs;
      await waitForMs(delayMs);
    }

    throw (lastError || new Error('PUBLISH_RETRY_EXHAUSTED'));
  }

  function parseStreamEventPayload(event: any): any {
    try {
      return JSON.parse((event && event.data) || '{}');
    } catch (e) {
      return null;
    }
  }

  function createStreamPayloadHandler(payloadHandler: any, options?: any): any {
    const opts = (options && typeof options === 'object') ? options : {};
    return function handleParsedStreamEvent(event: any) {
      const payload = parseStreamEventPayload(event);
      if (!payload) return;
      if (typeof opts.rememberStreamEventId === 'function') {
        opts.rememberStreamEventId(event);
      }
      if (typeof opts.markStreamActivity === 'function') {
        opts.markStreamActivity();
      }
      payloadHandler(payload);
    };
  }

  return {
    requestJson,
    cancelSessionReadRequests,
    isMatchApiMissing,
    publishRequestWithRetry,
    parseStreamEventPayload,
    createStreamPayloadHandler
  };
}

const NetworkTransportModule = {
  createNetworkTransportController
};

export = NetworkTransportModule;
