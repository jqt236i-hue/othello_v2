/**
 * @file action-log.ts
 * @description UI-side storage adapter for ActionManager.
 */
declare function save(key: string, payload: unknown): boolean;
declare function load(key: string): string | null;
declare function clear(key: string): boolean;
declare const _default: {
    save: typeof save;
    load: typeof load;
    clear: typeof clear;
};
export = _default;
//# sourceMappingURL=action-log.d.ts.map