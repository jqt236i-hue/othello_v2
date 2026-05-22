
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

let controllerEventsRuntime: any = null;

function setControllerEventsRuntime(runtime: any): void {
    controllerEventsRuntime = (runtime && typeof runtime === 'object') ? runtime : null;
}

function getGameEventsRuntime(): any {
    try {
        if (controllerEventsRuntime && typeof controllerEventsRuntime.getGameEvents === 'function') {
            return controllerEventsRuntime.getGameEvents();
        }
        if (controllerEventsRuntime && controllerEventsRuntime.GameEvents) {
            return controllerEventsRuntime.GameEvents;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function resolveControllerEventType(name: string): string | null {
    const gameEvents = getGameEventsRuntime();
    const eventTypes = gameEvents && gameEvents.EVENT_TYPES;
    const eventType = eventTypes && eventTypes[name];
    return eventType ? String(eventType) : null;
}

function emitGameEvent(eventType: string | null, fallbackHandlers: Function[] = [], data?: any): boolean {
    const gameEvents = getGameEventsRuntime();
    if (gameEvents && gameEvents.gameEvents && eventType) {
        gameEvents.gameEvents.emit(eventType, data);
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
    const eventType = resolveControllerEventType('BOARD_UPDATED');
    return emitNamedControllerEvent('BOARD_UPDATED', eventType, null, options);
}

function emitGameStateChange(): boolean {
    const eventType = resolveControllerEventType('GAME_STATE_CHANGED');
    return emitGameEvent(eventType, []);
}

function emitCardStateChange(options?: any): boolean {
    const eventType = resolveControllerEventType('CARD_STATE_CHANGED');
    return emitNamedControllerEvent('CARD_STATE_CHANGED', eventType, null, options);
}

function emitGameReset(data?: any): boolean {
    const eventType = resolveControllerEventType('GAME_RESET');
    return emitGameEvent(eventType, [], data || null);
}

function emitLogAdded(message: any, kind?: string): void {
    const eventType = resolveControllerEventType('LOG_ADDED');
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
    setControllerEventsRuntime,
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
