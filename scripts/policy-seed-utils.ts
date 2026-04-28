declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

function normalizeSeedNumber(value: any): number | null {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}

function normalizeSeedCount(seedCount: any): number {
    const numeric = Number(seedCount);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.floor(numeric));
}

function normalizeSeedStride(seedStride: any): number {
    const numeric = Number(seedStride);
    if (!Number.isFinite(numeric)) return 1;
    return Math.max(1, Math.floor(numeric));
}

function sanitizeSeedList(seedList: any[]): number[] {
    if (!Array.isArray(seedList)) return [];
    const out: number[] = [];
    const seen = new Set<string>();
    for (const value of seedList) {
        const numeric = normalizeSeedNumber(value);
        if (!Number.isFinite(numeric as number)) continue;
        const key = String(numeric);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(numeric as number);
    }
    return out;
}

function buildSeedList(baseSeed: any, seedCount: any, seedStride: any): number[] {
    const normalizedBaseSeed = normalizeSeedNumber(baseSeed);
    const normalizedSeedCount = normalizeSeedCount(seedCount);
    const normalizedSeedStride = normalizeSeedStride(seedStride);
    const out: number[] = [];
    if (!Number.isFinite(normalizedBaseSeed as number)) return out;
    for (let index = 0; index < normalizedSeedCount; index += 1) {
        out.push((normalizedBaseSeed as number) + (index * normalizedSeedStride));
    }
    return out;
}

interface SeedSchedule {
    baseSeed: number | null;
    seedCount: number;
    seedStride: number;
    scheduledSeeds: number[];
    completedSeeds: number[];
}

function buildSeedSchedule(baseSeed: any, seedCount: any, seedStride: any, completedSeeds: any[]): SeedSchedule {
    return {
        baseSeed: normalizeSeedNumber(baseSeed),
        seedCount: normalizeSeedCount(seedCount),
        seedStride: normalizeSeedStride(seedStride),
        scheduledSeeds: buildSeedList(baseSeed, seedCount, seedStride),
        completedSeeds: sanitizeSeedList(completedSeeds)
    };
}

export = { 
    sanitizeSeedList,
    buildSeedList,
    buildSeedSchedule
 } as any;
