// Pure turn-timer rules shared by the Worker (Durable Object) and the local match server.
// Runtime concerns stay in the adapters: the Worker arms/deletes its alarm and loads the core
// module asynchronously; the local server decides game over synchronously and uses its own scheduler.

export type MatchTurnTimerRoom = {
    turnTimer?: unknown;
    snapshot?: unknown;
} | null | undefined;

export type MatchTurnTimerRulesConfig = {
    /** Fallback limit used when the room has no (valid) limit of its own. */
    defaultLimitSeconds: number;
    normalizeLimitSeconds: (value: unknown, fallback?: unknown) => number;
    resolveTurnSeatKey: (room: any) => string;
    parseSeatKeyOptional: (value: unknown) => string | null;
    now?: () => number;
};

export type MatchTurnTimerRefreshOptions = {
    /** Adapter decision: both seats present and the game is not over. */
    shouldBeActive: boolean;
    nowMs?: unknown;
    forceRestart?: boolean;
};

export type MatchTurnTimerRefreshResult = {
    /** The public timer state differs from the previous one. */
    changed: boolean;
    /** The timer object was replaced (paused/restarted); the Worker re-syncs its alarm only then. */
    replaced: boolean;
};

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function finiteOrNull(value: unknown): number | null {
    return Number.isFinite(Number(value)) ? Number(value) : null;
}

export function createMatchTurnTimerRules(config: MatchTurnTimerRulesConfig) {
    const cfg = config;
    const now = typeof cfg.now === 'function' ? cfg.now : () => Date.now();
    const defaultLimitSeconds = cfg.defaultLimitSeconds;

    function readTimer(room: MatchTurnTimerRoom): Record<string, unknown> | null {
        const timer = room && (room as Record<string, unknown>).turnTimer;
        return timer && typeof timer === 'object' ? timer as Record<string, unknown> : null;
    }

    function resolveLimitSeconds(room: MatchTurnTimerRoom): number {
        const timer = readTimer(room);
        return cfg.normalizeLimitSeconds(timer ? timer.limitSeconds : undefined, defaultLimitSeconds);
    }

    function createPausedTurnTimer(room: MatchTurnTimerRoom): Record<string, unknown> {
        return {
            limitSeconds: resolveLimitSeconds(room),
            active: false,
            turnSeatKey: cfg.resolveTurnSeatKey(room),
            turnStartedAt: null,
            turnDeadlineAt: null
        };
    }

    function createActiveTurnTimer(room: MatchTurnTimerRoom, nowMs: unknown): Record<string, unknown> {
        const startedAt = Number.isFinite(Number(nowMs)) ? Math.max(0, Math.trunc(Number(nowMs))) : now();
        const limitSeconds = resolveLimitSeconds(room);
        return {
            limitSeconds,
            active: true,
            turnSeatKey: cfg.resolveTurnSeatKey(room),
            turnStartedAt: startedAt,
            turnDeadlineAt: startedAt + (limitSeconds * 1000)
        };
    }

    function areTurnTimersEqual(leftValue: unknown, rightValue: unknown): boolean {
        const left = asRecord(leftValue);
        const right = asRecord(rightValue);
        return (
            !!left.active === !!right.active
            && (cfg.parseSeatKeyOptional(left.turnSeatKey) || 'black') === (cfg.parseSeatKeyOptional(right.turnSeatKey) || 'black')
            && finiteOrNull(left.turnStartedAt) === finiteOrNull(right.turnStartedAt)
            && finiteOrNull(left.turnDeadlineAt) === finiteOrNull(right.turnDeadlineAt)
            && Number(left.limitSeconds) === Number(right.limitSeconds)
        );
    }

    function toPublicTurnTimer(room: MatchTurnTimerRoom, nowMs: unknown): Record<string, unknown> {
        const timer = readTimer(room);
        const timerRecord = asRecord(timer);
        const serverNow = Number.isFinite(Number(nowMs)) ? Number(nowMs) : now();
        const deadline = timer ? finiteOrNull(timerRecord.turnDeadlineAt) : null;
        const startedAt = timer ? finiteOrNull(timerRecord.turnStartedAt) : null;
        const active = !!(timer && timerRecord.active === true && deadline !== null);
        return {
            limitSeconds: resolveLimitSeconds(room),
            active,
            turnSeatKey: cfg.parseSeatKeyOptional(timerRecord.turnSeatKey) || cfg.resolveTurnSeatKey(room),
            turnStartedAt: active ? startedAt : null,
            turnDeadlineAt: active ? deadline : null,
            remainingMs: active && deadline !== null ? Math.max(0, Math.trunc(deadline - serverNow)) : null
        };
    }

    // Mutates room.turnTimer: pauses it, keeps a running timer for the same seat (refreshing only its
    // limit), or restarts it for the current seat.
    function applyTurnTimerRefresh(room: any, options: MatchTurnTimerRefreshOptions): MatchTurnTimerRefreshResult {
        const opts = options || { shouldBeActive: false };
        if (!opts.shouldBeActive) {
            const pausedTimer = createPausedTurnTimer(room);
            const changed = !areTurnTimersEqual(room.turnTimer, pausedTimer);
            room.turnTimer = pausedTimer;
            return { changed, replaced: true };
        }

        const timer = readTimer(room);
        if (!opts.forceRestart && timer && timer.active === true) {
            const timerSeatKey = cfg.parseSeatKeyOptional(timer.turnSeatKey);
            if (timerSeatKey === cfg.resolveTurnSeatKey(room) && Number.isFinite(Number(timer.turnDeadlineAt))) {
                timer.limitSeconds = resolveLimitSeconds(room);
                return { changed: false, replaced: false };
            }
        }

        const nowMs = Number.isFinite(Number(opts.nowMs)) ? Math.max(0, Math.trunc(Number(opts.nowMs))) : now();
        const activeTimer = createActiveTurnTimer(room, nowMs);
        const changed = !areTurnTimersEqual(room.turnTimer, activeTimer);
        room.turnTimer = activeTimer;
        return { changed, replaced: true };
    }

    return {
        resolveLimitSeconds,
        createPausedTurnTimer,
        createActiveTurnTimer,
        areTurnTimersEqual,
        toPublicTurnTimer,
        applyTurnTimerRefresh
    };
}
