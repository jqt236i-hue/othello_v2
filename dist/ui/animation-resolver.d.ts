interface TimerRegistry {
    setTimeout: (fn: () => void, ms: number) => number;
    clearTimeout: (id: number) => void;
    clearAll: () => void;
    pendingCount: () => number;
    newScope: () => null;
    clearScope: () => void;
}
interface AnimationShared {
    isNoAnim?: () => boolean;
    getTimer?: () => TimerRegistry;
    triggerFlip?: (disc: Element) => void;
    removeFlip?: (disc: Element) => void;
}
declare function getRoot(): Window;
declare function resolveGlobal(name: string): unknown;
declare function resolveModule(modulePath: string): unknown;
declare function resolveModuleOrGlobal(modulePath: string, globalName: string): unknown;
declare function resolveExport(modulePath: string, globalName: string, exportName: string | null): unknown;
declare function resolveMethod(modulePath: string, globalName: string, methodName: string): ((...args: unknown[]) => unknown) | null;
declare function getAnimationShared(): AnimationShared | null;
declare function isNoAnim(): () => boolean;
declare function getTimer(): TimerRegistry;
declare const _default: {
    getRoot: typeof getRoot;
    resolveGlobal: typeof resolveGlobal;
    resolveModule: typeof resolveModule;
    resolveModuleOrGlobal: typeof resolveModuleOrGlobal;
    resolveExport: typeof resolveExport;
    resolveMethod: typeof resolveMethod;
    getAnimationShared: typeof getAnimationShared;
    isNoAnim: typeof isNoAnim;
    getTimer: typeof getTimer;
};
export = _default;
//# sourceMappingURL=animation-resolver.d.ts.map