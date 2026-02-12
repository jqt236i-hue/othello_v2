const fs = require('fs');
const path = require('path');
const {
    parseArgs,
    promoteModel
} = require('../scripts/promote-policy-model');

describe('selfplay policy promotion', () => {
    test('parseArgs requires adoption/candidate paths', () => {
        expect(() => parseArgs([])).toThrow('--adoption-result is required');
        expect(() => parseArgs(['--adoption-result', 'x.json'])).toThrow('--candidate-model is required');
    });

    test('promoteModel blocks when adoption decision is not passed', () => {
        const dir = path.resolve(__dirname, '..', 'data', 'models');
        fs.mkdirSync(dir, { recursive: true });
        const adoption = path.join(dir, 'adoption.block.test.json');
        const candidate = path.join(dir, 'candidate.block.test.json');
        fs.writeFileSync(adoption, JSON.stringify({ decision: { passed: false } }), 'utf8');
        fs.writeFileSync(candidate, JSON.stringify({ schemaVersion: 'policy_table.v1', states: {} }), 'utf8');

        expect(() => promoteModel({
            adoptionResultPath: adoption,
            candidateModelPath: candidate,
            targetModelPath: path.join(dir, 'target.block.test.json'),
            force: false
        })).toThrow('adoption decision is not passed');

        fs.unlinkSync(adoption);
        fs.unlinkSync(candidate);
    });

    test('promoteModel copies candidate when passed', () => {
        const dir = path.resolve(__dirname, '..', 'data', 'models');
        fs.mkdirSync(dir, { recursive: true });
        const adoption = path.join(dir, 'adoption.pass.test.json');
        const candidate = path.join(dir, 'candidate.pass.test.json');
        const target = path.join(dir, 'target.pass.test.json');
        const payload = { schemaVersion: 'policy_table.v1', states: { k: { bestAction: 'place:0:0', actions: {} } } };
        fs.writeFileSync(adoption, JSON.stringify({ decision: { passed: true } }), 'utf8');
        fs.writeFileSync(candidate, JSON.stringify(payload), 'utf8');

        const out = promoteModel({
            adoptionResultPath: adoption,
            candidateModelPath: candidate,
            targetModelPath: target,
            force: false
        });
        expect(out.targetModelPath).toBe(target);
        const copied = JSON.parse(fs.readFileSync(target, 'utf8'));
        expect(copied).toEqual(payload);

        fs.unlinkSync(adoption);
        fs.unlinkSync(candidate);
        fs.unlinkSync(target);
    });

    test('promoteModel accepts v2 candidate schema', () => {
        const dir = path.resolve(__dirname, '..', 'data', 'models');
        fs.mkdirSync(dir, { recursive: true });
        const adoption = path.join(dir, 'adoption.v2.pass.test.json');
        const candidate = path.join(dir, 'candidate.v2.pass.test.json');
        const target = path.join(dir, 'target.v2.pass.test.json');
        const payload = { schemaVersion: 'policy_table.v2', states: { k: { bestAction: 'place:0:0', actions: {} } } };
        fs.writeFileSync(adoption, JSON.stringify({ decision: { passed: true } }), 'utf8');
        fs.writeFileSync(candidate, JSON.stringify(payload), 'utf8');

        const out = promoteModel({
            adoptionResultPath: adoption,
            candidateModelPath: candidate,
            targetModelPath: target,
            force: false
        });
        expect(out.targetModelPath).toBe(target);
        const copied = JSON.parse(fs.readFileSync(target, 'utf8'));
        expect(copied.schemaVersion).toBe('policy_table.v2');

        fs.unlinkSync(adoption);
        fs.unlinkSync(candidate);
        fs.unlinkSync(target);
    });

    test('promoteModel also copies onnx and meta when provided', () => {
        const dir = path.resolve(__dirname, '..', 'data', 'models');
        fs.mkdirSync(dir, { recursive: true });
        const adoption = path.join(dir, 'adoption.onnx.pass.test.json');
        const candidate = path.join(dir, 'candidate.onnx.pass.test.json');
        const target = path.join(dir, 'target.onnx.pass.test.json');
        const candidateOnnx = path.join(dir, 'candidate.onnx.pass.test.onnx');
        const candidateOnnxMeta = path.join(dir, 'candidate.onnx.pass.test.onnx.meta.json');
        const targetOnnx = path.join(dir, 'target.onnx.pass.test.onnx');
        const targetOnnxMeta = path.join(dir, 'target.onnx.pass.test.onnx.meta.json');
        const payload = { schemaVersion: 'policy_table.v2', states: { k: { bestAction: 'place:0:0', actions: {} } } };

        fs.writeFileSync(adoption, JSON.stringify({ decision: { passed: true } }), 'utf8');
        fs.writeFileSync(candidate, JSON.stringify(payload), 'utf8');
        fs.writeFileSync(candidateOnnx, 'onnx-bytes', 'utf8');
        fs.writeFileSync(candidateOnnxMeta, JSON.stringify({ schemaVersion: 'policy_onnx.v1' }), 'utf8');

        const out = promoteModel({
            adoptionResultPath: adoption,
            candidateModelPath: candidate,
            candidateOnnxPath: candidateOnnx,
            candidateOnnxMetaPath: candidateOnnxMeta,
            targetModelPath: target,
            targetOnnxPath: targetOnnx,
            targetOnnxMetaPath: targetOnnxMeta,
            force: false
        });

        expect(out.onnxPromotion.promoted).toBe(true);
        expect(out.onnxMetaPromotion.promoted).toBe(true);
        expect(fs.readFileSync(targetOnnx, 'utf8')).toBe('onnx-bytes');
        expect(JSON.parse(fs.readFileSync(targetOnnxMeta, 'utf8')).schemaVersion).toBe('policy_onnx.v1');

        fs.unlinkSync(adoption);
        fs.unlinkSync(candidate);
        fs.unlinkSync(candidateOnnx);
        fs.unlinkSync(candidateOnnxMeta);
        fs.unlinkSync(target);
        fs.unlinkSync(targetOnnx);
        fs.unlinkSync(targetOnnxMeta);
    });

    test('promoteModel keeps policy-table promotion even when onnx files are missing', () => {
        const dir = path.resolve(__dirname, '..', 'data', 'models');
        fs.mkdirSync(dir, { recursive: true });
        const adoption = path.join(dir, 'adoption.onnx.missing.test.json');
        const candidate = path.join(dir, 'candidate.onnx.missing.test.json');
        const target = path.join(dir, 'target.onnx.missing.test.json');
        const payload = { schemaVersion: 'policy_table.v1', states: { k: { bestAction: 'place:0:0', actions: {} } } };

        fs.writeFileSync(adoption, JSON.stringify({ decision: { passed: true } }), 'utf8');
        fs.writeFileSync(candidate, JSON.stringify(payload), 'utf8');

        const out = promoteModel({
            adoptionResultPath: adoption,
            candidateModelPath: candidate,
            candidateOnnxPath: path.join(dir, 'missing-candidate.onnx'),
            candidateOnnxMetaPath: path.join(dir, 'missing-candidate.onnx.meta.json'),
            targetModelPath: target,
            targetOnnxPath: path.join(dir, 'target.onnx.missing.test.onnx'),
            targetOnnxMetaPath: path.join(dir, 'target.onnx.missing.test.onnx.meta.json'),
            force: false
        });

        expect(out.onnxPromotion.promoted).toBe(false);
        expect(out.onnxPromotion.reason).toBe('source_missing');
        expect(out.onnxMetaPromotion.promoted).toBe(false);
        expect(out.onnxMetaPromotion.reason).toBe('source_missing');
        expect(JSON.parse(fs.readFileSync(target, 'utf8')).schemaVersion).toBe('policy_table.v1');

        fs.unlinkSync(adoption);
        fs.unlinkSync(candidate);
        fs.unlinkSync(target);
    });
});
