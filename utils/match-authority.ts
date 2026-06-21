declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

import type { CardState, GameState, PlayerKey } from '../src/types';
import type {
    MatchAuthorityAcceptedOperationEntry,
    MatchAuthorityAcceptedOperationHistoryBySeat,
    MatchAuthorityAcceptedOperationsBySeat,
    MatchAuthorityAutoPassNotice,
    MatchAuthorityBufferedSseEventRecord,
    MatchAuthorityBufferedSseEventRecordInput,
    MatchAuthorityBufferedSsePayloadByViewer,
    MatchAuthorityBufferedSseReplayEvent,
    MatchAuthorityHeartbeatPayloadFromRoomOptions,
    MatchAuthorityPresencePayloadFromRoomOptions,
    MatchAuthorityPresentationFramePayload,
    MatchAuthorityPresentationFramePublic,
    MatchAuthorityPresentationJournalEntry,
    MatchAuthorityPresentationPayloadKey,
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
    MatchAuthoritySeatTokenRejectionReason,
    MatchAuthoritySnapshotPayloadFromRoomOptions,
    MatchAuthoritySpectatorJoinOptions,
    MatchAuthoritySpectatorJoinResult,
    MatchAuthoritySpectatorLeaveResult,
    MatchAuthoritySpectators,
    MatchAuthoritySpectatorState,
    MatchAuthorityViewer
} from './match-authority-types';
import { assertMatchAuthorityPublicApi } from './match-authority-contract';

import deepClone from './deepClone';

interface MatchAuthorityCryptoLike {
    getRandomValues(array: Uint8Array): Uint8Array;
}

interface MatchAuthoritySharedBoardUtils {
    [key: string]: unknown;
    resolveBoardConfig?: (value?: unknown, fallbackBoard?: unknown) => unknown;
}

interface MatchAuthorityGachaHandCatalogShared {
    [key: string]: unknown;
    normalizeCatalogItemId?: (value: unknown) => string;
}

interface MatchAuthorityStateHash {
    [key: string]: unknown;
    computeStableHash?: (value: unknown) => string;
}

interface MatchAuthorityPlaybackDigest {
    [key: string]: unknown;
    computePlaybackDigest?: (playbackEvents: unknown[]) => string;
}

interface MatchAuthorityManifestStoneRegistry {
    [key: string]: unknown;
    isManifestStoneMarker?: (marker: unknown) => boolean;
}

interface MatchAuthorityPublishResponseOptionInput extends MatchAuthorityPublishResponseOptions {
    publishKind?: unknown;
}

interface MatchAuthorityCardLogicLike {
    getCardDef?: (cardId: string) => { name?: unknown } | null | undefined;
}

interface MatchAuthorityPlaybackAdapterLike {
    mapEffectLogsFromPipeline?: (rawEvents: unknown, presentationEvents: unknown, playerKey: unknown) => unknown;
}

function loadOptionalCommonJsModule<T extends object>(modulePath: string): T | null {
    if (typeof require !== 'function') return null;
    try {
        const loaded = _require(modulePath) as unknown;
        return loaded && typeof loaded === 'object' ? loaded as T : null;
    } catch (e) {
        return null;
    }
}

const SharedBoardUtils = loadOptionalCommonJsModule<MatchAuthoritySharedBoardUtils>('../shared/shared-board-utils');
const GachaHandCatalogShared = loadOptionalCommonJsModule<MatchAuthorityGachaHandCatalogShared>('../shared/gacha-hand-catalog-shared.js');
const StateHash = loadOptionalCommonJsModule<MatchAuthorityStateHash>('../shared/state-hash.js');
const PlaybackDigest = loadOptionalCommonJsModule<MatchAuthorityPlaybackDigest>('../shared/playback-digest');
const ManifestStoneRegistry = loadOptionalCommonJsModule<MatchAuthorityManifestStoneRegistry>('../shared/manifest-stone-registry');


const PLAYER_KEYS = Object.freeze(['black', 'white']);
const HIDDEN_HAND_TOKEN_PREFIX = '__hidden_hand__:';
const HIDDEN_HAND_TOKEN_RE = /^__hidden_hand__:(black|white):(\d+)$/;
const OPERATION_ID_MAX_LENGTH = 128;
const HAND_SKIN_ID_MAX_LENGTH = 128;
const SSE_RESUME_BUFFER_LIMIT = 96;
const ACCEPTED_OPERATION_HISTORY_LIMIT = 16;
const NETWORK_PLAYER_NAME_MAX = 7;
const CHAT_MAX_LENGTH = 20;
const CHAT_HISTORY_LIMIT = 40;
const NETWORK_TURN_LIMIT_SECONDS = 120;
const NETWORK_TURN_LIMIT_MS = NETWORK_TURN_LIMIT_SECONDS * 1000;
const SSE_HEARTBEAT_INTERVAL_MS = 10000;
const MAX_SPECTATORS = 4;
const NETWORK_SPECTATOR_NAME_MAX = NETWORK_PLAYER_NAME_MAX;
const NETWORK_DEBUG_FILL_HAND_ACTION = 'debug_fill_hand';
const AUTHORITY_LOG_LIMIT = 64;
const ROOM_ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_ID_LENGTH = 3;
const SEAT_TOKEN_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const SEAT_TOKEN_LENGTH = 24;
const SSE_ID_SUFFIX_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
const SSE_ID_SUFFIX_LENGTH = 6;
const SPECTATOR_ID_RE = /^spec_[A-Za-z0-9_-]{8,40}$/;
const VERSION_REJECTION_REASONS = Object.freeze({
    AHEAD: 'VERSION_AHEAD',
    BEHIND: 'VERSION_BEHIND',
    GAP: 'VERSION_GAP',
    MISMATCH: 'VERSION_MISMATCH'
});

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function resolveSecureCrypto(explicitCrypto?: MatchAuthorityCryptoLike | null): MatchAuthorityCryptoLike {
    if (explicitCrypto && typeof explicitCrypto.getRandomValues === 'function') return explicitCrypto;
    if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
        return globalThis.crypto as unknown as MatchAuthorityCryptoLike;
    }
    if (typeof require === 'function') {
        try {
            const nodeCrypto = _require('crypto') as { webcrypto?: MatchAuthorityCryptoLike };
            if (nodeCrypto && nodeCrypto.webcrypto && typeof nodeCrypto.webcrypto.getRandomValues === 'function') {
                return nodeCrypto.webcrypto;
            }
        } catch (e) { /* ignore */ }
    }
    throw new Error('Secure crypto.getRandomValues() is required for match authority token generation.');
}

function randomFromChars(chars: unknown, length: unknown, explicitCrypto?: MatchAuthorityCryptoLike | null): string {
    const safeChars = String(chars || '');
    if (!safeChars || typeof length !== 'number' || !Number.isInteger(length) || length <= 0) return '';
    const safeLength = length;
    const cryptoLike = resolveSecureCrypto(explicitCrypto);
    const bytes = new Uint8Array(safeLength);
    cryptoLike.getRandomValues(bytes);
    let out = '';
    for (let index = 0; index < safeLength; index += 1) {
        out += safeChars[bytes[index] % safeChars.length];
    }
    return out;
}

function makeRoomId(explicitCrypto?: MatchAuthorityCryptoLike | null): string {
    return randomFromChars(ROOM_ID_CHARS, ROOM_ID_LENGTH, explicitCrypto);
}

function makeSeatToken(explicitCrypto?: MatchAuthorityCryptoLike | null): string {
    return randomFromChars(SEAT_TOKEN_CHARS, SEAT_TOKEN_LENGTH, explicitCrypto);
}

function makeSseStreamId(nowValue: unknown, explicitCrypto?: MatchAuthorityCryptoLike | null): string {
    const timestamp = Number.isFinite(Number(nowValue)) ? Number(nowValue) : Date.now();
    return `sse_${timestamp}_${randomFromChars(SSE_ID_SUFFIX_CHARS, SSE_ID_SUFFIX_LENGTH, explicitCrypto)}`;
}

function parseSeatKeyOptional(value: unknown): MatchAuthoritySeatKey | null {
    if (value === 1 || value === '1') return 'black';
    if (value === -1 || value === '-1') return 'white';

    const normalized = (value === null || typeof value === 'undefined')
        ? ''
        : String(value).trim().toLowerCase();

    if (normalized === 'black' || normalized === '1' || normalized === '+1') return 'black';
    if (normalized === 'white' || normalized === '-1') return 'white';
    return null;
}

function normalizePlayerKey(value: unknown, fallback?: unknown): MatchAuthoritySeatKey {
    return parseSeatKeyOptional(value) || parseSeatKeyOptional(fallback) || 'black';
}

function getCurrentPlayerKey(gameState: Partial<GameState> | null | undefined): PlayerKey {
    if (!gameState) return 'black';
    return normalizePlayerKey(gameState.currentPlayer);
}

function getOpponentKey(playerKey: PlayerKey | null | undefined): PlayerKey {
    return normalizePlayerKey(playerKey) === 'white' ? 'black' : 'white';
}

function normalizePendingType(value: unknown): string {
    return String(value || '').trim().toUpperCase();
}

function normalizePendingEffectId(value: unknown): string | null {
    const normalized = String(value || '').trim();
    return normalized || null;
}

function normalizeOperationId(value: unknown): string {
    const normalized = String(value || '').trim();
    if (!normalized) return '';
    return Array.from(normalized).slice(0, OPERATION_ID_MAX_LENGTH).join('');
}

function normalizeSeatHandSkinId(value: unknown): string {
    const normalized = String(value || '').trim();
    if (!normalized) return '';
    const canonical = (GachaHandCatalogShared && typeof GachaHandCatalogShared.normalizeCatalogItemId === 'function')
        ? GachaHandCatalogShared.normalizeCatalogItemId(normalized)
        : normalized;
    return Array.from(canonical).slice(0, HAND_SKIN_ID_MAX_LENGTH).join('');
}

function normalizeSeatHandSkins(value: unknown): { black: string; white: string } {
    const source = asRecord(value);
    return {
        black: normalizeSeatHandSkinId(source.black),
        white: normalizeSeatHandSkinId(source.white)
    };
}

function normalizeNetworkPlayerName(value: unknown): string {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    return Array.from(normalized).slice(0, NETWORK_PLAYER_NAME_MAX).join('');
}

function normalizeSpectatorName(value: unknown): string {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    return Array.from(normalized).slice(0, NETWORK_SPECTATOR_NAME_MAX).join('');
}

function normalizeSpectatorId(value: unknown): string {
    const raw = String(value || '').trim();
    return SPECTATOR_ID_RE.test(raw) ? raw : '';
}

