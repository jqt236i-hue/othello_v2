#!/usr/bin/env node
// @ts-nocheck

'use strict';

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import _selfplay_teacher_defaults from './selfplay-teacher-defaults';
import _selfplay_training_arg_utils from './selfplay-training-arg-utils';
const { getStandaloneSelfplayTeacherDefaults } = _selfplay_teacher_defaults;
const {
    parsePolicyModelPoolPaths,
    validateSelfplayTeacherRangeArgs,
    validateSelfplayPolicyModelArgs
} = _selfplay_training_arg_utils;

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

function parseArgs(argv: string[]) {
    const teacherDefaults = getStandaloneSelfplayTeacherDefaults();
    const args = {
        games: 100,
        seed: 1,
        maxPlies: 220,
        out: path.resolve(process.cwd(), 'data', 'selfplay.ndjson'),
        workers: 10,
        seedStride: 1000003,
        allowCardUsage: true,
        cardUsageRate: 0.2,
        policyMixRate: teacherDefaults.policyMixRate,
        cardUsageRateJitter: 0,
        tacticalWeightMin: teacherDefaults.tacticalWeightMin,
        tacticalWeightMax: teacherDefaults.tacticalWeightMax,
        tacticalDepthOpening: teacherDefaults.tacticalDepthOpening,
        tacticalDepthMid: teacherDefaults.tacticalDepthMid,
        tacticalDepthEnd: teacherDefaults.tacticalDepthEnd,
        tacticalBeamWidth: teacherDefaults.tacticalBeamWidth,
        teacherCommitteeWeightMin: teacherDefaults.teacherCommitteeWeightMin,
        teacherCommitteeWeightMax: teacherDefaults.teacherCommitteeWeightMax,
        teacherCommitteeConsensusBonusMin: teacherDefaults.teacherCommitteeConsensusBonusMin,
        teacherCommitteeConsensusBonusMax: teacherDefaults.teacherCommitteeConsensusBonusMax,
        policyScoreWeightMin: teacherDefaults.policyScoreWeightMin,
        policyScoreWeightMax: teacherDefaults.policyScoreWeightMax,
        heuristicWeightMin: teacherDefaults.heuristicWeightMin,
        heuristicWeightMax: teacherDefaults.heuristicWeightMax,
        policyModelPath: null,
        policyModelPoolPaths: [],
        policyPoolSampling: teacherDefaults.policyPoolSampling,
        policyPoolRecencyDecay: teacherDefaults.policyPoolRecencyDecay,
        policyCurrentAnchorRate: teacherDefaults.policyCurrentAnchorRate,
        keepParts: false,
        verbose: false,
        help: false
    };

    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--help' || a === '-h') { args.help = true; continue; }
        if (a === '--games' || a === '-g') { args.games = Number(argv[++i]); continue; }
        if (a === '--seed' || a === '-s') { args.seed = Number(argv[++i]); continue; }
        if (a === '--max-plies') { args.maxPlies = Number(argv[++i]); continue; }
        if (a === '--out' || a === '-o') { args.out = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--workers' || a === '-w') { args.workers = Number(argv[++i]); continue; }
        if (a === '--seed-stride') { args.seedStride = Number(argv[++i]); continue; }
        if (a === '--with-cards') { args.allowCardUsage = true; continue; }
        if (a === '--no-cards') { args.allowCardUsage = false; continue; }
        if (a === '--card-usage-rate') { args.cardUsageRate = Number(argv[++i]); continue; }
        if (a === '--policy-mix-rate') { args.policyMixRate = Number(argv[++i]); continue; }
        if (a === '--card-usage-rate-jitter') { args.cardUsageRateJitter = Number(argv[++i]); continue; }
        if (a === '--tactical-weight-min') { args.tacticalWeightMin = Number(argv[++i]); continue; }
        if (a === '--tactical-weight-max') { args.tacticalWeightMax = Number(argv[++i]); continue; }
        if (a === '--tactical-depth-opening') { args.tacticalDepthOpening = Number(argv[++i]); continue; }
        if (a === '--tactical-depth-mid') { args.tacticalDepthMid = Number(argv[++i]); continue; }
        if (a === '--tactical-depth-end') { args.tacticalDepthEnd = Number(argv[++i]); continue; }
        if (a === '--tactical-beam-width') { args.tacticalBeamWidth = Number(argv[++i]); continue; }
        if (a === '--teacher-committee-weight-min') { args.teacherCommitteeWeightMin = Number(argv[++i]); continue; }
        if (a === '--teacher-committee-weight-max') { args.teacherCommitteeWeightMax = Number(argv[++i]); continue; }
        if (a === '--teacher-committee-consensus-bonus-min') { args.teacherCommitteeConsensusBonusMin = Number(argv[++i]); continue; }
        if (a === '--teacher-committee-consensus-bonus-max') { args.teacherCommitteeConsensusBonusMax = Number(argv[++i]); continue; }
        if (a === '--policy-score-weight-min') { args.policyScoreWeightMin = Number(argv[++i]); continue; }
        if (a === '--policy-score-weight-max') { args.policyScoreWeightMax = Number(argv[++i]); continue; }
        if (a === '--heuristic-weight-min') { args.heuristicWeightMin = Number(argv[++i]); continue; }
        if (a === '--heuristic-weight-max') { args.heuristicWeightMax = Number(argv[++i]); continue; }
        if (a === '--policy-model') { args.policyModelPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--policy-model-pool') {
            args.policyModelPoolPaths.push(...parsePolicyModelPoolPaths(argv[++i]));
            continue;
        }
        if (a === '--keep-parts') { args.keepParts = true; continue; }
        if (a === '--policy-pool-sampling') { args.policyPoolSampling = String(argv[++i] || '').trim().toLowerCase(); continue; }
        if (a === '--policy-pool-recency-decay') { args.policyPoolRecencyDecay = Number(argv[++i]); continue; }
        if (a === '--policy-current-anchor-rate') { args.policyCurrentAnchorRate = Number(argv[++i]); continue; }
        if (a === '--verbose') { args.verbose = true; continue; }
    }

    if (args.help) return args;
    if (!Number.isFinite(args.games) || args.games < 1) throw new Error('--games must be >= 1');
    if (!Number.isFinite(args.seed)) throw new Error('--seed must be a number');
    if (!Number.isFinite(args.maxPlies) || args.maxPlies < 1) throw new Error('--max-plies must be >= 1');
    if (!Number.isFinite(args.workers) || args.workers < 1) throw new Error('--workers must be >= 1');
    args.workers = Math.floor(args.workers);
    if (!Number.isFinite(args.seedStride) || args.seedStride < 1) throw new Error('--seed-stride must be >= 1');
    if (!Number.isFinite(args.cardUsageRate) || args.cardUsageRate < 0 || args.cardUsageRate > 1) {
        throw new Error('--card-usage-rate must be in [0,1]');
    }
    if (!Number.isFinite(args.policyMixRate) || args.policyMixRate < 0 || args.policyMixRate > 1) {
        throw new Error('--policy-mix-rate must be in [0,1]');
    }
    if (!Number.isFinite(args.cardUsageRateJitter) || args.cardUsageRateJitter < 0 || args.cardUsageRateJitter > 1) {
        throw new Error('--card-usage-rate-jitter must be in [0,1]');
    }
    validateSelfplayTeacherRangeArgs(args);
    validateSelfplayPolicyModelArgs(args, fs);
    return args;
}

