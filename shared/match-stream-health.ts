/** Transport liveness is not a game event and must never advance the replay cursor. */
export const MATCH_STREAM_PING = 'match-stream-ping-v1';
export const MATCH_STREAM_HEALTH_TYPE = 'match-stream-health-v1';
export const MATCH_STREAM_PING_INTERVAL_MS = 10000;

export function buildMatchStreamHealth(stateVersion: unknown): string {
    return JSON.stringify({
        type: MATCH_STREAM_HEALTH_TYPE,
        stateVersion: Number.isFinite(Number(stateVersion)) ? Number(stateVersion) : null
    });
}
