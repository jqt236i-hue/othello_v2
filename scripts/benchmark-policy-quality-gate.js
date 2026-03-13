#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
    parseArgs: parseAdoptionArgs,
    computeAdoptionDecisionAverage,
    runAdoptionCheck,
    runAdoptionCheckParallel
} = require('./benchmark-policy-adoption');

const DEFAULT_QUALITY_WEIGHTS = Object.freeze({
    qualityWeightCorner: 0.20,
    qualityWeightEdge: 0.10,
    qualityWeightCornerRecovery: 0.15,
    qualityWeightCornerRecapture: 0.15,
    qualityWeightEdgeRecovery: 0.10,
    qualityWeightCornerHold: 0.08,
    qualityWeightCornerHoldTurns: 0.05,
    qualityWeightEdgeHold: 0.05,
    qualityWeightFinalCornerShare: 0.04,
    qualityWeightFinalEdgeShare: 0.03,
    qualityWeightBonus: 0.02,
    qualityWeightCardImmediate: 0.01,
    qualityWeightCardFuture: 0.01,
    qualityWeightPlaceDelta: 0.01
});

const QUALITY_WEIGHT_KEYS = Object.freeze(Object.keys(DEFAULT_QUALITY_WEIGHTS));

function parseArgs(argv) {
    const args = parseAdoptionArgs(argv);
    args.gatePhase = 'quality';
    const hasExplicitQualityWeights = QUALITY_WEIGHT_KEYS.some((key) => Number(args[key]) > 0);
    if (!hasExplicitQualityWeights) {
        for (const key of QUALITY_WEIGHT_KEYS) {
            args[key] = DEFAULT_QUALITY_WEIGHTS[key];
        }
    }
    return args;
}

function buildQualitySeedDecision(seedDecision, threshold) {
    const baselineQualityScore = Number(seedDecision && seedDecision.baselineQualityScore) || 0;
    const candidateQualityScore = Number(seedDecision && seedDecision.candidateQualityScore) || 0;
    const uplift = candidateQualityScore - baselineQualityScore;
    return {
        baselineScore: baselineQualityScore,
        candidateScore: candidateQualityScore,
        uplift,
        threshold,
        passed: uplift >= threshold,
        baselineQualityScore,
        candidateQualityScore,
        qualityWeights: seedDecision && seedDecision.qualityWeights ? seedDecision.qualityWeights : null
    };
}

function buildQualityGatePayload(adoptionPayload, options) {
    const perSeed = Array.isArray(adoptionPayload && adoptionPayload.perSeed)
        ? adoptionPayload.perSeed.map((entry) => Object.assign({}, entry, {
            qualityDecision: buildQualitySeedDecision(entry && entry.decision, options.threshold)
        }))
        : [];
    const decision = computeAdoptionDecisionAverage(
        perSeed.map((entry) => entry.qualityDecision),
        options.threshold,
        options.minSeedUplift,
        options.minSeedPassCount,
        options.confidenceLevel,
        options.minLowerBound
    );

    return {
        generatedAt: new Date().toISOString(),
        schemaVersion: adoptionPayload && adoptionPayload.schemaVersion ? adoptionPayload.schemaVersion : null,
        gateType: 'quality',
        config: {
            games: options.games,
            seed: options.seed,
            seedCount: options.seedCount,
            seedStride: options.seedStride,
            jobs: options.jobs,
            maxPlies: options.maxPlies,
            threshold: options.threshold,
            confidenceLevel: options.confidenceLevel,
            minLowerBound: options.minLowerBound,
            minSeedUplift: options.minSeedUplift,
            minSeedPassCount: options.minSeedPassCount,
            candidateModelPath: options.candidateModelPath,
            baselineModelPath: options.baselineModelPath || null,
            opponentModelPath: options.opponentModelPath || null,
            qualityWeights: QUALITY_WEIGHT_KEYS.reduce((acc, key) => {
                acc[key] = Number(options[key]) || 0;
                return acc;
            }, {})
        },
        baseline: adoptionPayload && adoptionPayload.baseline ? adoptionPayload.baseline : null,
        candidate: adoptionPayload && adoptionPayload.candidate ? adoptionPayload.candidate : null,
        perSeed,
        decision,
        sourceDecision: adoptionPayload && adoptionPayload.decision ? adoptionPayload.decision : null
    };
}

async function runQualityGate(options) {
    const adoptionPayload = ((options.jobs || 1) <= 1 || (options.seedCount || 1) <= 1)
        ? runAdoptionCheck(options)
        : await runAdoptionCheckParallel(options);
    return buildQualityGatePayload(adoptionPayload, options);
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const result = await runQualityGate(args);
    if (args.out) {
        fs.mkdirSync(path.dirname(args.out), { recursive: true });
        fs.writeFileSync(args.out, JSON.stringify(result, null, 2), 'utf8');
        console.log(`[policy-quality-gate] wrote: ${args.out}`);
    }
    const d = result.decision;
    console.log(
        `[policy-quality-gate] baseline_quality=${d.baselineScore.toFixed(3)} candidate_quality=${d.candidateScore.toFixed(3)} ` +
        `uplift=${d.uplift.toFixed(3)} uplift_lb=${d.upliftLowerBound.toFixed(3)} threshold=${d.threshold.toFixed(3)} ` +
        `seeds=${d.seedCount || 1} seed_pass=${d.seedPassCount || 0}/${d.seedCount || 0} pass=${d.passed}`
    );
    process.exit(d.passed ? 0 : 2);
}

if (require.main === module) {
    main().catch((err) => {
        console.error('[policy-quality-gate] failed:', err && err.message ? err.message : err);
        process.exit(1);
    });
}

module.exports = {
    DEFAULT_QUALITY_WEIGHTS,
    parseArgs,
    buildQualitySeedDecision,
    buildQualityGatePayload,
    runQualityGate
};
