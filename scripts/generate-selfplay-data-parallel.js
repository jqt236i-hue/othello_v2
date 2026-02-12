#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function parseArgs(argv) {
    const args = {
        games: 100,
        seed: 1,
        maxPlies: 220,
        out: path.resolve(process.cwd(), 'data', 'selfplay.ndjson'),
        workers: 4,
        seedStride: 1000003,
        allowCardUsage: true,
        cardUsageRate: 0.2,
        policyModelPath: null,
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
        if (a === '--policy-model') { args.policyModelPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--keep-parts') { args.keepParts = true; continue; }
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
    if (args.policyModelPath && !fs.existsSync(args.policyModelPath)) {
        throw new Error(`--policy-model not found: ${args.policyModelPath}`);
    }
    return args;
}

function printHelp() {
    console.log([
        'Usage:',
        '  node scripts/generate-selfplay-data-parallel.js [options]',
        '',
        'Options:',
        '  -g, --games <n>            Number of self-play games (default: 100)',
        '  -s, --seed <n>             Base seed (default: 1)',
        '      --max-plies <n>        Max plies per game (default: 220)',
        '  -o, --out <path>           Output NDJSON path (default: data/selfplay.ndjson)',
        '  -w, --workers <n>          Parallel worker count (default: 4)',
        '      --seed-stride <n>      Seed step per worker (default: 1000003)',
        '      --with-cards           Enable card usage in self-play (default: on)',
        '      --no-cards             Disable card usage in self-play',
        '      --card-usage-rate <r>  Probability of using card if legal (default: 0.2)',
        '      --policy-model <path>  Optional policy-table JSON used by both players',
        '      --keep-parts           Keep shard files for debugging',
        '      --verbose              Keep internal game debug logs',
        '  -h, --help                 Show this help'
    ].join('\n'));
}

function splitGames(totalGames, workers) {
    const actualWorkers = Math.max(1, Math.min(workers, totalGames));
    const base = Math.floor(totalGames / actualWorkers);
    const rem = totalGames % actualWorkers;
    const chunks = [];
    for (let i = 0; i < actualWorkers; i++) {
        chunks.push(base + (i < rem ? 1 : 0));
    }
    return chunks;
}

function pipeWithPrefix(stream, prefix, target) {
    let buf = '';
    stream.on('data', (chunk) => {
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

function runShard(index, shard, args, partDir) {
    return new Promise((resolve, reject) => {
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
        if (args.policyModelPath) cmdArgs.push('--policy-model', args.policyModelPath);
        if (args.verbose) cmdArgs.push('--verbose');

        const child = spawn(process.execPath, cmdArgs, { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] });
        const prefix = `[selfplay:w${index + 1}] `;
        pipeWithPrefix(child.stdout, prefix, process.stdout);
        pipeWithPrefix(child.stderr, prefix, process.stderr);

        child.on('error', (err) => reject(err));
        child.on('close', (code) => {
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

function mergeNdjson(partFiles, outPath) {
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

function buildMergedSummary(parts, args, elapsedMs) {
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
            workers: parts.length,
            hasPolicyModel: !!args.policyModelPath,
            policyModelPath: args.policyModelPath || null
        },
        summary: {
            totalGames,
            avgPlies: totalGames > 0 ? (weightedPlies / totalGames) : 0,
            wins
        },
        shards: parts.map((p) => ({
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
    const shardSpecs = chunks.map((games, idx) => ({
        games,
        seed: args.seed + (idx * args.seedStride)
    }));
    const partDir = `${args.out}.parts`;
    fs.mkdirSync(partDir, { recursive: true });

    const startedAt = Date.now();
    const workers = shardSpecs.map((shard, idx) => runShard(idx, shard, args, partDir));
    const parts = await Promise.all(workers);
    mergeNdjson(parts.map((p) => p.out), args.out);

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
    main().catch((err) => {
        console.error('[selfplay-parallel] failed:', err && err.message ? err.message : err);
        process.exit(1);
    });
}

module.exports = {
    parseArgs,
    splitGames,
    mergeNdjson
};
