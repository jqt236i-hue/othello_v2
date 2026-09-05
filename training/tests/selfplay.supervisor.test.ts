import { completed, validateCandidateRun } from '../scripts/supervise-selfplay-training';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
const { buildMonitorSnapshot } = require('../scripts/monitor-selfplay-training-run');

test('monitor reports interrupted when supervisor heartbeat is stale despite a running log', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'selfplay-supervisor-test-'));
    try {
        fs.writeFileSync(path.join(dir, 'launcher.log'), '[training-cycle] iteration 3/3 start\n');
        fs.writeFileSync(path.join(dir, 'supervisor.json'), JSON.stringify({
            status: 'running', pid: process.pid, updatedAt: '2020-01-01T00:00:00Z'
        }));
        expect(buildMonitorSnapshot(dir, {}).status).toBe('interrupted');
        fs.writeFileSync(path.join(dir, 'supervisor.json'), JSON.stringify({
            status: 'running', pid: process.pid, updatedAt: new Date().toISOString()
        }));
        expect(buildMonitorSnapshot(dir, {}).status).toBe('running');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('rejects promotion and deployment even when disabling flags are also present', () => {
    const safe = ['--no-promote', '--no-deploy-promoted-to-root'];
    expect(() => validateCandidateRun({ command: { args: safe } })).not.toThrow();
    for (const flag of ['--promote', '--deploy-promoted-to-root']) {
        expect(() => validateCandidateRun({ command: { args: [...safe, flag] } })).toThrow();
    }
    expect(() => validateCandidateRun({ command: { args: [] } })).toThrow();
});

test('requires all iterations and no failure or time-budget stop', () => {
    const summary = { config: { iterations: 3 }, iterations: [{}, {}, {}] };
    expect(completed(summary)).toBe(true);
    expect(completed({ ...summary, iterations: [{}, {}] })).toBe(false);
    expect(completed({ ...summary, failure: { step: 'train' } })).toBe(false);
    expect(completed({ ...summary, stoppedByTimeBudget: true })).toBe(false);
});

test('built supervisor retries an abnormal exit and preserves completed iterations', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'selfplay-supervisor-smoke-'));
    try {
        const summaryOut = path.join(dir, 'summary.json');
        fs.writeFileSync(summaryOut, JSON.stringify({ config: { iterations: 3, maxHours: 1 }, elapsedMs: 0, iterations: [{}, {}] }));
        const fixture = path.join(dir, 'fixture.js');
        fs.writeFileSync(fixture, `const fs = require('fs');
const marker = ${JSON.stringify(path.join(dir, 'attempt'))};
if (!fs.existsSync(marker)) { fs.writeFileSync(marker, '1'); process.exit(9); }
const file = ${JSON.stringify(summaryOut)};
const summary = JSON.parse(fs.readFileSync(file));
if (summary.iterations.length !== 2) process.exit(10);
summary.iterations.push({}); fs.writeFileSync(file, JSON.stringify(summary));`);
        const configFile = path.join(dir, 'config.json');
        fs.writeFileSync(configFile, JSON.stringify({
            cwd: dir, paths: { runDir: dir, summaryOut, launcherLogPath: path.join(dir, 'launcher.log') },
            preflightCommand: { executable: process.execPath, args: ['-e', 'process.exit(0)'] },
            command: { executable: process.execPath, args: [fixture, '--no-promote', '--no-deploy-promoted-to-root', '--max-hours', '1'] }
        }));
        const result = spawnSync(process.execPath, [path.resolve('dist/scripts/supervise-selfplay-training.js'), configFile], { timeout: 30000 });
        expect(result.stderr.toString()).toBe('');
        expect(result.status).toBe(0);
        const state = JSON.parse(fs.readFileSync(path.join(dir, 'supervisor.json'), 'utf8'));
        expect(state.status).toBe('completed');
        expect(state.attempt).toBe(2);
        expect(fs.existsSync(path.join(dir, 'supervisor.lock'))).toBe(false);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}, 40000);