function printHelp() {
    const teacherDefaults = getStandaloneSelfplayTeacherDefaults();
    console.log([
        'Usage:',
        '  node scripts/generate-selfplay-data-parallel.js [options]',
        '',
        'Options:',
        '  -g, --games <n>            Number of self-play games (default: 100)',
        '  -s, --seed <n>             Base seed (default: 1)',
        '      --max-plies <n>        Max plies per game (default: 220)',
        '  -o, --out <path>           Output NDJSON path (default: data/selfplay.ndjson)',
        '  -w, --workers <n>          Parallel worker count (default: 10)',
        '      --seed-stride <n>      Seed step per worker (default: 1000003)',
        '      --with-cards           Enable card usage in self-play (default: on)',
        '      --no-cards             Disable card usage in self-play',
        '      --card-usage-rate <r>  Probability of using card if legal (default: 0.2)',
        `      --policy-mix-rate <r>  Per-player probability of using guide model each game [0..1] (default: ${teacherDefaults.policyMixRate})`,
        '      --card-usage-rate-jitter <r>  Per-game card usage rate jitter (+/-r) [0..1] (default: 0)',
        `      --tactical-weight-min <r>  Min tactical lookahead weight when guide model is used (default: ${teacherDefaults.tacticalWeightMin})`,
        `      --tactical-weight-max <r>  Max tactical lookahead weight when guide model is used (default: ${teacherDefaults.tacticalWeightMax})`,
        `      --tactical-depth-opening <n> Tactical search depth in opening phase (default: ${teacherDefaults.tacticalDepthOpening})`,
        `      --tactical-depth-mid <n>  Tactical search depth in mid phase (default: ${teacherDefaults.tacticalDepthMid})`,
        `      --tactical-depth-end <n>  Tactical search depth in end phase (default: ${teacherDefaults.tacticalDepthEnd})`,
        `      --tactical-beam-width <n> Tactical search beam width (0=auto, default: ${teacherDefaults.tacticalBeamWidth})`,
        `      --teacher-committee-weight-min <r> Min committee voting weight for teacher placement selection (default: ${teacherDefaults.teacherCommitteeWeightMin})`,
        `      --teacher-committee-weight-max <r> Max committee voting weight for teacher placement selection (default: ${teacherDefaults.teacherCommitteeWeightMax})`,
        `      --teacher-committee-consensus-bonus-min <r> Min committee consensus bonus for teacher placement selection (default: ${teacherDefaults.teacherCommitteeConsensusBonusMin})`,
        `      --teacher-committee-consensus-bonus-max <r> Max committee consensus bonus for teacher placement selection (default: ${teacherDefaults.teacherCommitteeConsensusBonusMax})`,
        `      --policy-score-weight-min <r>  Min model score weight when guide model is used (default: ${teacherDefaults.policyScoreWeightMin})`,
        `      --policy-score-weight-max <r>  Max model score weight when guide model is used (default: ${teacherDefaults.policyScoreWeightMax})`,
        `      --heuristic-weight-min <r>  Min heuristic score weight (default: ${teacherDefaults.heuristicWeightMin})`,
        `      --heuristic-weight-max <r>  Max heuristic score weight (default: ${teacherDefaults.heuristicWeightMax})`,
        '      --policy-model <path>  Optional policy-table JSON used by both players',
        '      --policy-model-pool <paths> Comma-separated model paths for league-style mixed self-play',
        `      --policy-pool-sampling <mode> Model pool sampling mode: uniform|recency (default: ${teacherDefaults.policyPoolSampling})`,
        `      --policy-pool-recency-decay <r> Recency decay (>0) when using recency sampling (default: ${teacherDefaults.policyPoolRecencyDecay})`,
        `      --policy-current-anchor-rate <r> Probability to anchor one side to current model [0..1] (default: ${teacherDefaults.policyCurrentAnchorRate})`,
        '      --keep-parts           Keep shard files for debugging',
        '      --verbose              Keep internal game debug logs',
        '  -h, --help                 Show this help'
    ].join('\n'));
}

