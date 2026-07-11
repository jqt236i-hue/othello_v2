type DiagnosticsOptions = {
    root: any;
    getState: () => any;
    getInternalState: () => any;
    isActive: () => boolean;
    isSpectator: () => boolean;
    hasTwoPlayers: () => boolean;
    normalizePlayerKey: (value: any) => any;
    getNetworkTelemetry: () => any;
    getNetworkDebugTrace: () => any;
};

function sanitizeDiagnosticsValue(value: any, depth?: number): any {
    const currentDepth = Number.isFinite(Number(depth)) ? Number(depth) : 0;
    if (currentDepth > 8) return '[depth-limit]';
    if (value === null || typeof value === 'undefined') return value;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
    if (Array.isArray(value)) {
        return value.map((entry) => sanitizeDiagnosticsValue(entry, currentDepth + 1));
    }
    if (typeof value !== 'object') return String(value);

    const sanitized: any = {};
    Object.keys(value).forEach((key) => {
        const normalizedKey = String(key || '').toLowerCase();
        if (
            normalizedKey.indexOf('token') >= 0
            || normalizedKey.indexOf('password') >= 0
            || normalizedKey.indexOf('secret') >= 0
            || normalizedKey.indexOf('authorization') >= 0
        ) {
            return;
        }
        sanitized[key] = sanitizeDiagnosticsValue(value[key], currentDepth + 1);
    });
    return sanitized;
}

function normalizeDiagnosticsNumber(value: any): number | null {
    if (value === null || typeof value === 'undefined') return null;
    if (typeof value === 'string' && value.trim() === '') return null;
    return Number.isFinite(Number(value)) ? Number(value) : null;
}

function summarizeGameStateForDiagnostics(gameStateValue: any): any {
    const gameStateRecord = (gameStateValue && typeof gameStateValue === 'object') ? gameStateValue : {};
    const board = Array.isArray(gameStateRecord.board) ? gameStateRecord.board : null;
    const firstRow = board && Array.isArray(board[0]) ? board[0] : null;
    return {
        currentPlayer: normalizeDiagnosticsNumber(gameStateRecord.currentPlayer),
        turnNumber: normalizeDiagnosticsNumber(gameStateRecord.turnNumber),
        consecutivePasses: normalizeDiagnosticsNumber(gameStateRecord.consecutivePasses),
        boardRows: board ? board.length : null,
        boardCols: firstRow ? firstRow.length : null,
        resultShown: gameStateRecord.__resultShown === true
    };
}

function summarizeCardStateForDiagnostics(cardStateValue: any): any {
    const cardStateRecord = (cardStateValue && typeof cardStateValue === 'object') ? cardStateValue : {};
    const hands = (cardStateRecord.hands && typeof cardStateRecord.hands === 'object') ? cardStateRecord.hands : {};
    const blackHand = Array.isArray(hands.black) ? hands.black : [];
    const whiteHand = Array.isArray(hands.white) ? hands.white : [];
    return {
        handCounts: {
            black: blackHand.length,
            white: whiteHand.length
        },
        charge: sanitizeDiagnosticsValue(cardStateRecord.charge || null),
        selectedCardId: typeof cardStateRecord.selectedCardId === 'string' ? cardStateRecord.selectedCardId : null,
        selectedCardOwnerKey: typeof cardStateRecord.selectedCardOwnerKey === 'string' ? cardStateRecord.selectedCardOwnerKey : null,
        pendingEffectByPlayer: sanitizeDiagnosticsValue(cardStateRecord.pendingEffectByPlayer || null),
        hasUsedCardThisTurnByPlayer: sanitizeDiagnosticsValue(cardStateRecord.hasUsedCardThisTurnByPlayer || null)
    };
}

function readRootValue(root: any, name: string): any {
    try {
        if (root && Object.prototype.hasOwnProperty.call(root, name)) return root[name];
    } catch (e) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && Object.prototype.hasOwnProperty.call(globalThis, name)) {
            return (globalThis as any)[name];
        }
    } catch (e) { /* ignore */ }
    return null;
}

function readMatchMode(root: any): string {
    try {
        if (root && typeof root.getCurrentMatchMode === 'function') {
            return String(root.getCurrentMatchMode() || '').trim();
        }
    } catch (e) { /* ignore */ }
    try {
        if (root && typeof root.MATCH_MODE !== 'undefined') return String(root.MATCH_MODE || '').trim();
    } catch (e) { /* ignore */ }
    try {
        if (root && typeof root.__MATCH_MODE !== 'undefined') return String(root.__MATCH_MODE || '').trim();
    } catch (e) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && typeof (globalThis as any).MATCH_MODE !== 'undefined') {
            return String((globalThis as any).MATCH_MODE || '').trim();
        }
    } catch (e) { /* ignore */ }
    return '';
}

