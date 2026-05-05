interface RandomSource {
    random(): number;
}

function normalizeLabel(label: unknown): string {
    const text = String(label || 'CardLogic').trim();
    return text || 'CardLogic';
}

function toRandomSource(randomLike: unknown): RandomSource | null {
    if (randomLike && typeof (randomLike as RandomSource).random === 'function') return randomLike as RandomSource;
    if (typeof randomLike === 'function') {
        return { random: randomLike as () => number };
    }
    return null;
}

function resolveRandomSource(randomLike: unknown, fallbackLike: unknown, label: unknown): RandomSource {
    const resolved = toRandomSource(randomLike) || toRandomSource(fallbackLike);
    if (resolved) return resolved;
    throw new Error(normalizeLabel(label) + ' requires an injected deterministic PRNG.');
}

function readRandomUnit(randomLike: unknown, fallbackLike: unknown, label: unknown): number {
    const randomSource = resolveRandomSource(randomLike, fallbackLike, label);
    const raw = Number(randomSource.random());
    if (!Number.isFinite(raw)) {
        throw new Error(normalizeLabel(label) + ' received a PRNG that returned a non-finite value.');
    }
    return Math.max(0, Math.min(0.999999, raw));
}

function resolveRandomIndex(length: number, randomLike: unknown, fallbackLike: unknown, label: unknown): number {
    if (!Number.isInteger(length) || length <= 0) return 0;
    return Math.floor(readRandomUnit(randomLike, fallbackLike, label) * length);
}

export = {
    resolveRandomSource,
    readRandomUnit,
    resolveRandomIndex
};
