// @ts-nocheck
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

import type { CardState, GameState, PlayerKey } from '../src/types';
import type {
    MatchAuthorityBufferedSseEventRecord,
    MatchAuthorityBufferedSseEventRecordInput,
    MatchAuthorityBufferedSseReplayEvent,
    MatchAuthorityHeartbeatPayloadFromRoomOptions,
    MatchAuthorityPresencePayloadFromRoomOptions,
    MatchAuthorityProjectionMetadata,
    MatchAuthorityPublicApi,
    MatchAuthorityPublicSnapshot,
    MatchAuthorityPublishMeta,
    MatchAuthorityPublishPayloadFromRoomOptions,
    MatchAuthorityPublishResponseOptions,
    MatchAuthorityPublishResponsePayload,
    MatchAuthorityRoomPayload,
    MatchAuthorityRoomPayloadFromRoomOptions,
    MatchAuthorityRoomPayloadOptions,
    MatchAuthorityRoomState,
    MatchAuthoritySeatKey,
    MatchAuthoritySeatLeaveOptions,
    MatchAuthoritySeatLeaveResult,
    MatchAuthoritySnapshotPayloadFromRoomOptions
} from './match-authority-types';
import { assertMatchAuthorityPublicApi } from './match-authority-contract';

import deepClone from './deepClone';
import SharedBoardUtils from '../shared/shared-board-utils';
import GachaHandCatalogShared from '../shared/gacha-hand-catalog-shared.js';
import StateHash from '../shared/state-hash.js';


const PLAYER_KEYS = Object.freeze(['black', 'white']);
const HIDDEN_HAND_TOKEN_PREFIX = '__hidden_hand__:';
const HIDDEN_HAND_TOKEN_RE = /^__hidden_hand__:(black|white):(\d+)$/;
const OPERATION_ID_MAX_LENGTH = 128;
const HAND_SKIN_ID_MAX_LENGTH = 128;
const SSE_RESUME_BUFFER_LIMIT = 96;
const ACCEPTED_OPERATION_HISTORY_LIMIT = 16;
const NETWORK_PLAYER_NAME_MAX = 7;
const NETWORK_DEBUG_FILL_HAND_ACTION = 'debug_fill_hand';
const AUTHORITY_LOG_LIMIT = 64;
const ROOM_ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_ID_LENGTH = 3;
const SEAT_TOKEN_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const SEAT_TOKEN_LENGTH = 24;
const SSE_ID_SUFFIX_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
const SSE_ID_SUFFIX_LENGTH = 6;
const VERSION_REJECTION_REASONS = Object.freeze({
    AHEAD: 'VERSION_AHEAD',
    BEHIND: 'VERSION_BEHIND',
    GAP: 'VERSION_GAP',
    MISMATCH: 'VERSION_MISMATCH'
});

function resolveSecureCrypto(explicitCrypto) {
    if (explicitCrypto && typeof explicitCrypto.getRandomValues === 'function') return explicitCrypto;
    if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
        return globalThis.crypto;
    }
    if (typeof require === 'function') {
        try {
            const nodeCrypto = _require('crypto');
            if (nodeCrypto && nodeCrypto.webcrypto && typeof nodeCrypto.webcrypto.getRandomValues === 'function') {
                return nodeCrypto.webcrypto;
            }
        } catch (e) { /* ignore */ }
    }
    throw new Error('Secure crypto.getRandomValues() is required for match authority token generation.');
}

function randomFromChars(chars, length, explicitCrypto) {
    const safeChars = String(chars || '');
    if (!safeChars || !Number.isInteger(length) || length <= 0) return '';
    const cryptoLike = resolveSecureCrypto(explicitCrypto);
    const bytes = new Uint8Array(length);
    cryptoLike.getRandomValues(bytes);
    let out = '';
    for (let index = 0; index < length; index += 1) {
        out += safeChars[bytes[index] % safeChars.length];
    }
    return out;
}

function makeRoomId(explicitCrypto) {
    return randomFromChars(ROOM_ID_CHARS, ROOM_ID_LENGTH, explicitCrypto);
}

function makeSeatToken(explicitCrypto) {
    return randomFromChars(SEAT_TOKEN_CHARS, SEAT_TOKEN_LENGTH, explicitCrypto);
}

function makeSseStreamId(nowValue, explicitCrypto) {
    const timestamp = Number.isFinite(Number(nowValue)) ? Number(nowValue) : Date.now();
    return `sse_${timestamp}_${randomFromChars(SSE_ID_SUFFIX_CHARS, SSE_ID_SUFFIX_LENGTH, explicitCrypto)}`;
}

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

function getCurrentPlayerKey(gameState: Partial<GameState> | null | undefined): PlayerKey {
    if (!gameState) return 'black';
    return normalizePlayerKey(gameState.currentPlayer);
}

function getOpponentKey(playerKey: PlayerKey | null | undefined): PlayerKey {
    return normalizePlayerKey(playerKey) === 'white' ? 'black' : 'white';
}

function normalizePendingType(value) {
    return String(value || '').trim().toUpperCase();
}

