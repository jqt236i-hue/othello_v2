/**
 * @file animation-helpers.ts
 * @description Wrapper around ui/animation-shared that provides normalized, safe fallbacks
 */
interface TimerRegistry {
    setTimeout: (fn: () => void, ms: number) => number;
    clearTimeout: (id: number) => void;
    clearAll: () => void;
    pendingCount: () => number;
    newScope: () => null;
    clearScope: () => void;
}
declare function isNoAnim(): boolean;
declare function getTimer(): TimerRegistry;
declare function triggerFlip(disc: Element | null | undefined): void;
declare function removeFlip(disc: Element | null | undefined): void;
declare const _default: {
    isNoAnim: typeof isNoAnim;
    getTimer: typeof getTimer;
    triggerFlip: typeof triggerFlip;
    removeFlip: typeof removeFlip;
};
export = _default;
//# sourceMappingURL=animation-helpers.d.ts.map