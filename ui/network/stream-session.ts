import type { NetworkStreamState } from './client-state';
import { NetworkWebSocketStream } from './websocket-stream';
import { MATCH_STREAM_FRAME_COMPRESSION, canDecompressMatchStreamFrames } from '../../shared/match-stream-compression';
'use strict';

const PresentationEnvelopeContract = require('../../shared/network-presentation-envelope');

function createNetworkStreamSessionController(config?: any): any {
  const cfg = (config && typeof config === 'object') ? config : {};
  // Legacy getState remains an adapter for existing standalone consumers.
  const getState = cfg.state ? () => cfg.state : (typeof cfg.getState === 'function' ? cfg.getState : () => null);
  const withTrailingSlashRemoved = typeof cfg.withTrailingSlashRemoved === 'function'
    ? cfg.withTrailingSlashRemoved
    : function (url: any) { return String(url || '').replace(/\/+$/, ''); };

  function readState(): NetworkStreamState {
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
    const presentationEnvelopeQuery = '&presentationEnvelopeVersion='
      + encodeURIComponent(PresentationEnvelopeContract.PRESENTATION_ENVELOPE_VERSION);
    if (String(state.viewerRole || '').trim().toLowerCase() === 'spectator') {
      return withTrailingSlashRemoved(state.serverUrl)
        + '/api/match/stream?roomId=' + encodeURIComponent(state.roomId)
        + '&viewerRole=spectator'
        + '&spectatorId=' + encodeURIComponent(state.spectatorId || '')
        + '&spectatorToken=' + encodeURIComponent(state.spectatorToken || '')
        + resumeQuery
        + presentationEnvelopeQuery;
    }
    return withTrailingSlashRemoved(state.serverUrl)
      + '/api/match/stream?roomId=' + encodeURIComponent(state.roomId)
      + '&seatKey=' + encodeURIComponent(state.seatKey)
      + '&seatToken=' + encodeURIComponent(state.seatToken || '')
      + resumeQuery
      + presentationEnvelopeQuery;
  }

  function openStream(options?: any): void {
    const opts = (options && typeof options === 'object') ? options : {};
    if (typeof cfg.closeExistingStream === 'function') {
      cfg.closeExistingStream();
    }

    const state = readState();
    if (!state.active || !state.roomId) return;

    const EventSourceClass = getEventSourceClass();
    const WebSocketClass = cfg.webSocketClass || (state.streamTransport === 'websocket' && !cfg.eventSourceClass && typeof window !== 'undefined' ? window.WebSocket : null);
    if (typeof EventSourceClass !== 'function' && typeof WebSocketClass !== 'function') {
      if (typeof cfg.emitStatus === 'function') {
        cfg.emitStatus('ネット対戦: この環境ではリアルタイム接続に未対応です', true);
      }
      return;
    }

    const es = typeof WebSocketClass === 'function'
      ? new NetworkWebSocketStream(buildStreamUrl(opts), {
        WebSocketClass,
        EventSourceClass,
        frameCompression: canDecompressMatchStreamFrames() ? MATCH_STREAM_FRAME_COMPRESSION : null
      })
      : new EventSourceClass(buildStreamUrl(opts));
    state.eventSource = es;
    const streamSessionEpoch = typeof cfg.getSessionEpoch === 'function'
      ? cfg.getSessionEpoch()
      : null;
    const streamRoomId = String(state.roomId || '');
    function isCurrentStreamSession(): boolean {
      const currentState = getState();
      if (!currentState || currentState.eventSource !== es) return false;
      if (typeof cfg.getSessionEpoch === 'function' && cfg.getSessionEpoch() !== streamSessionEpoch) {
        return false;
      }
      return currentState.active === true
        && String(currentState.roomId || '') === streamRoomId;
    }
    function guardStreamPayloadHandler(handler: any): any {
      return function (payload: any) {
        if (!isCurrentStreamSession()) {
          if (typeof cfg.recordNetworkTelemetry === 'function') {
            cfg.recordNetworkTelemetry('stream_event_stale_session_ignored', {
              streamRoomId,
              streamSessionEpoch
            });
          }
          return;
        }
        if (typeof handler === 'function') handler(payload);
      };
    }
    if (typeof cfg.markStreamActivity === 'function') {
      cfg.markStreamActivity();
    }
    if (typeof cfg.scheduleStreamWatchdog === 'function') {
      cfg.scheduleStreamWatchdog();
    }

    const makeHandler = typeof cfg.createStreamPayloadHandler === 'function'
      ? cfg.createStreamPayloadHandler
      : function (_name: any) { return function () { }; };
    const handleStreamEvent = makeHandler(guardStreamPayloadHandler(function (payload: any) {
      if (typeof cfg.completeReconnectRecoveryFromStream === 'function') {
        cfg.completeReconnectRecoveryFromStream();
      }
      if (typeof cfg.handleStreamSnapshotPayload === 'function') {
        cfg.handleStreamSnapshotPayload(payload);
      }
    }));
    const handlePresenceEvent = makeHandler(guardStreamPayloadHandler(cfg.handlePresencePayload));
    const handleChatEvent = makeHandler(guardStreamPayloadHandler(cfg.handleChatPayload));
    const handleHeartbeatEvent = makeHandler(guardStreamPayloadHandler(function (payload: any) {
      if (typeof cfg.completeReconnectRecoveryFromStream === 'function') {
        cfg.completeReconnectRecoveryFromStream();
      }
      if (typeof cfg.applyPayloadSessionState === 'function') {
        cfg.applyPayloadSessionState(payload);
      }
      if (typeof cfg.maybeSyncFromHeartbeat === 'function') {
        cfg.maybeSyncFromHeartbeat(payload);
      }
    }));

    es.addEventListener('snapshot', handleStreamEvent);
    es.addEventListener('presence', handlePresenceEvent);
    es.addEventListener('chat', handleChatEvent);
    es.addEventListener('heartbeat', handleHeartbeatEvent);
    es.addEventListener('transport-health', makeHandler(guardStreamPayloadHandler(function (payload: any) {
      // Auto-responses contain only the committed version, no stale server clock or session data.
      if (typeof cfg.maybeSyncFromHeartbeat === 'function') cfg.maybeSyncFromHeartbeat(payload);
    })));
    es.onmessage = handleStreamEvent;

    es.onopen = function () {
      if (!isCurrentStreamSession()) return;
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
      if (!isCurrentStreamSession()) return;
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
