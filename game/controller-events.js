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
    } else {
        // Fallback: call provided handler functions if event system is unavailable
        fallbackHandlers.forEach(handler => {
            if (typeof handler === 'function') handler();
        });
    }
}

function emitBoardUpdate() {
    const eventType = (typeof GameEvents !== 'undefined' && GameEvents.EVENT_TYPES)
        ? GameEvents.EVENT_TYPES.BOARD_UPDATED
        : null;
    emitGameEvent(eventType, []);
}

function emitGameStateChange() {
    const eventType = (typeof GameEvents !== 'undefined' && GameEvents.EVENT_TYPES)
        ? GameEvents.EVENT_TYPES.GAME_STATE_CHANGED
        : null;
    emitGameEvent(eventType, []);
}

function emitCardStateChange() {
    const eventType = (typeof GameEvents !== 'undefined' && GameEvents.EVENT_TYPES)
        ? GameEvents.EVENT_TYPES.CARD_STATE_CHANGED
        : null;
    emitGameEvent(eventType, []);
}

function emitLogAdded(message, kind) {
    const eventType = (typeof GameEvents !== 'undefined' && GameEvents.EVENT_TYPES)
        ? GameEvents.EVENT_TYPES.LOG_ADDED
        : null;
    const resolvedKind = (kind === 'effect' || kind === 'normal') ? kind : 'normal';
    const payload = {
        text: String(message),
        kind: resolvedKind,
        ts: Date.now()
    };
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


