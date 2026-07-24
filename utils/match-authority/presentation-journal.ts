import deepClone from '../deepClone';
import type {
    MatchAuthorityAcceptedOperationEntry,
    MatchAuthorityPresentationFramePayload,
    MatchAuthorityPresentationFramePublic,
    MatchAuthorityPresentationJournalEntry,
    MatchAuthorityPresentationPayloadKey,
    MatchAuthorityRoomState,
    MatchAuthoritySeatKey,
    MatchAuthorityViewer
} from '../match-authority-types';

interface MatchAuthorityPresentationJournalDeps {
    presentationJournalLimit: number;
    normalizeViewerIdentity: (value: unknown) => MatchAuthorityViewer | null;
    normalizeOperationId: (value: unknown) => string | null;
    normalizeStateVersion: (value: unknown) => number | null;
    parseSeatKeyOptional: (value: unknown) => MatchAuthoritySeatKey | null;
    normalizePublishActionType: (value: unknown) => string | null;
    normalizeAcceptedOperationEntry: (value: unknown) => MatchAuthorityAcceptedOperationEntry | null;
    resolvePlaybackDigest: (playbackEvents: unknown[], suppliedDigest?: unknown) => string;
    normalizeEffectLogMessages: (value: unknown) => string[];
}

function asRecord(value: unknown): Record<string, any> {
    return value && typeof value === 'object' ? value as Record<string, any> : {};
}