function normalizePendingEffectId(value) {
    const normalized = String(value || '').trim();
    return normalized || null;
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

function resolveAcceptedOperation(room, seatKey, operationId, fallbackEntry) {
    const matchedEntry = findAcceptedOperationBySeat(room, seatKey, operationId);
    if (matchedEntry) return matchedEntry;
    const normalizedOperationId = normalizeOperationId(operationId);
    const normalizedFallback = normalizeAcceptedOperationEntry(fallbackEntry);
    if (!normalizedOperationId || !normalizedFallback) return null;
    return normalizedFallback.operationId === normalizedOperationId
        ? normalizedFallback
        : null;
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

function normalizePublishMeta(value: unknown): MatchAuthorityPublishMeta {
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

function buildPublishResponseOptions(options) {
    const opts = (options && typeof options === 'object') ? options : {};
    const response = {
        ok: opts.ok === true,
        publishMeta: normalizePublishMeta({
            kind: opts.publishKind,
            operationId: opts.operationId,
            actionType: opts.actionType,
            receivedBaseVersion: opts.receivedBaseVersion,
            authoritativeStateVersion: opts.authoritativeStateVersion,
            replayedStateVersion: opts.replayedStateVersion,
            rejectedReason: opts.rejectedReason
        })
    };

    if (response.ok !== true) {
        response.rejectedReason = opts.rejectedReason ? String(opts.rejectedReason).trim() : null;
    }
    if (opts.idempotentReplay === true) {
        response.idempotentReplay = true;
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'serverTime')) {
        response.serverTime = opts.serverTime;
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'errorMessage')) {
        response.errorMessage = opts.errorMessage || null;
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'playbackEvents')) {
        response.playbackEvents = opts.playbackEvents;
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'effectLogs')) {
        response.effectLogs = opts.effectLogs;
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'playbackDiagnostics')) {
        response.playbackDiagnostics = opts.playbackDiagnostics || null;
    }
    return response;
}

