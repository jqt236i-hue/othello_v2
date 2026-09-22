// Cue boundaries measured from the supplied 120 BPM sound effect, starting at t=0.
export const REINCARNATION_ROULETTE_DELAYS_MS = Object.freeze([
    62.5, 62.5, 62.5, 62.5, 62.5, 62.5, 62.5, 62.5,
    125, 125, 125, 125, 125, 125, 125,
    250, 250, 250, 250, 125
]);
export const REINCARNATION_CONFIRM_MS = 2500;
export const REINCARNATION_SETTLE_MS = 1800;

export function reincarnationStepAt(elapsedMs: number): number {
    let boundary = 0;
    for (let i = 0; i < REINCARNATION_ROULETTE_DELAYS_MS.length; i++) {
        boundary += REINCARNATION_ROULETTE_DELAYS_MS[i];
        if (elapsedMs < boundary) return i;
    }
    return REINCARNATION_ROULETTE_DELAYS_MS.length;
}
