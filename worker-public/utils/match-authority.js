'use strict';

const deepClone = require('./deepClone');
const SharedBoardUtils = require('../shared/shared-board-utils');
const GachaHandCatalogShared = require('../shared/gacha-hand-catalog-shared.js');

const PLAYER_KEYS = Object.freeze(['black', 'white']);
const HIDDEN_HAND_TOKEN_PREFIX = '__hidden_hand__:';
const HIDDEN_HAND_TOKEN_RE = /^__hidden_hand__:(black|white):(\d+)$/;
const OPERATION_ID_MAX_LENGTH = 128;
const HAND_SKIN_ID_MAX_LENGTH = 128;
const SSE_RESUME_BUFFER_LIMIT = 96;
const ACCEPTED_OPERATION_HISTORY_LIMIT = 16;
const NETWORK_PLAYER_NAME_MAX = 7;
const VERSION_REJECTION_REASONS = Object.freeze({
    AHEAD: 'VERSION_AHEAD',
    BEHIND: 'VERSION_BEHIND',
    GAP: 'VERSION_GAP',
    MISMATCH: 'VERSION_MISMATCH'
});

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

function normalizeSeatHandSkinId(value) {
    const normalized = String(value || '').trim();
    if (!normalized) return '';
    const canonical = (GachaHandCatalogShared && typeof GachaHandCatalogShared.normalizeCatalogItemId === 'function')
        ? GachaHandCatalogShared.normalizeCatalogItemId(normalized)
        : normalized;
    return Array.from(canonical).slice(0, HAND_SKIN_ID_MAX_LENGTH).join('');
}

function normalizeSeatHandSkins(value) {
    const source = (value && typeof value === 'object') ? value : {};
    return {
        black: normalizeSeatHandSkinId(source.black),
        white: normalizeSeatHandSkinId(source.white)
    };
}

function normalizeNetworkPlayerName(value) {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    return Array.from(normalized).slice(0, NETWORK_PLAYER_NAME_MAX).join('');
}

function normalizePublicSeats(value) {
    const source = (value && typeof value === 'object') ? value : {};
    return {
        black: !!source.black,
        white: !!source.white
    };
}

function buildPublicSeatMetadata(value) {
    const source = (value && typeof value === 'object') ? value : {};
    const seatNames = (source.seatNames && typeof source.seatNames === 'object') ? source.seatNames : {};
    return {
        seats: normalizePublicSeats(source.seats),
        seatNames: {
            black: normalizeNetworkPlayerName(seatNames.black),
            white: normalizeNetworkPlayerName(seatNames.white)
        },
        seatHandSkins: normalizeSeatHandSkins(source.seatHandSkins)
    };
}

