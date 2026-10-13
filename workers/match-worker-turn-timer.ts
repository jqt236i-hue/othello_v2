import type { MatchWorkerRoomState } from './match-worker-types';
import { createMatchTurnTimerRules } from '../utils/match-turn-timer-rules';

type MatchWorkerTurnTimerHelperConfig = {
    limitSeconds: number;
    resolveTurnSeatKey: (room: MatchWorkerRoomState | null | undefined) => string;
    parseSeatKeyOptional: (value: unknown) => string | null;
    asRecord: (value: unknown) => Record<string, unknown>;
    normalizeLimitSeconds?: (value: unknown, fallback?: unknown) => number;
    now?: () => number;
};

// Worker adapter over the shared turn-timer rules (utils/match-turn-timer-rules.ts).
export function createMatchWorkerTurnTimerHelpers(config: MatchWorkerTurnTimerHelperConfig) {
    const cfg = (config && typeof config === 'object') ? config : {} as MatchWorkerTurnTimerHelperConfig;
    const limitSeconds = Number.isFinite(Number(cfg.limitSeconds)) ? Math.max(0, Math.trunc(Number(cfg.limitSeconds))) : 120;
    const normalizeLimitSeconds = typeof cfg.normalizeLimitSeconds === 'function'
        ? cfg.normalizeLimitSeconds
        : (value: unknown, fallback?: unknown) => {
            const numeric = Number(value);
            return Number.isFinite(numeric) ? Math.max(0, Math.trunc(numeric)) : Number(fallback);
        };
    const rules = createMatchTurnTimerRules({
        defaultLimitSeconds: limitSeconds,
        normalizeLimitSeconds,
        resolveTurnSeatKey: cfg.resolveTurnSeatKey,
        parseSeatKeyOptional: cfg.parseSeatKeyOptional,
        now: cfg.now
    });

    return {
        createPausedTurnTimer: rules.createPausedTurnTimer,
        createActiveTurnTimer: rules.createActiveTurnTimer,
        areTurnTimersEqual: rules.areTurnTimersEqual,
        toPublicTurnTimer: rules.toPublicTurnTimer,
        applyTurnTimerRefresh: rules.applyTurnTimerRefresh
    };
}
