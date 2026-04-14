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
        expect(rolledBack.deployTruthPath).toBe(path.join(promotedDir, 'promotion-deploy-truth.json'));
        expect(JSON.parse(fs.readFileSync(target, 'utf8'))).toEqual(previousPayload);
        expect(fs.readFileSync(targetOnnx, 'utf8')).toBe('old-onnx');
        expect(JSON.parse(fs.readFileSync(path.join(promotedDir, 'champion', 'policy-table.json'), 'utf8'))).toEqual(previousPayload);

        fs.rmSync(dir, { recursive: true, force: true });
    });

    test('rollbackModel restores archived card specialist artifacts when present', () => {
        const dir = path.resolve(__dirname, '..', 'data', 'models', 'rollback.card.lifecycle.test');
        fs.rmSync(dir, { recursive: true, force: true });
        fs.mkdirSync(dir, { recursive: true });

        const adoption = path.join(dir, 'adoption.rollback.card.test.json');
        const candidate = path.join(dir, 'candidate.rollback.card.test.json');
        const target = path.join(dir, 'policy-table.json');
        const targetCardOnnx = path.join(dir, 'policy-card.onnx');
        const targetCardOnnxMeta = path.join(dir, 'policy-card.onnx.meta.json');
        const candidateCardOnnx = path.join(dir, 'candidate.rollback.card.test.onnx');
        const candidateCardOnnxMeta = path.join(dir, 'candidate.rollback.card.test.onnx.meta.json');
        const promotedDir = path.join(dir, 'promoted');
        const archiveDir = path.join(dir, 'archive');
        const manifestPath = path.join(promotedDir, 'promotion-manifest.json');

        const previousPayload = { schemaVersion: 'policy_table.v1', states: { old: { bestAction: 'place:0:0', actions: {} } } };
        const nextPayload = { schemaVersion: 'policy_table.v2', states: { next: { bestAction: 'place:2:2', actions: {} } } };

        fs.writeFileSync(adoption, JSON.stringify({ decision: { passed: true } }), 'utf8');
        fs.writeFileSync(candidate, JSON.stringify(nextPayload), 'utf8');
        fs.writeFileSync(target, JSON.stringify(previousPayload), 'utf8');
        fs.writeFileSync(targetCardOnnx, 'old-card-onnx', 'utf8');
        fs.writeFileSync(targetCardOnnxMeta, JSON.stringify({ schemaVersion: 'policy_onnx.v1', tag: 'old-card' }), 'utf8');
        fs.writeFileSync(candidateCardOnnx, 'new-card-onnx', 'utf8');
        fs.writeFileSync(candidateCardOnnxMeta, JSON.stringify({ schemaVersion: 'policy_onnx.v1', tag: 'new-card' }), 'utf8');

        promoteModel({
            adoptionResultPath: adoption,
            candidateModelPath: candidate,
            candidateCardOnnxPath: candidateCardOnnx,
            candidateCardOnnxMetaPath: candidateCardOnnxMeta,
            targetModelPath: target,
            targetCardOnnxPath: targetCardOnnx,
            targetCardOnnxMetaPath: targetCardOnnxMeta,
            promotedDir,
            archiveDir,
            manifestPath,
            promotedAt: '2026-03-08T22:00:00.000Z',
            force: false
        });

        const rolledBack = rollbackModel({
            manifestPath,
            restoredAt: '2026-03-08T23:00:00.000Z'
        });

        expect(rolledBack.restored.cardOnnx.restored).toBe(true);
        expect(rolledBack.restored.cardOnnxMeta.restored).toBe(true);
        expect(fs.readFileSync(targetCardOnnx, 'utf8')).toBe('old-card-onnx');
        expect(JSON.parse(fs.readFileSync(targetCardOnnxMeta, 'utf8')).tag).toBe('old-card');

        fs.rmSync(dir, { recursive: true, force: true });
    });

    test('rollbackModel restores archived target and value artifacts when present', () => {
        const dir = path.resolve(__dirname, '..', 'data', 'models', 'rollback.target-value.lifecycle.test');
        fs.rmSync(dir, { recursive: true, force: true });
        fs.mkdirSync(dir, { recursive: true });

        const adoption = path.join(dir, 'adoption.rollback.target-value.test.json');
        const candidate = path.join(dir, 'candidate.rollback.target-value.test.json');
        const target = path.join(dir, 'policy-table.json');
        const targetTargetOnnx = path.join(dir, 'policy-target.onnx');
        const targetTargetOnnxMeta = path.join(dir, 'policy-target.onnx.meta.json');
        const targetValueOnnx = path.join(dir, 'policy-value.onnx');
        const targetValueOnnxMeta = path.join(dir, 'policy-value.onnx.meta.json');
        const candidateTargetOnnx = path.join(dir, 'candidate.rollback.target.test.onnx');
        const candidateTargetOnnxMeta = path.join(dir, 'candidate.rollback.target.test.onnx.meta.json');
        const candidateValueOnnx = path.join(dir, 'candidate.rollback.value.test.onnx');
        const candidateValueOnnxMeta = path.join(dir, 'candidate.rollback.value.test.onnx.meta.json');
        const promotedDir = path.join(dir, 'promoted');
        const archiveDir = path.join(dir, 'archive');
        const manifestPath = path.join(promotedDir, 'promotion-manifest.json');

        const previousPayload = { schemaVersion: 'policy_table.v1', states: { old: { bestAction: 'place:0:0', actions: {} } } };
        const nextPayload = { schemaVersion: 'policy_table.v2', states: { next: { bestAction: 'place:2:2', actions: {} } } };

        fs.writeFileSync(adoption, JSON.stringify({ decision: { passed: true } }), 'utf8');
        fs.writeFileSync(candidate, JSON.stringify(nextPayload), 'utf8');
        fs.writeFileSync(target, JSON.stringify(previousPayload), 'utf8');
        fs.writeFileSync(targetTargetOnnx, 'old-target-onnx', 'utf8');
        fs.writeFileSync(targetTargetOnnxMeta, JSON.stringify({ schemaVersion: 'policy_onnx.v1', tag: 'old-target' }), 'utf8');
        fs.writeFileSync(targetValueOnnx, 'old-value-onnx', 'utf8');
        fs.writeFileSync(targetValueOnnxMeta, JSON.stringify({ schemaVersion: 'policy_onnx.v1', tag: 'old-value' }), 'utf8');
        fs.writeFileSync(candidateTargetOnnx, 'new-target-onnx', 'utf8');
        fs.writeFileSync(candidateTargetOnnxMeta, JSON.stringify({ schemaVersion: 'policy_onnx.v1', tag: 'new-target' }), 'utf8');
        fs.writeFileSync(candidateValueOnnx, 'new-value-onnx', 'utf8');
        fs.writeFileSync(candidateValueOnnxMeta, JSON.stringify({ schemaVersion: 'policy_onnx.v1', tag: 'new-value' }), 'utf8');

        promoteModel({
            adoptionResultPath: adoption,
            candidateModelPath: candidate,
            candidateTargetOnnxPath: candidateTargetOnnx,
            candidateTargetOnnxMetaPath: candidateTargetOnnxMeta,
            candidateValueOnnxPath: candidateValueOnnx,
            candidateValueOnnxMetaPath: candidateValueOnnxMeta,
            targetModelPath: target,
            targetTargetOnnxPath: targetTargetOnnx,
            targetTargetOnnxMetaPath: targetTargetOnnxMeta,
            targetValueOnnxPath: targetValueOnnx,
            targetValueOnnxMetaPath: targetValueOnnxMeta,
            promotedDir,
            archiveDir,
            manifestPath,
            promotedAt: '2026-03-08T23:10:00.000Z',
            force: false
        });

        const rolledBack = rollbackModel({
            manifestPath,
            restoredAt: '2026-03-08T23:20:00.000Z'
        });

        expect(rolledBack.restored.targetOnnx.restored).toBe(true);
        expect(rolledBack.restored.targetOnnxMeta.restored).toBe(true);
        expect(rolledBack.restored.valueOnnx.restored).toBe(true);
        expect(rolledBack.restored.valueOnnxMeta.restored).toBe(true);
        expect(fs.readFileSync(targetTargetOnnx, 'utf8')).toBe('old-target-onnx');
        expect(JSON.parse(fs.readFileSync(targetTargetOnnxMeta, 'utf8')).tag).toBe('old-target');
        expect(fs.readFileSync(targetValueOnnx, 'utf8')).toBe('old-value-onnx');
        expect(JSON.parse(fs.readFileSync(targetValueOnnxMeta, 'utf8')).tag).toBe('old-value');

        fs.rmSync(dir, { recursive: true, force: true });
    });
});
