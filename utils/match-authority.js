'use strict';

const deepClone = require('./deepClone');

const PLAYER_KEYS = Object.freeze(['black', 'white']);
const HIDDEN_HAND_TOKEN_RE = /^__hidden_hand__:(black|white):(\d+)$/;
const OPERATION_ID_MAX_LENGTH = 128;

function parseSeatKeyOptional(value) {
    if (value === 1 || value === '1') return 'black';
    if (value === -1 || value === '-1') return 'white';

    const normalized = (value === null || typeof value === 'undefined')
        ? ''
        : String(value).trim().toLowerCase();

    if (normalized === 'black' || normalized === '1' || normalized === '+1') return 'black';
    if (normalized === 'white' || normalized === '-1') return 'white';
    return null;
}

function normalizePlayerKey(value, fallback) {
    return parseSeatKeyOptional(value) || parseSeatKeyOptional(fallback) || 'black';
}

function getCurrentPlayerKey(gameState) {
    if (!gameState) return 'black';
    return normalizePlayerKey(gameState.currentPlayer);
}

function getOpponentKey(playerKey) {
    return normalizePlayerKey(playerKey) === 'white' ? 'black' : 'white';
}

function normalizeOperationId(value) {
    const normalized = String(value || '').trim();
    if (!normalized) return '';
    return Array.from(normalized).slice(0, OPERATION_ID_MAX_LENGTH).join('');
}

function ensureAcceptedOperationsBySeat(room) {
    const source = (room && room.lastAcceptedOperationBySeat && typeof room.lastAcceptedOperationBySeat === 'object')
        ? room.lastAcceptedOperationBySeat
        : {};

    const normalized = {
        black: (source.black && typeof source.black === 'object') ? source.black : null,
        white: (source.white && typeof source.white === 'object') ? source.white : null
    };

    if (room && typeof room === 'object') {
        room.lastAcceptedOperationBySeat = normalized;
    }

    return normalized;
}

function makeHiddenHandToken(ownerKey, handIndex) {
    const normalizedOwner = normalizePlayerKey(ownerKey);
    const idx = Number.isFinite(Number(handIndex)) ? Math.max(0, Math.trunc(Number(handIndex))) : 0;
    return `__hidden_hand__:${normalizedOwner}:${idx}`;
}

function parseHiddenHandToken(value) {
    const match = String(value || '').match(HIDDEN_HAND_TOKEN_RE);
    if (!match) return null;
    const ownerKey = normalizePlayerKey(match[1]);
    const handIndex = Number(match[2]);
    if (!Number.isInteger(handIndex) || handIndex < 0) return null;
    return { ownerKey, handIndex };
}

function resolveCardIdFromHiddenToken(value, previousHands) {
    const parsed = parseHiddenHandToken(value);
    if (!parsed) return null;
    const ownerHand = (previousHands && Array.isArray(previousHands[parsed.ownerKey]))
        ? previousHands[parsed.ownerKey]
        : null;
    if (!ownerHand) return null;
    if (parsed.handIndex < 0 || parsed.handIndex >= ownerHand.length) return null;
    return ownerHand[parsed.handIndex];
}

function rehydrateHiddenTokensInPlace(value, previousHands, visited = new WeakSet()) {
    const resolved = resolveCardIdFromHiddenToken(value, previousHands);
    if (resolved) return resolved;
    if (!value || typeof value !== 'object') return value;
    if (visited.has(value)) return value;
    visited.add(value);
    if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i += 1) {
            value[i] = rehydrateHiddenTokensInPlace(value[i], previousHands, visited);
        }
        return value;
    }
    for (const key of Object.keys(value)) {
        value[key] = rehydrateHiddenTokensInPlace(value[key], previousHands, visited);
    }
    return value;
}

