import type {
    MatchWorkerPlaybackAssembly,
    MatchWorkerPublicSnapshot,
    MatchWorkerRoomState,
    MatchWorkerTurnTimeoutResult,
    MatchWorkerTurnTimerOptions
} from './match-worker-types';

type MatchWorkerTimeoutControllerConfig = {
    getRoom: () => MatchWorkerRoomState | null;
    asRecord: (value: unknown) => Record<string, unknown>;
    parseSeatKeyOptional: (value: unknown) => string | null;
    resolveTurnSeatKey: (room: MatchWorkerRoomState | null | undefined) => string;
    refreshTurnTimer: (options?: MatchWorkerTurnTimerOptions | null) => Promise<boolean>;
    saveRoom: () => Promise<void>;
    loadCoreLogicModule: () => Promise<{ applyPass: (gameState: unknown) => unknown }>;
    deepClone: <T>(value: T) => T;
    stripTransientPresentationState: (snapshot: unknown) => unknown;
    reconcileTurnStartAndCollectPlayback: (room: MatchWorkerRoomState | null | undefined, snapshot: unknown) => Promise<MatchWorkerPlaybackAssembly>;
    reportPlaybackAssemblyDiagnostics: (context: unknown, diagnostics: unknown, options?: unknown) => void;
    toPublicNetworkDebugEnabled: (room: MatchWorkerRoomState | null | undefined) => boolean;
    toDebugPlaybackDiagnostics: (diagnostics: unknown, networkDebugEnabled: unknown) => unknown | null;
    computeAuthoritativeStateHash: (snapshotValue: unknown) => string | null;
    appendAuthorityLog: (roomValue: unknown, entryValue: unknown, limitValue: unknown) => unknown[];
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

        const core = await cfg.loadCoreLogicModule();
        const nextSnapshot = cfg.deepClone(snapshot) as MatchWorkerPublicSnapshot;
        nextSnapshot.gameState = core.applyPass(nextSnapshot.gameState);
        cfg.stripTransientPresentationState(nextSnapshot);
        if (nextSnapshot.cardState && typeof nextSnapshot.cardState === 'object') {
            if (
                cfg.parseSeatKeyOptional((nextSnapshot.cardState as any).selectedCardOwnerKey) === timedOutSeatKey
            ) {
                (nextSnapshot.cardState as any).selectedCardId = null;
                (nextSnapshot.cardState as any).selectedCardOwnerKey = null;
            }
        }
        if (nextSnapshot.cardState && (nextSnapshot.cardState as any).pendingEffectByPlayer && typeof (nextSnapshot.cardState as any).pendingEffectByPlayer === 'object') {
            cfg.asRecord((nextSnapshot.cardState as any).pendingEffectByPlayer)[timedOutSeatKey] = null;
        }
        const serverPlaybackAssembly = await cfg.reconcileTurnStartAndCollectPlayback(room, nextSnapshot);
        cfg.reportPlaybackAssemblyDiagnostics('worker-timeout-pass', serverPlaybackAssembly && serverPlaybackAssembly.diagnostics, {
            networkDebugEnabled: cfg.toPublicNetworkDebugEnabled(room)
        });
        const serverPlaybackEvents = (serverPlaybackAssembly && Array.isArray(serverPlaybackAssembly.playbackEvents))
            ? serverPlaybackAssembly.playbackEvents
            : [];
        const serverEffectLogs = (serverPlaybackAssembly && Array.isArray(serverPlaybackAssembly.effectLogs))
            ? serverPlaybackAssembly.effectLogs
            : [];

        room.stateVersion = Number.isFinite(Number(room.stateVersion))
            ? Math.max(0, Math.trunc(Number(room.stateVersion))) + 1
            : 1;

        nextSnapshot.stateVersion = room.stateVersion;
        nextSnapshot.updatedAt = nowMs;
        room.snapshot = nextSnapshot;
        room.updatedAt = nowMs;
        room.authoritativeStateHash = cfg.computeAuthoritativeStateHash(nextSnapshot);
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
            playbackDiagnostics: cfg.toDebugPlaybackDiagnostics(serverPlaybackAssembly && serverPlaybackAssembly.diagnostics, cfg.toPublicNetworkDebugEnabled(room)),
            operationId: `timeout_${room.stateVersion}_${nowMs}`
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
