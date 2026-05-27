const SUB_PLACEMENT_PENDING_TYPES = Object.freeze({
    DOUBLE_PLACE: true,
    TRIPLE_PLACE: true,
    QUAD_PLACE: true,
    INFINITE_PLACE: true,
    LAST_RESORT: true
} as Record<string, true>);

function normalizePlayerKey(playerKey: any): 'black' | 'white' | null {
    if (playerKey === 1 || playerKey === '1' || playerKey === '+1' || playerKey === 'black') return 'black';
    if (playerKey === -1 || playerKey === '-1' || playerKey === 'white') return 'white';
    const normalized = String(playerKey || '').trim().toLowerCase();
    if (normalized === 'black') return 'black';
    if (normalized === 'white') return 'white';
    return null;
}

function getPendingEffect(cardState: any, playerKey: any): any {
    const ownerKey = normalizePlayerKey(playerKey);
    if (!ownerKey || !cardState || !cardState.pendingEffectByPlayer || typeof cardState.pendingEffectByPlayer !== 'object') {
        return null;
    }
    return cardState.pendingEffectByPlayer[ownerKey] || null;
}

function getPendingEffectType(cardState: any, playerKey: any): string | null {
    const pending = getPendingEffect(cardState, playerKey);
    if (!pending || typeof pending !== 'object') return null;
    const type = String(pending.type || '').trim().toUpperCase();
    return type || null;
}

function isSubPlacementPendingType(type: any): boolean {
    const key = String(type || '').trim().toUpperCase();
    return !!(SUB_PLACEMENT_PENDING_TYPES as Record<string, true>)[key];
}

function isSubPlacementContinuationActive(cardState: any, playerKey: any): boolean {
    const ownerKey = normalizePlayerKey(playerKey);
    if (!ownerKey || !cardState || typeof cardState !== 'object') return false;

    const extraByPlayer = cardState.extraPlaceRemainingByPlayer && typeof cardState.extraPlaceRemainingByPlayer === 'object'
        ? cardState.extraPlaceRemainingByPlayer
        : null;
    if (extraByPlayer && Number(extraByPlayer[ownerKey]) > 0) return true;

    const infiniteByPlayer = cardState.infinitePlaceActiveByPlayer && typeof cardState.infinitePlaceActiveByPlayer === 'object'
        ? cardState.infinitePlaceActiveByPlayer
        : null;
    if (infiniteByPlayer && infiniteByPlayer[ownerKey] === true) return true;

    const pending = getPendingEffect(cardState, ownerKey);
    return !!(
        pending &&
        typeof pending === 'object' &&
        String(pending.type || '').trim().toUpperCase() === 'LAST_RESORT' &&
        Number(pending.placementsRemaining || 0) > 0
    );
}

function isSubPlacementTurnActive(cardState: any, playerKey: any): boolean {
    if (isSubPlacementContinuationActive(cardState, playerKey)) return true;
    const pendingType = getPendingEffectType(cardState, playerKey);
    return isSubPlacementPendingType(pendingType);
}

const SubPlacementContinuationModule = {
    isSubPlacementContinuationActive,
    isSubPlacementTurnActive,
    isSubPlacementPendingType
};

export = SubPlacementContinuationModule;