function ensureSpectators(roomValue: MatchAuthorityRoomState | null | undefined): MatchAuthoritySpectators {
    const room = (roomValue && typeof roomValue === 'object') ? roomValue : null;
    if (!room) return {};
    if (!room.spectators || typeof room.spectators !== 'object') {
        room.spectators = {};
    }
    return room.spectators;
}

function getActiveSpectatorEntries(roomValue: MatchAuthorityRoomState | null | undefined): Array<[string, MatchAuthoritySpectatorState]> {
    const spectators = ensureSpectators(roomValue);
    return Object.keys(spectators)
        .map((id) => [id, spectators[id]] as [string, MatchAuthoritySpectatorState])
        .filter(([, entry]) => !!(entry && typeof entry === 'object' && String(entry.token || '').trim()));
}

function normalizePublicSeats(value: unknown): { black: boolean; white: boolean } {
    const source = asRecord(value);
    return {
        black: !!source.black,
        white: !!source.white
    };
}

function buildPublicSeatMetadata(value: unknown): {
    seats: { black: boolean; white: boolean };
    seatNames: { black: string; white: string };
    seatHandSkins: { black: string; white: string };
} {
    const source = asRecord(value);
    const seatNames = asRecord(source.seatNames);
    return {
        seats: normalizePublicSeats(source.seats),
        seatNames: {
            black: normalizeNetworkPlayerName(seatNames.black),
            white: normalizeNetworkPlayerName(seatNames.white)
        },
        seatHandSkins: normalizeSeatHandSkins(source.seatHandSkins)
    };
}

function hasRequiredOperationId(value: unknown): boolean {
    return normalizeOperationId(value) !== '';
}

function ensureAcceptedOperationsBySeat(room: MatchAuthorityRoomState | null | undefined): MatchAuthorityAcceptedOperationsBySeat {
    const source = (room && room.lastAcceptedOperationBySeat && typeof room.lastAcceptedOperationBySeat === 'object')
        ? room.lastAcceptedOperationBySeat
        : {};

    const normalized: MatchAuthorityAcceptedOperationsBySeat = {
        black: (source.black && typeof source.black === 'object') ? source.black : null,
        white: (source.white && typeof source.white === 'object') ? source.white : null
    };

    if (room && typeof room === 'object') {
        room.lastAcceptedOperationBySeat = normalized;
    }

    return normalized;
}

function normalizeAcceptedOperationEntry(value: unknown): MatchAuthorityAcceptedOperationEntry | null {
    if (!value || typeof value !== 'object') return null;
    const source = asRecord(value);
    const operationId = normalizeOperationId(source.operationId);
    if (!operationId) return null;
    return {
        operationId,
        stateVersion: normalizeStateVersion(source.stateVersion),
        updatedAt: Number.isFinite(Number(source.updatedAt)) ? Number(source.updatedAt) : null
    };
}