function buildVersionRejectedPublishResponseOptions(room, options) {
    const opts = (options && typeof options === 'object') ? options : {};
    const authoritativeStateVersion = normalizeStateVersion(
        Object.prototype.hasOwnProperty.call(opts, 'authoritativeStateVersion')
            ? opts.authoritativeStateVersion
            : (room && room.stateVersion)
    );
    const receivedBaseVersion = normalizeStateVersion(opts.receivedBaseVersion);
    const rejectedReason = classifyVersionRejectionReason(
        Object.prototype.hasOwnProperty.call(opts, 'receivedBaseVersion') ? opts.receivedBaseVersion : null,
        authoritativeStateVersion
    );
    return buildPublishResponseOptions({
        ok: false,
        rejectedReason,
        publishKind: 'rejected',
        operationId: opts.operationId,
        actionType: opts.actionType,
        receivedBaseVersion,
        authoritativeStateVersion
    });
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

function getSeatLabelJa(playerKey: PlayerKey | null | undefined): string {
    return normalizePlayerKey(playerKey) === 'white' ? '白' : '黒';
}

function resolveActionCardId(action) {
    if (!action || typeof action !== 'object') return '';
    if (action.useCardId) return String(action.useCardId);
    if (action.cardId) return String(action.cardId);
    return '';
}

function resolveActionCardDisplayName(action, cardLogic) {
    const cardId = resolveActionCardId(action);
    if (!cardId) return '';
    const cardDef = (cardLogic && typeof cardLogic.getCardDef === 'function')
        ? cardLogic.getCardDef(cardId)
        : null;
    const displayName = cardDef && cardDef.name ? String(cardDef.name).trim() : '';
    return displayName || cardId;
}

function buildNetworkCardUseEffectLogs(action, playerKey, cardLogic) {
    const actionType = String(action && (action.type || action.actionType) ? (action.type || action.actionType) : '').trim().toLowerCase();
    if (actionType !== 'use_card') return [];
    const displayName = resolveActionCardDisplayName(action, cardLogic);
    if (!displayName) return [];
    return [`${getSeatLabelJa(playerKey)}がカードを使用: ${displayName}`];
}

function collectPipelineEffectLogMessages(rawEvents, presentationEvents, playerKey, playbackAdapter) {
    const adapter = (playbackAdapter && typeof playbackAdapter.mapEffectLogsFromPipeline === 'function')
        ? playbackAdapter
        : null;
    if (!adapter) return [];
    try {
        return normalizeEffectLogMessages(
            adapter.mapEffectLogsFromPipeline(rawEvents, presentationEvents, playerKey) || []
        );
    } catch (e) {
        return [];
    }
}

function isNetworkDebugFillHandAction(value) {
    return String(value || '').trim().toLowerCase() === NETWORK_DEBUG_FILL_HAND_ACTION;
}

function isNetworkDebugFillHandPayload(value) {
    if (!value || typeof value !== 'object') return false;
    if (isNetworkDebugFillHandAction(value.actionType)) return true;
    return isNetworkDebugFillHandAction(value.action && value.action.type);
}

function resolveNetworkDebugFillHandOptions(value) {
    if (!value || typeof value !== 'object') return {};
    const action = value.action && typeof value.action === 'object' ? value.action : {};
    const params = value.params && typeof value.params === 'object' ? value.params : {};
    const rawCardIds = Array.isArray(params.cardIds) ? params.cardIds : (Array.isArray(action.cardIds) ? action.cardIds : null);
    const rawCharge = Number.isFinite(Number(params.charge)) ? Number(params.charge) : (
        Number.isFinite(Number(action.charge)) ? Number(action.charge) : undefined
    );
    const rawChargeByPlayer = (params.chargeByPlayer && typeof params.chargeByPlayer === 'object')
        ? params.chargeByPlayer
        : ((action.chargeByPlayer && typeof action.chargeByPlayer === 'object') ? action.chargeByPlayer : null);
    const chargeByPlayer = rawChargeByPlayer
        ? {
            black: Number.isFinite(Number(rawChargeByPlayer.black)) ? Number(rawChargeByPlayer.black) : undefined,
            white: Number.isFinite(Number(rawChargeByPlayer.white)) ? Number(rawChargeByPlayer.white) : undefined
        }
        : undefined;
    return {
        fillWhite: params.fillWhite === true || action.fillWhite === true,
        replaceExisting: params.replaceExisting === true || action.replaceExisting === true,
        cardIds: Array.isArray(rawCardIds) ? rawCardIds.slice() : undefined,
        charge: rawCharge,
        chargeByPlayer
    };
}

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function mergeWithDefaultShape(defaultValue, overrideValue) {
    if (Array.isArray(defaultValue)) {
        return Array.isArray(overrideValue) ? deepClone(overrideValue) : deepClone(defaultValue);
    }

    if (isPlainObject(defaultValue)) {
        const result = deepClone(defaultValue);
        if (!isPlainObject(overrideValue)) {
            return result;
        }
        for (const [key, value] of Object.entries(overrideValue)) {
            const baseValue = Object.prototype.hasOwnProperty.call(defaultValue, key)
                ? defaultValue[key]
                : undefined;
            result[key] = mergeWithDefaultShape(baseValue, value);
        }
        return result;
    }

    return (typeof overrideValue === 'undefined')
        ? deepClone(defaultValue)
        : deepClone(overrideValue);
}

function mixTurnStartSeed(seed, value) {
    const numeric = Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : 0;
    const normalizedSeed = (Number(seed) >>> 0) || 1;
    return ((normalizedSeed ^ (numeric >>> 0)) * 1664525 + 1013904223) >>> 0;
}

function createTurnStartSeed(room, snapshot, playerKey) {
    const gameState = snapshot && snapshot.gameState;
    const cardState = snapshot && snapshot.cardState;
    let seed = Number.isFinite(Number(room && room.seed)) ? (Math.trunc(Number(room.seed)) >>> 0) : 1;
    seed = mixTurnStartSeed(seed, snapshot && snapshot.stateVersion);
    seed = mixTurnStartSeed(seed, gameState && gameState.turnNumber);
    seed = mixTurnStartSeed(seed, cardState && cardState.turnIndex);
    seed = mixTurnStartSeed(seed, normalizePlayerKey(playerKey) === 'white' ? 0x9E3779B1 : 0x243F6A88);
    return seed || 1;
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

function assignOptionalRoomBoardConfig(target, source) {
    if (
        target
        && typeof target === 'object'
        && source
        && typeof source === 'object'
        && Object.prototype.hasOwnProperty.call(source, 'roomBoardConfig')
    ) {
        target.roomBoardConfig = source.roomBoardConfig;
    }
    return target;
}

function buildPublishResponsePayload(options: MatchAuthorityPublishResponseOptions): MatchAuthorityPublishResponsePayload {
    const opts = (options && typeof options === 'object') ? options : {};
    const payload = buildRoomPayload(assignOptionalRoomBoardConfig({
        ok: opts.ok === true,
        roomId: opts.roomId,
        stateVersion: opts.stateVersion,
        snapshot: (opts.snapshot && typeof opts.snapshot === 'object') ? opts.snapshot : null,
        seats: opts.seats,
        seatNames: (opts.seatNames && typeof opts.seatNames === 'object')
            ? opts.seatNames
            : ((opts.seats && typeof opts.seats === 'object') ? { black: '', white: '' } : undefined),
        seatHandSkins: (opts.seatHandSkins && typeof opts.seatHandSkins === 'object')
            ? opts.seatHandSkins
            : ((opts.seats && typeof opts.seats === 'object') ? { black: '', white: '' } : undefined),
        roomDeck: Object.prototype.hasOwnProperty.call(opts, 'roomDeck') ? opts.roomDeck : null,
        networkDebugEnabled: opts.networkDebugEnabled === true,
        turnTimer: (opts.turnTimer && typeof opts.turnTimer === 'object') ? opts.turnTimer : null,
        playbackEvents: Array.isArray(opts.playbackEvents) ? opts.playbackEvents : [],
        effectLogs: normalizeEffectLogMessages(opts.effectLogs),
        serverTime: opts.serverTime,
        rejectedReason: opts.rejectedReason,
        idempotentReplay: opts.idempotentReplay === true,
        errorMessage: opts.errorMessage,
        playbackDiagnostics: opts.playbackDiagnostics,
        projectedSnapshotHash: opts.projectedSnapshotHash
    }, opts));

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

function buildRoomPayload(options: MatchAuthorityRoomPayloadOptions): MatchAuthorityRoomPayload {
    const opts = (options && typeof options === 'object') ? options : {};
    const hasSeats = opts.seats && typeof opts.seats === 'object';
    const hasSeatNames = opts.seatNames && typeof opts.seatNames === 'object';
    const hasSeatHandSkins = opts.seatHandSkins && typeof opts.seatHandSkins === 'object';
    const publicSeatMetadata = (hasSeats || hasSeatNames || hasSeatHandSkins)
        ? buildPublicSeatMetadata(opts)
        : null;
    const payload: MatchAuthorityRoomPayload = {
        ok: opts.ok === true,
        roomId: opts.roomId ? String(opts.roomId).trim().toUpperCase() : null,
        serverTime: Number.isFinite(Number(opts.serverTime)) ? Number(opts.serverTime) : Date.now()
    };

    if (Object.prototype.hasOwnProperty.call(opts, 'stateVersion')) {
        payload.stateVersion = normalizeStateVersion(opts.stateVersion);
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'snapshot')) {
        payload.snapshot = (opts.snapshot && typeof opts.snapshot === 'object') ? opts.snapshot : null;
    }
    if (publicSeatMetadata && hasSeats) {
        payload.seats = publicSeatMetadata.seats;
    }
    if (publicSeatMetadata && hasSeatNames) {
        payload.seatNames = publicSeatMetadata.seatNames;
    }
    if (publicSeatMetadata && hasSeatHandSkins) {
        payload.seatHandSkins = publicSeatMetadata.seatHandSkins;
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'roomDeck')) {
        payload.roomDeck = opts.roomDeck;
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'roomBoardConfig')) {
        payload.roomBoardConfig = opts.roomBoardConfig;
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'networkDebugEnabled')) {
        payload.networkDebugEnabled = opts.networkDebugEnabled === true;
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'turnTimer')) {
        payload.turnTimer = (opts.turnTimer && typeof opts.turnTimer === 'object') ? opts.turnTimer : null;
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'playbackEvents')) {
        payload.playbackEvents = Array.isArray(opts.playbackEvents) ? opts.playbackEvents : [];
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'effectLogs')) {
        payload.effectLogs = normalizeEffectLogMessages(opts.effectLogs);
    }
    if (payload.ok !== true && Object.prototype.hasOwnProperty.call(opts, 'rejectedReason')) {
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
    if (Object.prototype.hasOwnProperty.call(opts, 'projectedSnapshotHash')) {
        payload.projectedSnapshotHash = opts.projectedSnapshotHash || null;
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'type')) {
        payload.type = String(opts.type || '').trim() || null;
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'seatKey')) {
        payload.seatKey = parseSeatKeyOptional(opts.seatKey);
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'playerKey')) {
        payload.playerKey = parseSeatKeyOptional(opts.playerKey);
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'playerName')) {
        payload.playerName = normalizeNetworkPlayerName(opts.playerName);
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'seatToken')) {
        payload.seatToken = String(opts.seatToken || '').trim();
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'rejoined')) {
        payload.rejoined = opts.rejoined === true;
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'selectedHandSkinId')) {
        payload.selectedHandSkinId = normalizeSeatHandSkinId(opts.selectedHandSkinId);
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'operationId')) {
        payload.operationId = normalizeOperationId(opts.operationId) || null;
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'actionType')) {
        payload.actionType = opts.actionType ? String(opts.actionType) : null;
    }

    return payload;
}

