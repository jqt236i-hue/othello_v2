"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const deploy_lane_model_to_root_js_1 = require("../scripts/deploy-lane-model-to-root.js");
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
        const result = (0, deploy_lane_model_to_root_js_1.deployLaneModelToRoot)({
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
        expect(fs.existsSync(path.join(rootDir, 'archive', 'test-deploy-1', 'policy-table.json'))).toBe(true);
    });
    test('blocks when lane has fewer states than root without --force', () => {
        const laneDir = createTempDir(testBase, 'lane-fewer');
        const rootDir = createTempDir(testBase, 'root-fewer');
        writeModel(laneDir, 'policy-table.json', 5);
        writeModel(rootDir, 'policy-table.json', 50);
        expect(() => (0, deploy_lane_model_to_root_js_1.deployLaneModelToRoot)({
            laneDir,
            rootModelsDir: rootDir
        })).toThrow('fewer states');
    });
    test('allows fewer states with --force', () => {
        const laneDir = createTempDir(testBase, 'lane-force');
        const rootDir = createTempDir(testBase, 'root-force');
        writeModel(laneDir, 'policy-table.json', 5);
        writeModel(rootDir, 'policy-table.json', 50);
        const result = (0, deploy_lane_model_to_root_js_1.deployLaneModelToRoot)({
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
        expect(() => (0, deploy_lane_model_to_root_js_1.deployLaneModelToRoot)({
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
        const result = (0, deploy_lane_model_to_root_js_1.deployLaneModelToRoot)({
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
        expect(() => (0, deploy_lane_model_to_root_js_1.deployLaneModelToRoot)({
            laneDir,
            rootModelsDir: rootDir
        })).toThrow('Lane model not found');
    });
});
//# sourceMappingURL=scripts.deploy-lane-model-to-root.test.js.map