function ensureAcceptedOperationHistoryBySeat(room: MatchAuthorityRoomState | null | undefined): MatchAuthorityAcceptedOperationHistoryBySeat {
    const historySource = (room && room.acceptedOperationHistoryBySeat && typeof room.acceptedOperationHistoryBySeat === 'object')
        ? room.acceptedOperationHistoryBySeat
        : {};
    const lastAcceptedBySeat = ensureAcceptedOperationsBySeat(room);
    const normalized: MatchAuthorityAcceptedOperationHistoryBySeat = {
        black: [],
        white: []
    };

    for (const seatKey of PLAYER_KEYS as readonly MatchAuthoritySeatKey[]) {
        const sourceEntries = Array.isArray(historySource[seatKey])
            ? historySource[seatKey]
            : [];
        const combined = sourceEntries.slice();
        if (combined.length === 0 && lastAcceptedBySeat[seatKey]) {
            combined.push(lastAcceptedBySeat[seatKey]);
        }
        const seen = new Set<string>();
        const entries: MatchAuthorityAcceptedOperationEntry[] = [];
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

function findAcceptedOperationBySeat(
    room: MatchAuthorityRoomState | null | undefined,
    seatKey: unknown,
    operationId: unknown
): MatchAuthorityAcceptedOperationEntry | null {
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

function resolveAcceptedOperation(
    room: MatchAuthorityRoomState | null | undefined,
    seatKey: unknown,
    operationId: unknown,
    fallbackEntry?: unknown
): MatchAuthorityAcceptedOperationEntry | null {
    const matchedEntry = findAcceptedOperationBySeat(room, seatKey, operationId);
    if (matchedEntry) return matchedEntry;
    const normalizedOperationId = normalizeOperationId(operationId);
    const normalizedFallback = normalizeAcceptedOperationEntry(fallbackEntry);
    if (!normalizedOperationId || !normalizedFallback) return null;
    return normalizedFallback.operationId === normalizedOperationId
        ? normalizedFallback
        : null;
}

function rememberAcceptedOperationBySeat(
    room: MatchAuthorityRoomState | null | undefined,
    seatKey: unknown,
    entry: unknown
): MatchAuthorityAcceptedOperationEntry | null {
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

function normalizeStateVersion(value: unknown): number | null {
    return Number.isFinite(Number(value))
        ? Number(value)
        : null;
}

function classifyVersionRejectionReason(receivedBaseVersionValue: unknown, authoritativeStateVersionValue: unknown): string {
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

function isVersionRejectionReason(reasonValue: unknown): boolean {
    const normalized = String(reasonValue || '').trim();
    return normalized === VERSION_REJECTION_REASONS.MISMATCH
        || normalized === VERSION_REJECTION_REASONS.AHEAD
        || normalized === VERSION_REJECTION_REASONS.BEHIND
        || normalized === VERSION_REJECTION_REASONS.GAP;
}

function normalizePublishActionType(value: unknown): string | null {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized || null;
}

function normalizePublishMeta(value: unknown): MatchAuthorityPublishMeta {
    const source = asRecord(value);
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

function normalizeAutoPassNotice(value: unknown): MatchAuthorityAutoPassNotice | null {
    if (!value || typeof value !== 'object') return null;
    const source = asRecord(value);
    return {
        playerKey: normalizePlayerKey(source.playerKey || source.player || source.owner),
        reason: String(source.reason || '').trim() || 'no_legal_moves_or_usable_cards'
    };
}

function normalizePlaybackDigestValue(value: unknown): string {
    return value ? String(value).trim() : '';
}

function computeAuthoritativePlaybackDigest(playbackEventsValue: unknown): string {
    const playbackEvents = Array.isArray(playbackEventsValue) ? playbackEventsValue : [];
    if (PlaybackDigest && typeof PlaybackDigest.computePlaybackDigest === 'function') {
        const digest = PlaybackDigest.computePlaybackDigest(playbackEvents);
        return typeof digest === 'string' ? digest : '';
    }
    if (StateHash && typeof StateHash.computeStableHash === 'function') {
        return StateHash.computeStableHash(playbackEvents);
    }
    return '';
}

function resolvePlaybackDigest(playbackEventsValue: unknown, explicitDigestValue?: unknown): string {
    const explicitDigest = normalizePlaybackDigestValue(explicitDigestValue);
    if (explicitDigest) return explicitDigest;
    return computeAuthoritativePlaybackDigest(playbackEventsValue);
}

function buildPublishResponseOptions(options: MatchAuthorityPublishResponseOptionInput | null | undefined): MatchAuthorityPublishResponseOptions {
    const opts = asRecord(options);
    const response: MatchAuthorityPublishResponseOptions = {
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
    if (Object.prototype.hasOwnProperty.call(opts, 'playbackDigest')) {
        response.playbackDigest = opts.playbackDigest;
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'effectLogs')) {
        response.effectLogs = opts.effectLogs;
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'playbackDiagnostics')) {
        response.playbackDiagnostics = opts.playbackDiagnostics || null;
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'autoPassNotice')) {
        const autoPassNotice = normalizeAutoPassNotice(opts.autoPassNotice);
        if (autoPassNotice) response.autoPassNotice = autoPassNotice;
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'presentationCursor')) {
        response.presentationCursor = opts.presentationCursor || null;
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'presentationFrames')) {
        response.presentationFrames = Array.isArray(opts.presentationFrames) ? opts.presentationFrames : [];
    }
    return response;
}

function buildVersionRejectedPublishResponseOptions(
    room: MatchAuthorityRoomState | null | undefined,
    options: MatchAuthorityPublishResponseOptionInput | null | undefined
): MatchAuthorityPublishResponseOptions {
    const opts = asRecord(options);
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

function normalizeEffectLogMessages(values: unknown): string[] {
    const source = Array.isArray(values) ? values : [];
    const next: string[] = [];
    for (let index = 0; index < source.length; index += 1) {
        const text = String(source[index] || '').trim();
        if (!text) continue;
        if (next.length > 0 && next[next.length - 1] === text) continue;
        next.push(text);
    }
    return next;
}

function appendEffectLogMessages(...lists: unknown[]): string[] {
    const merged: unknown[] = [];
    for (let index = 0; index < lists.length; index += 1) {
        const listCandidate = lists[index];
        const list: unknown[] = Array.isArray(listCandidate) ? listCandidate : [];
        for (let innerIndex = 0; innerIndex < list.length; innerIndex += 1) {
            merged.push(list[innerIndex]);
        }
    }
    return normalizeEffectLogMessages(merged);
}

function getPlaybackAssemblyWarnings(diagnostics: unknown): string[] {
    const diagnosticsRecord = asRecord(diagnostics);
    const list = Array.isArray(diagnosticsRecord.warnings) ? diagnosticsRecord.warnings : [];
    return list
        .filter((warning: unknown) => String(warning || '').trim())
        .map((warning: unknown) => String(warning));
}

function toDebugPlaybackDiagnostics(diagnostics: unknown, networkDebugEnabled: unknown): unknown | null {
    const warnings = getPlaybackAssemblyWarnings(diagnostics);
    if (!warnings.length || networkDebugEnabled !== true) return null;
    return deepClone(diagnostics);
}

function reportPlaybackAssemblyDiagnostics(context: unknown, diagnostics: unknown, options: unknown = {}): void {
    const warnings = getPlaybackAssemblyWarnings(diagnostics);
    if (!warnings.length) return;

    const opts = asRecord(options);
    const contextLabel = String(context || '').trim() || 'unknown';
    const message = `[playback-assembly:${contextLabel}] ${warnings.join('; ')}`;
    const isTestEnv = typeof process !== 'undefined' && process && process.env && process.env.NODE_ENV === 'test';
    if (isTestEnv) {
        throw new Error(message);
    }
    if (opts.networkDebugEnabled === true) {
        console.warn(message, diagnostics);
        return;
    }
    console.error(message);
}

function getSeatLabelJa(playerKey: unknown): string {
    return normalizePlayerKey(playerKey) === 'white' ? '白' : '黒';
}

function resolveActionCardId(action: unknown): string {
    if (!action || typeof action !== 'object') return '';
    const source = asRecord(action);
    if (source.useCardId) return String(source.useCardId);
    if (source.cardId) return String(source.cardId);
    return '';
}

function resolveActionCardDisplayName(action: unknown, cardLogic: MatchAuthorityCardLogicLike | null | undefined): string {
    const cardId = resolveActionCardId(action);
    if (!cardId) return '';
    const cardDef = (cardLogic && typeof cardLogic.getCardDef === 'function')
        ? cardLogic.getCardDef(cardId)
        : null;
    const displayName = cardDef && cardDef.name ? String(cardDef.name).trim() : '';
    return displayName || cardId;
}

function buildNetworkCardUseEffectLogs(action: unknown, playerKey: unknown, cardLogic: MatchAuthorityCardLogicLike | null | undefined): string[] {
    const source = asRecord(action);
    const actionType = String(source.type || source.actionType || '').trim().toLowerCase();
    if (actionType !== 'use_card') return [];
    const displayName = resolveActionCardDisplayName(action, cardLogic);
    if (!displayName) return [];
    return [`${getSeatLabelJa(playerKey)}がカードを使用: ${displayName}`];
}

function collectPipelineEffectLogMessages(
    rawEvents: unknown,
    presentationEvents: unknown,
    playerKey: unknown,
    playbackAdapter: MatchAuthorityPlaybackAdapterLike | null | undefined
): string[] {
    const adapter = (playbackAdapter && typeof playbackAdapter.mapEffectLogsFromPipeline === 'function')
        ? playbackAdapter
        : null;
    if (!adapter) return [];
    const mapEffectLogsFromPipeline = adapter.mapEffectLogsFromPipeline;
    if (typeof mapEffectLogsFromPipeline !== 'function') return [];
    try {
        return normalizeEffectLogMessages(
            mapEffectLogsFromPipeline(rawEvents, presentationEvents, playerKey) || []
        );
    } catch (e) {
        return [];
    }
}

function buildNetworkActionEffectLogs(
    action: unknown,
    playerKey: unknown,
    cardLogic: MatchAuthorityCardLogicLike | null | undefined,
    rawEvents: unknown,
    presentationEvents: unknown,
    playbackAdapter: MatchAuthorityPlaybackAdapterLike | null | undefined
): string[] {
    return appendEffectLogMessages(
        buildNetworkCardUseEffectLogs(action, playerKey, cardLogic),
        collectPipelineEffectLogMessages(rawEvents, presentationEvents, playerKey, playbackAdapter)
    );
}

function isNetworkDebugFillHandAction(value: unknown): boolean {
    return String(value || '').trim().toLowerCase() === NETWORK_DEBUG_FILL_HAND_ACTION;
}

function isNetworkDebugFillHandPayload(value: unknown): boolean {
    if (!value || typeof value !== 'object') return false;
    const source = asRecord(value);
    const action = asRecord(source.action);
    if (isNetworkDebugFillHandAction(source.actionType)) return true;
    return isNetworkDebugFillHandAction(action.type);
}

function resolveNetworkDebugFillHandOptions(value: unknown): {
    fillWhite: boolean;
    replaceExisting: boolean;
    cardIds?: unknown[];
    charge?: number;
    chargeByPlayer?: { black?: number; white?: number };
} {
    if (!value || typeof value !== 'object') return { fillWhite: false, replaceExisting: false };
    const source = asRecord(value);
    const action = asRecord(source.action);
    const params = asRecord(source.params);
    const rawCardIds = Array.isArray(params.cardIds) ? params.cardIds : (Array.isArray(action.cardIds) ? action.cardIds : null);
    const rawCharge = Number.isFinite(Number(params.charge)) ? Number(params.charge) : (
        Number.isFinite(Number(action.charge)) ? Number(action.charge) : undefined
    );
    const rawChargeByPlayer = (params.chargeByPlayer && typeof params.chargeByPlayer === 'object')
        ? asRecord(params.chargeByPlayer)
        : ((action.chargeByPlayer && typeof action.chargeByPlayer === 'object') ? asRecord(action.chargeByPlayer) : null);
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function mergeWithDefaultShape(defaultValue: unknown, overrideValue: unknown): unknown {
    if (Array.isArray(defaultValue)) {
        return Array.isArray(overrideValue) ? deepClone(overrideValue) : deepClone(defaultValue);
    }

    if (isPlainObject(defaultValue)) {
        const result = deepClone(defaultValue) as Record<string, unknown>;
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

function mixTurnStartSeed(seed: unknown, value: unknown): number {
    const numeric = Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : 0;
    const normalizedSeed = (Number(seed) >>> 0) || 1;
    return ((normalizedSeed ^ (numeric >>> 0)) * 1664525 + 1013904223) >>> 0;
}

function createTurnStartSeed(room: MatchAuthorityRoomState | null | undefined, snapshot: unknown, playerKey: unknown): number {
    const snapshotRecord = asRecord(snapshot);
    const gameState = asRecord(snapshotRecord.gameState);
    const cardState = asRecord(snapshotRecord.cardState);
    const roomSeed = room ? room.seed : undefined;
    let seed = Number.isFinite(Number(roomSeed)) ? (Math.trunc(Number(roomSeed)) >>> 0) : 1;
    seed = mixTurnStartSeed(seed, snapshotRecord.stateVersion);
    seed = mixTurnStartSeed(seed, gameState && gameState.turnNumber);
    seed = mixTurnStartSeed(seed, cardState && cardState.turnIndex);
    seed = mixTurnStartSeed(seed, normalizePlayerKey(playerKey) === 'white' ? 0x9E3779B1 : 0x243F6A88);
    return seed || 1;
}

function normalizeRoomBoardConfig(value: unknown, fallbackBoard?: unknown): unknown {
    const source = (value !== null && typeof value !== 'undefined') ? value : fallbackBoard;
    if (SharedBoardUtils && typeof SharedBoardUtils.resolveBoardConfig === 'function') {
        const normalized = SharedBoardUtils.resolveBoardConfig(source);
        return normalized ? deepClone(normalized) : null;
    }

    const fallback = Array.isArray(source)
        ? source
        : ((source && typeof source === 'object' && Array.isArray(asRecord(source).board)) ? asRecord(source).board : (Array.isArray(fallbackBoard) ? fallbackBoard : null));
    const valueRecord = asRecord(value);
    const rows = Number(valueRecord.rows);
    const cols = Number(valueRecord.cols);
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

function resolveRoomBoardConfig(value: unknown): unknown {
    const source = asRecord(value);
    const snapshot = asRecord(source.snapshot);
    const gameState = asRecord(snapshot.gameState);
    return normalizeRoomBoardConfig(
        source.boardConfig || source.roomBoardConfig,
        gameState.board
    );
}

function assignOptionalRoomBoardConfig<T extends Record<string, unknown>>(target: T, source: unknown): T {
    if (
        target
        && typeof target === 'object'
        && source
        && typeof source === 'object'
        && Object.prototype.hasOwnProperty.call(source, 'roomBoardConfig')
    ) {
        (target as Record<string, unknown>).roomBoardConfig = asRecord(source).roomBoardConfig;
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
        networkAutoEnabled: opts.networkAutoEnabled === true,
        turnTimer: (opts.turnTimer && typeof opts.turnTimer === 'object') ? opts.turnTimer : null,
        playbackEvents: Array.isArray(opts.playbackEvents) ? opts.playbackEvents : [],
        playbackDigest: opts.playbackDigest,
        effectLogs: normalizeEffectLogMessages(opts.effectLogs),
        serverTime: opts.serverTime,
        rejectedReason: opts.rejectedReason,
        idempotentReplay: opts.idempotentReplay === true,
        errorMessage: opts.errorMessage,
        playbackDiagnostics: opts.playbackDiagnostics,
        projectedSnapshotHash: opts.projectedSnapshotHash,
        autoPassNotice: opts.autoPassNotice,
        presentationCursor: opts.presentationCursor,
        presentationFrames: opts.presentationFrames
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

    if (Object.prototype.hasOwnProperty.call(opts, 'roomName')) {
        payload.roomName = String(opts.roomName || '').trim();
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'createdAt')) {
        payload.createdAt = Number.isFinite(Number(opts.createdAt)) ? Math.trunc(Number(opts.createdAt)) : null;
    }
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
    if (Object.prototype.hasOwnProperty.call(opts, 'networkAutoEnabled')) {
        payload.networkAutoEnabled = opts.networkAutoEnabled === true;
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'turnTimer')) {
        payload.turnTimer = (opts.turnTimer && typeof opts.turnTimer === 'object') ? opts.turnTimer : null;
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'playbackEvents')) {
        payload.playbackEvents = Array.isArray(opts.playbackEvents) ? opts.playbackEvents : [];
        payload.playbackDigest = resolvePlaybackDigest(payload.playbackEvents, opts.playbackDigest);
    } else if (Object.prototype.hasOwnProperty.call(opts, 'playbackDigest')) {
        payload.playbackDigest = normalizePlaybackDigestValue(opts.playbackDigest);
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
    if (Object.prototype.hasOwnProperty.call(opts, 'autoPassNotice')) {
        const autoPassNotice = normalizeAutoPassNotice(opts.autoPassNotice);
        if (autoPassNotice) payload.autoPassNotice = autoPassNotice;
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
    if (Object.prototype.hasOwnProperty.call(opts, 'viewerRole')) {
        payload.viewerRole = String(opts.viewerRole || '').trim() === 'spectator' ? 'spectator' : 'seat';
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'spectatorId')) {
        payload.spectatorId = normalizeSpectatorId(opts.spectatorId);
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'spectatorToken')) {
        payload.spectatorToken = String(opts.spectatorToken || '').trim();
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'spectatorName')) {
        payload.spectatorName = normalizeSpectatorName(opts.spectatorName);
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'spectatorCount')) {
        payload.spectatorCount = Number.isFinite(Number(opts.spectatorCount))
            ? Math.max(0, Math.trunc(Number(opts.spectatorCount)))
            : 0;
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'maxSpectators')) {
        payload.maxSpectators = Number.isFinite(Number(opts.maxSpectators))
            ? Math.max(0, Math.trunc(Number(opts.maxSpectators)))
            : MAX_SPECTATORS;
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'presentationCursor')) {
        payload.presentationCursor = opts.presentationCursor || null;
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'presentationFrames')) {
        payload.presentationFrames = Array.isArray(opts.presentationFrames) ? opts.presentationFrames : [];
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'baseVisualSeq')) {
        payload.baseVisualSeq = Number.isFinite(Number(opts.baseVisualSeq))
            ? Math.max(0, Math.trunc(Number(opts.baseVisualSeq)))
            : 0;
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'baseSnapshot')) {
        payload.baseSnapshot = opts.baseSnapshot || null;
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
    if (!Object.prototype.hasOwnProperty.call(source, 'roomName')) {
        source.roomName = room.roomName || '';
    }
    if (!Object.prototype.hasOwnProperty.call(source, 'createdAt') && Number.isFinite(Number(room.createdAt))) {
        source.createdAt = room.createdAt;
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
    if (!Object.prototype.hasOwnProperty.call(source, 'networkAutoEnabled')) {
        source.networkAutoEnabled = room.networkAutoEnabled === true;
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
        networkAutoEnabled: opts.networkAutoEnabled === true,
        turnTimer: opts.turnTimer,
        playbackEvents: opts.playbackEvents,
        playbackDigest: opts.playbackDigest,
        effectLogs: opts.effectLogs,
        playbackDiagnostics: opts.playbackDiagnostics,
        autoPassNotice: opts.autoPassNotice,
        presentationCursor: opts.presentationCursor,
        presentationFrames: opts.presentationFrames,
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
    const payloadOptions: MatchAuthorityPresencePayloadFromRoomOptions = {
        ok: true,
        roomDeck: Object.prototype.hasOwnProperty.call(opts, 'roomDeck') ? opts.roomDeck : null,
        networkDebugEnabled: opts.networkDebugEnabled === true,
        networkAutoEnabled: opts.networkAutoEnabled === true,
        turnTimer: opts.turnTimer,
        type: opts.type,
        seatKey: opts.seatKey,
        playerName: opts.playerName,
        rejoined: opts.rejoined,
        serverTime: opts.serverTime
    };
    if (Object.prototype.hasOwnProperty.call(opts, 'spectatorId')) {
        payloadOptions.spectatorId = opts.spectatorId;
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'spectatorName')) {
        payloadOptions.spectatorName = opts.spectatorName;
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'spectatorCount')) {
        payloadOptions.spectatorCount = opts.spectatorCount;
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'maxSpectators')) {
        payloadOptions.maxSpectators = opts.maxSpectators;
    }
    return buildRoomPayloadFromRoom(room, assignOptionalRoomBoardConfig(payloadOptions, opts));
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
        networkAutoEnabled: opts.networkAutoEnabled === true,
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
        networkAutoEnabled: opts.networkAutoEnabled === true,
        turnTimer: opts.turnTimer,
        playbackEvents: opts.playbackEvents,
        playbackDigest: opts.playbackDigest,
        effectLogs: opts.effectLogs,
        playbackDiagnostics: opts.playbackDiagnostics,
        autoPassNotice: opts.autoPassNotice,
        serverTime: opts.serverTime,
        rejectedReason: opts.rejectedReason,
        idempotentReplay: opts.idempotentReplay === true,
        errorMessage: opts.errorMessage,
        presentationCursor: opts.presentationCursor,
        presentationFrames: opts.presentationFrames,
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