function hasRequiredOperationId(value) {
    return normalizeOperationId(value) !== '';
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

function normalizeAcceptedOperationEntry(value) {
    const source = (value && typeof value === 'object') ? value : null;
    if (!source) return null;
    const operationId = normalizeOperationId(source.operationId);
    if (!operationId) return null;
    return {
        operationId,
        stateVersion: normalizeStateVersion(source.stateVersion),
        updatedAt: Number.isFinite(Number(source.updatedAt)) ? Number(source.updatedAt) : null
    };
}

function ensureAcceptedOperationHistoryBySeat(room) {
    const historySource = (room && room.acceptedOperationHistoryBySeat && typeof room.acceptedOperationHistoryBySeat === 'object')
        ? room.acceptedOperationHistoryBySeat
        : {};
    const lastAcceptedBySeat = ensureAcceptedOperationsBySeat(room);
    const normalized = {
        black: [],
        white: []
    };

    for (const seatKey of PLAYER_KEYS) {
        const sourceEntries = Array.isArray(historySource[seatKey])
            ? historySource[seatKey]
            : [];
        const combined = sourceEntries.slice();
        if (combined.length === 0 && lastAcceptedBySeat[seatKey]) {
            combined.push(lastAcceptedBySeat[seatKey]);
        }
        const seen = new Set();
        const entries = [];
        for (const entry of combined) {
            const normalizedEntry = normalizeAcceptedOperationEntry(entry);
            if (!normalizedEntry || seen.has(normalizedEntry.operationId)) continue;
            seen.add(normalizedEntry.operationId);
            entries.push(normalizedEntry);
        }
        normalized[seatKey] = entries.slice(-ACCEPTED_OPERATION_HISTORY_LIMIT);
        lastAcceptedBySeat[seatKey] = normalized[seatKey].length > 0
            ? normalized[seatKey][normalized[seatKey].length - 1]
            : null;
    }

    if (room && typeof room === 'object') {
        room.acceptedOperationHistoryBySeat = normalized;
        room.lastAcceptedOperationBySeat = lastAcceptedBySeat;
    }

    return normalized;
}

function findAcceptedOperationBySeat(room, seatKey, operationId) {
    const normalizedSeat = normalizePlayerKey(seatKey);
    const normalizedOperationId = normalizeOperationId(operationId);
    if (!normalizedOperationId) return null;
    const historyBySeat = ensureAcceptedOperationHistoryBySeat(room);
    const seatHistory = Array.isArray(historyBySeat[normalizedSeat]) ? historyBySeat[normalizedSeat] : [];
    for (let index = seatHistory.length - 1; index >= 0; index -= 1) {
        if (seatHistory[index] && seatHistory[index].operationId === normalizedOperationId) {
            return seatHistory[index];
        }
    }
    return null;
}

function rememberAcceptedOperationBySeat(room, seatKey, entry) {
    const normalizedSeat = normalizePlayerKey(seatKey);
    const normalizedEntry = normalizeAcceptedOperationEntry(entry);
    if (!normalizedEntry) return null;
    const historyBySeat = ensureAcceptedOperationHistoryBySeat(room);
    const currentEntries = Array.isArray(historyBySeat[normalizedSeat]) ? historyBySeat[normalizedSeat] : [];
    const nextEntries = currentEntries.filter((one) => !one || one.operationId !== normalizedEntry.operationId);
    nextEntries.push(normalizedEntry);
    historyBySeat[normalizedSeat] = nextEntries.slice(-ACCEPTED_OPERATION_HISTORY_LIMIT);
    if (room && typeof room === 'object') {
        room.acceptedOperationHistoryBySeat = historyBySeat;
        room.lastAcceptedOperationBySeat = room.lastAcceptedOperationBySeat && typeof room.lastAcceptedOperationBySeat === 'object'
            ? room.lastAcceptedOperationBySeat
            : { black: null, white: null };
        room.lastAcceptedOperationBySeat[normalizedSeat] = historyBySeat[normalizedSeat][historyBySeat[normalizedSeat].length - 1] || null;
    }
    return historyBySeat[normalizedSeat][historyBySeat[normalizedSeat].length - 1] || null;
}

function normalizeStateVersion(value) {
    return Number.isFinite(Number(value))
        ? Number(value)
        : null;
}

function classifyVersionRejectionReason(receivedBaseVersionValue, authoritativeStateVersionValue) {
    const receivedMissing = receivedBaseVersionValue === null
        || receivedBaseVersionValue === undefined
        || (typeof receivedBaseVersionValue === 'string' && receivedBaseVersionValue.trim() === '');
    const authoritativeMissing = authoritativeStateVersionValue === null
        || authoritativeStateVersionValue === undefined
        || (typeof authoritativeStateVersionValue === 'string' && authoritativeStateVersionValue.trim() === '');
    if (receivedMissing || authoritativeMissing) {
        return VERSION_REJECTION_REASONS.GAP;
    }
    const receivedBaseVersion = normalizeStateVersion(receivedBaseVersionValue);
    const authoritativeStateVersion = normalizeStateVersion(authoritativeStateVersionValue);
    if (receivedBaseVersion === null || authoritativeStateVersion === null) {
        return VERSION_REJECTION_REASONS.GAP;
    }
    if (receivedBaseVersion < authoritativeStateVersion) {
        return VERSION_REJECTION_REASONS.AHEAD;
    }
    if (receivedBaseVersion > authoritativeStateVersion) {
        return VERSION_REJECTION_REASONS.BEHIND;
    }
    return VERSION_REJECTION_REASONS.MISMATCH;
}

function isVersionRejectionReason(reasonValue) {
    const normalized = String(reasonValue || '').trim();
    return normalized === VERSION_REJECTION_REASONS.MISMATCH
        || normalized === VERSION_REJECTION_REASONS.AHEAD
        || normalized === VERSION_REJECTION_REASONS.BEHIND
        || normalized === VERSION_REJECTION_REASONS.GAP;
}

function normalizePublishActionType(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized || null;
}

function normalizePublishMeta(value) {
    const source = (value && typeof value === 'object') ? value : {};
    const normalizedKind = String(source.kind || '').trim().toLowerCase();
    const normalized = {
        kind: normalizedKind || null,
        operationId: normalizeOperationId(source.operationId),
        actionType: normalizePublishActionType(source.actionType),
        receivedBaseVersion: normalizeStateVersion(source.receivedBaseVersion),
        authoritativeStateVersion: normalizeStateVersion(source.authoritativeStateVersion),
        replayedStateVersion: normalizeStateVersion(source.replayedStateVersion),
        rejectedReason: source.rejectedReason ? String(source.rejectedReason).trim() : null
    };

    if (!normalized.operationId) normalized.operationId = '';
    return normalized;
}

function normalizeEffectLogMessages(values) {
    const source = Array.isArray(values) ? values : [];
    const next = [];
    for (let index = 0; index < source.length; index += 1) {
        const text = String(source[index] || '').trim();
        if (!text) continue;
        if (next.length > 0 && next[next.length - 1] === text) continue;
        next.push(text);
    }
    return next;
}

function appendEffectLogMessages(...lists) {
    const merged = [];
    for (let index = 0; index < lists.length; index += 1) {
        const list = Array.isArray(lists[index]) ? lists[index] : [];
        for (let innerIndex = 0; innerIndex < list.length; innerIndex += 1) {
            merged.push(list[innerIndex]);
        }
    }
    return normalizeEffectLogMessages(merged);
}

function normalizeRoomBoardConfig(value, fallbackBoard) {
    const source = (value !== null && typeof value !== 'undefined') ? value : fallbackBoard;
    if (SharedBoardUtils && typeof SharedBoardUtils.resolveBoardConfig === 'function') {
        const normalized = SharedBoardUtils.resolveBoardConfig(source);
        return normalized ? deepClone(normalized) : null;
    }

    const fallback = Array.isArray(source)
        ? source
        : ((source && Array.isArray(source.board)) ? source.board : (Array.isArray(fallbackBoard) ? fallbackBoard : null));
    const rows = Number(value && value.rows);
    const cols = Number(value && value.cols);
    const fallbackRows = Array.isArray(fallback) ? fallback.length : NaN;
    const fallbackCols = Array.isArray(fallback) && Array.isArray(fallback[0]) ? fallback[0].length : NaN;
    const normalizedRows = Number.isFinite(rows) && rows > 0
        ? Math.trunc(rows)
        : (Number.isFinite(fallbackRows) && fallbackRows > 0 ? Math.trunc(fallbackRows) : 8);
    const normalizedCols = Number.isFinite(cols) && cols > 0
        ? Math.trunc(cols)
        : (Number.isFinite(fallbackCols) && fallbackCols > 0 ? Math.trunc(fallbackCols) : 8);
    return {
        rows: normalizedRows,
        cols: normalizedCols,
        standard8x8: normalizedRows === 8 && normalizedCols === 8,
        baseBounds: {
            minRow: 0,
            maxRow: normalizedRows - 1,
            minCol: 0,
            maxCol: normalizedCols - 1
        },
        outerBounds: {
            minRow: -1,
            maxRow: normalizedRows,
            minCol: -1,
            maxCol: normalizedCols
        }
    };
}

function resolveRoomBoardConfig(value) {
    const source = (value && typeof value === 'object') ? value : {};
    return normalizeRoomBoardConfig(
        source.boardConfig || source.roomBoardConfig,
        source.snapshot && source.snapshot.gameState && source.snapshot.gameState.board
    );
}

function buildPublishResponsePayload(options) {
    const opts = (options && typeof options === 'object') ? options : {};
    const hasSeats = opts.seats && typeof opts.seats === 'object';
    const hasSeatNames = opts.seatNames && typeof opts.seatNames === 'object';
    const hasSeatHandSkins = opts.seatHandSkins && typeof opts.seatHandSkins === 'object';
    const publicSeatMetadata = (hasSeats || hasSeatNames || hasSeatHandSkins)
        ? buildPublicSeatMetadata(opts)
        : null;
    const payload = {
        ok: opts.ok === true,
        roomId: opts.roomId ? String(opts.roomId).trim().toUpperCase() : null,
        stateVersion: normalizeStateVersion(opts.stateVersion),
        snapshot: (opts.snapshot && typeof opts.snapshot === 'object') ? opts.snapshot : null,
        seats: (publicSeatMetadata && hasSeats) ? publicSeatMetadata.seats : null,
        seatNames: (publicSeatMetadata && hasSeatNames) ? publicSeatMetadata.seatNames : null,
        seatHandSkins: (publicSeatMetadata && hasSeatHandSkins) ? publicSeatMetadata.seatHandSkins : null,
        roomDeck: Object.prototype.hasOwnProperty.call(opts, 'roomDeck') ? opts.roomDeck : null,
        networkDebugEnabled: opts.networkDebugEnabled === true,
        turnTimer: (opts.turnTimer && typeof opts.turnTimer === 'object') ? opts.turnTimer : null,
        playbackEvents: Array.isArray(opts.playbackEvents) ? opts.playbackEvents : [],
        effectLogs: normalizeEffectLogMessages(opts.effectLogs),
        serverTime: Number.isFinite(Number(opts.serverTime)) ? Number(opts.serverTime) : Date.now()
    };

    if (payload.ok !== true) {
        payload.rejectedReason = opts.rejectedReason ? String(opts.rejectedReason).trim() : null;
    }
    if (opts.idempotentReplay === true) {
        payload.idempotentReplay = true;
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'errorMessage')) {
        payload.errorMessage = opts.errorMessage || null;
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'playbackDiagnostics')) {
        payload.playbackDiagnostics = opts.playbackDiagnostics || null;
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'roomBoardConfig')) {
        payload.roomBoardConfig = opts.roomBoardConfig;
    }

    const publishMeta = normalizePublishMeta(opts.publishMeta);
    if (
        publishMeta.kind
        || publishMeta.operationId
        || publishMeta.actionType
        || publishMeta.receivedBaseVersion !== null
        || publishMeta.authoritativeStateVersion !== null
        || publishMeta.replayedStateVersion !== null
        || publishMeta.rejectedReason
    ) {
        payload.publishMeta = publishMeta;
    }

    return payload;
}

