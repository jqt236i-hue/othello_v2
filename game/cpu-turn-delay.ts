export type CpuTurnDelayPlayerKey = 'black' | 'white';

export type CpuTurnDelayRequest = Readonly<{
    playerKey: CpuTurnDelayPlayerKey;
    decisionLevel: number | null;
    explicitDelayMs?: number | null;
    defaultDelayMs?: number;
}>;

export const DEFAULT_CPU_TURN_DELAY_MS = 200;

function normalizeDelayMs(value: unknown, fallback: number): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.max(0, Math.trunc(numeric));
}

/**
 * Resolves only the delay before a CPU handoff. Lv6 minimum-think and
 * animation/pending retry delays remain owned by their existing policies.
 */
export function resolveCpuTurnDelayMs(request: CpuTurnDelayRequest): number {
    const input = request && typeof request === 'object'
        ? request
        : {} as CpuTurnDelayRequest;
    const fallbackDelayMs = normalizeDelayMs(
        input.defaultDelayMs,
        DEFAULT_CPU_TURN_DELAY_MS
    );
    const hasExplicitDelay = input.explicitDelayMs !== null
        && typeof input.explicitDelayMs !== 'undefined';
    const explicitDelay = Number(input.explicitDelayMs);
    if (hasExplicitDelay && Number.isFinite(explicitDelay)) {
        return normalizeDelayMs(explicitDelay, fallbackDelayMs);
    }
    const decisionLevel = Number(input.decisionLevel);
    if (Number.isFinite(decisionLevel) && Math.trunc(decisionLevel) === 1) {
        return 0;
    }
    return fallbackDelayMs;
}

module.exports = {
    DEFAULT_CPU_TURN_DELAY_MS,
    resolveCpuTurnDelayMs
};
