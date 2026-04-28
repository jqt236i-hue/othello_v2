#!/usr/bin/env node
// @ts-nocheck
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

'use strict';

// Suppress console logs from other modules
const originalLog = console.log;
const originalError = console.error;
let jsonMode = false;

console.log = function(...args) {
  if (jsonMode) {
    originalLog.apply(console, args);
  }
};

console.error = function(...args) {
  // Suppress all error logs
};

const SelfplayRunner = require('./src/engine/selfplay-runner');

async function analyzeCrystalStone() {
  const config = {
    games: 20,
    baseSeed: 1,
    maxPlies: 220,
    allowCardUsage: true,
    cardUsageRate: 0.35
  };

  const results = await SelfplayRunner.runSelfPlayGames(config);
  
  const crystalStoneRecords = [];
  const allRecords = results.records || [];
  
  // Process all records and collect CRYSTAL_STONE usage records
  for (const record of allRecords) {
    if (record.actionType === 'use_card') {
      const useCardId = record.useCardId;
      if (useCardId && record.decisionCandidates) {
        const usedCandidate = record.decisionCandidates.find(c => c && c.cardId === useCardId);
        if (usedCandidate && usedCandidate.cardType === 'CRYSTAL_STONE') {
          crystalStoneRecords.push({
            seed: record.seed,
            ply: record.ply,
            player: record.player,
            future: record.futureDiscDelta3Ply || 0,
            hasCornerMoveNow: record.hasCornerMoveNow,
            hasEdgeMoveNow: record.hasEdgeMoveNow,
            cornerEmergency: record.cornerEmergency,
            handCards: record.handCards,
            decisionCandidates: record.decisionCandidates
          });
        }
      }
    }
  }

  // Calculate metrics
  const count = crystalStoneRecords.length;
  const avgFutureDiscDelta3Ply = count > 0 
    ? crystalStoneRecords.reduce((sum, r) => sum + r.future, 0) / count 
    : 0;
  
  const negativeCount = crystalStoneRecords.filter(r => r.future < 0).length;
  const negativeRate = count > 0 ? negativeCount / count : 0;
  
  // Sort by future (ascending) to get worst five
  const sorted = [...crystalStoneRecords].sort((a, b) => a.future - b.future);
  const worstFive = sorted.slice(0, 5).map(r => ({
    seed: r.seed,
    ply: r.ply,
    player: r.player,
    future: r.future,
    hasCornerMoveNow: r.hasCornerMoveNow,
    hasEdgeMoveNow: r.hasEdgeMoveNow,
    cornerEmergency: r.cornerEmergency,
    handCards: r.handCards,
    decisionCandidates: r.decisionCandidates
  }));

  const output = {
    aggregate: {
      count,
      avgFutureDiscDelta3Ply: Math.round(avgFutureDiscDelta3Ply * 100) / 100,
      negativeRate: Math.round(negativeRate * 10000) / 10000
    },
    worstFive
  };

  jsonMode = true;
  console.log(JSON.stringify(output, null, 2));
}

analyzeCrystalStone().catch(err => {
  if (jsonMode) {
    originalError(err);
  }
  process.exit(1);
});

export {};