function buildRoomPayloadFromRoom(
    roomValue: MatchAuthorityRoomState | null | undefined,
    options?: MatchAuthorityRoomPayloadFromRoomOptions | null
): MatchAuthorityRoomPayload {
    const room: MatchAuthorityRoomState = (roomValue && typeof roomValue === 'object') ? roomValue : {};
    const opts: MatchAuthorityRoomPayloadFromRoomOptions = (options && typeof options === 'object') ? options : {};
    const source: MatchAuthorityRoomPayloadOptions = Object.assign({}, opts);
    const hasRoomSeats = room.seats && typeof room.seats === 'object';
    if (!Object.prototype.hasOwnProperty.call(source, 'roomId') && room.roomId) {
        source.roomId = room.roomId;
    }
    if (!Object.prototype.hasOwnProperty.call(source, 'seats') && hasRoomSeats) {
        source.seats = room.seats;
    }
    if (!Object.prototype.hasOwnProperty.call(source, 'seatNames') && hasRoomSeats) {
        source.seatNames = (room.seatNames && typeof room.seatNames === 'object')
            ? room.seatNames
            : { black: '', white: '' };
    }
    if (!Object.prototype.hasOwnProperty.call(source, 'seatHandSkins') && hasRoomSeats) {
        source.seatHandSkins = normalizeSeatHandSkins(room.seatHandSkins);
    }
    return buildRoomPayload(source);
}

function buildSnapshotPayloadFromRoom(
    roomValue: MatchAuthorityRoomState | null | undefined,
    options?: MatchAuthoritySnapshotPayloadFromRoomOptions | null
): MatchAuthorityRoomPayload {
    const room: MatchAuthorityRoomState = (roomValue && typeof roomValue === 'object') ? roomValue : {};
    const opts: MatchAuthoritySnapshotPayloadFromRoomOptions = (options && typeof options === 'object') ? options : {};
    return buildRoomPayloadFromRoom(room, assignOptionalRoomBoardConfig({
        ok: true,
        stateVersion: room.stateVersion,
        snapshot: Object.prototype.hasOwnProperty.call(opts, 'snapshot') ? opts.snapshot : null,
        roomDeck: Object.prototype.hasOwnProperty.call(opts, 'roomDeck') ? opts.roomDeck : null,
        networkDebugEnabled: opts.networkDebugEnabled === true,
        turnTimer: opts.turnTimer,
        playbackEvents: opts.playbackEvents,
        effectLogs: opts.effectLogs,
        playbackDiagnostics: opts.playbackDiagnostics,
        operationId: opts.operationId,
        playerKey: opts.playerKey,
        actionType: opts.actionType,
        serverTime: opts.serverTime
    }, opts));
}

