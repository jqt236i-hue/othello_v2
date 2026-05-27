import type {
    DurableObjectStateLike,
    MatchWorkerPublicSnapshot,
    MatchWorkerRoomState,
    MatchWorkerTurnTimerOptions
} from './match-worker-types';

type MatchWorkerTurnTimerControllerConfig = {
    getRoom: () => MatchWorkerRoomState | null;
    getStorage: () => DurableObjectStateLike['storage'] | null | undefined;
    loadCoreLogicModule: () => Promise<{ isGameOver?: (gameState: unknown) => boolean }>;
    hasTwoActiveSeats: (room: MatchWorkerRoomState | null | undefined) => boolean;
    resolveTurnSeatKey: (room: MatchWorkerRoomState | null | undefined) => string;
    parseSeatKeyOptional: (value: unknown) => string | null;
    createPausedTurnTimer: (room: MatchWorkerRoomState | null | undefined) => Record<string, unknown>;
    createActiveTurnTimer: (room: MatchWorkerRoomState | null | undefined, nowMs: unknown) => Record<string, unknown>;
    areTurnTimersEqual: (left: unknown, right: unknown) => boolean;
    now?: () => number;
};

export function createMatchWorkerTurnTimerController(config: MatchWorkerTurnTimerControllerConfig) {
    const cfg = (config && typeof config === 'object') ? config : {} as MatchWorkerTurnTimerControllerConfig;
    const now = typeof cfg.now === 'function' ? cfg.now : () => Date.now();

    async function syncTurnTimerAlarm(): Promise<boolean> {
        const room = cfg.getRoom();
        const storage = cfg.getStorage();
        if (!room || !storage) return false;
        const timer = (room.turnTimer && typeof room.turnTimer === 'object') ? room.turnTimer : null;
        if (!timer || timer.active !== true || !Number.isFinite(Number((timer as any).turnDeadlineAt))) {
            if (typeof storage.deleteAlarm === 'function') {
                await storage.deleteAlarm();
                return true;
            }
            return false;
        }
        if (typeof storage.setAlarm === 'function') {
            await storage.setAlarm(Math.max(0, Math.trunc(Number((timer as any).turnDeadlineAt))));
            return true;
        }
        return false;
    }

    async function isSnapshotGameOver(snapshot: MatchWorkerPublicSnapshot | null | undefined): Promise<boolean> {
        if (!snapshot || !snapshot.gameState) return false;
        try {
            const core = await cfg.loadCoreLogicModule();
            return !!(core && typeof core.isGameOver === 'function' && core.isGameOver(snapshot.gameState));
        } catch (e) {
            return false;
        }
    }

    async function refreshTurnTimer(options?: MatchWorkerTurnTimerOptions | null): Promise<boolean> {
        const opts = (options && typeof options === 'object') ? options : {};
        const room = cfg.getRoom();
        if (!room) return false;

        const nowMs = Number.isFinite(Number((opts as any).nowMs)) ? Math.max(0, Math.trunc(Number((opts as any).nowMs))) : now();
        const turnSeatKey = cfg.resolveTurnSeatKey(room);
        const shouldRunBySeats = cfg.hasTwoActiveSeats(room);
        const isGameOver = shouldRunBySeats ? await isSnapshotGameOver(room.snapshot as MatchWorkerPublicSnapshot | null | undefined) : false;
        const shouldBeActive = shouldRunBySeats && !isGameOver;

        if (!shouldBeActive) {
            const pausedTimer = cfg.createPausedTurnTimer(room);
            const changed = !cfg.areTurnTimersEqual(room.turnTimer, pausedTimer);
            room.turnTimer = pausedTimer;
            await syncTurnTimerAlarm();
            return changed;
        }

        const timer = (room.turnTimer && typeof room.turnTimer === 'object') ? room.turnTimer : null;
        if (!(opts as any).forceRestart && timer && timer.active === true) {
            const timerSeatKey = cfg.parseSeatKeyOptional((timer as any).turnSeatKey);
            const timerDeadline = Number((timer as any).turnDeadlineAt);
            if (timerSeatKey === turnSeatKey && Number.isFinite(timerDeadline)) {
                (timer as any).limitSeconds = Number((cfg.createPausedTurnTimer(room) as any).limitSeconds);
                return false;
            }
        }

        const activeTimer = cfg.createActiveTurnTimer(room, nowMs);
        const changed = !cfg.areTurnTimersEqual(room.turnTimer, activeTimer);
        room.turnTimer = activeTimer;
        await syncTurnTimerAlarm();
        return changed;
    }

    return {
        syncTurnTimerAlarm,
        isSnapshotGameOver,
        refreshTurnTimer
    };
}
