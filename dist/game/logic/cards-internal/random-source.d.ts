interface RandomSource {
    random(): number;
}
declare function resolveRandomSource(randomLike: unknown, fallbackLike: unknown, label: unknown): RandomSource;
declare function readRandomUnit(randomLike: unknown, fallbackLike: unknown, label: unknown): number;
declare function resolveRandomIndex(length: number, randomLike: unknown, fallbackLike: unknown, label: unknown): number;
declare const _default: {
    resolveRandomSource: typeof resolveRandomSource;
    readRandomUnit: typeof readRandomUnit;
    resolveRandomIndex: typeof resolveRandomIndex;
};
export = _default;
//# sourceMappingURL=random-source.d.ts.map