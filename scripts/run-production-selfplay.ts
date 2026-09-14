#!/usr/bin/env node
import fs = require('node:fs');
import path = require('node:path');
import crypto = require('node:crypto');
import zlib = require('node:zlib');
import os = require('node:os');
import { ProductionMatch, createProductionPosition, createProductionCpu, stepProductionCpu,
    productionStateKey, type ProductionTransition, type ProductionCpu } from '../src/engine/production-match';
import type { Lv10Player } from '../game/ai/cpu-lv10-position';
import type { Lv10TurnRecord } from '../game/cpu-lv10-turn';
import Startup = require('../shared/cpu-opponent-startup-options');

export type ProductionPolicySpec = {
    root: string; module: string; search: string; config: string; turnModule?: string;
    maxTransitions?: number; maxMs?: number;
};
export type ProductionGameSpec = {
    seed: number; out: string; profiles: Record<Lv10Player, number | string>;
    policies: Record<Lv10Player, ProductionPolicySpec>;
    maxDecisions?: number; timeoutMs?: number; stopFile?: string;
    resumeFrom?: string;
};
const hash = (value: string | Buffer) => crypto.createHash('sha256').update(value).digest('hex');

export function productionRuntimeManifest(rootInput: string) {
    const root = path.resolve(rootInput), files: any[] = [];
    const walk = (relative: string) => {
        for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
            const name = path.posix.join(relative, entry.name);
            if (entry.isDirectory()) walk(name);
            else if (entry.isFile()) { const bytes = fs.readFileSync(path.join(root, name)); files.push({ path: name, size: bytes.length, sha256: hash(bytes) }); }
        }
    };
    for (const dir of ['dist/game', 'dist/shared', 'dist/constants', 'dist/utils', 'dist/cards']) walk(dir);
    for (const name of ['dist/shared-constants.js', 'cards/catalog.json', 'package.json', 'package-lock.json']) {
        const bytes = fs.readFileSync(path.join(root, name)); files.push({ path: name, size: bytes.length, sha256: hash(bytes) });
    }
    for (const name of ['dist/src/engine/production-match.js', 'dist/scripts/run-production-selfplay.js']) {
        if (!fs.existsSync(path.join(root, name))) continue;
        const bytes = fs.readFileSync(path.join(root, name)); files.push({ path: name, size: bytes.length, sha256: hash(bytes) });
    }
    files.sort((a, b) => a.path.localeCompare(b.path));
    return { root, files, sha256: hash(JSON.stringify(files)) };
}

function loadPolicy(spec: ProductionPolicySpec): { cpu: ProductionCpu; config: any; manifest: ReturnType<typeof productionRuntimeManifest> } {
    if (!spec || !/^[a-zA-Z0-9_/-]+$/.test(spec.module) || spec.module.includes('..')) throw new Error('Invalid policy module');
    const root = path.resolve(spec.root);
    const policy = require(path.join(root, 'dist', spec.module));
    const turn = require(path.join(root, 'dist', spec.turnModule || 'game/cpu-lv10-turn'));
    const config = policy[spec.config];
    if (typeof policy[spec.search] !== 'function' || typeof turn.runLv10Turn !== 'function' || !config?.version) throw new Error('Policy entry/config unavailable');
    for (const key of ['maxTransitions', 'maxMs'] as const) {
        if (spec[key] !== undefined && (!Number.isFinite(spec[key]) || spec[key]! <= 0 || spec[key]! > config[key])) throw new Error(`Invalid ${key} override`);
    }
    if (spec.maxTransitions !== undefined && !Number.isInteger(spec.maxTransitions)) throw new Error('Transition budget must be an integer');
    const cpu = createProductionCpu(async request => policy[spec.search](request.observation, {
        publicRecipes: request.publicRecipes, excludedActions: request.excludedActions,
        maxTransitions: spec.maxTransitions, maxMs: spec.maxMs, now: () => performance.now()
    }), turn.runLv10Turn);
    return { cpu, config: { ...config, maxTransitions: spec.maxTransitions ?? config.maxTransitions, maxMs: spec.maxMs ?? config.maxMs },
        manifest: productionRuntimeManifest(root) };
}

function quantiles(values: number[]) {
    const sorted = values.slice().sort((a, b) => a - b);
    return { count: sorted.length, median: sorted.length ? sorted[Math.floor((sorted.length - 1) * .5)] : null,
        p95: sorted.length ? sorted[Math.ceil(sorted.length * .95) - 1] : null, max: sorted[sorted.length - 1] ?? null };
}

