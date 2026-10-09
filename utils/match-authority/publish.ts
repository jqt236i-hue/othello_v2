import type {
    MatchAuthorityAutoPassNotice,
    MatchAuthorityPublishMeta,
    MatchAuthorityPublishPayloadFromRoomOptions,
    MatchAuthorityPublishResponsePayload,
    MatchAuthorityPublishResponseMode,
    MatchAuthorityPublishResponseOptions,
    MatchAuthorityHeartbeatPayloadFromRoomOptions,
    MatchAuthorityPresencePayloadFromRoomOptions,
    MatchAuthorityPublicSeats,
    MatchAuthorityRoomPayload,
    MatchAuthorityRoomPayloadFromRoomOptions,
    MatchAuthorityRoomPayloadOptions,
    MatchAuthorityRoomState,
    MatchAuthoritySeatHandSkins,
    MatchAuthoritySeatKey,
    MatchAuthoritySeatNames,
    MatchAuthoritySeatPlayerIds,
    MatchAuthoritySnapshotPayloadFromRoomOptions
} from '../match-authority-types';
import { sanitizePublicRoomDeck } from '../match-room-deck';

type RecordValue = Record<string, any>;

interface MatchAuthorityPublishResponseOptionInput extends MatchAuthorityPublishResponseOptions {
    publishKind?: unknown;
}

interface MatchAuthorityPublishApiDeps {
    versionRejectionReasons: Readonly<Record<'AHEAD' | 'BEHIND' | 'GAP' | 'MISMATCH', string>>;
    normalizeOperationId: (value: unknown) => string;
    normalizePlayerKey: (value: unknown, fallback?: unknown) => MatchAuthoritySeatKey;
    computePlaybackDigest: ((playbackEvents: unknown[]) => string) | null;
    computeStableHash: ((value: unknown) => string) | null;
    now: () => number;
    maxSpectators: number;
    normalizeEffectLogMessages: (values: unknown) => string[];
    normalizeNetworkPlayerName: (value: unknown) => string;
    normalizeSeatHandSkinId: (value: unknown) => string;
    normalizeSeatHandSkins: (value: unknown) => MatchAuthoritySeatHandSkins;
    normalizeSeatPlayerIds: (value: unknown) => MatchAuthoritySeatPlayerIds;
    normalizeSpectatorId: (value: unknown) => string;
    normalizeSpectatorName: (value: unknown) => string;
    parseSeatKeyOptional: (value: unknown) => MatchAuthoritySeatKey | null;
    buildPublicSeatMetadata: (value: unknown) => {
        seats: MatchAuthorityPublicSeats;
        seatNames: MatchAuthoritySeatNames;
        seatHandSkins: MatchAuthoritySeatHandSkins;
        seatPlayerIds: MatchAuthoritySeatPlayerIds;
    };
}

function asRecord(value: unknown): RecordValue {
    return value && typeof value === 'object' ? value as RecordValue : {};
}

