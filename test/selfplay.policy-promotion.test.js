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

    test('promoteModel also copies card specialist onnx and meta when provided', () => {
        const dir = path.resolve(__dirname, '..', 'data', 'models');
        fs.mkdirSync(dir, { recursive: true });
        const adoption = path.join(dir, 'adoption.card.pass.test.json');
        const candidate = path.join(dir, 'candidate.card.pass.test.json');
        const target = path.join(dir, 'target.card.pass.test.json');
        const candidateCardOnnx = path.join(dir, 'candidate.card.pass.test.onnx');
        const candidateCardOnnxMeta = path.join(dir, 'candidate.card.pass.test.onnx.meta.json');
        const targetCardOnnx = path.join(dir, 'target.card.pass.test.onnx');
        const targetCardOnnxMeta = path.join(dir, 'target.card.pass.test.onnx.meta.json');
        const payload = { schemaVersion: 'policy_table.v2', states: { k: { bestAction: 'place:0:0', actions: {} } } };

        fs.writeFileSync(adoption, JSON.stringify({ decision: { passed: true } }), 'utf8');
        fs.writeFileSync(candidate, JSON.stringify(payload), 'utf8');
        fs.writeFileSync(candidateCardOnnx, 'card-onnx-bytes', 'utf8');
        fs.writeFileSync(candidateCardOnnxMeta, JSON.stringify({ schemaVersion: 'policy_onnx.v1', cardOutputName: 'card_logits' }), 'utf8');

        const out = promoteModel({
            adoptionResultPath: adoption,
            candidateModelPath: candidate,
            candidateCardOnnxPath: candidateCardOnnx,
            candidateCardOnnxMetaPath: candidateCardOnnxMeta,
            targetModelPath: target,
            targetCardOnnxPath: targetCardOnnx,
            targetCardOnnxMetaPath: targetCardOnnxMeta,
            force: false
        });

        expect(out.cardOnnxPromotion.promoted).toBe(true);
        expect(out.cardOnnxMetaPromotion.promoted).toBe(true);
        expect(fs.readFileSync(targetCardOnnx, 'utf8')).toBe('card-onnx-bytes');
        expect(JSON.parse(fs.readFileSync(targetCardOnnxMeta, 'utf8')).cardOutputName).toBe('card_logits');

        fs.unlinkSync(adoption);
        fs.unlinkSync(candidate);
        fs.unlinkSync(candidateCardOnnx);
        fs.unlinkSync(candidateCardOnnxMeta);
        fs.unlinkSync(target);
        fs.unlinkSync(targetCardOnnx);
        fs.unlinkSync(targetCardOnnxMeta);
    });

    test('promoteModel archives the previous champion and writes rollback manifest', () => {
        const dir = path.resolve(__dirname, '..', 'data', 'models', 'promotion.lifecycle.test');
        fs.rmSync(dir, { recursive: true, force: true });
        fs.mkdirSync(dir, { recursive: true });

        const adoption = path.join(dir, 'adoption.lifecycle.test.json');
        const candidate = path.join(dir, 'candidate.lifecycle.test.json');
        const target = path.join(dir, 'policy-table.json');
        const candidateOnnx = path.join(dir, 'candidate.lifecycle.test.onnx');
        const candidateOnnxMeta = path.join(dir, 'candidate.lifecycle.test.onnx.meta.json');
        const targetOnnx = path.join(dir, 'policy-net.onnx');
        const targetOnnxMeta = path.join(dir, 'policy-net.onnx.meta.json');
        const candidateTargetOnnx = path.join(dir, 'candidate.target.lifecycle.test.onnx');
        const candidateTargetOnnxMeta = path.join(dir, 'candidate.target.lifecycle.test.onnx.meta.json');
        const targetTargetOnnx = path.join(dir, 'policy-target.onnx');
        const targetTargetOnnxMeta = path.join(dir, 'policy-target.onnx.meta.json');
        const candidateValueOnnx = path.join(dir, 'candidate.value.lifecycle.test.onnx');
        const candidateValueOnnxMeta = path.join(dir, 'candidate.value.lifecycle.test.onnx.meta.json');
        const targetValueOnnx = path.join(dir, 'policy-value.onnx');
        const targetValueOnnxMeta = path.join(dir, 'policy-value.onnx.meta.json');
        const promotedDir = path.join(dir, 'promoted');
        const archiveDir = path.join(dir, 'archive');
        const manifestPath = path.join(promotedDir, 'promotion-manifest.json');
        const previousPayload = { schemaVersion: 'policy_table.v1', states: { old: { bestAction: 'place:0:0', actions: {} } } };
        const candidatePayload = { schemaVersion: 'policy_table.v2', states: { next: { bestAction: 'place:1:1', actions: {} } } };

        fs.writeFileSync(adoption, JSON.stringify({ decision: { passed: true } }), 'utf8');
        fs.writeFileSync(candidate, JSON.stringify(candidatePayload), 'utf8');
        fs.writeFileSync(target, JSON.stringify(previousPayload), 'utf8');
        fs.writeFileSync(candidateOnnx, 'new-onnx', 'utf8');
        fs.writeFileSync(candidateOnnxMeta, JSON.stringify({ schemaVersion: 'policy_onnx.v1', tag: 'new' }), 'utf8');
        fs.writeFileSync(targetOnnx, 'old-onnx', 'utf8');
        fs.writeFileSync(targetOnnxMeta, JSON.stringify({ schemaVersion: 'policy_onnx.v1', tag: 'old' }), 'utf8');
        fs.writeFileSync(candidateTargetOnnx, 'new-target-onnx', 'utf8');
        fs.writeFileSync(candidateTargetOnnxMeta, JSON.stringify({ schemaVersion: 'policy_onnx.v1', targetOutputName: 'target_logits' }), 'utf8');
        fs.writeFileSync(targetTargetOnnx, 'old-target-onnx', 'utf8');
        fs.writeFileSync(targetTargetOnnxMeta, JSON.stringify({ schemaVersion: 'policy_onnx.v1', targetOutputName: 'target_logits', tag: 'old-target' }), 'utf8');
        fs.writeFileSync(candidateValueOnnx, 'new-value-onnx', 'utf8');
        fs.writeFileSync(candidateValueOnnxMeta, JSON.stringify({ schemaVersion: 'policy_onnx.v1', valueOutputName: 'value' }), 'utf8');
        fs.writeFileSync(targetValueOnnx, 'old-value-onnx', 'utf8');
        fs.writeFileSync(targetValueOnnxMeta, JSON.stringify({ schemaVersion: 'policy_onnx.v1', valueOutputName: 'value', tag: 'old-value' }), 'utf8');

        const out = promoteModel({
            adoptionResultPath: adoption,
            candidateModelPath: candidate,
            candidateOnnxPath: candidateOnnx,
            candidateOnnxMetaPath: candidateOnnxMeta,
            candidateTargetOnnxPath: candidateTargetOnnx,
            candidateTargetOnnxMetaPath: candidateTargetOnnxMeta,
            candidateValueOnnxPath: candidateValueOnnx,
            candidateValueOnnxMetaPath: candidateValueOnnxMeta,
            targetModelPath: target,
            targetOnnxPath: targetOnnx,
            targetOnnxMetaPath: targetOnnxMeta,
            targetTargetOnnxPath: targetTargetOnnx,
            targetTargetOnnxMetaPath: targetTargetOnnxMeta,
            targetValueOnnxPath: targetValueOnnx,
            targetValueOnnxMetaPath: targetValueOnnxMeta,
            promotedDir,
            archiveDir,
            manifestPath,
            promotedAt: '2026-03-08T12:34:56.000Z',
            force: false
        });

        expect(JSON.parse(fs.readFileSync(target, 'utf8'))).toEqual(candidatePayload);
        expect(fs.readFileSync(targetOnnx, 'utf8')).toBe('new-onnx');
        expect(out.archivedChampion.model.archived).toBe(true);
        expect(out.archivedChampion.onnx.archived).toBe(true);
        expect(out.archivedChampion.targetOnnx.archived).toBe(true);
        expect(out.archivedChampion.valueOnnx.archived).toBe(true);
        expect(out.rollback.modelPath).toContain(path.join('archive', '2026-03-08T12-34-56-000Z'));
        expect(JSON.parse(fs.readFileSync(out.rollback.modelPath, 'utf8'))).toEqual(previousPayload);
        expect(fs.readFileSync(out.rollback.onnxPath, 'utf8')).toBe('old-onnx');
        expect(fs.readFileSync(out.rollback.targetOnnxPath, 'utf8')).toBe('old-target-onnx');
        expect(fs.readFileSync(out.rollback.valueOnnxPath, 'utf8')).toBe('old-value-onnx');

        const championModelPath = path.join(promotedDir, 'champion', 'policy-table.json');
        const challengerModelPath = path.join(promotedDir, 'challenger', 'policy-table.json');
        expect(JSON.parse(fs.readFileSync(championModelPath, 'utf8'))).toEqual(candidatePayload);
        expect(JSON.parse(fs.readFileSync(challengerModelPath, 'utf8'))).toEqual(candidatePayload);

        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        expect(manifest.schemaVersion).toBe('policy_promotion.v3');
        expect(manifest.rollback.modelPath).toBe(out.rollback.modelPath);
        expect(manifest.archive.model.archived).toBe(true);
        expect(manifest.archive.targetOnnx.archived).toBe(true);
        expect(manifest.archive.valueOnnx.archived).toBe(true);
        expect(manifest.champion.modelPath).toBe(championModelPath);
        expect(manifest.challenger.modelPath).toBe(challengerModelPath);

        fs.rmSync(dir, { recursive: true, force: true });
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
