function resolveDeterministicPrng(prng: any, deps: any, label: string, randomSourceModule: any): any {
    const fallback = deps && deps.defaultPrng;
    if (randomSourceModule && typeof randomSourceModule.resolveRandomSource === 'function') {
        return randomSourceModule.resolveRandomSource(prng, fallback, label);
    }
    if (prng && typeof prng.random === 'function') return prng;
    if (fallback && typeof fallback.random === 'function') return fallback;
    throw new Error(`${String(label || 'CardHyperactive').trim() || 'CardHyperactive'} requires an injected deterministic PRNG.`);
}

function toCounterOrNull(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.trunc(n));
}

function compactPresentationMeta(meta: any): any {
    if (!meta || typeof meta !== 'object') return undefined;
    const out: any = {};
    for (const [key, value] of Object.entries(meta)) {
        if (value !== null && value !== undefined) out[key] = value;
    }
    return Object.keys(out).length ? out : undefined;
}

export = {
    resolveDeterministicPrng,
    toCounterOrNull,
    compactPresentationMeta
};
