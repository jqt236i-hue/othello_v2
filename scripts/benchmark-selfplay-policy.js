#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { runSelfPlayGames, SELFPLAY_SCHEMA_VERSION } = require('../src/engine/selfplay-runner');

function parseArgs(argv) {
    const args = {
        games: 100,
        seed: 1,
        maxPlies: 220,
        out: null,
        policyA: { allowCardUsage: true, cardUsageRate: 0.2, policyScoreWeight: 1, heuristicWeight: 1 },
        policyB: { allowCardUsage: true, cardUsageRate: 0.2, policyScoreWeight: 1, heuristicWeight: 1 },
        modelAPath: null,
        modelBPath: null,
        verbose: false,
        help: false
    };

    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--help' || a === '-h') {
            args.help = true;
            continue;
        }
        if (a === '--games' || a === '-g') {
            args.games = Number(argv[++i]);
            continue;
        }
        if (a === '--seed' || a === '-s') {
            args.seed = Number(argv[++i]);
            continue;
        }
        if (a === '--max-plies') {
            args.maxPlies = Number(argv[++i]);
            continue;
        }
        if (a === '--out' || a === '-o') {
            args.out = path.resolve(process.cwd(), argv[++i]);
            continue;
        }
        if (a === '--a-no-cards') {
            args.policyA.allowCardUsage = false;
            continue;
        }
        if (a === '--a-with-cards') {
            args.policyA.allowCardUsage = true;
            continue;
        }
        if (a === '--a-rate') {
            args.policyA.cardUsageRate = Number(argv[++i]);
            continue;
        }
        if (a === '--a-policy-score-weight') {
            args.policyA.policyScoreWeight = Number(argv[++i]);
            continue;
        }
        if (a === '--a-heuristic-weight') {
            args.policyA.heuristicWeight = Number(argv[++i]);
            continue;
        }
        if (a === '--a-model') {
            args.modelAPath = path.resolve(process.cwd(), argv[++i]);
            continue;
        }
        if (a === '--b-no-cards') {
            args.policyB.allowCardUsage = false;
            continue;
        }
        if (a === '--b-with-cards') {
            args.policyB.allowCardUsage = true;
            continue;
        }
        if (a === '--b-rate') {
            args.policyB.cardUsageRate = Number(argv[++i]);
            continue;
        }
        if (a === '--b-policy-score-weight') {
            args.policyB.policyScoreWeight = Number(argv[++i]);
            continue;
        }
        if (a === '--b-heuristic-weight') {
            args.policyB.heuristicWeight = Number(argv[++i]);
            continue;
        }
        if (a === '--b-model') {
            args.modelBPath = path.resolve(process.cwd(), argv[++i]);
            continue;
        }
        if (a === '--verbose') {
            args.verbose = true;
            continue;
        }
    }

    if (!Number.isFinite(args.games) || args.games < 1) throw new Error('--games must be >= 1');
    if (!Number.isFinite(args.seed)) throw new Error('--seed must be a number');
    if (!Number.isFinite(args.maxPlies) || args.maxPlies < 1) throw new Error('--max-plies must be >= 1');
    if (!Number.isFinite(args.policyA.cardUsageRate) || args.policyA.cardUsageRate < 0 || args.policyA.cardUsageRate > 1) {
        throw new Error('--a-rate must be in [0,1]');
    }
    if (!Number.isFinite(args.policyB.cardUsageRate) || args.policyB.cardUsageRate < 0 || args.policyB.cardUsageRate > 1) {
        throw new Error('--b-rate must be in [0,1]');
    }
    if (!Number.isFinite(args.policyA.policyScoreWeight) || args.policyA.policyScoreWeight < 0) {
        throw new Error('--a-policy-score-weight must be >= 0');
    }
    if (!Number.isFinite(args.policyA.heuristicWeight) || args.policyA.heuristicWeight < 0) {
        throw new Error('--a-heuristic-weight must be >= 0');
    }
    if (!Number.isFinite(args.policyB.policyScoreWeight) || args.policyB.policyScoreWeight < 0) {
        throw new Error('--b-policy-score-weight must be >= 0');
    }
    if (!Number.isFinite(args.policyB.heuristicWeight) || args.policyB.heuristicWeight < 0) {
        throw new Error('--b-heuristic-weight must be >= 0');
    }

    return args;
}

