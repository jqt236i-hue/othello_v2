import type {
    MatchWorkerPublicSnapshot,
    MatchWorkerRoomState,
    MatchWorkerTurnTimeoutResult,
    MatchWorkerTurnTimerOptions
} from './match-worker-types';

type MatchWorkerTimeoutControllerConfig = {
    getRoom: () => MatchWorkerRoomState | null;
    parseSeatKeyOptional: (value: unknown) => string | null;
    resolveTurnSeatKey: (room: MatchWorkerRoomState | null | undefined) => string;
    refreshTurnTimer: (options?: MatchWorkerTurnTimerOptions | null) => Promise<boolean>;
    saveRoom: () => Promise<void>;
    applyTimeoutPassToSnapshot: (options: {
        room: MatchWorkerRoomState;
        snapshot: MatchWorkerPublicSnapshot;
        playerKey: string;
        nowMs: number;
    }) => Promise<{
        ok?: boolean;
        snapshot?: MatchWorkerPublicSnapshot;
        playbackEvents?: unknown[];
        effectLogs?: unknown[];
        playbackDiagnostics?: unknown;
        diagnostics?: unknown;
    } | null | undefined>;
    deepClone: <T>(value: T) => T;
    computeAuthoritativeStateHash: (snapshotValue: unknown) => string | null;
    normalizeSnapshotBoardContract: (
        snapshotValue: unknown,
        options?: { allowLegacy?: boolean; requireFullSnapshot?: boolean }
    ) => { ok?: boolean; errors?: string[] };
    appendAuthorityLog: (roomValue: unknown, entryValue: unknown, limitValue: unknown) => unknown[];
    ensureInitialPresentationSnapshots: (room: MatchWorkerRoomState) => void;
    buildPublishViewerArtifacts: (
        room: MatchWorkerRoomState,
        options?: Record<string, unknown>
    ) => {
        canonicalHash?: string | null;
        projectedSnapshots?: Record<string, unknown>;
        snapshotPayloads?: Record<string, unknown>;
        [key: string]: unknown;
    };
    appendPresentationFrameForAcceptedPublish: (
        room: MatchWorkerRoomState,
        options: Record<string, unknown>
    ) => unknown;
    broadcastSnapshot: (meta: Record<string, unknown>) => Promise<void>;
    now?: () => number;
};

