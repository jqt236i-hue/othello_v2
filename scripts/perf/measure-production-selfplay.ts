#!/usr/bin/env node
import fs = require('node:fs');
import path = require('node:path');
import crypto = require('node:crypto');
import zlib = require('node:zlib');
import os = require('node:os');
import inspector = require('node:inspector');
import { spawn, type ChildProcess } from 'node:child_process';
import { performance, PerformanceObserver } from 'node:perf_hooks';

const hash = (value: string | Buffer) => crypto.createHash('sha256').update(value).digest('hex');
const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file: string, value: any) => fs.writeFileSync(file, JSON.stringify(value, null, 2), { flag: 'wx' });
const fingerprint = (file: string) => ({ path: path.resolve(file), sha256: hash(fs.readFileSync(file)) });
const clone = (value: any) => JSON.parse(JSON.stringify(value));
type Position = { id: string; category: string; representative: boolean; observation: any; publicRecipes: any; excludedActions: any[]; inputSha256: string; provenance: any };
type Policy = { root: string; module: string; search: string; config: string };

export function comparableProductionDecision(result: any): any {
    const { elapsedMs: _time, performance: _performance, ...judgment } = result;
    return judgment;
}
export function performanceQuantiles(values: number[]) {
    const ordered = values.slice().sort((a, b) => a - b);
    return { count: values.length, median: ordered[Math.floor((ordered.length - 1) / 2)] ?? null,
        p95: ordered[Math.ceil(ordered.length * .95) - 1] ?? null, max: ordered[ordered.length - 1] ?? null };
}
function resources(out: string) {
    const disk = fs.statfsSync(out);
    if (os.freemem() < 2 * 1024 ** 3 || disk.bavail * disk.bsize < 1024 ** 3) throw new Error('Performance resource floor reached');
}

/** Selection is declared before any search is run. Private regression states
 * are a separate file and are never read by a decision worker. */
