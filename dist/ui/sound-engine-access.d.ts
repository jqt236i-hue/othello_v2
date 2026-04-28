/**
 * @file sound-engine-access.ts
 * @description Safe accessor for SoundEngine
 */
interface SoundEngine {
    allowBgmPlay?: boolean;
    bgm?: {
        paused?: boolean;
    };
}
interface RootRef {
    SoundEngine?: SoundEngine;
}
declare function resolveSoundEngine(rootRef: RootRef | null | undefined): SoundEngine | null;
declare function isBgmPlaying(engine: SoundEngine | null | undefined): boolean;
declare const _default: {
    resolveSoundEngine: typeof resolveSoundEngine;
    isBgmPlaying: typeof isBgmPlaying;
};
export = _default;
//# sourceMappingURL=sound-engine-access.d.ts.map