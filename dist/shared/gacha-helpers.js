"use strict";
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    }
    else {
        root.GachaHelpersModule = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';
    const CONFIGURED_RARITIES = Object.freeze(['EXR', 'UR', 'SSR', 'SR', 'R', 'N']);
    const RARITY_WEIGHTS = Object.freeze({
        EXR: 1,
        UR: 60,
        SSR: 239,
        SR: 1200,
        R: 3500,
        N: 5000
    });
    const OBSERVATION_STONE_PULL_COST = 100;
    const OBSERVATION_STONE_TEN_PULL_COST = 1000;
    const OBSERVATION_STONE_REWARD_BASE = 100;
    const OBSERVATION_STONE_REWARD_BONUS_MIN = 100;
    const OBSERVATION_STONE_REWARD_BONUS_MAX = 3000;
    const OBSERVATION_STONE_REWARD_BONUS_STEP = 10;
    function clampRandom(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric))
            return 0;
        if (numeric <= 0)
            return 0;
        if (numeric >= 1)
            return 0.999999999999;
        return numeric;
    }
    function resolveRandomValue(randomFn) {
        try {
            const fn = (typeof randomFn === 'function') ? randomFn : Math.random;
            return clampRandom(fn());
        }
        catch (e) {
            return 0;
        }
    }
    function normalizeRarity(value) {
        const normalized = String(value || '').trim().toUpperCase();
        return CONFIGURED_RARITIES.includes(normalized) ? normalized : null;
    }
    function summarizeRarityAvailability(items) {
        const counts = {};
        CONFIGURED_RARITIES.forEach((rarity) => {
            counts[rarity] = 0;
        });
        const safeItems = Array.isArray(items) ? items : [];
        safeItems.forEach((item) => {
            const rarity = normalizeRarity(item && typeof item === 'object' ? item.rarity : null);
            if (!rarity)
                return;
            counts[rarity] += 1;
        });
        const availableRarities = CONFIGURED_RARITIES.filter((rarity) => counts[rarity] > 0);
        const missingRarities = CONFIGURED_RARITIES.filter((rarity) => counts[rarity] <= 0);
        return {
            counts,
            totalItems: safeItems.length,
            availableRarities,
            missingRarities,
            configuredRarities: CONFIGURED_RARITIES.slice()
        };
    }
    function pickWeightedValue(entries, randomFn) {
        const safeEntries = Array.isArray(entries)
            ? entries.filter((entry) => entry && Number(entry.weight) > 0)
            : [];
        if (!safeEntries.length)
            return null;
        const totalWeight = safeEntries.reduce((sum, entry) => sum + Number(entry.weight), 0);
        if (!(totalWeight > 0))
            return null;
        const target = resolveRandomValue(randomFn) * totalWeight;
        let cumulative = 0;
        for (const entry of safeEntries) {
            cumulative += Number(entry.weight);
            if (target < cumulative)
                return entry.value;
        }
        return safeEntries[safeEntries.length - 1].value;
    }
    function rollGachaRarity(options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const summary = opts.summary || summarizeRarityAvailability(opts.items);
        const availableRarities = Array.isArray(opts.availableRarities)
            ? opts.availableRarities.map((rarity) => normalizeRarity(rarity)).filter(Boolean)
            : summary.availableRarities;
        const uniqueAvailableRarities = Array.from(new Set(availableRarities));
        if (!uniqueAvailableRarities.length)
            return null;
        const weightedEntries = uniqueAvailableRarities.map((rarity) => ({
            value: rarity,
            weight: RARITY_WEIGHTS[rarity] || 0
        }));
        return pickWeightedValue(weightedEntries, opts.randomFn);
    }
    function selectCatalogItemByRarity(items, rarity, randomFn) {
        const normalizedRarity = normalizeRarity(rarity);
        if (!normalizedRarity)
            return null;
        const matches = (Array.isArray(items) ? items : []).filter((item) => normalizeRarity(item && typeof item === 'object' ? item.rarity : null) === normalizedRarity);
        if (!matches.length)
            return null;
        const index = Math.floor(resolveRandomValue(randomFn) * matches.length);
        return matches[Math.min(index, matches.length - 1)] || null;
    }
    function rollObservationGacha(items, options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const summary = summarizeRarityAvailability(items);
        const rarity = rollGachaRarity({
            summary,
            items,
            randomFn: opts.randomFn
        });
        if (!rarity)
            return null;
        const item = selectCatalogItemByRarity(items, rarity, opts.randomFn);
        if (!item)
            return null;
        return {
            rarity,
            item,
            summary
        };
    }
    function rollHandGacha(items, options) {
        return rollObservationGacha(items, options);
    }
    function normalizePositiveInteger(value, fallback) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric))
            return Math.max(1, Math.floor(Number(fallback) || 1));
        return Math.max(1, Math.floor(numeric));
    }
    function getObservationBonusStepCount(minBonus, maxBonus, bonusStep) {
        const minValue = Math.max(0, Math.floor(Number(minBonus) || 0));
        const maxValue = Math.max(minValue, Math.floor(Number(maxBonus) || 0));
        const stepValue = normalizePositiveInteger(bonusStep, OBSERVATION_STONE_REWARD_BONUS_STEP);
        return Math.floor((maxValue - minValue) / stepValue);
    }
    function getObservationBonusTotalWeight(minBonus, maxBonus, bonusStep) {
        const stepCount = getObservationBonusStepCount(minBonus, maxBonus, bonusStep);
        return ((stepCount + 1) * (stepCount + 2)) / 2;
    }
    function rollObservationBonus(randomFn) {
        const minBonus = OBSERVATION_STONE_REWARD_BONUS_MIN;
        const maxBonus = OBSERVATION_STONE_REWARD_BONUS_MAX;
        const bonusStep = normalizePositiveInteger(OBSERVATION_STONE_REWARD_BONUS_STEP, OBSERVATION_STONE_REWARD_BONUS_STEP);
        const stepCount = getObservationBonusStepCount(minBonus, maxBonus, bonusStep);
        const totalWeight = getObservationBonusTotalWeight(minBonus, maxBonus, bonusStep);
        let cumulative = 0;
        const target = Math.floor(resolveRandomValue(randomFn) * totalWeight);
        for (let stepIndex = 0; stepIndex <= stepCount; stepIndex += 1) {
            cumulative += (stepCount + 1) - stepIndex;
            if (target < cumulative)
                return minBonus + (stepIndex * bonusStep);
        }
        return minBonus + (stepCount * bonusStep);
    }
    function formatRateBasisPoints(rateBasisPoints) {
        const numeric = Number(rateBasisPoints);
        if (!Number.isFinite(numeric))
            return '0.00%';
        return `${(numeric / 100).toFixed(2)}%`;
    }
    function computeEffectiveRarityRates(summary) {
        const state = summary || summarizeRarityAvailability([]);
        const availableRarities = Array.isArray(state.availableRarities) ? state.availableRarities : [];
        const effectiveTotalWeight = availableRarities.reduce((sum, rarity) => sum + (RARITY_WEIGHTS[rarity] || 0), 0);
        return CONFIGURED_RARITIES.map((rarity) => {
            const configuredRateBasisPoints = RARITY_WEIGHTS[rarity] || 0;
            const itemCount = state.counts && Number.isFinite(Number(state.counts[rarity]))
                ? Math.max(0, Math.floor(Number(state.counts[rarity])))
                : 0;
            const available = itemCount > 0;
            const effectiveRateBasisPoints = available && effectiveTotalWeight > 0
                ? (configuredRateBasisPoints * 10000) / effectiveTotalWeight
                : 0;
            return {
                rarity,
                itemCount,
                available,
                configuredRateBasisPoints,
                effectiveRateBasisPoints
            };
        });
    }
    return Object.freeze({
        CONFIGURED_RARITIES,
        RARITY_WEIGHTS,
        OBSERVATION_STONE_PULL_COST,
        OBSERVATION_STONE_TEN_PULL_COST,
        OBSERVATION_STONE_REWARD_BASE,
        OBSERVATION_STONE_REWARD_BONUS_MIN,
        OBSERVATION_STONE_REWARD_BONUS_MAX,
        OBSERVATION_STONE_REWARD_BONUS_STEP,
        normalizeRarity,
        summarizeRarityAvailability,
        rollGachaRarity,
        selectCatalogItemByRarity,
        rollObservationGacha,
        rollHandGacha,
        getObservationBonusTotalWeight,
        rollObservationBonus,
        formatRateBasisPoints,
        computeEffectiveRarityRates
    });
}));
//# sourceMappingURL=gacha-helpers.js.map