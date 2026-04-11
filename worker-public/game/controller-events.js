// ===== Controller Event Helpers =====

/**
 * Emit a game event with optional fallback handlers
 * @param {string} eventType - The event type (from GameEvents.EVENT_TYPES)
 * @param {Array<Function>} fallbackHandlers - Functions to call if event system is unavailable
 * @param {*} data - Optional event payload
 */
function emitGameEvent(eventType, fallbackHandlers = [], data) {
    if (typeof GameEvents !== 'undefined' && GameEvents.gameEvents && eventType) {
        GameEvents.gameEvents.emit(eventType, data);
        return true;
    } else {
        let handled = false;
        // Fallback: call provided handler functions if event system is unavailable
        fallbackHandlers.forEach(handler => {
            if (typeof handler === 'function') {
                handled = true;
                handler();
            }
        });
        return handled;
    }
}

function formatControllerEventContext(options) {
    const config = (options && typeof options === 'object') ? options : null;
    if (!config) return '';

    const parts = [];
    if (typeof config.source === 'string' && config.source.trim()) {
        parts.push('source=' + config.source.trim());
    }
    if (typeof config.reason === 'string' && config.reason.trim()) {
        parts.push('reason=' + config.reason.trim());
    }
    return parts.length > 0 ? ' (' + parts.join(', ') + ')' : '';
}

function warnControllerEventFailure(eventName, message, error, options) {
    if (typeof console === 'undefined' || typeof console.warn !== 'function') return false;
    const prefix = '[ControllerEvents] ' + eventName + ' ' + message + formatControllerEventContext(options);
    if (typeof error === 'undefined') {
        console.warn(prefix);
    } else {
        console.warn(prefix, error);
    }
    return false;
}

function emitNamedControllerEvent(eventName, eventType, data, options) {
    try {
        const handled = emitGameEvent(eventType, [], data);
        if (handled) return true;
        return warnControllerEventFailure(eventName, 'request unavailable', undefined, options);
    } catch (error) {
        return warnControllerEventFailure(eventName, 'request failed', error, options);
    }
}

function emitBoardUpdate(options) {
    const eventType = (typeof GameEvents !== 'undefined' && GameEvents.EVENT_TYPES)
        ? GameEvents.EVENT_TYPES.BOARD_UPDATED
        : null;
    return emitNamedControllerEvent('BOARD_UPDATED', eventType, null, options);
}

function emitGameStateChange() {
    const eventType = (typeof GameEvents !== 'undefined' && GameEvents.EVENT_TYPES)
        ? GameEvents.EVENT_TYPES.GAME_STATE_CHANGED
        : null;
    return emitGameEvent(eventType, []);
}

function emitCardStateChange(options) {
    const eventType = (typeof GameEvents !== 'undefined' && GameEvents.EVENT_TYPES)
        ? GameEvents.EVENT_TYPES.CARD_STATE_CHANGED
        : null;
    return emitNamedControllerEvent('CARD_STATE_CHANGED', eventType, null, options);
}

function emitGameReset(data) {
    const eventType = (typeof GameEvents !== 'undefined' && GameEvents.EVENT_TYPES)
        ? GameEvents.EVENT_TYPES.GAME_RESET
        : null;
    return emitGameEvent(eventType, [], data || null);
}

function emitLogAdded(message, kind) {
    const eventType = (typeof GameEvents !== 'undefined' && GameEvents.EVENT_TYPES)
        ? GameEvents.EVENT_TYPES.LOG_ADDED
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

function emitEffectLog(message) {
    emitLogAdded(message, 'effect');
}

function emitNormalLog(message) {
    emitLogAdded(message, 'normal');
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        emitGameEvent,
        emitBoardUpdate,
        emitGameStateChange,
        emitCardStateChange,
        emitGameReset,
        emitLogAdded,
        emitEffectLog,
        emitNormalLog
    };
}