export function createProductionPerformanceCohort(specFile: string, outInput: string) {
    const spec = read(specFile), out = path.resolve(outInput);
    if (fs.existsSync(out)) throw new Error('Performance directory already exists');
    fs.mkdirSync(out, { recursive: true }); resources(out);
    fs.copyFileSync(specFile, path.join(out, 'selection.json'), fs.constants.COPYFILE_EXCL);
    const { freezeProductionRuntime } = require('../freeze-production-runtime');
    const { productionRuntimeManifest } = require('../run-production-selfplay');
    const { inspectProductionDecision } = require('../inspect-production-decision');
    const root = path.resolve(spec.baseline.root), frozen = path.join(out, 'baseline');
    const original = productionRuntimeManifest(root);
    if (original.sha256 !== spec.baseline.runtimeSha256) throw new Error('Declared baseline has changed');
    const manifest = freezeProductionRuntime(root, frozen);
    // Saved candidates keep their original TypeScript here, rather than at root.
    if (fs.existsSync(path.join(root, 'source-at-declaration'))) {
        fs.cpSync(path.join(root, 'source-at-declaration'), path.join(frozen, 'source-at-declaration'), { recursive: true, errorOnExist: true, force: false });
    }
    const sourceFiles: any[] = [];
    const sourceWalk = (dir: string) => { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const file = path.join(dir, entry.name); if (entry.isDirectory()) sourceWalk(file); else sourceFiles.push(fingerprint(file));
    } };
    sourceWalk(path.join(frozen, 'source-at-declaration'));
    const executable = path.join(out, 'node.exe'); fs.copyFileSync(spec.executable, executable, fs.constants.COPYFILE_EXCL);
    const positionModule = require(path.join(frozen, 'dist/game/ai/cpu-lv10-position'));
    const observe = require(path.join(frozen, 'dist/game/ai/cpu-lv10-observation')).observeLv10Position;
    const recipe = require(path.join(frozen, 'dist/shared/cpu-opponent-startup-options')).getCpuOpponentDeckCardIds(10);
    const publicRecipes = { black: recipe, white: recipe };
    const positions: Position[] = [], regression: any[] = [], seen = new Set<string>(), sources: any[] = [], gaps: string[] = [];
    const add = (category: string, state: any, provenance: any, excludedActions: any[] = [], memory: any = null) => {
        const observation = observe(state, positionModule.lv10DecisionPlayer(state));
        const identity = hash(JSON.stringify(observation));
        if (seen.has(identity)) return false;
        seen.add(identity);
        const input = { observation, publicRecipes, excludedActions };
        const id = `${category}-${positions.filter(item => item.category === category).length + 1}`;
        positions.push({ id, category, representative: !positions.some(item => item.category === category), ...input,
            inputSha256: hash(JSON.stringify(input)), provenance });
        regression.push({ id, state, memory, provenance }); return true;
    };
    const journalRows: any[] = [];
    for (const experiment of spec.experiments) {
        const m = read(path.join(experiment, 'manifest.json'));
        for (const slot of m.schedule) {
            const game = path.join(experiment, 'games', slot.id);
            for (const attempt of fs.readdirSync(game).filter((name: string) => /^attempt-\d+$/.test(name)).sort((a: string, b: string) => Number(a.slice(8)) - Number(b.slice(8)))) {
                const directory = path.join(game, attempt), file = path.join(directory, 'steps.ndjson');
                if (!fs.existsSync(file)) continue;
                sources.push(fingerprint(file));
                const declaration = read(path.join(directory, 'manifest.json'));
                let memory = declaration.sourceCheckpoint ? read(declaration.sourceCheckpoint).memories : null;
                for (const row of fs.readFileSync(file, 'utf8').trimEnd().split('\n').map(line => JSON.parse(line))) {
                    if (row.kind !== 'decision') continue;
                    const before = row.transitions.find((item: any) => item.kind === 'action')?.before;
                    if (before) journalRows.push({ state: before, row, memory: clone(memory), provenance: { file: path.resolve(file), decision: row.index } });
                    memory = row.memories;
                }
            }
        }
    }
    for (const group of spec.groups) {
        for (const selection of group.selections) {
            if (selection.journal) {
                const matches = journalRows.filter(({ state }) => {
                    const owner = positionModule.currentLv10Player(state), player = positionModule.lv10DecisionPlayer(state);
                    return player === selection.player && state.gameState.turnNumber >= selection.minTurn && state.gameState.turnNumber <= selection.maxTurn
                        && (selection.controlChanged ? player !== owner : player === owner && !state.cardState.pendingEffectByPlayer?.[owner]);
                });
                const chosen = matches.find(({ state }) => !seen.has(hash(JSON.stringify(observe(state, selection.player)))));
                if (!chosen) throw new Error(`No saved journal position for ${group.category}/${selection.player}`);
                const extracted = inspectProductionDecision(path.dirname(chosen.provenance.file), chosen.provenance.decision);
                if (JSON.stringify(extracted.observation) !== JSON.stringify(observe(chosen.state, selection.player))) throw new Error('Saved public observation contract changed');
                add(group.category, extracted.authoritativeBefore, chosen.provenance, extracted.excludedActions, chosen.memory);
            } else {
                const file = path.resolve(spec.cardDirectory, selection.file);
                sources.push(fingerprint(file));
                const fixture = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString()).fixture;
                const step = fixture.transitions[selection.transition];
                if (!step || step.kind !== 'action' || positionModule.lv10DecisionPlayer(step.before) !== selection.player) throw new Error(`Invalid fixture selection ${file}`);
                if (!add(group.category, step.before, { file, transition: selection.transition, note: selection.note || null })) throw new Error('Duplicate fixture observation');
                if (selection.gap) gaps.push(selection.gap);
            }
        }
    }
    if (positions.length !== 24 || positions.filter(item => item.observation.player === 'black').length !== 12
        || spec.groups.length !== 8 || spec.groups.some((group: any) => positions.filter(item => item.category === group.category).length !== 3)) throw new Error('Cohort must contain eight groups of three, twelve observations per player');
    write(path.join(out, 'public-inputs.json'), { schema: 'production-performance-inputs.v1', positions });
    write(path.join(out, 'private-regression.json'), { schema: 'production-performance-regression.v1', positions: regression });
    const policy = { ...spec.baseline, root: frozen }; delete policy.runtimeSha256;
    const config = require(path.join(frozen, 'dist', policy.module))[policy.config];
    write(path.join(out, 'manifest.json'), { schema: 'production-performance-cohort.v1', at: new Date().toISOString(),
        purpose: 'Development performance replay only; never new strength evidence', baseline: policy, config, runtime: manifest,
        executable: fingerprint(executable), sources: sourceFiles, dependencyMode: 'Frozen production runtime imports Node built-ins only; no external dependencies. package-lock.json retained.',
        input: fingerprint(path.join(out, 'public-inputs.json')), regression: fingerprint(path.join(out, 'private-regression.json')),
        selection: fingerprint(path.join(out, 'selection.json')), sourceRecords: sources, gaps,
        hardware: { cpu: os.cpus()[0].model, logical: os.availableParallelism(), memory: os.totalmem(), node: process.version, platform: process.platform } });
    return { out, positions: positions.length, input: fingerprint(path.join(out, 'public-inputs.json')), runtimeSha256: manifest.sha256, gaps };
}