function buildPresencePayloadFromRoom(
    roomValue: MatchAuthorityRoomState | null | undefined,
    options?: MatchAuthorityPresencePayloadFromRoomOptions | null
): MatchAuthorityRoomPayload {
    const room: MatchAuthorityRoomState = (roomValue && typeof roomValue === 'object') ? roomValue : {};
    const opts: MatchAuthorityPresencePayloadFromRoomOptions = (options && typeof options === 'object') ? options : {};
    return buildRoomPayloadFromRoom(room, assignOptionalRoomBoardConfig({
        ok: true,
        roomDeck: Object.prototype.hasOwnProperty.call(opts, 'roomDeck') ? opts.roomDeck : null,
        networkDebugEnabled: opts.networkDebugEnabled === true,
        turnTimer: opts.turnTimer,
        type: opts.type,
        seatKey: opts.seatKey,
        playerName: opts.playerName,
        rejoined: opts.rejoined,
        serverTime: opts.serverTime
    }, opts));
}

function buildHeartbeatPayloadFromRoom(
    roomValue: MatchAuthorityRoomState | null | undefined,
    options?: MatchAuthorityHeartbeatPayloadFromRoomOptions | null
): MatchAuthorityRoomPayload {
    const room: MatchAuthorityRoomState = (roomValue && typeof roomValue === 'object') ? roomValue : {};
    const opts: MatchAuthorityHeartbeatPayloadFromRoomOptions = (options && typeof options === 'object') ? options : {};
    return buildRoomPayloadFromRoom(room, assignOptionalRoomBoardConfig({
        ok: true,
        stateVersion: room.stateVersion,
        roomDeck: Object.prototype.hasOwnProperty.call(opts, 'roomDeck') ? opts.roomDeck : null,
        networkDebugEnabled: opts.networkDebugEnabled === true,
        turnTimer: opts.turnTimer,
        serverTime: opts.serverTime
    }, opts));
}

function buildPublishPayloadFromRoom(
    roomValue: MatchAuthorityRoomState | null | undefined,
    options?: MatchAuthorityPublishPayloadFromRoomOptions | null
): MatchAuthorityPublishResponsePayload {
    const room: MatchAuthorityRoomState = (roomValue && typeof roomValue === 'object') ? roomValue : {};
    const opts: MatchAuthorityPublishPayloadFromRoomOptions = (options && typeof options === 'object') ? options : {};
    return buildPublishResponsePayload(assignOptionalRoomBoardConfig({
        ok: opts.ok === true,
        roomId: room.roomId || null,
        stateVersion: room.stateVersion,
        snapshot: Object.prototype.hasOwnProperty.call(opts, 'snapshot') ? opts.snapshot : null,
        seats: room.seats,
        seatNames: room.seatNames,
        seatHandSkins: room.seatHandSkins,
        roomDeck: Object.prototype.hasOwnProperty.call(opts, 'roomDeck') ? opts.roomDeck : null,
        networkDebugEnabled: opts.networkDebugEnabled === true,
        turnTimer: opts.turnTimer,
        playbackEvents: opts.playbackEvents,
        effectLogs: opts.effectLogs,
        playbackDiagnostics: opts.playbackDiagnostics,
        serverTime: opts.serverTime,
        rejectedReason: opts.rejectedReason,
        idempotentReplay: opts.idempotentReplay === true,
        errorMessage: opts.errorMessage,
        publishMeta: opts.publishMeta || null
    }, opts));
}

function resolveSeatForJoin(
    roomValue: MatchAuthorityRoomState | null | undefined,
    requestedSeatKey: unknown,
    providedToken: unknown
): MatchAuthoritySeatKey | null {
    const room: MatchAuthorityRoomState | null = (roomValue && typeof roomValue === 'object') ? roomValue : null;
    if (!room) return null;

    const token = String(providedToken || '').trim();
    const requested = parseSeatKeyOptional(requestedSeatKey);
    const seats = (room.seats && typeof room.seats === 'object')
        ? room.seats
        : { black: false, white: false };
    const seatTokens = (room.seatTokens && typeof room.seatTokens === 'object')
        ? room.seatTokens
        : null;

    if (requested) {
        if (token && seatTokens && seatTokens[requested] === token) return requested;
        if (!seats[requested]) return requested;
        return null;
    }

    if (token && seatTokens) {
        if (seatTokens.black === token) return 'black';
        if (seatTokens.white === token) return 'white';
    }

    if (!seats.black) return 'black';
    if (!seats.white) return 'white';
    return null;
}

function applySeatLeaveToRoom(
    roomValue: MatchAuthorityRoomState | null | undefined,
    seatKeyValue: unknown,
    options?: MatchAuthoritySeatLeaveOptions | null
): MatchAuthoritySeatLeaveResult | null {
    const room: MatchAuthorityRoomState | null = (roomValue && typeof roomValue === 'object') ? roomValue : null;
    const seatKey = parseSeatKeyOptional(seatKeyValue);
    const opts = (options && typeof options === 'object') ? options : {};
    if (!room || !seatKey) return null;

    const nextUpdatedAt = Number.isFinite(Number(opts.now)) ? Number(opts.now) : Date.now();
    const createSeatToken = (typeof opts.makeSeatToken === 'function')
        ? opts.makeSeatToken
        : null;

    room.seats = (room.seats && typeof room.seats === 'object')
        ? room.seats
        : { black: false, white: false };
    room.seatNames = (room.seatNames && typeof room.seatNames === 'object')
        ? room.seatNames
        : { black: '', white: '' };
    room.seatHandSkins = normalizeSeatHandSkins(room.seatHandSkins);
    room.seatTokens = (room.seatTokens && typeof room.seatTokens === 'object')
        ? room.seatTokens
        : {};

    room.seats[seatKey] = false;
    room.seatNames[seatKey] = '';
    room.seatHandSkins[seatKey] = '';
    if (createSeatToken) {
        room.seatTokens[seatKey] = createSeatToken();
    }
    room.updatedAt = nextUpdatedAt;

    return {
        seatKey,
        updatedAt: nextUpdatedAt,
        seatToken: room.seatTokens[seatKey] || '',
        seats: room.seats,
        seatNames: room.seatNames,
        seatHandSkins: room.seatHandSkins
    };
}

