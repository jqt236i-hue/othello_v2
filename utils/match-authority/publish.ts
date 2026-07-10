import type {
    MatchAuthorityAutoPassNotice,
    MatchAuthorityPublishMeta,
    MatchAuthorityPublishResponseMode,
    MatchAuthorityPublishResponseOptions,
    MatchAuthorityRoomState,
    MatchAuthoritySeatKey
} from '../match-authority-types';

type RecordValue = Record<string, any>;

interface MatchAuthorityPublishResponseOptionInput extends MatchAuthorityPublishResponseOptions {
    publishKind?: unknown;
}

interface MatchAuthorityPublishApiDeps {
    versionRejectionReasons: Readonly<Record<'AHEAD' | 'BEHIND' | 'GAP' | 'MISMATCH', string>>;
    normalizeOperationId: (value: unknown) => string;
    normalizePlayerKey: (value: unknown) => MatchAuthoritySeatKey;
    computePlaybackDigest: ((playbackEvents: unknown[]) => string) | null;
    computeStableHash: ((value: unknown) => string) | null;
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
            reason: String(source.reason || '').trim() || 'no_legal_moves_or_usable_cards'
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
        buildVersionRejectedPublishResponseOptions
    };
}