/** Explicit synchronous spans are isolated to this process. Child spans are
 * subtracted from parents; CPU samples and GC overlap are reported separately. */
function instrumentation(root: string) {
    const totals: Record<string, { calls: number; inclusiveMs: number; exclusiveMs: number; failures: number }> = {};
    const stack: { children: number }[] = [];
    let enabled = false, searchDepth = 0;
    function wrap(label: string, fn: any): any {
        return function(this: any, ...args: any[]) {
            if (!enabled || (label === 'outsideSearchJson' && searchDepth > 0)) return fn.apply(this, args);
            const isSearch = label === 'search' || label.startsWith('policySearch-');
            if (isSearch) searchDepth++;
            const start = performance.now(), frame = { children: 0 }; stack.push(frame);
            const total = totals[label] ||= { calls: 0, inclusiveMs: 0, exclusiveMs: 0, failures: 0 }; total.calls++;
            try { return fn.apply(this, args); } catch (error) { total.failures++; throw error; }
            finally { const duration = performance.now() - start; stack.pop(); if (isSearch) searchDepth--; total.inclusiveMs += duration;
                total.exclusiveMs += duration - frame.children; if (stack.length) stack[stack.length - 1].children += duration; }
        };
    }
    const hook = (file: string, entries: [string, string][]) => {
        const target = require(path.join(root, 'dist', file));
        for (const [key, label] of entries) { if (typeof target[key] !== 'function') throw new Error(`Profiler hook absent ${file}/${key}`); target[key] = wrap(label, target[key]); }
    };
    const cloneFile = require.resolve(path.join(root, 'dist/utils/deepClone'));
    const cloneModule = require(cloneFile); require.cache[cloneFile]!.exports = wrap('clone', cloneModule);
    hook('shared/state-hash', [['computeStableHash', 'stateHash']]);
    hook('game/logic/core', [['getLegalMoves', 'legalMoves']]);
    hook('game/ai/cpu-lv10-position', [['applyLv10Action', 'simulatedAction'], ['startLv10Turn', 'simulatedTurnStart'], ['sampleLv10Position', 'sample'], ['enumerateLv10Actions', 'enumeration']]);
    hook('game/ai/cpu-lv11-evaluation', [['evaluateLv11Position', 'evaluation']]);
    hook('game/ai/cpu-lv10-observation', [['observeLv10Position', 'observation']]);
    // cloneLv10 calls within its own module cannot be intercepted through the
    // exports object. CPU samples account for those JSON clones explicitly.
    const originalStructuredClone = global.structuredClone;
    global.structuredClone = wrap('structuredClone', originalStructuredClone);
    return { totals, enable: () => { enabled = true; }, disable: () => { enabled = false; }, wrap };
}

