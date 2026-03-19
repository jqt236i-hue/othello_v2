#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function loadResolvedTrainingConfig(filePath) {
    if (!filePath) return null;
    const resolvedPath = path.resolve(process.cwd(), String(filePath));
    const raw = fs.readFileSync(resolvedPath, 'utf8');
    const payload = JSON.parse(raw);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error(`resolved training config must be an object: ${resolvedPath}`);
    }
    return payload;
}

function collectTrainCycleArgs(resolved) {
    if (!resolved || typeof resolved !== 'object') return [];
    let args = [];
    if (resolved.command && Array.isArray(resolved.command.args)) {
        args = resolved.command.args.slice();
    }
    if (args.length > 0 && /\.js$/i.test(String(args[0] || ''))) {
        args = args.slice(1);
    }
    return args.map((one) => String(one));
}

function buildTrainCycleArgMap(resolved) {
    const args = collectTrainCycleArgs(resolved);
    const map = new Map();
    for (let i = 0; i < args.length; i++) {
        const token = String(args[i] || '').trim();
        if (!token.startsWith('--')) continue;
        const next = String(args[i + 1] || '').trim();
        if (next && !next.startsWith('--')) {
            map.set(token, next);
            i += 1;
            continue;
        }
        map.set(token, true);
    }
    return map;
}

function getFlagValue(argMap, flag) {
    if (!(argMap instanceof Map)) return undefined;
    return argMap.has(flag) ? argMap.get(flag) : undefined;
}

function hasFlag(argMap, flag) {
    return getFlagValue(argMap, flag) !== undefined;
}

function setIfMissing(target, specified, key, value) {
    if (!target || typeof target !== 'object') return;
    if (specified && specified.has(key)) return;
    if (value === undefined) return;
    target[key] = value;
}

function setNumberFromFlag(target, specified, key, argMap, flag) {
    const raw = getFlagValue(argMap, flag);
    if (raw === undefined || raw === true) return;
    const num = Number(raw);
    if (!Number.isFinite(num)) return;
    setIfMissing(target, specified, key, num);
}

function setStringFromFlag(target, specified, key, argMap, flag) {
    const raw = getFlagValue(argMap, flag);
    if (raw === undefined || raw === true) return;
    const value = String(raw || '').trim();
    if (!value) return;
    setIfMissing(target, specified, key, value);
}

function setPathIfMissing(target, specified, key, rawPath) {
    if (!rawPath) return;
    setIfMissing(target, specified, key, path.resolve(process.cwd(), String(rawPath)));
}

function applySelfplayArgsFromResolvedConfig(target, specified, resolved) {
    const argMap = buildTrainCycleArgMap(resolved);
    const seedFamily = String(target && target.seedFamily ? target.seedFamily : 'train').trim().toLowerCase();
    const gamesFlag = seedFamily === 'eval' ? '--eval-games' : '--train-games';
    setNumberFromFlag(target, specified, 'games', argMap, gamesFlag);
    setNumberFromFlag(target, specified, 'maxPlies', argMap, '--max-plies');
    setNumberFromFlag(target, specified, 'jobs', argMap, '--selfplay-jobs');
    setNumberFromFlag(target, specified, 'cardUsageRate', argMap, '--card-usage-rate');
    setNumberFromFlag(target, specified, 'policyMixRate', argMap, '--selfplay-policy-mix-rate');
    setNumberFromFlag(target, specified, 'cardUsageRateJitter', argMap, '--selfplay-card-usage-rate-jitter');
    setNumberFromFlag(target, specified, 'tacticalWeightMin', argMap, '--selfplay-tactical-weight-min');
    setNumberFromFlag(target, specified, 'tacticalWeightMax', argMap, '--selfplay-tactical-weight-max');
    setNumberFromFlag(target, specified, 'tacticalDepthOpening', argMap, '--selfplay-tactical-depth-opening');
    setNumberFromFlag(target, specified, 'tacticalDepthMid', argMap, '--selfplay-tactical-depth-mid');
    setNumberFromFlag(target, specified, 'tacticalDepthEnd', argMap, '--selfplay-tactical-depth-end');
    setNumberFromFlag(target, specified, 'tacticalBeamWidth', argMap, '--selfplay-tactical-beam-width');
    setNumberFromFlag(target, specified, 'teacherCommitteeWeightMin', argMap, '--selfplay-teacher-committee-weight-min');
    setNumberFromFlag(target, specified, 'teacherCommitteeWeightMax', argMap, '--selfplay-teacher-committee-weight-max');
    setNumberFromFlag(target, specified, 'teacherCommitteeConsensusBonusMin', argMap, '--selfplay-teacher-committee-consensus-bonus-min');
    setNumberFromFlag(target, specified, 'teacherCommitteeConsensusBonusMax', argMap, '--selfplay-teacher-committee-consensus-bonus-max');
    setNumberFromFlag(target, specified, 'policyScoreWeightMin', argMap, '--selfplay-policy-score-weight-min');
    setNumberFromFlag(target, specified, 'policyScoreWeightMax', argMap, '--selfplay-policy-score-weight-max');
    setNumberFromFlag(target, specified, 'heuristicWeightMin', argMap, '--selfplay-heuristic-weight-min');
    setNumberFromFlag(target, specified, 'heuristicWeightMax', argMap, '--selfplay-heuristic-weight-max');

    if (!specified || !specified.has('allowCardUsage')) {
        if (hasFlag(argMap, '--with-cards')) target.allowCardUsage = true;
        else if (hasFlag(argMap, '--no-cards')) target.allowCardUsage = false;
    }

    const bootstrapPath = resolved && resolved.bootstrap ? resolved.bootstrap.bootstrapPolicyModelPath : null;
    if (!specified || !specified.has('policyModelPath')) {
        if (bootstrapPath) setPathIfMissing(target, specified, 'policyModelPath', bootstrapPath);
    }
}

