const fs = require('fs');
const path = require('path');
const { promoteModel } = require('../scripts/promote-policy-model');
const { parseArgs, rollbackModel } = require('../scripts/rollback-policy-model');

describe('selfplay policy rollback', () => {
    test('parseArgs requires manifest path', () => {
        expect(() => parseArgs([])).toThrow('--manifest is required');
    });

    test('rollbackModel restores archived champion from manifest', () => {
        const dir = path.resolve(__dirname, '..', 'data', 'models', 'rollback.lifecycle.test');
        fs.rmSync(dir, { recursive: true, force: true });
        fs.mkdirSync(dir, { recursive: true });

        const adoption = path.join(dir, 'adoption.rollback.test.json');
        const candidate = path.join(dir, 'candidate.rollback.test.json');
        const target = path.join(dir, 'policy-table.json');
        const targetOnnx = path.join(dir, 'policy-net.onnx');
        const targetOnnxMeta = path.join(dir, 'policy-net.onnx.meta.json');
        const candidateOnnx = path.join(dir, 'candidate.rollback.test.onnx');
        const candidateOnnxMeta = path.join(dir, 'candidate.rollback.test.onnx.meta.json');
        const promotedDir = path.join(dir, 'promoted');
        const archiveDir = path.join(dir, 'archive');
        const manifestPath = path.join(promotedDir, 'promotion-manifest.json');

        const previousPayload = { schemaVersion: 'policy_table.v1', states: { old: { bestAction: 'place:0:0', actions: {} } } };
        const nextPayload = { schemaVersion: 'policy_table.v2', states: { next: { bestAction: 'place:2:2', actions: {} } } };

        fs.writeFileSync(adoption, JSON.stringify({ decision: { passed: true } }), 'utf8');
        fs.writeFileSync(candidate, JSON.stringify(nextPayload), 'utf8');
        fs.writeFileSync(target, JSON.stringify(previousPayload), 'utf8');
        fs.writeFileSync(targetOnnx, 'old-onnx', 'utf8');
        fs.writeFileSync(targetOnnxMeta, JSON.stringify({ schemaVersion: 'policy_onnx.v1', tag: 'old' }), 'utf8');
        fs.writeFileSync(candidateOnnx, 'new-onnx', 'utf8');
        fs.writeFileSync(candidateOnnxMeta, JSON.stringify({ schemaVersion: 'policy_onnx.v1', tag: 'new' }), 'utf8');

        promoteModel({
            adoptionResultPath: adoption,
            candidateModelPath: candidate,
            candidateOnnxPath: candidateOnnx,
            candidateOnnxMetaPath: candidateOnnxMeta,
            targetModelPath: target,
            targetOnnxPath: targetOnnx,
            targetOnnxMetaPath: targetOnnxMeta,
            promotedDir,
            archiveDir,
            manifestPath,
            promotedAt: '2026-03-08T20:00:00.000Z',
            force: false
        });

        const rolledBack = rollbackModel({
            manifestPath,
            restoredAt: '2026-03-08T21:00:00.000Z'
        });

        expect(rolledBack.promotionId).toBe('2026-03-08T20-00-00-000Z');
        expect(JSON.parse(fs.readFileSync(target, 'utf8'))).toEqual(previousPayload);
        expect(fs.readFileSync(targetOnnx, 'utf8')).toBe('old-onnx');
        expect(JSON.parse(fs.readFileSync(path.join(promotedDir, 'champion', 'policy-table.json'), 'utf8'))).toEqual(previousPayload);

        fs.rmSync(dir, { recursive: true, force: true });
    });
});
