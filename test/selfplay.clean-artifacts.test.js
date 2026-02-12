const fs = require('fs');
const path = require('path');
const {
    parseArgs,
    collectTargets,
    shouldDeleteModelFile,
    summarizeTargets
} = require('../scripts/clean-selfplay-artifacts');

describe('selfplay clean artifacts script', () => {
    test('parseArgs supports keep-deployed/apply flags', () => {
        const args = parseArgs(['--apply', '--keep-deployed', '--runs-dir', 'data/runs', '--models-dir', 'data/models']);
        expect(args.apply).toBe(true);
        expect(args.keepDeployed).toBe(true);
        expect(args.runsDir.endsWith(path.join('data', 'runs'))).toBe(true);
        expect(args.modelsDir.endsWith(path.join('data', 'models'))).toBe(true);
    });

    test('shouldDeleteModelFile respects deployed keep option', () => {
        expect(shouldDeleteModelFile('policy-table.json', false)).toBe(true);
        expect(shouldDeleteModelFile('policy-table.json', true)).toBe(false);
        expect(shouldDeleteModelFile('policy-net.onnx', false)).toBe(true);
        expect(shouldDeleteModelFile('policy-net.onnx', true)).toBe(false);
        expect(shouldDeleteModelFile('policy-net.onnx.meta.json', true)).toBe(false);
        expect(shouldDeleteModelFile('policy-net.candidate.x.onnx', true)).toBe(true);
        expect(shouldDeleteModelFile('model.checkpoint.pt', true)).toBe(true);
        expect(shouldDeleteModelFile('readme.txt', false)).toBe(false);
    });

    test('collectTargets includes runs and selected model artifacts', () => {
        const root = path.resolve(__dirname, '..', 'data', `clean-test-${Date.now()}`);
        const runsDir = path.join(root, 'runs');
        const modelsDir = path.join(root, 'models');
        fs.mkdirSync(runsDir, { recursive: true });
        fs.mkdirSync(modelsDir, { recursive: true });

        const runFile = path.join(runsDir, 'selfplay.train.test.ndjson');
        const deployedTable = path.join(modelsDir, 'policy-table.json');
        const candidateTable = path.join(modelsDir, 'policy-table.candidate.test.json');
        fs.writeFileSync(runFile, 'x', 'utf8');
        fs.writeFileSync(deployedTable, '{}', 'utf8');
        fs.writeFileSync(candidateTable, '{}', 'utf8');

        const withDeployed = collectTargets({ runsDir, modelsDir, keepDeployed: false });
        const keepDeployed = collectTargets({ runsDir, modelsDir, keepDeployed: true });
        expect(withDeployed).toContain(runFile);
        expect(withDeployed).toContain(deployedTable);
        expect(withDeployed).toContain(candidateTable);
        expect(keepDeployed).toContain(runFile);
        expect(keepDeployed).not.toContain(deployedTable);
        expect(keepDeployed).toContain(candidateTable);

        const summary = summarizeTargets(withDeployed);
        expect(summary.files).toBe(3);
        expect(summary.totalBytes).toBeGreaterThan(0);

        fs.rmSync(root, { recursive: true, force: true });
    });
});