function applyAdoptionArgsFromResolvedConfig(target, specified, resolved) {
    const argMap = buildTrainCycleArgMap(resolved);
    const gatePhase = String(target && target.gatePhase ? target.gatePhase : 'quality').trim().toLowerCase();
    const isQuick = gatePhase === 'quick';
    const isQuality = gatePhase === 'quality';

    const gamesFlag = isQuick
        ? '--quick-games'
        : (isQuality ? '--quality-gate-games' : '--final-games');
    const seedCountFlag = isQuick
        ? '--quick-adoption-seed-count'
        : (isQuality ? '--quality-gate-seed-count' : '--final-adoption-seed-count');
    const seedStrideFlag = isQuick
        ? '--quick-adoption-seed-stride'
        : (isQuality ? '--quality-gate-seed-stride' : '--final-adoption-seed-stride');
    const thresholdFlag = isQuick
        ? '--quick-adoption-threshold'
        : (isQuality ? '--quality-gate-threshold' : '--final-adoption-threshold');
    const confidenceLevelFlag = isQuick
        ? '--quick-adoption-confidence-level'
        : (isQuality ? '--quality-gate-confidence-level' : '--final-adoption-confidence-level');
    const minLowerBoundFlag = isQuick
        ? '--quick-adoption-min-lower-bound'
        : (isQuality ? '--quality-gate-min-lower-bound' : '--final-adoption-min-lower-bound');
    const minSeedUpliftFlag = isQuick
        ? '--quick-adoption-min-seed-uplift'
        : (isQuality ? '--quality-gate-min-seed-uplift' : '--final-adoption-min-seed-uplift');
    const minSeedPassCountFlag = isQuick
        ? '--quick-adoption-min-seed-pass-count'
        : (isQuality ? '--quality-gate-min-seed-pass-count' : '--final-adoption-min-seed-pass-count');

    setNumberFromFlag(target, specified, 'games', argMap, gamesFlag);
    if (isQuality && (!specified || !specified.has('games'))) {
        setNumberFromFlag(target, specified, 'games', argMap, '--final-games');
    }
    setNumberFromFlag(target, specified, 'seedCount', argMap, seedCountFlag);
    if (isQuality && (!specified || !specified.has('seedCount'))) {
        setNumberFromFlag(target, specified, 'seedCount', argMap, '--adoption-seed-count');
    }
    setNumberFromFlag(target, specified, 'seedStride', argMap, seedStrideFlag);
    if (isQuality && (!specified || !specified.has('seedStride'))) {
        setNumberFromFlag(target, specified, 'seedStride', argMap, '--adoption-seed-stride');
    }
    setNumberFromFlag(target, specified, 'threshold', argMap, thresholdFlag);
    if (isQuality && (!specified || !specified.has('threshold'))) {
        setNumberFromFlag(target, specified, 'threshold', argMap, '--threshold');
    }
    setNumberFromFlag(target, specified, 'confidenceLevel', argMap, confidenceLevelFlag);
    if (isQuality && (!specified || !specified.has('confidenceLevel'))) {
        setNumberFromFlag(target, specified, 'confidenceLevel', argMap, '--adoption-confidence-level');
    }
    setNumberFromFlag(target, specified, 'minLowerBound', argMap, minLowerBoundFlag);
    if (isQuality && (!specified || !specified.has('minLowerBound'))) {
        setNumberFromFlag(target, specified, 'minLowerBound', argMap, '--adoption-min-lower-bound');
    }
    setNumberFromFlag(target, specified, 'minSeedUplift', argMap, minSeedUpliftFlag);
    if (isQuality && (!specified || !specified.has('minSeedUplift'))) {
        setNumberFromFlag(target, specified, 'minSeedUplift', argMap, '--adoption-min-seed-uplift');
    }
    setNumberFromFlag(target, specified, 'minSeedPassCount', argMap, minSeedPassCountFlag);
    if (isQuality && (!specified || !specified.has('minSeedPassCount'))) {
        setNumberFromFlag(target, specified, 'minSeedPassCount', argMap, '--adoption-min-seed-pass-count');
    }

    setNumberFromFlag(target, specified, 'jobs', argMap, '--adoption-jobs');
    setNumberFromFlag(target, specified, 'maxPlies', argMap, '--max-plies');
    setNumberFromFlag(target, specified, 'tacticalWeight', argMap, '--adoption-tactical-weight');
    setNumberFromFlag(target, specified, 'tacticalDepthOpening', argMap, '--adoption-tactical-depth-opening');
    setNumberFromFlag(target, specified, 'tacticalDepthMid', argMap, '--adoption-tactical-depth-mid');
    setNumberFromFlag(target, specified, 'tacticalDepthEnd', argMap, '--adoption-tactical-depth-end');
    setNumberFromFlag(target, specified, 'tacticalBeamWidth', argMap, '--adoption-tactical-beam-width');
    setNumberFromFlag(target, specified, 'policyScoreWeight', argMap, '--adoption-policy-score-weight');
    setNumberFromFlag(target, specified, 'heuristicWeight', argMap, '--adoption-heuristic-weight');
    setNumberFromFlag(target, specified, 'whitePriority', argMap, '--adoption-white-priority');
    setNumberFromFlag(target, specified, 'qualityWeightCorner', argMap, '--adoption-quality-weight-corner');
    setNumberFromFlag(target, specified, 'qualityWeightEdge', argMap, '--adoption-quality-weight-edge');
    setNumberFromFlag(target, specified, 'qualityWeightCornerRecovery', argMap, '--adoption-quality-weight-corner-recovery');
    setNumberFromFlag(target, specified, 'qualityWeightCornerRecapture', argMap, '--adoption-quality-weight-corner-recapture');
    setNumberFromFlag(target, specified, 'qualityWeightEdgeRecovery', argMap, '--adoption-quality-weight-edge-recovery');
    setNumberFromFlag(target, specified, 'qualityWeightCornerHold', argMap, '--adoption-quality-weight-corner-hold');
    setNumberFromFlag(target, specified, 'qualityWeightCornerHoldTurns', argMap, '--adoption-quality-weight-corner-hold-turns');
    setNumberFromFlag(target, specified, 'qualityWeightEdgeHold', argMap, '--adoption-quality-weight-edge-hold');
    setNumberFromFlag(target, specified, 'qualityWeightFinalCornerShare', argMap, '--adoption-quality-weight-final-corner-share');
    setNumberFromFlag(target, specified, 'qualityWeightFinalEdgeShare', argMap, '--adoption-quality-weight-final-edge-share');
    setNumberFromFlag(target, specified, 'qualityWeightBonus', argMap, '--adoption-quality-weight-bonus');
    setNumberFromFlag(target, specified, 'qualityWeightCardImmediate', argMap, '--adoption-quality-weight-card-immediate');
    setNumberFromFlag(target, specified, 'qualityWeightCardFuture', argMap, '--adoption-quality-weight-card-future');
    setNumberFromFlag(target, specified, 'qualityWeightPlaceDelta', argMap, '--adoption-quality-weight-place-delta');
    setNumberFromFlag(target, specified, 'aRate', argMap, '--card-usage-rate');
    setNumberFromFlag(target, specified, 'bRate', argMap, '--card-usage-rate');

    if (!specified || !specified.has('baselineModelPath')) {
        const baselinePath = resolved && resolved.bootstrap ? resolved.bootstrap.bootstrapPolicyModelPath : null;
        if (baselinePath) setPathIfMissing(target, specified, 'baselineModelPath', baselinePath);
    }
}

