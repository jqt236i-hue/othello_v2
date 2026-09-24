import deepClone from '../deepClone';
import { freezeOwnedData } from '../../shared/immutable-data';
import type {
    MatchAuthorityBufferedSseEventRecord,
    MatchAuthorityBufferedSseEventRecordInput,
    MatchAuthorityBufferedSsePayloadByViewer,
    MatchAuthorityBufferedSseReplayEvent,
    MatchAuthoritySeatKey
} from '../match-authority-types';

interface MatchAuthorityJournalDeps {
    authorityLogLimit: number;
    sseResumeBufferLimit: number;
    normalizePendingEffectId: (value: unknown) => string | null;
    normalizeStateVersion: (value: unknown) => number | null;
    parseSeatKeyOptional: (value: unknown) => MatchAuthoritySeatKey | null;
    getPayloadKeyForViewer: (value: unknown) => MatchAuthoritySeatKey | 'spectator';
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

export function createMatchAuthorityJournalApi(deps: MatchAuthorityJournalDeps) {
    function appendAuthorityLog(roomValue: unknown, entryValue: unknown, limitValue: unknown): unknown[] {
        const room = (roomValue && typeof roomValue === 'object') ? asRecord(roomValue) : null;
        if (!room) return [];
        const entry = (entryValue && typeof entryValue === 'object') ? asRecord(entryValue) : {};
        const limit = Number.isFinite(Number(limitValue))
            ? Math.max(1, Math.trunc(Number(limitValue)))
            : deps.authorityLogLimit;
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
            pendingEffectId: deps.normalizePendingEffectId(entry.pendingEffectId),
            timeoutReason: entry.timeoutReason ? String(entry.timeoutReason).trim() : null,
            dedupeOutcome: entry.dedupeOutcome ? String(entry.dedupeOutcome).trim() : null,
            rejectedReason: entry.rejectedReason ? String(entry.rejectedReason).trim() : null
        };
        const log = Array.isArray(room.authorityLog) ? room.authorityLog.slice() : [];
        // Entries are never edited after append; freezing lets room storage
        // keep each one under its own key instead of rewriting the whole log.
        log.push(freezeOwnedData(nextEntry));
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
                const normalizedViewer = viewerKey === 'spectator' ? 'spectator' : deps.parseSeatKeyOptional(viewerKey);
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

        return freezeOwnedData(record);
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
            : deps.sseResumeBufferLimit;
        if (buffer.length > limit) {
            buffer.splice(0, buffer.length - limit);
        }
        return buffer;
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

        const viewer = deps.getPayloadKeyForViewer(viewerSeatKey);
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
        return replaySources.map((entry, index) => {
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
    }

    function resolveBufferedSnapshotPayloadForViewer(
        entry: MatchAuthorityBufferedSseEventRecord,
        viewerSeatKey: unknown
    ): unknown | null {
        if (!entry || typeof entry !== 'object') return null;
        if (String(entry.event || '').trim() !== 'snapshot') return null;

        const viewer = deps.getPayloadKeyForViewer(viewerSeatKey);
        if (entry.payloadByViewer && typeof entry.payloadByViewer === 'object') {
            if (!Object.prototype.hasOwnProperty.call(entry.payloadByViewer, viewer)) return null;
            return entry.payloadByViewer[viewer] || null;
        }
        return Object.prototype.hasOwnProperty.call(entry, 'payload') ? (entry.payload || null) : null;
    }

    function getPayloadStateVersion(payloadValue: unknown): number | null {
        const payload = asRecord(payloadValue);
        const directVersion = deps.normalizeStateVersion(payload.stateVersion);
        if (directVersion !== null) return directVersion;

        const snapshot = asRecord(payload.snapshot);
        const snapshotVersion = deps.normalizeStateVersion(snapshot.stateVersion);
        if (snapshotVersion !== null) return snapshotVersion;

        return deps.normalizeStateVersion(asRecord(snapshot._meta).version);
    }

    function getBufferedSnapshotPayloadForStateVersion(
        bufferValue: unknown,
        stateVersionValue: unknown,
        viewerSeatKey: unknown
    ): unknown | null {
        const stateVersion = deps.normalizeStateVersion(stateVersionValue);
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

    return {
        appendAuthorityLog,
        createBufferedSseEventRecord,
        appendBufferedSseEvent,
        getBufferedSseReplayEvents,
        getBufferedSnapshotPayloadForStateVersion
    };
}