function makeHiddenHandToken(ownerKey, handIndex) {
    const normalizedOwner = normalizePlayerKey(ownerKey);
    const idx = Number.isFinite(Number(handIndex)) ? Math.max(0, Math.trunc(Number(handIndex))) : 0;
    return `${HIDDEN_HAND_TOKEN_PREFIX}${normalizedOwner}:${idx}`;
}

function isHiddenHandTokenLike(value) {
    return typeof value === 'string' && value.startsWith(HIDDEN_HAND_TOKEN_PREFIX);
}

function parseHiddenHandToken(value) {
    const match = String(value || '').match(HIDDEN_HAND_TOKEN_RE);
    if (!match) return null;
    const ownerKey = normalizePlayerKey(match[1]);
    const handIndex = Number(match[2]);
    if (!Number.isInteger(handIndex) || handIndex < 0) return null;
    return { ownerKey, handIndex };
}

function normalizeProjectedHandIndex(value, fallbackIndex, handLength) {
    if (!Number.isInteger(handLength) || handLength <= 0) return null;
    if (Number.isInteger(value) && value >= 0 && value < handLength) return value;
    if (Number.isInteger(fallbackIndex) && fallbackIndex >= 0 && fallbackIndex < handLength) return fallbackIndex;
    return null;
}