function resolveAuthenticatedSeatKey(room, seatKeyValue, seatTokenValue) {
    if (!room || !room.seatTokens) return null;
    const seatToken = String(seatTokenValue || '').trim();
    if (!seatToken) return null;

    const requestedSeat = parseSeatKeyOptional(seatKeyValue);
    if (requestedSeat) {
        return room.seatTokens[requestedSeat] === seatToken ? requestedSeat : null;
    }
    if (room.seatTokens.black === seatToken) return 'black';
    if (room.seatTokens.white === seatToken) return 'white';
    return null;
}

function validatePublishedHands(snapshot, publishingSeatKey) {
    const seatKey = parseSeatKeyOptional(publishingSeatKey);
    const cardState = (snapshot && snapshot.cardState && typeof snapshot.cardState === 'object')
        ? snapshot.cardState
        : null;
    const hands = (cardState && cardState.hands && typeof cardState.hands === 'object')
        ? cardState.hands
        : null;

    if (!seatKey || !hands) {
        return { ok: false, reason: 'INVALID_HAND_STATE' };
    }

    for (const ownerKey of PLAYER_KEYS) {
        if (!Array.isArray(hands[ownerKey])) {
            return { ok: false, reason: 'INVALID_HAND_STATE' };
        }
    }

    const opponentKey = getOpponentKey(seatKey);
    for (const cardId of hands[opponentKey]) {
        const parsed = parseHiddenHandToken(cardId);
        if (!parsed || parsed.ownerKey !== opponentKey) {
            return { ok: false, reason: 'INVALID_OPPONENT_HAND_STATE' };
        }
    }

    return { ok: true };
}

function stripTransientPresentationState(nextSnapshot) {
    const cardState = (nextSnapshot && nextSnapshot.cardState && typeof nextSnapshot.cardState === 'object')
        ? nextSnapshot.cardState
        : null;
    if (cardState) {
        cardState.presentationEvents = [];
        cardState._presentationEventsPersist = [];
        delete cardState._currentActionMeta;
    }
    if (nextSnapshot && nextSnapshot.gameState && typeof nextSnapshot.gameState === 'object') {
        delete nextSnapshot.gameState.__resultShown;
    }
    return nextSnapshot;
}

function rehydrateSnapshotForPublish(previousSnapshot, incomingSnapshot) {
    const nextSnapshot = deepClone(incomingSnapshot || {});
    if (!nextSnapshot.cardState || typeof nextSnapshot.cardState !== 'object') {
        nextSnapshot.cardState = {};
    }

    const nextCardState = nextSnapshot.cardState;
    const previousCardState = (previousSnapshot && previousSnapshot.cardState && typeof previousSnapshot.cardState === 'object')
        ? previousSnapshot.cardState
        : {};
    const previousHands = (previousCardState.hands && typeof previousCardState.hands === 'object')
        ? previousCardState.hands
        : {};

    if (!nextCardState.hands || typeof nextCardState.hands !== 'object') {
        nextCardState.hands = {};
    }

    for (const ownerKey of PLAYER_KEYS) {
        const incomingHand = Array.isArray(nextCardState.hands[ownerKey]) ? nextCardState.hands[ownerKey] : [];
        nextCardState.hands[ownerKey] = incomingHand.map((cardId) => {
            const resolved = resolveCardIdFromHiddenToken(cardId, previousHands);
            return resolved || cardId;
        });
    }

    if (Array.isArray(nextCardState.discard)) {
        nextCardState.discard = nextCardState.discard.map((cardId) => {
            const resolved = resolveCardIdFromHiddenToken(cardId, previousHands);
            return resolved || cardId;
        });
    }

    rehydrateHiddenTokensInPlace(nextCardState, previousHands);
    return stripTransientPresentationState(nextSnapshot);
}