export function createMatchWorkerTimeoutController(config: MatchWorkerTimeoutControllerConfig) {
    const cfg = (config && typeof config === 'object') ? config : {} as MatchWorkerTimeoutControllerConfig;
    const now = typeof cfg.now === 'function' ? cfg.now : () => Date.now();

    async function applyExpiredTurnTimeoutIfNeeded(options?: MatchWorkerTurnTimerOptions | null): Promise<MatchWorkerTurnTimeoutResult> {
        const opts = (options && typeof options === 'object') ? options : {};
        const room = cfg.getRoom();
        if (!room) return { applied: false };
        const timeoutPassResolver = typeof cfg.applyTimeoutPassToSnapshot === 'function'
            ? cfg.applyTimeoutPassToSnapshot
            : null;
        if (!timeoutPassResolver) return { applied: false };

        const nowMs = Number.isFinite(Number((opts as any).nowMs)) ? Math.max(0, Math.trunc(Number((opts as any).nowMs))) : now();
        const timerRefreshed = await cfg.refreshTurnTimer({ nowMs, forceRestart: false });
        if (timerRefreshed) {
            room.updatedAt = nowMs;
            await cfg.saveRoom();
        }

        const timer = (room.turnTimer && typeof room.turnTimer === 'object') ? room.turnTimer : null;
        if (!timer || timer.active !== true) return { applied: false };

        const deadline = Number((timer as any).turnDeadlineAt);
        if (!Number.isFinite(deadline) || deadline > nowMs) return { applied: false };

        const snapshot = room && room.snapshot && typeof room.snapshot === 'object'
            ? room.snapshot as MatchWorkerPublicSnapshot
            : null;
        if (!snapshot || !snapshot.gameState || !snapshot.cardState) return { applied: false };

        const timedOutSeatKey = cfg.parseSeatKeyOptional((timer as any).turnSeatKey) || cfg.resolveTurnSeatKey(room);
        const currentTurnSeatKey = cfg.resolveTurnSeatKey(room);
        if (timedOutSeatKey !== currentTurnSeatKey) {
            const corrected = await cfg.refreshTurnTimer({ nowMs, forceRestart: true });
            if (corrected) {
                room.updatedAt = nowMs;
                await cfg.saveRoom();
            }
            return { applied: false };
        }

        const previousStateVersion = Number.isFinite(Number(room.stateVersion))
            ? Math.max(0, Math.trunc(Number(room.stateVersion)))
            : 0;
        const previousUpdatedAt = room.updatedAt;
        const previousAuthoritativeStateHash = room.authoritativeStateHash;
        const expectedTurnDeadlineAt = deadline;
        const resolved = await timeoutPassResolver({
            room,
            snapshot: cfg.deepClone(snapshot) as MatchWorkerPublicSnapshot,
            playerKey: timedOutSeatKey,
            nowMs
        });
        if (!resolved || resolved.ok !== true || !resolved.snapshot) {
            return { applied: false };
        }
        cfg.ensureInitialPresentationSnapshots(room);
        const nextSnapshot = cfg.deepClone(resolved.snapshot) as MatchWorkerPublicSnapshot;
        const serverPlaybackEvents = Array.isArray(resolved.playbackEvents) ? resolved.playbackEvents : [];
        const serverEffectLogs = Array.isArray(resolved.effectLogs) ? resolved.effectLogs : [];
        const serverPlaybackDiagnostics = resolved.playbackDiagnostics || null;

        const latestTimer = (room.turnTimer && typeof room.turnTimer === 'object') ? room.turnTimer : null;
        const latestDeadline = Number(latestTimer && (latestTimer as any).turnDeadlineAt);
        const latestTimedOutSeatKey = cfg.parseSeatKeyOptional(latestTimer && (latestTimer as any).turnSeatKey)
            || cfg.resolveTurnSeatKey(room);
        if (
            Number(room.stateVersion) !== previousStateVersion
            || cfg.resolveTurnSeatKey(room) !== currentTurnSeatKey
            || !latestTimer
            || (latestTimer as any).active !== true
            || latestTimedOutSeatKey !== timedOutSeatKey
            || !Number.isFinite(latestDeadline)
            || latestDeadline !== expectedTurnDeadlineAt
        ) {
            return { applied: false };
        }

        room.stateVersion = previousStateVersion + 1;

        nextSnapshot.stateVersion = room.stateVersion;
        nextSnapshot.updatedAt = nowMs;
        const boardContractInspection = cfg.normalizeSnapshotBoardContract(nextSnapshot, {
            allowLegacy: true,
            requireFullSnapshot: true
        });
        if (!boardContractInspection || boardContractInspection.ok !== true) {
            room.stateVersion = previousStateVersion;
            throw new Error(`timeout_invalid_board_contract: ${(boardContractInspection && boardContractInspection.errors || []).join('; ')}`);
        }
        room.snapshot = nextSnapshot;
        room.updatedAt = nowMs;
        const publishViewerArtifacts = cfg.buildPublishViewerArtifacts(room, {});
        room.authoritativeStateHash = publishViewerArtifacts && publishViewerArtifacts.canonicalHash
            ? publishViewerArtifacts.canonicalHash
            : cfg.computeAuthoritativeStateHash(nextSnapshot);
        const operationId = `timeout_${room.stateVersion}_${nowMs}`;
        const presentationFrameEntry = cfg.appendPresentationFrameForAcceptedPublish(room, {
            previousStateVersion,
            nextStateVersion: room.stateVersion,
            operationId,
            actorSeatKey: timedOutSeatKey,
            actionType: 'timeout_pass',
            playbackEvents: serverPlaybackEvents,
            effectLogs: serverEffectLogs,
            playbackDiagnostics: serverPlaybackDiagnostics,
            publishViewerArtifacts,
            createdAt: nowMs
        });
        if (!presentationFrameEntry) {
            room.stateVersion = previousStateVersion;
            room.snapshot = snapshot;
            room.updatedAt = previousUpdatedAt;
            room.authoritativeStateHash = previousAuthoritativeStateHash;
            throw new Error('timeout_presentation_frame_required');
        }
        cfg.appendAuthorityLog(room, {
            kind: 'timeout_applied',
            actionType: 'timeout_pass',
            committedVersion: room.stateVersion,
            stateHashAfter: room.authoritativeStateHash,
            timeoutReason: 'turn_deadline_expired'
        }, undefined);

        await cfg.refreshTurnTimer({ nowMs, forceRestart: true });
        await cfg.saveRoom();

        await cfg.broadcastSnapshot({
            playerKey: timedOutSeatKey,
            actionType: 'timeout_pass',
            playbackEvents: serverPlaybackEvents,
            effectLogs: serverEffectLogs,
            playbackDiagnostics: serverPlaybackDiagnostics,
            operationId,
            presentationFrameEntry,
            __publishViewerArtifacts: publishViewerArtifacts
        });

        return {
            applied: true,
            stateVersion: room.stateVersion,
            playerKey: timedOutSeatKey as any
        };
    }

    return {
        applyExpiredTurnTimeoutIfNeeded
    };
}
