const fs = require('fs');
const path = require('path');
const os = require('os');
const { parseArgs } = require('../scripts/generate-selfplay-data');

describe('selfplay generate data script', () => {
    test('parseArgs accepts existing --policy-model path', () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'othello-selfplay-'));
        const modelPath = path.join(tempDir, 'policy-table.json');
        fs.writeFileSync(modelPath, JSON.stringify({ schemaVersion: 'policy_table.v2', states: {} }), 'utf8');
        try {
            const args = parseArgs(['--policy-model', modelPath]);
            expect(args.policyModelPath).toBe(path.resolve(process.cwd(), modelPath));
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('parseArgs rejects missing --policy-model path', () => {
        expect(() => parseArgs(['--policy-model', 'missing-policy-model.json'])).toThrow('--policy-model not found:');
    });
});
