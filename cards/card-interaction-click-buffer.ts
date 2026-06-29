export {};

type ClickBufferDeps = {
    getUiRootRef: () => any;
    normalizeOwnerKey: (ownerKey: any) => any;
};

function getServerAuthoredCardUseClickBuffer(deps: ClickBufferDeps) {
    const rootRef = deps.getUiRootRef();
    if (!rootRef) return null;
    if (!rootRef.__serverAuthoredCardUseClickBuffer || typeof rootRef.__serverAuthoredCardUseClickBuffer !== 'object') {
        rootRef.__serverAuthoredCardUseClickBuffer = {
            active: false,
            playerKey: null,
            ownerKey: null,
            cardId: null,
            click: null
        };
    }
    if (typeof rootRef.__captureServerAuthoredCardUseBoardClick !== 'function') {
        rootRef.__captureServerAuthoredCardUseBoardClick = function captureServerAuthoredCardUseBoardClick(row: any, col: any, playerKey: any) {
            const buffer = rootRef.__serverAuthoredCardUseClickBuffer;
            if (!buffer || buffer.active !== true) return false;
            const normalizedPlayer = deps.normalizeOwnerKey(playerKey);
            const matchesPlayerKey = !buffer.playerKey || !normalizedPlayer || buffer.playerKey === normalizedPlayer;
            const matchesOwnerKey = !buffer.ownerKey || !normalizedPlayer || buffer.ownerKey === normalizedPlayer;
            if (!matchesPlayerKey && !matchesOwnerKey) return false;
            if (!Number.isFinite(Number(row)) || !Number.isFinite(Number(col))) return false;
            buffer.click = {
                row: Math.trunc(Number(row)),
                col: Math.trunc(Number(col)),
                playerKey: normalizedPlayer || buffer.playerKey || null
            };
            return true;
        };
    }
    try {
        if (typeof globalThis !== 'undefined' && globalThis && globalThis !== rootRef) {
            (globalThis as any).__serverAuthoredCardUseClickBuffer = rootRef.__serverAuthoredCardUseClickBuffer;
            (globalThis as any).__captureServerAuthoredCardUseBoardClick = rootRef.__captureServerAuthoredCardUseBoardClick;
        }
    } catch (e) { /* ignore */ }
    return rootRef.__serverAuthoredCardUseClickBuffer;
}

function beginServerAuthoredCardUseClickBuffer(playerKey: any, ownerKey: any, cardId: any, deps: ClickBufferDeps) {
    const buffer = getServerAuthoredCardUseClickBuffer(deps);
    if (!buffer) return;
    buffer.active = true;
    buffer.playerKey = deps.normalizeOwnerKey(playerKey);
    buffer.ownerKey = deps.normalizeOwnerKey(ownerKey);
    buffer.cardId = cardId || null;
    buffer.click = null;
}

function consumeServerAuthoredCardUseClickBuffer(playerKey: any, ownerKey: any, cardId: any, deps: ClickBufferDeps) {
    const buffer = getServerAuthoredCardUseClickBuffer(deps);
    if (!buffer || buffer.active !== true) return null;
    const matches = (!buffer.playerKey || buffer.playerKey === deps.normalizeOwnerKey(playerKey))
        && (!buffer.ownerKey || buffer.ownerKey === deps.normalizeOwnerKey(ownerKey))
        && (!buffer.cardId || buffer.cardId === cardId);
    const click = matches && buffer.click ? buffer.click : null;
    buffer.active = false;
    buffer.playerKey = null;
    buffer.ownerKey = null;
    buffer.cardId = null;
    buffer.click = null;
    return click;
}

function clearServerAuthoredCardUseClickBuffer(deps: ClickBufferDeps) {
    const buffer = getServerAuthoredCardUseClickBuffer(deps);
    if (!buffer) return;
    buffer.active = false;
    buffer.playerKey = null;
    buffer.ownerKey = null;
    buffer.cardId = null;
    buffer.click = null;
}

module.exports = {
    getServerAuthoredCardUseClickBuffer,
    beginServerAuthoredCardUseClickBuffer,
    consumeServerAuthoredCardUseClickBuffer,
    clearServerAuthoredCardUseClickBuffer
};