async function runWorker(specFile: string, output: string) {
    const spec = read(specFile), root = path.resolve(spec.policy.root), loadStarted = performance.now();
    if (spec.kind === 'game') {
        if (spec.clock !== 'production') throw new Error('Full performance replay requires the production clock');
        const source = read(spec.replay.manifest), slot = source.schedule.find((item: any) => item.id === spec.replay.slotId);
        if (source.spec.mode !== 'development' || !slot || slot.seed !== spec.game.seed) throw new Error('Full replay must reference an issued development condition');
        const before = spec.game.policies[slot.candidateColor];
        if (path.resolve(before.root) !== root || before.search !== spec.policy.search || before.maxTransitions !== undefined || before.maxMs !== undefined) throw new Error('Replay candidate or budgets differ from the declared policy');
        const stats = spec.profile ? instrumentation(root) : null;
        if (stats) {
            for (const [target, key, label] of [
                [JSON, 'stringify', 'outsideSearchJson'], [fs, 'readFileSync', 'fileRead'], [fs, 'writeSync', 'journalWrite'], [fs, 'writeFileSync', 'fileWrite'],
                [fs, 'fsyncSync', 'fsync'], [fs, 'renameSync', 'checkpointRename'], [zlib, 'gzipSync', 'compression']
            ] as [any, string, string][]) target[key] = stats.wrap(label, target[key]);
            const match = require(path.join(root, 'dist/src/engine/production-match')).ProductionMatch.prototype;
            for (const [key, label] of [['apply', 'actualAction'], ['startTurn', 'actualTurnStart'], ['snapshot', 'snapshot']]) match[key] = stats.wrap(label, match[key]);
            for (const [side, policySpec] of Object.entries<any>(spec.game.policies)) {
                const policy = require(path.join(policySpec.root, 'dist', policySpec.module));
                policy[policySpec.search] = stats.wrap(`policySearch-${side}`, policy[policySpec.search]);
            }
        }
        const run = require(path.join(root, 'dist/scripts/run-production-selfplay')).runProductionGame;
        const loadMs = performance.now() - loadStarted, tick = performance.now();
        const gameDirectory = output + '.game';
        stats?.enable();
        const result = await run({ ...spec.game, out: gameDirectory, stopFile: spec.childStopFile }, (_record: any, count: number) => {
            resources(path.dirname(output));
            if (spec.stopAfterDecisions && count >= spec.stopAfterDecisions) fs.writeFileSync(spec.childStopFile, 'Declared profiling slice completed');
        });
        stats?.disable();
        write(output, { schema: 'production-performance-game.v1', spec, pid: process.pid, loadMs, elapsedMs: performance.now() - tick,
            gameDirectory, game: result, maxRss: process.resourceUsage().maxRSS * 1024, spans: stats?.totals || null,
            note: 'Existing development seed reused for performance only; complete and stopped attempts remain auditable' });
        return;
    }
    const inputs = read(spec.input.path);
    if (hash(fs.readFileSync(spec.input.path)) !== spec.input.sha256) throw new Error('Public cohort changed');
    const stats = spec.profile ? instrumentation(root) : null;
    const policy = require(path.join(root, 'dist', spec.policy.module)), config = policy[spec.policy.config];
    if (spec.clock === 'production' && spec.transitions !== undefined && spec.transitions !== config.maxTransitions) throw new Error('Production performance must retain the declared transition budget');
    const search = stats ? stats.wrap('search', policy[spec.policy.search]) : policy[spec.policy.search];
    const loadMs = performance.now() - loadStarted;
    const selected: Position[] = inputs.positions.filter((item: Position) => !spec.representatives || item.representative);
    const warmStarted = performance.now();
    search(selected[0].observation, { publicRecipes: selected[0].publicRecipes, excludedActions: selected[0].excludedActions, maxTransitions: 64 });
    const warmMs = performance.now() - warmStarted;
    const session = spec.profile ? new inspector.Session() : null;
    const post = (method: string) => new Promise<any>((resolve, reject) => session!.post(method as any, (error, result) => error ? reject(error) : resolve(result)));
    const gc: any[] = [];
    const observer = new PerformanceObserver(list => { for (const entry of list.getEntries()) gc.push({ start: entry.startTime, duration: entry.duration }); });
    observer.observe({ entryTypes: ['gc'] });
    if (session) { session.connect(); await post('Profiler.enable'); await post('Profiler.start'); stats!.enable(); }
    const rows: any[] = [], start = performance.now(), cpu = process.cpuUsage();
    for (const item of selected) {
        resources(path.dirname(output));
        if (fs.existsSync(spec.stopFile)) throw new Error('Performance stop requested');
        const before = JSON.stringify(item), decisionCpu = process.cpuUsage(), tick = performance.now();
        const result = search(item.observation, { publicRecipes: item.publicRecipes, excludedActions: item.excludedActions,
            maxTransitions: spec.transitions ?? config.maxTransitions, ...(spec.clock === 'production' ? { now: () => performance.now() } : {}) });
        const elapsedMs = performance.now() - tick;
        if (JSON.stringify(item) !== before) throw new Error(`Search mutated public input ${item.id}`);
        rows.push({ id: item.id, player: item.observation.player, elapsedMs, cpu: process.cpuUsage(decisionCpu), result,
            judgmentSha256: hash(JSON.stringify(comparableProductionDecision(result))), rss: process.memoryUsage().rss });
    }
    const elapsedMs = performance.now() - start, usage = process.cpuUsage(cpu);
    stats?.disable();
    if (session) { const result = await post('Profiler.stop'); session.disconnect(); write(output + '.cpuprofile', result.profile); }
    await new Promise<void>(resolve => setImmediate(() => setImmediate(resolve))); observer.disconnect();
    const external = Object.keys(require.cache).filter(file => !file.startsWith(root + path.sep) && file !== __filename);
    if (external.length) throw new Error(`Worker loaded files outside frozen runtime: ${external.join(', ')}`);
    write(output, { schema: 'production-performance-worker.v1', spec, config, pid: process.pid, node: process.version, loadMs, warmMs, elapsedMs,
        cpu: usage, maxRss: process.resourceUsage().maxRSS * 1024, spans: stats?.totals || null,
        gc: { note: 'GC overlaps explicit spans; do not add its duration to search time', count: gc.length, durationMs: gc.reduce((sum, entry) => sum + entry.duration, 0) },
        dependenciesOutsideFrozenRuntime: external, rows });
}

