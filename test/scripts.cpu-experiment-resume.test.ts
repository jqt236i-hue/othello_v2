import fs = require('node:fs');
import os = require('node:os');
import path = require('node:path');
import { spawn, spawnSync } from 'node:child_process';
import { freezeProductionRuntime } from '../scripts/freeze-production-runtime';
import { verifyProductionSelfplay } from '../scripts/verify-production-selfplay';

test('the declared coordinator survives checkout edits and preserves process history across a durable resume', async () => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'cpu-coordinator-resume-'));
    const root = path.join(parent, 'checkout');
    freezeProductionRuntime(process.cwd(), root);
    for (const name of ['run-cpu-experiment.js', 'cpu-experiment-protocol.js', 'freeze-production-runtime.js', 'production-parity-gate.js', 'verify-production-replay.js']) {
        fs.copyFileSync(path.join(process.cwd(), 'dist/scripts', name), path.join(root, 'dist/scripts', name));
    }
    for (const level of ['cpu-lv10', 'cpu-lv11']) {
        fs.mkdirSync(path.join(root, 'data', level), { recursive: true });
        fs.writeFileSync(path.join(root, 'data', level, 'issued-conditions.json'), '[]');
    }
    const out = path.join(parent, 'experiment'), sourceEntry = path.join(root, 'dist/scripts/run-cpu-experiment.js');
    const policy = { root, module: 'game/ai/cpu-lv10-search', search: 'searchLv10', config: 'LV10_SEARCH_CONFIG', maxTransitions: 8 };
    const spec = { label: 'coordinator-resume-regression', mode: 'development', out,
        paired: 0, blackOnly: 1, whiteOnly: 0, concurrency: 1, candidate: policy, opponent: policy };
    const specFile = path.join(parent, 'spec.json'); fs.writeFileSync(specFile, JSON.stringify(spec));
    const declared = spawnSync(process.execPath, [sourceEntry, 'declare', specFile], { cwd: root, encoding: 'utf8', windowsHide: true });
    expect(declared.status).toBe(0);
    const manifest = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'));
    expect(manifest.coordinator.entry).not.toBe(sourceEntry);
    const first = spawn(process.execPath, [sourceEntry, 'run', out], { cwd: root, windowsHide: true, stdio: 'ignore' });
    const exited = new Promise<number | null>((resolve, reject) => { first.once('error', reject); first.once('exit', resolve); });
    const attempt = path.join(out, 'games/1-black/attempt-1');
    let stopped = false;
    try {
        const deadline = Date.now() + 45000;
        while (Date.now() < deadline && first.exitCode === null) {
            const checkpoint = path.join(attempt, 'checkpoint.json');
            if (fs.existsSync(checkpoint) && JSON.parse(fs.readFileSync(checkpoint, 'utf8')).decisions >= 2) {
                fs.writeFileSync(path.join(out, 'stop-request.json'), '{}', { flag: 'wx' }); stopped = true; break;
            }
            await new Promise(resolve => setTimeout(resolve, 25));
        }
    } finally {
        if (!stopped && first.exitCode === null && !fs.existsSync(path.join(out, 'stop-request.json'))) fs.writeFileSync(path.join(out, 'stop-request.json'), '{}');
    }
    expect(await exited).toBe(0); expect(stopped).toBe(true);
    expect(JSON.parse(fs.readFileSync(path.join(attempt, 'result.json'), 'utf8')).status).toBe('stopped');
    const priorHistory = JSON.parse(fs.readFileSync(path.join(out, 'processes.json'), 'utf8'));
    expect(priorHistory).toHaveLength(1); expect(priorHistory[0].code).toBe(0);
    // Only this isolated test checkout changes. The declared copy must be used
    // even when its dispatching entry has since been rebuilt or edited.
    fs.appendFileSync(sourceEntry, '\n// Subsequent checkout edit.\n');
    const resumed = spawnSync(process.execPath, [sourceEntry, 'resume', out], { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 90000 });
    expect(resumed.status).toBe(0);
    const history = JSON.parse(fs.readFileSync(path.join(out, 'processes.json'), 'utf8'));
    expect(history).toHaveLength(2); expect(history[0]).toEqual(priorHistory[0]); expect(history[1].code).toBe(0);
    const report = JSON.parse(fs.readFileSync(path.join(out, 'report.json'), 'utf8'));
    expect(report).toMatchObject({ complete: true, completed: 1, scheduled: 1 });
    expect(verifyProductionSelfplay(path.join(out, 'games/1-black/attempt-2'))).toMatchObject({ valid: true, status: 'complete' });
    fs.writeFileSync(path.join(out, 'retirement.json'), JSON.stringify({ reason: 'user withdrew this evaluation' }), { flag: 'wx' });
    const retired = spawnSync(process.execPath, [sourceEntry, 'resume', out], { cwd: root, encoding: 'utf8', windowsHide: true });
    expect(retired.status).toBe(1);
    expect(retired.stderr).toContain('Experiment retired');
    expect(JSON.parse(fs.readFileSync(path.join(out, 'processes.json'), 'utf8'))).toEqual(history);
}, 150000);
