interface ModuleResolverOptions {
    isValid?(value: unknown): boolean;
    label?: string;
    globalName?: string;
    requirePath?: string;
    requireFn?(path: string): unknown;
    readLocal?(): unknown;
    required?: boolean;
}
declare function resolveModule(options: ModuleResolverOptions): unknown;
declare const _default: {
    resolveModule: typeof resolveModule;
};
export = _default;
//# sourceMappingURL=module-resolver.d.ts.map