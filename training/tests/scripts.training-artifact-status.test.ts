import * as path from 'path';
const {
    classifyTrainingArtifactPath
} = require('../scripts/training-artifact-status');

describe('training artifact status', () => {
    test('classifies active, archived, experimental, and incompatible artifact paths', () => {
        expect(classifyTrainingArtifactPath(path.resolve('data', 'models', 'promoted', 'champion', 'policy-table.json'))).toMatchObject({
            lifecycle: 'active',
            compatibility: 'unknown'
        });

        expect(classifyTrainingArtifactPath(path.resolve('data', 'models', 'archive', '2026-04-13', 'policy-table.json'))).toMatchObject({
            lifecycle: 'archived',
            compatibility: 'unknown'
        });

        expect(classifyTrainingArtifactPath(path.resolve('data', 'models', 'promoted', 'challenger', 'policy-table.json'))).toMatchObject({
            lifecycle: 'experimental',
            compatibility: 'unknown'
        });

        expect(classifyTrainingArtifactPath(path.resolve('data', 'models', 'policy-net.candidate.demo.checkpoint.pt'), {
            kind: 'model.policy-checkpoint'
        })).toMatchObject({
            lifecycle: 'experimental',
            compatibility: 'compatible',
            detectedCheckpointHead: 'policy'
        });

        expect(classifyTrainingArtifactPath(path.resolve('data', 'models', 'policy-card.candidate.demo.checkpoint.pt'), {
            kind: 'model.policy-checkpoint'
        })).toMatchObject({
            lifecycle: 'incompatible',
            compatibility: 'incompatible',
            detectedCheckpointHead: 'card',
            expectedCheckpointHead: 'policy'
        });

        expect(classifyTrainingArtifactPath(path.resolve('data', 'runs', 'browser_lv6_deploy_v1_seedbank_canary', 'policy-net.candidate.demo.shape10x10.it01.onnx'))).toMatchObject({
            lifecycle: 'incompatible',
            compatibility: 'incompatible',
            reason: 'board-shape-mismatch',
            expectedBoardSize: 8,
            detectedBoardSize: '10x10'
        });
    });
});
