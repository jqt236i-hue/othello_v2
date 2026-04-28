/**
 * ui/animation-shared.ts
 * 共通アニメーションユーティリティ（UI専用）
 * 目的: _isNoAnim / Timer / Flip トリガー等の重複を集約する
 */
interface TimerRegistry {
    setTimeout: (fn: () => void, ms: number) => number;
    clearTimeout: (id: number) => void;
    clearAll: () => void;
    pendingCount: () => number;
    newScope: () => null;
    clearScope: () => void;
}
declare const TimerRegistry: unknown;
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
//# sourceMappingURL=animation-shared.d.ts.map