function createNetworkDiagnosticsController(options: DiagnosticsOptions) {
    const config = options || {} as DiagnosticsOptions;

    function buildSnapshot(reason: any): any {
        const now = Date.now();
        const state = config.getInternalState();
        const readableState = config.getState();
        const gameStateValue = readRootValue(config.root, 'gameState');
        const cardStateValue = readRootValue(config.root, 'cardState');
        const lastActivityAt = Number.isFinite(Number(state.lastStreamActivityAt))
            ? Number(state.lastStreamActivityAt)
            : 0;
        return sanitizeDiagnosticsValue({
            schemaVersion: 1,
            reason: String(reason || 'manual'),
            createdAt: new Date(now).toISOString(),
            matchMode: readMatchMode(config.root),
            active: config.isActive(),
            viewerRole: config.isSpectator() ? 'spectator' : 'seat',
            roomId: String(state.roomId || ''),
            seatKey: config.normalizePlayerKey(state.seatKey),
            spectatorId: config.isSpectator() ? String(state.spectatorId || '') : '',
            spectatorName: config.isSpectator() ? String(state.spectatorName || '') : '',
            stateVersion: normalizeDiagnosticsNumber(state.stateVersion),
            appliedStateVersion: normalizeDiagnosticsNumber(state.appliedStateVersion),
            networkDebugEnabled: state.networkDebugEnabled === true,
            networkAutoEnabled: state.networkAutoEnabled === true,
            stream: {
                connected: !!state.eventSource,
                lastEventId: String(state.lastStreamEventId || ''),
                lastActivityAgeMs: lastActivityAt > 0 ? Math.max(0, now - lastActivityAt) : null,
                reconnectAttempt: normalizeDiagnosticsNumber(state.reconnectAttempt) || 0,
                reconnectRecoveryPending: state.reconnectRecoveryPending === true,
                heartbeatResyncInFlight: state.heartbeatResyncInFlight === true
            },
            room: {
                seats: readableState.roomSeats,
                seatNames: readableState.seatNames,
                seatHandSkins: readableState.seatHandSkins,
                roomBoardConfig: readableState.roomBoardConfig,
                hasTwoPlayers: config.hasTwoPlayers()
            },
            turnTimer: sanitizeDiagnosticsValue(state.turnTimer || null),
            publishTracker: sanitizeDiagnosticsValue(readableState.publishTracker || null),
            networkTelemetry: config.getNetworkTelemetry(),
            networkDebugTrace: config.getNetworkDebugTrace(),
            gameState: summarizeGameStateForDiagnostics(gameStateValue),
            cardState: summarizeCardStateForDiagnostics(cardStateValue)
        });
    }

    function dumpDiagnostics(reason?: any): any {
        const snapshot = buildSnapshot(reason || 'manual');
        const label = `[network-diagnostics] ${snapshot.reason} room=${snapshot.roomId || '-'} version=${snapshot.stateVersion === null ? '-' : snapshot.stateVersion}`;
        try {
            if (typeof console !== 'undefined' && console) {
                if (typeof console.groupCollapsed === 'function') {
                    console.groupCollapsed(label);
                    if (typeof console.log === 'function') console.log(snapshot);
                    if (typeof console.groupEnd === 'function') console.groupEnd();
                } else if (typeof console.log === 'function') {
                    console.log(label, snapshot);
                }
            }
        } catch (e) { /* ignore */ }
        return snapshot;
    }

    return {
        buildSnapshot,
        dumpDiagnostics,
        getMatchMode: () => readMatchMode(config.root)
    };
}

function isNetworkDiagnosticsShortcutEvent(event: any): boolean {
    if (!event || typeof event !== 'object') return false;
    return event.key === 'F12'
        || event.code === 'F12'
        || event.keyCode === 123
        || event.which === 123;
}

function installNetworkDiagnosticsShortcut(options: any): boolean {
    const config = options || {};
    const doc = config.document;
    if (!doc || typeof doc.addEventListener !== 'function' || doc.__networkDiagnosticsF12Installed === true) {
        return false;
    }
    doc.__networkDiagnosticsF12Installed = true;
    doc.addEventListener('keydown', (event: any) => {
        if (!isNetworkDiagnosticsShortcutEvent(event)) return;
        if (typeof config.shouldHandle !== 'function' || config.shouldHandle() !== true) return;
        try {
            if (typeof config.dumpDiagnostics === 'function') config.dumpDiagnostics('F12');
        } catch (e) { /* ignore diagnostics errors */ }
    });
    return true;
}

export = {
    createNetworkDiagnosticsController,
    installNetworkDiagnosticsShortcut,
    isNetworkDiagnosticsShortcutEvent
};
