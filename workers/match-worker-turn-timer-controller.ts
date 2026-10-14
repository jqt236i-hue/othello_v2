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
    applyTurnTimerRefresh: (
        room: MatchWorkerRoomState,
        options: { shouldBeActive: boolean; nowMs?: unknown; forceRestart?: boolean }
    ) => { changed: boolean; replaced: boolean };
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
        const shouldRunBySeats = cfg.hasTwoActiveSeats(room);
        const isGameOver = shouldRunBySeats ? await isSnapshotGameOver(room.snapshot as MatchWorkerPublicSnapshot | null | undefined) : false;
        // Timer rules are shared with the local server; only the alarm sync is Worker-specific.
        const result = cfg.applyTurnTimerRefresh(room, {
            shouldBeActive: shouldRunBySeats && !isGameOver,
            nowMs,
            forceRestart: !!(opts as any).forceRestart
        });
        if (result.replaced) await syncTurnTimerAlarm();
        return result.changed;
    }

    return {
        syncTurnTimerAlarm,
        isSnapshotGameOver,
        refreshTurnTimer
    };
}