function printHelp() {
    console.log([
        'Usage:',
        '  node scripts/benchmark-selfplay-policy.js [options]',
        '',
        'Options:',
        '  -g, --games <n>      Games per side (default: 100)',
        '  -s, --seed <n>       Base seed (default: 1)',
        '      --max-plies <n>  Max plies per game (default: 220)',
        '  -o, --out <path>     Optional JSON output path',
        '      --a-with-cards   Enable cards for Policy A (default: on)',
        '      --a-no-cards     Disable cards for Policy A',
        '      --a-rate <r>     Card usage rate for Policy A (default: 0.2)',
        '      --a-policy-score-weight <r> Model score weight for Policy A (default: 1)',
        '      --a-heuristic-weight <r> Heuristic score weight for Policy A (default: 1)',
        '      --a-model <path> Optional policy-table JSON for Policy A',
        '      --b-with-cards   Enable cards for Policy B (default: on)',
        '      --b-no-cards     Disable cards for Policy B',
        '      --b-rate <r>     Card usage rate for Policy B (default: 0.2)',
        '      --b-policy-score-weight <r> Model score weight for Policy B (default: 1)',
        '      --b-heuristic-weight <r> Heuristic score weight for Policy B (default: 1)',
        '      --b-model <path> Optional policy-table JSON for Policy B',
        '      --verbose        Keep internal game debug logs',
        '  -h, --help           Show this help'
    ].join('\n'));
}

function withFilteredConsole(enabled, fn) {
    if (!enabled) return fn();

    const originalLog = console.log;
    const originalWarn = console.warn;
    const shouldDrop = (firstArg) => {
        if (typeof firstArg !== 'string') return false;
        return firstArg.startsWith('[BOARDOPS]') ||
            firstArg.startsWith('[WORK_DEBUG]') ||
            firstArg.startsWith('[TurnPipeline]') ||
            firstArg.startsWith('[HYPERACTIVE]') ||
            firstArg.startsWith('[presentation]');
    };

    console.log = (...args) => {
        if (shouldDrop(args[0])) return;
        originalLog(...args);
    };
    console.warn = (...args) => {
        if (shouldDrop(args[0])) return;
        originalWarn(...args);
    };

    try {
        return fn();
    } finally {
        console.log = originalLog;
        console.warn = originalWarn;
    }
}

function mapWinnerToPolicy(winner, blackPolicy) {
    if (winner === 'draw') return 'draw';
    if (winner === 'black') return blackPolicy;
    return blackPolicy === 'A' ? 'B' : 'A';
}

function policyForColor(color, blackPolicy) {
    if (color === 'black') return blackPolicy;
    return blackPolicy === 'A' ? 'B' : 'A';
}

function isCornerMove(row, col, size) {
    if (!Number.isInteger(row) || !Number.isInteger(col) || !Number.isInteger(size) || size < 2) return false;
    return (row === 0 || row === size - 1) && (col === 0 || col === size - 1);
}

function isEdgeMove(row, col, size) {
    if (!Number.isInteger(row) || !Number.isInteger(col) || !Number.isInteger(size) || size < 2) return false;
    const onOuter = row === 0 || row === size - 1 || col === 0 || col === size - 1;
    return onOuter && !isCornerMove(row, col, size);
}

function createQualityStat() {
    return {
        totalActions: 0,
        placeActions: 0,
        useCardActions: 0,
        usableTurns: 0,
        useWhenUsableActions: 0,
        holdWhenUsableActions: 0,
        cornerOpportunityCount: 0,
        cornerTakenCount: 0,
        edgeOpportunityCount: 0,
        edgeTakenCount: 0,
        edgeTakenWhenAvailableCount: 0,
        cornerRecoveryOpportunityCount: 0,
        cornerRecoverySuccessCount: 0,
        cornerRecaptureOpportunityCount: 0,
        cornerRecaptureSuccessCount: 0,
        edgeRecoveryOpportunityCount: 0,
        edgeRecoverySuccessCount: 0,
        cornerHoldOpportunityCount: 0,
        cornerHoldSuccessCount: 0,
        cornerHoldTurnsOpportunityCount: 0,
        cornerHoldTurnsSum: 0,
        edgeHoldOpportunityCount: 0,
        edgeHoldSuccessCount: 0,
        cornerSwingSum: 0,
        edgeSwingSum: 0,
        finalGameCount: 0,
        finalCornersOwnedSum: 0,
        finalCornersTotalSum: 0,
        finalEdgesOwnedSum: 0,
        finalEdgesTotalSum: 0,
        finalCornerDominanceCount: 0,
        finalEdgeDominanceCount: 0,
        immediateDiscDeltaSum: 0,
        placeDiscDeltaSum: 0,
        cardImmediateDiscDeltaSum: 0,
        cardFutureDiscDelta3PlySum: 0,
        cardFutureDiscDelta3PlyCount: 0,
        selectedCellBonusSum: 0
    };
}

