export {};

const RECENT_PLAYBACK_FLIP_SUPPRESS_MS = 2500;

function resolveTimestamp(now?: any): number {
    const timestamp = Number(now);
    return Number.isFinite(timestamp) ? Math.trunc(timestamp) : Date.now();
}

function markPlaybackFlippedDisc(disc: any, now?: any): boolean {
    if (!disc || !disc.dataset) return false;
    try {
        disc.dataset.playbackFlipAt = String(resolveTimestamp(now));
        return true;
    } catch (e: any) { /* ignore */ }
    return false;
}

function hasRecentPlaybackFlipMarker(disc: any, now?: any): boolean {
    if (!disc || !disc.dataset) return false;
    const raw = disc.dataset.playbackFlipAt;
    if (typeof raw !== 'string' || !raw.trim()) return false;
    const timestamp = Number(raw);
    if (!Number.isFinite(timestamp)) return false;
    return (resolveTimestamp(now) - timestamp) <= RECENT_PLAYBACK_FLIP_SUPPRESS_MS;
}

module.exports = {
    RECENT_PLAYBACK_FLIP_SUPPRESS_MS,
    markPlaybackFlippedDisc,
    hasRecentPlaybackFlipMarker
};