function normalizeCardCopyIdList(values) {
    if (!Array.isArray(values)) return [];
    const next = [];
    for (const rawValue of values) {
        const numeric = Number(rawValue);
        if (!Number.isInteger(numeric) || numeric <= 0) continue;
        next.push(numeric);
    }
    return next;
}

function normalizeHandCopyIdArray(values, targetLength) {
    const length = Number.isFinite(Number(targetLength)) ? Math.max(0, Math.trunc(Number(targetLength))) : 0;
    const next = Array(length).fill(null);
    if (!Array.isArray(values)) return next;
    for (let index = 0; index < length; index += 1) {
        const numeric = Number(values[index]);
        next[index] = Number.isInteger(numeric) && numeric > 0 ? numeric : null;
    }
    return next;
}

function resolveAuthenticatedSeatKey(room, seatKeyValue, seatTokenValue) {
    if (!room || !room.seatTokens || !room.seats) return null;
    const seatToken = String(seatTokenValue || '').trim();
    if (!seatToken) return null;

    const requestedSeat = parseSeatKeyOptional(seatKeyValue);
    if (requestedSeat) {
        return room.seats[requestedSeat] === true && room.seatTokens[requestedSeat] === seatToken
            ? requestedSeat
            : null;
    }
    if (room.seats.black === true && room.seatTokens.black === seatToken) return 'black';
    if (room.seats.white === true && room.seatTokens.white === seatToken) return 'white';
    return null;
}

