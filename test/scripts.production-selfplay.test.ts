import fs = require('node:fs');
import os = require('node:os');
import path = require('node:path');
import { runProductionGame, type ProductionGameSpec } from '../scripts/run-production-selfplay';
import { verifyProductionSelfplay } from '../scripts/verify-production-selfplay';

let directory: string;
beforeEach(() => { directory = fs.mkdtempSync(path.join(os.tmpdir(), 'production-selfplay-test-')); });

// Test runs keep their journals for diagnosis; no recursive cleanup of a path
// computed from environment or test output is necessary.
function spec(name: string): ProductionGameSpec {
    const policy = { root: process.cwd(), module: 'game/ai/cpu-lv10-search', search: 'searchLv10', config: 'LV10_SEARCH_CONFIG', maxTransitions: 8 };
    return { seed: 20260914, out: path.join(directory, name), profiles: { black: 10, white: 10 },
        policies: { black: policy, white: policy }, maxDecisions: 1000, timeoutMs: 120000 };
}

test('a durable stop resumes with the same state and decision memory and does not duplicate moves', async () => {
    const stopFile = path.join(directory, 'stop.json');
    const firstSpec = { ...spec('first'), stopFile };
    const first = await runProductionGame(firstSpec, (_record, count) => {
        if (count === 3) fs.writeFileSync(stopFile, '{}');
    });
    expect(first.status).toBe('stopped'); expect(first.decisions).toBe(3);
    const checkpoint = path.join(firstSpec.out, 'checkpoint.json');
    const resumed = await runProductionGame({ ...spec('resumed'), resumeFrom: checkpoint });
    expect(resumed.status).toBe('complete');
    const uninterrupted = await runProductionGame(spec('uninterrupted'));
    expect(resumed.result).toEqual(uninterrupted.result);
    expect(resumed.finalStateHash).toEqual(uninterrupted.finalStateHash);
    expect(resumed.decisions).toBe(uninterrupted.decisions);
    const audit = verifyProductionSelfplay(path.join(directory, 'resumed'));
    expect(audit).toMatchObject({ valid: true, status: 'complete', decisions: resumed.decisions });
    expect(audit.decisionRecords).toHaveLength(resumed.decisions);
    expect(verifyProductionSelfplay(path.join(directory, 'uninterrupted'))).toMatchObject({ valid: true, status: 'complete', decisions: uninterrupted.decisions });
    const rows = fs.readFileSync(path.join(directory, 'resumed/steps.ndjson'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
    expect(rows[1].index).toBe(4);
    expect(new Set(rows.slice(1).map(row => row.index)).size).toBe(rows.length - 1);
    await expect(runProductionGame({ ...spec('duplicate'), resumeFrom: path.join(directory, 'resumed/checkpoint.json') })).rejects.toThrow('Resume checkpoint');
}, 120000);

test('changed decision budgets cannot resume a prior declared game', async () => {
    const stopFile = path.join(directory, 'stop.json'); fs.writeFileSync(stopFile, '{}');
    const first = spec('first'); await runProductionGame({ ...first, stopFile });
    const next = spec('next'); next.policies.black = { ...next.policies.black, maxTransitions: 16 };
    await expect(runProductionGame({ ...next, resumeFrom: path.join(first.out, 'checkpoint.json') })).rejects.toThrow('Resume checkpoint');
});

test('a fractional transition budget is rejected before creating a game attempt', async () => {
    const game = spec('fractional'); game.policies.black = { ...game.policies.black, maxTransitions: 1.5 };
    await expect(runProductionGame(game)).rejects.toThrow('Transition budget must be an integer');
    expect(fs.existsSync(game.out)).toBe(false);
});
