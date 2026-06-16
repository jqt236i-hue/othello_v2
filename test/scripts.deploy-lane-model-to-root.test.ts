import * as fs from 'fs';
import * as path from 'path';
import { deployLaneModelToRoot } from '../scripts/deploy-lane-model-to-root.js';

function createTempDir(base, sub) {
    const dir = path.join(base, sub);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

function writeModel(dir, filename, stateCount) {
    const states = {};
    for (let i = 0; i < stateCount; i++) {
        states[`s${i}`] = { bestAction: `place:${i}:0`, actions: {} };
    }
    const model = { schemaVersion: 'policy_table.v2', states, abstractStates: {} };
    const p = path.join(dir, filename);
    fs.writeFileSync(p, JSON.stringify(model), 'utf8');
    return p;
}

function cleanDir(dir) {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

describe('deploy-lane-model-to-root', () => {
    const testBase = path.resolve(__dirname, '..', 'data', 'models', '__deploy_test__');

    afterEach(() => cleanDir(testBase));

    test('deploys lane model to root and creates deploy-manifest', () => {
        const laneDir = createTempDir(testBase, 'lane');
        const rootDir = createTempDir(testBase, 'root');
        writeModel(laneDir, 'policy-table.json', 100);
        writeModel(rootDir, 'policy-table.json', 10);
        fs.writeFileSync(path.join(laneDir, 'policy-net.onnx'), 'onnx', 'utf8');
        fs.writeFileSync(path.join(laneDir, 'policy-net.onnx.meta.json'), '{"schemaVersion":"policy_onnx.v1"}', 'utf8');
        fs.writeFileSync(path.join(rootDir, 'model-assets.json'), JSON.stringify({
            schemaVersion: 'model_assets.v1',
            generatedAt: '2026-01-01T00:00:00.000Z',
            files: ['data/models/othello/policy-table.json']
        }), 'utf8');

        const result = deployLaneModelToRoot({
            laneDir,
            rootModelsDir: rootDir,
            deployId: 'test-deploy-1'
        });

        expect(result.laneStates).toBe(100);
        expect(result.previousRootStates).toBe(10);
        expect(result.deployId).toBe('test-deploy-1');

        const deployed = JSON.parse(fs.readFileSync(path.join(rootDir, 'policy-table.json'), 'utf8'));
        expect(Object.keys(deployed.states).length).toBe(100);

        const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'deploy-manifest.json'), 'utf8'));
        expect(manifest.schemaVersion).toBe('root_deploy_manifest.v1');
        expect(manifest.laneStates).toBe(100);
        expect(manifest.modelAssetManifestPath).toBe(path.join(rootDir, 'model-assets.json'));
        expect(manifest.modelAssetManifestFiles).toEqual(expect.arrayContaining([
            'data/models/policy-net.onnx',
            'data/models/policy-net.onnx.meta.json'
        ]));

        const assetManifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'model-assets.json'), 'utf8'));
        expect(assetManifest.schemaVersion).toBe('model_assets.v1');
        expect(assetManifest.files).toEqual(expect.arrayContaining([
            'data/models/othello/policy-table.json',
            'data/models/policy-net.onnx',
            'data/models/policy-net.onnx.meta.json'
        ]));

        expect(fs.existsSync(path.join(rootDir, 'archive', 'test-deploy-1', 'policy-table.json'))).toBe(true);
    });

    test('blocks when lane has fewer states than root without --force', () => {
        const laneDir = createTempDir(testBase, 'lane-fewer');
        const rootDir = createTempDir(testBase, 'root-fewer');
        writeModel(laneDir, 'policy-table.json', 5);
        writeModel(rootDir, 'policy-table.json', 50);

        expect(() => deployLaneModelToRoot({
            laneDir,
            rootModelsDir: rootDir
        })).toThrow('fewer states');
    });

    test('allows fewer states with --force', () => {
        const laneDir = createTempDir(testBase, 'lane-force');
        const rootDir = createTempDir(testBase, 'root-force');
        writeModel(laneDir, 'policy-table.json', 5);
        writeModel(rootDir, 'policy-table.json', 50);

        const result = deployLaneModelToRoot({
            laneDir,
            rootModelsDir: rootDir,
            force: true,
            deployId: 'force-deploy'
        });

        expect(result.laneStates).toBe(5);
        expect(result.forced).toBe(true);
    });

    test('blocks below --min-states', () => {
        const laneDir = createTempDir(testBase, 'lane-min');
        const rootDir = createTempDir(testBase, 'root-min');
        writeModel(laneDir, 'policy-table.json', 10);

        expect(() => deployLaneModelToRoot({
            laneDir,
            rootModelsDir: rootDir,
            minStates: 100
        })).toThrow('below minimum');
    });

    test('dry-run does not write files', () => {
        const laneDir = createTempDir(testBase, 'lane-dry');
        const rootDir = createTempDir(testBase, 'root-dry');
        writeModel(laneDir, 'policy-table.json', 50);
        writeModel(rootDir, 'policy-table.json', 10);

        const result = deployLaneModelToRoot({
            laneDir,
            rootModelsDir: rootDir,
            dryRun: true,
            deployId: 'dry-run-1'
        });

        expect(result.dryRun).toBe(true);
        expect(result.laneStates).toBe(50);
        expect(result.rootStates).toBe(10);

        const rootModel = JSON.parse(fs.readFileSync(path.join(rootDir, 'policy-table.json'), 'utf8'));
        expect(Object.keys(rootModel.states).length).toBe(10);
        expect(fs.existsSync(path.join(rootDir, 'deploy-manifest.json'))).toBe(false);
    });

    test('throws for missing lane model', () => {
        const laneDir = createTempDir(testBase, 'lane-missing');
        const rootDir = createTempDir(testBase, 'root-missing');

        expect(() => deployLaneModelToRoot({
            laneDir,
            rootModelsDir: rootDir
        })).toThrow('Lane model not found');
    });
});