function splitGames(totalGames: any, workers: any) {
    const actualWorkers = Math.max(1, Math.min(workers, totalGames));
    const base = Math.floor(totalGames / actualWorkers);
    const rem = totalGames % actualWorkers;
    const chunks = [];
    for (let i = 0; i < actualWorkers; i++) {
        chunks.push(base + (i < rem ? 1 : 0));
    }
    return chunks;
}

function pipeWithPrefix(stream: any, prefix: any, target: any) {
    let buf = '';
    stream.on('data', (chunk: any) => {
        buf += chunk.toString();
        const lines = buf.split(/\r?\n/);
        buf = lines.pop() || '';
        for (const line of lines) {
            if (!line) continue;
            target.write(`${prefix}${line}\n`);
        }
    });
    stream.on('end', () => {
        if (buf) target.write(`${prefix}${buf}\n`);
    });
}

function runShard(index: any, shard: any, args: any, partDir: any) {
    return new Promise((resolve: any, reject: any) => {
        const partOut = path.join(partDir, `part.${String(index + 1).padStart(3, '0')}.ndjson`);
        const cmdArgs = [
            path.resolve(process.cwd(), 'scripts', 'generate-selfplay-data.js'),
            '--games', String(shard.games),
            '--seed', String(shard.seed),
            '--max-plies', String(args.maxPlies),
            '--out', partOut
        ];
        if (args.allowCardUsage) {
            cmdArgs.push('--with-cards', '--card-usage-rate', String(args.cardUsageRate));
        } else {
            cmdArgs.push('--no-cards', '--card-usage-rate', '0');
        }
        cmdArgs.push(
            '--policy-mix-rate', String(args.policyMixRate),
            '--card-usage-rate-jitter', String(args.cardUsageRateJitter),
            '--tactical-weight-min', String(args.tacticalWeightMin),
            '--tactical-weight-max', String(args.tacticalWeightMax),
            '--tactical-depth-opening', String(args.tacticalDepthOpening),
            '--tactical-depth-mid', String(args.tacticalDepthMid),
            '--tactical-depth-end', String(args.tacticalDepthEnd),
            '--tactical-beam-width', String(args.tacticalBeamWidth),
            '--teacher-committee-weight-min', String(args.teacherCommitteeWeightMin),
            '--teacher-committee-weight-max', String(args.teacherCommitteeWeightMax),
            '--teacher-committee-consensus-bonus-min', String(args.teacherCommitteeConsensusBonusMin),
            '--teacher-committee-consensus-bonus-max', String(args.teacherCommitteeConsensusBonusMax),
            '--policy-score-weight-min', String(args.policyScoreWeightMin),
            '--policy-score-weight-max', String(args.policyScoreWeightMax),
            '--heuristic-weight-min', String(args.heuristicWeightMin),
            '--heuristic-weight-max', String(args.heuristicWeightMax)
        );
        if (args.policyModelPath) cmdArgs.push('--policy-model', args.policyModelPath);
        if (Array.isArray(args.policyModelPoolPaths) && args.policyModelPoolPaths.length > 0) {
            cmdArgs.push('--policy-model-pool', args.policyModelPoolPaths.join(','));
        }
        cmdArgs.push(
            '--policy-pool-sampling', String(args.policyPoolSampling),
            '--policy-pool-recency-decay', String(args.policyPoolRecencyDecay),
            '--policy-current-anchor-rate', String(args.policyCurrentAnchorRate)
        );
        if (args.verbose) cmdArgs.push('--verbose');

        const child = spawn(process.execPath, cmdArgs, { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] });
        const prefix = `[selfplay:w${index + 1}] `;
        pipeWithPrefix(child.stdout, prefix, process.stdout);
        pipeWithPrefix(child.stderr, prefix, process.stderr);

        child.on('error', (err: any) => reject(err));
        child.on('close', (code: any) => {
            if (code !== 0) {
                reject(new Error(`worker ${index + 1} failed with exit=${code}`));
                return;
            }
            resolve({
                worker: index + 1,
                games: shard.games,
                seed: shard.seed,
                out: partOut,
                summary: `${partOut}.summary.json`
            });
        });
    });
}

