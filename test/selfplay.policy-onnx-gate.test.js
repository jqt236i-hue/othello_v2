const fs = require('fs');
const path = require('path');
const {
    parseArgs,
    buildSeedList,
    computeOnnxGateDecision
} = require('../scripts/benchmark-policy-onnx-gate');

describe('selfplay onnx gate benchmark script', () => {
    test('parseArgs requires candidate onnx path', () => {
        expect(() => parseArgs(['--games', '2'])).toThrow('--candidate-onnx is required');
    });

    test('parseArgs infers candidate meta path', () => {
        const modelsDir = path.resolve(__dirname, '..', 'data', 'models');
        const onnxPath = path.join(modelsDir, 'policy-net.onnx-gate.test.onnx');
        const metaPath = `${onnxPath}.meta.json`;
        fs.mkdirSync(modelsDir, { recursive: true });
        fs.writeFileSync(onnxPath, Buffer.from([1, 2, 3]));
        fs.writeFileSync(metaPath, JSON.stringify({ schemaVersion: 'policy_onnx.v1' }), 'utf8');

        const args = parseArgs([
            '--games', '4',
            '--seed-count', '3',
            '--min-seed-pass-count', '2',
            '--candidate-onnx', onnxPath
        ]);
        expect(args.games).toBe(4);
        expect(args.seedCount).toBe(3);
        expect(args.minSeedPassCount).toBe(2);
        expect(args.candidateOnnxMetaPath).toBe(metaPath);

        fs.unlinkSync(onnxPath);
        fs.unlinkSync(metaPath);
    });

    test('buildSeedList creates deterministic sequence', () => {
        expect(buildSeedList(10, 3, 7)).toEqual([10, 17, 24]);
    });

    test('computeOnnxGateDecision enforces all constraints', () => {
        const decision = computeOnnxGateDecision(
            [
                { candidateScore: 0.55 },
                { candidateScore: 0.60 },
                { candidateScore: 0.44 }
            ],
            {
                threshold: 0.5,
                minSeedScore: 0.45,
                minSeedPassCount: 2
            },
            {
                totalMatches: 6,
                onnxLoadedMatches: 6,
                runtimeErrorCount: 0,
                matchErrorCount: 1
            }
        );
        expect(decision.passedByAverage).toBe(true);
        expect(decision.passedBySeedPassCount).toBe(true);
        expect(decision.passedByMinSeedScore).toBe(false);
        expect(decision.passedByNoMatchErrors).toBe(false);
        expect(decision.passed).toBe(false);
    });
});
