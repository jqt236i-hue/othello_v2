import fs = require('node:fs');
import os = require('node:os');
import path = require('node:path');
import { verifyProductionParityGate, establishProductionParityGate } from '../scripts/production-parity-gate';
import { resolveCandidateBrowserChecks } from '../scripts/verify-production-candidate-browser';

test('deep browser checks preserve the fixture inventory and reject missing or excessive overrides', () => {
    const labels = ['opening', 'pending', 'controller'];
    const spec = { schema: 'production-candidate-browser-checks.v1', overrides: [
        { label: 'pending', maxTransitions: 4096, requireAllScenarios: true }
    ] };
    const checks = resolveCandidateBrowserChecks(labels, { maxTransitions: 4096 }, spec);
    expect(checks.map(check => check.label)).toEqual(labels);
    expect(checks[0].maxTransitions).toBe(64);
    expect(checks[1]).toMatchObject({ maxTransitions: 4096, requireAllScenarios: true });
    expect(() => resolveCandidateBrowserChecks(labels, { maxTransitions: 1024 }, spec)).toThrow('production calculation budget');
    expect(() => resolveCandidateBrowserChecks(['opening'], { maxTransitions: 4096 }, spec)).toThrow('Unknown or duplicate');
    expect(() => resolveCandidateBrowserChecks(labels, { maxTransitions: 4096 }, { ...spec, overrides: [...spec.overrides, ...spec.overrides] }))
        .toThrow('Unknown or duplicate');
});

test('a passing boolean from an earlier report cannot authorize an acceptance experiment', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cpu-parity-receipt-'));
    const file = path.join(directory, 'gate.json'); fs.writeFileSync(file, JSON.stringify({ valid: true }));
    expect(() => verifyProductionParityGate(file, process.cwd(), process.cwd())).toThrow('not established');
    fs.writeFileSync(file, JSON.stringify({ schema: 'production-cpu-parity-gate.v1', valid: true,
        evidence: { cardCases: 200, fixedComputeJudgments: 17, fullGameActions: 189 },
        commonRuntimeSha256: 'a different previously tested runtime' }));
    expect(() => verifyProductionParityGate(file, process.cwd(), process.cwd())).toThrow('exact runtimes');
});

test('missing declared deep-search coverage cannot be hidden behind a passing report flag', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cpu-parity-coverage-'));
    const judgment = path.join(directory, 'judgment.json'), cards = path.join(directory, 'cards.json');
    fs.writeFileSync(judgment, JSON.stringify({ valid: true, errors: [], results: Array.from({ length: 10 }, () => ({
        differences: [], expected: {}, actual: {}, missingScenarioSeeds: [100909]
    })) }));
    fs.writeFileSync(cards, '{}');
    expect(() => establishProductionParityGate(process.cwd(), judgment, 'unused-trace', cards)).toThrow('Passing browser candidate judgment evidence');
});

test('fixed-compute evidence from a different candidate is rejected before replay or declaration', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cpu-parity-candidate-'));
    const judgment = path.join(directory, 'judgment.json'), cards = path.join(directory, 'cards.json');
    fs.writeFileSync(judgment, JSON.stringify({ valid: true, errors: [], results: Array.from({ length: 10 }, () => ({ differences: [], expected: {}, actual: {} })),
        searchSha256: 'previous candidate search', evaluationSha256: 'previous candidate evaluation' }));
    fs.writeFileSync(cards, '{}');
    expect(() => establishProductionParityGate(process.cwd(), judgment, 'unused-trace', cards)).toThrow('differs from the browser judgment');
});
