// Presentation-journal assembly shared by the Worker (Durable Object) and the local match server.
// The authority/projection functions are injected so both runtimes keep their own module loading,
// while cursor, initial viewer snapshots, and accepted-frame materials are built in one place.
// Per-viewer frame caches, the immutable journal, and save order stay owned by the adapters and the
// authority's appendPresentationFrame.

export type MatchPresentationJournalAuthority = {
    buildPublicSnapshotForViewer: (room: any, viewer: unknown) => unknown;
    appendPresentationFrame: (room: any, options: Record<string, unknown>) => unknown;
    normalizeEffectLogMessages: (value: unknown) => unknown;
    toPublicPresentationFrame: (entry: unknown, viewer: unknown, room: any) => unknown;
    maskPlaybackEventsForSeat: (events: unknown, viewerSeat: unknown, projectedSnapshot: unknown) => unknown[];
};

export type MatchPresentationJournalRulesConfig = {
    authority: MatchPresentationJournalAuthority;
    parseSeatKeyOptional: (value: unknown) => string | null;
    getPublishPresentationFrames: (
        options: Record<string, unknown>,
        viewerKey: string,
        build: () => unknown[]
    ) => unknown[];
};

type PresentationViewer = { role: 'seat'; seatKey: string } | { role: 'spectator'; spectatorId: string };

const VIEWERS: ReadonlyArray<[key: 'black' | 'white' | 'spectator', viewer: PresentationViewer]> = [
    ['black', { role: 'seat', seatKey: 'black' }],
    ['white', { role: 'seat', seatKey: 'white' }],
    ['spectator', { role: 'spectator', spectatorId: '' }]
];

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function toCursorNumber(value: unknown): number {
    return Number.isFinite(Number(value)) ? Math.max(0, Math.trunc(Number(value))) : 0;
}

export function createMatchPresentationJournalRules(config: MatchPresentationJournalRulesConfig) {
    const { authority, parseSeatKeyOptional, getPublishPresentationFrames } = config;

    function buildPresentationCursor(room: any): Record<string, number> {
        return {
            visualSeq: toCursorNumber(room && room.visualSeq),
            stateVersion: toCursorNumber(room && room.stateVersion)
        };
    }

    function viewerFromSeatKey(viewerSeatKey: unknown): PresentationViewer {
        const seatKey = parseSeatKeyOptional(viewerSeatKey);
        return seatKey ? { role: 'seat', seatKey } : { role: 'spectator', spectatorId: '' };
    }

    function projectForEachViewer(room: any, overrides: Record<string, unknown> = {}): Record<string, unknown> {
        const result: Record<string, unknown> = {};
        for (const [key, viewer] of VIEWERS) {
            result[key] = overrides[key] || authority.buildPublicSnapshotForViewer(room, viewer);
        }
        return result;
    }

    function ensureInitialPresentationSnapshots(room: any): void {
        if (!room || room.initialSnapshotByViewer) return;
        room.initialSnapshotByViewer = projectForEachViewer(room);
        if (!Number.isFinite(Number(room.visualSeq))) room.visualSeq = 0;
        if (!Array.isArray(room.presentationJournal)) room.presentationJournal = [];
    }

    function appendPresentationFrameForAcceptedPublish(room: any, optionsValue: unknown): unknown {
        if (!room) return null;
        ensureInitialPresentationSnapshots(room);
        const options = asRecord(optionsValue);
        const playbackEvents = Array.isArray(options.playbackEvents) ? options.playbackEvents : [];
        const effectLogs = authority.normalizeEffectLogMessages(options.effectLogs);
        const playbackDiagnostics = options.playbackDiagnostics || null;
        const artifactSnapshots = asRecord(asRecord(options.publishViewerArtifacts).projectedSnapshots);
        const snapshotAfterByViewer = projectForEachViewer(room, artifactSnapshots);
        // Each viewer gets its own payload object; seats never receive the identity of cards
        // entering the opponent's hand.
        const viewerPayload = (viewerKey: 'black' | 'white' | 'spectator') => ({
            playbackEvents: viewerKey === 'spectator'
                ? playbackEvents
                : authority.maskPlaybackEventsForSeat(playbackEvents, viewerKey, snapshotAfterByViewer[viewerKey]),
            effectLogs,
            playbackDiagnostics
        });
        return authority.appendPresentationFrame(room, {
            stateVersionFrom: options.previousStateVersion,
            stateVersionTo: options.nextStateVersion,
            operationId: options.operationId,
            actorSeatKey: options.actorSeatKey,
            actionType: options.actionType,
            payloadByViewer: {
                black: viewerPayload('black'),
                white: viewerPayload('white'),
                spectator: viewerPayload('spectator')
            },
            snapshotAfterByViewer,
            createdAt: options.createdAt
        });
    }

    function buildPresentationFramesForViewer(room: any, viewerValue: unknown, optionsValue: unknown): unknown[] {
        const options = asRecord(optionsValue);
        if (Array.isArray(options.presentationFrames)) return options.presentationFrames;
        const presentationFrameEntry = options.presentationFrameEntry;
        if (presentationFrameEntry && typeof presentationFrameEntry === 'object') {
            const viewer = asRecord(viewerValue);
            const viewerKey = viewer.role === 'seat' && (viewer.seatKey === 'black' || viewer.seatKey === 'white')
                ? String(viewer.seatKey)
                : 'spectator';
            return getPublishPresentationFrames(options, viewerKey, () => [
                authority.toPublicPresentationFrame(presentationFrameEntry, viewerValue, room)
            ]);
        }
        return [];
    }

    return {
        buildPresentationCursor,
        viewerFromSeatKey,
        ensureInitialPresentationSnapshots,
        appendPresentationFrameForAcceptedPublish,
        buildPresentationFramesForViewer
    };
}