function shouldDisposeRoom(roomValue: unknown, streamCountValue: unknown): boolean {
    const room = (roomValue && typeof roomValue === 'object') ? asRecord(roomValue) : null;
    if (!room) return false;
    const seats = asRecord(room.seats);
    const streamCount = Number.isFinite(Number(streamCountValue))
        ? Math.max(0, Math.trunc(Number(streamCountValue)))
        : 0;
    return !(
        room.seats
        && (seats.black || seats.white)
    ) && streamCount === 0;
}

function makeHiddenHandToken(ownerKey: unknown, handIndex: unknown): string {
    const normalizedOwner = normalizePlayerKey(ownerKey);
    const idx = Number.isFinite(Number(handIndex)) ? Math.max(0, Math.trunc(Number(handIndex))) : 0;
    return `${HIDDEN_HAND_TOKEN_PREFIX}${normalizedOwner}:${idx}`;
}

function isHiddenHandTokenLike(value: unknown): boolean {
    return typeof value === 'string' && value.startsWith(HIDDEN_HAND_TOKEN_PREFIX);
}

function parseHiddenHandToken(value: unknown): { ownerKey: PlayerKey; handIndex: number } | null {
    const match = String(value || '').match(HIDDEN_HAND_TOKEN_RE);
    if (!match) return null;
    const ownerKey = normalizePlayerKey(match[1]);
    const handIndex = Number(match[2]);
    if (!Number.isInteger(handIndex) || handIndex < 0) return null;
    return { ownerKey, handIndex };
}

function normalizeProjectedHandIndex(value: unknown, fallbackIndex: unknown, handLength: unknown): number | null {
    if (typeof handLength !== 'number' || !Number.isInteger(handLength) || handLength <= 0) return null;
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < handLength) return value;
    if (typeof fallbackIndex === 'number' && Number.isInteger(fallbackIndex) && fallbackIndex >= 0 && fallbackIndex < handLength) return fallbackIndex;
    return null;
}

function normalizeCardCopyIdList(values: unknown): number[] {
    if (!Array.isArray(values)) return [];
    const next: number[] = [];
    for (const rawValue of values) {
        const numeric = Number(rawValue);
        if (!Number.isInteger(numeric) || numeric <= 0) continue;
        next.push(numeric);
    }
    return next;
}

function normalizeHandCopyIdArray(values: unknown, targetLength: unknown): Array<number | null> {
    const length = Number.isFinite(Number(targetLength)) ? Math.max(0, Math.trunc(Number(targetLength))) : 0;
    const next: Array<number | null> = Array(length).fill(null);
    if (!Array.isArray(values)) return next;
    for (let index = 0; index < length; index += 1) {
        const numeric = Number(values[index]);
        next[index] = Number.isInteger(numeric) && numeric > 0 ? numeric : null;
    }
    return next;
}

function buildVisibleHandCostAdjustments(
    cardState: Record<string, unknown>,
    ownerHandCopyIds: Array<number | null>,
    projectedOwnerHand: unknown[]
): Array<Record<string, number> | null> {
    const length = Array.isArray(projectedOwnerHand) ? projectedOwnerHand.length : 0;
    const adjustments: Array<Record<string, number> | null> = Array(length).fill(null);
    const overridesByCopyId = (cardState.cardCostOverridesByCopyId && typeof cardState.cardCostOverridesByCopyId === 'object')
        ? asRecord(cardState.cardCostOverridesByCopyId)
        : {};
    const modifiersByCopyId = (cardState.cardCostModifiersByCopyId && typeof cardState.cardCostModifiersByCopyId === 'object')
        ? asRecord(cardState.cardCostModifiersByCopyId)
        : {};

    for (let handIndex = 0; handIndex < length; handIndex += 1) {
        if (isHiddenHandTokenLike(projectedOwnerHand[handIndex])) continue;
        const copyId = ownerHandCopyIds[handIndex];
        if (!Number.isInteger(copyId) || Number(copyId) <= 0) continue;
        const copyKey = String(copyId);
        const adjustment: Record<string, number> = {};

        const overrideRecord = asRecord(overridesByCopyId[copyKey]);
        const overrideCost = Number(overrideRecord.cost);
        if (Number.isFinite(overrideCost)) {
            adjustment.overrideCost = overrideCost;
        }

        const modifierValue = modifiersByCopyId[copyKey];
        const modifierEntries = Array.isArray(modifierValue)
            ? modifierValue
            : (modifierValue && typeof modifierValue === 'object' ? [modifierValue] : []);
        let delta = 0;
        for (const modifierEntry of modifierEntries) {
            const modifierRecord = asRecord(modifierEntry);
            const modifierDelta = Number(modifierRecord.delta);
            if (Number.isFinite(modifierDelta)) {
                delta += modifierDelta;
            }
        }
        if (delta !== 0) {
            adjustment.delta = delta;
        }

        if (Object.keys(adjustment).length > 0) {
            adjustments[handIndex] = adjustment;
        }
    }

    return adjustments;
}