function classifySeatTokenRejectionReason(seatTokenValue) {
    return String(seatTokenValue || '').trim()
        ? 'SEAT_TOKEN_MISMATCH'
        : 'SEAT_TOKEN_REQUIRED';
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

function stripTransientChargeDeltaState(nextSnapshot) {
    const cardState = (nextSnapshot && nextSnapshot.cardState && typeof nextSnapshot.cardState === 'object')
        ? nextSnapshot.cardState
        : null;
    if (cardState) {
        cardState.chargeDeltaEvents = [];
    }
    return nextSnapshot;
}

function isTrapStoneLike(entry) {
    if (!entry || typeof entry !== 'object') return false;
    if (entry.data && entry.data.type === 'TRAP') return true;
    return entry.type === 'TRAP';
}

function isTrapVisibleToViewer(entry, viewerSeatKey) {
    if (!isTrapStoneLike(entry)) return true;
    const ownerKey = parseSeatKeyOptional(entry.owner);
    if (!ownerKey) return false;
    return ownerKey === viewerSeatKey;
}

function sanitizeOwnerOnlyTrapState(cardState, viewerSeatKey) {
    if (!cardState || typeof cardState !== 'object') return cardState;
    const viewer = parseSeatKeyOptional(viewerSeatKey);

    if (Array.isArray(cardState.markers)) {
        cardState.markers = cardState.markers.filter((marker) => isTrapVisibleToViewer(marker, viewer));
    }

    if (Array.isArray(cardState.specialStones)) {
        cardState.specialStones = cardState.specialStones.filter((stone) => isTrapVisibleToViewer(stone, viewer));
    }

    return cardState;
}

/**
 * Returns the FATE_WILL controller seat key for the given turn owner, or null if none.
 * Reads from snapshot.cardState.fateWillControllerByTurnOwner.
 */
function getFateWillControllerKey(snapshot, turnOwnerKey) {
    const cardState = (snapshot && snapshot.cardState && typeof snapshot.cardState === 'object')
        ? snapshot.cardState
        : null;
    if (!cardState) return null;
    const controllerMap = (cardState.fateWillControllerByTurnOwner && typeof cardState.fateWillControllerByTurnOwner === 'object')
        ? cardState.fateWillControllerByTurnOwner
        : {};
    const owner = parseSeatKeyOptional(turnOwnerKey);
    if (!owner) return null;
    return parseSeatKeyOptional(controllerMap[owner]) || null;
}

/**
 * Returns true if seatKey is the authenticated FATE_WILL controller for the current turn owner.
 * Only valid when it is currently the turn owner's turn (gameState.currentPlayer === turnOwnerKey).
 */
function isFateWillControllerForCurrentTurn(snapshot, seatKey) {
    const seat = parseSeatKeyOptional(seatKey);
    if (!seat) return false;
    const gameState = (snapshot && snapshot.gameState && typeof snapshot.gameState === 'object')
        ? snapshot.gameState
        : null;
    const currentPlayerKey = getCurrentPlayerKey(gameState);
    if (seat === currentPlayerKey) return false;
    const controllerKey = getFateWillControllerKey(snapshot, currentPlayerKey);
    return controllerKey === seat;
}

function canViewerInspectOwnerHand(snapshot, viewerSeatKey, ownerSeatKey) {
    const viewer = parseSeatKeyOptional(viewerSeatKey);
    const owner = parseSeatKeyOptional(ownerSeatKey);
    if (!viewer || !owner) return false;
    if (viewer === owner) return true;
    const gameState = (snapshot && snapshot.gameState && typeof snapshot.gameState === 'object')
        ? snapshot.gameState
        : null;
    const currentPlayerKey = getCurrentPlayerKey(gameState);
    if (owner !== currentPlayerKey) return false;
    return getFateWillControllerKey(snapshot, owner) === viewer;
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
    sanitizeOwnerOnlyTrapState(cardState, viewer);
    const hands = (cardState.hands && typeof cardState.hands === 'object') ? cardState.hands : {};
    const sourceHands = {};
    const handCopyIdsByPlayer = (cardState._handCopyIdsByPlayer && typeof cardState._handCopyIdsByPlayer === 'object')
        ? cardState._handCopyIdsByPlayer
        : {};
    const revealedHandCopyIdsByViewer = (cardState._revealedHandCopyIdsByViewer && typeof cardState._revealedHandCopyIdsByViewer === 'object')
        ? cardState._revealedHandCopyIdsByViewer
        : {};
    const revealedCopyIdsForViewer = viewer
        ? new Set(normalizeCardCopyIdList(revealedHandCopyIdsByViewer[viewer]))
        : new Set();
    cardState.hands = cardState.hands && typeof cardState.hands === 'object' ? cardState.hands : {};

    for (const ownerKey of PLAYER_KEYS) {
        const ownerHand = Array.isArray(hands[ownerKey])
            ? hands[ownerKey].map((cardId, handIndex) => (
                isHiddenHandTokenLike(cardId)
                    ? makeHiddenHandToken(ownerKey, handIndex)
                    : cardId
            ))
            : [];
        const ownerHandCopyIds = normalizeHandCopyIdArray(handCopyIdsByPlayer[ownerKey], ownerHand.length);
        sourceHands[ownerKey] = ownerHand;
        if (canViewerInspectOwnerHand(shot, viewer, ownerKey)) {
            cardState.hands[ownerKey] = ownerHand.slice();
            continue;
        }
        cardState.hands[ownerKey] = ownerHand.map((cardId, handIndex) => {
            const cardCopyId = ownerHandCopyIds[handIndex];
            const shouldReveal = viewer
                && Number.isInteger(cardCopyId)
                && revealedCopyIdsForViewer.has(cardCopyId)
                && !isHiddenHandTokenLike(cardId);
            return shouldReveal ? cardId : makeHiddenHandToken(ownerKey, handIndex);
        });
    }

    if (Array.isArray(cardState.discard)) {
        cardState.discard = cardState.discard.filter((cardId) => !isHiddenHandTokenLike(cardId));
    }

    const selectedOwnerKey = parseSeatKeyOptional(cardState.selectedCardOwnerKey);
    if (!cardState.selectedCardId) {
        cardState.selectedCardId = null;
        cardState.selectedCardOwnerKey = null;
    }
    const canViewerInspectSelectedOwnerHand = canViewerInspectOwnerHand(shot, viewer, selectedOwnerKey);
    if (canViewerInspectSelectedOwnerHand && isHiddenHandTokenLike(cardState.selectedCardId)) {
        cardState.selectedCardId = null;
        cardState.selectedCardOwnerKey = null;
    }
    if (!canViewerInspectSelectedOwnerHand) {
        cardState.selectedCardId = null;
        cardState.selectedCardOwnerKey = null;
    }

    if (cardState.pendingEffectByPlayer && typeof cardState.pendingEffectByPlayer === 'object') {
        for (const ownerKey of PLAYER_KEYS) {
            const pending = cardState.pendingEffectByPlayer[ownerKey];
            if (!pending || pending.type !== 'CONDEMN_WILL' || !Array.isArray(pending.offers)) continue;
            const opponentKey = getOpponentKey(ownerKey);
            const opponentHand = Array.isArray(sourceHands[opponentKey]) ? sourceHands[opponentKey] : [];
            const revealToViewer = canViewerInspectOwnerHand(shot, viewer, ownerKey);
            pending.offers = pending.offers.map((offer, idx) => {
                const parsedToken = offer && offer.cardId ? parseHiddenHandToken(offer.cardId) : null;
                const fallbackIndex = parsedToken && Number.isInteger(parsedToken.handIndex) ? parsedToken.handIndex : idx;
                const handIndex = normalizeProjectedHandIndex(
                    offer && Number.isInteger(offer.handIndex) ? offer.handIndex : fallbackIndex,
                    idx,
                    opponentHand.length
                );
                if (revealToViewer) {
                    const visibleCardId = handIndex === null ? null : opponentHand[handIndex];
                    return {
                        handIndex,
                        cardId: visibleCardId || (handIndex === null ? null : makeHiddenHandToken(opponentKey, handIndex))
                    };
                }
                return {
                    handIndex,
                    cardId: handIndex === null ? null : makeHiddenHandToken(opponentKey, handIndex)
                };
            });
        }
    }

    delete cardState._nextCardCopySeq;
    delete cardState._handCopyIdsByPlayer;
    delete cardState._deckCopyIdsByPlayer;
    delete cardState._discardCopyIds;
    delete cardState._revealedHandCopyIdsByViewer;

    const projectedForSeat = parseSeatKeyOptional(
        Object.prototype.hasOwnProperty.call(meta, 'projectedForSeat')
            ? meta.projectedForSeat
            : viewer
    );
    shot._meta = {
        authority: 'server',
        version: Number.isFinite(Number(meta.stateVersion))
            ? Number(meta.stateVersion)
            : (Number.isFinite(Number(shot.stateVersion)) ? Number(shot.stateVersion) : null),
        projectedForSeat,
        turnStartReconciled: meta.turnStartReconciled !== false
    };

    return shot;
}

function buildPublicSnapshot(room, viewerSeatKey) {
    return projectSnapshotForViewer(room && room.snapshot ? room.snapshot : {}, viewerSeatKey || null, {
        stateVersion: room ? room.stateVersion : 0,
        updatedAt: room ? room.updatedAt : Date.now(),
        projectedForSeat: viewerSeatKey || null,
        turnStartReconciled: true
    });
}

function normalizeSseEventId(value) {
    const normalized = String(value || '').trim();
    return normalized || '';
}

function createBufferedSseEventRecord(options) {
    const opts = (options && typeof options === 'object') ? options : {};
    const eventId = normalizeSseEventId(opts.eventId);
    if (!eventId) return null;

    const record = {
        id: eventId,
        event: String(opts.eventName || '').trim() || 'message'
    };
    const sourcePayloadByViewer = (opts.payloadByViewer && typeof opts.payloadByViewer === 'object')
        ? opts.payloadByViewer
        : null;

    if (sourcePayloadByViewer) {
        const payloadByViewer = {};
        for (const [viewerKey, viewerPayload] of Object.entries(sourcePayloadByViewer)) {
            const normalizedViewer = parseSeatKeyOptional(viewerKey);
            if (!normalizedViewer) continue;
            payloadByViewer[normalizedViewer] = deepClone(viewerPayload || {});
        }
        if (Object.keys(payloadByViewer).length > 0) {
            record.payloadByViewer = payloadByViewer;
        }
    }

    if (!record.payloadByViewer) {
        record.payload = deepClone(opts.payload || {});
    }

    return record;
}

function appendBufferedSseEvent(bufferValue, recordValue, limitValue) {
    const buffer = Array.isArray(bufferValue) ? bufferValue.slice() : [];
    const record = createBufferedSseEventRecord(recordValue);
    if (!record) return buffer;

    buffer.push(record);
    const limit = Number.isFinite(Number(limitValue))
        ? Math.max(1, Math.trunc(Number(limitValue)))
        : SSE_RESUME_BUFFER_LIMIT;
    if (buffer.length > limit) {
        buffer.splice(0, buffer.length - limit);
    }
    return buffer;
}

function getBufferedSseReplayEvents(bufferValue, lastEventIdValue, viewerSeatKey) {
    const lastEventId = normalizeSseEventId(lastEventIdValue);
    if (!lastEventId) return null;

    const buffer = Array.isArray(bufferValue) ? bufferValue : [];
    let startIndex = -1;
    for (let index = buffer.length - 1; index >= 0; index -= 1) {
        const entry = buffer[index];
        if (entry && normalizeSseEventId(entry.id) === lastEventId) {
            startIndex = index;
            break;
        }
    }
    if (startIndex < 0) return null;

    const viewer = parseSeatKeyOptional(viewerSeatKey);
    const replayEvents = [];
    for (let index = startIndex + 1; index < buffer.length; index += 1) {
        const entry = buffer[index];
        if (!entry || typeof entry !== 'object') continue;

        let payload;
        if (entry.payloadByViewer && typeof entry.payloadByViewer === 'object') {
            if (!viewer || !Object.prototype.hasOwnProperty.call(entry.payloadByViewer, viewer)) continue;
            payload = entry.payloadByViewer[viewer];
        } else if (Object.prototype.hasOwnProperty.call(entry, 'payload')) {
            payload = entry.payload;
        } else {
            continue;
        }

        replayEvents.push({
            eventId: normalizeSseEventId(entry.id),
            eventName: String(entry.event || '').trim() || 'message',
            payload: deepClone(payload || {})
        });
    }
    return replayEvents;
}

module.exports = {
    PLAYER_KEYS,
    OPERATION_ID_MAX_LENGTH,
    SSE_RESUME_BUFFER_LIMIT,
    NETWORK_PLAYER_NAME_MAX,
    VERSION_REJECTION_REASONS,
    parseSeatKeyOptional,
    normalizePlayerKey,
    getCurrentPlayerKey,
    getOpponentKey,
    normalizeOperationId,
    normalizeSeatHandSkinId,
    normalizeSeatHandSkins,
    normalizeNetworkPlayerName,
    normalizePublicSeats,
    buildPublicSeatMetadata,
    hasRequiredOperationId,
    ensureAcceptedOperationsBySeat,
    ensureAcceptedOperationHistoryBySeat,
    findAcceptedOperationBySeat,
    rememberAcceptedOperationBySeat,
    classifyVersionRejectionReason,
    isVersionRejectionReason,
    makeHiddenHandToken,
    parseHiddenHandToken,
    resolveAuthenticatedSeatKey,
    classifySeatTokenRejectionReason,
    getFateWillControllerKey,
    isFateWillControllerForCurrentTurn,
    canViewerInspectOwnerHand,
    normalizePublishMeta,
    normalizeEffectLogMessages,
    appendEffectLogMessages,
    normalizeRoomBoardConfig,
    resolveRoomBoardConfig,
    buildPublishResponsePayload,
    stripTransientPresentationState,
    stripTransientChargeDeltaState,
    projectSnapshotForViewer,
    buildPublicSnapshot,
    createBufferedSseEventRecord,
    appendBufferedSseEvent,
    getBufferedSseReplayEvents
};