function mergeNdjson(partFiles: any, outPath: any) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    const outFd = fs.openSync(outPath, 'w');
    const chunkSize = 1024 * 1024; // 1MB
    const buffer = Buffer.allocUnsafe(chunkSize);
    try {
        for (const file of partFiles) {
            const inFd = fs.openSync(file, 'r');
            try {
                while (true) {
                    const readBytes = fs.readSync(inFd, buffer, 0, chunkSize, null);
                    if (readBytes <= 0) break;
                    fs.writeSync(outFd, buffer, 0, readBytes);
                }
            } finally {
                fs.closeSync(inFd);
            }
        }
    } finally {
        fs.closeSync(outFd);
    }
}

function buildMergedSummary(parts: any, args: any, elapsedMs: any) {
    const wins = { black: 0, white: 0, draw: 0 };
    let totalGames = 0;
    let weightedPlies = 0;
    for (const p of parts) {
        const payload = JSON.parse(fs.readFileSync(p.summary, 'utf8'));
        const s = payload.summary || {};
        const g = Number(s.totalGames || 0);
        totalGames += g;
        weightedPlies += g * Number(s.avgPlies || 0);
        wins.black += Number((s.wins && s.wins.black) || 0);
        wins.white += Number((s.wins && s.wins.white) || 0);
        wins.draw += Number((s.wins && s.wins.draw) || 0);
    }

    return {
        generatedAt: new Date().toISOString(),
        elapsedMs,
        schemaVersion: 'policy_table.v2',
        config: {
            games: args.games,
            seed: args.seed,
            maxPlies: args.maxPlies,
            allowCardUsage: args.allowCardUsage,
            cardUsageRate: args.allowCardUsage ? args.cardUsageRate : 0,
            policyMixRate: args.policyMixRate,
            cardUsageRateJitter: args.cardUsageRateJitter,
            tacticalWeightMin: args.tacticalWeightMin,
            tacticalWeightMax: args.tacticalWeightMax,
            tacticalDepthOpening: args.tacticalDepthOpening,
            tacticalDepthMid: args.tacticalDepthMid,
            tacticalDepthEnd: args.tacticalDepthEnd,
            tacticalBeamWidth: args.tacticalBeamWidth,
            teacherCommitteeWeightMin: args.teacherCommitteeWeightMin,
            teacherCommitteeWeightMax: args.teacherCommitteeWeightMax,
            teacherCommitteeConsensusBonusMin: args.teacherCommitteeConsensusBonusMin,
            teacherCommitteeConsensusBonusMax: args.teacherCommitteeConsensusBonusMax,
            policyScoreWeightMin: args.policyScoreWeightMin,
            policyScoreWeightMax: args.policyScoreWeightMax,
            heuristicWeightMin: args.heuristicWeightMin,
            heuristicWeightMax: args.heuristicWeightMax,
            workers: parts.length,
            hasPolicyModel: !!args.policyModelPath,
            policyModelPath: args.policyModelPath || null,
            policyModelPoolPaths: Array.isArray(args.policyModelPoolPaths) ? args.policyModelPoolPaths : [],
            policyModelPoolSize: Array.isArray(args.policyModelPoolPaths) ? args.policyModelPoolPaths.length : 0,
            policyPoolSampling: args.policyPoolSampling,
            policyPoolRecencyDecay: args.policyPoolRecencyDecay,
            policyCurrentAnchorRate: args.policyCurrentAnchorRate
        },
        summary: {
            totalGames,
            avgPlies: totalGames > 0 ? (weightedPlies / totalGames) : 0,
            wins
        },
        shards: parts.map((p: any) => ({
            worker: p.worker,
            games: p.games,
            seed: p.seed,
            out: p.out,
            summary: p.summary
        }))
    };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        printHelp();
        return;
    }

    const chunks = splitGames(args.games, args.workers);
    const shardSpecs = chunks.map((games: any, idx: any) => ({
        games,
        seed: args.seed + (idx * args.seedStride)
    }));
    const partDir = `${args.out}.parts`;
    fs.mkdirSync(partDir, { recursive: true });

    const startedAt = Date.now();
    const workers = shardSpecs.map((shard: any, idx: any) => runShard(idx, shard, args, partDir));
    const parts = await Promise.all(workers);
    mergeNdjson(parts.map((p: any) => p.out), args.out);

    const summaryPayload = buildMergedSummary(parts, args, Date.now() - startedAt);
    const summaryPath = `${args.out}.summary.json`;
    fs.writeFileSync(summaryPath, JSON.stringify(summaryPayload, null, 2), 'utf8');

    if (!args.keepParts) {
        for (const p of parts) {
            if (fs.existsSync(p.out)) fs.unlinkSync(p.out);
            if (fs.existsSync(p.summary)) fs.unlinkSync(p.summary);
        }
        fs.rmSync(partDir, { recursive: true, force: true });
    }

    console.log(`[selfplay-parallel] records: ${args.out}`);
    console.log(`[selfplay-parallel] summary: ${summaryPath}`);
    console.log(`[selfplay-parallel] totalGames=${summaryPayload.summary.totalGames} avgPlies=${summaryPayload.summary.avgPlies.toFixed(2)} wins=${JSON.stringify(summaryPayload.summary.wins)} workers=${parts.length}`);
}

if (require.main === module) {
    main().catch((err: any) => {
        console.error('[selfplay-parallel] failed:', err && err.message ? err.message : err);
        process.exit(1);
    });
}

export = {
    parseArgs,
    splitGames,
    mergeNdjson
};
