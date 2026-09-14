import fs = require('node:fs');
import os = require('node:os');
import path = require('node:path');
import crypto = require('node:crypto');
import { spawn, spawnSync } from 'node:child_process';
import { comparableProductionDecision } from '../scripts/perf/measure-production-selfplay';
import { analyzeProductionSpeed, analyzeProductionConcurrency } from '../scripts/perf/analyze-production-performance';

test('parallel throughput alone cannot override per-policy slowdowns or time-cut increases', () => {
    const phases = ['before', 'two', 'after'].flatMap(part => ['lv10', 'lv11'].map(policy => {
        const count = part === 'two' ? 2 : 1, elapsedMs = count === 2 ? 105 : 100;
        return { label: `concurrency-${part}-${policy}`, elapsedMs: 24 * elapsedMs,
            workers: Array.from({ length: count }, () => ({ spec: { clock: 'production', profile: false }, maxRss: 100,
                rows: Array.from({ length: 24 }, (_, id) => ({ id, elapsedMs, result: { transitions: 100, stopped: 'complete' } })) })) };
    }));
    expect(analyzeProductionConcurrency({ phases }).selectedConcurrency).toBe(2);
    const biased = JSON.parse(JSON.stringify(phases));
    biased[3].workers.forEach((worker: any) => worker.rows.forEach((row: any) => { row.elapsedMs = 145; }));
    expect(analyzeProductionConcurrency({ phases: biased }).selectedConcurrency).toBe(1);
    const cut = JSON.parse(JSON.stringify(phases));
    cut[3].workers[0].rows.slice(0, 3).forEach((row: any) => { row.result.stopped = 'time_budget'; });
    expect(analyzeProductionConcurrency({ phases: cut }).selectedConcurrency).toBe(1);
});

test('speed target needs all three complete ABA groups and rejects drift or judgment differences', () => {
    const phases = [0, 1, 2].flatMap(group => [64, 512, 4096].flatMap(budget => ['baseline-before', 'candidate', 'baseline-after'].map(label => ({
        label: `group-${group}-${label}-${budget}`, workers: [{ spec: { clock: 'fixed', profile: false }, config: { maxTransitions: 4096 }, maxRss: 100,
            rows: Array.from({ length: budget === 4096 ? 8 : 24 }, (_, i) => ({ id: `position-${i}`, elapsedMs: label === 'candidate' ? 60 : 100, judgmentSha256: `judgment-${i}` })) }]
    }))));
    expect(analyzeProductionSpeed({ phases }).targetVerified).toBe(true);
    expect(analyzeProductionSpeed({ phases: phases.slice(0, -1) }).targetVerified).toBe(false);
    const changed = JSON.parse(JSON.stringify(phases)); changed[1].workers[0].rows[0].judgmentSha256 = 'different-continuation';
    expect(analyzeProductionSpeed({ phases: changed }).targetVerified).toBe(false);
    const drift = JSON.parse(JSON.stringify(phases)); drift[2].workers[0].rows.forEach((row: any) => { row.elapsedMs = 140; });
    expect(analyzeProductionSpeed({ phases: drift }).targetVerified).toBe(false);
});

test('comparison retains continuation, candidate order, rejection details and transition count', () => {
    const judgment = { action: { type: 'pass' }, continuation: [{ type: 'place', row: 1, col: 2 }], value: 1,
        candidates: [{ score: 3 }, { score: 2 }], rejected: [{ reason: 'frozen', action: { type: 'place', row: 0, col: 0 } }], transitions: 64 };
    expect(comparableProductionDecision({ ...judgment, elapsedMs: 1 })).toEqual(comparableProductionDecision({ ...judgment, elapsedMs: 1000 }));
    for (const changed of [{ continuation: [] }, { candidates: judgment.candidates.slice().reverse() }, { rejected: [] }, { transitions: 63 }, { value: 2 }]) {
        expect(comparableProductionDecision({ ...judgment, ...changed })).not.toEqual(judgment);
    }
});

test('performance worker uses only the saved working directory and rejects altered public input', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'production-performance-'));
    const root = path.join(directory, 'saved'), dist = path.join(root, 'dist'); fs.mkdirSync(dist, { recursive: true });
    fs.writeFileSync(path.join(root, 'catalog.json'), JSON.stringify({ value: 47 }));
    fs.writeFileSync(path.join(dist, 'policy.js'), `const catalog = require(process.cwd() + '/catalog.json'); exports.config = { maxTransitions: 64 }; exports.search = () => ({ action: {type:'pass'}, value: catalog.value, transitions: 1, stopped:'complete' });`);
    const input = path.join(directory, 'input.json'), spec = path.join(directory, 'spec.json'), output = path.join(directory, 'result.json');
    fs.writeFileSync(input, JSON.stringify({ positions: [{ id: 'one', observation: { player: 'black' }, publicRecipes: {}, excludedActions: [] }] }));
    fs.writeFileSync(spec, JSON.stringify({ input: { path: input, sha256: crypto.createHash('sha256').update(fs.readFileSync(input)).digest('hex') },
        policy: { root, module: 'policy', search: 'search', config: 'config' }, clock: 'fixed', stopFile: path.join(directory, 'STOP') }));
    const script = path.resolve('dist/scripts/perf/measure-production-selfplay.js');
    try {
        const result = spawnSync(process.execPath, [script, 'worker', spec, output], { cwd: root, windowsHide: true, encoding: 'utf8', timeout: 20000 });
        expect(result.stderr).toBe(''); expect(result.status).toBe(0);
        const report = JSON.parse(fs.readFileSync(output, 'utf8'));
        expect(report.rows[0].result.value).toBe(47); expect(report.dependenciesOutsideFrozenRuntime).toEqual([]);
        fs.appendFileSync(input, ' ');
        const changed = spawnSync(process.execPath, [script, 'worker', spec, path.join(directory, 'altered.json')], { cwd: root, windowsHide: true, encoding: 'utf8', timeout: 20000 });
        expect(changed.status).toBe(1); expect(changed.stderr).toContain('Public cohort changed');
        expect(fs.existsSync(path.join(directory, 'altered.json'))).toBe(false);
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}, 45000);

