#!/usr/bin/env node
// @ts-nocheck
'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

/**
 * Analyze selfplay destroy-cycle behavior over 20 games
 */

const SelfplayRunner = _require('./src/engine/selfplay-runner');
const CardLogic = _require('./game/logic/cards');
const SharedConstants = _require('./shared-constants');

// Run selfplay with specified settings
const options = {
    games: 20,
    baseSeed: 1,
    maxPlies: 220,
    allowCardUsage: true,
    cardUsageRate: 0.35,
    schemaVersion: SelfplayRunner.SELFPLAY_SCHEMA_VERSION
};

// Suppress stderr for cleaner output
const result = SelfplayRunner.runSelfPlayGames(options);

// Filter records with destroyCardId
const destroyRecords = result.records.filter((r: any) => r && r.destroyCardId);

// Build cardType map for all cards
const cardTypeMap: Record<string, string> = {};
try {
    const CARD_TYPE_BY_ID = SharedConstants.CARD_TYPE_BY_ID || {};
    Object.assign(cardTypeMap, CARD_TYPE_BY_ID);
} catch (e) {
    console.error('Warning: Could not load CARD_TYPE_BY_ID');
}

// Aggregate by destroyed card type
const aggregateMap: Record<string, any> = {};

for (const record of destroyRecords) {
    const cardId = record.destroyCardId;
    const cardType = cardTypeMap[cardId] || 'UNKNOWN';

    if (!aggregateMap[cardType]) {
        aggregateMap[cardType] = {
            cardType,
            count: 0,
            futureDiscDelta3PlySum: 0,
            negativeCount: 0,
            usableDestroyCount: 0,
            records: []
        };
    }

    const agg = aggregateMap[cardType];
    agg.count += 1;

    const futureDiscDelta3Ply = Number(record.futureDiscDelta3Ply || 0);
    agg.futureDiscDelta3PlySum += futureDiscDelta3Ply;

    if (futureDiscDelta3Ply < 0) {
        agg.negativeCount += 1;
    }

    // Check if destroyed card was usable
    const usableCardIds = Array.isArray(record.usableCardIds) ? record.usableCardIds : [];
    if (usableCardIds.includes(cardId)) {
        agg.usableDestroyCount += 1;
    }

    agg.records.push(record);
}

// Build aggregates array
const aggregates = Object.values(aggregateMap).map((agg: any) => ({
    cardType: agg.cardType,
    count: agg.count,
    avgFutureDiscDelta3Ply: agg.futureDiscDelta3PlySum / agg.count,
    negativeRate: agg.negativeCount / agg.count,
    usableDestroyCount: agg.usableDestroyCount
}));

// Sort by count desc then avgFuture asc
aggregates.sort((a: any, b: any) => {
    if (a.count !== b.count) return b.count - a.count;
    return a.avgFutureDiscDelta3Ply - b.avgFutureDiscDelta3Ply;
});

// Find worst 3 usable destroys
const worstThreeUsableDestroys: any[] = [];
for (const agg of Object.values(aggregateMap)) {
    for (const record of (agg as any).records) {
        const usableCardIds = Array.isArray(record.usableCardIds) ? record.usableCardIds : [];
        if (usableCardIds.includes(record.destroyCardId)) {
            worstThreeUsableDestroys.push({
                record,
                futureDiscDelta3Ply: Number(record.futureDiscDelta3Ply || 0)
            });
        }
    }
}

// Sort by futureDiscDelta3Ply ascending (worst first)
worstThreeUsableDestroys.sort((a: any, b: any) => a.futureDiscDelta3Ply - b.futureDiscDelta3Ply);
worstThreeUsableDestroys.splice(3); // Keep only top 3

const worstThreeFormatted = worstThreeUsableDestroys.map((item: any) => {
    const r = item.record;
    const cardType = cardTypeMap[r.destroyCardId] || 'UNKNOWN';
    return {
        seed: r.seed,
        ply: r.ply,
        player: r.player,
        cardType,
        future: r.futureDiscDelta3Ply,
        handCards: Array.isArray(r.handCards) ? r.handCards : [],
        usableCardIds: Array.isArray(r.usableCardIds) ? r.usableCardIds : []
    };
});

// Output JSON
const output = {
    aggregate: aggregates,
    worstThreeUsableDestroys: worstThreeFormatted
};

console.log(JSON.stringify(output, null, 2));
