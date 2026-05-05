(function (root: any, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.GachaHelpersModule = factory();
    }
}(typeof self !== 'undefined' ? self : this as Record<string, unknown>, function () {
    'use strict';

    interface RarityWeights {
        [key: string]: number;
    }

    interface RaritySummary {
        counts: Record<string, number>;
        totalItems: number;
        availableRarities: string[];
        missingRarities: string[];
        configuredRarities: string[];
    }

    interface WeightedEntry {
        value: string;
        weight: number;
    }

    interface GachaResult {
        rarity: string;
        item: unknown;
        summary: RaritySummary;
    }

    interface RarityRateInfo {
        rarity: string;
        itemCount: number;
        available: boolean;
        configuredRateBasisPoints: number;
        effectiveRateBasisPoints: number;
    }

    const CONFIGURED_RARITIES: readonly string[] = Object.freeze(['EXR', 'UR', 'SSR', 'SR', 'R', 'N']);
    const RARITY_WEIGHTS: Readonly<RarityWeights> = Object.freeze({
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

    function clampRandom(value: unknown): number {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return 0;
        if (numeric <= 0) return 0;
        if (numeric >= 1) return 0.999999999999;
        return numeric;
    }

    function resolveRandomValue(randomFn: unknown): number {
        try {
            const fn = (typeof randomFn === 'function') ? randomFn as () => number : Math.random;
            return clampRandom(fn());
        } catch (e) {
            return 0;
        }
    }

    function normalizeRarity(value: unknown): string | null {
        const normalized = String(value || '').trim().toUpperCase();
        return CONFIGURED_RARITIES.includes(normalized) ? normalized : null;
    }

    function summarizeRarityAvailability(items: unknown[]): RaritySummary {
        const counts: Record<string, number> = {};
        CONFIGURED_RARITIES.forEach((rarity) => {
            counts[rarity] = 0;
        });

        const safeItems = Array.isArray(items) ? items : [];
        safeItems.forEach((item) => {
            const rarity = normalizeRarity(item && typeof item === 'object' ? (item as Record<string, unknown>).rarity : null);
            if (!rarity) return;
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

    function pickWeightedValue(entries: WeightedEntry[], randomFn: unknown): string | null {
        const safeEntries = Array.isArray(entries)
            ? entries.filter((entry) => entry && Number(entry.weight) > 0)
            : [];
        if (!safeEntries.length) return null;

        const totalWeight = safeEntries.reduce((sum, entry) => sum + Number(entry.weight), 0);
        if (!(totalWeight > 0)) return null;

        const target = resolveRandomValue(randomFn) * totalWeight;
        let cumulative = 0;
        for (const entry of safeEntries) {
            cumulative += Number(entry.weight);
            if (target < cumulative) return entry.value;
        }
        return safeEntries[safeEntries.length - 1].value;
    }

    function rollGachaRarity(options: unknown): string | null {
        const opts = (options && typeof options === 'object') ? options as Record<string, unknown> : {};
        const summary = (opts.summary as RaritySummary) || summarizeRarityAvailability(opts.items as unknown[]);
        const availableRarities = Array.isArray(opts.availableRarities)
            ? (opts.availableRarities as unknown[]).map((rarity) => normalizeRarity(rarity)).filter(Boolean) as string[]
            : summary.availableRarities;
        const uniqueAvailableRarities = Array.from(new Set(availableRarities));
        if (!uniqueAvailableRarities.length) return null;

        const weightedEntries = uniqueAvailableRarities.map((rarity) => ({
            value: rarity,
            weight: RARITY_WEIGHTS[rarity] || 0
        }));
        return pickWeightedValue(weightedEntries, opts.randomFn);
    }

    function selectCatalogItemByRarity(items: unknown[], rarity: unknown, randomFn: unknown): unknown | null {
        const normalizedRarity = normalizeRarity(rarity);
        if (!normalizedRarity) return null;

        const matches = (Array.isArray(items) ? items : []).filter((item) => normalizeRarity(item && typeof item === 'object' ? (item as Record<string, unknown>).rarity : null) === normalizedRarity);
        if (!matches.length) return null;

        const index = Math.floor(resolveRandomValue(randomFn) * matches.length);
        return matches[Math.min(index, matches.length - 1)] || null;
    }

    function rollObservationGacha(items: unknown[], options: unknown): GachaResult | null {
        const opts = (options && typeof options === 'object') ? options as Record<string, unknown> : {};
        const summary = summarizeRarityAvailability(items);
        const rarity = rollGachaRarity({
            summary,
            items,
            randomFn: opts.randomFn
        });
        if (!rarity) return null;

        const item = selectCatalogItemByRarity(items, rarity, opts.randomFn);
        if (!item) return null;

        return {
            rarity,
            item,
            summary
        };
    }

    function rollHandGacha(items: unknown[], options: unknown): GachaResult | null {
        return rollObservationGacha(items, options);
    }

    function normalizePositiveInteger(value: unknown, fallback: unknown): number {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return Math.max(1, Math.floor(Number(fallback) || 1));
        return Math.max(1, Math.floor(numeric));
    }

    function getObservationBonusStepCount(minBonus: unknown, maxBonus: unknown, bonusStep: unknown): number {
        const minValue = Math.max(0, Math.floor(Number(minBonus) || 0));
        const maxValue = Math.max(minValue, Math.floor(Number(maxBonus) || 0));
        const stepValue = normalizePositiveInteger(bonusStep, OBSERVATION_STONE_REWARD_BONUS_STEP);
        return Math.floor((maxValue - minValue) / stepValue);
    }

    function getObservationBonusTotalWeight(minBonus: unknown, maxBonus: unknown, bonusStep: unknown): number {
        const stepCount = getObservationBonusStepCount(minBonus, maxBonus, bonusStep);
        return ((stepCount + 1) * (stepCount + 2)) / 2;
    }

    function rollObservationBonus(randomFn: unknown): number {
        const minBonus = OBSERVATION_STONE_REWARD_BONUS_MIN;
        const maxBonus = OBSERVATION_STONE_REWARD_BONUS_MAX;
        const bonusStep = normalizePositiveInteger(
            OBSERVATION_STONE_REWARD_BONUS_STEP,
            OBSERVATION_STONE_REWARD_BONUS_STEP
        );
        const stepCount = getObservationBonusStepCount(minBonus, maxBonus, bonusStep);
        const totalWeight = getObservationBonusTotalWeight(minBonus, maxBonus, bonusStep);
        let cumulative = 0;
        const target = Math.floor(resolveRandomValue(randomFn) * totalWeight);

        for (let stepIndex = 0; stepIndex <= stepCount; stepIndex += 1) {
            cumulative += (stepCount + 1) - stepIndex;
            if (target < cumulative) return minBonus + (stepIndex * bonusStep);
        }
        return minBonus + (stepCount * bonusStep);
    }

    function formatRateBasisPoints(rateBasisPoints: unknown): string {
        const numeric = Number(rateBasisPoints);
        if (!Number.isFinite(numeric)) return '0.00%';
        return `${(numeric / 100).toFixed(2)}%`;
    }

    function computeEffectiveRarityRates(summary: unknown): RarityRateInfo[] {
        const state = summary || summarizeRarityAvailability([]);
        const availableRarities = Array.isArray((state as RaritySummary).availableRarities) ? (state as RaritySummary).availableRarities : [];
        const effectiveTotalWeight = availableRarities.reduce((sum, rarity) => sum + (RARITY_WEIGHTS[rarity] || 0), 0);

        return CONFIGURED_RARITIES.map((rarity) => {
            const configuredRateBasisPoints = RARITY_WEIGHTS[rarity] || 0;
            const itemCount = (state as RaritySummary).counts && Number.isFinite(Number((state as RaritySummary).counts[rarity]))
                ? Math.max(0, Math.floor(Number((state as RaritySummary).counts[rarity])))
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
