
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const _GameEvents: any = typeof globalThis !== 'undefined' ? (globalThis as any).GameEvents : undefined;

function emitGameEvent(eventType: string | null, fallbackHandlers: Function[] = [], data?: any): boolean {
    if (typeof _GameEvents !== 'undefined' && _GameEvents.gameEvents && eventType) {
        _GameEvents.gameEvents.emit(eventType, data);
        return true;
    } else {
        let handled = false;
        fallbackHandlers.forEach(handler => {
            if (typeof handler === 'function') {
                handled = true;
                handler();
            }
        });
        return handled;
    }
}

function formatControllerEventContext(options?: any): string {
    const config = (options && typeof options === 'object') ? options : null;
    if (!config) return '';

    const parts: string[] = [];
    if (typeof config.source === 'string' && config.source.trim()) {
        parts.push('source=' + config.source.trim());
    }
    if (typeof config.reason === 'string' && config.reason.trim()) {
        parts.push('reason=' + config.reason.trim());
    }
    return parts.length > 0 ? ' (' + parts.join(', ') + ')' : '';
}

function warnControllerEventFailure(eventName: string, message: string, error?: any, options?: any): boolean {
    if (typeof console === 'undefined' || typeof console.warn !== 'function') return false;
    const prefix = '[ControllerEvents] ' + eventName + ' ' + message + formatControllerEventContext(options);
    if (typeof error === 'undefined') {
        console.warn(prefix);
    } else {
        console.warn(prefix, error);
    }
    return false;
}

function emitNamedControllerEvent(eventName: string, eventType: string | null, data?: any, options?: any): boolean {
    try {
        const handled = emitGameEvent(eventType, [], data);
        if (handled) return true;
        return warnControllerEventFailure(eventName, 'request unavailable', undefined, options);
    } catch (error) {
        return warnControllerEventFailure(eventName, 'request failed', error, options);
    }
}

function emitBoardUpdate(options?: any): boolean {
    const eventType = (typeof _GameEvents !== 'undefined' && _GameEvents.EVENT_TYPES)
        ? _GameEvents.EVENT_TYPES.BOARD_UPDATED
        : null;
    return emitNamedControllerEvent('BOARD_UPDATED', eventType, null, options);
}

function emitGameStateChange(): boolean {
    const eventType = (typeof _GameEvents !== 'undefined' && _GameEvents.EVENT_TYPES)
        ? _GameEvents.EVENT_TYPES.GAME_STATE_CHANGED
        : null;
    return emitGameEvent(eventType, []);
}

function emitCardStateChange(options?: any): boolean {
    const eventType = (typeof _GameEvents !== 'undefined' && _GameEvents.EVENT_TYPES)
        ? _GameEvents.EVENT_TYPES.CARD_STATE_CHANGED
        : null;
    return emitNamedControllerEvent('CARD_STATE_CHANGED', eventType, null, options);
}

function emitGameReset(data?: any): boolean {
    const eventType = (typeof _GameEvents !== 'undefined' && _GameEvents.EVENT_TYPES)
        ? _GameEvents.EVENT_TYPES.GAME_RESET
        : null;
    return emitGameEvent(eventType, [], data || null);
}

function emitLogAdded(message: any, kind?: string): void {
    const eventType = (typeof _GameEvents !== 'undefined' && _GameEvents.EVENT_TYPES)
        ? _GameEvents.EVENT_TYPES.LOG_ADDED
        : null;
    const messagePayload = (message && typeof message === 'object') ? message : null;
    const resolvedKind = messagePayload
        ? (String(messagePayload.kind || kind || 'normal').trim().toLowerCase() || 'normal')
        : ((kind === 'effect' || kind === 'commentary') ? kind : 'normal');
    const payload = Object.assign({}, messagePayload || {}, {
        text: messagePayload && typeof messagePayload.text === 'string'
            ? messagePayload.text
            : String(message),
        kind: resolvedKind,
        ts: Date.now()
    });
    emitGameEvent(eventType, [
        () => { if (typeof console !== 'undefined' && console.log) console.log('[log]', payload.text); }
    ], payload);
}

function emitEffectLog(message: any): void {
    emitLogAdded(message, 'effect');
}

function emitNormalLog(message: any): void {
    emitLogAdded(message, 'normal');
}

const ControllerEvents = {
    emitGameEvent,
    emitBoardUpdate,
    emitGameStateChange,
    emitCardStateChange,
    emitGameReset,
    emitLogAdded,
    emitEffectLog,
    emitNormalLog
};

export = ControllerEvents;