function resolveAuthenticatedSeatKey(
    room: MatchAuthorityRoomState | null | undefined,
    seatKeyValue: unknown,
    seatTokenValue: unknown
): MatchAuthoritySeatKey | null {
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

function addSpectatorToRoom(
    roomValue: MatchAuthorityRoomState | null | undefined,
    options?: MatchAuthoritySpectatorJoinOptions | null
): MatchAuthoritySpectatorJoinResult {
    const room = (roomValue && typeof roomValue === 'object') ? roomValue : null;
    const opts = (options && typeof options === 'object') ? options : {};
    if (!room) return { ok: false, reason: 'SPECTATOR_FULL' };

    const spectators = ensureSpectators(room);
    const activeCount = getActiveSpectatorEntries(room).length;
    if (activeCount >= MAX_SPECTATORS) {
        return { ok: false, reason: 'SPECTATOR_FULL' };
    }

    const makeId = typeof opts.makeSpectatorId === 'function'
        ? opts.makeSpectatorId
        : () => `spec_${randomFromChars(SEAT_TOKEN_CHARS, 12)}`;
    const makeToken = typeof opts.makeSpectatorToken === 'function'
        ? opts.makeSpectatorToken
        : makeSeatToken;
    const nowMs = Number.isFinite(Number(opts.now)) ? Math.trunc(Number(opts.now)) : Date.now();

    let spectatorId = '';
    for (let attempt = 0; attempt < 8; attempt += 1) {
        const candidate = normalizeSpectatorId(makeId());
        if (candidate && !spectators[candidate]) {
            spectatorId = candidate;
            break;
        }
    }
    if (!spectatorId) {
        return { ok: false, reason: 'SPECTATOR_ID_COLLISION' };
    }

    const spectatorToken = String(makeToken() || '').trim();
    const spectatorName = normalizeSpectatorName(opts.spectatorName) || '観測者';
    spectators[spectatorId] = {
        token: spectatorToken,
        name: spectatorName,
        joinedAt: nowMs,
        lastSeenAt: nowMs
    };
    room.updatedAt = nowMs;

    return {
        ok: true,
        spectatorId,
        spectatorToken,
        spectatorName,
        spectatorCount: activeCount + 1,
        maxSpectators: MAX_SPECTATORS
    };
}

function removeSpectatorFromRoom(
    roomValue: MatchAuthorityRoomState | null | undefined,
    options?: Record<string, unknown> | null
): MatchAuthoritySpectatorLeaveResult {
    const room = (roomValue && typeof roomValue === 'object') ? roomValue : null;
    const opts = (options && typeof options === 'object') ? options : {};
    if (!room) {
        return { ok: true, spectatorId: '', spectatorName: '', spectatorCount: 0, maxSpectators: MAX_SPECTATORS };
    }

    const spectatorId = normalizeSpectatorId(opts.spectatorId);
    const spectatorToken = String(opts.spectatorToken || '').trim();
    const spectators = ensureSpectators(room);
    const entry = spectatorId ? spectators[spectatorId] : null;
    if (!entry || !spectatorToken || entry.token !== spectatorToken) {
        return {
            ok: false,
            reason: spectatorToken ? 'SPECTATOR_TOKEN_MISMATCH' : 'SPECTATOR_TOKEN_REQUIRED'
        };
    }

    const spectatorName = normalizeSpectatorName(entry.name) || '観測者';
    delete spectators[spectatorId];
    room.updatedAt = Number.isFinite(Number(opts.now)) ? Math.trunc(Number(opts.now)) : Date.now();
    return {
        ok: true,
        spectatorId,
        spectatorName,
        spectatorCount: getActiveSpectatorEntries(room).length,
        maxSpectators: MAX_SPECTATORS
    };
}

function resolveAuthenticatedViewer(
    roomValue: MatchAuthorityRoomState | null | undefined,
    options?: Record<string, unknown> | null
): MatchAuthorityViewer | null {
    const room = (roomValue && typeof roomValue === 'object') ? roomValue : null;
    const opts = (options && typeof options === 'object') ? options : {};
    if (!room) return null;

    if (String(opts.viewerRole || '').trim().toLowerCase() === 'spectator') {
        const spectatorId = normalizeSpectatorId(opts.spectatorId);
        const spectatorToken = String(opts.spectatorToken || '').trim();
        const spectators = ensureSpectators(room);
        const entry = spectatorId ? spectators[spectatorId] : null;
        if (!entry || !spectatorToken || entry.token !== spectatorToken) return null;
        entry.lastSeenAt = Number.isFinite(Number(opts.now)) ? Math.trunc(Number(opts.now)) : Date.now();
        return { role: 'spectator', spectatorId };
    }

    const seatKey = resolveAuthenticatedSeatKey(room, opts.seatKey, opts.seatToken);
    return seatKey ? { role: 'seat', seatKey } : null;
}

function classifySeatTokenRejectionReason(seatTokenValue: unknown): MatchAuthoritySeatTokenRejectionReason {
    return String(seatTokenValue || '').trim()
        ? 'SEAT_TOKEN_MISMATCH'
        : 'SEAT_TOKEN_REQUIRED';
}

function stripTransientPresentationState(nextSnapshot: unknown): unknown {
    const snapshot = asRecord(nextSnapshot);
    const cardState = (snapshot.cardState && typeof snapshot.cardState === 'object')
        ? asRecord(snapshot.cardState)
        : null;
    if (cardState) {
        cardState.presentationEvents = [];
        cardState._presentationEventsPersist = [];
        delete cardState._currentActionMeta;
    }
    if (snapshot.gameState && typeof snapshot.gameState === 'object') {
        delete asRecord(snapshot.gameState).__resultShown;
    }
    return nextSnapshot;
}

function stripTransientChargeDeltaState(nextSnapshot: unknown): unknown {
    const snapshot = asRecord(nextSnapshot);
    const cardState = (snapshot.cardState && typeof snapshot.cardState === 'object')
        ? asRecord(snapshot.cardState)
        : null;
    if (cardState) {
        cardState.chargeDeltaEvents = [];
    }
    return nextSnapshot;
}

function normalizeChargeValueForAuthority(value: unknown): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return numeric;
}

