'use strict';

function createNetworkRoomEventsController(config?: any): any {
  const cfg = (config && typeof config === 'object') ? config : {};
  const getState = typeof cfg.getState === 'function' ? cfg.getState : function () { return null; };
  const chatHistoryLimit = Number.isFinite(Number(cfg.chatHistoryLimit))
    ? Math.max(1, Math.trunc(Number(cfg.chatHistoryLimit)))
    : 40;
  const now = typeof cfg.now === 'function' ? cfg.now : function () { return Date.now(); };

  function readState(): any {
    const state = getState();
    if (!state || typeof state !== 'object') {
      throw new Error('network_room_events_state_required');
    }
    return state;
  }

  function normalizePlayerKey(value: any): string {
    if (typeof cfg.normalizePlayerKey === 'function') {
      return cfg.normalizePlayerKey(value);
    }
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === 'white' ? 'white' : 'black';
  }

  function normalizeChatText(value: any): string {
    return String(value || '').replace(/[\r\n]+/g, ' ').trim();
  }

  function countTextChars(value: any): number {
    return Array.from(String(value || '')).length;
  }

  function normalizeChatMessage(entry: any): any {
    if (!entry || typeof entry !== 'object') return null;
    const text = normalizeChatText(entry.text);
    if (!text) return null;
    return {
      id: Number.isFinite(Number(entry.id)) ? Number(entry.id) : now(),
      seatKey: normalizePlayerKey(entry.seatKey),
      text,
      serverTime: Number.isFinite(Number(entry.serverTime)) ? Number(entry.serverTime) : now()
    };
  }

  function emitChatEvent(payload: any): void {
    const state = readState();
    if (typeof state.chatListener !== 'function') return;
    try {
      state.chatListener(payload);
    } catch (e) { /* ignore */ }
  }

  function handleChatPayload(payload: any): void {
    const state = readState();
    if (!payload || payload.ok !== true) return;

    if (typeof cfg.applyPayloadSessionState === 'function') {
      cfg.applyPayloadSessionState(payload);
    }

    const type = String(payload.type || 'message');
    if (type === 'history') {
      const list = Array.isArray(payload.messages) ? payload.messages : [];
      const normalized = list
        .map(function (entry: any) { return normalizeChatMessage(entry); })
        .filter(function (entry: any) { return !!entry; });
      state.chatHistory = normalized.slice(-chatHistoryLimit);
      emitChatEvent({
        type: 'history',
        messages: state.chatHistory.slice()
      });
      return;
    }

    const message = normalizeChatMessage(payload.message);
    if (!message) return;

    state.chatHistory.push(message);
    if (state.chatHistory.length > chatHistoryLimit) {
      state.chatHistory.splice(0, state.chatHistory.length - chatHistoryLimit);
    }

    emitChatEvent({
      type: 'message',
      message
    });
  }

  function handlePresencePayload(payload: any): void {
    const state = readState();
    if (!payload || payload.ok !== true) return;

    if (typeof cfg.applyPayloadSessionState === 'function') {
      cfg.applyPayloadSessionState(payload);
    }

    const type = String(payload.type || 'join');
    if (type !== 'join' && type !== 'leave') return;

    const joinedSeatKey = normalizePlayerKey(payload.seatKey);
    if (joinedSeatKey === state.seatKey) return;

    const seatName = typeof cfg.getSeatDisplayName === 'function'
      ? cfg.getSeatDisplayName(joinedSeatKey)
      : joinedSeatKey;
    const message = (type === 'leave')
      ? 'ネット対戦: ' + seatName + 'が退出しました'
      : (payload.rejoined
        ? 'ネット対戦: ' + seatName + 'が再接続しました'
        : 'ネット対戦: ' + seatName + 'が接続しました');
    if (typeof cfg.emitStatusAndEffectLog === 'function') {
      cfg.emitStatusAndEffectLog(message, false);
    }
  }

  function handleTimeoutPassPayload(payload: any): void {
    const state = readState();
    if (!payload || payload.ok !== true) return;
    if (String(payload.actionType || '') !== 'timeout_pass') return;

    const timedOutSeatKey = normalizePlayerKey(payload.playerKey);
    if (timedOutSeatKey === state.seatKey) {
      if (typeof cfg.emitStatusAndEffectLog === 'function') {
        cfg.emitStatusAndEffectLog('ネット対戦: あなたの手番が時間切れになりました', false);
      }
      return;
    }

    const seatName = typeof cfg.getSeatDisplayName === 'function'
      ? cfg.getSeatDisplayName(timedOutSeatKey)
      : timedOutSeatKey;
    if (typeof cfg.emitStatusAndEffectLog === 'function') {
      cfg.emitStatusAndEffectLog('ネット対戦: ' + seatName + 'の手番が時間切れになりました', false);
    }
  }

  function setChatListener(listener: any): void {
    const state = readState();
    state.chatListener = (typeof listener === 'function') ? listener : null;
    if (state.chatListener && state.chatHistory.length > 0) {
      emitChatEvent({
        type: 'history',
        messages: state.chatHistory.slice()
      });
    }
  }

  return {
    normalizeChatText,
    countTextChars,
    normalizeChatMessage,
    handleChatPayload,
    handlePresencePayload,
    handleTimeoutPassPayload,
    setChatListener
  };
}

const NetworkRoomEventsModule = {
  createNetworkRoomEventsController
};

export = NetworkRoomEventsModule;
