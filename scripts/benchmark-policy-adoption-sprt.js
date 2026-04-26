#!/usr/bin/env node
'use strict';

/**
 * SPRT-based policy adoption gate.
 *
 * Wraps benchmark-policy-adoption.js with Sequential Probability Ratio Test
 * for early stopping. Uses both traditional fixed-sample gates and SPRT gates.
 */

const fs = require('fs');
const path = require('path');
const { SPRT } = require('./sprt');
const { runBenchmark } = require('./benchmark-selfplay-policy');

async function runSPRTAdoption(options) {
    const sprt = SPRT.quickGate();
    const games = options.games || 120;
    const seed = options.seed || 1;
    const baselineModel = options.baselineModelPath;
    const candidateModel = options.candidateModelPath;

    console.log(`[sprt-adoption] Starting SPRT evaluation: games=${games} seed=${seed}`);
    console.log(`[sprt-adoption] Baseline: ${baselineModel}`);
    console.log(`[sprt-adoption] Candidate: ${candidateModel}`);

    for (let gameNum = 1; gameNum <= games; gameNum++) {
        // Run a single game: candidate (black) vs baseline (white)
        const result = await runBenchmark({
            seed: seed + gameNum,
            games: 1,
            maxPlies: options.maxPlies || 220,
            aRate: options.aRate || 0.2,
            bRate: options.bRate || 0.2,
            aModelPath: candidateModel,
            bModelPath: baselineModel,
            jobs: 1,
        });

        // Parse result: did candidate win?
        const candidateScore = result.aScore || 0;
        const baselineScore = result.bScore || 0;
        let gameResult;
        if (candidateScore > baselineScore) {
            gameResult = 1; // win
        } else if (candidateScore < baselineScore) {
            gameResult = -1; // loss
        } else {
            gameResult = 0; // draw
        }

        sprt.update(gameResult);
        const status = sprt.getStatus();

        console.log(
            `[sprt-adoption] game ${gameNum}/${games} ` +
            `result=${gameResult > 0 ? 'W' : gameResult < 0 ? 'L' : 'D'} ` +
            `llr=${status.llr.toFixed(2)} ` +
            `bounds=[${sprt.lowerBound.toFixed(2)}, ${sprt.upperBound.toFixed(2)}] ` +
            `status=${status.status}`
        );

        if (status.status === 'accept') {
            console.log(`[sprt-adoption] ACCEPT after ${gameNum} games`);
            return {
                passed: true,
                gamesPlayed: gameNum,
                wins: status.wins,
                losses: status.losses,
                draws: status.draws,
                llr: status.llr,
                reason: 'sprt_accept'
            };
        }
        if (status.status === 'reject') {
            console.log(`[sprt-adoption] REJECT after ${gameNum} games`);
            return {
                passed: false,
                gamesPlayed: gameNum,
                wins: status.wins,
                losses: status.losses,
                draws: status.draws,
                llr: status.llr,
                reason: 'sprt_reject'
            };
        }
    }

    // Max games reached without decision
    const status = sprt.getStatus();
    const passed = status.llr > 0;
    console.log(`[sprt-adoption] MAX GAMES reached (${games}) llr=${status.llr.toFixed(2)} passed=${passed}`);
    return {
        passed,
        gamesPlayed: games,
        wins: status.wins,
        losses: status.losses,
        draws: status.draws,
        llr: status.llr,
        reason: passed ? 'sprt_max_accept' : 'sprt_max_reject'
    };
}

async function main() {
    const args = {
        games: 120,
        seed: 1,
        baselineModelPath: process.argv.find(a => a.startsWith('--baseline='))?.split('=')[1],
        candidateModelPath: process.argv.find(a => a.startsWith('--candidate='))?.split('=')[1],
        maxPlies: 220,
        aRate: 0.2,
        bRate: 0.2,
    };

    if (!args.baselineModelPath || !args.candidateModelPath) {
        console.error('Usage: node benchmark-policy-adoption-sprt.js --baseline=<path> --candidate=<path> [--games=120] [--seed=1]');
        process.exit(1);
    }

    const result = await runSPRTAdoption(args);
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.passed ? 0 : 1);
}

if (require.main === module) {
    main().catch(err => {
        console.error(err);
        process.exit(1);
    });
}

module.exports = { runSPRTAdoption };
