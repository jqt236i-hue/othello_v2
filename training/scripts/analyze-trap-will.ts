#!/usr/bin/env node
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

'use strict';

const SelfplayRunner = require('./src/engine/selfplay-runner');

async function analyzeTrapWill() {
  const config = {
    games: 20,
    baseSeed: 1,
    maxPlies: 220,
    allowCardUsage: true,
    cardUsageRate: 0.35
  };

  const results = await SelfplayRunner.runSelfPlayGames(config);
  
  const trapWillRecords = [];
  const allRecords = results.records || [];
  
  // Process all records and collect TRAP_WILL usage records
  for (const record of allRecords) {
    if (record.actionType === 'use_card') {
      // Find the card that was actually used
      const useCardId = record.useCardId;
      if (useCardId && record.decisionCandidates) {
        // Find the candidate with this cardId to get the cardType
        const usedCandidate = record.decisionCandidates.find(c => c && c.cardId === useCardId);
        if (usedCandidate && usedCandidate.cardType === 'TRAP_WILL') {
          trapWillRecords.push({
            seed: record.seed,
            ply: record.ply,
            future: record.futureDiscDelta3Ply || 0
          });
        }
      }
    }
  }

  // Calculate metrics
  const count = trapWillRecords.length;
  const avgFutureDiscDelta3Ply = count > 0 
    ? trapWillRecords.reduce((sum, r) => sum + r.future, 0) / count 
    : 0;
  
  const negativeCount = trapWillRecords.filter(r => r.future < 0).length;
  const negativeRate = count > 0 ? negativeCount / count : 0;
  
  // Sort by future (ascending) to get worst three
  const sorted = [...trapWillRecords].sort((a, b) => a.future - b.future);
  const worstThree = sorted.slice(0, 3).map(r => ({
    seed: r.seed,
    ply: r.ply,
    future: r.future
  }));

  const output = {
    count,
    avgFutureDiscDelta3Ply: Math.round(avgFutureDiscDelta3Ply * 100) / 100,
    negativeRate: Math.round(negativeRate * 10000) / 10000,
    worstThree
  };

  console.log(JSON.stringify(output));
}

analyzeTrapWill().catch(err => {
  console.error(err);
  process.exit(1);
});

export {};