function createQualityAccumulator() {
    return {
        A: createQualityStat(),
        B: createQualityStat()
    };
}

function toFiniteNumber(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

function updateQualityForRecord(qualityAcc, rec, blackPolicy) {
    if (!rec || typeof rec !== 'object') return;
    const actorColor = rec.player === 'black' ? 'black' : (rec.player === 'white' ? 'white' : null);
    if (!actorColor) return;
    const policyKey = policyForColor(actorColor, blackPolicy);
    const stat = qualityAcc[policyKey];
    if (!stat) return;

    stat.totalActions += 1;
    const usableCount = Array.isArray(rec.usableCardIds) ? rec.usableCardIds.length : 0;
    if (usableCount > 0) {
        stat.usableTurns += 1;
        if (rec.actionType === 'use_card') stat.useWhenUsableActions += 1;
        else stat.holdWhenUsableActions += 1;
    }

    const ownBefore = actorColor === 'black'
        ? toFiniteNumber(rec.blackCountBefore)
        : toFiniteNumber(rec.whiteCountBefore);
    const ownAfter = actorColor === 'black'
        ? toFiniteNumber(rec.blackCountAfter)
        : toFiniteNumber(rec.whiteCountAfter);
    const immediateDiscDelta = ownAfter - ownBefore;
    stat.immediateDiscDeltaSum += immediateDiscDelta;

    const ownCornersBefore = toFiniteNumber(rec.ownCornersBefore);
    const oppCornersBefore = toFiniteNumber(rec.oppCornersBefore);
    const ownCornersAfter = Number.isFinite(Number(rec.ownCornersAfter))
        ? Number(rec.ownCornersAfter)
        : ownCornersBefore;
    const oppCornersAfter = Number.isFinite(Number(rec.oppCornersAfter))
        ? Number(rec.oppCornersAfter)
        : oppCornersBefore;
    const ownEdgesBefore = toFiniteNumber(rec.ownEdgesBefore);
    const oppEdgesBefore = toFiniteNumber(rec.oppEdgesBefore);
    const ownEdgesAfter = Number.isFinite(Number(rec.ownEdgesAfter))
        ? Number(rec.ownEdgesAfter)
        : ownEdgesBefore;
    const oppEdgesAfter = Number.isFinite(Number(rec.oppEdgesAfter))
        ? Number(rec.oppEdgesAfter)
        : oppEdgesBefore;

    const cornerDiffBefore = ownCornersBefore - oppCornersBefore;
    const cornerDiffAfter = ownCornersAfter - oppCornersAfter;
    const edgeDiffBefore = ownEdgesBefore - oppEdgesBefore;
    const edgeDiffAfter = ownEdgesAfter - oppEdgesAfter;
    stat.cornerSwingSum += (cornerDiffAfter - cornerDiffBefore);
    stat.edgeSwingSum += (edgeDiffAfter - edgeDiffBefore);

    if (cornerDiffBefore < 0) {
        stat.cornerRecoveryOpportunityCount += 1;
        if (cornerDiffAfter > cornerDiffBefore) stat.cornerRecoverySuccessCount += 1;
    }
    if (oppCornersBefore > ownCornersBefore) {
        stat.cornerRecaptureOpportunityCount += 1;
        if (ownCornersAfter > ownCornersBefore) stat.cornerRecaptureSuccessCount += 1;
    }
    if (edgeDiffBefore < 0) {
        stat.edgeRecoveryOpportunityCount += 1;
        if (edgeDiffAfter > edgeDiffBefore) stat.edgeRecoverySuccessCount += 1;
    }
    if (ownCornersBefore > 0) {
        stat.cornerHoldOpportunityCount += 1;
        if (ownCornersAfter >= ownCornersBefore) stat.cornerHoldSuccessCount += 1;
    }
    if (ownEdgesBefore > 0) {
        stat.edgeHoldOpportunityCount += 1;
        if (ownEdgesAfter >= ownEdgesBefore) stat.edgeHoldSuccessCount += 1;
    }
    if (ownCornersAfter > 0) {
        stat.cornerHoldTurnsOpportunityCount += 1;
        stat.cornerHoldTurnsSum += toFiniteNumber(rec.cornerHoldTurnsNext3Plies);
    }

    const hasEdgeMoveNow = toFiniteNumber(rec.hasEdgeMoveNow) > 0;
    if (hasEdgeMoveNow) stat.edgeOpportunityCount += 1;

    if (rec.actionType === 'place') {
        stat.placeActions += 1;
        stat.placeDiscDeltaSum += immediateDiscDelta;
        stat.selectedCellBonusSum += toFiniteNumber(rec.selectedCellBonus);
        if (toFiniteNumber(rec.hasCornerMoveNow) > 0) stat.cornerOpportunityCount += 1;
        if (isCornerMove(rec.row, rec.col, 8)) stat.cornerTakenCount += 1;
        if (isEdgeMove(rec.row, rec.col, 8)) {
            stat.edgeTakenCount += 1;
            if (hasEdgeMoveNow) stat.edgeTakenWhenAvailableCount += 1;
        }
        return;
    }

    if (rec.actionType === 'use_card') {
        stat.useCardActions += 1;
        stat.cardImmediateDiscDeltaSum += immediateDiscDelta;
        stat.cardFutureDiscDelta3PlyCount += 1;
        stat.cardFutureDiscDelta3PlySum += toFiniteNumber(rec.futureDiscDelta3Ply);
    }
}

function updateQualityFinalFromSummary(qualityAcc, summary, blackPolicy) {
    if (!summary || typeof summary !== 'object') return;
    const blackCorners = toFiniteNumber(summary.blackCorners);
    const whiteCorners = toFiniteNumber(summary.whiteCorners);
    const blackEdges = toFiniteNumber(summary.blackEdges);
    const whiteEdges = toFiniteNumber(summary.whiteEdges);
    const totalCorners = Math.max(0, blackCorners + whiteCorners);
    const totalEdges = Math.max(0, blackEdges + whiteEdges);

    const applyForPolicy = (policyKey, ownCorners, oppCorners, ownEdges, oppEdges) => {
        const stat = qualityAcc[policyKey];
        if (!stat) return;
        stat.finalGameCount += 1;
        stat.finalCornersOwnedSum += ownCorners;
        stat.finalCornersTotalSum += totalCorners;
        stat.finalEdgesOwnedSum += ownEdges;
        stat.finalEdgesTotalSum += totalEdges;
        if (ownCorners > oppCorners) stat.finalCornerDominanceCount += 1;
        if (ownEdges > oppEdges) stat.finalEdgeDominanceCount += 1;
    };

    if (blackPolicy === 'A') {
        applyForPolicy('A', blackCorners, whiteCorners, blackEdges, whiteEdges);
        applyForPolicy('B', whiteCorners, blackCorners, whiteEdges, blackEdges);
        return;
    }
    applyForPolicy('A', whiteCorners, blackCorners, whiteEdges, blackEdges);
    applyForPolicy('B', blackCorners, whiteCorners, blackEdges, whiteEdges);
}

function finalizeQualityStat(stat) {
    const totalActions = Math.max(1, stat.totalActions);
    const placeActions = Math.max(1, stat.placeActions);
    const useCardActions = Math.max(1, stat.useCardActions);
    const usableTurns = Math.max(1, stat.usableTurns);
    const cornerOpportunityCount = Math.max(1, stat.cornerOpportunityCount);
    const edgeOpportunityCount = Math.max(1, stat.edgeOpportunityCount);
    const cornerRecoveryOpportunityCount = Math.max(1, stat.cornerRecoveryOpportunityCount);
    const cornerRecaptureOpportunityCount = Math.max(1, stat.cornerRecaptureOpportunityCount);
    const edgeRecoveryOpportunityCount = Math.max(1, stat.edgeRecoveryOpportunityCount);
    const cornerHoldOpportunityCount = Math.max(1, stat.cornerHoldOpportunityCount);
    const cornerHoldTurnsOpportunityCount = Math.max(1, stat.cornerHoldTurnsOpportunityCount);
    const edgeHoldOpportunityCount = Math.max(1, stat.edgeHoldOpportunityCount);
    const cardFutureDiscDelta3PlyCount = Math.max(1, stat.cardFutureDiscDelta3PlyCount);
    const finalGameCount = Math.max(1, stat.finalGameCount);
    const finalCornersTotalSum = Math.max(1, stat.finalCornersTotalSum);
    const finalEdgesTotalSum = Math.max(1, stat.finalEdgesTotalSum);

    return {
        totalActions: stat.totalActions,
        placeActions: stat.placeActions,
        useCardActions: stat.useCardActions,
        usableTurns: stat.usableTurns,
        useWhenUsableActions: stat.useWhenUsableActions,
        holdWhenUsableActions: stat.holdWhenUsableActions,
        cornerOpportunityCount: stat.cornerOpportunityCount,
        cornerTakenCount: stat.cornerTakenCount,
        edgeOpportunityCount: stat.edgeOpportunityCount,
        edgeTakenCount: stat.edgeTakenCount,
        edgeTakenWhenAvailableCount: stat.edgeTakenWhenAvailableCount,
        cornerRecoveryOpportunityCount: stat.cornerRecoveryOpportunityCount,
        cornerRecoverySuccessCount: stat.cornerRecoverySuccessCount,
        cornerRecaptureOpportunityCount: stat.cornerRecaptureOpportunityCount,
        cornerRecaptureSuccessCount: stat.cornerRecaptureSuccessCount,
        edgeRecoveryOpportunityCount: stat.edgeRecoveryOpportunityCount,
        edgeRecoverySuccessCount: stat.edgeRecoverySuccessCount,
        cornerHoldOpportunityCount: stat.cornerHoldOpportunityCount,
        cornerHoldSuccessCount: stat.cornerHoldSuccessCount,
        cornerHoldTurnsOpportunityCount: stat.cornerHoldTurnsOpportunityCount,
        cornerHoldTurnsSum: stat.cornerHoldTurnsSum,
        edgeHoldOpportunityCount: stat.edgeHoldOpportunityCount,
        edgeHoldSuccessCount: stat.edgeHoldSuccessCount,
        cardFutureDiscDelta3PlyCount: stat.cardFutureDiscDelta3PlyCount,
        cardFutureDiscDelta3PlySum: stat.cardFutureDiscDelta3PlySum,
        finalGameCount: stat.finalGameCount,
        finalCornersOwnedSum: stat.finalCornersOwnedSum,
        finalCornersTotalSum: stat.finalCornersTotalSum,
        finalEdgesOwnedSum: stat.finalEdgesOwnedSum,
        finalEdgesTotalSum: stat.finalEdgesTotalSum,
        finalCornerDominanceCount: stat.finalCornerDominanceCount,
        finalEdgeDominanceCount: stat.finalEdgeDominanceCount,
        useCardRate: stat.useCardActions / totalActions,
        useWhenUsableRate: stat.useWhenUsableActions / usableTurns,
        holdWhenUsableRate: stat.holdWhenUsableActions / usableTurns,
        cornerTakeRate: stat.cornerTakenCount / cornerOpportunityCount,
        edgeTakeRate: stat.edgeTakenCount / placeActions,
        edgeTakeWhenAvailableRate: stat.edgeTakenWhenAvailableCount / edgeOpportunityCount,
        cornerRecoveryRate: stat.cornerRecoverySuccessCount / cornerRecoveryOpportunityCount,
        cornerRecaptureRate: stat.cornerRecaptureSuccessCount / cornerRecaptureOpportunityCount,
        edgeRecoveryRate: stat.edgeRecoverySuccessCount / edgeRecoveryOpportunityCount,
        cornerHoldRate: stat.cornerHoldSuccessCount / cornerHoldOpportunityCount,
        avgCornerHoldTurnsNext3Plies: stat.cornerHoldTurnsSum / cornerHoldTurnsOpportunityCount,
        edgeHoldRate: stat.edgeHoldSuccessCount / edgeHoldOpportunityCount,
        avgCornerSwing: stat.cornerSwingSum / totalActions,
        avgEdgeSwing: stat.edgeSwingSum / totalActions,
        finalCornerShare: stat.finalCornersOwnedSum / finalCornersTotalSum,
        finalEdgeShare: stat.finalEdgesOwnedSum / finalEdgesTotalSum,
        finalCornerDominanceRate: stat.finalCornerDominanceCount / finalGameCount,
        finalEdgeDominanceRate: stat.finalEdgeDominanceCount / finalGameCount,
        avgImmediateDiscDelta: stat.immediateDiscDeltaSum / totalActions,
        avgPlaceDiscDelta: stat.placeDiscDeltaSum / placeActions,
        avgCardImmediateDiscDelta: stat.cardImmediateDiscDeltaSum / useCardActions,
        avgCardFutureDiscDelta3Ply: stat.cardFutureDiscDelta3PlySum / cardFutureDiscDelta3PlyCount,
        avgSelectedCellBonus: stat.selectedCellBonusSum / placeActions
    };
}

function summarizePolicyResults(resultAB, resultBA, qualityAcc) {
    const totals = { A: 0, B: 0, draw: 0 };
    const bySide = {
        blackA_whiteB: { A: 0, B: 0, draw: 0 },
        blackB_whiteA: { A: 0, B: 0, draw: 0 }
    };
    let totalPlies = 0;

    for (const game of resultAB.gameSummaries) {
        const winner = mapWinnerToPolicy(game.winner, 'A');
        bySide.blackA_whiteB[winner] += 1;
        totals[winner] += 1;
        totalPlies += game.plies;
        updateQualityFinalFromSummary(qualityAcc, game, 'A');
    }
    for (const game of resultBA.gameSummaries) {
        const winner = mapWinnerToPolicy(game.winner, 'B');
        bySide.blackB_whiteA[winner] += 1;
        totals[winner] += 1;
        totalPlies += game.plies;
        updateQualityFinalFromSummary(qualityAcc, game, 'B');
    }

    const totalGames = resultAB.gameSummaries.length + resultBA.gameSummaries.length;
    const scoreA = totals.A + (totals.draw * 0.5);
    const scoreB = totals.B + (totals.draw * 0.5);

    return {
        totalGames,
        totalPlies,
        avgPlies: totalGames > 0 ? totalPlies / totalGames : 0,
        totals,
        bySide,
        score: {
            A: scoreA,
            B: scoreB,
            APercent: totalGames > 0 ? scoreA / totalGames : 0,
            BPercent: totalGames > 0 ? scoreB / totalGames : 0
        },
        quality: {
            A: finalizeQualityStat(qualityAcc.A),
            B: finalizeQualityStat(qualityAcc.B)
        }
    };
}

function runBenchmark(options) {
    const games = Number.isFinite(options.games) ? options.games : 100;
    const seed = Number.isFinite(options.seed) ? options.seed : 1;
    const maxPlies = Number.isFinite(options.maxPlies) ? options.maxPlies : 220;
    const policyA = Object.assign({ allowCardUsage: true, cardUsageRate: 0.2, policyScoreWeight: 1, heuristicWeight: 1 }, options.policyA || {});
    const policyB = Object.assign({ allowCardUsage: true, cardUsageRate: 0.2, policyScoreWeight: 1, heuristicWeight: 1 }, options.policyB || {});
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
    const onRecordExternal = typeof options.onRecord === 'function' ? options.onRecord : null;
    const qualityAcc = createQualityAccumulator();
    const benchmarkStartedAt = Date.now();
    const totalGames = games * 2;
    let completedGames = 0;
    const emitProgress = (stage, summary) => {
        completedGames += 1;
        if (!onProgress) return;
        onProgress({
            stage,
            completed: completedGames,
            total: totalGames,
            winner: summary && summary.winner ? summary.winner : null,
            plies: summary && Number.isFinite(summary.plies) ? summary.plies : null,
            elapsedMs: Date.now() - benchmarkStartedAt
        });
    };
    if (options.modelAPath) {
        const raw = fs.readFileSync(options.modelAPath, 'utf8');
        policyA.policyTableModel = JSON.parse(raw);
    }
    if (options.modelBPath) {
        const raw = fs.readFileSync(options.modelBPath, 'utf8');
        policyB.policyTableModel = JSON.parse(raw);
    }

    // ベンチマークは再実行で同じ結果が必要だが、完全な無制限探索だと
    // 実行時間が不安定になる。既定では「1ノード=10仮想ms」の決定論的な
    // 仮想時計を使い、通常の time budget を保ったまま再現性を確保する。
    if (policyA.lookaheadVirtualTimePerNodeMs === undefined && policyA.disableLookaheadTimeBudget !== true) {
        policyA.lookaheadVirtualTimePerNodeMs = 10;
    }
    if (policyB.lookaheadVirtualTimePerNodeMs === undefined && policyB.disableLookaheadTimeBudget !== true) {
        policyB.lookaheadVirtualTimePerNodeMs = 10;
    }

    const globalAllowCards = !!policyA.allowCardUsage || !!policyB.allowCardUsage;
    const globalCardUsageRate = Math.max(
        Number.isFinite(policyA.cardUsageRate) ? Number(policyA.cardUsageRate) : 0,
        Number.isFinite(policyB.cardUsageRate) ? Number(policyB.cardUsageRate) : 0
    );

    const resultAB = runSelfPlayGames({
        games,
        baseSeed: seed,
        maxPlies,
        allowCardUsage: globalAllowCards,
        cardUsageRate: globalCardUsageRate,
        playerPolicies: {
            black: policyA,
            white: policyB
        },
        onRecord: (rec) => {
            updateQualityForRecord(qualityAcc, rec, 'A');
            if (onRecordExternal) onRecordExternal(rec);
        },
        onGameEnd: (summary) => emitProgress('blackA_whiteB', summary)
    });

    const resultBA = runSelfPlayGames({
        games,
        baseSeed: seed,
        maxPlies,
        allowCardUsage: globalAllowCards,
        cardUsageRate: globalCardUsageRate,
        playerPolicies: {
            black: policyB,
            white: policyA
        },
        onRecord: (rec) => {
            updateQualityForRecord(qualityAcc, rec, 'B');
            if (onRecordExternal) onRecordExternal(rec);
        },
        onGameEnd: (summary) => emitProgress('blackB_whiteA', summary)
    });

    return {
        schemaVersion: SELFPLAY_SCHEMA_VERSION,
        config: {
            games,
            seed,
            maxPlies,
            policyA: {
                allowCardUsage: policyA.allowCardUsage,
                cardUsageRate: policyA.cardUsageRate,
                policyScoreWeight: policyA.policyScoreWeight,
                heuristicWeight: policyA.heuristicWeight,
                hasModel: !!policyA.policyTableModel,
                modelPath: options.modelAPath || null
            },
            policyB: {
                allowCardUsage: policyB.allowCardUsage,
                cardUsageRate: policyB.cardUsageRate,
                policyScoreWeight: policyB.policyScoreWeight,
                heuristicWeight: policyB.heuristicWeight,
                hasModel: !!policyB.policyTableModel,
                modelPath: options.modelBPath || null
            }
        },
        result: summarizePolicyResults(resultAB, resultBA, qualityAcc)
    };
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        printHelp();
        return;
    }

    const startedAt = Date.now();
    const benchmark = withFilteredConsole(!args.verbose, () => runBenchmark(args));
    const elapsedMs = Date.now() - startedAt;
    const payload = {
        generatedAt: new Date().toISOString(),
        elapsedMs,
        schemaVersion: benchmark.schemaVersion,
        config: benchmark.config,
        result: benchmark.result
    };

    if (args.out) {
        fs.mkdirSync(path.dirname(args.out), { recursive: true });
        fs.writeFileSync(args.out, JSON.stringify(payload, null, 2), 'utf8');
        console.log(`[selfplay-benchmark] wrote: ${args.out}`);
    }
    console.log(`[selfplay-benchmark] games=${payload.result.totalGames} avgPlies=${payload.result.avgPlies.toFixed(2)} A=${payload.result.score.APercent.toFixed(3)} B=${payload.result.score.BPercent.toFixed(3)}`);
}

if (require.main === module) {
    try {
        main();
    } catch (err) {
        console.error('[selfplay-benchmark] failed:', err && err.message ? err.message : err);
        process.exit(1);
    }
}

module.exports = {
    parseArgs,
    runBenchmark,
    summarizePolicyResults
};