function restoreMissingChargeDeltaEvents(previousSnapshot: unknown, nextSnapshot: unknown): unknown {
    const previousSnapshotRecord = asRecord(previousSnapshot);
    const nextSnapshotRecord = asRecord(nextSnapshot);
    const previousCardState = (previousSnapshotRecord.cardState && typeof previousSnapshotRecord.cardState === 'object')
        ? asRecord(previousSnapshotRecord.cardState)
        : null;
    const nextCardState = (nextSnapshotRecord.cardState && typeof nextSnapshotRecord.cardState === 'object')
        ? asRecord(nextSnapshotRecord.cardState)
        : null;
    if (!previousCardState || !nextCardState) return nextSnapshot;
    if (Array.isArray(nextCardState.chargeDeltaEvents) && nextCardState.chargeDeltaEvents.length > 0) {
        return nextSnapshot;
    }

    const previousCharge = (previousCardState.charge && typeof previousCardState.charge === 'object')
        ? asRecord(previousCardState.charge)
        : null;
    const nextCharge = (nextCardState.charge && typeof nextCardState.charge === 'object')
        ? asRecord(nextCardState.charge)
        : null;
    if (!previousCharge || !nextCharge) return nextSnapshot;

    const events: Array<{
        seq: number;
        player: string;
        before: number;
        after: number;
        delta: number;
        reason: string;
    }> = [];
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

function isTrapStoneLike(entry: unknown): boolean {
    if (!entry || typeof entry !== 'object') return false;
    const source = asRecord(entry);
    const data = asRecord(source.data);
    if (data.type === 'TRAP') return true;
    return source.type === 'TRAP';
}

function isTrapVisibleToViewer(entry: unknown, viewerSeatKey: unknown): boolean {
    if (!isTrapStoneLike(entry)) return true;
    const ownerKey = parseSeatKeyOptional(asRecord(entry).owner);
    if (!ownerKey) return false;
    return ownerKey === viewerSeatKey;
}

function sanitizeOwnerOnlyTrapState(cardState: unknown, viewerSeatKey: unknown): unknown {
    if (!cardState || typeof cardState !== 'object') return cardState;
    const state = asRecord(cardState);
    const viewer = parseSeatKeyOptional(viewerSeatKey);

    if (Array.isArray(state.markers)) {
        state.markers = state.markers.filter((marker: unknown) => isTrapVisibleToViewer(marker, viewer));
    }

    if (Array.isArray(state.specialStones)) {
        state.specialStones = state.specialStones.filter((stone: unknown) => isTrapVisibleToViewer(stone, viewer));
    }

    return cardState;
}

/**
 * Returns the FATE_WILL controller seat key for the given turn owner, or null if none.
 * Reads from snapshot.cardState.fateWillControllerByTurnOwner.
 */
function getFateWillControllerKey(snapshot: unknown, turnOwnerKey: PlayerKey | null | undefined): PlayerKey | null {
    const snapshotRecord = asRecord(snapshot);
    const cardState = (snapshotRecord.cardState && typeof snapshotRecord.cardState === 'object')
        ? asRecord(snapshotRecord.cardState)
        : null;
    if (!cardState) return null;
    const controllerMap = (cardState.fateWillControllerByTurnOwner && typeof cardState.fateWillControllerByTurnOwner === 'object')
        ? asRecord(cardState.fateWillControllerByTurnOwner)
        : {};
    const owner = parseSeatKeyOptional(turnOwnerKey);
    if (!owner) return null;
    return parseSeatKeyOptional(controllerMap[owner]) || null;
}

/**
 * Returns true if seatKey is the authenticated FATE_WILL controller for the current turn owner.
 * Only valid when it is currently the turn owner's turn (gameState.currentPlayer === turnOwnerKey).
 */
function isFateWillControllerForCurrentTurn(snapshot: unknown, seatKey: PlayerKey | null | undefined): boolean {
    const seat = parseSeatKeyOptional(seatKey);
    if (!seat) return false;
    const snapshotRecord = asRecord(snapshot);
    const gameState = (snapshotRecord.gameState && typeof snapshotRecord.gameState === 'object')
        ? snapshotRecord.gameState as Partial<GameState>
        : null;
    const currentPlayerKey = getCurrentPlayerKey(gameState);
    if (seat === currentPlayerKey) return false;
    const controllerKey = getFateWillControllerKey(snapshot, currentPlayerKey);
    return controllerKey === seat;
}

function canViewerInspectOwnerHand(snapshot: unknown, viewerSeatKey: unknown, ownerSeatKey: unknown): boolean {
    const viewer = parseSeatKeyOptional(viewerSeatKey);
    const owner = parseSeatKeyOptional(ownerSeatKey);
    if (!viewer || !owner) return false;
    if (viewer === owner) return true;
    const snapshotRecord = asRecord(snapshot);
    const gameState = (snapshotRecord.gameState && typeof snapshotRecord.gameState === 'object')
        ? snapshotRecord.gameState as Partial<GameState>
        : null;
    const currentPlayerKey = getCurrentPlayerKey(gameState);
    if (owner !== currentPlayerKey) return false;
    return getFateWillControllerKey(snapshot, owner) === viewer;
}

function isObserverWillRevealMarker(markerValue: unknown): boolean {
    const marker = asRecord(markerValue);
    const data = marker.data && typeof marker.data === 'object' ? asRecord(marker.data) : {};
    if (String(data.type || '').toUpperCase() !== 'OBSERVER_WILL') return false;
    if (ManifestStoneRegistry && typeof ManifestStoneRegistry.isManifestStoneMarker === 'function') {
        if (!ManifestStoneRegistry.isManifestStoneMarker(markerValue)) return false;
    } else {
        const kind = String(marker.kind || '');
        if (kind !== 'manifestStone' && kind !== 'specialStone') return false;
    }
    const remaining = Number(data.remainingOwnerTurns);
    return !Number.isFinite(remaining) || remaining > 0;
}

function hasActiveObserverWillReveal(snapshot: unknown, viewerSeatKey: unknown, ownerSeatKey: unknown): boolean {
    const viewer = parseSeatKeyOptional(viewerSeatKey);
    const owner = parseSeatKeyOptional(ownerSeatKey);
    if (!viewer || !owner || viewer === owner) return false;
    const snapshotRecord = asRecord(snapshot);
    const cardState = (snapshotRecord.cardState && typeof snapshotRecord.cardState === 'object')
        ? asRecord(snapshotRecord.cardState)
        : null;
    const markers = cardState && Array.isArray(cardState.markers) ? cardState.markers : [];
    return markers.some((markerValue: unknown) => {
        const marker = asRecord(markerValue);
        if (parseSeatKeyOptional(marker.owner) !== viewer) return false;
        return isObserverWillRevealMarker(markerValue);
    });
}

function projectSnapshotForViewer(
    snapshotValue: unknown,
    viewerSeatKey: PlayerKey | null | undefined,
    metadata?: MatchAuthorityProjectionMetadata
): MatchAuthorityPublicSnapshot {
    const shot = deepClone(snapshotValue || {}) as MatchAuthorityPublicSnapshot;
    const meta = (metadata && typeof metadata === 'object') ? metadata : {};
    if (Number.isFinite(Number(meta.stateVersion))) {
        shot.stateVersion = Number(meta.stateVersion);
    }
    if (Number.isFinite(Number(meta.updatedAt))) {
        shot.updatedAt = Number(meta.updatedAt);
    }

    const cardState = (shot.cardState && typeof shot.cardState === 'object') ? asRecord(shot.cardState) : null;
    if (!cardState) return shot;

    const viewer = parseSeatKeyOptional(viewerSeatKey);
    const spectatorView = String(meta.viewerRole || '').trim() === 'spectator';
    sanitizeOwnerOnlyTrapState(cardState, viewer);
    const hands = (cardState.hands && typeof cardState.hands === 'object') ? asRecord(cardState.hands) : {};
    const sourceHands: Record<PlayerKey, unknown[]> = { black: [], white: [] };
    const handCopyIdsByPlayer = (cardState._handCopyIdsByPlayer && typeof cardState._handCopyIdsByPlayer === 'object')
        ? asRecord(cardState._handCopyIdsByPlayer)
        : {};
    const revealedHandCopyIdsByViewer = (cardState._revealedHandCopyIdsByViewer && typeof cardState._revealedHandCopyIdsByViewer === 'object')
        ? asRecord(cardState._revealedHandCopyIdsByViewer)
        : {};
    const revealedCopyIdsForViewer = viewer
        ? new Set(normalizeCardCopyIdList(revealedHandCopyIdsByViewer[viewer]))
        : new Set();
    cardState.hands = cardState.hands && typeof cardState.hands === 'object' ? cardState.hands : {};
    const projectedHands = asRecord(cardState.hands);
    const observedHandSlotsByPlayer: Record<PlayerKey, number[]> = { black: [], white: [] };
    const handCostAdjustmentsByPlayer: Record<PlayerKey, Array<Record<string, number> | null>> = { black: [], white: [] };

    for (const ownerKey of PLAYER_KEYS as readonly PlayerKey[]) {
        const ownerHand = Array.isArray(hands[ownerKey])
            ? hands[ownerKey].map((cardId: unknown, handIndex: number) => (
                isHiddenHandTokenLike(cardId)
                    ? makeHiddenHandToken(ownerKey, handIndex)
                    : cardId
            ))
            : [];
        const ownerHandCopyIds = normalizeHandCopyIdArray(handCopyIdsByPlayer[ownerKey], ownerHand.length);
        sourceHands[ownerKey] = ownerHand;
        const observedSlots = new Set<number>();
        for (const observingSeat of PLAYER_KEYS as readonly PlayerKey[]) {
            if (observingSeat === ownerKey) continue;
            if (hasActiveObserverWillReveal(shot, observingSeat, ownerKey)) {
                for (let handIndex = 0; handIndex < ownerHand.length; handIndex += 1) {
                    observedSlots.add(handIndex);
                }
                continue;
            }
            const observedCopyIds = new Set(normalizeCardCopyIdList(revealedHandCopyIdsByViewer[observingSeat]));
            for (let handIndex = 0; handIndex < ownerHandCopyIds.length; handIndex += 1) {
                const cardCopyId = ownerHandCopyIds[handIndex];
                if (typeof cardCopyId === 'number' && Number.isInteger(cardCopyId) && observedCopyIds.has(cardCopyId)) {
                    observedSlots.add(handIndex);
                }
            }
        }
        observedHandSlotsByPlayer[ownerKey] = Array.from(observedSlots).sort((a, b) => a - b);
        let projectedOwnerHand: unknown[];
        if (spectatorView || canViewerInspectOwnerHand(shot, viewer, ownerKey) || hasActiveObserverWillReveal(shot, viewer, ownerKey)) {
            projectedOwnerHand = ownerHand.slice();
        } else {
            projectedOwnerHand = ownerHand.map((cardId: unknown, handIndex: number) => {
                const cardCopyId = ownerHandCopyIds[handIndex];
                const shouldReveal = viewer
                    && Number.isInteger(cardCopyId)
                    && revealedCopyIdsForViewer.has(cardCopyId)
                    && !isHiddenHandTokenLike(cardId);
                return shouldReveal ? cardId : makeHiddenHandToken(ownerKey, handIndex);
            });
        }
        projectedHands[ownerKey] = projectedOwnerHand;
        handCostAdjustmentsByPlayer[ownerKey] = buildVisibleHandCostAdjustments(
            cardState,
            ownerHandCopyIds,
            projectedOwnerHand
        );
    }
    cardState.observedHandSlotsByPlayer = observedHandSlotsByPlayer;
    cardState.handCostAdjustmentsByPlayer = handCostAdjustmentsByPlayer;

    if (Array.isArray(cardState.discard)) {
        cardState.discard = cardState.discard.filter((cardId) => !isHiddenHandTokenLike(cardId));
    }

    const selectedOwnerKey = parseSeatKeyOptional(cardState.selectedCardOwnerKey);
    if (!cardState.selectedCardId) {
        cardState.selectedCardId = null;
        cardState.selectedCardOwnerKey = null;
    }
    const canViewerInspectSelectedOwnerHand = spectatorView || canViewerInspectOwnerHand(shot, viewer, selectedOwnerKey);
    if (canViewerInspectSelectedOwnerHand && isHiddenHandTokenLike(cardState.selectedCardId)) {
        cardState.selectedCardId = null;
        cardState.selectedCardOwnerKey = null;
    }
    if (!canViewerInspectSelectedOwnerHand) {
        cardState.selectedCardId = null;
        cardState.selectedCardOwnerKey = null;
    }

    if (cardState.pendingEffectByPlayer && typeof cardState.pendingEffectByPlayer === 'object') {
        const pendingEffectByPlayer = asRecord(cardState.pendingEffectByPlayer);
        for (const ownerKey of PLAYER_KEYS as readonly PlayerKey[]) {
            const pending = asRecord(pendingEffectByPlayer[ownerKey]);
            if (!pending || pending.type !== 'CONDEMN_WILL' || !Array.isArray(pending.offers)) continue;
            const opponentKey = getOpponentKey(ownerKey);
            const opponentHand = Array.isArray(sourceHands[opponentKey]) ? sourceHands[opponentKey] : [];
            const revealToViewer = spectatorView || canViewerInspectOwnerHand(shot, viewer, ownerKey);
            pending.offers = pending.offers.map((offer: unknown, idx: number) => {
                const offerRecord = asRecord(offer);
                const parsedToken = offerRecord.cardId ? parseHiddenHandToken(offerRecord.cardId) : null;
                const fallbackIndex = parsedToken && Number.isInteger(parsedToken.handIndex) ? parsedToken.handIndex : idx;
                const handIndex = normalizeProjectedHandIndex(
                    Number.isInteger(offerRecord.handIndex) ? offerRecord.handIndex : fallbackIndex,
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
    delete cardState.cardCostOverridesByCopyId;
    delete cardState.cardCostModifiersByCopyId;

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
    if (meta.viewerRole === 'spectator') {
        asRecord(shot._meta).viewerRole = 'spectator';
    }

    return shot;
}

function normalizeViewerIdentity(value: unknown): MatchAuthorityViewer | null {
    const source = asRecord(value);
    if (String(source.role || '').trim() === 'spectator') {
        return {
            role: 'spectator',
            spectatorId: normalizeSpectatorId(source.spectatorId)
        };
    }
    const seatKey = parseSeatKeyOptional(source.seatKey || value);
    return seatKey ? { role: 'seat', seatKey } : null;
}

function getPayloadKeyForViewer(viewerValue: unknown): MatchAuthoritySeatKey | 'spectator' {
    const viewer = normalizeViewerIdentity(viewerValue);
    return viewer && viewer.role === 'seat' ? viewer.seatKey : 'spectator';
}

function withSseReplayMetadata(
    payloadValue: unknown,
    replayIndex: number,
    replayCount: number,
    lastEventId: string
): unknown {
    const payload = deepClone(payloadValue || {});
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload;
    return Object.assign(payload as Record<string, unknown>, {
        sseReplay: {
            replayed: true,
            index: replayIndex,
            count: replayCount,
            remaining: Math.max(0, replayCount - replayIndex),
            lastEventId
        }
    });
}

function buildPublicSnapshotForViewer(
    room: MatchAuthorityRoomState | null | undefined,
    viewerValue: unknown
): MatchAuthorityPublicSnapshot {
    const viewer = normalizeViewerIdentity(viewerValue);
    const viewerSeatKey = viewer && viewer.role === 'seat' ? viewer.seatKey : null;
    const shot = projectSnapshotForViewer(room && room.snapshot ? room.snapshot : {}, viewerSeatKey, {
        stateVersion: room ? room.stateVersion : 0,
        updatedAt: room ? room.updatedAt : Date.now(),
        projectedForSeat: viewerSeatKey,
        viewerRole: viewer && viewer.role === 'spectator' ? 'spectator' : null,
        turnStartReconciled: true
    });
    stripTransientPresentationState(shot);
    const projectedSnapshotHash = computeProjectedSnapshotHash(shot);
    if (!shot._meta || typeof shot._meta !== 'object') {
        shot._meta = {};
    }
    asRecord(shot._meta).projectedSnapshotHash = projectedSnapshotHash;
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
    stripTransientPresentationState(shot);
    const projectedSnapshotHash = computeProjectedSnapshotHash(shot);
    if (!shot._meta || typeof shot._meta !== 'object') {
        shot._meta = {};
    }
    asRecord(shot._meta).projectedSnapshotHash = projectedSnapshotHash;
    return shot;
}

function cloneSnapshotHashSource(snapshotValue: unknown): unknown {
    const shot = deepClone(snapshotValue || {}) as Record<string, unknown>;
    if (shot && typeof shot === 'object' && shot._meta && typeof shot._meta === 'object') {
        const meta = asRecord(shot._meta);
        delete meta.projectedSnapshotHash;
        delete meta.authoritativeStateHash;
    }
    return shot;
}

function computeAuthoritativeStateHash(snapshotValue: unknown): string | null {
    if (!StateHash || typeof StateHash.computeStableHash !== 'function') return null;
    return StateHash.computeStableHash(cloneSnapshotHashSource(snapshotValue));
}

function computeProjectedSnapshotHash(snapshotValue: unknown): string | null {
    if (!StateHash || typeof StateHash.computeStableHash !== 'function') return null;
    return StateHash.computeStableHash(cloneSnapshotHashSource(snapshotValue));
}

function validatePendingSelectionPublish(snapshotValue: unknown, playerKey: unknown, actionValue: unknown): { ok: boolean; pendingEffectId?: string | null; rejectedReason?: string } {
    const action = (actionValue && typeof actionValue === 'object') ? asRecord(actionValue) : null;
    const pendingSelectionState = (action && action.pendingSelectionState && typeof action.pendingSelectionState === 'object')
        ? asRecord(action.pendingSelectionState)
        : null;
    if (!pendingSelectionState) {
        return { ok: true };
    }

    const snapshot = (snapshotValue && typeof snapshotValue === 'object') ? asRecord(snapshotValue) : null;
    const cardState = (snapshot && snapshot.cardState && typeof snapshot.cardState === 'object') ? asRecord(snapshot.cardState) : null;
    const pendingByPlayer = (cardState && cardState.pendingEffectByPlayer && typeof cardState.pendingEffectByPlayer === 'object')
        ? asRecord(cardState.pendingEffectByPlayer)
        : null;
    const expectedPending = pendingByPlayer ? asRecord(pendingByPlayer[normalizePlayerKey(playerKey)]) : null;
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

function normalizeCardIdOptional(value: unknown): string | null {
    const normalized = String(value || '').trim();
    return normalized || null;
}

function hasCardInHandForAuthority(cardState: unknown, ownerKey: unknown, cardId: unknown): boolean {
    const state = asRecord(cardState);
    const hands = state.hands && typeof state.hands === 'object'
        ? asRecord(state.hands)
        : null;
    const owner = normalizePlayerKey(ownerKey);
    const hand = hands && Array.isArray(hands[owner]) ? hands[owner] : [];
    const normalizedCardId = normalizeCardIdOptional(cardId);
    if (!normalizedCardId) return false;
    for (let index = 0; index < hand.length; index += 1) {
        if (normalizeCardIdOptional(hand[index]) === normalizedCardId) {
            return true;
        }
    }
    return false;
}

function hasCardInDiscardForAuthority(cardState: unknown, cardId: unknown): boolean {
    const state = asRecord(cardState);
    const discard = Array.isArray(state.discard) ? state.discard : [];
    const normalizedCardId = normalizeCardIdOptional(cardId);
    if (!normalizedCardId) return false;
    for (let index = 0; index < discard.length; index += 1) {
        if (normalizeCardIdOptional(discard[index]) === normalizedCardId) {
            return true;
        }
    }
    return false;
}

function shouldStripCommittedPendingCardUse(cardState: unknown, playerKey: unknown, action: unknown, expectedPending: unknown): boolean {
    const state = asRecord(cardState);
    const actionRecord = asRecord(action);
    const pendingRecord = asRecord(expectedPending);
    const normalizedPlayerKey = normalizePlayerKey(playerKey);
    const normalizedUseCardId = normalizeCardIdOptional(actionRecord.useCardId);
    const normalizedPendingCardId = normalizeCardIdOptional(pendingRecord.cardId);
    if (!normalizedUseCardId || !normalizedPendingCardId || normalizedUseCardId !== normalizedPendingCardId) {
        return false;
    }

    const normalizedHandOwnerKey = normalizePlayerKey(actionRecord.useCardOwnerKey, normalizedPlayerKey);
    const hasUsedCardThisTurn = !!(
        state.hasUsedCardThisTurnByPlayer
        && asRecord(state.hasUsedCardThisTurnByPlayer)[normalizedPlayerKey] === true
    );
    const cardStillInHand = hasCardInHandForAuthority(cardState, normalizedHandOwnerKey, normalizedUseCardId);
    const cardAlreadyInDiscard = hasCardInDiscardForAuthority(cardState, normalizedUseCardId);

    return hasUsedCardThisTurn || cardAlreadyInDiscard || !cardStillInHand;
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
    const expectedPending = pendingByPlayer ? asRecord(pendingByPlayer[normalizePlayerKey(playerKey)]) : null;
    if (!expectedPending || !expectedPending.type) return actionValue;

    if (!shouldStripCommittedPendingCardUse(cardState, playerKey, action, expectedPending)) {
        return actionValue;
    }

    const nextAction = deepClone(action) as Record<string, unknown>;
    delete nextAction.useCardId;
    delete nextAction.useCardOwnerKey;
    delete nextAction.useCardHandIndex;
    return nextAction;
}

function appendAuthorityLog(roomValue: unknown, entryValue: unknown, limitValue: unknown): unknown[] {
    const room = (roomValue && typeof roomValue === 'object') ? asRecord(roomValue) : null;
    if (!room) return [];
    const entry = (entryValue && typeof entryValue === 'object') ? asRecord(entryValue) : {};
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

function normalizeSseEventId(value: unknown): string {
    const normalized = String(value || '').trim();
    return normalized || '';
}

function createBufferedSseEventRecord(options: MatchAuthorityBufferedSseEventRecordInput): MatchAuthorityBufferedSseEventRecord | null {
    const opts = (options && typeof options === 'object') ? options : {};
    const eventId = normalizeSseEventId(opts.eventId);
    if (!eventId) return null;

    const record: MatchAuthorityBufferedSseEventRecord = {
        id: eventId,
        event: String(opts.eventName || '').trim() || 'message'
    };
    const sourcePayloadByViewer = (opts.payloadByViewer && typeof opts.payloadByViewer === 'object')
        ? opts.payloadByViewer
        : null;

    if (sourcePayloadByViewer) {
        const payloadByViewer: MatchAuthorityBufferedSsePayloadByViewer = {};
        for (const [viewerKey, viewerPayload] of Object.entries(sourcePayloadByViewer)) {
            const normalizedViewer = viewerKey === 'spectator' ? 'spectator' : parseSeatKeyOptional(viewerKey);
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
    const buffer: MatchAuthorityBufferedSseEventRecord[] = Array.isArray(bufferValue) ? bufferValue.slice() : [];
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

    const buffer: MatchAuthorityBufferedSseEventRecord[] = Array.isArray(bufferValue) ? bufferValue : [];
    let startIndex = -1;
    for (let index = buffer.length - 1; index >= 0; index -= 1) {
        const entry = buffer[index];
        if (entry && normalizeSseEventId(entry.id) === lastEventId) {
            startIndex = index;
            break;
        }
    }
    if (startIndex < 0) return null;

    const viewer = getPayloadKeyForViewer(viewerSeatKey);
    const replaySources: Array<{ eventId: string; eventName: string; payload: unknown }> = [];
    for (let index = startIndex + 1; index < buffer.length; index += 1) {
        const entry = buffer[index];
        if (!entry || typeof entry !== 'object') continue;

        let payload;
        if (entry.payloadByViewer && typeof entry.payloadByViewer === 'object') {
            if (!Object.prototype.hasOwnProperty.call(entry.payloadByViewer, viewer)) continue;
            payload = entry.payloadByViewer[viewer];
        } else if (Object.prototype.hasOwnProperty.call(entry, 'payload')) {
            payload = entry.payload;
        } else {
            continue;
        }

        replaySources.push({
            eventId: normalizeSseEventId(entry.id),
            eventName: String(entry.event || '').trim() || 'message',
            payload
        });
    }

    const replayCount = replaySources.length;
    const replayEvents: MatchAuthorityBufferedSseReplayEvent[] = replaySources.map((entry, index) => {
        const replayIndex = index + 1;
        return {
            eventId: entry.eventId,
            eventName: entry.eventName,
            payload: withSseReplayMetadata(entry.payload, replayIndex, replayCount, lastEventId),
            replayIndex,
            replayCount,
            replayRemaining: Math.max(0, replayCount - replayIndex)
        };
    });
    return replayEvents;
}

function toPositiveInteger(value: unknown, fallback: number): number {
    return Number.isFinite(Number(value)) ? Math.max(0, Math.trunc(Number(value))) : fallback;
}

function normalizePresentationPayload(value: unknown): MatchAuthorityPresentationFramePayload {
    const source = asRecord(value);
    const playbackEvents = Array.isArray(source.playbackEvents) ? deepClone(source.playbackEvents) as unknown[] : [];
    return {
        playbackEvents,
        playbackDigest: resolvePlaybackDigest(playbackEvents, source.playbackDigest),
        effectLogs: normalizeEffectLogMessages(source.effectLogs),
        playbackDiagnostics: source.playbackDiagnostics || null
    };
}

function ensurePresentationJournal(roomValue: MatchAuthorityRoomState | null | undefined): MatchAuthorityPresentationJournalEntry[] {
    const room = roomValue && typeof roomValue === 'object' ? roomValue : null;
    if (!room) return [];
    if (!Array.isArray(room.presentationJournal)) room.presentationJournal = [];
    return room.presentationJournal;
}

function getPresentationPayloadKeyForViewer(viewer: MatchAuthorityViewer | null | undefined): MatchAuthorityPresentationPayloadKey {
    return viewer && viewer.role === 'seat' ? viewer.seatKey : 'spectator';
}

function normalizePresentationViewer(viewerValue: unknown): MatchAuthorityViewer | null {
    const viewer = normalizeViewerIdentity(viewerValue);
    return viewer || null;
}

function appendPresentationFrame(
    roomValue: MatchAuthorityRoomState | null | undefined,
    inputValue: unknown
): MatchAuthorityPresentationJournalEntry | null {
    const room = roomValue && typeof roomValue === 'object' ? roomValue : null;
    if (!room) return null;
    const input = asRecord(inputValue);
    const journal = ensurePresentationJournal(room);
    const visualSeq = toPositiveInteger(room.visualSeq, 0) + 1;
    const payloadByViewer: Partial<Record<MatchAuthorityPresentationPayloadKey, MatchAuthorityPresentationFramePayload>> = {};
    const sourcePayloadByViewer = asRecord(input.payloadByViewer);
    for (const key of ['black', 'white', 'spectator'] as MatchAuthorityPresentationPayloadKey[]) {
        if (Object.prototype.hasOwnProperty.call(sourcePayloadByViewer, key)) {
            payloadByViewer[key] = normalizePresentationPayload(sourcePayloadByViewer[key]);
        }
    }

    const snapshotAfterByViewer: Partial<Record<MatchAuthorityPresentationPayloadKey, unknown>> = {};
    const sourceSnapshotAfterByViewer = asRecord(input.snapshotAfterByViewer);
    for (const key of ['black', 'white', 'spectator'] as MatchAuthorityPresentationPayloadKey[]) {
        if (Object.prototype.hasOwnProperty.call(sourceSnapshotAfterByViewer, key)) {
            snapshotAfterByViewer[key] = deepClone(sourceSnapshotAfterByViewer[key]);
        }
    }

    const entry: MatchAuthorityPresentationJournalEntry = {
        visualSeq,
        stateVersionFrom: toPositiveInteger(input.stateVersionFrom, 0),
        stateVersionTo: toPositiveInteger(input.stateVersionTo, 0),
        operationId: normalizeOperationId(input.operationId) || null,
        actorSeatKey: parseSeatKeyOptional(input.actorSeatKey),
        actionType: normalizePublishActionType(input.actionType),
        payloadByViewer,
        snapshotAfterByViewer,
        createdAt: Number.isFinite(Number(input.createdAt)) ? Number(input.createdAt) : Date.now()
    };

    journal.push(entry);
    room.visualSeq = visualSeq;
    return entry;
}

function toPublicPresentationFrame(
    entryValue: unknown,
    viewerValue: unknown,
    roomValue?: MatchAuthorityRoomState | null | undefined
): MatchAuthorityPresentationFramePublic {
    const entry = entryValue && typeof entryValue === 'object'
        ? entryValue as MatchAuthorityPresentationJournalEntry
        : {} as MatchAuthorityPresentationJournalEntry;
    const viewer = normalizePresentationViewer(viewerValue);
    const payloadKey = getPresentationPayloadKeyForViewer(viewer);
    const payloadByViewer = entry.payloadByViewer && typeof entry.payloadByViewer === 'object' ? entry.payloadByViewer : {};
    const payload = payloadByViewer[payloadKey] || payloadByViewer.spectator || {};
    const snapshotAfterByViewer = entry.snapshotAfterByViewer && typeof entry.snapshotAfterByViewer === 'object' ? entry.snapshotAfterByViewer : {};
    const snapshotAfter = snapshotAfterByViewer[payloadKey] || snapshotAfterByViewer.spectator || null;
    const snapshotMeta = snapshotAfter && typeof snapshotAfter === 'object'
        ? asRecord(asRecord(snapshotAfter)._meta)
        : {};
    const room = roomValue && typeof roomValue === 'object' ? roomValue : {};
    const playbackEvents = Array.isArray(payload.playbackEvents) ? deepClone(payload.playbackEvents) as unknown[] : [];

    return {
        roomId: room.roomId ? String(room.roomId).trim().toUpperCase() : null,
        visualSeq: toPositiveInteger(entry.visualSeq, 0),
        stateVersionFrom: toPositiveInteger(entry.stateVersionFrom, 0),
        stateVersionTo: toPositiveInteger(entry.stateVersionTo, 0),
        operationId: entry.operationId || null,
        actorSeatKey: parseSeatKeyOptional(entry.actorSeatKey),
        actionType: normalizePublishActionType(entry.actionType),
        playbackEvents,
        playbackDigest: resolvePlaybackDigest(playbackEvents, payload.playbackDigest),
        effectLogs: normalizeEffectLogMessages(payload.effectLogs),
        playbackDiagnostics: payload.playbackDiagnostics || null,
        projectedSnapshotHash: snapshotMeta.projectedSnapshotHash ? String(snapshotMeta.projectedSnapshotHash) : null,
        snapshotAfter: snapshotAfter ? deepClone(snapshotAfter) : null,
        createdAt: Number.isFinite(Number(entry.createdAt)) ? Number(entry.createdAt) : Date.now()
    };
}

function getPresentationFramesAfter(
    roomValue: MatchAuthorityRoomState | null | undefined,
    afterVisualSeq: unknown,
    viewerValue: unknown
): MatchAuthorityPresentationFramePublic[] {
    const room = roomValue && typeof roomValue === 'object' ? roomValue : {};
    const minSeq = toPositiveInteger(afterVisualSeq, 0);
    const journal = Array.isArray(room.presentationJournal) ? room.presentationJournal : [];
    return journal
        .filter((entry) => entry && Number(entry.visualSeq) > minSeq)
        .sort((a, b) => Number(a.visualSeq) - Number(b.visualSeq))
        .map((entry) => toPublicPresentationFrame(entry, viewerValue, room));
}

function findPresentationFrameEntryForOperation(
    roomValue: MatchAuthorityRoomState | null | undefined,
    operationIdValue: unknown,
    stateVersionValue?: unknown
): MatchAuthorityPresentationJournalEntry | null {
    const room = roomValue && typeof roomValue === 'object' ? roomValue : {};
    const operationId = normalizeOperationId(operationIdValue);
    if (!operationId) return null;
    const stateVersion = normalizeStateVersion(stateVersionValue);
    const journal = Array.isArray(room.presentationJournal) ? room.presentationJournal : [];
    for (let index = journal.length - 1; index >= 0; index -= 1) {
        const entry = journal[index];
        if (!entry || normalizeOperationId(entry.operationId) !== operationId) continue;
        if (stateVersion !== null && normalizeStateVersion(entry.stateVersionTo) !== stateVersion) continue;
        return entry;
    }
    return null;
}

function findPresentationFrameEntryForAcceptedOperation(
    roomValue: MatchAuthorityRoomState | null | undefined,
    acceptedOperationValue: unknown
): MatchAuthorityPresentationJournalEntry | null {
    const acceptedOperation = normalizeAcceptedOperationEntry(acceptedOperationValue);
    if (!acceptedOperation) return null;
    return findPresentationFrameEntryForOperation(
        roomValue,
        acceptedOperation.operationId,
        acceptedOperation.stateVersion
    );
}

function findBaseSnapshotForVisualSeq(
    roomValue: MatchAuthorityRoomState | null | undefined,
    afterVisualSeq: number,
    viewerValue: unknown
): unknown {
    const room = roomValue && typeof roomValue === 'object' ? roomValue : {};
    const viewer = normalizePresentationViewer(viewerValue);
    const payloadKey = getPresentationPayloadKeyForViewer(viewer);
    if (afterVisualSeq <= 0) {
        const initial = room.initialSnapshotByViewer && room.initialSnapshotByViewer[payloadKey];
        return initial || room.snapshot || null;
    }
    const journal = Array.isArray(room.presentationJournal) ? room.presentationJournal : [];
    const entry = journal.find((item) => Number(item && item.visualSeq) === afterVisualSeq);
    if (!entry) return null;
    return (entry.snapshotAfterByViewer && entry.snapshotAfterByViewer[payloadKey])
        || (entry.snapshotAfterByViewer && entry.snapshotAfterByViewer.spectator)
        || null;
}

function buildPresentationJournalResponse(
    roomValue: MatchAuthorityRoomState | null | undefined,
    options?: Record<string, unknown> | null
): Record<string, unknown> {
    const room = roomValue && typeof roomValue === 'object' ? roomValue : {};
    const opts = asRecord(options);
    const afterVisualSeq = toPositiveInteger(opts.afterVisualSeq, 0);
    const currentVisualSeq = toPositiveInteger(room.visualSeq, 0);
    const currentStateVersion = toPositiveInteger(room.stateVersion, 0);
    const presentationCursor = { visualSeq: currentVisualSeq, stateVersion: currentStateVersion };
    const baseSnapshot = findBaseSnapshotForVisualSeq(room, afterVisualSeq, opts.viewer);
    const serverTime = Number.isFinite(Number(opts.serverTime)) ? Number(opts.serverTime) : Date.now();
    const roomId = room.roomId ? String(room.roomId).trim().toUpperCase() : null;

    if (!baseSnapshot) {
        return {
            ok: false,
            roomId,
            reason: 'VISUAL_CURSOR_EXPIRED',
            baseVisualSeq: afterVisualSeq,
            baseSnapshot: null,
            presentationCursor,
            presentationFrames: [],
            snapshot: room.snapshot || null,
            serverTime
        };
    }

    return {
        ok: true,
        roomId,
        baseVisualSeq: afterVisualSeq,
        baseSnapshot: deepClone(baseSnapshot),
        presentationCursor,
        presentationFrames: getPresentationFramesAfter(room, afterVisualSeq, opts.viewer),
        serverTime
    };
}

function resolveBufferedSnapshotPayloadForViewer(
    entry: MatchAuthorityBufferedSseEventRecord,
    viewerSeatKey: unknown
): unknown | null {
    if (!entry || typeof entry !== 'object') return null;
    if (String(entry.event || '').trim() !== 'snapshot') return null;

    const viewer = getPayloadKeyForViewer(viewerSeatKey);
    if (entry.payloadByViewer && typeof entry.payloadByViewer === 'object') {
        if (!Object.prototype.hasOwnProperty.call(entry.payloadByViewer, viewer)) return null;
        return entry.payloadByViewer[viewer] || null;
    }
    return Object.prototype.hasOwnProperty.call(entry, 'payload') ? (entry.payload || null) : null;
}

function getPayloadStateVersion(payloadValue: unknown): number | null {
    const payload = asRecord(payloadValue);
    const directVersion = normalizeStateVersion(payload.stateVersion);
    if (directVersion !== null) return directVersion;

    const snapshot = asRecord(payload.snapshot);
    const snapshotVersion = normalizeStateVersion(snapshot.stateVersion);
    if (snapshotVersion !== null) return snapshotVersion;

    return normalizeStateVersion(asRecord(snapshot._meta).version);
}

function getBufferedSnapshotPayloadForStateVersion(
    bufferValue: unknown,
    stateVersionValue: unknown,
    viewerSeatKey: unknown
): unknown | null {
    const stateVersion = normalizeStateVersion(stateVersionValue);
    if (stateVersion === null) return null;

    const buffer: MatchAuthorityBufferedSseEventRecord[] = Array.isArray(bufferValue) ? bufferValue : [];
    for (let index = buffer.length - 1; index >= 0; index -= 1) {
        const entry = buffer[index];
        const payload = resolveBufferedSnapshotPayloadForViewer(entry, viewerSeatKey);
        if (!payload) continue;
        if (getPayloadStateVersion(payload) === stateVersion) {
            return deepClone(payload);
        }
    }
    return null;
}

const matchAuthority = assertMatchAuthorityPublicApi({
    PLAYER_KEYS,
    OPERATION_ID_MAX_LENGTH,
    SSE_RESUME_BUFFER_LIMIT,
    NETWORK_PLAYER_NAME_MAX,
    CHAT_MAX_LENGTH,
    CHAT_HISTORY_LIMIT,
    NETWORK_TURN_LIMIT_SECONDS,
    NETWORK_TURN_LIMIT_MS,
    SSE_HEARTBEAT_INTERVAL_MS,
    MAX_SPECTATORS,
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
    normalizeSpectatorName,
    normalizeSpectatorId,
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
    addSpectatorToRoom,
    removeSpectatorFromRoom,
    resolveAuthenticatedViewer,
    getPayloadKeyForViewer,
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
    getPlaybackAssemblyWarnings,
    toDebugPlaybackDiagnostics,
    reportPlaybackAssemblyDiagnostics,
    getSeatLabelJa,
    resolveActionCardId,
    resolveActionCardDisplayName,
    buildNetworkCardUseEffectLogs,
    collectPipelineEffectLogMessages,
    buildNetworkActionEffectLogs,
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
    buildPublicSnapshotForViewer,
    buildPublicSnapshot,
    validatePendingSelectionPublish,
    sanitizePendingSelectionActionForAuthority,
    appendAuthorityLog,
    createBufferedSseEventRecord,
    appendBufferedSseEvent,
    getBufferedSseReplayEvents,
    getBufferedSnapshotPayloadForStateVersion,
    appendPresentationFrame,
    getPresentationFramesAfter,
    findPresentationFrameEntryForOperation,
    findPresentationFrameEntryForAcceptedOperation,
    buildPresentationJournalResponse,
    toPublicPresentationFrame
});

export = matchAuthority;