export function createMatchAuthorityPresentationJournalApi(deps: MatchAuthorityPresentationJournalDeps) {
    function toPositiveInteger(value: unknown, fallback: number): number {
        return Number.isFinite(Number(value)) ? Math.max(0, Math.trunc(Number(value))) : fallback;
    }

    function normalizePresentationPayload(value: unknown): MatchAuthorityPresentationFramePayload {
        const source = asRecord(value);
        const playbackEvents = Array.isArray(source.playbackEvents) ? deepClone(source.playbackEvents) as unknown[] : [];
        return {
            playbackEvents,
            playbackDigest: deps.resolvePlaybackDigest(playbackEvents, source.playbackDigest),
            effectLogs: deps.normalizeEffectLogMessages(source.effectLogs),
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
        return deps.normalizeViewerIdentity(viewerValue) || null;
    }

    function cloneOwnedSnapshotAfterByViewer(
        value: unknown
    ): Partial<Record<MatchAuthorityPresentationPayloadKey, unknown>> {
        const ownedSnapshots: Partial<Record<MatchAuthorityPresentationPayloadKey, unknown>> = {};
        const sourceSnapshots = asRecord(value);
        for (const key of ['black', 'white', 'spectator'] as MatchAuthorityPresentationPayloadKey[]) {
            if (Object.prototype.hasOwnProperty.call(sourceSnapshots, key)) {
                ownedSnapshots[key] = deepClone(sourceSnapshots[key]);
            }
        }
        return ownedSnapshots;
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

        const snapshotAfterByViewer = cloneOwnedSnapshotAfterByViewer(input.snapshotAfterByViewer);

        const entry: MatchAuthorityPresentationJournalEntry = {
            visualSeq,
            stateVersionFrom: toPositiveInteger(input.stateVersionFrom, 0),
            stateVersionTo: toPositiveInteger(input.stateVersionTo, 0),
            operationId: deps.normalizeOperationId(input.operationId) || null,
            actorSeatKey: deps.parseSeatKeyOptional(input.actorSeatKey),
            actionType: deps.normalizePublishActionType(input.actionType),
            payloadByViewer,
            snapshotAfterByViewer,
            createdAt: Number.isFinite(Number(input.createdAt)) ? Number(input.createdAt) : Date.now()
        };

        journal.push(entry);
        if (journal.length > deps.presentationJournalLimit) {
            const removeCount = journal.length - deps.presentationJournalLimit;
            const baseEntry = journal[removeCount - 1];
            if (baseEntry && typeof baseEntry === 'object') {
                room.presentationJournalBaseVisualSeq = toPositiveInteger(baseEntry.visualSeq, 0);
                room.presentationJournalBaseSnapshotByViewer = deepClone(baseEntry.snapshotAfterByViewer || {});
            }
            journal.splice(0, removeCount);
        }
        room.visualSeq = visualSeq;
        return entry;
    }

    function getMinimumRetainedPresentationBaseSeq(roomValue: MatchAuthorityRoomState | null | undefined): number {
        const room = roomValue && typeof roomValue === 'object' ? roomValue : {} as MatchAuthorityRoomState;
        const journal = Array.isArray(room.presentationJournal) ? room.presentationJournal : [];
        if (journal.length <= 0) return 0;
        if (Number.isFinite(Number(room.presentationJournalBaseVisualSeq))) {
            return Math.max(0, Math.trunc(Number(room.presentationJournalBaseVisualSeq)));
        }
        const firstSeq = toPositiveInteger(journal[0] && journal[0].visualSeq, 0);
        return Math.max(0, firstSeq - 1);
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
        const room = roomValue && typeof roomValue === 'object' ? roomValue : {} as MatchAuthorityRoomState;
        const playbackEvents = Array.isArray(payload.playbackEvents) ? deepClone(payload.playbackEvents) as unknown[] : [];

        return {
            roomId: room.roomId ? String(room.roomId).trim().toUpperCase() : null,
            visualSeq: toPositiveInteger(entry.visualSeq, 0),
            stateVersionFrom: toPositiveInteger(entry.stateVersionFrom, 0),
            stateVersionTo: toPositiveInteger(entry.stateVersionTo, 0),
            operationId: entry.operationId || null,
            actorSeatKey: deps.parseSeatKeyOptional(entry.actorSeatKey),
            actionType: deps.normalizePublishActionType(entry.actionType),
            playbackEvents,
            playbackDigest: deps.resolvePlaybackDigest(playbackEvents, payload.playbackDigest),
            effectLogs: deps.normalizeEffectLogMessages(payload.effectLogs),
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
        const room = roomValue && typeof roomValue === 'object' ? roomValue : {} as MatchAuthorityRoomState;
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
        const room = roomValue && typeof roomValue === 'object' ? roomValue : {} as MatchAuthorityRoomState;
        const operationId = deps.normalizeOperationId(operationIdValue);
        if (!operationId) return null;
        const stateVersion = deps.normalizeStateVersion(stateVersionValue);
        const journal = Array.isArray(room.presentationJournal) ? room.presentationJournal : [];
        for (let index = journal.length - 1; index >= 0; index -= 1) {
            const entry = journal[index];
            if (!entry || deps.normalizeOperationId(entry.operationId) !== operationId) continue;
            if (stateVersion !== null && deps.normalizeStateVersion(entry.stateVersionTo) !== stateVersion) continue;
            return entry;
        }
        return null;
    }

    function findPresentationFrameEntryForAcceptedOperation(
        roomValue: MatchAuthorityRoomState | null | undefined,
        acceptedOperationValue: unknown
    ): MatchAuthorityPresentationJournalEntry | null {
        const acceptedOperation = deps.normalizeAcceptedOperationEntry(acceptedOperationValue);
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
        const room = roomValue && typeof roomValue === 'object' ? roomValue : {} as MatchAuthorityRoomState;
        const viewer = normalizePresentationViewer(viewerValue);
        const payloadKey = getPresentationPayloadKeyForViewer(viewer);
        const retainedBaseSeq = Number.isFinite(Number(room.presentationJournalBaseVisualSeq))
            ? Math.max(0, Math.trunc(Number(room.presentationJournalBaseVisualSeq)))
            : null;
        if (retainedBaseSeq !== null && afterVisualSeq === retainedBaseSeq) {
            const baseSnapshots = room.presentationJournalBaseSnapshotByViewer && typeof room.presentationJournalBaseSnapshotByViewer === 'object'
                ? asRecord(room.presentationJournalBaseSnapshotByViewer)
                : {};
            return baseSnapshots[payloadKey] || baseSnapshots.spectator || null;
        }
        if (afterVisualSeq <= 0) {
            const initialSnapshots = room.initialSnapshotByViewer && typeof room.initialSnapshotByViewer === 'object'
                ? asRecord(room.initialSnapshotByViewer)
                : {};
            return initialSnapshots[payloadKey] || initialSnapshots.spectator || null;
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
        const room = roomValue && typeof roomValue === 'object' ? roomValue : {} as MatchAuthorityRoomState;
        const opts = asRecord(options);
        const afterVisualSeq = toPositiveInteger(opts.afterVisualSeq, 0);
        const currentVisualSeq = toPositiveInteger(room.visualSeq, 0);
        const currentStateVersion = toPositiveInteger(room.stateVersion, 0);
        const presentationCursor = { visualSeq: currentVisualSeq, stateVersion: currentStateVersion };
        const serverTime = Number.isFinite(Number(opts.serverTime)) ? Number(opts.serverTime) : Date.now();
        const roomId = room.roomId ? String(room.roomId).trim().toUpperCase() : null;
        const minimumRetainedBaseSeq = getMinimumRetainedPresentationBaseSeq(room);
        if (afterVisualSeq < minimumRetainedBaseSeq) {
            return {
                ok: false, roomId, reason: 'VISUAL_CURSOR_EXPIRED', baseVisualSeq: afterVisualSeq,
                baseSnapshot: null, presentationCursor, presentationFrames: [], snapshot: null, serverTime
            };
        }
        const baseSnapshot = findBaseSnapshotForVisualSeq(room, afterVisualSeq, opts.viewer);
        if (!baseSnapshot) {
            return {
                ok: false, roomId, reason: 'VISUAL_CURSOR_EXPIRED', baseVisualSeq: afterVisualSeq,
                baseSnapshot: null, presentationCursor, presentationFrames: [], snapshot: null, serverTime
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

    return {
        appendPresentationFrame,
        getPresentationFramesAfter,
        findPresentationFrameEntryForOperation,
        findPresentationFrameEntryForAcceptedOperation,
        buildPresentationJournalResponse,
        toPublicPresentationFrame
    };
}