function projectSnapshotForViewer(snapshotValue, viewerSeatKey, metadata) {
    const shot = deepClone(snapshotValue || {});
    const meta = (metadata && typeof metadata === 'object') ? metadata : {};
    if (Number.isFinite(Number(meta.stateVersion))) {
        shot.stateVersion = Number(meta.stateVersion);
    }
    if (Number.isFinite(Number(meta.updatedAt))) {
        shot.updatedAt = Number(meta.updatedAt);
    }

    const cardState = (shot.cardState && typeof shot.cardState === 'object') ? shot.cardState : null;
    if (!cardState) return shot;

    const viewer = parseSeatKeyOptional(viewerSeatKey);
    const hands = (cardState.hands && typeof cardState.hands === 'object') ? cardState.hands : {};
    const sourceHands = {};
    cardState.hands = cardState.hands && typeof cardState.hands === 'object' ? cardState.hands : {};

    for (const ownerKey of PLAYER_KEYS) {
        const ownerHand = Array.isArray(hands[ownerKey]) ? hands[ownerKey].slice() : [];
        sourceHands[ownerKey] = ownerHand;
        if (viewer && ownerKey === viewer) {
            cardState.hands[ownerKey] = ownerHand.slice();
            continue;
        }
        cardState.hands[ownerKey] = ownerHand.map((_, handIndex) => makeHiddenHandToken(ownerKey, handIndex));
    }

    const selectedOwnerKey = parseSeatKeyOptional(cardState.selectedCardOwnerKey);
    if (!viewer || !selectedOwnerKey || selectedOwnerKey !== viewer) {
        cardState.selectedCardId = null;
        cardState.selectedCardOwnerKey = null;
    }

    if (cardState.pendingEffectByPlayer && typeof cardState.pendingEffectByPlayer === 'object') {
        for (const ownerKey of PLAYER_KEYS) {
            const pending = cardState.pendingEffectByPlayer[ownerKey];
            if (!pending || pending.type !== 'CONDEMN_WILL' || !Array.isArray(pending.offers)) continue;
            const opponentKey = getOpponentKey(ownerKey);
            const opponentHand = Array.isArray(sourceHands[opponentKey]) ? sourceHands[opponentKey] : [];
            const revealToViewer = !!(viewer && ownerKey === viewer);
            pending.offers = pending.offers.map((offer, idx) => {
                const parsedToken = offer && offer.cardId ? parseHiddenHandToken(offer.cardId) : null;
                const fallbackIndex = parsedToken && Number.isInteger(parsedToken.handIndex) ? parsedToken.handIndex : idx;
                const handIndex = (offer && Number.isInteger(offer.handIndex)) ? offer.handIndex : fallbackIndex;
                if (revealToViewer) {
                    const visibleCardId = (Number.isInteger(handIndex) && handIndex >= 0 && handIndex < opponentHand.length)
                        ? opponentHand[handIndex]
                        : null;
                    return {
                        handIndex,
                        cardId: visibleCardId || makeHiddenHandToken(opponentKey, handIndex)
                    };
                }
                return {
                    handIndex,
                    cardId: makeHiddenHandToken(opponentKey, handIndex)
                };
            });
        }
    }

    return shot;
}

function buildPublicSnapshot(room, viewerSeatKey) {
    return projectSnapshotForViewer(room && room.snapshot ? room.snapshot : {}, viewerSeatKey || null, {
        stateVersion: room ? room.stateVersion : 0,
        updatedAt: room ? room.updatedAt : Date.now()
    });
}

module.exports = {
    PLAYER_KEYS,
    OPERATION_ID_MAX_LENGTH,
    parseSeatKeyOptional,
    normalizePlayerKey,
    getCurrentPlayerKey,
    getOpponentKey,
    normalizeOperationId,
    ensureAcceptedOperationsBySeat,
    makeHiddenHandToken,
    parseHiddenHandToken,
    resolveCardIdFromHiddenToken,
    rehydrateHiddenTokensInPlace,
    resolveAuthenticatedSeatKey,
    validatePublishedHands,
    stripTransientPresentationState,
    rehydrateSnapshotForPublish,
    projectSnapshotForViewer,
    buildPublicSnapshot
};