test('campaign STOP lets the active game save its result and does not start the next game', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'production-performance-stop-'));
    const root = path.join(directory, 'saved'), out = path.join(directory, 'campaign');
    for (const relative of ['dist/game', 'dist/shared', 'dist/constants', 'dist/utils', 'dist/cards', 'dist/scripts', 'cards']) fs.mkdirSync(path.join(root, relative), { recursive: true });
    for (const relative of ['package.json', 'package-lock.json', 'cards/catalog.json']) fs.writeFileSync(path.join(root, relative), '{}');
    fs.writeFileSync(path.join(root, 'dist/shared-constants.js'), 'module.exports = {};');
    fs.writeFileSync(path.join(root, 'dist/scripts/run-production-selfplay.js'), `const fs = require('node:fs'), path = require('node:path');
exports.runProductionGame = async spec => {
    fs.mkdirSync(spec.out); fs.writeFileSync(path.join(spec.out, 'ready'), String(process.pid));
    while (!fs.existsSync(spec.stopFile)) await new Promise(resolve => setTimeout(resolve, 20));
    const result = { status: 'stopped', decisions: 1, elapsedMs: 20 };
    fs.writeFileSync(path.join(spec.out, 'checkpoint.json'), JSON.stringify({ status: 'running', decisions: 1 }));
    fs.writeFileSync(path.join(spec.out, 'result.json'), JSON.stringify(result)); return result;
};`);
    const source = path.join(directory, 'source.json'), cohort = path.join(directory, 'cohort.json'), spec = path.join(directory, 'spec.json');
    fs.writeFileSync(source, JSON.stringify({ spec: { mode: 'development' }, schedule: [{ id: 'one', seed: 1, candidateColor: 'black' }] }));
    fs.writeFileSync(cohort, JSON.stringify({ executable: { path: process.execPath, sha256: crypto.createHash('sha256').update(fs.readFileSync(process.execPath)).digest('hex') }, input: {} }));
    const policy = { root, module: 'game/policy', search: 'search', config: 'config' };
    const run = { label: 'first', kind: 'game', clock: 'production', profile: false, concurrency: 1, policy,
        replay: { manifest: source, slotId: 'one' }, game: { seed: 1, policies: { black: policy, white: policy } } };
    fs.writeFileSync(spec, JSON.stringify({ cohort, runs: [run, { ...run, label: 'must-not-start' }] }));
    const child = spawn(process.execPath, [path.resolve('dist/scripts/perf/measure-production-selfplay.js'), 'compare', spec, out], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '', workerPid: number | null = null;
    child.stderr!.on('data', chunk => { stderr += chunk.toString(); });
    const exited = new Promise<number | null>(resolve => child.once('exit', resolve));
    const ready = path.join(out, 'run-0-0.json.game/ready'), deadline = Date.now() + 15000;
    try {
        while (!fs.existsSync(ready) && Date.now() < deadline && child.exitCode === null) await new Promise(resolve => setTimeout(resolve, 25));
        expect(fs.existsSync(ready)).toBe(true); workerPid = Number(fs.readFileSync(ready, 'utf8'));
        fs.writeFileSync(path.join(out, 'STOP'), 'test normal manual stop');
        let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
        const code = await Promise.race([exited, new Promise<never>((_, reject) => { deadlineTimer = setTimeout(() => reject(new Error('Campaign did not stop')), 10000); })])
            .finally(() => { if (deadlineTimer) clearTimeout(deadlineTimer); });
        expect(stderr).toBe(''); expect(code).toBe(0);
        const report = JSON.parse(fs.readFileSync(path.join(out, 'report.json'), 'utf8'));
        expect(report.stopped).toBe(true); expect(report.phases).toHaveLength(1);
        expect(report.phases[0].workers[0].game.status).toBe('stopped');
        expect(fs.existsSync(path.join(out, 'run-0-0.json.game/result.json'))).toBe(true);
        expect(fs.existsSync(path.join(out, 'run-1-0.input.json'))).toBe(false);
        expect(() => process.kill(workerPid!, 0)).toThrow();
    } finally {
        if (workerPid) { try { process.kill(workerPid); } catch { /* already exited */ } }
        if (child.exitCode === null) { child.kill(); await exited; }
        if (!path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep)) throw new Error('Unexpected test workspace');
        fs.rmSync(directory, { recursive: true, force: true });
    }
}, 35000);
