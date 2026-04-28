"use strict";
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
function normalizeSeedNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}
function normalizeSeedCount(seedCount) {
    const numeric = Number(seedCount);
    if (!Number.isFinite(numeric))
        return 0;
    return Math.max(0, Math.floor(numeric));
}
function normalizeSeedStride(seedStride) {
    const numeric = Number(seedStride);
    if (!Number.isFinite(numeric))
        return 1;
    return Math.max(1, Math.floor(numeric));
}
function sanitizeSeedList(seedList) {
    if (!Array.isArray(seedList))
        return [];
    const out = [];
    const seen = new Set();
    for (const value of seedList) {
        const numeric = normalizeSeedNumber(value);
        if (!Number.isFinite(numeric))
            continue;
        const key = String(numeric);
        if (seen.has(key))
            continue;
        seen.add(key);
        out.push(numeric);
    }
    return out;
}
function buildSeedList(baseSeed, seedCount, seedStride) {
    const normalizedBaseSeed = normalizeSeedNumber(baseSeed);
    const normalizedSeedCount = normalizeSeedCount(seedCount);
    const normalizedSeedStride = normalizeSeedStride(seedStride);
    const out = [];
    if (!Number.isFinite(normalizedBaseSeed))
        return out;
    for (let index = 0; index < normalizedSeedCount; index += 1) {
        out.push(normalizedBaseSeed + (index * normalizedSeedStride));
    }
    return out;
}
function buildSeedSchedule(baseSeed, seedCount, seedStride, completedSeeds) {
    return {
        baseSeed: normalizeSeedNumber(baseSeed),
        seedCount: normalizeSeedCount(seedCount),
        seedStride: normalizeSeedStride(seedStride),
        scheduledSeeds: buildSeedList(baseSeed, seedCount, seedStride),
        completedSeeds: sanitizeSeedList(completedSeeds)
    };
}
module.exports = {
    sanitizeSeedList,
    buildSeedList,
    buildSeedSchedule
};
//# sourceMappingURL=policy-seed-utils.js.map