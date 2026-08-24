import type { MatchWorkerRoomState } from './match-worker-types';

type MatchWorkerTurnTimerHelperConfig = {
    limitSeconds: number;
    resolveTurnSeatKey: (room: MatchWorkerRoomState | null | undefined) => string;
    parseSeatKeyOptional: (value: unknown) => string | null;
    asRecord: (value: unknown) => Record<string, unknown>;
    normalizeLimitSeconds?: (value: unknown, fallback?: unknown) => number;
    now?: () => number;
};

export function createMatchWorkerTurnTimerHelpers(config: MatchWorkerTurnTimerHelperConfig) {
    const cfg = (config && typeof config === 'object') ? config : {} as MatchWorkerTurnTimerHelperConfig;
    const now = typeof cfg.now === 'function' ? cfg.now : () => Date.now();
    const limitSeconds = Number.isFinite(Number(cfg.limitSeconds)) ? Math.max(0, Math.trunc(Number(cfg.limitSeconds))) : 120;

    function resolveLimitSeconds(room: MatchWorkerRoomState | null | undefined): number {
        const timer = room && room.turnTimer && typeof room.turnTimer === 'object'
            ? cfg.asRecord(room.turnTimer)
            : {};
        if (typeof cfg.normalizeLimitSeconds === 'function') {
            return cfg.normalizeLimitSeconds(timer.limitSeconds, limitSeconds);
        }
        const numeric = Number(timer.limitSeconds);
        return Number.isFinite(numeric) ? Math.max(0, Math.trunc(numeric)) : limitSeconds;
    }

    function createPausedTurnTimer(room: MatchWorkerRoomState | null | undefined): Record<string, unknown> {
        const roomLimitSeconds = resolveLimitSeconds(room);
        return {
            limitSeconds: roomLimitSeconds,
            active: false,
            turnSeatKey: cfg.resolveTurnSeatKey(room),
            turnStartedAt: null,
            turnDeadlineAt: null
        };
    }

    function createActiveTurnTimer(room: MatchWorkerRoomState | null | undefined, nowMs: unknown): Record<string, unknown> {
        const startedAt = Number.isFinite(Number(nowMs)) ? Math.max(0, Math.trunc(Number(nowMs))) : now();
        const roomLimitSeconds = resolveLimitSeconds(room);
        return {
            limitSeconds: roomLimitSeconds,
            active: true,
            turnSeatKey: cfg.resolveTurnSeatKey(room),
            turnStartedAt: startedAt,
            turnDeadlineAt: startedAt + (roomLimitSeconds * 1000)
        };
    }

    function areTurnTimersEqual(leftValue: unknown, rightValue: unknown): boolean {
        const left = cfg.asRecord(leftValue);
        const right = cfg.asRecord(rightValue);
        const leftSeat = cfg.parseSeatKeyOptional(left.turnSeatKey) || 'black';
        const rightSeat = cfg.parseSeatKeyOptional(right.turnSeatKey) || 'black';
        const leftStarted = Number.isFinite(Number(left.turnStartedAt)) ? Number(left.turnStartedAt) : null;
        const rightStarted = Number.isFinite(Number(right.turnStartedAt)) ? Number(right.turnStartedAt) : null;
        const leftDeadline = Number.isFinite(Number(left.turnDeadlineAt)) ? Number(left.turnDeadlineAt) : null;
        const rightDeadline = Number.isFinite(Number(right.turnDeadlineAt)) ? Number(right.turnDeadlineAt) : null;

        return (
            !!left.active === !!right.active
            && leftSeat === rightSeat
            && leftStarted === rightStarted
            && leftDeadline === rightDeadline
            && Number(left.limitSeconds) === Number(right.limitSeconds)
        );
    }

    function toPublicTurnTimer(room: MatchWorkerRoomState | null | undefined, nowMs: unknown): Record<string, unknown> {
        const timer = (room && room.turnTimer && typeof room.turnTimer === 'object') ? room.turnTimer : null;
        const timerRecord = cfg.asRecord(timer);
        const serverNow = Number.isFinite(Number(nowMs)) ? Number(nowMs) : now();
        const deadline = timer && Number.isFinite(Number(timerRecord.turnDeadlineAt)) ? Number(timerRecord.turnDeadlineAt) : null;
        const startedAt = timer && Number.isFinite(Number(timerRecord.turnStartedAt)) ? Number(timerRecord.turnStartedAt) : null;
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

    return {
        createPausedTurnTimer,
        createActiveTurnTimer,
        areTurnTimersEqual,
        toPublicTurnTimer
    };
}