export function createMatchAuthorityPublishApi(deps: MatchAuthorityPublishApiDeps) {
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
            return deps.versionRejectionReasons.GAP;
        }
        const receivedBaseVersion = normalizeStateVersion(receivedBaseVersionValue);
        const authoritativeStateVersion = normalizeStateVersion(authoritativeStateVersionValue);
        if (receivedBaseVersion === null || authoritativeStateVersion === null) {
            return deps.versionRejectionReasons.GAP;
        }
        if (receivedBaseVersion < authoritativeStateVersion) {
            return deps.versionRejectionReasons.AHEAD;
        }
        if (receivedBaseVersion > authoritativeStateVersion) {
            return deps.versionRejectionReasons.BEHIND;
        }
        return deps.versionRejectionReasons.MISMATCH;
    }

    function isVersionRejectionReason(reasonValue: unknown): boolean {
        const normalized = String(reasonValue || '').trim();
        return normalized === deps.versionRejectionReasons.MISMATCH
            || normalized === deps.versionRejectionReasons.AHEAD
            || normalized === deps.versionRejectionReasons.BEHIND
            || normalized === deps.versionRejectionReasons.GAP;
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
            operationId: deps.normalizeOperationId(source.operationId),
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
            playerKey: deps.normalizePlayerKey(source.playerKey || source.player || source.owner),
            reason: String(source.reason || '').trim() || 'no_legal_moves_or_usable_cards',
            ...(source.turnReturned === true ? { turnReturned: true } : {})
        };
    }

    function normalizePlaybackDigestValue(value: unknown): string {
        return value ? String(value).trim() : '';
    }

    function computeAuthoritativePlaybackDigest(playbackEventsValue: unknown): string {
        const playbackEvents = Array.isArray(playbackEventsValue) ? playbackEventsValue : [];
        if (deps.computePlaybackDigest) {
            const digest = deps.computePlaybackDigest(playbackEvents);
            return typeof digest === 'string' ? digest : '';
        }
        if (deps.computeStableHash) {
            return deps.computeStableHash(playbackEvents);
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

    function normalizePublishResponseMode(value: unknown): MatchAuthorityPublishResponseMode {
        const text = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
        if (text === 'ack_only' || text === 'ackonly') return 'ack_only';
        return 'snapshot_compat';
    }

    function shouldUseAckOnlyPublishResponse(
        roomValue: MatchAuthorityRoomState | null | undefined,
        options?: MatchAuthorityPublishResponseOptions | null
    ): boolean {
        const opts = asRecord(options);
        if (opts.ok !== true) return false;
        const room = asRecord(roomValue);
        const modeValue = Object.prototype.hasOwnProperty.call(opts, 'publishResponseMode')
            ? opts.publishResponseMode
            : room.publishResponseMode;
        return normalizePublishResponseMode(modeValue) === 'ack_only';
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

    function hasPublishMetaFields(publishMeta: MatchAuthorityPublishMeta): boolean {
        return !!(
            publishMeta.kind
            || publishMeta.operationId
            || publishMeta.actionType
            || publishMeta.receivedBaseVersion !== null
            || publishMeta.authoritativeStateVersion !== null
            || publishMeta.replayedStateVersion !== null
            || publishMeta.rejectedReason
        );
    }

    function buildPublishAckPayloadFromRoom(
        roomValue: MatchAuthorityRoomState | null | undefined,
        options?: MatchAuthorityPublishPayloadFromRoomOptions | null
    ): MatchAuthorityPublishResponsePayload {
        const room: MatchAuthorityRoomState = (roomValue && typeof roomValue === 'object') ? roomValue : {};
        const opts: MatchAuthorityPublishPayloadFromRoomOptions = (options && typeof options === 'object') ? options : {};
        const publishMeta = normalizePublishMeta(opts.publishMeta);
        const operationId = deps.normalizeOperationId(
            Object.prototype.hasOwnProperty.call(opts, 'operationId')
                ? opts.operationId
                : publishMeta.operationId
        ) || publishMeta.operationId || null;
        const payloadOptions: MatchAuthorityRoomPayloadOptions = {
            ok: opts.ok === true,
            roomId: Object.prototype.hasOwnProperty.call(opts, 'roomId') ? opts.roomId : room.roomId || null,
            stateVersion: Object.prototype.hasOwnProperty.call(opts, 'stateVersion') ? opts.stateVersion : room.stateVersion,
            serverTime: opts.serverTime
        };
        if (operationId) payloadOptions.operationId = operationId;
        if (opts.idempotentReplay === true) payloadOptions.idempotentReplay = true;
        if (Object.prototype.hasOwnProperty.call(opts, 'presentationCursor')) {
            payloadOptions.presentationCursor = opts.presentationCursor || null;
        }

        const payload = buildRoomPayload(payloadOptions) as MatchAuthorityPublishResponsePayload;
        if (hasPublishMetaFields(publishMeta)) payload.publishMeta = publishMeta;
        return payload;
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
            effectLogs: deps.normalizeEffectLogMessages(opts.effectLogs),
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
        if (hasPublishMetaFields(publishMeta)) payload.publishMeta = publishMeta;
        return payload;
    }

    function buildRoomPayload(options: MatchAuthorityRoomPayloadOptions): MatchAuthorityRoomPayload {
        const opts = (options && typeof options === 'object') ? options : {};
        const hasSeats = opts.seats && typeof opts.seats === 'object';
        const hasSeatNames = opts.seatNames && typeof opts.seatNames === 'object';
        const hasSeatHandSkins = opts.seatHandSkins && typeof opts.seatHandSkins === 'object';
        const hasSeatPlayerIds = opts.seatPlayerIds && typeof opts.seatPlayerIds === 'object';
        const publicSeatMetadata = (hasSeats || hasSeatNames || hasSeatHandSkins || hasSeatPlayerIds)
            ? deps.buildPublicSeatMetadata(opts)
            : null;
        const payload: MatchAuthorityRoomPayload = {
            ok: opts.ok === true,
            roomId: opts.roomId ? String(opts.roomId).trim().toUpperCase() : null,
            serverTime: Number.isFinite(Number(opts.serverTime)) ? Number(opts.serverTime) : deps.now()
        };

        if (Object.prototype.hasOwnProperty.call(opts, 'roomName')) payload.roomName = String(opts.roomName || '').trim();
        if (Object.prototype.hasOwnProperty.call(opts, 'createdAt')) {
            payload.createdAt = Number.isFinite(Number(opts.createdAt)) ? Math.trunc(Number(opts.createdAt)) : null;
        }
        if (Object.prototype.hasOwnProperty.call(opts, 'stateVersion')) payload.stateVersion = normalizeStateVersion(opts.stateVersion);
        if (Object.prototype.hasOwnProperty.call(opts, 'snapshot')) payload.snapshot = (opts.snapshot && typeof opts.snapshot === 'object') ? opts.snapshot : null;
        if (publicSeatMetadata && hasSeats) payload.seats = publicSeatMetadata.seats;
        if (publicSeatMetadata && hasSeatNames) payload.seatNames = publicSeatMetadata.seatNames;
        if (publicSeatMetadata && hasSeatHandSkins) payload.seatHandSkins = publicSeatMetadata.seatHandSkins;
        if (publicSeatMetadata && hasSeatPlayerIds) payload.seatPlayerIds = publicSeatMetadata.seatPlayerIds;
        if (Object.prototype.hasOwnProperty.call(opts, 'roomDeck')) {
            payload.roomDeck = sanitizePublicRoomDeck(opts.roomDeck);
        }
        if (Object.prototype.hasOwnProperty.call(opts, 'roomBoardConfig')) payload.roomBoardConfig = opts.roomBoardConfig;
        if (Object.prototype.hasOwnProperty.call(opts, 'networkDebugEnabled')) payload.networkDebugEnabled = opts.networkDebugEnabled === true;
        if (Object.prototype.hasOwnProperty.call(opts, 'networkAutoEnabled')) payload.networkAutoEnabled = opts.networkAutoEnabled === true;
        if (Object.prototype.hasOwnProperty.call(opts, 'turnTimer')) payload.turnTimer = (opts.turnTimer && typeof opts.turnTimer === 'object') ? opts.turnTimer : null;
        if (Object.prototype.hasOwnProperty.call(opts, 'playbackEvents')) {
            payload.playbackEvents = Array.isArray(opts.playbackEvents) ? opts.playbackEvents : [];
            payload.playbackDigest = resolvePlaybackDigest(payload.playbackEvents, opts.playbackDigest);
        } else if (Object.prototype.hasOwnProperty.call(opts, 'playbackDigest')) {
            payload.playbackDigest = normalizePlaybackDigestValue(opts.playbackDigest);
        }
        if (Object.prototype.hasOwnProperty.call(opts, 'effectLogs')) payload.effectLogs = deps.normalizeEffectLogMessages(opts.effectLogs);
        if (payload.ok !== true && Object.prototype.hasOwnProperty.call(opts, 'rejectedReason')) {
            payload.rejectedReason = opts.rejectedReason ? String(opts.rejectedReason).trim() : null;
        }
        if (opts.idempotentReplay === true) payload.idempotentReplay = true;
        if (Object.prototype.hasOwnProperty.call(opts, 'errorMessage')) payload.errorMessage = opts.errorMessage || null;
        if (Object.prototype.hasOwnProperty.call(opts, 'playbackDiagnostics')) payload.playbackDiagnostics = opts.playbackDiagnostics || null;
        if (Object.prototype.hasOwnProperty.call(opts, 'projectedSnapshotHash')) payload.projectedSnapshotHash = opts.projectedSnapshotHash || null;
        if (Object.prototype.hasOwnProperty.call(opts, 'autoPassNotice')) {
            const autoPassNotice = normalizeAutoPassNotice(opts.autoPassNotice);
            if (autoPassNotice) payload.autoPassNotice = autoPassNotice;
        }
        if (Object.prototype.hasOwnProperty.call(opts, 'type')) payload.type = String(opts.type || '').trim() || null;
        if (Object.prototype.hasOwnProperty.call(opts, 'seatKey')) payload.seatKey = deps.parseSeatKeyOptional(opts.seatKey);
        if (Object.prototype.hasOwnProperty.call(opts, 'playerKey')) payload.playerKey = deps.parseSeatKeyOptional(opts.playerKey);
        if (Object.prototype.hasOwnProperty.call(opts, 'playerName')) payload.playerName = deps.normalizeNetworkPlayerName(opts.playerName);
        if (Object.prototype.hasOwnProperty.call(opts, 'seatToken')) payload.seatToken = String(opts.seatToken || '').trim();
        if (Object.prototype.hasOwnProperty.call(opts, 'rejoined')) payload.rejoined = opts.rejoined === true;
        if (Object.prototype.hasOwnProperty.call(opts, 'selectedHandSkinId')) payload.selectedHandSkinId = deps.normalizeSeatHandSkinId(opts.selectedHandSkinId);
        if (Object.prototype.hasOwnProperty.call(opts, 'operationId')) payload.operationId = deps.normalizeOperationId(opts.operationId) || null;
        if (Object.prototype.hasOwnProperty.call(opts, 'requestId')) payload.requestId = String(opts.requestId || '').trim();
        if (Object.prototype.hasOwnProperty.call(opts, 'accepted')) payload.accepted = opts.accepted === true;
        if (Object.prototype.hasOwnProperty.call(opts, 'actionType')) payload.actionType = opts.actionType ? String(opts.actionType) : null;
        if (Object.prototype.hasOwnProperty.call(opts, 'viewerRole')) payload.viewerRole = String(opts.viewerRole || '').trim() === 'spectator' ? 'spectator' : 'seat';
        if (Object.prototype.hasOwnProperty.call(opts, 'spectatorId')) payload.spectatorId = deps.normalizeSpectatorId(opts.spectatorId);
        if (Object.prototype.hasOwnProperty.call(opts, 'spectatorToken')) payload.spectatorToken = String(opts.spectatorToken || '').trim();
        if (Object.prototype.hasOwnProperty.call(opts, 'spectatorName')) payload.spectatorName = deps.normalizeSpectatorName(opts.spectatorName);
        if (Object.prototype.hasOwnProperty.call(opts, 'spectatorCount')) {
            payload.spectatorCount = Number.isFinite(Number(opts.spectatorCount)) ? Math.max(0, Math.trunc(Number(opts.spectatorCount))) : 0;
        }
        if (Object.prototype.hasOwnProperty.call(opts, 'maxSpectators')) {
            payload.maxSpectators = Number.isFinite(Number(opts.maxSpectators)) ? Math.max(0, Math.trunc(Number(opts.maxSpectators))) : deps.maxSpectators;
        }
        if (Object.prototype.hasOwnProperty.call(opts, 'presentationCursor')) payload.presentationCursor = opts.presentationCursor || null;
        if (Object.prototype.hasOwnProperty.call(opts, 'presentationFrames')) payload.presentationFrames = Array.isArray(opts.presentationFrames) ? opts.presentationFrames : [];
        if (Object.prototype.hasOwnProperty.call(opts, 'baseVisualSeq')) {
            payload.baseVisualSeq = Number.isFinite(Number(opts.baseVisualSeq)) ? Math.max(0, Math.trunc(Number(opts.baseVisualSeq))) : 0;
        }
        if (Object.prototype.hasOwnProperty.call(opts, 'baseSnapshot')) payload.baseSnapshot = opts.baseSnapshot || null;
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
        if (!Object.prototype.hasOwnProperty.call(source, 'roomId') && room.roomId) source.roomId = room.roomId;
        if (!Object.prototype.hasOwnProperty.call(source, 'roomName')) source.roomName = room.roomName || '';
        if (!Object.prototype.hasOwnProperty.call(source, 'createdAt') && Number.isFinite(Number(room.createdAt))) source.createdAt = room.createdAt;
        if (!Object.prototype.hasOwnProperty.call(source, 'seats') && hasRoomSeats) source.seats = room.seats;
        if (!Object.prototype.hasOwnProperty.call(source, 'seatNames') && hasRoomSeats) {
            source.seatNames = (room.seatNames && typeof room.seatNames === 'object') ? room.seatNames : { black: '', white: '' };
        }
        if (!Object.prototype.hasOwnProperty.call(source, 'seatHandSkins') && hasRoomSeats) source.seatHandSkins = deps.normalizeSeatHandSkins(room.seatHandSkins);
        if (!Object.prototype.hasOwnProperty.call(source, 'seatPlayerIds') && hasRoomSeats) source.seatPlayerIds = deps.normalizeSeatPlayerIds(room.seatPlayerIds);
        if (!Object.prototype.hasOwnProperty.call(source, 'networkAutoEnabled')) source.networkAutoEnabled = room.networkAutoEnabled === true;
        return buildRoomPayload(source);
    }

    function buildSnapshotPayloadFromRoom(
        roomValue: MatchAuthorityRoomState | null | undefined,
        options?: MatchAuthoritySnapshotPayloadFromRoomOptions | null
    ): MatchAuthorityRoomPayload {
        const room: MatchAuthorityRoomState = (roomValue && typeof roomValue === 'object') ? roomValue : {};
        const opts: MatchAuthoritySnapshotPayloadFromRoomOptions = (options && typeof options === 'object') ? options : {};
        return buildRoomPayloadFromRoom(room, assignOptionalRoomBoardConfig({
            ok: true, stateVersion: room.stateVersion,
            snapshot: Object.prototype.hasOwnProperty.call(opts, 'snapshot') ? opts.snapshot : null,
            roomDeck: Object.prototype.hasOwnProperty.call(opts, 'roomDeck') ? opts.roomDeck : null,
            networkDebugEnabled: opts.networkDebugEnabled === true, networkAutoEnabled: opts.networkAutoEnabled === true,
            turnTimer: opts.turnTimer, playbackEvents: opts.playbackEvents, playbackDigest: opts.playbackDigest,
            effectLogs: opts.effectLogs, playbackDiagnostics: opts.playbackDiagnostics, autoPassNotice: opts.autoPassNotice,
            presentationCursor: opts.presentationCursor, presentationFrames: opts.presentationFrames,
            operationId: opts.operationId, playerKey: opts.playerKey, actionType: opts.actionType, serverTime: opts.serverTime
        }, opts));
    }

    function buildPresencePayloadFromRoom(
        roomValue: MatchAuthorityRoomState | null | undefined,
        options?: MatchAuthorityPresencePayloadFromRoomOptions | null
    ): MatchAuthorityRoomPayload {
        const room: MatchAuthorityRoomState = (roomValue && typeof roomValue === 'object') ? roomValue : {};
        const opts: MatchAuthorityPresencePayloadFromRoomOptions = (options && typeof options === 'object') ? options : {};
        const seatKey = deps.normalizePlayerKey(opts.seatKey, 'black');
        const roomSeatNames = (room.seatNames && typeof room.seatNames === 'object') ? room.seatNames : { black: '', white: '' };
        const playerName = Object.prototype.hasOwnProperty.call(opts, 'playerName') ? opts.playerName : roomSeatNames[seatKey];
        const payloadOptions: MatchAuthorityPresencePayloadFromRoomOptions = {
            ok: true, stateVersion: room.stateVersion,
            roomDeck: Object.prototype.hasOwnProperty.call(opts, 'roomDeck') ? opts.roomDeck : null,
            networkDebugEnabled: opts.networkDebugEnabled === true, networkAutoEnabled: opts.networkAutoEnabled === true,
            turnTimer: opts.turnTimer, type: Object.prototype.hasOwnProperty.call(opts, 'type') ? opts.type : 'join',
            seatKey, playerName, rejoined: opts.rejoined, serverTime: opts.serverTime
        };
        for (const key of ['spectatorId', 'spectatorName', 'spectatorCount', 'maxSpectators', 'requestId', 'accepted'] as const) {
            if (Object.prototype.hasOwnProperty.call(opts, key)) payloadOptions[key] = opts[key] as never;
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
            ok: true, stateVersion: room.stateVersion,
            roomDeck: Object.prototype.hasOwnProperty.call(opts, 'roomDeck') ? opts.roomDeck : null,
            networkDebugEnabled: opts.networkDebugEnabled === true, networkAutoEnabled: opts.networkAutoEnabled === true,
            turnTimer: opts.turnTimer, serverTime: opts.serverTime
        }, opts));
    }

    function buildPublishPayloadFromRoom(
        roomValue: MatchAuthorityRoomState | null | undefined,
        options?: MatchAuthorityPublishPayloadFromRoomOptions | null
    ): MatchAuthorityPublishResponsePayload {
        const room: MatchAuthorityRoomState = (roomValue && typeof roomValue === 'object') ? roomValue : {};
        const opts: MatchAuthorityPublishPayloadFromRoomOptions = (options && typeof options === 'object') ? options : {};
        return buildPublishResponsePayload(assignOptionalRoomBoardConfig({
            ok: opts.ok === true, roomId: room.roomId || null, stateVersion: room.stateVersion,
            snapshot: Object.prototype.hasOwnProperty.call(opts, 'snapshot') ? opts.snapshot : null,
            seats: room.seats, seatNames: room.seatNames, seatHandSkins: room.seatHandSkins,
            roomDeck: Object.prototype.hasOwnProperty.call(opts, 'roomDeck') ? opts.roomDeck : null,
            networkDebugEnabled: opts.networkDebugEnabled === true, networkAutoEnabled: opts.networkAutoEnabled === true,
            turnTimer: opts.turnTimer, playbackEvents: opts.playbackEvents, playbackDigest: opts.playbackDigest,
            effectLogs: opts.effectLogs, playbackDiagnostics: opts.playbackDiagnostics, autoPassNotice: opts.autoPassNotice,
            serverTime: opts.serverTime, rejectedReason: opts.rejectedReason, idempotentReplay: opts.idempotentReplay === true,
            errorMessage: opts.errorMessage, presentationCursor: opts.presentationCursor, presentationFrames: opts.presentationFrames,
            publishMeta: opts.publishMeta || null
        }, opts));
    }

    return {
        normalizeStateVersion,
        classifyVersionRejectionReason,
        isVersionRejectionReason,
        normalizePublishActionType,
        normalizePublishMeta,
        normalizeAutoPassNotice,
        normalizePlaybackDigestValue,
        resolvePlaybackDigest,
        buildPublishResponseOptions,
        normalizePublishResponseMode,
        shouldUseAckOnlyPublishResponse,
        buildVersionRejectedPublishResponseOptions,
        buildPublishAckPayloadFromRoom,
        buildPublishResponsePayload,
        buildRoomPayload,
        buildRoomPayloadFromRoom,
        buildSnapshotPayloadFromRoom,
        buildPresencePayloadFromRoom,
        buildHeartbeatPayloadFromRoom,
        buildPublishPayloadFromRoom
    };
}