function shouldDisposeRoom(roomValue, streamCountValue) {
    const room = (roomValue && typeof roomValue === 'object') ? roomValue : null;
    if (!room) return false;
    const streamCount = Number.isFinite(Number(streamCountValue))
        ? Math.max(0, Math.trunc(Number(streamCountValue)))
        : 0;
    return !(
        room.seats
        && (room.seats.black || room.seats.white)
    ) && streamCount === 0;
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

function normalizeChargeValueForAuthority(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return numeric;
}

function restoreMissingChargeDeltaEvents(previousSnapshot, nextSnapshot) {
    const previousCardState = (previousSnapshot && previousSnapshot.cardState && typeof previousSnapshot.cardState === 'object')
        ? previousSnapshot.cardState
        : null;
    const nextCardState = (nextSnapshot && nextSnapshot.cardState && typeof nextSnapshot.cardState === 'object')
        ? nextSnapshot.cardState
        : null;
    if (!previousCardState || !nextCardState) return nextSnapshot;
    if (Array.isArray(nextCardState.chargeDeltaEvents) && nextCardState.chargeDeltaEvents.length > 0) {
        return nextSnapshot;
    }

    const previousCharge = (previousCardState.charge && typeof previousCardState.charge === 'object')
        ? previousCardState.charge
        : null;
    const nextCharge = (nextCardState.charge && typeof nextCardState.charge === 'object')
        ? nextCardState.charge
        : null;
    if (!previousCharge || !nextCharge) return nextSnapshot;

    const events = [];
    let seq = 1;
    for (const playerKey of PLAYER_KEYS) {
        const before = normalizeChargeValueForAuthority(previousCharge[playerKey]);
        const after = normalizeChargeValueForAuthority(nextCharge[playerKey]);
        const delta = after - before;
        if (delta === 0) continue;
        const direction = delta > 0 ? 1 : -1;
        const steps = Math.abs(delta);
        let cursor = before;
        for (let step = 0; step < steps; step += 1) {
            const next = cursor + direction;
            events.push({
                seq,
                player: playerKey,
                before: cursor,
                after: next,
                delta: direction,
                reason: 'network_snapshot_charge_sync'
            });
            seq += 1;
            cursor = next;
        }
    }
    nextCardState.chargeDeltaEvents = events;
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
function getFateWillControllerKey(snapshot: { cardState?: Partial<CardState> | null } | null | undefined, turnOwnerKey: PlayerKey | null | undefined): PlayerKey | null {
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
function isFateWillControllerForCurrentTurn(snapshot: { gameState?: Partial<GameState> | null; cardState?: Partial<CardState> | null } | null | undefined, seatKey: PlayerKey | null | undefined): boolean {
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

function canViewerInspectOwnerHand(snapshot: { gameState?: Partial<GameState> | null; cardState?: Partial<CardState> | null } | null | undefined, viewerSeatKey: PlayerKey | null | undefined, ownerSeatKey: PlayerKey | null | undefined): boolean {
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

function projectSnapshotForViewer(
    snapshotValue: unknown,
    viewerSeatKey: PlayerKey | null | undefined,
    metadata?: MatchAuthorityProjectionMetadata
): MatchAuthorityPublicSnapshot {
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

function buildPublicSnapshot(
    room: MatchAuthorityRoomState | null | undefined,
    viewerSeatKey: PlayerKey | null | undefined
): MatchAuthorityPublicSnapshot {
    const shot = projectSnapshotForViewer(room && room.snapshot ? room.snapshot : {}, viewerSeatKey || null, {
        stateVersion: room ? room.stateVersion : 0,
        updatedAt: room ? room.updatedAt : Date.now(),
        projectedForSeat: viewerSeatKey || null,
        turnStartReconciled: true
    });
    const projectedSnapshotHash = computeProjectedSnapshotHash(shot);
    if (!shot._meta || typeof shot._meta !== 'object') {
        shot._meta = {};
    }
    shot._meta.projectedSnapshotHash = projectedSnapshotHash;
    return shot;
}

function cloneSnapshotHashSource(snapshotValue) {
    const shot = deepClone(snapshotValue || {});
    if (shot && typeof shot === 'object' && shot._meta && typeof shot._meta === 'object') {
        delete shot._meta.projectedSnapshotHash;
        delete shot._meta.authoritativeStateHash;
    }
    return shot;
}

function computeAuthoritativeStateHash(snapshotValue) {
    if (!StateHash || typeof StateHash.computeStableHash !== 'function') return null;
    return StateHash.computeStableHash(cloneSnapshotHashSource(snapshotValue));
}

function computeProjectedSnapshotHash(snapshotValue) {
    if (!StateHash || typeof StateHash.computeStableHash !== 'function') return null;
    return StateHash.computeStableHash(cloneSnapshotHashSource(snapshotValue));
}

function validatePendingSelectionPublish(snapshotValue, playerKey, actionValue) {
    const action = (actionValue && typeof actionValue === 'object') ? actionValue : null;
    const pendingSelectionState = (action && action.pendingSelectionState && typeof action.pendingSelectionState === 'object')
        ? action.pendingSelectionState
        : null;
    if (!pendingSelectionState) {
        return { ok: true };
    }

    const snapshot = (snapshotValue && typeof snapshotValue === 'object') ? snapshotValue : null;
    const cardState = (snapshot && snapshot.cardState && typeof snapshot.cardState === 'object') ? snapshot.cardState : null;
    const pendingByPlayer = (cardState && cardState.pendingEffectByPlayer && typeof cardState.pendingEffectByPlayer === 'object')
        ? cardState.pendingEffectByPlayer
        : null;
    const expectedPending = pendingByPlayer ? pendingByPlayer[normalizePlayerKey(playerKey)] : null;
    if (!expectedPending || !expectedPending.type) {
        const hasCompatibilityCardContext = !!(
            action
            && typeof action.useCardId === 'string'
            && String(action.useCardId).trim()
            && typeof action.useCardOwnerKey === 'string'
            && String(action.useCardOwnerKey).trim()
        );
        if (hasCompatibilityCardContext) {
            return { ok: true, pendingEffectId: null };
        }
        return { ok: false, rejectedReason: 'STALE_PENDING_SELECTION' };
    }

    const requestedType = normalizePendingType(pendingSelectionState.type);
    const expectedType = normalizePendingType(expectedPending.type);
    if (requestedType && expectedType && requestedType !== expectedType) {
        return { ok: false, rejectedReason: 'STALE_PENDING_SELECTION' };
    }

    const requestedCardId = normalizeCardIdOptional(pendingSelectionState.cardId);
    const expectedCardId = normalizeCardIdOptional(expectedPending.cardId);
    if (requestedCardId && expectedCardId && requestedCardId !== expectedCardId) {
        return { ok: false, rejectedReason: 'STALE_PENDING_SELECTION' };
    }

    const expectedPendingEffectId = normalizePendingEffectId(expectedPending.pendingEffectId);
    const requestedPendingEffectId = normalizePendingEffectId(pendingSelectionState.pendingEffectId);
    if (expectedPendingEffectId && requestedPendingEffectId !== expectedPendingEffectId) {
        return { ok: false, rejectedReason: 'STALE_PENDING_SELECTION' };
    }

    return {
        ok: true,
        pendingEffectId: expectedPendingEffectId
    };
}

function normalizeCardIdOptional(value) {
    const normalized = String(value || '').trim();
    return normalized || null;
}

function hasCardInHandForAuthority(cardState, ownerKey, cardId) {
    const hands = cardState && cardState.hands && typeof cardState.hands === 'object'
        ? cardState.hands
        : null;
    const hand = hands && Array.isArray(hands[ownerKey]) ? hands[ownerKey] : [];
    const normalizedCardId = normalizeCardIdOptional(cardId);
    if (!normalizedCardId) return false;
    for (let index = 0; index < hand.length; index += 1) {
        if (normalizeCardIdOptional(hand[index]) === normalizedCardId) {
            return true;
        }
    }
    return false;
}

function hasCardInDiscardForAuthority(cardState, cardId) {
    const discard = cardState && Array.isArray(cardState.discard) ? cardState.discard : [];
    const normalizedCardId = normalizeCardIdOptional(cardId);
    if (!normalizedCardId) return false;
    for (let index = 0; index < discard.length; index += 1) {
        if (normalizeCardIdOptional(discard[index]) === normalizedCardId) {
            return true;
        }
    }
    return false;
}

function shouldStripCommittedPendingCardUse(cardState, playerKey, action, expectedPending) {
    const normalizedPlayerKey = normalizePlayerKey(playerKey);
    const normalizedUseCardId = normalizeCardIdOptional(action && action.useCardId);
    const normalizedPendingCardId = normalizeCardIdOptional(expectedPending && expectedPending.cardId);
    if (!normalizedUseCardId || !normalizedPendingCardId || normalizedUseCardId !== normalizedPendingCardId) {
        return false;
    }

    const normalizedHandOwnerKey = normalizePlayerKey(action && action.useCardOwnerKey, normalizedPlayerKey);
    const hasUsedCardThisTurn = !!(
        cardState
        && cardState.hasUsedCardThisTurnByPlayer
        && cardState.hasUsedCardThisTurnByPlayer[normalizedPlayerKey] === true
    );
    const cardStillInHand = hasCardInHandForAuthority(cardState, normalizedHandOwnerKey, normalizedUseCardId);
    const cardAlreadyInDiscard = hasCardInDiscardForAuthority(cardState, normalizedUseCardId);

    return hasUsedCardThisTurn || cardAlreadyInDiscard || !cardStillInHand;
}

function sanitizePendingSelectionActionForAuthority(snapshotValue, playerKey, actionValue) {
    const action = (actionValue && typeof actionValue === 'object') ? actionValue : null;
    if (!action) return actionValue;

    const pendingSelectionState = (action.pendingSelectionState && typeof action.pendingSelectionState === 'object')
        ? action.pendingSelectionState
        : null;
    if (!pendingSelectionState) return actionValue;

    const snapshot = (snapshotValue && typeof snapshotValue === 'object') ? snapshotValue : null;
    const cardState = (snapshot && snapshot.cardState && typeof snapshot.cardState === 'object') ? snapshot.cardState : null;
    const pendingByPlayer = (cardState && cardState.pendingEffectByPlayer && typeof cardState.pendingEffectByPlayer === 'object')
        ? cardState.pendingEffectByPlayer
        : null;
    const expectedPending = pendingByPlayer ? pendingByPlayer[normalizePlayerKey(playerKey)] : null;
    if (!expectedPending || !expectedPending.type) return actionValue;

    if (!shouldStripCommittedPendingCardUse(cardState, playerKey, action, expectedPending)) {
        return actionValue;
    }

    const nextAction = deepClone(action);
    delete nextAction.useCardId;
    delete nextAction.useCardOwnerKey;
    return nextAction;
}

function appendAuthorityLog(roomValue, entryValue, limitValue) {
    const room = (roomValue && typeof roomValue === 'object') ? roomValue : null;
    if (!room) return [];
    const entry = (entryValue && typeof entryValue === 'object') ? entryValue : {};
    const limit = Number.isFinite(Number(limitValue))
        ? Math.max(1, Math.trunc(Number(limitValue)))
        : AUTHORITY_LOG_LIMIT;
    const nextEntry = {
        timestamp: Number.isFinite(Number(entry.timestamp)) ? Number(entry.timestamp) : Date.now(),
        kind: String(entry.kind || '').trim() || 'unknown',
        matchId: room.roomId ? String(room.roomId).trim().toUpperCase() : null,
        operationId: entry.operationId ? String(entry.operationId).trim() : null,
        actionType: entry.actionType ? String(entry.actionType).trim() : null,
        baseVersion: Number.isFinite(Number(entry.baseVersion)) ? Number(entry.baseVersion) : null,
        committedVersion: Number.isFinite(Number(entry.committedVersion)) ? Number(entry.committedVersion) : null,
        stateHashBefore: entry.stateHashBefore ? String(entry.stateHashBefore) : null,
        stateHashAfter: entry.stateHashAfter ? String(entry.stateHashAfter) : null,
        pendingEffectId: normalizePendingEffectId(entry.pendingEffectId),
        timeoutReason: entry.timeoutReason ? String(entry.timeoutReason).trim() : null,
        dedupeOutcome: entry.dedupeOutcome ? String(entry.dedupeOutcome).trim() : null,
        rejectedReason: entry.rejectedReason ? String(entry.rejectedReason).trim() : null
    };
    const log = Array.isArray(room.authorityLog) ? room.authorityLog.slice() : [];
    log.push(nextEntry);
    if (log.length > limit) {
        log.splice(0, log.length - limit);
    }
    room.authorityLog = log;
    return log;
}

function normalizeSseEventId(value) {
    const normalized = String(value || '').trim();
    return normalized || '';
}

function createBufferedSseEventRecord(options: MatchAuthorityBufferedSseEventRecordInput): MatchAuthorityBufferedSseEventRecord | null {
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

function appendBufferedSseEvent(
    bufferValue: unknown,
    recordValue: MatchAuthorityBufferedSseEventRecordInput,
    limitValue?: unknown
): MatchAuthorityBufferedSseEventRecord[] {
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

function getBufferedSseReplayEvents(
    bufferValue: unknown,
    lastEventIdValue: unknown,
    viewerSeatKey: unknown
): MatchAuthorityBufferedSseReplayEvent[] | null {
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

const matchAuthority = assertMatchAuthorityPublicApi({
    PLAYER_KEYS,
    OPERATION_ID_MAX_LENGTH,
    SSE_RESUME_BUFFER_LIMIT,
    NETWORK_PLAYER_NAME_MAX,
    NETWORK_DEBUG_FILL_HAND_ACTION,
    ROOM_ID_CHARS,
    ROOM_ID_LENGTH,
    SEAT_TOKEN_CHARS,
    SEAT_TOKEN_LENGTH,
    VERSION_REJECTION_REASONS,
    randomFromChars,
    makeRoomId,
    makeSeatToken,
    makeSseStreamId,
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
    resolveAcceptedOperation,
    rememberAcceptedOperationBySeat,
    classifyVersionRejectionReason,
    isVersionRejectionReason,
    buildVersionRejectedPublishResponseOptions,
    makeHiddenHandToken,
    parseHiddenHandToken,
    resolveAuthenticatedSeatKey,
    classifySeatTokenRejectionReason,
    getFateWillControllerKey,
    isFateWillControllerForCurrentTurn,
    canViewerInspectOwnerHand,
    normalizePublishMeta,
    buildRoomPayload,
    buildRoomPayloadFromRoom,
    buildSnapshotPayloadFromRoom,
    buildPresencePayloadFromRoom,
    buildHeartbeatPayloadFromRoom,
    buildPublishPayloadFromRoom,
    buildPublishResponseOptions,
    resolveSeatForJoin,
    normalizeEffectLogMessages,
    appendEffectLogMessages,
    getSeatLabelJa,
    resolveActionCardId,
    resolveActionCardDisplayName,
    buildNetworkCardUseEffectLogs,
    collectPipelineEffectLogMessages,
    isNetworkDebugFillHandAction,
    isNetworkDebugFillHandPayload,
    resolveNetworkDebugFillHandOptions,
    isPlainObject,
    mergeWithDefaultShape,
    mixTurnStartSeed,
    createTurnStartSeed,
    normalizeRoomBoardConfig,
    resolveRoomBoardConfig,
    buildPublishResponsePayload,
    applySeatLeaveToRoom,
    shouldDisposeRoom,
    computeAuthoritativeStateHash,
    computeProjectedSnapshotHash,
    stripTransientPresentationState,
    stripTransientChargeDeltaState,
    restoreMissingChargeDeltaEvents,
    projectSnapshotForViewer,
    buildPublicSnapshot,
    validatePendingSelectionPublish,
    sanitizePendingSelectionActionForAuthority,
    appendAuthorityLog,
    createBufferedSseEventRecord,
    appendBufferedSseEvent,
    getBufferedSseReplayEvents
});

export = matchAuthority;
