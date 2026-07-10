import type { GameState, PlayerKey } from '../../src/types';

interface MatchAuthorityPendingSelectionDeps {
    deepClone: (value: unknown) => unknown;
    normalizePlayerKey: (value: unknown, fallback?: unknown) => PlayerKey;
    getCurrentPlayerKey: (gameState: Partial<GameState> | null | undefined) => PlayerKey;
    isFateWillControllerForCurrentTurn: (snapshot: unknown, seatKey: PlayerKey | null | undefined) => boolean;
    normalizePendingType: (value: unknown) => string;
    normalizePendingEffectId: (value: unknown) => string | null;
}

function asRecord(value: unknown): Record<string, any> {
    return value && typeof value === 'object' ? value as Record<string, any> : {};
}

export function createMatchAuthorityPendingSelectionApi(deps: MatchAuthorityPendingSelectionDeps) {
    function normalizeCardIdOptional(value: unknown): string | null {
        const normalized = String(value || '').trim();
        return normalized || null;
    }

    function hasCardInHandForAuthority(cardState: unknown, ownerKey: unknown, cardId: unknown): boolean {
        const state = asRecord(cardState);
        const hands = state.hands && typeof state.hands === 'object' ? asRecord(state.hands) : null;
        const owner = deps.normalizePlayerKey(ownerKey);
        const hand = hands && Array.isArray(hands[owner]) ? hands[owner] : [];
        const normalizedCardId = normalizeCardIdOptional(cardId);
        if (!normalizedCardId) return false;
        for (let index = 0; index < hand.length; index += 1) {
            if (normalizeCardIdOptional(hand[index]) === normalizedCardId) return true;
        }
        return false;
    }

    function hasCardInDiscardForAuthority(cardState: unknown, cardId: unknown): boolean {
        const state = asRecord(cardState);
        const discard = Array.isArray(state.discard) ? state.discard : [];
        const normalizedCardId = normalizeCardIdOptional(cardId);
        if (!normalizedCardId) return false;
        for (let index = 0; index < discard.length; index += 1) {
            if (normalizeCardIdOptional(discard[index]) === normalizedCardId) return true;
        }
        return false;
    }

    function shouldStripCommittedPendingCardUse(cardState: unknown, playerKey: unknown, action: unknown, expectedPending: unknown): boolean {
        const state = asRecord(cardState);
        const actionRecord = asRecord(action);
        const pendingRecord = asRecord(expectedPending);
        const normalizedPlayerKey = deps.normalizePlayerKey(playerKey);
        const normalizedUseCardId = normalizeCardIdOptional(actionRecord.useCardId);
        const normalizedPendingCardId = normalizeCardIdOptional(pendingRecord.cardId);
        if (!normalizedUseCardId || !normalizedPendingCardId || normalizedUseCardId !== normalizedPendingCardId) return false;
        const normalizedHandOwnerKey = deps.normalizePlayerKey(actionRecord.useCardOwnerKey, normalizedPlayerKey);
        const hasUsedCardThisTurn = !!(
            state.hasUsedCardThisTurnByPlayer
            && asRecord(state.hasUsedCardThisTurnByPlayer)[normalizedPlayerKey] === true
        );
        const cardStillInHand = hasCardInHandForAuthority(cardState, normalizedHandOwnerKey, normalizedUseCardId);
        const cardAlreadyInDiscard = hasCardInDiscardForAuthority(cardState, normalizedUseCardId);
        return hasUsedCardThisTurn || cardAlreadyInDiscard || !cardStillInHand;
    }

    function validatePendingSelectionPublish(
        snapshotValue: unknown,
        playerKey: unknown,
        actionValue: unknown
    ): { ok: boolean; pendingEffectId?: string | null; rejectedReason?: string } {
        const action = (actionValue && typeof actionValue === 'object') ? asRecord(actionValue) : null;
        const pendingSelectionState = (action && action.pendingSelectionState && typeof action.pendingSelectionState === 'object')
            ? asRecord(action.pendingSelectionState)
            : null;
        if (!pendingSelectionState) return { ok: true };
        const snapshot = (snapshotValue && typeof snapshotValue === 'object') ? asRecord(snapshotValue) : null;
        const cardState = (snapshot && snapshot.cardState && typeof snapshot.cardState === 'object') ? asRecord(snapshot.cardState) : null;
        const pendingByPlayer = (cardState && cardState.pendingEffectByPlayer && typeof cardState.pendingEffectByPlayer === 'object')
            ? asRecord(cardState.pendingEffectByPlayer)
            : null;
        let expectedPending = pendingByPlayer ? asRecord(pendingByPlayer[deps.normalizePlayerKey(playerKey)]) : null;
        if (!expectedPending || !expectedPending.type) {
            if (deps.isFateWillControllerForCurrentTurn(snapshotValue, deps.normalizePlayerKey(playerKey))) {
                const ownerKey = deps.getCurrentPlayerKey(snapshot && snapshot.gameState as Partial<GameState> | null);
                if (ownerKey) {
                    const ownerPending = pendingByPlayer ? asRecord(pendingByPlayer[ownerKey]) : null;
                    if (ownerPending && ownerPending.type) expectedPending = ownerPending;
                }
            }
        }
        if (!expectedPending || !expectedPending.type) {
            const hasCompatibilityCardContext = !!(
                action
                && typeof action.useCardId === 'string'
                && String(action.useCardId).trim()
                && typeof action.useCardOwnerKey === 'string'
                && String(action.useCardOwnerKey).trim()
            );
            return hasCompatibilityCardContext
                ? { ok: true, pendingEffectId: null }
                : { ok: false, rejectedReason: 'STALE_PENDING_SELECTION' };
        }
        const requestedType = deps.normalizePendingType(pendingSelectionState.type);
        const expectedType = deps.normalizePendingType(expectedPending.type);
        if (requestedType && expectedType && requestedType !== expectedType) {
            return { ok: false, rejectedReason: 'STALE_PENDING_SELECTION' };
        }
        const requestedCardId = normalizeCardIdOptional(pendingSelectionState.cardId);
        const expectedCardId = normalizeCardIdOptional(expectedPending.cardId);
        if (requestedCardId && expectedCardId && requestedCardId !== expectedCardId) {
            return { ok: false, rejectedReason: 'STALE_PENDING_SELECTION' };
        }
        const expectedPendingEffectId = deps.normalizePendingEffectId(expectedPending.pendingEffectId);
        const requestedPendingEffectId = deps.normalizePendingEffectId(pendingSelectionState.pendingEffectId);
        if (expectedPendingEffectId && requestedPendingEffectId !== expectedPendingEffectId) {
            return { ok: false, rejectedReason: 'STALE_PENDING_SELECTION' };
        }
        return { ok: true, pendingEffectId: expectedPendingEffectId };
    }

    function sanitizePendingSelectionActionForAuthority(snapshotValue: unknown, playerKey: unknown, actionValue: unknown): unknown {
        const action = (actionValue && typeof actionValue === 'object') ? asRecord(actionValue) : null;
        if (!action) return actionValue;
        const pendingSelectionState = (action.pendingSelectionState && typeof action.pendingSelectionState === 'object')
            ? asRecord(action.pendingSelectionState)
            : null;
        if (!pendingSelectionState) return actionValue;
        const snapshot = (snapshotValue && typeof snapshotValue === 'object') ? asRecord(snapshotValue) : null;
        const cardState = (snapshot && snapshot.cardState && typeof snapshot.cardState === 'object') ? asRecord(snapshot.cardState) : null;
        const pendingByPlayer = (cardState && cardState.pendingEffectByPlayer && typeof cardState.pendingEffectByPlayer === 'object')
            ? asRecord(cardState.pendingEffectByPlayer)
            : null;
        const expectedPending = pendingByPlayer ? asRecord(pendingByPlayer[deps.normalizePlayerKey(playerKey)]) : null;
        if (!expectedPending || !expectedPending.type) return actionValue;
        if (!shouldStripCommittedPendingCardUse(cardState, playerKey, action, expectedPending)) return actionValue;
        const nextAction = deps.deepClone(action) as Record<string, unknown>;
        delete nextAction.useCardId;
        delete nextAction.useCardOwnerKey;
        delete nextAction.useCardHandIndex;
        return nextAction;
    }

    return { validatePendingSelectionPublish, sanitizePendingSelectionActionForAuthority };
}
