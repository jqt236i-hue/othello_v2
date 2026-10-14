'use strict';

const PresentationEnvelopeContract = require('../../shared/network-presentation-envelope');

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

  const pendingPublishRetryWaits = new Set<() => void>();

  // Resolves 'elapsed' after the delay, or 'cancelled' as soon as cancelPendingPublishRetries() runs.
  function waitForPublishRetry(ms: any): Promise<'elapsed' | 'cancelled'> {
    const waitMs = Number.isFinite(Number(ms)) ? Math.max(0, Math.trunc(Number(ms))) : 0;
    return new Promise(function (resolve) {
      let settled = false;
      let timeoutId: any = 0;
      const finish = function (outcome: 'elapsed' | 'cancelled') {
        if (settled) return;
        settled = true;
        pendingPublishRetryWaits.delete(cancel);
        if (outcome === 'cancelled' && timeoutId) clearScheduledTimeout(timeoutId);
        resolve(outcome);
      };
      const cancel = function () { finish('cancelled'); };
      pendingPublishRetryWaits.add(cancel);
      timeoutId = scheduleTimeout(function () { finish('elapsed'); }, waitMs);
    });
  }

  // Stops every publish retry that has not been sent yet (leave / session switch). A request that is
  // already in flight is not aborted: it may have reached the authority, so it is never reported as undone.
  function cancelPendingPublishRetries(): number {
    const waits = Array.from(pendingPublishRetryWaits);
    waits.forEach(function (cancel) { cancel(); });
    return waits.length;
  }

  function createRequestAbortError(reason: 'timeout' | 'cancelled', cause: any): any {
    const error: any = new Error(reason === 'timeout' ? 'REQUEST_TIMEOUT' : 'REQUEST_CANCELLED');
    // Keep the platform name so existing abort handling still recognises it.
    error.name = 'AbortError';
    error.code = reason === 'timeout' ? 'REQUEST_TIMEOUT' : 'REQUEST_CANCELLED';
    error.timedOut = reason === 'timeout';
    error.cancelled = reason === 'cancelled';
    error.cause = cause;
    return error;
  }

  async function requestJson(method: any, path: any, payload: any, options?: any): Promise<any> {
    const state = readState();
    const requestOptions = (options && typeof options === 'object') ? options : {};
    const requestServerUrl = requestOptions.serverUrl !== undefined ? requestOptions.serverUrl : state.serverUrl;
    const url = withTrailingSlashRemoved(requestServerUrl) + String(path || '');
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
    let abortReason: 'timeout' | 'cancelled' | null = null;
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
            resolveSettled,
            cancel: function () {
              if (!abortReason) abortReason = 'cancelled';
              try { controller.abort(); } catch (e) { /* ignore */ }
            }
          });
        }
        timeoutId = scheduleTimeout(function () {
          if (!abortReason) abortReason = 'timeout';
          try { controller.abort(); } catch (e) { /* ignore */ }
        }, requestTimeoutMs);
      }
    } catch (e) { /* ignore */ }

    try {
      let response: any;
      try {
        response = await getFetchImpl()(url, init);
      } catch (fetchError: any) {
        if (abortReason) throw createRequestAbortError(abortReason, fetchError);
        throw fetchError;
      }
      const data = await response.json().catch(function () { return {}; });
      if (readState().serverUrl === requestServerUrl) {
        state.streamTransport = response.headers?.get?.('X-Match-Stream-Transport') === 'websocket' ? 'websocket' : 'sse';
      }
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
      entry[1].cancel();
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

  function createCancelledPublishResult(): any {
    return { ok: false, status: 0, data: null, cancelled: true, reason: 'SESSION_CHANGED' };
  }

  // requestContext pins the destination for every attempt ({ serverUrl, isCurrent }). Retries are sent
  // only while the owning session is still current; otherwise they stop without contacting any server.
  async function publishRequestWithRetry(payload: any, requestContext?: any): Promise<any> {
    const context = (requestContext && typeof requestContext === 'object') ? requestContext : {};
    const requestServerUrl = context.serverUrl !== undefined ? context.serverUrl : readState().serverUrl;
    const isRequestCurrent = typeof context.isCurrent === 'function'
      ? context.isCurrent
      : function () { return true; };
    const wirePayload = (payload && typeof payload === 'object')
      ? Object.assign({}, payload, {
        presentationEnvelopeVersion: PresentationEnvelopeContract.PRESENTATION_ENVELOPE_VERSION
      })
      : payload;
    let lastError: any = null;
    for (let attempt = 0; attempt < publishRetryMaxAttempts; attempt += 1) {
      if (attempt > 0 && !isRequestCurrent()) return createCancelledPublishResult();
      try {
        const res = await requestJson('POST', '/api/match/publish', wirePayload, { serverUrl: requestServerUrl });
        if (!isRetryablePublishStatus(res && res.status) || attempt >= (publishRetryMaxAttempts - 1)) {
          return res;
        }
      } catch (e: any) {
        if (e && e.cancelled === true) throw e;
        lastError = e;
        if (attempt >= (publishRetryMaxAttempts - 1)) {
          throw e;
        }
      }

      const delayMs = typeof cfg.computeRetryDelayMs === 'function'
        ? cfg.computeRetryDelayMs(publishRetryBaseDelayMs, publishRetryMaxDelayMs, attempt)
        : publishRetryBaseDelayMs;
      const waitOutcome = await waitForPublishRetry(delayMs);
      if (waitOutcome === 'cancelled' || !isRequestCurrent()) return createCancelledPublishResult();
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
    cancelPendingPublishRetries,
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