function applyOnnxGateArgsFromResolvedConfig(target, specified, resolved) {
    const argMap = buildTrainCycleArgMap(resolved);
    setNumberFromFlag(target, specified, 'games', argMap, '--onnx-gate-games');
    setNumberFromFlag(target, specified, 'seedCount', argMap, '--onnx-gate-seed-count');
    setNumberFromFlag(target, specified, 'seedStride', argMap, '--onnx-gate-seed-stride');
    setNumberFromFlag(target, specified, 'threshold', argMap, '--onnx-gate-threshold');
    setNumberFromFlag(target, specified, 'minSeedScore', argMap, '--onnx-gate-min-seed-score');
    setNumberFromFlag(target, specified, 'minSeedPassCount', argMap, '--onnx-gate-min-seed-pass-count');
    setNumberFromFlag(target, specified, 'maxAverageLatencyMs', argMap, '--onnx-gate-max-average-latency-ms');
    setNumberFromFlag(target, specified, 'maxP95LatencyMs', argMap, '--onnx-gate-max-p95-latency-ms');
    setNumberFromFlag(target, specified, 'maxMaxLatencyMs', argMap, '--onnx-gate-max-max-latency-ms');
    setNumberFromFlag(target, specified, 'jobs', argMap, '--onnx-gate-jobs');
    setNumberFromFlag(target, specified, 'timeoutMs', argMap, '--onnx-gate-timeout-ms');
    setNumberFromFlag(target, specified, 'blackLevel', argMap, '--onnx-gate-black-level');
    setNumberFromFlag(target, specified, 'whiteLevel', argMap, '--onnx-gate-white-level');
    setStringFromFlag(target, specified, 'candidateColorMode', argMap, '--onnx-gate-candidate-color-mode');

    if (!specified || !specified.has('targetOnnxPath')) {
        const modelsDir = resolved && resolved.paths ? resolved.paths.modelsDir : null;
        if (modelsDir) setPathIfMissing(target, specified, 'targetOnnxPath', path.join(modelsDir, 'policy-net.onnx'));
    }
    if (!specified || !specified.has('targetOnnxMetaPath')) {
        const modelsDir = resolved && resolved.paths ? resolved.paths.modelsDir : null;
        if (modelsDir) setPathIfMissing(target, specified, 'targetOnnxMetaPath', path.join(modelsDir, 'policy-net.onnx.meta.json'));
    }
    if (!specified || !specified.has('targetCardOnnxPath')) {
        const modelsDir = resolved && resolved.paths ? resolved.paths.modelsDir : null;
        if (modelsDir) setPathIfMissing(target, specified, 'targetCardOnnxPath', path.join(modelsDir, 'policy-card.onnx'));
    }
    if (!specified || !specified.has('targetCardOnnxMetaPath')) {
        const modelsDir = resolved && resolved.paths ? resolved.paths.modelsDir : null;
        if (modelsDir) setPathIfMissing(target, specified, 'targetCardOnnxMetaPath', path.join(modelsDir, 'policy-card.onnx.meta.json'));
    }
    if (!specified || !specified.has('targetTargetOnnxPath')) {
        const modelsDir = resolved && resolved.paths ? resolved.paths.modelsDir : null;
        if (modelsDir) setPathIfMissing(target, specified, 'targetTargetOnnxPath', path.join(modelsDir, 'policy-target.onnx'));
    }
    if (!specified || !specified.has('targetTargetOnnxMetaPath')) {
        const modelsDir = resolved && resolved.paths ? resolved.paths.modelsDir : null;
        if (modelsDir) setPathIfMissing(target, specified, 'targetTargetOnnxMetaPath', path.join(modelsDir, 'policy-target.onnx.meta.json'));
    }
    if (!specified || !specified.has('targetValueOnnxPath')) {
        const modelsDir = resolved && resolved.paths ? resolved.paths.modelsDir : null;
        if (modelsDir) setPathIfMissing(target, specified, 'targetValueOnnxPath', path.join(modelsDir, 'policy-value.onnx'));
    }
    if (!specified || !specified.has('targetValueOnnxMetaPath')) {
        const modelsDir = resolved && resolved.paths ? resolved.paths.modelsDir : null;
        if (modelsDir) setPathIfMissing(target, specified, 'targetValueOnnxMetaPath', path.join(modelsDir, 'policy-value.onnx.meta.json'));
    }
}

module.exports = {
    loadResolvedTrainingConfig,
    buildTrainCycleArgMap,
    applySelfplayArgsFromResolvedConfig,
    applyAdoptionArgsFromResolvedConfig,
    applyOnnxGateArgsFromResolvedConfig
};
