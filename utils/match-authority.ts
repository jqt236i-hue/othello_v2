declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

import type { PlayerKey } from '../src/types';
import * as NetworkContract from '../shared/network-contract';
import * as SharedBoardUtilsStaticModule from '../shared/shared-board-utils';
import GachaHandCatalogImport = require('../shared/gacha-hand-catalog-shared');
import StateHashImport = require('../shared/state-hash');
import PlaybackDigestImport = require('../shared/playback-digest');
import ManifestStoneRegistryImport = require('../shared/manifest-stone-registry');
import PlayerIdentityContractImport = require('../shared/player-identity-contract');
import type {
    MatchAuthorityAcceptedOperationEntry,
    MatchAuthorityAcceptedOperationHistoryBySeat,
    MatchAuthorityAcceptedOperationsBySeat,
    MatchAuthorityAutoPassNotice,
    MatchAuthorityBufferedSseEventRecord,
    MatchAuthorityBufferedSseEventRecordInput,
    MatchAuthorityBufferedSseReplayEvent,
    MatchAuthorityHeartbeatPayloadFromRoomOptions,
    MatchAuthorityPresencePayloadFromRoomOptions,
    MatchAuthorityPresentationFramePublic,
    MatchAuthorityPresentationJournalEntry,
    MatchAuthorityProjectionMetadata,
    MatchAuthorityPublicSnapshot,
    MatchAuthorityPublishMeta,
    MatchAuthorityPublishPayloadFromRoomOptions,
    MatchAuthorityPublishResponseMode,
    MatchAuthorityPublishResponseOptions,
    MatchAuthorityPublishResponsePayload,
    MatchAuthorityRoomPayload,
    MatchAuthorityRoomPayloadFromRoomOptions,
    MatchAuthorityRoomPayloadOptions,
    MatchAuthorityRoomState,
    MatchAuthoritySeatKey,
    MatchAuthoritySeatLeaveOptions,
    MatchAuthoritySeatLeaveResult,
    MatchAuthoritySeatPlayerIds,
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
import {
    getCurrentPlayerKey,
    getOpponentKey,
    isValidNetworkRoomId,
    normalizeNetworkPlayerName,
    normalizeNetworkRoomId,
    normalizeOperationId,
    OPERATION_ID_MAX_LENGTH,
    parseNetworkChatMessage,
    parseSeatKeyOptional,
    normalizePlayerKey
} from './match-authority/identity';
import { createMatchAuthorityJournalApi } from './match-authority/journal';
import { createMatchAuthorityPresentationJournalApi } from './match-authority/presentation-journal';
import { createMatchAuthoritySnapshotStateApi } from './match-authority/snapshot-state';
import { createMatchAuthorityHandProjectionApi } from './match-authority/hand-projection';
import { createMatchAuthorityRoomLifecycleApi } from './match-authority/room-lifecycle';
import { createTrapVisibilityApi } from './match-authority/trap-visibility';
import { createMatchAuthorityProjectionApi } from './match-authority/projection';
import { createMatchAuthorityPublishApi } from './match-authority/publish';
import { createMatchAuthorityOperationsApi } from './match-authority/operations';
import { createMatchAuthorityPendingSelectionApi } from './match-authority/pending-selection';
import { createMatchAuthorityBoardContractApi } from './match-authority/board-contract';
import { sanitizePublicRoomDeck } from './match-room-deck';

import deepClone from './deepClone';

interface MatchAuthorityCryptoLike {
    getRandomValues(array: Uint8Array): Uint8Array;
}

interface MatchAuthoritySharedBoardUtils {
    [key: string]: unknown;
    BOARD_CONTRACT_VERSION?: unknown;
    resolveBoardConfig?: (value?: unknown, fallbackBoard?: unknown) => unknown;
    inspectBoardState?: (
        gameState: unknown,
        cardState: unknown,
        options?: { strict?: boolean }
    ) => { ok?: unknown; errors?: unknown; warnings?: unknown };
    canonicalizeStateBoard?: (
        gameState: unknown,
        cardState: unknown,
        options?: { strict?: boolean }
    ) => { ok?: unknown; errors?: unknown; warnings?: unknown };
    countStateDiscs?: (
        gameState: unknown,
        cardState: unknown
    ) => { black: number; white: number };
}

interface MatchAuthorityGachaHandCatalogShared {
    [key: string]: unknown;
    normalizeCatalogItemId?: (value: unknown) => string;
}

interface MatchAuthorityStateHash {
    [key: string]: unknown;
    computeStableHash?: (value: unknown) => string;
    computeStableTextHash?: (text: string) => string;
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

function requireStaticSharedBoardUtils(moduleValue: unknown): MatchAuthoritySharedBoardUtils {
    const direct = moduleValue && typeof moduleValue === 'object'
        ? moduleValue as MatchAuthoritySharedBoardUtils
        : null;
    const nestedDefault = direct && (direct as Record<string, unknown>).default;
    const resolved = direct && typeof direct.inspectBoardState === 'function'
        ? direct
        : nestedDefault && typeof nestedDefault === 'object'
            ? nestedDefault as MatchAuthoritySharedBoardUtils
            : null;
    const requiredApis = ['inspectBoardState', 'canonicalizeStateBoard', 'countStateDiscs'] as const;
    const missingApis = requiredApis.filter((apiName) => (
        !resolved || typeof resolved[apiName] !== 'function'
    ));
    if (!resolved || missingApis.length > 0) {
        throw new Error(`MatchAuthority requires SharedBoardUtils APIs: ${missingApis.join(', ')}`);
    }
    return resolved;
}

const SharedBoardUtils = requireStaticSharedBoardUtils(SharedBoardUtilsStaticModule);
const GachaHandCatalogShared = GachaHandCatalogImport as unknown as MatchAuthorityGachaHandCatalogShared;
const StateHash = StateHashImport as unknown as MatchAuthorityStateHash;
const PlaybackDigest = PlaybackDigestImport as unknown as MatchAuthorityPlaybackDigest;
const ManifestStoneRegistry = ManifestStoneRegistryImport as unknown as MatchAuthorityManifestStoneRegistry;
const PlayerIdentityContract = PlayerIdentityContractImport as unknown as {
    normalizePlayerId?: (value: unknown) => string | null;
    normalizeSeatPlayerIds?: (value: unknown) => MatchAuthoritySeatPlayerIds;
};


const PLAYER_KEYS = Object.freeze(['black', 'white']);
const HIDDEN_HAND_TOKEN_PREFIX = '__hidden_hand__:';
const HIDDEN_HAND_TOKEN_RE = /^__hidden_hand__:(black|white):(\d+)$/;
const HAND_SKIN_ID_MAX_LENGTH = 128;
const SSE_RESUME_BUFFER_LIMIT = 8;
const PRESENTATION_JOURNAL_LIMIT = 8;
const ACCEPTED_OPERATION_HISTORY_LIMIT = 16;
const NETWORK_PLAYER_NAME_MAX = NetworkContract.NETWORK_PLAYER_NAME_MAX;
const CHAT_MAX_LENGTH = NetworkContract.NETWORK_CHAT_MAX_LENGTH;
const CHAT_HISTORY_LIMIT = NetworkContract.NETWORK_CHAT_HISTORY_LIMIT;
const NETWORK_TURN_LIMIT_SECONDS = NetworkContract.NETWORK_TURN_LIMIT_SECONDS;
const NETWORK_TURN_LIMIT_MIN_SECONDS = NetworkContract.NETWORK_TURN_LIMIT_MIN_SECONDS;
const NETWORK_TURN_LIMIT_MAX_SECONDS = NetworkContract.NETWORK_TURN_LIMIT_MAX_SECONDS;
const NETWORK_TURN_LIMIT_MS = NetworkContract.NETWORK_TURN_LIMIT_MS;
const normalizeNetworkTurnLimitSeconds = NetworkContract.normalizeNetworkTurnLimitSeconds;
const PRIVATE_PUBLIC_PAYLOAD_DECK_FIELDS = Object.freeze([
    'deckCode',
    'deckCodeByPlayer',
    'deckSpec',
    'initialDeckCardIdsByPlayer',
    'initialDeckSpec',
    'initialDeckSpecByPlayer'
]);
const SSE_HEARTBEAT_INTERVAL_MS = 10000;
const MAX_SPECTATORS = 4;
const NETWORK_SPECTATOR_NAME_MAX = NETWORK_PLAYER_NAME_MAX;
const NETWORK_DEBUG_FILL_HAND_ACTION = 'debug_fill_hand';
const AUTHORITY_LOG_LIMIT = 64;
const ROOM_ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_ID_LENGTH = NetworkContract.NETWORK_ROOM_ID_LENGTH;
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
const matchAuthorityJournal = createMatchAuthorityJournalApi({
    authorityLogLimit: AUTHORITY_LOG_LIMIT,
    sseResumeBufferLimit: SSE_RESUME_BUFFER_LIMIT,
    normalizePendingEffectId,
    normalizeStateVersion,
    parseSeatKeyOptional,
    getPayloadKeyForViewer
});
const matchAuthorityPresentationJournal = createMatchAuthorityPresentationJournalApi({
    presentationJournalLimit: PRESENTATION_JOURNAL_LIMIT,
    normalizeViewerIdentity,
    normalizeOperationId,
    normalizeStateVersion,
    parseSeatKeyOptional,
    normalizePublishActionType,
    normalizeAcceptedOperationEntry,
    resolvePlaybackDigest,
    normalizeEffectLogMessages
});
const matchAuthoritySnapshotState = createMatchAuthoritySnapshotStateApi({ playerKeys: PLAYER_KEYS });
const matchAuthorityHandProjection = createMatchAuthorityHandProjectionApi({
    hiddenHandTokenPrefix: HIDDEN_HAND_TOKEN_PREFIX,
    hiddenHandTokenRe: HIDDEN_HAND_TOKEN_RE,
    normalizePlayerKey
});
const matchAuthorityRoomLifecycle = createMatchAuthorityRoomLifecycleApi({
    maxSpectators: MAX_SPECTATORS,
    seatTokenChars: SEAT_TOKEN_CHARS,
    randomFromChars,
    makeSeatToken,
    normalizeSpectatorId,
    normalizeSpectatorName,
    ensureSpectators,
    getActiveSpectatorEntries,
    parseSeatKeyOptional,
    normalizeSeatHandSkins,
    normalizeSeatPlayerIds
});
const trapVisibility = createTrapVisibilityApi(parseSeatKeyOptional);
const matchAuthorityBoardContract = createMatchAuthorityBoardContractApi({
    sharedBoardUtils: SharedBoardUtils
});
const matchAuthorityOperations = createMatchAuthorityOperationsApi({
    playerKeys: PLAYER_KEYS as readonly MatchAuthoritySeatKey[],
    acceptedOperationHistoryLimit: ACCEPTED_OPERATION_HISTORY_LIMIT,
    normalizeOperationId,
    normalizePlayerKey,
    normalizeStateVersion
});
const matchAuthorityPublish = createMatchAuthorityPublishApi({
    versionRejectionReasons: VERSION_REJECTION_REASONS,
    normalizeOperationId,
    normalizePlayerKey,
    computePlaybackDigest: PlaybackDigest && typeof PlaybackDigest.computePlaybackDigest === 'function'
        ? (playbackEvents: unknown[]) => PlaybackDigest.computePlaybackDigest!(playbackEvents)
        : null,
    computeStableHash: StateHash && typeof StateHash.computeStableHash === 'function'
        ? (value: unknown) => StateHash.computeStableHash!(value)
        : null,
    now: () => Date.now(),
    maxSpectators: MAX_SPECTATORS,
    normalizeEffectLogMessages,
    normalizeNetworkPlayerName,
    normalizeSeatHandSkinId,
    normalizeSeatHandSkins,
    normalizeSeatPlayerIds,
    normalizeSpectatorId,
    normalizeSpectatorName,
    parseSeatKeyOptional,
    buildPublicSeatMetadata
});
const matchAuthorityProjection = createMatchAuthorityProjectionApi({
    playerKeys: PLAYER_KEYS as readonly PlayerKey[],
    deepClone,
    now: () => Date.now(),
    parseSeatKeyOptional,
    normalizeSpectatorId,
    getCurrentPlayerKey,
    getOpponentKey,
    isManifestStoneMarker: ManifestStoneRegistry && typeof ManifestStoneRegistry.isManifestStoneMarker === 'function'
        ? (marker: unknown) => ManifestStoneRegistry.isManifestStoneMarker!(marker)
        : null,
    sanitizeOwnerOnlyTrapState,
    stripTransientPresentationState,
    computeStableHash: StateHash && typeof StateHash.computeStableHash === 'function'
        ? (snapshot: unknown) => StateHash.computeStableHash!(snapshot)
        : null,
    computeStableTextHash: StateHash && typeof StateHash.computeStableTextHash === 'function'
        ? (text: string) => StateHash.computeStableTextHash!(text)
        : null,
    boardContractVersion: matchAuthorityBoardContract.BOARD_CONTRACT_VERSION,
    canonicalizeSnapshotBoardForHash: matchAuthorityBoardContract.canonicalizeSnapshotBoardForHash,
    makeHiddenHandToken,
    isHiddenHandTokenLike,
    parseHiddenHandToken,
    normalizeProjectedHandIndex,
    normalizeCardCopyIdList,
    normalizeHandCopyIdArray,
    buildVisibleHandCostAdjustments
});
const matchAuthorityPendingSelection = createMatchAuthorityPendingSelectionApi({
    deepClone,
    normalizePlayerKey,
    getCurrentPlayerKey,
    isFateWillControllerForCurrentTurn,
    normalizePendingType,
    normalizePendingEffectId
});

function appendAuthorityLog(roomValue: unknown, entryValue: unknown, limitValue: unknown): unknown[] {
    return matchAuthorityJournal.appendAuthorityLog(roomValue, entryValue, limitValue);
}

function createBufferedSseEventRecord(options: MatchAuthorityBufferedSseEventRecordInput): MatchAuthorityBufferedSseEventRecord | null {
    return matchAuthorityJournal.createBufferedSseEventRecord(options);
}

function appendBufferedSseEvent(
    bufferValue: unknown,
    recordValue: MatchAuthorityBufferedSseEventRecordInput,
    limitValue?: unknown
): MatchAuthorityBufferedSseEventRecord[] {
    return matchAuthorityJournal.appendBufferedSseEvent(bufferValue, recordValue, limitValue);
}

function getBufferedSseReplayEvents(
    bufferValue: unknown,
    lastEventIdValue: unknown,
    viewerSeatKey: unknown
): MatchAuthorityBufferedSseReplayEvent[] | null {
    const events = matchAuthorityJournal.getBufferedSseReplayEvents(bufferValue, lastEventIdValue, viewerSeatKey);
    if (!events) return null;
    return events.map((event) => Object.assign({}, event, {
        payload: sanitizeBufferedPublicPayload(event.payload, viewerSeatKey)
    }));
}

function getBufferedSnapshotPayloadForStateVersion(
    bufferValue: unknown,
    stateVersionValue: unknown,
    viewerSeatKey: unknown
): unknown | null {
    const payload = matchAuthorityJournal.getBufferedSnapshotPayloadForStateVersion(
        bufferValue,
        stateVersionValue,
        viewerSeatKey
    );
    return payload ? sanitizeBufferedPublicPayload(payload, viewerSeatKey) : null;
}

function getBufferedPayloadStateVersion(payload: Record<string, unknown>, snapshot: Record<string, unknown>): number {
    const candidates = [payload.stateVersion, snapshot.stateVersion, asRecord(snapshot._meta).version];
    for (const candidate of candidates) {
        if (Number.isFinite(Number(candidate))) return Math.max(0, Math.trunc(Number(candidate)));
    }
    return 0;
}

function sanitizeBufferedPublicRoomDeck(value: unknown): unknown {
    return sanitizePublicRoomDeck(value);
}

function hasOwnField(value: unknown, fieldName: string): boolean {
    return !!value
        && typeof value === 'object'
        && Object.prototype.hasOwnProperty.call(value, fieldName);
}

function snapshotContainsPrivateDeckOrRandomState(snapshotValue: unknown): boolean {
    const snapshot = asRecord(snapshotValue);
    const cardState = asRecord(snapshot.cardState);
    const gameState = asRecord(snapshot.gameState);
    return hasOwnField(cardState, 'decks')
        || hasOwnField(cardState, 'deck')
        || hasOwnField(cardState, '_deckCopyIdsByPlayer')
        || hasOwnField(cardState, 'prngState')
        || hasOwnField(snapshot, 'prngState')
        || hasOwnField(gameState, 'prngState');
}

function normalizeViewerForPublicSnapshot(viewerValue: unknown): MatchAuthorityViewer | null {
    const viewer = normalizeViewerIdentity(viewerValue);
    if (viewer) return viewer;
    return getPayloadKeyForViewer(viewerValue) === 'spectator'
        ? { role: 'spectator', spectatorId: '' }
        : null;
}

function getHistoricalSnapshotStateVersion(
    snapshotValue: unknown,
    fallbackValue: unknown,
    roomValue?: MatchAuthorityRoomState | null | undefined
): number {
    const snapshot = asRecord(snapshotValue);
    const room = asRecord(roomValue);
    const candidates = [snapshot.stateVersion, asRecord(snapshot._meta).version, fallbackValue, room.stateVersion];
    for (const candidate of candidates) {
        if (Number.isFinite(Number(candidate))) return Math.max(0, Math.trunc(Number(candidate)));
    }
    return 0;
}

function getHistoricalSnapshotUpdatedAt(
    snapshotValue: unknown,
    fallbackValue: unknown,
    roomValue?: MatchAuthorityRoomState | null | undefined
): number {
    const snapshot = asRecord(snapshotValue);
    const room = asRecord(roomValue);
    const candidates = [snapshot.updatedAt, fallbackValue, room.updatedAt];
    for (const candidate of candidates) {
        if (Number.isFinite(Number(candidate))) return Number(candidate);
    }
    return Date.now();
}

function sanitizeHistoricalPublicSnapshot(
    snapshotValue: unknown,
    viewerValue: unknown,
    options?: {
        stateVersion?: unknown;
        updatedAt?: unknown;
        room?: MatchAuthorityRoomState | null | undefined;
    }
): unknown {
    if (!snapshotContainsPrivateDeckOrRandomState(snapshotValue)) return snapshotValue;

    const room = asRecord(options && options.room);
    const snapshot = asRecord(snapshotValue);
    const syntheticRoom = Object.assign({}, room, {
        snapshot,
        stateVersion: getHistoricalSnapshotStateVersion(snapshot, options && options.stateVersion, options && options.room),
        updatedAt: getHistoricalSnapshotUpdatedAt(snapshot, options && options.updatedAt, options && options.room)
    }) as MatchAuthorityRoomState;
    return buildPublicSnapshotForViewer(syntheticRoom, normalizeViewerForPublicSnapshot(viewerValue));
}

function sanitizePublicPresentationFrame(
    frameValue: unknown,
    viewerValue: unknown,
    roomValue?: MatchAuthorityRoomState | null | undefined
): MatchAuthorityPresentationFramePublic {
    if (!frameValue || typeof frameValue !== 'object' || Array.isArray(frameValue)) {
        return frameValue as MatchAuthorityPresentationFramePublic;
    }

    const frame = deepClone(frameValue) as Record<string, unknown>;
    if (hasOwnField(frame, 'payloadByViewer') || hasOwnField(frame, 'snapshotAfterByViewer')) {
        return sanitizePublicPresentationFrame(
            matchAuthorityPresentationJournal.toPublicPresentationFrame(frame, viewerValue, roomValue),
            viewerValue,
            roomValue
        );
    }

    const snapshotAfter = sanitizeHistoricalPublicSnapshot(frame.snapshotAfter, viewerValue, {
        stateVersion: frame.stateVersionTo,
        updatedAt: frame.createdAt,
        room: roomValue
    });
    if (snapshotAfter === frame.snapshotAfter) return frame as MatchAuthorityPresentationFramePublic;

    frame.snapshotAfter = snapshotAfter;
    frame.projectedSnapshotHash = asRecord(asRecord(snapshotAfter)._meta).projectedSnapshotHash || null;
    return frame as MatchAuthorityPresentationFramePublic;
}

function sanitizePublicPresentationJournalResponse(
    responseValue: unknown,
    viewerValue: unknown,
    roomValue?: MatchAuthorityRoomState | null | undefined
): Record<string, unknown> {
    if (!responseValue || typeof responseValue !== 'object' || Array.isArray(responseValue)) {
        return responseValue as Record<string, unknown>;
    }

    const response = deepClone(responseValue) as Record<string, unknown>;
    const presentationCursor = asRecord(response.presentationCursor);
    const baseSnapshot = sanitizeHistoricalPublicSnapshot(response.baseSnapshot, viewerValue, {
        stateVersion: presentationCursor.stateVersion,
        updatedAt: response.serverTime,
        room: roomValue
    });
    if (baseSnapshot !== response.baseSnapshot) response.baseSnapshot = baseSnapshot;

    const snapshot = sanitizeHistoricalPublicSnapshot(response.snapshot, viewerValue, {
        stateVersion: presentationCursor.stateVersion,
        updatedAt: response.serverTime,
        room: roomValue
    });
    if (snapshot !== response.snapshot) response.snapshot = snapshot;

    if (Array.isArray(response.presentationFrames)) {
        response.presentationFrames = response.presentationFrames.map((frame) => (
            sanitizePublicPresentationFrame(frame, viewerValue, roomValue)
        ));
    }
    return response;
}

function sanitizeBufferedPublicPayload(payloadValue: unknown, viewerValue: unknown): unknown {
    const payload = deepClone(payloadValue || {});
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload;

    const projectedPayload = payload as Record<string, unknown>;
    const hasTopLevelDeckSource = PRIVATE_PUBLIC_PAYLOAD_DECK_FIELDS.some((fieldName) => (
        hasOwnField(projectedPayload, fieldName)
    ));
    const hasAuthoritativeHash = hasOwnField(projectedPayload, 'authoritativeStateHash');
    const roomDeck = asRecord(projectedPayload.roomDeck);
    const hasRoomDeckSource = hasOwnField(roomDeck, 'deckCode')
        || hasOwnField(roomDeck, 'deckCodeByPlayer');
    const snapshot = asRecord(projectedPayload.snapshot);
    const hasPrivateSnapshotState = snapshotContainsPrivateDeckOrRandomState(snapshot);
    const hasPrivateBaseSnapshotState = snapshotContainsPrivateDeckOrRandomState(projectedPayload.baseSnapshot);
    const hasRawPresentationFrame = Array.isArray(projectedPayload.presentationFrames)
        && projectedPayload.presentationFrames.some((frame) => (
            hasOwnField(asRecord(frame), 'payloadByViewer')
            || hasOwnField(asRecord(frame), 'snapshotAfterByViewer')
        ));
    const hasPrivatePresentationFrameState = Array.isArray(projectedPayload.presentationFrames)
        && projectedPayload.presentationFrames.some((frame) => (
            snapshotContainsPrivateDeckOrRandomState(asRecord(frame).snapshotAfter)
            || Object.values(asRecord(asRecord(frame).snapshotAfterByViewer))
                .some((snapshotAfter) => snapshotContainsPrivateDeckOrRandomState(snapshotAfter))
        ));

    if (!hasTopLevelDeckSource
        && !hasAuthoritativeHash
        && !hasRoomDeckSource
        && !hasPrivateSnapshotState
        && !hasPrivateBaseSnapshotState
        && !hasRawPresentationFrame
        && !hasPrivatePresentationFrameState) {
        return projectedPayload;
    }

    if (hasTopLevelDeckSource) {
        for (const fieldName of PRIVATE_PUBLIC_PAYLOAD_DECK_FIELDS) {
            delete projectedPayload[fieldName];
        }
    }
    if (hasAuthoritativeHash) delete projectedPayload.authoritativeStateHash;
    if (hasRoomDeckSource) {
        projectedPayload.roomDeck = sanitizeBufferedPublicRoomDeck(projectedPayload.roomDeck);
    }
    if (hasPrivateSnapshotState) {
        const publicSnapshot = sanitizeHistoricalPublicSnapshot(snapshot, viewerValue, {
            stateVersion: getBufferedPayloadStateVersion(projectedPayload, snapshot),
            updatedAt: projectedPayload.serverTime
        });
        projectedPayload.snapshot = publicSnapshot;
        if (Object.prototype.hasOwnProperty.call(projectedPayload, 'projectedSnapshotHash')) {
            projectedPayload.projectedSnapshotHash = asRecord(asRecord(publicSnapshot)._meta).projectedSnapshotHash || null;
        }
    }

    if (hasPrivateBaseSnapshotState) {
        projectedPayload.baseSnapshot = sanitizeHistoricalPublicSnapshot(projectedPayload.baseSnapshot, viewerValue, {
            stateVersion: asRecord(projectedPayload.presentationCursor).stateVersion,
            updatedAt: projectedPayload.serverTime
        });
    }
    if ((hasRawPresentationFrame || hasPrivatePresentationFrameState)
        && Array.isArray(projectedPayload.presentationFrames)) {
        projectedPayload.presentationFrames = projectedPayload.presentationFrames.map((frame) => (
            sanitizePublicPresentationFrame(frame, viewerValue)
        ));
    }
    return projectedPayload;
}

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
    if (safeChars.length > 256) throw new Error('randomFromChars charset must contain at most 256 characters.');
    const safeLength = length;
    const cryptoLike = resolveSecureCrypto(explicitCrypto);
    const maxUnbiasedByte = Math.floor(256 / safeChars.length) * safeChars.length;
    let out = '';
    while (out.length < safeLength) {
        const bytes = new Uint8Array(Math.max(16, safeLength - out.length));
        cryptoLike.getRandomValues(bytes);
        for (let index = 0; index < bytes.length; index += 1) {
            const byte = bytes[index];
            if (byte >= maxUnbiasedByte) continue;
            out += safeChars[byte % safeChars.length];
            if (out.length >= safeLength) break;
        }
    }
    return out;
}

function makeRoomId(explicitCrypto?: MatchAuthorityCryptoLike | null): string {
    return randomFromChars(ROOM_ID_CHARS, ROOM_ID_LENGTH, explicitCrypto);
}

function makeSeatToken(explicitCrypto?: MatchAuthorityCryptoLike | null): string {
    return randomFromChars(SEAT_TOKEN_CHARS, SEAT_TOKEN_LENGTH, explicitCrypto);
}

function makeSpectatorToken(makeSeatTokenFn: (() => string) = makeSeatToken): string {
    return makeSeatTokenFn();
}

function makeSpectatorId(makeSeatTokenFn: (() => string) = makeSeatToken): string {
    return `spec_${makeSeatTokenFn().replace(/[^A-Za-z0-9_-]/g, '').slice(0, 16)}`;
}

function makeRematchRequestId(
    makeSeatTokenFn: (() => string) = makeSeatToken,
    nowFn: (() => number) = Date.now
): string {
    return `rematch_${nowFn()}_${makeSeatTokenFn().replace(/[^A-Za-z0-9_-]/g, '').slice(0, 12)}`;
}

function makeSseStreamId(nowValue: unknown, explicitCrypto?: MatchAuthorityCryptoLike | null): string {
    const timestamp = Number.isFinite(Number(nowValue)) ? Number(nowValue) : Date.now();
    return `sse_${timestamp}_${randomFromChars(SSE_ID_SUFFIX_CHARS, SSE_ID_SUFFIX_LENGTH, explicitCrypto)}`;
}

function normalizePendingType(value: unknown): string {
    return String(value || '').trim().toUpperCase();
}

function normalizePendingEffectId(value: unknown): string | null {
    const normalized = String(value || '').trim();
    return normalized || null;
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

function normalizePublicPlayerId(value: unknown): string {
    if (PlayerIdentityContract && typeof PlayerIdentityContract.normalizePlayerId === 'function') {
        return PlayerIdentityContract.normalizePlayerId(value) || '';
    }
    const normalized = String(value || '').trim();
    return /^p_[A-Za-z0-9_-]{26}$/.test(normalized) ? normalized : '';
}

function normalizeSeatPlayerIds(value: unknown): MatchAuthoritySeatPlayerIds {
    if (PlayerIdentityContract && typeof PlayerIdentityContract.normalizeSeatPlayerIds === 'function') {
        return PlayerIdentityContract.normalizeSeatPlayerIds(value);
    }
    const source = asRecord(value);
    return {
        black: normalizePublicPlayerId(source.black),
        white: normalizePublicPlayerId(source.white)
    };
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
    seatPlayerIds: MatchAuthoritySeatPlayerIds;
} {
    const source = asRecord(value);
    const seatNames = asRecord(source.seatNames);
    return {
        seats: normalizePublicSeats(source.seats),
        seatNames: {
            black: normalizeNetworkPlayerName(seatNames.black),
            white: normalizeNetworkPlayerName(seatNames.white)
        },
        seatHandSkins: normalizeSeatHandSkins(source.seatHandSkins),
        seatPlayerIds: normalizeSeatPlayerIds(source.seatPlayerIds)
    };
}

function hasRequiredOperationId(value: unknown): boolean {
    return matchAuthorityOperations.hasRequiredOperationId(value);
}

function ensureAcceptedOperationsBySeat(room: MatchAuthorityRoomState | null | undefined): MatchAuthorityAcceptedOperationsBySeat {
    return matchAuthorityOperations.ensureAcceptedOperationsBySeat(room);
}

function normalizeAcceptedOperationEntry(value: unknown): MatchAuthorityAcceptedOperationEntry | null {
    return matchAuthorityOperations.normalizeAcceptedOperationEntry(value);
}

function ensureAcceptedOperationHistoryBySeat(room: MatchAuthorityRoomState | null | undefined): MatchAuthorityAcceptedOperationHistoryBySeat {
    return matchAuthorityOperations.ensureAcceptedOperationHistoryBySeat(room);
}

function findAcceptedOperationBySeat(
    room: MatchAuthorityRoomState | null | undefined,
    seatKey: unknown,
    operationId: unknown
): MatchAuthorityAcceptedOperationEntry | null {
    return matchAuthorityOperations.findAcceptedOperationBySeat(room, seatKey, operationId);
}

function resolveAcceptedOperation(
    room: MatchAuthorityRoomState | null | undefined,
    seatKey: unknown,
    operationId: unknown,
    fallbackEntry?: unknown
): MatchAuthorityAcceptedOperationEntry | null {
    return matchAuthorityOperations.resolveAcceptedOperation(room, seatKey, operationId, fallbackEntry);
}

function rememberAcceptedOperationBySeat(
    room: MatchAuthorityRoomState | null | undefined,
    seatKey: unknown,
    entry: unknown
): MatchAuthorityAcceptedOperationEntry | null {
    return matchAuthorityOperations.rememberAcceptedOperationBySeat(room, seatKey, entry);
}

function normalizeStateVersion(value: unknown): number | null {
    return matchAuthorityPublish.normalizeStateVersion(value);
}

function classifyVersionRejectionReason(receivedBaseVersionValue: unknown, authoritativeStateVersionValue: unknown): string {
    return matchAuthorityPublish.classifyVersionRejectionReason(receivedBaseVersionValue, authoritativeStateVersionValue);
}

function isVersionRejectionReason(reasonValue: unknown): boolean {
    return matchAuthorityPublish.isVersionRejectionReason(reasonValue);
}

function normalizePublishActionType(value: unknown): string | null {
    return matchAuthorityPublish.normalizePublishActionType(value);
}

function normalizePublishMeta(value: unknown): MatchAuthorityPublishMeta {
    return matchAuthorityPublish.normalizePublishMeta(value);
}

function normalizeAutoPassNotice(value: unknown): MatchAuthorityAutoPassNotice | null {
    return matchAuthorityPublish.normalizeAutoPassNotice(value);
}

function normalizePlaybackDigestValue(value: unknown): string {
    return matchAuthorityPublish.normalizePlaybackDigestValue(value);
}

function resolvePlaybackDigest(playbackEventsValue: unknown, explicitDigestValue?: unknown): string {
    return matchAuthorityPublish.resolvePlaybackDigest(playbackEventsValue, explicitDigestValue);
}

function buildPublishResponseOptions(options: MatchAuthorityPublishResponseOptionInput | null | undefined): MatchAuthorityPublishResponseOptions {
    return matchAuthorityPublish.buildPublishResponseOptions(options);
}

function normalizePublishResponseMode(value: unknown): MatchAuthorityPublishResponseMode {
    return matchAuthorityPublish.normalizePublishResponseMode(value);
}

function shouldUseAckOnlyPublishResponse(
    roomValue: MatchAuthorityRoomState | null | undefined,
    options?: MatchAuthorityPublishResponseOptions | null
): boolean {
    return matchAuthorityPublish.shouldUseAckOnlyPublishResponse(roomValue, options);
}

function buildVersionRejectedPublishResponseOptions(
    room: MatchAuthorityRoomState | null | undefined,
    options: MatchAuthorityPublishResponseOptionInput | null | undefined
): MatchAuthorityPublishResponseOptions {
    return matchAuthorityPublish.buildVersionRejectedPublishResponseOptions(room, options);
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
    const shape = String(valueRecord.shape || '').toLowerCase() === 'circle' ? 'circle' : 'rectangle';
    const circleSize = Math.max(6, Math.min(16, 6 + Math.round((normalizedRows - 6) / 2) * 2));
    const finalRows = shape === 'circle' ? circleSize : normalizedRows;
    const finalCols = shape === 'circle' ? circleSize : normalizedCols;
    return {
        rows: finalRows,
        cols: finalCols,
        shape,
        standard8x8: shape === 'rectangle' && finalRows === 8 && finalCols === 8,
        baseBounds: {
            minRow: 0,
            maxRow: finalRows - 1,
            minCol: 0,
            maxCol: finalCols - 1
        },
        outerBounds: {
            minRow: -1,
            maxRow: finalRows,
            minCol: -1,
            maxCol: finalCols
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

function buildPublishAckPayloadFromRoom(
    roomValue: MatchAuthorityRoomState | null | undefined,
    options?: MatchAuthorityPublishPayloadFromRoomOptions | null
): MatchAuthorityPublishResponsePayload {
    return matchAuthorityPublish.buildPublishAckPayloadFromRoom(roomValue, options);
}

function buildPublishResponsePayload(options: MatchAuthorityPublishResponseOptions): MatchAuthorityPublishResponsePayload {
    return matchAuthorityPublish.buildPublishResponsePayload(options);
}

function buildRoomPayload(options: MatchAuthorityRoomPayloadOptions): MatchAuthorityRoomPayload {
    return matchAuthorityPublish.buildRoomPayload(options);
}

function buildRoomPayloadFromRoom(
    roomValue: MatchAuthorityRoomState | null | undefined,
    options?: MatchAuthorityRoomPayloadFromRoomOptions | null
): MatchAuthorityRoomPayload {
    return matchAuthorityPublish.buildRoomPayloadFromRoom(roomValue, options);
}

function buildSnapshotPayloadFromRoom(
    roomValue: MatchAuthorityRoomState | null | undefined,
    options?: MatchAuthoritySnapshotPayloadFromRoomOptions | null
): MatchAuthorityRoomPayload {
    return matchAuthorityPublish.buildSnapshotPayloadFromRoom(roomValue, options);
}

function buildPresencePayloadFromRoom(
    roomValue: MatchAuthorityRoomState | null | undefined,
    options?: MatchAuthorityPresencePayloadFromRoomOptions | null
): MatchAuthorityRoomPayload {
    return matchAuthorityPublish.buildPresencePayloadFromRoom(roomValue, options);
}

function buildHeartbeatPayloadFromRoom(
    roomValue: MatchAuthorityRoomState | null | undefined,
    options?: MatchAuthorityHeartbeatPayloadFromRoomOptions | null
): MatchAuthorityRoomPayload {
    return matchAuthorityPublish.buildHeartbeatPayloadFromRoom(roomValue, options);
}

function buildPublishPayloadFromRoom(
    roomValue: MatchAuthorityRoomState | null | undefined,
    options?: MatchAuthorityPublishPayloadFromRoomOptions | null
): MatchAuthorityPublishResponsePayload {
    return matchAuthorityPublish.buildPublishPayloadFromRoom(roomValue, options);
}

function resolveSeatForJoin(
    roomValue: MatchAuthorityRoomState | null | undefined,
    requestedSeatKey: unknown,
    providedToken: unknown
): MatchAuthoritySeatKey | null {
    return matchAuthorityRoomLifecycle.resolveSeatForJoin(roomValue, requestedSeatKey, providedToken);
}

function applySeatLeaveToRoom(
    roomValue: MatchAuthorityRoomState | null | undefined,
    seatKeyValue: unknown,
    options?: MatchAuthoritySeatLeaveOptions | null
): MatchAuthoritySeatLeaveResult | null {
    return matchAuthorityRoomLifecycle.applySeatLeaveToRoom(roomValue, seatKeyValue, options);
}

function shouldDisposeRoom(roomValue: unknown, streamCountValue: unknown): boolean {
    return matchAuthorityRoomLifecycle.shouldDisposeRoom(roomValue, streamCountValue);
}

function makeHiddenHandToken(ownerKey: unknown, handIndex: unknown): string {
    return matchAuthorityHandProjection.makeHiddenHandToken(ownerKey, handIndex);
}

function isHiddenHandTokenLike(value: unknown): boolean {
    return matchAuthorityHandProjection.isHiddenHandTokenLike(value);
}

function parseHiddenHandToken(value: unknown): { ownerKey: PlayerKey; handIndex: number } | null {
    return matchAuthorityHandProjection.parseHiddenHandToken(value);
}

function normalizeProjectedHandIndex(value: unknown, fallbackIndex: unknown, handLength: unknown): number | null {
    return matchAuthorityHandProjection.normalizeProjectedHandIndex(value, fallbackIndex, handLength);
}

function normalizeCardCopyIdList(values: unknown): number[] {
    return matchAuthorityHandProjection.normalizeCardCopyIdList(values);
}

function normalizeHandCopyIdArray(values: unknown, targetLength: unknown): Array<number | null> {
    return matchAuthorityHandProjection.normalizeHandCopyIdArray(values, targetLength);
}

function buildVisibleHandCostAdjustments(
    cardState: Record<string, unknown>,
    ownerHandCopyIds: Array<number | null>,
    projectedOwnerHand: unknown[]
): Array<Record<string, number> | null> {
    return matchAuthorityHandProjection.buildVisibleHandCostAdjustments(
        cardState,
        ownerHandCopyIds,
        projectedOwnerHand
    );
}

function resolveAuthenticatedSeatKey(room: MatchAuthorityRoomState | null | undefined, seatKeyValue: unknown, seatTokenValue: unknown): MatchAuthoritySeatKey | null {
    return matchAuthorityRoomLifecycle.resolveAuthenticatedSeatKey(room, seatKeyValue, seatTokenValue);
}

function addSpectatorToRoom(roomValue: MatchAuthorityRoomState | null | undefined, options?: MatchAuthoritySpectatorJoinOptions | null): MatchAuthoritySpectatorJoinResult {
    return matchAuthorityRoomLifecycle.addSpectatorToRoom(roomValue, options);
}

function removeSpectatorFromRoom(roomValue: MatchAuthorityRoomState | null | undefined, options?: Record<string, unknown> | null): MatchAuthoritySpectatorLeaveResult {
    return matchAuthorityRoomLifecycle.removeSpectatorFromRoom(roomValue, options);
}

function resolveAuthenticatedViewer(roomValue: MatchAuthorityRoomState | null | undefined, options?: Record<string, unknown> | null): MatchAuthorityViewer | null {
    return matchAuthorityRoomLifecycle.resolveAuthenticatedViewer(roomValue, options);
}

function classifySeatTokenRejectionReason(seatTokenValue: unknown): MatchAuthoritySeatTokenRejectionReason {
    return matchAuthorityRoomLifecycle.classifySeatTokenRejectionReason(seatTokenValue);
}

function stripTransientPresentationState(nextSnapshot: unknown): unknown {
    return matchAuthoritySnapshotState.stripTransientPresentationState(nextSnapshot);
}

function stripTransientChargeDeltaState(nextSnapshot: unknown): unknown {
    return matchAuthoritySnapshotState.stripTransientChargeDeltaState(nextSnapshot);
}

function restoreMissingChargeDeltaEvents(previousSnapshot: unknown, nextSnapshot: unknown): unknown {
    return matchAuthoritySnapshotState.restoreMissingChargeDeltaEvents(previousSnapshot, nextSnapshot);
}

function sanitizeOwnerOnlyTrapState(cardState: unknown, viewerSeatKey: unknown): unknown {
    return trapVisibility.sanitizeOwnerOnlyTrapState(cardState, viewerSeatKey);
}

/**
 * Returns the FATE_WILL controller seat key for the given turn owner, or null if none.
 * Reads from snapshot.cardState.fateWillControllerByTurnOwner.
 */
function getFateWillControllerKey(snapshot: unknown, turnOwnerKey: PlayerKey | null | undefined): PlayerKey | null {
    return matchAuthorityProjection.getFateWillControllerKey(snapshot, turnOwnerKey);
}

function isFateWillControllerForCurrentTurn(snapshot: unknown, seatKey: PlayerKey | null | undefined): boolean {
    return matchAuthorityProjection.isFateWillControllerForCurrentTurn(snapshot, seatKey);
}

function canViewerInspectOwnerHand(snapshot: unknown, viewerSeatKey: unknown, ownerSeatKey: unknown): boolean {
    return matchAuthorityProjection.canViewerInspectOwnerHand(snapshot, viewerSeatKey, ownerSeatKey);
}

function projectSnapshotForViewer(
    snapshotValue: unknown,
    viewerSeatKey: PlayerKey | null | undefined,
    metadata?: MatchAuthorityProjectionMetadata
): MatchAuthorityPublicSnapshot {
    return matchAuthorityProjection.projectSnapshotForViewer(snapshotValue, viewerSeatKey, metadata);
}

function normalizeViewerIdentity(value: unknown): MatchAuthorityViewer | null {
    return matchAuthorityProjection.normalizeViewerIdentity(value);
}

function getPayloadKeyForViewer(viewerValue: unknown): MatchAuthoritySeatKey | 'spectator' {
    return matchAuthorityProjection.getPayloadKeyForViewer(viewerValue);
}

function buildPublicSnapshotForViewer(
    room: MatchAuthorityRoomState | null | undefined,
    viewerValue: unknown
): MatchAuthorityPublicSnapshot {
    return matchAuthorityProjection.buildPublicSnapshotForViewer(room, viewerValue);
}

function buildPublicSnapshot(
    room: MatchAuthorityRoomState | null | undefined,
    viewerSeatKey: PlayerKey | null | undefined
): MatchAuthorityPublicSnapshot {
    return matchAuthorityProjection.buildPublicSnapshot(room, viewerSeatKey);
}

function buildPublishViewerArtifacts(
    room: MatchAuthorityRoomState | null | undefined,
    options?: Record<string, unknown>
): {
    canonicalHash: string | null;
    projectedSnapshots: Record<MatchAuthoritySeatKey | 'spectator', MatchAuthorityPublicSnapshot>;
    snapshotPayloads: Partial<Record<MatchAuthoritySeatKey | 'spectator', unknown>>;
} {
    return matchAuthorityProjection.buildPublishViewerArtifacts(room, options);
}

function computeAuthoritativeStateHash(snapshotValue: unknown): string | null {
    return matchAuthorityProjection.computeAuthoritativeStateHash(snapshotValue);
}

function computeProjectedSnapshotHash(snapshotValue: unknown): string | null {
    return matchAuthorityProjection.computeProjectedSnapshotHash(snapshotValue);
}

function readSnapshotBoardContractVersion(snapshotValue: unknown): number | null {
    return matchAuthorityBoardContract.readSnapshotBoardContractVersion(snapshotValue);
}

function inspectSnapshotBoardContract(
    snapshotValue: unknown,
    options?: { allowLegacy?: boolean; requireFullSnapshot?: boolean }
) {
    return matchAuthorityBoardContract.inspectSnapshotBoardContract(snapshotValue, options);
}

function normalizeSnapshotBoardContract(
    snapshotValue: unknown,
    options?: { allowLegacy?: boolean; requireFullSnapshot?: boolean }
) {
    return matchAuthorityBoardContract.normalizeSnapshotBoardContract(snapshotValue, options);
}

function stampSnapshotBoardContract(snapshotValue: unknown): boolean {
    return matchAuthorityBoardContract.stampSnapshotBoardContract(snapshotValue);
}

function countSnapshotBoardDiscs(
    snapshotValue: unknown,
    boardUtilsOverride?: MatchAuthoritySharedBoardUtils | null
): { black: number; white: number } | null {
    return matchAuthorityBoardContract.countSnapshotBoardDiscs(snapshotValue, boardUtilsOverride);
}

function validatePendingSelectionPublish(
    snapshotValue: unknown,
    playerKey: unknown,
    actionValue: unknown
): { ok: boolean; pendingEffectId?: string | null; rejectedReason?: string } {
    return matchAuthorityPendingSelection.validatePendingSelectionPublish(snapshotValue, playerKey, actionValue);
}

function sanitizePendingSelectionActionForAuthority(snapshotValue: unknown, playerKey: unknown, actionValue: unknown): unknown {
    return matchAuthorityPendingSelection.sanitizePendingSelectionActionForAuthority(snapshotValue, playerKey, actionValue);
}

function validateAuthoritativePendingSelectionResult(actionValue: unknown, eventsValue: unknown): { ok: boolean; rejectedReason?: string } {
    const action = asRecord(actionValue);
    const pendingSelectionState = asRecord(action.pendingSelectionState);
    const pendingType = String(pendingSelectionState.type || '').trim().toUpperCase();
    if (pendingType !== 'BOARD_EXPANSION_WILL' && pendingType !== 'BOARD_EXPANSION_GOD') {
        return { ok: true };
    }
    const events = Array.isArray(eventsValue) ? eventsValue : [];
    const rejectedExpansion = events.some((eventValue) => {
        const event = asRecord(eventValue);
        return (
            (event.type === 'board_expansion_selected' || event.type === 'board_expansion_first_selected') &&
            event.applied === false
        );
    });
    return rejectedExpansion
        ? { ok: false, rejectedReason: 'INVALID_PENDING_SELECTION_TARGET' }
        : { ok: true };
}

function appendPresentationFrame(
    roomValue: MatchAuthorityRoomState | null | undefined,
    inputValue: unknown
): MatchAuthorityPresentationJournalEntry | null {
    return matchAuthorityPresentationJournal.appendPresentationFrame(roomValue, inputValue);
}

function getPresentationFramesAfter(
    roomValue: MatchAuthorityRoomState | null | undefined,
    afterVisualSeq: unknown,
    viewerValue: unknown
): MatchAuthorityPresentationFramePublic[] {
    return matchAuthorityPresentationJournal
        .getPresentationFramesAfter(roomValue, afterVisualSeq, viewerValue)
        .map((frame) => sanitizePublicPresentationFrame(frame, viewerValue, roomValue));
}

function findPresentationFrameEntryForOperation(
    roomValue: MatchAuthorityRoomState | null | undefined,
    operationIdValue: unknown,
    stateVersionValue?: unknown
): MatchAuthorityPresentationJournalEntry | null {
    return matchAuthorityPresentationJournal.findPresentationFrameEntryForOperation(
        roomValue,
        operationIdValue,
        stateVersionValue
    );
}

function findPresentationFrameEntryForAcceptedOperation(
    roomValue: MatchAuthorityRoomState | null | undefined,
    acceptedOperationValue: unknown
): MatchAuthorityPresentationJournalEntry | null {
    return matchAuthorityPresentationJournal.findPresentationFrameEntryForAcceptedOperation(
        roomValue,
        acceptedOperationValue
    );
}

function buildPresentationJournalResponse(
    roomValue: MatchAuthorityRoomState | null | undefined,
    options?: Record<string, unknown> | null
): Record<string, unknown> {
    return sanitizePublicPresentationJournalResponse(
        matchAuthorityPresentationJournal.buildPresentationJournalResponse(roomValue, options),
        asRecord(options).viewer,
        roomValue
    );
}

function toPublicPresentationFrame(
    entryValue: unknown,
    viewerValue: unknown,
    roomValue?: MatchAuthorityRoomState | null | undefined
): MatchAuthorityPresentationFramePublic {
    return sanitizePublicPresentationFrame(
        matchAuthorityPresentationJournal.toPublicPresentationFrame(entryValue, viewerValue, roomValue),
        viewerValue,
        roomValue
    );
}

const matchAuthority = assertMatchAuthorityPublicApi({
    PLAYER_KEYS,
    OPERATION_ID_MAX_LENGTH,
    SSE_RESUME_BUFFER_LIMIT,
    PRESENTATION_JOURNAL_LIMIT,
    NETWORK_PLAYER_NAME_MAX,
    CHAT_MAX_LENGTH,
    CHAT_HISTORY_LIMIT,
    NETWORK_TURN_LIMIT_SECONDS,
    NETWORK_TURN_LIMIT_MIN_SECONDS,
    NETWORK_TURN_LIMIT_MAX_SECONDS,
    NETWORK_TURN_LIMIT_MS,
    normalizeNetworkTurnLimitSeconds,
    SSE_HEARTBEAT_INTERVAL_MS,
    MAX_SPECTATORS,
    NETWORK_DEBUG_FILL_HAND_ACTION,
    ROOM_ID_CHARS,
    ROOM_ID_LENGTH,
    normalizeNetworkRoomId,
    isValidNetworkRoomId,
    parseNetworkChatMessage,
    SEAT_TOKEN_CHARS,
    SEAT_TOKEN_LENGTH,
    VERSION_REJECTION_REASONS,
    randomFromChars,
    makeRoomId,
    makeSeatToken,
    makeSpectatorToken,
    makeSpectatorId,
    makeRematchRequestId,
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
    normalizePublishResponseMode,
    shouldUseAckOnlyPublishResponse,
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
    buildPublishAckPayloadFromRoom,
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
    BOARD_CONTRACT_VERSION: matchAuthorityBoardContract.BOARD_CONTRACT_VERSION,
    readSnapshotBoardContractVersion,
    inspectSnapshotBoardContract,
    normalizeSnapshotBoardContract,
    stampSnapshotBoardContract,
    countSnapshotBoardDiscs,
    computeAuthoritativeStateHash,
    computeProjectedSnapshotHash,
    stripTransientPresentationState,
    stripTransientChargeDeltaState,
    restoreMissingChargeDeltaEvents,
    projectSnapshotForViewer,
    buildPublishViewerArtifacts,
    buildPublicSnapshotForViewer,
    buildPublicSnapshot,
    validatePendingSelectionPublish,
    sanitizePendingSelectionActionForAuthority,
    validateAuthoritativePendingSelectionResult,
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