export function summarizeProductionDecisions(records: Lv10TurnRecord[]) {
    return { count: records.length, elapsedMs: quantiles(records.map(record => record.elapsedMs)),
        transitions: quantiles(records.map(record => record.search?.transitions || 0)),
        fallback: records.filter(record => record.source === 'fallback').length,
        rejected: records.filter(record => record.outcome === 'rejected').length,
        noAction: records.filter(record => record.outcome === 'no_action').length,
        stale: records.filter(record => record.outcome === 'stale').length,
        searchStops: Object.fromEntries(['complete', 'node_budget', 'time_budget', 'no_completed_plan', 'terminal']
            .map(reason => [reason, records.filter(record => record.search?.stopped === reason).length])) };
}

/** One resumable production game. The separate batch coordinator fixes the
 * schedule. No browser or display completion service is loaded by this entry. */
export async function runProductionGame(spec: ProductionGameSpec, onStep?: (record: Lv10TurnRecord, count: number) => void) {
    const out = path.resolve(spec.out);
    if (fs.existsSync(out)) throw new Error('Output already exists; resume into a new attempt directory');
    const started = performance.now(), wallStarted = new Date().toISOString();
    const policies = { black: loadPolicy(spec.policies.black), white: loadPolicy(spec.policies.white) };
    const cpus = { black: policies.black.cpu, white: policies.white.cpu };
    const currentManifest = productionRuntimeManifest(process.cwd());
    const identity = { seed: spec.seed, profiles: spec.profiles,
        policies: Object.fromEntries((['black', 'white'] as const).map(player => [player, {
            spec: spec.policies[player], config: policies[player].config, sha256: policies[player].manifest.sha256
        }])), runtimeSha256: currentManifest.sha256, node: process.version,
        limits: { maxDecisions: spec.maxDecisions || 2000, timeoutMs: spec.timeoutMs || 1200000 } };
    const identityHash = hash(JSON.stringify(identity));
    const publicRecipes = Object.fromEntries((['black', 'white'] as const).map(player => [player, Startup.getCpuOpponentDeckCardIds(spec.profiles[player])!])) as Record<Lv10Player, string[]>;
    let stopped = false, elapsedBefore = 0;
    const onStop = () => { stopped = true; };
    const resume = spec.resumeFrom ? JSON.parse(fs.readFileSync(spec.resumeFrom, 'utf8')) : null;
    if (resume && (resume.identityHash !== identityHash || resume.status !== 'running')) throw new Error('Resume checkpoint does not match this exact runtime/configuration');
    if (resume) {
        const journal = fs.readFileSync(resume.journal, 'utf8');
        if (!journal.endsWith('\n')) throw new Error('Incomplete journal write; preserve and repair this attempt before resuming');
        const rows = journal.trimEnd().split('\n');
        const last = JSON.parse(rows[rows.length - 1]);
        if ((last.index || 0) !== resume.decisions || productionStateKey(last.state) !== productionStateKey(resume.state)) {
            throw new Error('Journal and checkpoint disagree; preserve and recover the durable last step before resuming');
        }
    }
    const initial = resume?.state || createProductionPosition(spec.seed, spec.profiles);
    if (resume) {
        cpus.black.memory = resume.memories.black; cpus.white.memory = resume.memories.white;
        elapsedBefore = resume.elapsedMs;
    }
    fs.mkdirSync(out, { recursive: true });
    const declaration = { schema: 'production-selfplay-game.v1', identityHash, identity, spec,
        createdAt: wallStarted, sourceCheckpoint: spec.resumeFrom || null,
        policyRuntimes: { black: policies.black.manifest, white: policies.white.manifest }, transport: 'node-direct-advisor',
        commonRuntime: currentManifest, initial, initialSha256: hash(productionStateKey(initial)) };
    fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(declaration, null, 2), { flag: 'wx' });
    const journal = fs.openSync(path.join(out, 'steps.ndjson'), 'wx');
    let transitions: ProductionTransition[] = [], decisions: Lv10TurnRecord[] = [];
    const match = new ProductionMatch(initial, transition => transitions.push(transition));
    let count = resume?.decisions || 0;
    let minimumFreeMemory = os.freemem(), maxRss = 0;
    let lastCheckpoint: any;
    const checkpoint = () => {
        lastCheckpoint = { schema: 'production-selfplay-checkpoint.v1', identityHash, status: 'running',
            state: match.snapshot(), memories: { black: cpus.black.memory, white: cpus.white.memory }, decisions: count,
            elapsedMs: elapsedBefore + performance.now() - started, journal: path.join(out, 'steps.ndjson') };
        const tmp = path.join(out, 'checkpoint.pending.json');
        fs.writeFileSync(tmp, JSON.stringify(lastCheckpoint));
        fs.renameSync(tmp, path.join(out, 'checkpoint.json'));
    };
    process.on('SIGINT', onStop); process.on('SIGTERM', onStop);
    try {
        fs.writeSync(journal, JSON.stringify({ kind: 'initial', index: count, state: match.snapshot(), resumeFrom: spec.resumeFrom || null }) + '\n');
        checkpoint();
        while (!match.terminal) {
            if (stopped || (spec.stopFile && fs.existsSync(spec.stopFile))) break;
            if (count >= (spec.maxDecisions || 2000)) throw new Error('Production match decision limit exceeded');
            if (elapsedBefore + performance.now() - started > (spec.timeoutMs || 1200000)) throw new Error('Production match time limit exceeded');
            if (os.freemem() < 1024 ** 3) throw new Error('Free memory below 1 GiB');
            const start = match.snapshot().cardState.lastTurnStartedFor !== match.owner ? match.startTurn() : null;
            if (match.terminal || start?.stopAction) {
                fs.writeSync(journal, JSON.stringify({ kind: 'settlement', index: count, transitions, state: match.snapshot(),
                    memories: { black: cpus.black.memory, white: cpus.white.memory } }) + '\n');
                fs.fsyncSync(journal); transitions = []; checkpoint();
                continue;
            }
            const player = match.controller;
            const decision = await stepProductionCpu(match, cpus[player], publicRecipes);
            decisions.push(decision); count++;
            fs.writeSync(journal, JSON.stringify({ kind: 'decision', index: count, player, decision, transitions,
                state: match.snapshot(), memories: { black: cpus.black.memory, white: cpus.white.memory } }) + '\n');
            fs.fsyncSync(journal); transitions = [];
            checkpoint();
            const rss = process.memoryUsage().rss; maxRss = Math.max(maxRss, rss);
            minimumFreeMemory = Math.min(minimumFreeMemory, os.freemem());
            fs.writeFileSync(path.join(out, 'progress.json'), JSON.stringify({ count, turn: match.snapshot().gameState.turnNumber,
                elapsedMs: lastCheckpoint.elapsedMs, rss, lastDecision: { player, action: decision.action, outcome: decision.outcome,
                    ms: decision.elapsedMs, transitions: decision.search?.transitions, stopped: decision.search?.stopped } }));
            onStep?.(decision, count);
            if (['no_action', 'stale'].includes(decision.outcome)) throw new Error(`Non-progressing CPU decision: ${decision.outcome}`);
            await new Promise<void>(resolve => setImmediate(resolve));
        }
        const result = { status: match.terminal ? 'complete' : 'stopped', result: match.terminal ? match.result() : null,
            identityHash, decisions: count, elapsedMs: elapsedBefore + performance.now() - started,
            metricsScope: 'this attempt; resumed predecessor metrics remain in its journal',
            black: summarizeProductionDecisions(decisions.filter(record => record.player === 'black')),
            white: summarizeProductionDecisions(decisions.filter(record => record.player === 'white')),
            resources: { maxRss, minimumFreeMemory, resourceUsage: process.resourceUsage() },
            finalStateHash: hash(productionStateKey(match.snapshot())) };
        fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(result, null, 2), { flag: 'wx' });
        if (match.terminal) {
            lastCheckpoint.status = 'complete';
            fs.writeFileSync(path.join(out, 'checkpoint.json'), JSON.stringify(lastCheckpoint));
        }
        fs.writeFileSync(path.join(out, 'steps.ndjson.gz'), zlib.gzipSync(fs.readFileSync(path.join(out, 'steps.ndjson'))));
        return result;
    } catch (error) {
        fs.writeFileSync(path.join(out, 'failure.json'), JSON.stringify({ error: error instanceof Error ? error.stack : String(error),
            identityHash, count, state: match.snapshot(), uncheckpointedTransitions: transitions,
            decisions, at: new Date().toISOString() }, null, 2), { flag: 'wx' });
        throw error;
    } finally {
        fs.closeSync(journal); process.off('SIGINT', onStop); process.off('SIGTERM', onStop);
    }
}

if (require.main === module) {
    const file = process.argv[2];
    if (!file) throw new Error('Usage: run-production-selfplay <game-spec.json>');
    runProductionGame(JSON.parse(fs.readFileSync(file, 'utf8'))).then(result => console.log(JSON.stringify(result)))
        .catch(error => { console.error(error); process.exitCode = 1; });
}
