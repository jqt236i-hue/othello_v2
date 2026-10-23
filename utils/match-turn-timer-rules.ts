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
    /** Adapter hint; accepted inputs within the same canonical turn do not replenish its timer. */
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

    function resolveTurnIdentity(room: MatchTurnTimerRoom): string {
        const roomRecord = asRecord(room);
        const snapshot = asRecord(roomRecord.snapshot);
        const gameState = asRecord(snapshot.gameState);
        const cardState = asRecord(snapshot.cardState);
        const counter = (value: unknown) => value !== null && typeof value !== 'undefined' && Number.isFinite(Number(value))
            ? Math.trunc(Number(value)) : null;
        // room.seed is replaced on reset_game/rematch, unlike the per-match counters which
        // return to their opening values. stateVersion changes for card/selection inputs too.
        return JSON.stringify([counter(roomRecord.seed), counter(gameState.turnNumber), counter(cardState.turnIndex)]);
    }

    function createActiveTurnTimer(room: MatchTurnTimerRoom, nowMs: unknown): Record<string, unknown> {
        const startedAt = Number.isFinite(Number(nowMs)) ? Math.max(0, Math.trunc(Number(nowMs))) : now();
        const limitSeconds = resolveLimitSeconds(room);
        return {
            limitSeconds,
            active: true,
            turnSeatKey: cfg.resolveTurnSeatKey(room),
            turnStartedAt: startedAt,
            turnDeadlineAt: startedAt + (limitSeconds * 1000),
            turnIdentity: resolveTurnIdentity(room)
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
            && left.turnIdentity === right.turnIdentity
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

    // Keep the deadline within one canonical turn. A new turn gets a full allowance even
    // when its owner is unchanged (opponent pass/time stop), as does a new match seed.
    function applyTurnTimerRefresh(room: any, options: MatchTurnTimerRefreshOptions): MatchTurnTimerRefreshResult {
        const opts = options || { shouldBeActive: false };
        if (!opts.shouldBeActive) {
            const pausedTimer = createPausedTurnTimer(room);
            const changed = !areTurnTimersEqual(room.turnTimer, pausedTimer);
            room.turnTimer = pausedTimer;
            return { changed, replaced: true };
        }

        const timer = readTimer(room);
        // Publish adapters request forceRestart for card use and pending selections too.
        // Compare the saved turn identity, not that broad hint or the seat alone.
        if (timer && timer.active === true) {
            const timerSeatKey = cfg.parseSeatKeyOptional(timer.turnSeatKey);
            const turnIdentity = resolveTurnIdentity(room);
            const legacyTimer = typeof timer.turnIdentity !== 'string';
            if (timerSeatKey === cfg.resolveTurnSeatKey(room)
                && (legacyTimer || timer.turnIdentity === turnIdentity)
                && timer.turnDeadlineAt !== null && typeof timer.turnDeadlineAt !== 'undefined'
                && Number.isFinite(Number(timer.turnDeadlineAt))) {
                timer.limitSeconds = resolveLimitSeconds(room);
                // Adopt persisted timers created before turnIdentity existed without granting
                // extra time. The pre-command refresh adopts before applying input; the next
                // ordinary room save persists it. Public timing has not changed.
                if (legacyTimer) timer.turnIdentity = turnIdentity;
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