/** Bounded child campaigns. No build or ordinary experiment is started here.
 * Each requested run is one immutable input/output pair, preserving ABA order. */
export async function measureProductionSelfplay(specFile: string, outInput: string) {
    const started = performance.now();
    const spec = read(specFile), cohort = read(spec.cohort), out = path.resolve(outInput);
    if (fs.existsSync(out)) throw new Error('Performance output already exists');
    fs.mkdirSync(out, { recursive: true }); resources(out);
    if (hash(fs.readFileSync(cohort.executable.path)) !== cohort.executable.sha256) throw new Error('Saved Node changed');
    if (!Array.isArray(spec.runs) || !spec.runs.length) throw new Error('Explicit measurement runs required');
    const { productionRuntimeManifest } = require('../run-production-selfplay');
    const snapshots = [...new Set<string>(spec.runs.flatMap((run: any) => [run.policy.root,
        ...(run.games || [run]).flatMap((job: any) => Object.values(job.game?.policies || {}).map((policy: any) => policy.root))]).map((root: string) => path.resolve(root)))].map(root => productionRuntimeManifest(root));
    const file = path.join(out, 'harness.js'); fs.copyFileSync(__filename, file, fs.constants.COPYFILE_EXCL);
    write(path.join(out, 'declaration.json'), { spec, cohort: fingerprint(spec.cohort), harness: fingerprint(file), runtimes: snapshots,
        at: new Date().toISOString(), limits: { heapMiB: 1536, childMs: 600000, campaignMs: 1800000 } });
    const children = new Map<ChildProcess, { stopFile: string | null; grace?: ReturnType<typeof setTimeout> }>(), stopFile = path.join(out, 'STOP');
    let stopped = false;
    const terminate = () => { for (const [child, state] of children) { if (state.grace) clearTimeout(state.grace); child.kill(); } };
    const stop = () => {
        if (stopped) return; stopped = true;
        for (const [child, state] of children) {
            if (state.stopFile) {
                fs.writeFileSync(state.stopFile, 'Performance campaign stopped; finish the current decision and preserve the audit record');
                state.grace = setTimeout(() => child.kill(), 25000);
            } else child.kill();
        }
    };
    process.once('SIGINT', stop); process.once('SIGTERM', stop);
    const campaignTimer = setTimeout(() => { stopped = true; terminate(); }, Math.max(0, 1800000 - (performance.now() - started))), phases: any[] = [];
    const poll = setInterval(() => { if (fs.existsSync(stopFile)) stop(); }, 500);
    try {
        for (let index = 0; index < spec.runs.length; index++) {
            if (stopped) break; resources(out);
            const run = spec.runs[index], concurrency = run.concurrency ?? 1;
            if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) throw new Error('Concurrency must be 1–4');
            if (run.games && (run.kind !== 'game' || run.games.length !== concurrency)) throw new Error('Full game wave must assign exactly one declared condition to each worker');
            if (!['fixed', 'production'].includes(run.clock)) throw new Error('Clock must be explicit');
            const hostCpuBefore = os.cpus().map(cpu => cpu.times), tick = performance.now();
            const workers = await Promise.all(Array.from({ length: concurrency }, (_, worker) => new Promise<any>((resolve, reject) => {
                const input = path.join(out, `run-${index}-${worker}.input.json`), output = path.join(out, `run-${index}-${worker}.json`);
                const childStopFile = output + '.STOP';
                write(input, { ...run, ...(run.games?.[worker] || {}), input: cohort.input, stopFile, childStopFile });
                const log = fs.openSync(output + '.log', 'wx');
                const child = spawn(cohort.executable.path, ['--max-old-space-size=1536', file, 'worker', input, output], { cwd: path.resolve(run.policy.root), windowsHide: true, stdio: ['ignore', log, log] });
                const childState = { stopFile: run.kind === 'game' ? childStopFile : null, grace: undefined as ReturnType<typeof setTimeout> | undefined };
                children.set(child, childState); fs.closeSync(log);
                const timeout = setTimeout(() => { child.kill(); reject(new Error('Performance child exceeded ten minutes')); }, 600000);
                const softStop = run.kind === 'game' ? setTimeout(() => fs.writeFileSync(childStopFile, 'Performance process budget; resume from the preserved checkpoint in a new output'), 575000) : null;
                const clear = () => { clearTimeout(timeout); if (softStop) clearTimeout(softStop); if (childState.grace) clearTimeout(childState.grace); children.delete(child); };
                child.once('error', error => { clear(); reject(error); });
                child.once('exit', code => { clear(); code === 0 ? resolve(read(output)) : reject(new Error(`Performance child failed ${code}: ${output}.log`)); });
            })));
            phases.push({ index, label: run.label, elapsedMs: performance.now() - tick, hostCpuBefore, hostCpuAfter: os.cpus().map(cpu => cpu.times), workers });
            write(path.join(out, `progress-${index}.json`), { at: new Date().toISOString(), completedRuns: phases.length });
            console.log(JSON.stringify({ index, label: run.label, elapsedMs: phases[phases.length - 1].elapsedMs }));
        }
        // Report every fixed output, not merely action equality. Baselines and
        // optimized outputs at equal budgets must have identical digests.
        const reference = new Map<string, string>(), mismatches: any[] = [];
        for (const phase of phases) for (const worker of phase.workers) {
            if (worker.spec.clock !== 'fixed' || worker.spec.kind === 'game') continue;
            for (const row of worker.rows) {
                const key = `${worker.spec.transitions ?? worker.config.maxTransitions}/${row.id}`, previous = reference.get(key);
                if (previous && previous !== row.judgmentSha256) mismatches.push({ phase: phase.index, id: row.id, budget: key, previous, actual: row.judgmentSha256 });
                else reference.set(key, row.judgmentSha256);
            }
        }
        const summary = phases.map(phase => { if (phase.workers[0].spec.kind === 'game') return {
            label: phase.label, kind: 'game', clock: 'production', concurrency: phase.workers.length, wallMs: phase.elapsedMs,
            games: phase.workers.map((worker: any) => ({ directory: worker.gameDirectory, ...worker.game })) };
            const rows = phase.workers.flatMap((worker: any) => worker.rows); return {
            label: phase.label, clock: phase.workers[0].spec.clock, concurrency: phase.workers.length, wallMs: phase.elapsedMs,
            decisionMs: performanceQuantiles(rows.map((row: any) => row.elapsedMs)), transitions: performanceQuantiles(rows.map((row: any) => row.result.transitions)),
            evaluatedCandidates: performanceQuantiles(rows.map((row: any) => row.result.evaluatedCandidates || 0)),
            simulatedRejections: rows.reduce((sum: number, row: any) => sum + (row.result.rejectedCount || 0), 0),
            noCompletedPlan: rows.filter((row: any) => row.result.stopped === 'no_completed_plan').length,
            cpu: phase.workers.map((worker: any) => worker.cpu),
            transitionsPerMs: rows.reduce((sum: number, row: any) => sum + row.result.transitions, 0) / rows.reduce((sum: number, row: any) => sum + row.elapsedMs, 0),
            timeCutRate: rows.filter((row: any) => row.result.stopped === 'time_budget').length / rows.length,
            maxRss: Math.max(...phase.workers.map((worker: any) => worker.maxRss)) }; });
        const report = { schema: 'production-performance-campaign.v1', stopped, elapsedMs: performance.now() - started,
            coordinatorProcessElapsedMs: require.main === module ? process.uptime() * 1000 : null, mismatches, summary, phases };
        write(path.join(out, 'report.json'), report); return { out, mismatches, summary };
    } catch (error) {
        write(path.join(out, 'failure.json'), { at: new Date().toISOString(), stopped, error: String(error), completedPhases: phases.map(phase => ({ index: phase.index, label: phase.label })) });
        throw error;
    } finally { clearTimeout(campaignTimer); clearInterval(poll); process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); terminate(); }
}

if (require.main === module) {
    const [mode, input, output] = process.argv.slice(2);
    const work = mode === 'worker' ? runWorker(input, output) : mode === 'cohort' ? Promise.resolve().then(() => createProductionPerformanceCohort(input, output))
        : ['profile', 'compare'].includes(mode) ? measureProductionSelfplay(input, output) : Promise.reject(new Error('Usage: perf:production-selfplay <cohort|profile|compare> <spec.json> <new-output-directory>'));
    work.then(result => { if (result) console.log(JSON.stringify(result)); }).catch(error => { console.error(error); process.exitCode = 1; });
}
