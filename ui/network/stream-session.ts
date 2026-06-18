'use strict';

function createNetworkStreamSessionController(config?: any): any {
  const cfg = (config && typeof config === 'object') ? config : {};
  const getState = typeof cfg.getState === 'function' ? cfg.getState : function () { return null; };
  const withTrailingSlashRemoved = typeof cfg.withTrailingSlashRemoved === 'function'
    ? cfg.withTrailingSlashRemoved
    : function (url: any) { return String(url || '').replace(/\/+$/, ''); };

  function readState(): any {
    const state = getState();
    if (!state || typeof state !== 'object') {
      throw new Error('network_stream_session_state_required');
    }
    return state;
  }

  function getEventSourceClass(): any {
    if (typeof cfg.eventSourceClass === 'function') return cfg.eventSourceClass;
    try {
      if (typeof EventSource === 'function') return EventSource;
    } catch (e) { /* ignore */ }
    try {
      if (typeof globalThis !== 'undefined' && typeof (globalThis as any).EventSource === 'function') {
        return (globalThis as any).EventSource;
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  function getEventSourceOpenState(): number {
    const EventSourceClass = getEventSourceClass();
    return (EventSourceClass && Number.isFinite(Number(EventSourceClass.OPEN)))
      ? Number(EventSourceClass.OPEN)
      : 1;
  }

  function buildStreamUrl(options?: any): string {
    const state = readState();
    const opts = (options && typeof options === 'object') ? options : {};
    const resumeEventId = opts.reconnect === true
      ? String(state.lastStreamEventId || '').trim()
      : '';
    const resumeQuery = resumeEventId
      ? '&lastEventId=' + encodeURIComponent(resumeEventId)
      : '';
    if (String(state.viewerRole || '').trim().toLowerCase() === 'spectator') {
      return withTrailingSlashRemoved(state.serverUrl)
        + '/api/match/stream?roomId=' + encodeURIComponent(state.roomId)
        + '&viewerRole=spectator'
        + '&spectatorId=' + encodeURIComponent(state.spectatorId || '')
        + '&spectatorToken=' + encodeURIComponent(state.spectatorToken || '')
        + resumeQuery;
    }
    return withTrailingSlashRemoved(state.serverUrl)
      + '/api/match/stream?roomId=' + encodeURIComponent(state.roomId)
      + '&seatKey=' + encodeURIComponent(state.seatKey)
      + '&seatToken=' + encodeURIComponent(state.seatToken || '')
      + resumeQuery;
  }

  function openStream(options?: any): void {
    const opts = (options && typeof options === 'object') ? options : {};
    if (typeof cfg.closeExistingStream === 'function') {
      cfg.closeExistingStream();
    }

    const state = readState();
    if (!state.active || !state.roomId) return;

    const EventSourceClass = getEventSourceClass();
    if (typeof EventSourceClass !== 'function') {
      if (typeof cfg.emitStatus === 'function') {
        cfg.emitStatus('ネット対戦: この環境ではリアルタイム接続に未対応です', true);
      }
      return;
    }

    const es = new EventSourceClass(buildStreamUrl(opts));
    state.eventSource = es;
    if (typeof cfg.markStreamActivity === 'function') {
      cfg.markStreamActivity();
    }
    if (typeof cfg.scheduleStreamWatchdog === 'function') {
      cfg.scheduleStreamWatchdog();
    }

    const makeHandler = typeof cfg.createStreamPayloadHandler === 'function'
      ? cfg.createStreamPayloadHandler
      : function (_name: any) { return function () { }; };
    const handleStreamEvent = makeHandler(function (payload: any) {
      if (typeof cfg.completeReconnectRecoveryFromStream === 'function') {
        cfg.completeReconnectRecoveryFromStream();
      }
      if (typeof cfg.handleStreamSnapshotPayload === 'function') {
        cfg.handleStreamSnapshotPayload(payload);
      }
    });
    const handlePresenceEvent = makeHandler(cfg.handlePresencePayload);
    const handleChatEvent = makeHandler(cfg.handleChatPayload);
    const handleHeartbeatEvent = makeHandler(function (payload: any) {
      if (typeof cfg.completeReconnectRecoveryFromStream === 'function') {
        cfg.completeReconnectRecoveryFromStream();
      }
      if (typeof cfg.applyPayloadSessionState === 'function') {
        cfg.applyPayloadSessionState(payload);
      }
      if (typeof cfg.maybeSyncFromHeartbeat === 'function') {
        cfg.maybeSyncFromHeartbeat(payload);
      }
    });

    es.addEventListener('snapshot', handleStreamEvent);
    es.addEventListener('presence', handlePresenceEvent);
    es.addEventListener('chat', handleChatEvent);
    es.addEventListener('heartbeat', handleHeartbeatEvent);
    es.onmessage = handleStreamEvent;

    es.onopen = function () {
      if (typeof cfg.markStreamActivity === 'function') {
        cfg.markStreamActivity();
      }
      if (typeof cfg.scheduleStreamWatchdog === 'function') {
        cfg.scheduleStreamWatchdog();
      }
      if (typeof cfg.clearReconnectTimer === 'function') {
        cfg.clearReconnectTimer();
      }
      const hadReconnect = !!opts.reconnect || Number(state.reconnectAttempt || 0) > 0;
      state.reconnectAttempt = 0;
      if (hadReconnect) {
        if (typeof cfg.emitStatus === 'function') {
          cfg.emitStatus('ネット対戦: 接続を回復しました', false);
        }
        if (typeof cfg.scheduleReconnectRecoverySync === 'function') {
          cfg.scheduleReconnectRecoverySync();
        }
      }
    };

    es.onerror = function () {
      if (typeof cfg.emitStatus === 'function') {
        cfg.emitStatus('ネット対戦: 接続が不安定です（再接続待機）', true);
      }
      if (typeof cfg.isActive === 'function' && cfg.isActive() !== true) return;

      const readyState = Number.isFinite(Number(es.readyState)) ? Number(es.readyState) : null;
      if (readyState !== getEventSourceOpenState()) {
        if (typeof cfg.scheduleStreamReconnect === 'function') {
          cfg.scheduleStreamReconnect();
        }
      }
    };
  }

  return {
    buildStreamUrl,
    openStream
  };
}

const NetworkStreamSessionModule = {
  createNetworkStreamSessionController
};

export = NetworkStreamSessionModule;
